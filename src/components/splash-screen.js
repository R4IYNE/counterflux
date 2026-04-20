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
    _interval: null,

    init() {
      // Rotate flavour text every 8 seconds (kept — visible during migration)
      this._interval = setInterval(() => {
        this.flavourIndex = (this.flavourIndex + 1) % FLAVOUR_TEXTS.length;
      }, 8000);

      // D-04 repurpose: watch migrationProgress instead of bulkdata.status.
      // Fade out when migration completes (progress === 100).
      if (typeof this.$watch === 'function') {
        this.$watch('$store.bulkdata.migrationProgress', (progress) => {
          if (progress !== null && progress >= 100) {
            setTimeout(() => {
              this.fadingOut = true;
            }, 500);
          }
        });
      }
    },

    destroy() {
      if (this._interval) clearInterval(this._interval);
    },

    get flavourText() {
      return FLAVOUR_TEXTS[this.flavourIndex];
    },

    /**
     * D-17a hook: Plan 3 will populate `$store.bulkdata.migrationProgress`
     * as the v5→v6 migration runs. For now this safely returns null when
     * the store or field is absent, so the template `x-show` stays hidden.
     */
    get migrationProgress() {
      try {
        const alpine = globalThis.Alpine || (typeof window !== 'undefined' ? window.Alpine : null);
        const store = alpine?.store ? alpine.store('bulkdata') : null;
        const val = store?.migrationProgress;
        return (val === undefined) ? null : val;
      } catch {
        return null;
      }
    },

    /**
     * D-04 repurpose (Phase 13 Plan 3): splash overlay now renders ONLY
     * while the v5→v8 migration is in flight. Bulk-data progress moved
     * to the topbar pill (D-06) so the app shell can render immediately
     * after Alpine.start().
     *
     * The `fadingOut` flag is retained so an in-progress migration can
     * still fade the overlay out gracefully when migrationProgress hits
     * 100. Historical `$store.bulkdata.status !== 'ready'` coupling has
     * been removed.
     */
    get isVisible() {
      const progress = this.migrationProgress;
      if (progress === null) return false;
      if (this.fadingOut) return false;
      return progress > 0 && progress < 100;
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
