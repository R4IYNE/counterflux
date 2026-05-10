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
    },

    /**
     * Phase 10 D-09 — profile-widget click handler branches on auth status.
     * Migrated from sidebar.js as part of the topbar nav refactor (2026-05-10).
     * Anonymous → open auth-modal. Authed → open settings-modal.
     */
    profileWidgetClick() {
      const auth = this.$store.auth;
      if (auth && auth.status === 'authed') {
        if (typeof window.__openSettingsModal === 'function') window.__openSettingsModal();
      } else {
        if (typeof window.__openAuthModal === 'function') window.__openAuthModal();
      }
    },

    /**
     * Phase 10 — display name for the authed topbar widget.
     * Priority: profile.name → user_metadata.full_name → user_metadata.given_name → email localpart.
     */
    authedDisplayName() {
      const profile = this.$store.profile;
      const auth = this.$store.auth;
      if (profile?.name) return profile.name;
      const u = auth?.user;
      if (!u) return '';
      return u.user_metadata?.full_name
        || u.user_metadata?.given_name
        || (u.email?.split('@')[0])
        || '';
    },

    /**
     * Phase 10 D-15 — avatar URL for the authed topbar widget.
     * Returns null when no avatar is available (template falls back to initials).
     */
    authedAvatarUrl() {
      const profile = this.$store.profile;
      return profile?.effectiveAvatarUrl || null;
    }
  };
}
