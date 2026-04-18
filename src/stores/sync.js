// src/stores/sync.js
//
// Phase 11 Plan 2 — Alpine sync store + 4-state state machine (SYNC-07, D-08, D-10, D-11).
//
// Store shape (CONTEXT code_context + UI-SPEC §Alpine-store-shape):
//   {
//     status: 'synced' | 'syncing' | 'offline' | 'error',
//     pending_count: number,
//     last_error: any | null,
//     last_synced_at: number | null,
//     bulkPullProgress: { table, pulled, total } | null,
//     init(), flush(), retry(id), discard(id), getTooltip()
//   }
//
// State machine (RESEARCH §Pattern 7):
//   synced  → syncing / offline / error
//   syncing → synced / offline / error
//   offline → syncing              (online + authed; Plan 11-04 then wires flushQueue)
//   error   → syncing / synced     (retry or discard-all clears)
//
// Scope in this plan (UI surface + state machine only):
//   - navigator online/offline listeners drive the offline↔* transitions
//   - flush / retry / discard are STUBS that log to console — Plan 11-04 wires the engine
//   - pending_count is a reactive field; Plan 11-04 populates it from db.sync_queue.count()
//   - openSyncErrorsModal is stubbed (console.warn) — Plan 11-03 swaps in the real modal
//
// Design notes:
//   - Module-level _onlineListenerInstalled flag prevents double-bind across init() calls
//   - Pre-auth boot: chip hidden anyway (auth-wall covers the topbar per Phase 10 D-40);
//     store status defaults to 'synced' (or 'offline' if navigator.onLine === false)
//   - _transition() is the single write path for status — rejects illegal transitions
//     and stamps last_synced_at on every synced entry

import Alpine from 'alpinejs';
import { openSyncErrorsModal } from '../components/sync-errors-modal.js';
// Phase 11 Plan 4 — engine delegation for flush/retry/discard.
import { flushQueue, scheduleFlush } from '../services/sync-engine.js';
import { db } from '../db/schema.js';

let _onlineListenerInstalled = false;
let _pendingCountInterval = null;

// ---------------------------------------------------------------------------
// Sync-errors-modal bridge
//
// The chip's error-state @click handler calls window.openSyncErrorsModal().
// Plan 11-02 shipped a console.warn stub here; Plan 11-03 replaces it with
// the real modal imported above. Assignment is unconditional — any prior
// stub is overwritten.
// ---------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  window.openSyncErrorsModal = openSyncErrorsModal;
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------
const VALID_TRANSITIONS = {
  synced:  ['syncing', 'offline', 'error'],
  syncing: ['synced', 'offline', 'error'],
  offline: ['syncing'],              // reconnect must route through syncing; flushQueue flips to synced
  error:   ['syncing', 'synced'],    // retry goes via syncing; discard-all can go straight to synced
};

