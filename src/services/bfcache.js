/**
 * D-09 bfcache handlers (Phase 13 Plan 2).
 *
 * IndexedDB open connections block Chrome back/forward cache (web.dev/articles/bfcache).
 * Counterflux's Dexie singleton holds the connection open for the entire session.
 * This module closes it on `pagehide` (when page might enter bfcache) and reopens
 * it on `pageshow` (after bfcache restore).
 *
 * Idempotent via _bound module-scoped flag — safe to call multiple times.
 *
 * Research: 13-RESEARCH.md §Pattern 5 + §Example 3
 * Pitfall 5: Realtime WebSocket may also block bfcache for authed users — see plan summary.
 *
 * NOTE (Plan 1 re-measurement, 13-REMEASURE.md): the actual Lighthouse 12.6.1
 * bfcache failure reason on v1.1 was the in-flight Scryfall bulk-data fetch
 * ("active network connection received too much data"), not the IDB-open blocker
 * predicted by research. The Dexie close/open wiring here is still defensive good
 * practice (IDB handles WILL block bfcache in subsequent scenarios and on browser
 * variants that enforce the IDB rule more aggressively) but it is not the
 * primary fix for the flagged v1.1 failure. See 13-02-SUMMARY.md for the full
 * reframing and the Task 4 investigation outcome.
 */
import { db } from '../db/schema.js';

let _bound = false;

export function bindBfcacheHandlers() {
  if (_bound) return;
  if (typeof window === 'undefined') return; // SSR/test-node guard
  _bound = true;

  window.addEventListener('pagehide', (event) => {
    // `persisted === true` means the browser is considering bfcache for this page.
    // Close Dexie to remove the IDB-open blocker.
    if (event.persisted) {
      try { db.close(); } catch { /* noop — already closed */ }
    }
  });

  window.addEventListener('pageshow', (event) => {
    // `persisted === true` means we were actually restored from bfcache.
    // Reopen Dexie; reactive Alpine stores pick up again transparently.
    if (event.persisted && !db.isOpen()) {
      db.open().catch((err) => {
        console.warn('[Counterflux] bfcache reopen failed', err);
      });
    }
  });
}
