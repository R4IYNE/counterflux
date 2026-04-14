import Alpine from 'alpinejs';

/**
 * POLISH-09 (D-27/D-28/D-29): Sidebar collapsed preference lives in
 * localStorage under key `sidebar_collapsed`. On first load we hydrate
 * from the stored value (falling back to viewport-width default).
 * `toggleSidebar()` flips the flag and writes it back.
 */
function hydrateSidebarCollapsed() {
  try {
    const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem('sidebar_collapsed') : null;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } catch { /* ignore */ }
  return (typeof window !== 'undefined' && window.innerWidth < 1024);
}

export function initAppStore() {
  Alpine.store('app', {
    currentScreen: 'epic-experiment',
    sidebarCollapsed: hydrateSidebarCollapsed(),
    gameFullscreen: false,

    screens: [
      { id: 'epic-experiment', label: 'Epic Experiment', icon: 'dashboard', route: '/', locked: false },
      { id: 'treasure-cruise', label: 'Treasure Cruise', icon: 'collections_bookmark', route: '/treasure-cruise', locked: false },
      { id: 'thousand-year-storm', label: 'Thousand-Year Storm', icon: 'auto_fix_high', route: '/thousand-year-storm', locked: false },
      { id: 'preordain', label: 'Preordain', icon: 'insights', route: '/preordain', locked: false },
      { id: 'vandalblast', label: 'Vandalblast', icon: 'local_fire_department', route: '/vandalblast', locked: false },
    ],

    navigate(screenId) {
      const screen = this.screens.find(s => s.id === screenId);
      if (!screen || screen.locked) return;
      this.currentScreen = screenId;
      // Exit fullscreen when leaving Vandalblast
      if (screenId !== 'vandalblast') this.gameFullscreen = false;
    },

    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed;
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('sidebar_collapsed', String(this.sidebarCollapsed));
        }
      } catch { /* ignore */ }
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

  // D-28: viewport resize no longer overrides a user-set preference.
  // Only apply the responsive default when the user has not made a choice.
  window.addEventListener('resize', () => {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem('sidebar_collapsed') !== null) return;
    } catch { /* ignore */ }
    Alpine.store('app').sidebarCollapsed = window.innerWidth < 1024;
  });

  // Exit game fullscreen on any navigation (back button, hash change)
  window.addEventListener('hashchange', () => {
    const app = Alpine.store('app');
    if (app.gameFullscreen && !window.location.hash.includes('vandalblast')) {
      app.gameFullscreen = false;
    }
  });
}
