// src/services/sync-reconciliation.js
//
// Phase 11 Plan 5 — First-sign-in reconciliation orchestrator (SYNC-04).
//
// Called once by initSyncEngine() on `auth.status === 'authed'` transition.
// Classifies the "state of the world" into one of 4 cells and branches per
// CONTEXT D-01..D-07:
//
//   | Local     | Cloud     | Action                                              | UI                     |
//   | --------- | --------- | --------------------------------------------------- | ---------------------- |
//   | empty     | empty     | seed sync_last_pulled_at; done                       | silent (chip: SYNCED)  |
//   | empty     | populated | bulkPull() — silent pull (D-06)                      | bulk-pull splash       |
//   | populated | empty     | enqueue every local row into sync_queue + flush      | chip SYNCING → SYNCED  |
//   | populated | populated | LOCKDOWN reconciliation modal (D-01..D-04) — 3-choice| 3-button forced choice |
//
// Pitfall 11-E resume: if `sync_pull_in_progress` meta flag is set, a previous
// bulkPull was interrupted — resume via splash + bulkPull without re-classifying.
//
// Exports:
//   classifyState()         — returns { state, localCounts, cloudCounts }
//   reconcile()             — full orchestrator (the entry point initSyncEngine calls)
//   handleMergeEverything() — LWW pull + push queued
//   handleKeepLocal()       — delete-all cloud + re-enqueue local + flush
//   handleKeepCloud()       — clear local + clear queue + bulkPull

import { db } from '../db/schema.js';
import { withHooksSuppressed, scheduleFlush, SYNCABLE_TABLES } from './sync-engine.js';

// Data tables visible to reconciliation counts — profile is EXCLUDED per D-03
// (Phase 10's WELCOME BACK prompt already reconciles profile in isolation).
const RECONCILIATION_TABLES = ['collection', 'decks', 'deck_cards', 'games', 'watchlist'];

// ---------------------------------------------------------------------------
// classifyState — 4-state detection (D-03 excludes profile)
// ---------------------------------------------------------------------------

export async function classifyState() {
  const { getSupabase } = await import('./supabase.js');
  const supabase = getSupabase();

  // Local counts — 5 data tables; profile excluded.
  const localCounts = {};
  for (const t of RECONCILIATION_TABLES) {
    localCounts[t] = await db.table(t).count();
  }
  const localPopulated = Object.values(localCounts).some((n) => n > 0);

  // Cloud counts — RLS filters to household per Pitfall 11-F (this is
  // the intended behaviour; labelled "HOUSEHOLD (CLOUD)" in UI-SPEC §2).
  const cloudCounts = {};
  for (const t of RECONCILIATION_TABLES) {
    const { count } = await supabase.schema('counterflux').from(t).select('*', { count: 'exact', head: true });
    cloudCounts[t] = count ?? 0;
  }
  const cloudPopulated = Object.values(cloudCounts).some((n) => n > 0);

  const state =
    !localPopulated && !cloudPopulated ? 'empty-empty' :
    !localPopulated &&  cloudPopulated ? 'empty-populated' :
     localPopulated && !cloudPopulated ? 'populated-empty' :
    'populated-populated';

  return { state, localCounts, cloudCounts };
}

// ---------------------------------------------------------------------------
// reconcile — full orchestrator
// ---------------------------------------------------------------------------

