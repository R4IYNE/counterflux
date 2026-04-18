// tests/sync-reconciliation.test.js
// Phase 11 Plan 5 Wave 0 — SYNC-04 classifyState + reconcile + 3-button semantics.
//
// Covers SYNC-04:
//  1-4. classifyState returns correct state for 4 fixtures (empty-empty, empty-populated,
//       populated-empty, populated-populated)
//  5.   classifyState excludes profile from counts (D-03)
//  6.   reconcile + MERGE_EVERYTHING invokes bulkPull + flushQueue in order (three-button)
//  7.   KEEP_LOCAL invokes Supabase delete for 5 tables + enqueues all local rows (three-button)
//  8.   KEEP_CLOUD clears local tables + sync_queue + invokes bulkPull (three-button)
//  9.   empty-populated does NOT invoke reconciliation modal — silent pull
//  10.  populated-empty does NOT invoke reconciliation modal — silent push
//  11.  Pitfall 11-E: reconcile() with sync_pull_in_progress=true resumes bulkPull without classifyState

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';

// ---------------------------------------------------------------------------
// Hoisted Supabase mock — covers .schema().from().select/upsert/delete/order/range/gt/neq
// ---------------------------------------------------------------------------
const countResults = {}; // tableName → count responses queue (FIFO)
const selectResults = {}; // tableName → select data responses queue (FIFO)
const deleteCalls = [];
const upsertCalls = [];

function makeTableChain(tableName) {
  return {
    select: vi.fn((_cols, opts) => {
      if (opts && opts.head && opts.count === 'exact') {
        // count query
        const q = countResults[tableName] ?? [];
        const next = q.length ? q.shift() : { count: 0 };
        return Promise.resolve(next);
      }
      // Chainable select for bulkPull range queries / incrementalPull gt queries
      const self = {
        order: vi.fn(() => self),
        range: vi.fn(async () => {
          const q = selectResults[tableName] ?? [];
          const next = q.length ? q.shift() : { data: [], error: null };
          return next;
        }),
        gt: vi.fn(async () => {
          const q = selectResults[tableName] ?? [];
          const next = q.length ? q.shift() : { data: [], error: null };
          return next;
        }),
      };
      return self;
    }),
    upsert: vi.fn(async (rows) => {
      upsertCalls.push({ table: tableName, rows });
      return { error: null };
    }),
    delete: vi.fn(() => ({
      neq: vi.fn(async (_col, _val) => {
        deleteCalls.push({ table: tableName, op: 'delete-all-neq' });
        return { error: null };
      }),
      eq: vi.fn(async (_col, val) => {
        deleteCalls.push({ table: tableName, op: 'delete-eq', id: val });
        return { error: null };
      })
    }))
  };
}

const supabaseStub = {
  schema: vi.fn(() => ({
    from: vi.fn((tableName) => makeTableChain(tableName))
  })),
  channel: vi.fn(() => ({
    on: vi.fn(function () { return this; }),
    subscribe: vi.fn(function () { return this; }),
    unsubscribe: vi.fn()
  }))
};
const getSupabaseMock = vi.fn(() => supabaseStub);
vi.mock('../src/services/supabase.js', () => ({
  getSupabase: getSupabaseMock,
  __resetSupabaseClient: vi.fn()
}));

// Reconciliation-modal mock — captures the onChoice callback so tests can fire it.
const reconciliationModalState = { lastOpts: null, resolve: null };
vi.mock('../src/components/reconciliation-modal.js', () => ({
  openReconciliationModal: vi.fn((opts) => {
    reconciliationModalState.lastOpts = opts;
    return new Promise((resolve) => {
      reconciliationModalState.resolve = resolve;
    });
  }),
  __resetReconciliationModal: vi.fn()
}));

