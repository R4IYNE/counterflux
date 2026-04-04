/**
 * Splash screen component for first-load bulk data download.
 * Full-screen blocking overlay with progress bar, download stats,
 * rotating flavour text, and Mila image with CSS pulse animation.
 *
 * Renders when $store.bulkdata.status !== 'ready'.
 * Fades out after 1s delay on completion.
 */

const FLAVOUR_TEXTS = [
  '"The Izzet are creative geniuses. Disregard the number of property-loss inquiries." -- Razia, Boros Archangel',
  '"Izzet-style problem solving: keep adding electricity until something works." -- Ral Zarek',
  '"Knowledge is the most dangerous weapon." -- Niv-Mizzet, Parun',
  '"Inspiration is just one satisfying explosion away." -- Chandra Nalaar',
  '"There\'s no wrong way to wield a thunderbolt." -- Ral Zarek'
];

/**
 * Register the splash screen Alpine data component.
 * Usage in HTML: <div x-data="splashScreen">...</div>
 */
export function splashScreen() {
  return {
    flavourIndex: 0,
    fadingOut: false,
    _interval: null,

    init() {
      // Rotate flavour text every 8 seconds
      this._interval = setInterval(() => {
        this.flavourIndex = (this.flavourIndex + 1) % FLAVOUR_TEXTS.length;
      }, 8000);

      // Watch for ready state and trigger fade out
      this.$watch('$store.bulkdata.status', (status) => {
        if (status === 'ready') {
          setTimeout(() => {
            this.fadingOut = true;
          }, 1000);
        }
      });
    },

    destroy() {
      if (this._interval) clearInterval(this._interval);
    },

    get flavourText() {
      return FLAVOUR_TEXTS[this.flavourIndex];
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
