/**
 * Splash screen component — REPURPOSED in Phase 13 Plan 3 (D-04).
 *
 * Previously: full-screen blocking overlay while $store.bulkdata.status !== 'ready'.
 * Now: renders ONLY during the v5→v8 schema migration (migrationProgress > 0
 *      && migrationProgress < 100). Bulk-data download progress is surfaced
 *      via the topbar pill (see src/components/topbar-bulkdata-pill.js, D-06).
 *
 * The FLAVOUR_TEXTS rotation is preserved for the migration window and as
 * a v1.2 Mila-system easter-egg candidate (see 13-CONTEXT.md §Deferred).
 */

/**
 * Flavour quotes rendered beneath the splash progress bar.
 * Each entry is `{ quote, attribution }` so the template can wrap
 * the quote in italic + curly quote marks and the attribution
 * in JetBrains Mono with an em-dash prefix (POLISH-01, D-17).
 * The `--` attribution separator is NOT baked into the data.
 */
export const FLAVOUR_TEXTS = [
  {
    quote: 'The Izzet are creative geniuses. Disregard the number of property-loss inquiries.',
    attribution: 'Razia, Boros Archangel',
  },
  {
    quote: 'Izzet-style problem solving: keep adding electricity until something works.',
    attribution: 'Ral Zarek',
  },
  {
    quote: 'Knowledge is the most dangerous weapon.',
    attribution: 'Niv-Mizzet, Parun',
  },
  {
    quote: 'Inspiration is just one satisfying explosion away.',
    attribution: 'Chandra Nalaar',
  },
  {
    quote: "There's no wrong way to wield a thunderbolt.",
    attribution: 'Ral Zarek',
  },
];

/**
 * Register the splash screen Alpine data component.
 * Usage in HTML: <div x-data="splashScreen">...</div>
 */