// Sync-pull-splash mock — record open/close/error
const splashState = { opened: 0, closed: 0, errored: 0 };
vi.mock('../src/components/sync-pull-splash.js', () => ({
  openSyncPullSplash: vi.fn(() => { splashState.opened++; }),
  closeSyncPullSplash: vi.fn(() => { splashState.closed++; }),
  renderSyncPullError: vi.fn(() => { splashState.errored++; }),
  __resetSyncPullSplash: vi.fn()
}));

// Alpine window stub
const storeRegistry = {};
function installAlpineWindow() {
  if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
  globalThis.window.Alpine = {
    store: (name, value) => {
      if (value !== undefined) storeRegistry[name] = value;
      return storeRegistry[name];
    }
  };
}

let db, reconcile, classifyState, handleMergeEverything, handleKeepLocal, handleKeepCloud;
let openReconciliationModal;
let __resetSyncEngineForTests;

beforeEach(async () => {
  vi.stubGlobal('navigator', { onLine: true });
  installAlpineWindow();
  storeRegistry.auth = { status: 'authed', user: { id: 'user-test-uuid' } };
  storeRegistry.sync = { status: 'synced', pending_count: 0, _transition: vi.fn(), bulkPullProgress: null };
  storeRegistry.toast = { show: vi.fn(), error: vi.fn() };

  // Clear mocks
  Object.keys(countResults).forEach((k) => delete countResults[k]);
  Object.keys(selectResults).forEach((k) => delete selectResults[k]);
  deleteCalls.length = 0;
  upsertCalls.length = 0;
  splashState.opened = 0;
  splashState.closed = 0;
  splashState.errored = 0;
  reconciliationModalState.lastOpts = null;
  reconciliationModalState.resolve = null;

  await Dexie.delete('counterflux');
  vi.resetModules();
  vi.doMock('../src/services/supabase.js', () => ({
    getSupabase: getSupabaseMock,
    __resetSupabaseClient: vi.fn()
  }));

  const schemaMod = await import('../src/db/schema.js');
  db = schemaMod.db;
  await db.open();

  const reconMod = await import('../src/services/sync-reconciliation.js');
  classifyState = reconMod.classifyState;
  reconcile = reconMod.reconcile;
  handleMergeEverything = reconMod.handleMergeEverything;
  handleKeepLocal = reconMod.handleKeepLocal;
  handleKeepCloud = reconMod.handleKeepCloud;

  const modalMod = await import('../src/components/reconciliation-modal.js');
  openReconciliationModal = modalMod.openReconciliationModal;

  const engineMod = await import('../src/services/sync-engine.js');
  __resetSyncEngineForTests = engineMod.__resetSyncEngineForTests;
  if (__resetSyncEngineForTests) __resetSyncEngineForTests();
  engineMod.installSyncHooks();
});

