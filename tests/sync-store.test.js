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

// --- Hoisted sync-engine + db mocks (Plan 11-04 — retry/flush delegate) ----
const scheduleFlushMock = vi.fn();
const flushQueueMock = vi.fn(async () => {});
vi.mock('../src/services/sync-engine.js', () => ({
  flushQueue: flushQueueMock,
  scheduleFlush: scheduleFlushMock,
}));

// In-memory `db.sync_conflicts` + `db.sync_queue` stand-ins
const conflictStore = new Map();
const queueAdds = [];
vi.mock('../src/db/schema.js', () => ({
  db: {
    sync_conflicts: {
      get: vi.fn(async (id) => conflictStore.get(id) || undefined),
      delete: vi.fn(async (id) => { conflictStore.delete(id); }),
      count: vi.fn(async () => conflictStore.size),
    },
    sync_queue: {
      add: vi.fn(async (entry) => { queueAdds.push(entry); return queueAdds.length; }),
      where: () => ({ equals: () => ({ count: async () => 0 }) }),
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
  storeRegistry.auth = { status: 'authed', user: { id: 'user-test-uuid' } };
  // Default: online
  vi.stubGlobal('navigator', { onLine: true });

  conflictStore.clear();
  queueAdds.length = 0;
  scheduleFlushMock.mockClear();
  flushQueueMock.mockClear();

  vi.resetModules();
  vi.doMock('alpinejs', () => ({
    default: {
      store: (name, value) => {
        if (value !== undefined) storeRegistry[name] = value;
        return storeRegistry[name];
      },
    },
  }));
  vi.doMock('../src/services/sync-engine.js', () => ({
    flushQueue: flushQueueMock,
    scheduleFlush: scheduleFlushMock,
  }));
  vi.doMock('../src/db/schema.js', () => ({
    db: {
      sync_conflicts: {
        get: vi.fn(async (id) => conflictStore.get(id) || undefined),
        delete: vi.fn(async (id) => { conflictStore.delete(id); }),
        count: vi.fn(async () => conflictStore.size),
      },
      sync_queue: {
        add: vi.fn(async (entry) => { queueAdds.push(entry); return queueAdds.length; }),
        where: () => ({ equals: () => ({ count: async () => 0 }) }),
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

  test('retry() from error re-enqueues the conflict and transitions to syncing', async () => {
    initSyncStore();
    await Promise.resolve();
    // Seed a dead-lettered conflict (Plan 11-04 engine wiring — retry
    // re-enqueues into sync_queue, deletes the sync_conflicts row, and
    // schedules a flush). Status must flip from error → syncing.
    conflictStore.set(42, {
      id: 42, table_name: 'decks', op: 'put', row_id: 'd-abc',
      payload: { id: 'd-abc', name: 'Retry me' },
      error_code: '403', error_message: 'RLS rejected', detected_at: Date.now()
    });
    storeRegistry.sync.status = 'error';
    await storeRegistry.sync.retry(42);
    expect(storeRegistry.sync.status).toBe('syncing');
    // Re-enqueued with current user_id
    expect(queueAdds.length).toBe(1);
    expect(queueAdds[0].user_id).toBe('user-test-uuid');
    expect(queueAdds[0].row_id).toBe('d-abc');
    // Conflict cleared + flush scheduled
    expect(conflictStore.has(42)).toBe(false);
    expect(scheduleFlushMock).toHaveBeenCalled();
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
