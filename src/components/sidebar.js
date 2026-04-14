/**
 * Sidebar component data function for Alpine.js.
 *
 * The sidebar layout is rendered via Alpine directives in index.html.
 * This module provides helper functions for sidebar behaviour.
 */

/**
 * Returns sidebar Alpine component data.
 * Used with x-data="sidebarComponent()" if declarative binding is preferred.
 */
export function sidebarComponent() {
  return {
    /**
     * Handle nav item click. Navigates only if screen is unlocked.
     * @param {Object} screen - Screen object from $store.app.screens
     */
    handleNavClick(screen) {
      if (screen.locked) return;
      this.$store.app.navigate(screen.id);
      if (window.__counterflux_router) {
        window.__counterflux_router.navigate(screen.route);
      }
    },

    /**
     * Check if a screen should show an alert badge.
     * Currently only Preordain shows a badge when alertBadgeCount > 0.
     * @param {Object} screen - Screen object
     * @returns {boolean}
     */
    hasAlertBadge(screen) {
      if (screen.id !== 'preordain') return false;
      const market = Alpine.store('market');
      return market && market.alertBadgeCount > 0;
    },

    /**
     * Returns CSS classes for a nav item based on active/locked state.
     * @param {Object} screen - Screen object
     * @returns {string} Tailwind class string
     */
    navItemClasses(screen) {
      if (screen.locked) {
        return 'text-text-dim cursor-not-allowed opacity-50';
      }
      if (this.$store.app.currentScreen === screen.id) {
        return 'bg-primary/10 text-primary border-r-4 border-primary';
      }
      return 'text-text-muted hover:bg-primary/5 hover:text-primary';
    },

    /**
     * Toggle sidebar collapsed state. Delegates to the app store so
     * the localStorage persistence (POLISH-09 / D-28) happens in one place.
     * Callers: the chevron toggle button in the sidebar header.
     */
    toggleSidebar() {
      this.$store.app.toggleSidebar();
    }
  };
}

/**
 * D-27 note: The sidebar collapses to a 64px (w-16) icon rail -- NEVER
 * `w-0` or `hidden`. Nav items remain tappable in both states; labels
 * hide via `x-show="!$store.app.sidebarCollapsed"`. Collapsed mode
 * shows `:title="screen.label"` tooltips for discoverability.
 */