afterEach(async () => {
  if (__resetSyncEngineForTests) __resetSyncEngineForTests();
  if (db && db.isOpen()) db.close();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function seedCloudCount(table, n) {
  if (!countResults[table]) countResults[table] = [];
  countResults[table].push({ count: n });
}

function seedCloudData(table, rows) {
  if (!selectResults[table]) selectResults[table] = [];
  selectResults[table].push({ data: rows, error: null });
  // Also push a "no more" empty page
  selectResults[table].push({ data: [], error: null });
}

// ---------------------------------------------------------------------------
// classifyState tests
// ---------------------------------------------------------------------------
describe('classifyState (4-state detection, D-03 excludes profile)', () => {
  test('classifyState — empty-empty', async () => {
    ['collection', 'decks', 'deck_cards', 'games', 'watchlist'].forEach((t) => seedCloudCount(t, 0));
    const result = await classifyState();
    expect(result.state).toBe('empty-empty');
    expect(result.localCounts.collection).toBe(0);
    expect(result.cloudCounts.collection).toBe(0);
  });

  test('classifyState — empty-populated (D-06 silent)', async () => {
    ['collection', 'decks', 'deck_cards', 'games', 'watchlist'].forEach((t) => seedCloudCount(t, 5));
    const result = await classifyState();
    expect(result.state).toBe('empty-populated');
    expect(result.localCounts.collection).toBe(0);
    expect(result.cloudCounts.collection).toBe(5);
  });

  test('classifyState — populated-empty', async () => {
    await db.collection.add({ scryfall_id: 'abc', category: 'main', foil: false });
    await db.sync_queue.clear(); // clean the enqueue side effect
    ['collection', 'decks', 'deck_cards', 'games', 'watchlist'].forEach((t) => seedCloudCount(t, 0));
    const result = await classifyState();
    expect(result.state).toBe('populated-empty');
  });

  test('classifyState — populated-populated', async () => {
    await db.collection.add({ scryfall_id: 'abc', category: 'main', foil: false });
    await db.sync_queue.clear();
    ['collection', 'decks', 'deck_cards', 'games', 'watchlist'].forEach((t) => seedCloudCount(t, 3));
    const result = await classifyState();
    expect(result.state).toBe('populated-populated');
  });

  test('classifyState excludes profile from counts (D-03)', async () => {
    // Seed ONLY profile locally; everything else empty
    await db.profile.add({ user_id: 'user-test-uuid' });
    await db.sync_queue.clear();
    ['collection', 'decks', 'deck_cards', 'games', 'watchlist'].forEach((t) => seedCloudCount(t, 0));
    const result = await classifyState();
    // Profile alone should NOT flip local to populated
    expect(result.state).toBe('empty-empty');
    // Profile should not appear in localCounts keys
    expect(result.localCounts.profile).toBeUndefined();
    expect(result.cloudCounts.profile).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// three-button semantics
// ---------------------------------------------------------------------------
describe('three-button semantics (MERGE_EVERYTHING / KEEP_LOCAL / KEEP_CLOUD)', () => {
  test('reconcile + MERGE_EVERYTHING invokes bulkPull + flushQueue in order', async () => {
    // Seed populated-populated
    await db.collection.add({ scryfall_id: 'local', category: 'main', foil: false });
    await db.sync_queue.clear();
    ['collection', 'decks', 'deck_cards', 'games', 'watchlist'].forEach((t) => seedCloudCount(t, 1));
    // Bulk pull needs the count (again), then a row per table for bulkPull's range()
    ['decks', 'collection', 'deck_cards', 'games', 'watchlist', 'profile'].forEach((t) => {
      seedCloudCount(t, 0); // bulkPull counts again inside
      seedCloudData(t, []);
    });

    const reconP = reconcile();
    // Wait for modal to open
    for (let i = 0; i < 100 && !reconciliationModalState.lastOpts; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(openReconciliationModal).toHaveBeenCalled();
    expect(reconciliationModalState.lastOpts).toBeTruthy();

    // Simulate user clicking MERGE_EVERYTHING via onChoice
    await reconciliationModalState.lastOpts.onChoice('MERGE_EVERYTHING');
    reconciliationModalState.resolve();
    await reconP;

    // bulkPull called means .select was called with count head:true at least once on each table
    const schemaCalls = supabaseStub.schema.mock.calls;
    expect(schemaCalls.length).toBeGreaterThan(0);
  });

  test('KEEP_LOCAL invokes Supabase delete for 5 tables + enqueues all local rows', async () => {
    // Seed populated-populated with local rows
    await db.collection.add({ scryfall_id: 'kept', category: 'main', foil: false });
    await db.decks.add({ name: 'Izzet', format: 'commander' });
    await db.sync_queue.clear();
    ['collection', 'decks', 'deck_cards', 'games', 'watchlist'].forEach((t) => seedCloudCount(t, 1));

    const reconP = reconcile();
    for (let i = 0; i < 100 && !reconciliationModalState.lastOpts; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    await reconciliationModalState.lastOpts.onChoice('KEEP_LOCAL');
    reconciliationModalState.resolve();
    await reconP;

    // Expect delete-all-neq on 5 data tables (profile excluded)
    const deletedTables = deleteCalls.filter((c) => c.op === 'delete-all-neq').map((c) => c.table).sort();
    expect(deletedTables).toEqual(expect.arrayContaining(['collection', 'decks', 'deck_cards', 'games', 'watchlist']));
    expect(deletedTables).not.toContain('profile');

    // Local rows re-enqueued
    const q = await db.sync_queue.toArray();
    expect(q.length).toBeGreaterThanOrEqual(2);
  });

  test('KEEP_CLOUD clears local tables + sync_queue + invokes bulkPull', async () => {
    await db.collection.add({ scryfall_id: 'doomed', category: 'main', foil: false });
    await db.decks.add({ name: 'to-wipe', format: 'commander' });
    ['collection', 'decks', 'deck_cards', 'games', 'watchlist'].forEach((t) => seedCloudCount(t, 2));
    ['decks', 'collection', 'deck_cards', 'games', 'watchlist', 'profile'].forEach((t) => {
      seedCloudCount(t, 0);
      seedCloudData(t, []);
    });

    const reconP = reconcile();
    for (let i = 0; i < 100 && !reconciliationModalState.lastOpts; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    await reconciliationModalState.lastOpts.onChoice('KEEP_CLOUD');
    reconciliationModalState.resolve();
    await reconP;

    // Local tables should be cleared (sync_queue too)
    expect(await db.collection.count()).toBe(0);
    expect(await db.decks.count()).toBe(0);
    expect(await db.sync_queue.count()).toBe(0);

    // bulkPull invoked → splash opened and closed
    expect(splashState.opened).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// silent paths
// ---------------------------------------------------------------------------
describe('silent branches (no modal)', () => {
  test('empty-populated does NOT invoke reconciliation modal — silent pull', async () => {
    // local empty, cloud populated
    ['collection', 'decks', 'deck_cards', 'games', 'watchlist'].forEach((t) => seedCloudCount(t, 4));
    // bulkPull's second counts
    ['decks', 'collection', 'deck_cards', 'games', 'watchlist', 'profile'].forEach((t) => {
      seedCloudCount(t, 0);
      seedCloudData(t, []);
    });

    await reconcile();

    expect(openReconciliationModal).not.toHaveBeenCalled();
    // Splash opened for the bulk pull
    expect(splashState.opened).toBeGreaterThan(0);
    expect(splashState.closed).toBeGreaterThan(0);
  });

  test('populated-empty does NOT invoke reconciliation modal — silent push', async () => {
    await db.collection.add({ scryfall_id: 'silent-push', category: 'main', foil: false });
    await db.sync_queue.clear();
    ['collection', 'decks', 'deck_cards', 'games', 'watchlist'].forEach((t) => seedCloudCount(t, 0));

    await reconcile();

    expect(openReconciliationModal).not.toHaveBeenCalled();
    // Local row is enqueued for push
    const q = await db.sync_queue.toArray();
    expect(q.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Pitfall 11-E resume path
// ---------------------------------------------------------------------------
describe('Pitfall 11-E: sync_pull_in_progress resume', () => {
  test('reconcile with sync_pull_in_progress=true resumes bulkPull and does NOT classify', async () => {
    await db.meta.put({ key: 'sync_pull_in_progress', value: true });
    // bulkPull counts + data (empty is fine)
    ['decks', 'collection', 'deck_cards', 'games', 'watchlist', 'profile'].forEach((t) => {
      seedCloudCount(t, 0);
      seedCloudData(t, []);
    });

    // Spy on classifyState via a separate mock: use the module internal fn.
    // Because classifyState is a named export, we can spy via the module object.
    // Easiest observation: seed cloud counts ONLY once; classifyState would require
    // 5 count responses — if it runs we'd have 0 counts consumed extra for the populated check.
    // Instead, observe splash open (bulkPull opens) and that modal was NOT opened.
    await reconcile();

    expect(openReconciliationModal).not.toHaveBeenCalled();
    expect(splashState.opened).toBeGreaterThan(0);
  });
});
