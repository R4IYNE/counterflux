/**
 * Topbar component data function for Alpine.js.
 *
 * The topbar layout is rendered via Alpine directives in index.html.
 * This module provides helper functions for topbar behaviour.
 */

/**
 * Returns topbar Alpine component data.
 */
export function topbarComponent() {
  return {
    /**
     * Handle search input -- delegates to Alpine search store with debounce.
     * @param {Event} event - Input event
     */
    handleSearch(event) {
      const query = event.target.value;
      Alpine.store('search').search(query);
    },

    /**
     * Navigate to a screen by id. Skips locked screens and no-ops if the
     * screen is already current. Matches the prior sidebar handler shape.
     * @param {Object} screen - Screen object from $store.app.screens
     */
    handleNavClick(screen) {
      if (screen.locked) return;
      if (this.$store.app.currentScreen === screen.id) return;
      this.$store.app.navigate(screen.id);
      if (window.__counterflux_router) {
        window.__counterflux_router.navigate(screen.route);
      }
    },

    /**
     * Tailwind classes for a topbar nav item based on active/locked state.
     * Active: blue accent on text + 2px blue bottom border.
     * Inactive: muted text, hover lifts to primary, transparent placeholder
     *   bottom border so the layout doesn't jump on active toggle.
     * Locked: dim + not-allowed (parity with prior sidebar behaviour).
     * @param {Object} screen - Screen object
     * @returns {string} Tailwind class string
     */
    navItemClasses(screen) {
      if (screen.locked) {
        return 'text-text-dim cursor-not-allowed opacity-50';
      }
      if (this.$store.app.currentScreen === screen.id) {
        return 'text-primary border-b-2 border-primary';
      }
      return 'text-text-muted hover:text-primary border-b-2 border-transparent';
    }
  };
}