export function splashScreen() {
  return {
    flavourIndex: Math.floor(Math.random() * FLAVOUR_TEXTS.length),
    fadingOut: false,
    displayProgress: 0,
    _minElapsed: false,
    _ready: false,
    _interval: null,
    _progressTimer: null,
    _minTimer: null,
    lastProgress: 0,
    lastAdvanceAt: 0,

    init() {
      // Rotate flavour text every 8 seconds (kept — visible on boot + migration)
      this._interval = setInterval(() => {
        this.flavourIndex = (this.flavourIndex + 1) % FLAVOUR_TEXTS.length;
      }, 8000);

      // Stall tracking seed: real progress is "advancing" until proven otherwise.
      this.lastProgress = 0;
      this.lastAdvanceAt = Date.now();

      // If bulk data is already loaded (or pre-errored) when the splash mounts,
      // mark ready now so the poll/min-timer can finish at the first opportunity.
      const initStatus = this.$store?.bulkdata?.status;
      if (initStatus === 'ready' || initStatus === 'error') {
        this._ready = true;
        this._maybeFinish();
      }

      // Optional fast-path: if Alpine's reactive $watch is present, react to a
      // status flip immediately. The interval poll below is the reliable path
      // and works on its own (so this stays testable).
      if (typeof this.$watch === 'function') {
        this.$watch('$store.bulkdata.status', (s) => {
          if (s === 'ready' || s === 'error') {
            this._ready = true;
            this._maybeFinish();
          }
        });
        this.$watch('$store.bulkdata.migrationProgress', (p) => {
          if (p !== null && p >= 100) {
            this._ready = true;
            this._maybeFinish();
          }
        });
      }

      // Minimum on-screen duration so the branded splash never flickers.
      this._minTimer = setTimeout(() => {
        this._minElapsed = true;
        this._maybeFinish();
      }, 2500);

      // Poll the store (~250ms). This is the reliable mechanism: it reads the
      // real status + download progress, advances the synthetic floor, tracks
      // stalls, flips _ready, and tries to finish. No 8s blanket cutoff — the
      // splash stays up until the archive is genuinely ready/error/stalled.
      this._progressTimer = setInterval(() => {
        const status = this.$store?.bulkdata?.status;

        if (status === 'ready' || status === 'error') {
          this._ready = true;
        }

        // Advance the small synthetic floor that bridges the brief
        // idle/checking phase before real download numbers arrive.
        if (this.displayProgress < 15) {
          this.displayProgress = Math.min(15, this.displayProgress + 1);
        }

        // Stall safety: if progress hasn't advanced for 40s, let the user
        // through. Covers BOTH a stalled mid-download AND a check/connection
        // that never emits a single byte (realProgress stuck at 0) — the
        // latter previously hung the splash FOREVER. lastAdvanceAt is seeded
        // at init, so a 0-progress boot escapes 40s after mount. Excluded
        // during an active migration, whose progress lives on its own field
        // and which must run to completion (a hung migration is handled by
        // the onblocked / blocking modal path, not here).
        const realProgress = this._realProgress();
        if (realProgress > this.lastProgress) {
          this.lastProgress = realProgress;
          this.lastAdvanceAt = Date.now();
        }
        if (!this._ready && !this._isMigration() &&
            (Date.now() - this.lastAdvanceAt) > 40000) {
          this._ready = true;
        }

        this._maybeFinish();
      }, 250);
    },

    _maybeFinish() {
      if (this._minElapsed && this._ready && !this.fadingOut) {
        this.displayProgress = 100;
        setTimeout(() => {
          this.fadingOut = true;
        }, 350);
      }
    },

    _isMigration() {
      return this.migrationProgress !== null && this.migrationProgress < 100;
    },

    _realProgress() {
      const p = this.$store?.bulkdata?.progress;
      return (typeof p === 'number' ? p : 0);
    },

    destroy() {
      if (this._interval) clearInterval(this._interval);
      if (this._progressTimer) clearInterval(this._progressTimer);
      if (this._minTimer) clearTimeout(this._minTimer);
    },

    get flavourText() {
      return FLAVOUR_TEXTS[this.flavourIndex];
    },

    /**
     * D-17a hook: `$store.bulkdata.migrationProgress` is populated as the
     * v5→v8 migration runs. Reads `this.$store` first (so the component is
     * testable as a plain object) and falls back to the global Alpine
     * lookup. Returns null when the store or field is absent.
     */
    get migrationProgress() {
      try {
        const fromStore = this.$store?.bulkdata?.migrationProgress;
        if (fromStore !== undefined) return fromStore;
        const alpine = globalThis.Alpine || (typeof window !== 'undefined' ? window.Alpine : null);
        const store = alpine?.store ? alpine.store('bulkdata') : null;
        const val = store?.migrationProgress;
        return (val === undefined) ? null : val;
      } catch {
        return null;
      }
    },

    /**
     * Boot splash shows from mount until the fade flips on: after the ~2.5s
     * minimum AND the archive is ready (status 'ready'/'error', or a 40s
     * stall). During a real migration the same overlay tracks migration
     * progress instead.
     */
    get isVisible() {
      return !this.fadingOut;
    },

    /**
     * The bar shows REAL archive download progress, not a synthetic tween.
     *  - migration in flight → migrationProgress
     *  - archive ready → 100
     *  - otherwise → max(real download %, small synthetic floor ≤ 15)
     * The floor only bridges the brief idle/checking phase and can never
     * overstate the real download %.
     */
    get barProgress() {
      if (this._isMigration()) return this.migrationProgress || 0;
      if (this.$store?.bulkdata?.status === 'ready') return 100;
      return Math.max(this._realProgress(), this.displayProgress);
    },

    get isMigrationView() {
      return this._isMigration();
    },

    get headingText() {
      return this._isMigration() ? 'Upgrading Aetheric Archive…' : 'Loading the Archive…';
    },

    get progressLabel() {
      return (this._isMigration() ? 'Migrating your archive — ' : 'Loading — ') + Math.round(this.barProgress) + '%';
    },

    get statusLabel() {
      const store = this.$store?.bulkdata;
      if (!store) return '';
      switch (store.status) {
        case 'idle':
        case 'checking':
          return 'CHECKING FOR UPDATES...';
        case 'downloading':
          return `DOWNLOADING BULK DATA: ${store.downloadedMB}MB / ${store.totalMB}MB`;
        case 'parsing':
          return `PARSING CARD DATABASE: ${store.parsed} CARDS`;
        case 'ready':
          return `ARCHIVE READY. ${store.totalCards.toLocaleString()} CARDS INDEXED.`;
        case 'error':
          return store.error || 'An error occurred.';
        default:
          return '';
      }
    }
  };
}
