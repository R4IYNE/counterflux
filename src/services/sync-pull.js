// src/services/sync-pull.js
//
// Phase 11 Plan 5 — pull engine: bulk pull (first-sign-in populated-cloud path),
// incremental polling backstop, row-level LWW resolvers with deck_cards atomic-merge
// edge case.
//
// Exports:
//   - bulkPull(onProgress?)     — chunked pull of all household rows; FK-safe order;
//                                 sets sync_pull_in_progress meta on start; emits
//                                 progress events. Throws BulkPullError on failure
//                                 (caller handles — the flag stays set so the next
//                                 boot's reconcile() resumes per Pitfall 11-E).
//   - incrementalPull()         — 60s polling backstop; uses sync_last_pulled_at
//                                 meta cursor; LWW-merge under withHooksSuppressed.
//   - clearBulkPullFlag()       — drops sync_pull_in_progress meta row (success path).
//   - isBulkPullInProgress()    — boolean from meta read.
//   - resolveLWW(local, remote) — row-level LWW; tie → cloud wins (D-02).
//   - resolveDeckCardConflict(local, remote) — composite-key atomic merge; loser
//                                 logged to sync_conflicts (ARCHITECTURE Anti-Pattern 4).
//   - logLocalDeleteRemoteUpdateConflict(table, local, remote) — unresolvable-case
//                                 logger for the D-02 "local-delete + remote-update"
//                                 scenario.
//   - BulkPullError             — carries `table`, `pulled`, `total`, `cause` so the
//                                 splash error body can render pulled/total context.
//   - CHUNK_SIZE                — 500 (PostgREST-safe; CONTEXT D-12 rationale).
//
// Pitfall 11-B discipline: every `withHooksSuppressed(() => ...)` call is the
// REGULAR (non-async) wrapper from sync-engine.js. The reference-count
// suppression (established by Plan 11-04) holds across Dexie's internal
// read-modify-write microtask — critical for `.put()`/`.update()` inside
// the per-row incrementalPull merge path.

import { db } from '../db/schema.js';
import { withHooksSuppressed } from './sync-engine.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// CHUNK_SIZE tunable — 500 is CONTEXT D-12's recommendation. Stays well below
// PostgREST's default 1000 cap; payload ~100KB; RLS evaluation <10ms/chunk.
export const CHUNK_SIZE = 500;

// FK-safe order — decks before deck_cards (FK constraint); collection
// independent; games independent; watchlist independent; profile last (excluded
// from soft-delete per D-15 but still synced).
export const SYNCED_DATA_TABLES = ['decks', 'collection', 'deck_cards', 'games', 'watchlist', 'profile'];

// Meta flag key (Pitfall 11-E).
const BULK_PULL_FLAG_KEY = 'sync_pull_in_progress';
const LAST_PULLED_KEY = 'sync_last_pulled_at';

// ---------------------------------------------------------------------------
// BulkPullError — thrown by bulkPull on a per-table fetch failure. Carries
// partial-pull context so the splash error body can render "N of M" copy.
// ---------------------------------------------------------------------------

