/**
 * D-06 topbar bulk-data progress pill (Phase 13 Plan 3).
 *
 * Renders adjacent to the sync-status chip + notification bell while
 * `$store.bulkdata.status !== 'ready'`. Auto-dismisses when status flips
 * to 'ready'.
 *
 * Visual vocabulary inherited from the sync-status chip — NO new design
 * tokens, colours, or keyframes (D-06; Research §Pattern 3).
 *
 * States (Research §Example 6 template):
 * - `checking` / `idle` → CHECKING ARCHIVE…         (muted)
 * - `downloading`       → ARCHIVE — N%              (primary tint, spinner)
 * - `parsing`           → INDEXING — N cards        (primary tint, live dot)
 * - `error`             → ARCHIVE ERROR             (<button>, warning tint,
 *                                                    clickable → retry)
 *
 * The template itself lives in index.html (single-source, Alpine reads
 * x-data from this factory). This module only provides reactive getters
 * and a retry() method so the outer template can stay declarative.
 */
export function topbarBulkdataPill() {
  return {
    /**
     * Reactive accessor onto $store.bulkdata.status. Safe default 'idle' when
     * Alpine is not yet available (during unit tests or pre-Alpine.start()
     * template walks).
     */
    get status() {
      const alpine = (typeof window !== 'undefined' && window.Alpine) || null;
      const store = alpine?.store ? alpine.store('bulkdata') : null;
      return store?.status ?? 'idle';
    },

    /**
     * Human-readable progress label for the current status. Consumers
     * typically read $store.bulkdata.{progress,parsed} directly — this
     * helper exists so the aria-label can substitute a single string.
     */
    get progressLabel() {
      const alpine = (typeof window !== 'undefined' && window.Alpine) || null;
      const store = alpine?.store ? alpine.store('bulkdata') : null;
      if (!store) return '';
      if (store.status === 'downloading') return `${store.progress ?? 0}%`;
      if (store.status === 'parsing') return `${(store.parsed ?? 0).toLocaleString()}`;
      return '';
    },

    /**
     * Error-state click handler. Delegates to $store.bulkdata.retry() when
     * available; pure no-op otherwise so the error state is still clickable
     * without breaking.
     */
    retry() {
      const alpine = (typeof window !== 'undefined' && window.Alpine) || null;
      const store = alpine?.store ? alpine.store('bulkdata') : null;
      if (store && typeof store.retry === 'function') {
        store.retry();
      }
    },
  };
}
