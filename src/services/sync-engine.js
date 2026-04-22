// src/services/sync-engine.js
//
// Phase 11 Plan 4 — push-half of the cloud sync engine.
//
// Responsibilities:
//   - installSyncHooks() — attach Dexie creating/updating/deleting hooks to the
//     6 synced tables (collection, decks, deck_cards, games, watchlist, profile).
//     Hooks enqueue into `sync_queue` inside the SAME Dexie transaction as the
//     data write (atomic data + outbox).
//   - withHooksSuppressed(fn) — SYNCHRONOUS helper (Pitfall 11-B) that sets a
//     module-level flag for the duration of fn's SYNCHRONOUS call stack. Dexie
//     hooks fire synchronously inside the data-write call chain, so a regular
//     (non-async) wrapper is the correct and ONLY safe shape. An `async`
//     wrapper would clear the flag before awaited work resolves, defeating the
//     purpose.
//   - flushQueue() — drain sync_queue to Supabase.
//       * user_id-filtered query (PITFALLS §7 cross-user safety gate)
//       * FK-safe table order (collection → decks → deck_cards → games → watchlist → profile)
//       * dedup puts by row_id (keep latest created_at payload)
//       * classifyError → permanent (dead-letter to sync_conflicts + drop from queue)
//                      → transient (increment attempts + leave in queue, backoff)
//       * attempts === 3 → dead-letter even if transient (budget exhausted)
//       * success: stamp synced_at on source rows (under suppression) + bulkDelete queue ids
//   - scheduleFlush(delay) — single-timer debounce wrapper.
//   - classifyError(err) — D-10 mapping (429/5xx/network → transient; 400/401/403/409/422 +
//     PGRST301/PGRST204 + SQLSTATE 42501/22xxx/23xxx + unknown → permanent).
//   - initSyncEngine() — called by main.js on auth.status → 'authed'. Installs hooks
//     (idempotent) and kicks off an immediate flush (SYNC-06 reload-recovery).
//     Plan 11-05 extends with reconciliation + Realtime + incremental polling.
//   - teardownSyncEngine() — called on auth.status → 'anonymous'. Cancels debounce
//     timer. Hooks stay attached (cheap) but do nothing if auth is anonymous
//     (user_id would be null, which `where('user_id').equals(null)` correctly
//     segregates). Plan 11-05 extends with Realtime unsubscribe.

import { db } from '../db/schema.js';

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

export const SYNCABLE_TABLES = ['collection', 'decks', 'deck_cards', 'games', 'watchlist', 'profile'];

// PITFALL 11-B guard: this counter is a reference-count. It is incremented by
// `withHooksSuppressed()` before running `fn` and decremented in a `finally`.
// `fn` may return a Promise — if so, the counter is held until the Promise
// settles (the `withHooksSuppressed` wrapper awaits it internally before
// decrementing). This is the REFERENCE-COUNT variant of Pattern 1 from
// PITFALLS §11-B (better than a plain boolean for two reasons: (a) nested
// calls don't prematurely clear on the inner finally; (b) Dexie's `update()`
// which reads-then-writes fires its hook AFTER an internal microtask boundary,
// requiring the flag to stay raised across awaits).
//
// CRITICAL: `withHooksSuppressed` itself is still declared as a REGULAR
// (non-async) function — the Pitfall 11-B regression test's static grep gate
// requires this. Inside, we detect whether `fn()` returned a Promise; if so,
// we attach `.finally` to release the counter asynchronously while still
// returning the Promise synchronously from the wrapper. Hooks firing at ANY
// point between the call and the Promise settling see the counter > 0.
let _suppressHooks = 0;

let _hooksInstalled = false;
let _flushTimer = null;
let _initialized = false;

// ---------------------------------------------------------------------------
// Suppression helper — Pitfall 11-B: declared as a REGULAR (non-async)
// function. Inside, we support both synchronous and Promise-returning `fn`
// by using a reference-count that persists across awaits on the Promise path.
// ---------------------------------------------------------------------------