export class BulkPullError extends Error {
  constructor(table, pulled, total, cause) {
    super(`bulkPull: ${table} failed after ${pulled}/${total} rows: ${cause?.message || cause}`);
    this.name = 'BulkPullError';
    this.table = table;
    this.pulled = pulled;
    this.total = total;
    this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// LWW resolvers (SYNC-05, CONTEXT D-02 — row-level, tie → cloud)
// ---------------------------------------------------------------------------

function _toTs(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = new Date(v).getTime();
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

/**
 * Row-level LWW resolver. Returns `{ winner: 'local'|'remote', row }`.
 *
 * CONTEXT D-02: tie goes to cloud (household-authoritative default). The only
 * genuine "row-level" behaviour is the WHOLE-ROW choice — no per-column merge.
 * For `deck_cards`, the composite-key edge case is handled by
 * resolveDeckCardConflict() below.
 *
 * Note on REQUIREMENTS discrepancy: REQUIREMENTS.md SYNC-05 text says
 * "field-level LWW". CONTEXT D-02 supersedes per the RESEARCH §Phase
 * Requirements footnote. This plan's SUMMARY documents the resolution.
 *
 * @param {object} local  row as stored in Dexie (updated_at: number)
 * @param {object} remote row as received from Supabase (updated_at: ISO string)
 * @returns {{ winner: 'local'|'remote', row: object }}
 */
export function resolveLWW(local, remote) {
  const lu = _toTs(local?.updated_at);
  const ru = _toTs(remote?.updated_at);
  if (ru > lu) return { winner: 'remote', row: remote };
  if (lu > ru) return { winner: 'local', row: local };
  return { winner: 'remote', row: remote }; // tie → cloud wins (D-02)
}

/**
 * deck_cards atomic-merge resolver (ARCHITECTURE Anti-Pattern 4).
 *
 * When local and remote share the composite (deck_id, scryfall_id) but carry
 * different UUIDs, LWW picks the wholesale row — the loser is logged to
 * sync_conflicts with reason `deck_cards_atomic_merge` so the user can inspect
 * what was discarded.
 *
 * If ids match, this is not a composite conflict — delegate to resolveLWW()
 * with no conflict entry.
 *
 * @param {object} local
 * @param {object} remote
 * @returns {Promise<{ winner: 'local'|'remote', row: object }>}
 */
export async function resolveDeckCardConflict(local, remote) {
  if (local?.id === remote?.id) return resolveLWW(local, remote);

  const { winner, row } = resolveLWW(local, remote);
  const loser = winner === 'remote' ? local : remote;

  await db.sync_conflicts.add({
    table_name: 'deck_cards',
    row_id: loser.id,
    op: 'atomic_merge',
    payload: loser,
    error_code: 'deck_cards_atomic_merge',
    error_message: `Loser of (${loser.deck_id}, ${loser.scryfall_id}) atomic merge; winner id=${row.id}`,
    detected_at: Date.now()
  });

  return { winner, row };
}

/**
 * Logs an "unresolvable" local-delete + remote-update conflict to sync_conflicts.
 * LWW can't meaningfully pick a winner when one side expressed delete-intent
 * and the other carries an update — the user needs to review.
 *
 * @param {string} tableName
 * @param {object} local   Dexie row with deleted_at set
 * @param {object} remote  Supabase row (non-deleted) with newer updated_at
 */
export async function logLocalDeleteRemoteUpdateConflict(tableName, local, remote) {
  await db.sync_conflicts.add({
    table_name: tableName,
    row_id: local?.id ?? remote?.id,
    op: 'conflict',
    payload: { local, remote },
    error_code: 'local_delete_remote_update',
    error_message: `Row ${local?.id} was locally deleted (deleted_at=${local?.deleted_at}) but remotely updated (updated_at=${remote?.updated_at}) — user review required.`,
    detected_at: Date.now()
  });
}

// ---------------------------------------------------------------------------
// sync_pull_in_progress flag (Pitfall 11-E)
// ---------------------------------------------------------------------------

async function setBulkPullFlag() {
  await db.meta.put({ key: BULK_PULL_FLAG_KEY, value: true });
}

export async function clearBulkPullFlag() {
  await db.meta.delete(BULK_PULL_FLAG_KEY);
}

export async function isBulkPullInProgress() {
  const row = await db.meta.get(BULK_PULL_FLAG_KEY);
  return row?.value === true;
}

// ---------------------------------------------------------------------------
// bulkPull — chunked pull across all 6 synced tables; emits progress
// ---------------------------------------------------------------------------

function _defaultOnProgress(ev) {
  try {
    if (typeof window !== 'undefined' && window.Alpine?.store) {
      const store = window.Alpine.store('sync');
      if (store) {
        // Reuse the shared bulkPullProgress field; splash component polls this.
        store.bulkPullProgress = ev;
      }
    }
  } catch {
    /* decorative */
  }
}

/**
 * Full household pull — called on first-sign-in empty-local + populated-cloud,
 * and by KEEP_CLOUD / MERGE_EVERYTHING reconciliation handlers.
 *
 * Sets the `sync_pull_in_progress` meta flag at start; caller MUST invoke
 * `clearBulkPullFlag()` on successful completion. If this function throws,
 * the flag stays set so next-boot reconcile() resumes (Pitfall 11-E).
 *
 * @param {(ev: {phase: 'counting'|'pulling'|'complete', ...}) => void} [onProgress]
 */
export async function bulkPull(onProgress) {
  const emit = typeof onProgress === 'function' ? onProgress : _defaultOnProgress;

  await setBulkPullFlag();

  const { getSupabase } = await import('./supabase.js');
  const supabase = getSupabase();

  // Phase 1 — count every table (so the splash shows meaningful totals).
  const counts = {};
  for (const t of SYNCED_DATA_TABLES) {
    const { count } = await supabase.schema('counterflux').from(t).select('*', { count: 'exact', head: true });
    counts[t] = count ?? 0;
  }
  emit({ phase: 'counting', counts });

  // Phase 2 — pull each table in FK-safe order, chunked.
  for (const t of SYNCED_DATA_TABLES) {
    const total = counts[t];
    let pulled = 0;
    let from = 0;

    while (pulled < total) {
      const chain = supabase.schema('counterflux').from(t).select('*');
      // Chain supports .order().range() per supabase-js. Our tests' mock returns
      // a self-chaining object; the live client does the same.
      const ordered = typeof chain.order === 'function' ? chain.order('updated_at', { ascending: true }) : chain;
      const { data, error } = await ordered.range(from, from + CHUNK_SIZE - 1);

      if (error) {
        throw new BulkPullError(t, pulled, total, error);
      }

      // Convert ISO updated_at → epoch ms; stamp synced_at so hooks recognise
      // this as "already pushed" data.
      const converted = (data ?? []).map((r) => ({
        ...r,
        updated_at: _toTs(r.updated_at) || Date.now(),
        synced_at: Date.now()
      }));

      // Pitfall 11-B / Pitfall 11-A: use SYNCHRONOUS withHooksSuppressed wrapper.
      // bulkPut returns a Promise — the reference-count suppression holds the
      // flag across its internal hook invocations until the returned Promise
      // settles. We capture & await the returned Promise to block this loop
      // on the actual write so the next chunk doesn't race the Dexie tx.
      if (converted.length > 0) {
        await withHooksSuppressed(() => db.table(t).bulkPut(converted));
      }

      pulled += data?.length ?? 0;
      from += CHUNK_SIZE;
      emit({ phase: 'pulling', table: t, pulled, total });

      if (!data || data.length < CHUNK_SIZE) break; // last page
    }
  }

  // Cursor for incrementalPull.
  await db.meta.put({ key: LAST_PULLED_KEY, value: Date.now() });
  emit({ phase: 'complete' });
  // Caller clears the flag on success (reconcile() dispatches clearBulkPullFlag()).
}

// ---------------------------------------------------------------------------
// incrementalPull — 60s polling backstop + on-focus
// ---------------------------------------------------------------------------

/**
 * Fetches rows with `updated_at > sync_last_pulled_at` from each synced table
 * and applies LWW merge locally under suppression.
 */
export async function incrementalPull() {
  // Guards — match RESEARCH §Pattern 3
  const authStore = typeof window !== 'undefined' ? window.Alpine?.store?.('auth') : null;
  if (authStore?.status !== 'authed') return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (await isBulkPullInProgress()) return; // don't race the bulkPull

  const { getSupabase } = await import('./supabase.js');
  const supabase = getSupabase();

  const cursor = await db.meta.get(LAST_PULLED_KEY);
  const since = cursor?.value ?? 0;
  const sinceIso = new Date(since).toISOString();

  for (const t of SYNCED_DATA_TABLES) {
    const { data, error } = await supabase.schema('counterflux').from(t).select('*').gt('updated_at', sinceIso);
    if (error) { console.warn(`[sync] incremental pull ${t} failed`, error); continue; }

    withHooksSuppressed(() => _mergeIncomingRows(t, data ?? []));
  }

  await db.meta.put({ key: LAST_PULLED_KEY, value: Date.now() });
}

/**
 * Merges a batch of remote rows for one table under the assumption that the
 * caller already wrapped this with `withHooksSuppressed()`. Per-row: fetch
 * local → if no local row → add; if deck_cards → composite-key resolver;
 * else → resolveLWW → put when remote wins. Local-delete + remote-update
 * surfaces a sync_conflicts entry.
 *
 * Returns a Promise (Dexie writes are async). The reference-count suppression
 * holds across awaits until settlement.
 */
async function _mergeIncomingRows(tableName, remoteRows) {
  for (const r of remoteRows) {
    const incoming = {
      ...r,
      updated_at: _toTs(r.updated_at) || Date.now(),
      synced_at: Date.now()
    };
    const local = await db.table(tableName).get(r.id);
    if (!local) {
      await db.table(tableName).add(incoming);
      continue;
    }

    // Local-delete + remote-update — unresolvable by LWW
    if (local.deleted_at != null && incoming.deleted_at == null) {
      await logLocalDeleteRemoteUpdateConflict(tableName, local, incoming);
      continue;
    }

    let winner;
    if (tableName === 'deck_cards') {
      ({ winner } = await resolveDeckCardConflict(local, incoming));
    } else {
      ({ winner } = resolveLWW(local, incoming));
    }
    if (winner === 'remote') {
      await db.table(tableName).put(incoming);
    }
  }
}
