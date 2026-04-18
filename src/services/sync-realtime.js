// src/services/sync-realtime.js
//
// Phase 11 Plan 5 — Realtime pull side (SYNC-03).
//
// Topology: SINGLE schema-wide postgres_changes channel
// (RESEARCH §Pattern 3 Option B — rejected Option A's 6 per-table channels
// because 2 users × 3 tabs × 6 tables = 36 channels / tab-pair, which would
// blow past the 200-concurrent Realtime quota in the free tier).
//
// Exports:
//   - subscribeRealtime()    — idempotent; creates ONE channel 'counterflux-household'
//                              with filter { event: '*', schema: 'counterflux' } and a
//                              dispatcher that routes INSERT/UPDATE/DELETE events by
//                              payload.table to applyRealtimeChange.
//   - unsubscribeRealtime()  — tears down the channel (lifecycle sign-out hook).
//   - applyRealtimeChange(payload) — exported for unit tests; dispatches by table,
//                              applies under withHooksSuppressed so the outbox hook
//                              never re-enqueues a realtime-applied write (Pitfall 4).
//
// Pitfall 11-B discipline: `withHooksSuppressed(() => ...)` is the REGULAR
// (non-async) wrapper; the reference-count suppression from sync-engine.js
// holds across Dexie's internal microtask boundaries.

import { db } from '../db/schema.js';
import { withHooksSuppressed } from './sync-engine.js';
import { resolveLWW, resolveDeckCardConflict, logLocalDeleteRemoteUpdateConflict } from './sync-pull.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CHANNEL_NAME = 'counterflux-household';
const SYNCED_TABLES = ['collection', 'decks', 'deck_cards', 'games', 'watchlist', 'profile'];

// Module-level channel handle (null until subscribeRealtime() runs).
let _channel = null;

// ---------------------------------------------------------------------------
// subscribeRealtime — idempotent; single channel
// ---------------------------------------------------------------------------

// Promise-guard for the dynamic-import race: between the first `await`
// and the `_channel = ...` assignment, a second concurrent caller could
// sneak through the `if (_channel)` check. We memoise the in-flight subscribe
// promise so concurrent calls all resolve to the same channel creation.
let _subscribeInFlight = null;

export async function subscribeRealtime() {
  if (_channel) return; // already subscribed
  if (_subscribeInFlight) return _subscribeInFlight; // subscribe in progress

  _subscribeInFlight = (async () => {
    const { getSupabase } = await import('./supabase.js');
    const supabase = getSupabase();

    _channel = supabase
      .channel(CHANNEL_NAME)
    .on(
      'postgres_changes',
      { event: '*', schema: 'counterflux' },
      (payload) => {
        // Dispatcher — route by payload.table via applyRealtimeChange.
        // We fire-and-forget the returned Promise; any errors log and continue.
        applyRealtimeChange(payload).catch((err) => {
          console.warn('[sync] realtime apply failed', payload?.table, err);
        });
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn('[sync] realtime channel error', err);
      } else if (status === 'SUBSCRIBED') {
        // Info-level: useful during Plan 11-06 live-e2e debug
        // console.info('[sync] realtime subscribed to', CHANNEL_NAME);
      }
    });
  })();

  try {
    await _subscribeInFlight;
  } finally {
    _subscribeInFlight = null;
  }
}

export function unsubscribeRealtime() {
  if (_channel) {
    try {
      _channel.unsubscribe();
    } catch { /* decorative */ }
    _channel = null;
  }
}

// ---------------------------------------------------------------------------
// applyRealtimeChange — unit-test-exported dispatcher + applier
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
 * Applies a single Realtime payload locally. Non-synced tables are ignored.
 * DELETE paths use `withHooksSuppressed(() => db.table.delete(id))`; INSERT
 * and UPDATE paths normalise updated_at + apply LWW merge under suppression.
 *
 * Pitfall 11-B: the withHooksSuppressed wrapper is the REGULAR (non-async)
 * helper. Its reference-count implementation (Plan 11-04) holds the suppression
 * flag across the Dexie write's internal read-then-write microtask, so the
 * outbox hook never sees flag=false and never re-enqueues the applied row.
 *
 * @param {{ schema: string, table: string, eventType: string, new: object|null, old: object|null }} payload
 */
export async function applyRealtimeChange(payload) {
  const { table, eventType } = payload || {};
  if (!SYNCED_TABLES.includes(table)) return;

  const newRow = payload.new;
  const oldRow = payload.old;

  // DELETE — use oldRow.id (Realtime DELETE payloads carry the primary key
  // in `old`, not `new`). Under suppression so the outbox's deleting-hook
  // safety-net doesn't re-enqueue.
  if (eventType === 'DELETE') {
    if (!oldRow?.id) return;
    await withHooksSuppressed(() => db.table(table).delete(oldRow.id));
    return;
  }

  // INSERT / UPDATE — normalise timestamps then LWW-merge under suppression.
  if (!newRow?.id) return;
  const incoming = {
    ...newRow,
    updated_at: _toTs(newRow.updated_at) || Date.now(),
    synced_at: Date.now()
  };

  // All writes below happen under the SAME withHooksSuppressed call so the
  // reference counter stays raised across the per-row read-then-write dance.
  await withHooksSuppressed(() => _applyIncomingRow(table, incoming));
}

async function _applyIncomingRow(table, incoming) {
  const local = await db.table(table).get(incoming.id);
  if (!local) {
    await db.table(table).add(incoming);
    return;
  }

  // Local-delete + remote-update — unresolvable by LWW.
  if (local.deleted_at != null && incoming.deleted_at == null) {
    await logLocalDeleteRemoteUpdateConflict(table, local, incoming);
    return;
  }

  let winner;
  if (table === 'deck_cards') {
    ({ winner } = await resolveDeckCardConflict(local, incoming));
  } else {
    ({ winner } = resolveLWW(local, incoming));
  }
  if (winner === 'remote') {
    await db.table(table).put(incoming);
  }
}

// ---------------------------------------------------------------------------
// Test-only reset
// ---------------------------------------------------------------------------
export function __resetRealtimeForTests() {
  if (_channel) {
    try { _channel.unsubscribe(); } catch { /* decorative */ }
  }
  _channel = null;
  _subscribeInFlight = null;
}
