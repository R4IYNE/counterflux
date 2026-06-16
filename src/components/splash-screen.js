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
    _maxTimer: null,

    init() {
      // Rotate flavour text every 8 seconds (kept — visible on boot + migration)
      this._interval = setInterval(() => {
        this.flavourIndex = (this.flavourIndex + 1) % FLAVOUR_TEXTS.length;
      }, 8000);

      // If bulk data is already loaded when the splash mounts, mark ready now.
      if (this.$store?.bulkdata?.status === 'ready') {
        this._ready = true;
      }

      if (typeof this.$watch === 'function') {
        // Boot path: fade once the bulk-data store reports ready.
        this.$watch('$store.bulkdata.status', (s) => {
          if (s === 'ready') {
            this._ready = true;
            this._maybeFinish();
          }
        });
        // Migration path: fade once a real migration completes.
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

      // Tween the 0→100 bar. During a real migration the bar tracks the
      // actual migration progress; otherwise it eases up to 92% and only
      // snaps to 100 once both ready + min-elapsed are satisfied.
      this._progressTimer = setInterval(() => {
        if (this._isMigration()) {
          this.displayProgress = this.migrationProgress || 0;
        } else if (this._ready && this._minElapsed) {
          this.displayProgress = 100;
        } else if (this.displayProgress < 92) {
          this.displayProgress = Math.min(92, this.displayProgress + 4);
        }
      }, 80);

      // Safety net: a stuck/errored bulk-data load can never trap the user.
      this._maxTimer = setTimeout(() => {
        this._ready = true;
        this._minElapsed = true;
        this._maybeFinish();
      }, 8000);
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

    destroy() {
      if (this._interval) clearInterval(this._interval);
      if (this._progressTimer) clearInterval(this._progressTimer);
      if (this._minTimer) clearTimeout(this._minTimer);
      if (this._maxTimer) clearTimeout(this._maxTimer);
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
     * Boot splash now shows from mount until the fade flips on (after the
     * ~2.5s minimum AND data ready, or the 8s safety). During a real
     * migration the same overlay tracks migration progress instead.
     */
    get isVisible() {
      return !this.fadingOut;
    },

    get barProgress() {
      return this._isMigration() ? (this.migrationProgress || 0) : this.displayProgress;
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
      const store = this.$store.bulkdata;
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
