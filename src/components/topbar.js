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
    }
  };
}
