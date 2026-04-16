import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * COLLECT-06 core contract: panel open-state persists to
 * localStorage.tc_panel_open; first-boot (null) defaults to OPEN per D-03
 * and Pitfall 6; addToCollection() DOES NOT close the panel (D-01); close()
 * via togglePanel() persists `false`.
 *
 * This test exercises the store-level state + an HTML-string check on the
 * panel's template so we don't require a full Alpine runtime.
 */
function createAlpineStub() {
  const stores = {};
  return {
    store(name, obj) {
      if (obj === undefined) return stores[name];
      stores[name] = obj;
      return stores[name];
    },
  };
}

// In-memory localStorage shim for the node test environment.
function installLocalStorage(initial = {}) {
  const data = { ...initial };
  const storage = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem(k, v) { data[k] = String(v); },
    removeItem(k) { delete data[k]; },
    clear() { Object.keys(data).forEach(k => delete data[k]); },
    get length() { return Object.keys(data).length; },
    key(i) { return Object.keys(data)[i] ?? null; },
    __data: data,
  };
  globalThis.localStorage = storage;
  if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
  globalThis.window.localStorage = storage;
  return storage;
}

async function freshStore({ localStorageSeed = {} } = {}) {
  installLocalStorage(localStorageSeed);
  // Reset module cache so the panelOpen IIFE re-runs with current localStorage
  vi.resetModules();
  const alpineStub = createAlpineStub();
  const AlpineMod = await import('alpinejs');
  vi.spyOn(AlpineMod.default, 'store').mockImplementation((name, obj) => {
    return alpineStub.store(name, obj);
  });
  const { initCollectionStore } = await import('../src/stores/collection.js');
  initCollectionStore();
  return alpineStub.store('collection');
}

describe('COLLECT-06: panel open-state contract', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Test 1 — localStorage persistence first boot: null → panelOpen=true (Pitfall 6)', async () => {
    const store = await freshStore({ localStorageSeed: {} });
    expect(store.panelOpen).toBe(true);
  });

  it('Test 2 — localStorage "false" → panelOpen=false', async () => {
    const store = await freshStore({ localStorageSeed: { tc_panel_open: 'false' } });
    expect(store.panelOpen).toBe(false);
  });

  it('Test 3 — localStorage "true" → panelOpen=true', async () => {
    const store = await freshStore({ localStorageSeed: { tc_panel_open: 'true' } });
    expect(store.panelOpen).toBe(true);
  });

  it('Test 4 — panel stays open: addToCollection() does not mutate panelOpen=false (D-01)', async () => {
    // Verify by grepping the component source — addCardOpen=false should be
    // absent after Task 4 edits. We also assert the panel x-data's
    // addToCollection path does NOT contain `panelOpen = false`.
    if (typeof globalThis.window === 'undefined') globalThis.window = {};
    const { renderAddCardPanel } = await import('../src/components/add-card-panel.js');
    const html = renderAddCardPanel();
    expect(html).not.toMatch(/panelOpen\s*=\s*false/);
    expect(html).not.toMatch(/addCardOpen\s*=\s*false/);
  });

  it('Test 4b — after addToCollection finishes: searchQuery=="", selectedCard==null, quantity==1', async () => {
    if (typeof globalThis.window === 'undefined') globalThis.window = {};
    const { renderAddCardPanel } = await import('../src/components/add-card-panel.js');
    const html = renderAddCardPanel();
    // The reset() method must clear all four fields.
    const resetMatch = html.match(/reset\(\)\s*\{[\s\S]*?\}/);
    expect(resetMatch).toBeTruthy();
    const resetBody = resetMatch[0];
    expect(resetBody).toMatch(/this\.searchQuery\s*=\s*''/);
    expect(resetBody).toMatch(/this\.selectedCard\s*=\s*null/);
    expect(resetBody).toMatch(/this\.quantity\s*=\s*1/);
    // addToCollection must call reset()
    const addMatch = html.match(/async addToCollection\(\)[\s\S]*?\}\s*,\s*reset/);
    expect(addMatch).toBeTruthy();
    expect(addMatch[0]).toMatch(/this\.reset\(\)/);
  });

  it('Test 5 — togglePanel flips panelOpen and persists to localStorage', async () => {
    const store = await freshStore({ localStorageSeed: { tc_panel_open: 'true' } });
    expect(store.panelOpen).toBe(true);
    store.togglePanel();
    expect(store.panelOpen).toBe(false);
    expect(localStorage.getItem('tc_panel_open')).toBe('false');
    store.togglePanel();
    expect(store.panelOpen).toBe(true);
    expect(localStorage.getItem('tc_panel_open')).toBe('true');
  });
});
