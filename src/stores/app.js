import Alpine from 'alpinejs';

export function initAppStore() {
  Alpine.store('app', {
    currentScreen: 'epic-experiment',
    // gameFullscreen field removed in Phase 09 Plan 2 — the real Fullscreen API
    // now lives in floating-toolbar.js (document.documentElement.requestFullscreen);
    // document.fullscreenElement is the source of truth. The hashchange handler
    // at the bottom of this file calls document.exitFullscreen() on navigation
    // away from vandalblast.

    screens: [
      { id: 'epic-experiment',     label: 'Epic Experiment',     topbarLabel: 'Dashboard',  icon: 'dashboard',             route: '/',                    locked: false },
      { id: 'treasure-cruise',     label: 'Treasure Cruise',     topbarLabel: 'Collection', icon: 'collections_bookmark',  route: '/treasure-cruise',     locked: false },
      { id: 'thousand-year-storm', label: 'Thousand-Year Storm', topbarLabel: 'Decks',      icon: 'auto_fix_high',         route: '/thousand-year-storm', locked: false },
      { id: 'preordain',           label: 'Preordain',           topbarLabel: 'Market',     icon: 'insights',              route: '/preordain',           locked: false },
      { id: 'vandalblast',         label: 'Vandalblast',         topbarLabel: 'Game',       icon: 'local_fire_department', route: '/vandalblast',         locked: false },
    ],

    navigate(screenId) {
      const screen = this.screens.find(s => s.id === screenId);
      if (!screen || screen.locked) return;
      this.currentScreen = screenId;
      // Exit fullscreen when leaving Vandalblast (Phase 09 Plan 2 — real API)
      if (screenId !== 'vandalblast' && typeof document !== 'undefined' && document.fullscreenElement) {
        document.exitFullscreen?.();
      }
    }
  });

  Alpine.store('toast', {
    items: [],
    _nextId: 1,

    show(message, type = 'info', duration = 5000) {
      const id = this._nextId++;
      this.items.push({ id, message, type, visible: true });

      // Max 3 visible -- dismiss oldest if overflow
      while (this.items.filter(t => t.visible).length > 3) {
        const oldest = this.items.find(t => t.visible);
        if (oldest) oldest.visible = false;
      }

      setTimeout(() => {
        const item = this.items.find(t => t.id === id);
        if (item) item.visible = false;
        setTimeout(() => {
          this.items = this.items.filter(t => t.id !== id);
        }, 300);
      }, duration);
    },

    dismiss(id) {
      const item = this.items.find(t => t.id === id);
      if (item) {
        item.visible = false;
        setTimeout(() => {
          this.items = this.items.filter(t => t.id !== id);
        }, 300);
      }
    },

    showUndo(message, undoId) {
      // Use the undoId as the toast id for direct dismiss targeting
      this.items.push({ id: undoId, message, type: 'undo', visible: true, undoId });
      // Max 3 visible check
      while (this.items.filter(t => t.visible).length > 3) {
        const oldest = this.items.find(t => t.visible);
        if (oldest) oldest.visible = false;
      }
      // Auto-dismiss after 10.3s (slightly after undo timer to avoid flash)
      setTimeout(() => {
        const item = this.items.find(t => t.id === undoId);
        if (item) item.visible = false;
        setTimeout(() => {
          this.items = this.items.filter(t => t.id !== undoId);
        }, 300);
      }, 10300);
    },

    info(msg) { this.show(msg, 'info'); },
    success(msg) { this.show(msg, 'success'); },
    warning(msg) { this.show(msg, 'warning'); },
    error(msg) { this.show(msg, 'error', 8000); },
  });

  // Exit game fullscreen on any navigation (back button, hash change).
  // Phase 09 Plan 2 — uses real Fullscreen API; document.fullscreenElement
  // is the source of truth.
  window.addEventListener('hashchange', () => {
    if (typeof document !== 'undefined' && document.fullscreenElement && !window.location.hash.includes('vandalblast')) {
      document.exitFullscreen?.();
    }
  });
}
