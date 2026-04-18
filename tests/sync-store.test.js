// tests/sync-store.test.js
// Phase 11 Plan 2 — sync store state machine contract tests (SYNC-07, D-08, D-10, D-11).
//
// Covers:
//   1. Initial state reads navigator.onLine (default: synced when online, offline when offline)
//   2. window 'offline' event flips store.status to 'offline'
//   3. window 'online' + auth='authed' → 'syncing' (not directly synced; Plan 11-04 wires flushQueue)
//   4. pending_count field is reactive (set and read)
//   5. retry() from error → transitions to 'syncing' (stub behaviour)
//   6. Invalid transition is rejected — e.g. offline → synced (must pass through syncing)
//
// Note: Uses the Alpine.store mock pattern from tests/auth-store.test.js to avoid pulling
// in the full Alpine runtime (which is heavy and doesn't flush reactively in node env).

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// --- Hoisted Alpine mock ----------------------------------------------------
const storeRegistry = {};
vi.mock('alpinejs', () => ({
  default: {
    store: (name, value) => {
      if (value !== undefined) storeRegistry[name] = value;
      return storeRegistry[name];
    },
  },
}));

// --- Test environment shims ------------------------------------------------
function ensureWindow() {
  if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
  // Install our own addEventListener store so we can dispatch synthetically
  if (!globalThis.window.__listeners) {
    globalThis.window.__listeners = {};
    globalThis.window.addEventListener = (event, cb) => {
      (globalThis.window.__listeners[event] ||= []).push(cb);
    };
    globalThis.window.removeEventListener = (event, cb) => {
      const list = globalThis.window.__listeners[event];
      if (list) {
        const i = list.indexOf(cb);
        if (i >= 0) list.splice(i, 1);
      }
    };
    globalThis.window.dispatchEvent = (evt) => {
      const list = globalThis.window.__listeners[evt.type] || [];
      list.forEach(cb => cb(evt));
      return true;
    };
  }
}

function clearListeners() {
  if (globalThis.window && globalThis.window.__listeners) {
    globalThis.window.__listeners = {};
  }
}

// --- Imports under test ----------------------------------------------------
let initSyncStore, __resetSyncStoreForTests;

beforeEach(async () => {
  ensureWindow();
  clearListeners();
  for (const k of Object.keys(storeRegistry)) delete storeRegistry[k];
  // Seed auth as authed so online→syncing transitions are allowed
  storeRegistry.auth = { status: 'authed' };
  // Default: online
  vi.stubGlobal('navigator', { onLine: true });

  vi.resetModules();
  vi.doMock('alpinejs', () => ({
    default: {
      store: (name, value) => {
        if (value !== undefined) storeRegistry[name] = value;
        return storeRegistry[name];
      },
    },
  }));
  const mod = await import('../src/stores/sync.js');
  initSyncStore = mod.initSyncStore;
  __resetSyncStoreForTests = mod.__resetSyncStoreForTests;
  __resetSyncStoreForTests();
});

afterEach(() => {
  if (__resetSyncStoreForTests) __resetSyncStoreForTests();
  vi.unstubAllGlobals();
});

describe('sync store state machine (SYNC-07)', () => {
  test('initial state is synced when online', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    initSyncStore();
    // Let the microtask queued init() run
    await Promise.resolve();
    await Promise.resolve();
    expect(storeRegistry.sync.status).toBe('synced');
  });

  test('initial state is offline when navigator.onLine is false', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    initSyncStore();
    await Promise.resolve();
    await Promise.resolve();
    expect(storeRegistry.sync.status).toBe('offline');
  });

  test('navigator offline event flips status to offline', async () => {
    initSyncStore();
    await Promise.resolve();
    await Promise.resolve();
    // Seed: starting from synced, fire offline
    globalThis.window.dispatchEvent({ type: 'offline' });
    expect(storeRegistry.sync.status).toBe('offline');
  });

  test('navigator online + authed flips offline → syncing (NOT directly synced)', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    initSyncStore();
    await Promise.resolve();
    await Promise.resolve();
    expect(storeRegistry.sync.status).toBe('offline');

    storeRegistry.auth = { status: 'authed' };
    globalThis.window.dispatchEvent({ type: 'online' });
    expect(storeRegistry.sync.status).toBe('syncing');
  });

  test('pending_count field is reactive (get + set)', async () => {
    initSyncStore();
    await Promise.resolve();
    expect(storeRegistry.sync.pending_count).toBe(0);
    storeRegistry.sync.pending_count = 5;
    expect(storeRegistry.sync.pending_count).toBe(5);
  });

  test('retry() from error transitions to syncing (stub impl)', async () => {
    initSyncStore();
    await Promise.resolve();
    storeRegistry.sync.status = 'error';
    await storeRegistry.sync.retry('fake-queue-id');
    expect(storeRegistry.sync.status).toBe('syncing');
  });

  test('invalid transition is rejected (offline → synced direct jump blocked)', async () => {
    initSyncStore();
    await Promise.resolve();
    storeRegistry.sync.status = 'offline';
    // Direct jump offline → synced is not in VALID_TRANSITIONS; only offline → syncing allowed.
    storeRegistry.sync._transition('synced');
    expect(storeRegistry.sync.status).toBe('offline');
  });

  test('flush() is callable as a stub without throwing', async () => {
    initSyncStore();
    await Promise.resolve();
    await expect(storeRegistry.sync.flush()).resolves.toBeUndefined();
  });

  test('discard() is callable as a stub without throwing', async () => {
    initSyncStore();
    await Promise.resolve();
    await expect(storeRegistry.sync.discard('fake-id')).resolves.toBeUndefined();
  });

  test('getTooltip returns correct copy for each state', async () => {
    initSyncStore();
    await Promise.resolve();
    storeRegistry.sync.status = 'synced';
    storeRegistry.sync.last_synced_at = null;
    expect(storeRegistry.sync.getTooltip()).toMatch(/Last synced/);

    storeRegistry.sync.status = 'syncing';
    storeRegistry.sync.pending_count = 3;
    expect(storeRegistry.sync.getTooltip()).toBe('3 pending changes.');

    storeRegistry.sync.status = 'offline';
    expect(storeRegistry.sync.getTooltip()).toMatch(/No connection/);

    storeRegistry.sync.status = 'error';
    expect(storeRegistry.sync.getTooltip()).toMatch(/Sync failed/);
  });
});
