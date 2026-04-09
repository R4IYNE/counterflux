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
     * Handle notification bell click.
     * Shows pending price alerts from the market store.
     */
    handleNotifications() {
      const market = Alpine.store('market');
      if (market && market.alertBadgeCount > 0) {
        // Navigate to Preordain watchlist tab to show alerts
        if (window.__counterflux_router) {
          window.__counterflux_router.navigate('/preordain');
        }
        market.setTab('watchlist');
      }
    }
  };
}