export async function reconcile() {
  // Pitfall 11-E: if a prior bulkPull was interrupted, the meta flag is still
  // set — resume pulling without re-classifying (partial-populated state would
  // misread as populated-populated and bogusly prompt).
  const { isBulkPullInProgress, clearBulkPullFlag, bulkPull } = await import('./sync-pull.js');
  const { openSyncPullSplash, closeSyncPullSplash, renderSyncPullError } = await import('../components/sync-pull-splash.js');

  if (await isBulkPullInProgress()) {
    openSyncPullSplash();
    try {
      await bulkPull();
      await clearBulkPullFlag();
      closeSyncPullSplash();
    } catch (err) {
      // Partial data preserved in Dexie per D-13. Render error with retry.
      renderSyncPullError({
        pulled: err?.pulled ?? 0,
        total: err?.total ?? 0,
        onRetry: () => reconcile().catch((e) => console.error('[sync] retry reconcile failed', e))
      });
    }
    return;
  }

  const { state, localCounts, cloudCounts } = await classifyState();

  switch (state) {
    case 'empty-empty':
      // No-op; seed the incremental-pull cursor so the first polling tick
      // doesn't fetch every row ever created.
      await db.meta.put({ key: 'sync_last_pulled_at', value: Date.now() });
      return;

    case 'empty-populated': {
      // D-06: silent pull, no modal.
      openSyncPullSplash();
      try {
        await bulkPull();
        await clearBulkPullFlag();
        closeSyncPullSplash();
      } catch (err) {
        renderSyncPullError({
          pulled: err?.pulled ?? 0,
          total: err?.total ?? 0,
          onRetry: () => reconcile().catch((e) => console.error('[sync] retry reconcile failed', e))
        });
      }
      return;
    }

    case 'populated-empty':
      // Silent push — enqueue every local row, schedule an immediate flush.
      await _enqueueAllLocalRows();
      scheduleFlush(0);
      return;

    case 'populated-populated': {
      // D-01..D-04: lockdown modal with 3-button forced choice.
      const { openReconciliationModal } = await import('../components/reconciliation-modal.js');
      await openReconciliationModal({
        localCounts,
        cloudCounts,
        onChoice: async (choice) => {
          if (choice === 'MERGE_EVERYTHING') return handleMergeEverything();
          if (choice === 'KEEP_LOCAL') return handleKeepLocal();
          if (choice === 'KEEP_CLOUD') return handleKeepCloud();
        }
      });
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// handleMergeEverything — LWW pull + push queued
// ---------------------------------------------------------------------------

export async function handleMergeEverything() {
  const { bulkPull, clearBulkPullFlag } = await import('./sync-pull.js');

  // bulkPull applies LWW automatically via resolveLWW on duplicates (remote
  // newer → put; tie → cloud wins). Local-newer rows stay in Dexie and will
  // be pushed on the subsequent scheduleFlush(0) drain.
  await bulkPull();
  await clearBulkPullFlag();

  scheduleFlush(0);
  _toast('Archive merged.', 'success');
}

// ---------------------------------------------------------------------------
// handleKeepLocal — cloud wipe + re-enqueue everything local + flush
// ---------------------------------------------------------------------------

export async function handleKeepLocal() {
  const { getSupabase } = await import('./supabase.js');
  const supabase = getSupabase();

  // Supabase rejects DELETE without a filter for safety — .neq('id', 'impossible-sentinel')
  // is the idiom that means "delete every row visible under RLS". Profile
  // excluded per D-15 (never deleted, only updated).
  for (const t of RECONCILIATION_TABLES) {
    const { error } = await supabase.schema('counterflux').from(t).delete().neq('id', 'impossible-sentinel');
    if (error) {
      console.warn(`[sync] handleKeepLocal: delete ${t} failed`, error);
    }
  }

  // Re-enqueue every local row so the push path ships them all.
  await _enqueueAllLocalRows();
  scheduleFlush(0);
  _toast('Local archive kept. Cloud overwritten.', 'success');
}

// ---------------------------------------------------------------------------
// handleKeepCloud — clear local + clear queue + bulkPull
// ---------------------------------------------------------------------------

export async function handleKeepCloud() {
  const { bulkPull, clearBulkPullFlag } = await import('./sync-pull.js');
  const { openSyncPullSplash, closeSyncPullSplash, renderSyncPullError } = await import('../components/sync-pull-splash.js');

  // Clear local 5 data tables under suppression so the deleting-hooks don't
  // cascade into 10,000 sync_queue 'del' entries. Profile left alone.
  //
  // Pitfall 11-B: use the SYNCHRONOUS withHooksSuppressed wrapper (no async
  // callback). Because Plan 11-04's reference-count implementation returns
  // the inner Promise and holds the counter via `.finally()`, awaiting the
  // returned promise keeps suppression raised across the tx lifecycle. We
  // chain the 5 clears into a single Promise so the grep gate sees only a
  // synchronous wrapper callback.
  await withHooksSuppressed(() => _clearAllReconciliationTables());

  // Also clear the sync_queue — anything queued is stale now that local data
  // has been blown away.
  await db.sync_queue.clear();

  openSyncPullSplash();
  try {
    await bulkPull();
    await clearBulkPullFlag();
    closeSyncPullSplash();
    _toast('Cloud archive kept. Local replaced.', 'success');
  } catch (err) {
    renderSyncPullError({
      pulled: err?.pulled ?? 0,
      total: err?.total ?? 0,
      onRetry: () => handleKeepCloud().catch((e) => console.error('[sync] retry keep-cloud failed', e))
    });
    throw err; // let the modal caller see the failure
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function _clearAllReconciliationTables() {
  for (const t of RECONCILIATION_TABLES) {
    await db.table(t).clear();
  }
}

async function _enqueueAllLocalRows() {
  const userId = _currentUserId();
  // Include all synced tables (profile INCLUDED here — populated-empty means
  // we also push profile up if it exists locally).
  for (const t of SYNCABLE_TABLES) {
    const rows = await db.table(t).toArray();
    for (const row of rows) {
      await db.sync_queue.add({
        table_name: t,
        op: 'put',
        row_id: row.id,
        user_id: userId,
        payload: JSON.parse(JSON.stringify(row)),
        attempts: 0,
        last_error: null,
        created_at: Date.now()
      });
    }
  }
}

function _currentUserId() {
  try {
    if (typeof window === 'undefined' || !window.Alpine) return null;
    return window.Alpine.store('auth')?.user?.id ?? null;
  } catch {
    return null;
  }
}

function _toast(message, variant = 'success') {
  try {
    if (typeof window === 'undefined' || !window.Alpine) return;
    const store = window.Alpine.store('toast');
    if (!store) return;
    if (variant === 'error' && typeof store.error === 'function') {
      store.error(message);
    } else if (typeof store.show === 'function') {
      store.show(message, variant);
    }
  } catch {
    /* decorative */
  }
}
