import Alpine from 'alpinejs';

export function initAppStore() {
  Alpine.store('app', {
    currentScreen: 'welcome',
    sidebarCollapsed: window.innerWidth < 1024,
    gameFullscreen: false,

    screens: [
      { id: 'welcome', label: 'Archive', icon: 'cyclone', route: '/', locked: false },
      { id: 'epic-experiment', label: 'Epic Experiment', icon: 'dashboard', route: '/epic-experiment', locked: true },
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

    info(msg) { this.show(msg, 'info'); },
    success(msg) { this.show(msg, 'success'); },
    warning(msg) { this.show(msg, 'warning'); },
    error(msg) { this.show(msg, 'error', 8000); },
  });

  // Listen for viewport resize to toggle sidebar collapse
  window.addEventListener('resize', () => {
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
