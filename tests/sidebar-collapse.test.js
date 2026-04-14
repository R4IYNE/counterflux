import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * POLISH-09 / D-27..D-29: sidebar collapse persistence.
 *
 * Tests exercise the hydration + toggle + persistence contract that
 * `initAppStore()` in src/stores/app.js must satisfy. We replicate the
 * hydration and toggle shape here as a pure object (no Alpine dep) and
 * audit the source so the app store stays in sync.
 */

// Minimal localStorage shim for node env
function installLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (i) => Array.from(store.keys())[i] ?? null,
  };
}

beforeEach(() => {
  installLocalStorage();
  localStorage.clear();
  // Provide a window shim with a reasonable viewport default
  if (typeof globalThis.window === 'undefined') {
    globalThis.window = { innerWidth: 1440, addEventListener: () => {} };
  } else {
    globalThis.window.innerWidth = 1440;
  }
});

describe('sidebar collapse (POLISH-09 / D-27..D-29)', () => {
  // Reproduce the hydrate+toggle contract that the store implements
  function makeStore() {
    const hydrate = () => {
      const raw = localStorage.getItem('sidebar_collapsed');
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      return window.innerWidth < 1024;
    };
    return {
      sidebarCollapsed: hydrate(),
      toggleSidebar() {
        this.sidebarCollapsed = !this.sidebarCollapsed;
        localStorage.setItem('sidebar_collapsed', String(this.sidebarCollapsed));
      },
    };
  }

  it('hydrates from localStorage when key is "true"', () => {
    localStorage.setItem('sidebar_collapsed', 'true');
    const store = makeStore();
    expect(store.sidebarCollapsed).toBe(true);
  });

  it('hydrates from localStorage when key is "false" even on a narrow viewport', () => {
    globalThis.window.innerWidth = 800; // would default to true without persistence
    localStorage.setItem('sidebar_collapsed', 'false');
    const store = makeStore();
    expect(store.sidebarCollapsed).toBe(false);
  });

  it('falls back to viewport default when localStorage key absent', () => {
    const store = makeStore();
    expect(store.sidebarCollapsed).toBe(false); // 1440 >= 1024
  });

  it('toggleSidebar() writes the new value back to localStorage', () => {
    const store = makeStore();
    store.toggleSidebar();
    expect(localStorage.getItem('sidebar_collapsed')).toBe('true');
    expect(store.sidebarCollapsed).toBe(true);
    store.toggleSidebar();
    expect(localStorage.getItem('sidebar_collapsed')).toBe('false');
    expect(store.sidebarCollapsed).toBe(false);
  });
});

describe('sidebar source audit (D-27 / D-29)', () => {
  const appStoreSrc = readFileSync('src/stores/app.js', 'utf-8');
  const indexHtml = readFileSync('index.html', 'utf-8');
  const sidebarSrc = readFileSync('src/components/sidebar.js', 'utf-8');

  it('app store references localStorage key `sidebar_collapsed` (read and write)', () => {
    const reads = (appStoreSrc.match(/sidebar_collapsed/g) || []).length;
    expect(reads).toBeGreaterThanOrEqual(2);
    expect(appStoreSrc).toMatch(/localStorage\.getItem\(['"]sidebar_collapsed['"]\)/);
    expect(appStoreSrc).toMatch(/localStorage\.setItem\(['"]sidebar_collapsed['"]/);
  });

  it('app store exposes toggleSidebar() method', () => {
    expect(appStoreSrc).toMatch(/toggleSidebar\s*\(\)/);
  });

  it('sidebar module delegates toggleSidebar to the app store', () => {
    expect(sidebarSrc).toMatch(/toggleSidebar/);
  });

  it('sidebar markup uses w-16 for the collapsed state (D-27 — icon rail, not hide)', () => {
    // The <aside> :class binding: $store.app.sidebarCollapsed ? 'w-16' : 'w-60'
    expect(indexHtml).toMatch(/sidebarCollapsed\s*\?\s*['"]w-16['"]/);
    // Negative guards
    expect(indexHtml).not.toMatch(/sidebarCollapsed\s*\?\s*['"]w-0['"]/);
    expect(indexHtml).not.toMatch(/sidebarCollapsed\s*\?\s*['"]hidden['"]/);
  });

  it('sidebar header includes a chevron_left/chevron_right toggle button', () => {
    expect(indexHtml).toMatch(/chevron_left/);
    expect(indexHtml).toMatch(/chevron_right/);
    expect(indexHtml).toMatch(/toggleSidebar/);
  });

  it('nav items gain title tooltips when collapsed (discoverability)', () => {
    expect(indexHtml).toMatch(/:title=["']\$store\.app\.sidebarCollapsed\s*\?\s*screen\.label/);
  });
});
