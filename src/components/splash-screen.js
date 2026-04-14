/**
 * Splash screen component for first-load bulk data download.
 * Full-screen blocking overlay with progress bar, download stats,
 * rotating flavour text, and Mila image with CSS pulse animation.
 *
 * Renders when $store.bulkdata.status !== 'ready'.
 * Fades out after 1s delay on completion.
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
      // Rotate flavour text every 8 seconds
      this._interval = setInterval(() => {
        this.flavourIndex = (this.flavourIndex + 1) % FLAVOUR_TEXTS.length;
      }, 8000);

      // Watch for ready state and trigger fade out
      if (typeof this.$watch === 'function') {
        this.$watch('$store.bulkdata.status', (status) => {
          if (status === 'ready') {
            setTimeout(() => {
              this.fadingOut = true;
            }, 1000);
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

    get isVisible() {
      return this.$store.bulkdata.status !== 'ready' || !this.fadingOut;
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