export function initSyncStore() {
  const initialStatus = (typeof navigator !== 'undefined' && navigator.onLine === false)
    ? 'offline'
    : 'synced';

  Alpine.store('sync', {
    status: initialStatus,
    pending_count: 0,
    last_error: null,
    last_synced_at: null,
    bulkPullProgress: null,

    /**
     * Install navigator online/offline listeners. Safe to call multiple times
     * (guarded by module-level _onlineListenerInstalled flag).
     */
    async init() {
      if (_onlineListenerInstalled || typeof window === 'undefined') return;
      _onlineListenerInstalled = true;

      window.addEventListener('online', () => {
        const auth = Alpine.store('auth');
        if (auth?.status === 'authed') {
          this._transition('syncing');
          // Plan 11-04 wires: src/services/sync-engine.js flushQueue() triggers here
        } else {
          // Pre-auth: offline → synced is not a legal transition, but the chip is
          // hidden behind the auth-wall anyway. Force a legal intermediate.
          if (this.status === 'offline') this._transition('syncing');
          this._transition('synced');
        }
      });

      window.addEventListener('offline', () => {
        this._transition('offline');
      });

      // Plan 11-04 — reactive `pending_count` via lightweight 2s poll.
      // Only runs while authed; clears to 0 when signed out. Poll is cheap
      // (a single .count() on an indexed column); guarded with try/catch so a
      // mid-migration Dexie state never throws.
      if (_pendingCountInterval === null) {
        _pendingCountInterval = setInterval(async () => {
          try {
            const auth = Alpine.store('auth');
            if (auth?.status !== 'authed' || !auth.user?.id) {
              if (this.pending_count !== 0) this.pending_count = 0;
              return;
            }
            this.pending_count = await db.sync_queue.where('user_id').equals(auth.user.id).count();
          } catch {
            // Dexie closed / mid-migration — leave pending_count as-is
          }
        }, 2000);
      }
    },

    /**
     * Single write path for status. Rejects illegal transitions per VALID_TRANSITIONS.
     * Stamps last_synced_at on every 'synced' entry.
     */
    _transition(next) {
      if (this.status === next) return;
      const allowed = VALID_TRANSITIONS[this.status] ?? [];
      if (!allowed.includes(next)) {
        console.warn(`[sync] invalid transition ${this.status} → ${next}; ignoring`);
        return;
      }
      this.status = next;
      if (next === 'synced') this.last_synced_at = Date.now();
    },

    /**
     * Trigger an immediate push of queued writes to Supabase.
     * Delegates to src/services/sync-engine.js `scheduleFlush(0)` — the engine
     * handles FK order, dedup, retries, and dead-lettering.
     */
    async flush() {
      scheduleFlush(0);
    },

    /**
     * Re-queue a dead-lettered entry from sync_conflicts back into sync_queue.
     * The row is tagged with the current auth user_id (PITFALLS §7 — never
     * flush another user's entry). Subsequent flushQueue() attempts to push.
     */
    async retry(conflictId) {
      const conflict = await db.sync_conflicts.get(conflictId);
      if (!conflict) return;
      const userId = Alpine.store('auth')?.user?.id ?? null;
      await db.sync_queue.add({
        table_name: conflict.table_name,
        op: conflict.op,
        row_id: conflict.row_id,
        user_id: userId,
        payload: conflict.payload,
        attempts: 0,
        last_error: null,
        created_at: Date.now()
      });
      await db.sync_conflicts.delete(conflictId);
      if (this.status === 'error') this._transition('syncing');
      scheduleFlush(0);
    },

    /**
     * Hard-delete a dead-lettered entry from sync_conflicts without retrying.
     * If no more conflicts remain and chip is in 'error', clear the error state.
     */
    async discard(conflictId) {
      await db.sync_conflicts.delete(conflictId);
      const remaining = await db.sync_conflicts.count();
      if (remaining === 0 && this.status === 'error') {
        this._transition('synced');
        this.last_error = null;
      }
    },

    /**
     * Tooltip copy per UI-SPEC §Component Anatomy 1 "Tooltip contract".
     * Read by the topbar chip's :title binding.
     */
    getTooltip() {
      switch (this.status) {
        case 'synced': {
          if (!this.last_synced_at) return 'Last synced just now.';
          const t = new Date(this.last_synced_at).toTimeString().slice(0, 8);
          return `Last synced ${t}.`;
        }
        case 'syncing':
          return `${this.pending_count} pending changes.`;
        case 'offline':
          return "No connection. Changes saved locally; will sync when you're back online.";
        case 'error':
          return 'Sync failed. Click to review.';
        default:
          return '';
      }
    },
  });

  // Kick off listeners on the next microtask so Alpine.start() has completed.
  // Using Promise.resolve().then() keeps the init signature synchronous from
  // the caller's perspective while still deferring the listener install.
  Promise.resolve().then(() => {
    const store = Alpine.store('sync');
    if (store && typeof store.init === 'function') store.init();
  });
}

/**
 * Test-only reset — clears module-level listener flag so subsequent
 * initSyncStore() calls inside the same process start fresh.
 * Mirror of __resetAuthStoreSubscription() in src/stores/auth.js.
 */
export function __resetSyncStoreForTests() {
  _onlineListenerInstalled = false;
  if (_pendingCountInterval !== null) {
    clearInterval(_pendingCountInterval);
    _pendingCountInterval = null;
  }
}