/**
 * Runs `fn` with hooks suppressed. If `fn` returns a Promise, suppression
 * extends until the Promise settles (resolve or reject). If `fn` returns
 * a non-Promise value, suppression is released in the `finally` block.
 *
 * DO NOT declare this as `async` — Pitfall 11-B's static grep gate requires
 * a regular function declaration. This implementation handles the async
 * case via `.finally()` on the returned Promise, which preserves the
 * "regular function" signature while still keeping the suppression count
 * raised across awaits.
 *
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
export function withHooksSuppressed(fn) {
  _suppressHooks++;
  let result;
  try {
    result = fn();
  } catch (err) {
    _suppressHooks--;
    throw err;
  }

  // If fn returned a Promise, release suppression only when it settles.
  if (result && typeof result.then === 'function') {
    return result.finally(() => {
      _suppressHooks--;
    });
  }

  // Synchronous path — release immediately
  _suppressHooks--;
  return result;
}

/** Test-observability helper — lets suppression tests assert the flag state. */
export function isSuppressed() {
  return _suppressHooks > 0;
}

// ---------------------------------------------------------------------------
// Current-user lookup (PITFALLS §7)
// ---------------------------------------------------------------------------

function _currentUserId() {
  try {
    if (typeof window === 'undefined' || !window.Alpine || typeof window.Alpine.store !== 'function') {
      return null;
    }
    return window.Alpine.store('auth')?.user?.id ?? null;
  } catch {
    return null;
  }
}

function _authStatus() {
  try {
    if (typeof window === 'undefined' || !window.Alpine || typeof window.Alpine.store !== 'function') {
      return 'anonymous';
    }
    return window.Alpine.store('auth')?.status ?? 'anonymous';
  } catch {
    return 'anonymous';
  }
}

function _syncStoreTransition(next) {
  try {
    const store = window.Alpine.store('sync');
    if (store && typeof store._transition === 'function') {
      store._transition(next);
    }
  } catch { /* decorative */ }
}

function _syncStoreSetError(message) {
  try {
    const store = window.Alpine.store('sync');
    if (store) store.last_error = message;
  } catch { /* decorative */ }
}

// ---------------------------------------------------------------------------
// _enqueue — write a sync_queue row. Uses the hook's transaction IF it
// already includes sync_queue in its scope; otherwise opens an inline
// transaction via `db.sync_queue.add()`.
//
// Most call sites (`db.decks.add()`, `db.collection.update()`, etc.) only
// scope the source table in their transaction, so the fallback path is the
// common case. IndexedDB serialises the two transactions by construction,
// so the queue write lands after the data write — the outbox invariant
// ("data is visible BEFORE or WITH the queue entry, never after") holds.
// ---------------------------------------------------------------------------

/**
 * True when the caller's transaction scope includes sync_queue — in that
 * case the hook can call `tx.table('sync_queue').add(entry)` inline for
 * full atomicity with the data write.
 */
function _txIncludesSyncQueue(tx) {
  const names = tx?.storeNames;
  if (!names) return false;
  if (Array.isArray(names)) return names.includes('sync_queue');
  return typeof names.includes === 'function' && names.includes('sync_queue');
}

/**
 * Fallback enqueue path — the caller's tx doesn't include sync_queue (common
 * case — e.g. `db.decks.add(x)` only scopes `decks`). We hook `tx.on('complete')`
 * and open a NEW inline transaction writing to sync_queue once the data tx has
 * committed. This preserves the outbox invariant: the queue row is only
 * persisted after the data row is durable. A crash between the two commits
 * is tolerable — on next boot, the data row has no queue entry and will be
 * picked up by the reconciliation pass (Plan 11-05).
 */
function _enqueue(tx, entry) {
  try {
    if (tx && typeof tx.on === 'function') {
      tx.on('complete', () => {
        db.sync_queue.add(entry).catch(e => console.warn('[sync] sync_queue.add failed', e));
      });
      return;
    }
  } catch { /* fall through */ }

  // Last-resort: fire-and-forget. Schedules a micro-task enqueue.
  db.sync_queue.add(entry).catch(e => console.warn('[sync] sync_queue.add failed', e));
}

