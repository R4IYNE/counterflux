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
    searchQuery: '',

    /**
     * Handle search input. Placeholder for Phase 1 -- autocomplete wired in Plan 04.
     * @param {Event} event - Input event
     */
    handleSearch(event) {
      this.searchQuery = event.target.value;
      // Autocomplete will be wired in Plan 04
    },

    /**
     * Handle notification bell click. Placeholder for future implementation.
     */
    handleNotifications() {
      // Notification panel will be implemented in a future phase
    }
  };
}