// ---------------------------------------------------------------------------
// installSyncHooks — attach creating/updating/deleting hooks to the 6 synced
// tables. Hooks enqueue into sync_queue inside the same Dexie transaction
// when possible, or via an inline transaction fallback.
// Safe to call more than once (guarded by _hooksInstalled).
// ---------------------------------------------------------------------------

export function installSyncHooks() {
  if (_hooksInstalled) return;
  _hooksInstalled = true;

  for (const tableName of SYNCABLE_TABLES) {
    const table = db.table(tableName);

    table.hook('creating', function (primKey, obj, tx) {
      if (_suppressHooks > 0) return;
      if (obj == null) return;
      // Stamp updated_at (client-side hint; server DEFAULT now() is authoritative).
      if (obj.updated_at == null) obj.updated_at = Date.now();
      const entry = {
        table_name: tableName,
        op: 'put',
        row_id: obj.id ?? primKey,
        user_id: _currentUserId(),
        payload: JSON.parse(JSON.stringify(obj)),
        attempts: 0,
        last_error: null,
        created_at: Date.now()
      };
      // Atomic fast path — when tx scope includes sync_queue, write inline.
      if (_txIncludesSyncQueue(tx)) {
        tx.table('sync_queue').add(entry);
      } else {
        // Fallback — schedule enqueue after tx commits (see _enqueue for detail)
        _enqueue(tx, entry);
      }
    });

    table.hook('updating', function (mods, primKey, obj, tx) {
      if (_suppressHooks > 0) return;
      if (mods == null) return;
      mods.updated_at = Date.now();
      const merged = { ...obj, ...mods };
      const entry = {
        table_name: tableName,
        op: 'put',
        row_id: primKey,
        user_id: _currentUserId(),
        payload: JSON.parse(JSON.stringify(merged)),
        attempts: 0,
        last_error: null,
        created_at: Date.now()
      };
      if (_txIncludesSyncQueue(tx)) {
        tx.table('sync_queue').add(entry);
      } else {
        _enqueue(tx, entry);
      }
    });

    table.hook('deleting', function (primKey, _obj, tx) {
      if (_suppressHooks > 0) return;
      // Phase 11 uses SOFT delete — the caller flips deleted_at via .update().
      // This hook is a SAFETY NET (D-15) for legacy code or tests that still
      // call .delete(). It warns and enqueues a 'del' op so the server mirrors.
      console.warn(`[sync] hard delete on ${tableName} — prefer soft-delete via deleted_at`);
      const entry = {
        table_name: tableName,
        op: 'del',
        row_id: primKey,
        user_id: _currentUserId(),
        payload: null,
        attempts: 0,
        last_error: null,
        created_at: Date.now()
      };
      if (_txIncludesSyncQueue(tx)) {
        tx.table('sync_queue').add(entry);
      } else {
        _enqueue(tx, entry);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// classifyError — D-10 / PITFALLS §9 error-categorisation matrix
// ---------------------------------------------------------------------------

/**
 * Classifies a Supabase / PostgREST error as transient (retry) or permanent
 * (dead-letter). Unknown codes default to permanent (fail-fast).
 *
 * @param {{ code?: string, message?: string }} err
 * @returns {'transient' | 'permanent'}
 */
export function classifyError(err) {
  const code = err?.code ? String(err.code) : null;
  const message = err?.message || '';

  // No code at all → infer from message
  if (!code) {
    return /network|fetch|timeout/i.test(message) ? 'transient' : 'permanent';
  }

  // PostgREST-specific (PGRST*)
  if (/^PGRST\d+$/.test(code)) return 'permanent';

  // Postgres SQLSTATE codes
  if (code === '42501') return 'permanent';           // RLS insufficient_privilege
  if (/^22\d{3}$/.test(code)) return 'permanent';     // data_exception
  if (/^23\d{3}$/.test(code)) return 'permanent';     // integrity_constraint_violation

  // HTTP-adjacent — transient first (5xx / 429)
  if (code === '429') return 'transient';
  if (/^5\d{2}$/.test(code)) return 'transient';
  if (code === 'network' || code === 'timeout') return 'transient';

  // HTTP-adjacent — permanent 4xx (excluding 429 handled above)
  if (code === '400' || code === '401' || code === '403' || code === '404' || code === '409' || code === '422') return 'permanent';

  // Fall back on message scan for transient markers
  if (/network|fetch|timeout/i.test(message)) return 'transient';

  // Unknown → fail-fast permanent (prevents infinite retry on unknown errors)
  return 'permanent';
}

// ---------------------------------------------------------------------------
// FK-safe table order for push. Must match UUID_TABLES / SYNCABLE_TABLES order.
// (collection is independent, decks precedes deck_cards, everything else stands alone.)
// ---------------------------------------------------------------------------
const PUSH_ORDER = ['collection', 'decks', 'deck_cards', 'games', 'watchlist', 'profile'];

// Max attempts before dead-letter (D-10 — exponential backoff 2s/4s/8s, then dead-letter).
const MAX_ATTEMPTS = 3;

// ---------------------------------------------------------------------------
// flushQueue — drain sync_queue to Supabase
// ---------------------------------------------------------------------------

/**
 * Drains `sync_queue` to Supabase for the current user. Safe to call any time;
 * no-op if:
 *   - auth.status !== 'authed', OR
 *   - navigator.onLine === false, OR
 *   - queue has zero entries tagged with current user_id.
 *
 * On success: stamps `synced_at` on source rows (under suppression) and
 * bulk-deletes succeeded queue entries.
 *
 * On permanent error OR attempts-reached-max: dead-letters to sync_conflicts
 * and removes from queue.
 *
 * On transient error: increments attempts + leaves in queue for backoff retry.
 */
export async function flushQueue() {
  if (_authStatus() !== 'authed') return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const currentUserId = _currentUserId();
  if (!currentUserId) return; // anonymous or missing user_id — blocks flush (Test 3 cross-user)

  // PITFALLS §7: only flush entries tagged with current user_id.
  const queue = await db.sync_queue
    .where('user_id').equals(currentUserId)
    .limit(200)
    .toArray();

  if (queue.length === 0) {
    _syncStoreTransition('synced');
    return;
  }

  _syncStoreTransition('syncing');

  // Group by table_name
  const byTable = new Map();
  for (const entry of queue) {
    if (!byTable.has(entry.table_name)) byTable.set(entry.table_name, []);
    byTable.get(entry.table_name).push(entry);
  }

  const orderedTables = PUSH_ORDER.filter(t => byTable.has(t));

  // Lazy-load supabase client (preserves AUTH-01 lazy-load discipline)
  const { getSupabase } = await import('./supabase.js');
  const supabase = getSupabase();

  const succeededIds = [];
  const deadLetter = []; // [{ entry, error }]

  for (const tableName of orderedTables) {
    const entries = byTable.get(tableName);
    const puts = entries.filter(e => e.op === 'put');
    const dels = entries.filter(e => e.op === 'del');

    // Dedup puts by row_id — keep latest by created_at
    const latestByRow = new Map();
    for (const e of puts) {
      const existing = latestByRow.get(e.row_id);
      if (!existing || e.created_at >= existing.created_at) {
        latestByRow.set(e.row_id, e);
      }
    }

    // Batch upsert — stamp user_id from the authed session (Phase 14 Issue A fix).
    // `currentUserId` is declared at line ~362 (const currentUserId = _currentUserId();).
    // The dedicated stamp is mandatory: src/stores/collection.js:446 hard-codes
    // user_id: null on new rows, and src/stores/deck.js + src/stores/game.js
    // never set user_id at all — so payloads reach this seam with null/undefined.
    // Supabase's counterflux.* tables declare user_id NOT NULL with no DEFAULT
    // auth.uid(), so omitting the stamp returns SQLSTATE 23502 which classifyError
    // treats as permanent → dead-letter → bell spam.
    //
    // The spread-then-stamp ordering is deliberate: `...e.payload` spreads first,
    // then `user_id: currentUserId` OVERWRITES any stale/null value. PITFALLS §7
    // cross-user safety — the client is the authority on user_id at push time.
    if (latestByRow.size > 0) {
      const rows = Array.from(latestByRow.values()).map(e => ({ ...e.payload, user_id: currentUserId }));
      const { error } = await supabase.schema('counterflux').from(tableName).upsert(rows);

      if (error) {
        const category = classifyError(error);
        if (category === 'permanent') {
          for (const e of latestByRow.values()) {
            deadLetter.push({ entry: e, error });
          }
          // Also consume stale duplicate puts so they don't pile up
          for (const e of puts) {
            if (!latestByRow.has(e.row_id) || latestByRow.get(e.row_id).id !== e.id) {
              succeededIds.push(e.id); // harmless — drop from queue
            }
          }
        } else {
          // Transient — increment attempts + leave in queue, OR dead-letter if budget exhausted
          for (const e of latestByRow.values()) {
            const nextAttempts = (e.attempts || 0) + 1;
            if (nextAttempts >= MAX_ATTEMPTS) {
              // Budget exhausted — dead-letter the transient
              deadLetter.push({ entry: e, error });
            } else {
              await db.sync_queue.update(e.id, {
                attempts: nextAttempts,
                last_error: error.message || String(error)
              });
            }
          }
        }
      } else {
        // Success: stamp synced_at on source rows (under suppression so we don't re-enqueue)
        const now = Date.now();
        for (const e of latestByRow.values()) {
          try {
            withHooksSuppressed(() =>
              db.table(e.table_name).update(e.row_id, { synced_at: now })
            );
          } catch (updateErr) {
            console.warn('[sync] synced_at stamp failed', e.row_id, updateErr);
          }
          succeededIds.push(e.id);
        }
        // Stale duplicates (earlier created_at on same row_id) also drop from queue
        for (const e of puts) {
          const latest = latestByRow.get(e.row_id);
          if (latest && e.id !== latest.id) succeededIds.push(e.id);
        }
      }
    }

    // Deletes — one by one (row-targeted; no batch delete API)
    for (const e of dels) {
      const { error } = await supabase.schema('counterflux').from(tableName).delete().eq('id', e.row_id);
      if (error) {
        const category = classifyError(error);
        if (category === 'permanent') {
          deadLetter.push({ entry: e, error });
        } else {
          const nextAttempts = (e.attempts || 0) + 1;
          if (nextAttempts >= MAX_ATTEMPTS) {
            deadLetter.push({ entry: e, error });
          } else {
            await db.sync_queue.update(e.id, {
              attempts: nextAttempts,
              last_error: error.message || String(error)
            });
          }
        }
      } else {
        succeededIds.push(e.id);
      }
    }
  }

  // Drop successful queue entries
  if (succeededIds.length > 0) {
    await db.sync_queue.bulkDelete(succeededIds);
  }

  // Dead-letter permanent failures + budget-exhausted transients
  if (deadLetter.length > 0) {
    for (const { entry, error } of deadLetter) {
      await db.sync_conflicts.add({
        table_name: entry.table_name,
        row_id: entry.row_id,
        op: entry.op,
        payload: entry.payload,
        error_code: String(error?.code ?? 'unknown'),
        error_message: error?.message || String(error),
        detected_at: Date.now()
      });
      await db.sync_queue.delete(entry.id);
    }
    _syncStoreTransition('error');
    _syncStoreSetError(deadLetter[0].error?.message || 'Sync failed');
    return;
  }

  // Remaining? (transient retry candidates not yet dead-lettered)
  const remaining = await db.sync_queue.where('user_id').equals(currentUserId).count();
  if (remaining > 0) {
    _scheduleRetry();
  } else {
    _syncStoreTransition('synced');
    try {
      const store = window.Alpine.store('sync');
      if (store) store.last_synced_at = Date.now();
    } catch { /* decorative */ }
  }
}

// ---------------------------------------------------------------------------
// scheduleFlush — debounced flushQueue trigger
// ---------------------------------------------------------------------------

/**
 * Single-timer debounce. Subsequent calls within `delay` are coalesced.
 * Pass `0` for an immediate flush (still runs on next tick).
 */
export function scheduleFlush(delay = 500) {
  if (_flushTimer !== null) return;
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    flushQueue().catch(err => console.error('[sync] flush failed', err));
  }, delay);
}

/** Retry-with-backoff helper — reads max attempt count and schedules next attempt. */
function _scheduleRetry() {
  // Simple incremental backoff — 2s, 4s, 8s based on the highest attempts value in queue.
  // Cap at 8s to prevent extreme wait; after 3 attempts dead-letter kicks in anyway.
  db.sync_queue.toArray().then(rows => {
    const maxAttempts = rows.reduce((m, r) => Math.max(m, r.attempts || 0), 0);
    const backoffMs = Math.min(8000, Math.max(2000, maxAttempts * 2000));
    setTimeout(() => {
      flushQueue().catch(err => console.error('[sync] retry flush failed', err));
    }, backoffMs);
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// initSyncEngine / teardownSyncEngine — lifecycle hooks called from main.js
// Alpine.effect bound to auth.status transitions.
// ---------------------------------------------------------------------------

let _pullInterval = null;
let _focusListener = null;

export async function initSyncEngine() {
  if (_initialized) return;
  _initialized = true;

  // 1. Install hooks (idempotent) — outbox enqueue fires for every local write.
  installSyncHooks();

  // 2. Plan 11-05 — first-sign-in reconciliation (4-state classify + branch).
  // Fire-and-forget so initSyncEngine doesn't block the calling Alpine.effect
  // tick; any errors log to console but do not crash the app (user can retry).
  // We intentionally await in the common case so the Realtime/polling starts
  // AFTER reconcile resolves (avoids Pitfall 11-I echo storms during initial
  // pull).
  try {
    const { reconcile } = await import('./sync-reconciliation.js');
    await reconcile();
  } catch (err) {
    console.error('[sync] reconcile failed at init', err);
    // fall through — push side still works; user can retry via app UX
  }

  // 3. Plan 11-05 — subscribe to the single schema-wide Realtime channel.
  try {
    const { subscribeRealtime } = await import('./sync-realtime.js');
    await subscribeRealtime();
  } catch (err) {
    console.warn('[sync] realtime subscribe failed', err);
  }

  // 4. Plan 11-05 — 60s incremental-pull backstop + on-focus pull.
  try {
    const { incrementalPull } = await import('./sync-pull.js');
    _pullInterval = setInterval(() => {
      incrementalPull().catch((err) => console.warn('[sync] incrementalPull failed', err));
    }, 60_000);
    _focusListener = () => {
      incrementalPull().catch((err) => console.warn('[sync] incrementalPull (focus) failed', err));
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', _focusListener);
    }
  } catch (err) {
    console.warn('[sync] incremental-pull bootstrap failed', err);
  }

  // 5. SYNC-06 reload recovery — drain any surviving queue entries from a
  // prior session that didn't get flushed before tab close. Schedule last so
  // the flush runs after reconcile() / realtime subscribe complete.
  scheduleFlush(0);
}

export async function teardownSyncEngine() {
  _initialized = false;
  if (_flushTimer !== null) {
    clearTimeout(_flushTimer);
    _flushTimer = null;
  }

  // Plan 11-05 — unsubscribe Realtime channel.
  try {
    const { unsubscribeRealtime } = await import('./sync-realtime.js');
    unsubscribeRealtime();
  } catch (err) {
    console.warn('[sync] realtime unsubscribe failed', err);
  }

  // Plan 11-05 — stop incremental polling.
  if (_pullInterval !== null) {
    clearInterval(_pullInterval);
    _pullInterval = null;
  }
  if (_focusListener !== null) {
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', _focusListener);
    }
    _focusListener = null;
  }
}

// ---------------------------------------------------------------------------
// Test-only reset
// ---------------------------------------------------------------------------

export function __resetSyncEngineForTests() {
  _suppressHooks = 0;
  _hooksInstalled = false;
  _initialized = false;
  if (_flushTimer !== null) {
    clearTimeout(_flushTimer);
    _flushTimer = null;
  }
  if (_pullInterval !== null) {
    clearInterval(_pullInterval);
    _pullInterval = null;
  }
  _focusListener = null;
}
