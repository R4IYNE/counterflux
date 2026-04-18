// tests/sync-bulk-pull.test.js
// Phase 11 Plan 5 Wave 0 — SYNC-04 bulk pull with chunking + progress + Pitfall 11-E flag.
//
//  1. bulkPull sets sync_pull_in_progress meta at start
//  2. bulkPull (success) — clearBulkPullFlag() drops the flag
//  3. bulkPull emits onProgress events
//  4. bulkPull writes to Alpine.store('sync').bulkPullProgress when no callback
//  5. bulkPull preserves partial data on BulkPullError (carries pulled/total)
//  6. bulkPull FK order: decks before deck_cards
//  7. bulkPull chunk size = 500 rows per request
//  8. Pitfall 11-E: isBulkPullInProgress() reflects meta flag lifecycle

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';

// ---------------------------------------------------------------------------
// Supabase mock with ordered select chains
// ---------------------------------------------------------------------------
const countResults = {}; // tableName → FIFO queue of {count}
const selectResults = {}; // tableName → FIFO queue of {data, error} for range() calls
const rangeCalls = []; // record range(from, to) invocations

function makeTableChain(tableName) {
  return {
    select: vi.fn((_cols, opts) => {
      if (opts && opts.head && opts.count === 'exact') {
        const q = countResults[tableName] ?? [];
        const next = q.length ? q.shift() : { count: 0 };
        return Promise.resolve(next);
      }
      const self = {
        order: vi.fn(() => self),
        range: vi.fn(async (from, to) => {
          rangeCalls.push({ table: tableName, from, to });
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
    })
  };
}

const supabaseStub = {
  schema: vi.fn(() => ({
    from: vi.fn((tableName) => makeTableChain(tableName))
  }))
};

vi.mock('../src/services/supabase.js', () => ({
  getSupabase: vi.fn(() => supabaseStub),
  __resetSupabaseClient: vi.fn()
}));

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

let db;
let bulkPull, clearBulkPullFlag, isBulkPullInProgress;
let CHUNK_SIZE;

beforeEach(async () => {
  vi.stubGlobal('navigator', { onLine: true });
  installAlpineWindow();
  storeRegistry.auth = { status: 'authed', user: { id: 'user-test-uuid' } };
  storeRegistry.sync = { status: 'synced', _transition: vi.fn(), bulkPullProgress: null };

  // Reset mock state
  Object.keys(countResults).forEach((k) => delete countResults[k]);
  Object.keys(selectResults).forEach((k) => delete selectResults[k]);
  rangeCalls.length = 0;

  await Dexie.delete('counterflux');
  vi.resetModules();

  const schemaMod = await import('../src/db/schema.js');
  db = schemaMod.db;
  await db.open();

  const pullMod = await import('../src/services/sync-pull.js');
  bulkPull = pullMod.bulkPull;
  clearBulkPullFlag = pullMod.clearBulkPullFlag;
  isBulkPullInProgress = pullMod.isBulkPullInProgress;
  CHUNK_SIZE = pullMod.CHUNK_SIZE;

  const engineMod = await import('../src/services/sync-engine.js');
  if (engineMod.__resetSyncEngineForTests) engineMod.__resetSyncEngineForTests();
});

afterEach(async () => {
  if (db && db.isOpen()) db.close();
  vi.unstubAllGlobals();
});

function seedEmptyCloud() {
  ['collection', 'decks', 'deck_cards', 'games', 'watchlist', 'profile'].forEach((t) => {
    countResults[t] = [{ count: 0 }];
  });
}

describe('bulkPull — sync_pull_in_progress flag lifecycle (Pitfall 11-E)', () => {
  test('bulkPull sets sync_pull_in_progress meta at start', async () => {
    seedEmptyCloud();
    // Install an onProgress spy that checks the flag state during 'pulling' phase
    let flagDuringRun = null;
    await bulkPull(async (ev) => {
      if (ev.phase === 'counting' && flagDuringRun === null) {
        const meta = await db.meta.get('sync_pull_in_progress');
        flagDuringRun = meta?.value === true;
      }
    });
    expect(flagDuringRun).toBe(true);
  });

  test('bulkPull (success) — clearBulkPullFlag() drops the flag', async () => {
    seedEmptyCloud();
    await bulkPull();
    // bulkPull itself leaves the flag set per the contract (caller clears on success)
    expect(await isBulkPullInProgress()).toBe(true);
    await clearBulkPullFlag();
    expect(await isBulkPullInProgress()).toBe(false);
  });

  test('Pitfall 11-E: isBulkPullInProgress() returns true between start and clearBulkPullFlag()', async () => {
    expect(await isBulkPullInProgress()).toBe(false);
    seedEmptyCloud();
    await bulkPull();
    expect(await isBulkPullInProgress()).toBe(true);
    await clearBulkPullFlag();
    expect(await isBulkPullInProgress()).toBe(false);
  });
});

describe('bulkPull — progress emission', () => {
  test('bulkPull emits onProgress events', async () => {
    seedEmptyCloud();
    const events = [];
    await bulkPull((ev) => events.push(ev));

    // At minimum: counting event and complete event
    const phases = events.map((e) => e.phase);
    expect(phases).toContain('counting');
    expect(phases).toContain('complete');
  });

  test('bulkPull writes to Alpine.store(sync).bulkPullProgress when no callback', async () => {
    seedEmptyCloud();
    // Inject a row so that 'pulling' phase fires with table metadata
    countResults.collection = [{ count: 1 }];
    selectResults.collection = [
      { data: [{ id: 'r1', scryfall_id: 'x', updated_at: new Date().toISOString() }], error: null },
      { data: [], error: null }
    ];

    await bulkPull();
    // bulkPullProgress should have been written at least once
    // It's overwritten per-chunk; at end of pull it may be 'complete' marker.
    // Acceptable: the store was mutated from its initial null.
    expect(storeRegistry.sync.bulkPullProgress).not.toBeNull();
  });
});

describe('bulkPull — chunking + FK order', () => {
  test('bulkPull FK order: decks before deck_cards', async () => {
    countResults.decks = [{ count: 1 }];
    countResults.deck_cards = [{ count: 1 }];
    ['collection', 'games', 'watchlist', 'profile'].forEach((t) => { countResults[t] = [{ count: 0 }]; });
    selectResults.decks = [
      { data: [{ id: 'd1', name: 'deck', updated_at: new Date().toISOString() }], error: null },
      { data: [], error: null }
    ];
    selectResults.deck_cards = [
      { data: [{ id: 'dc1', deck_id: 'd1', scryfall_id: 'sc1', updated_at: new Date().toISOString() }], error: null },
      { data: [], error: null }
    ];

    await bulkPull();

    const decksIdx = rangeCalls.findIndex((c) => c.table === 'decks');
    const deckCardsIdx = rangeCalls.findIndex((c) => c.table === 'deck_cards');
    expect(decksIdx).toBeGreaterThanOrEqual(0);
    expect(deckCardsIdx).toBeGreaterThanOrEqual(0);
    expect(decksIdx).toBeLessThan(deckCardsIdx);
  });

  test('bulkPull chunk size = 500 rows per request', () => {
    expect(CHUNK_SIZE).toBe(500);
  });

  test('bulkPull FK order range calls use 0..499 (CHUNK_SIZE - 1)', async () => {
    countResults.decks = [{ count: 500 }];
    ['collection', 'deck_cards', 'games', 'watchlist', 'profile'].forEach((t) => { countResults[t] = [{ count: 0 }]; });
    // Fake 500 rows for decks, then empty
    const decks500 = Array.from({ length: 500 }, (_, i) => ({ id: `d${i}`, name: `n${i}`, updated_at: new Date().toISOString() }));
    selectResults.decks = [
      { data: decks500, error: null },
      { data: [], error: null }
    ];
    await bulkPull();

    const decksCall = rangeCalls.find((c) => c.table === 'decks');
    expect(decksCall.from).toBe(0);
    expect(decksCall.to).toBe(499);
  });
});

describe('bulkPull — error path (BulkPullError carries partial context)', () => {
  test('bulkPull preserves partial data on BulkPullError (carries pulled/total)', async () => {
    countResults.decks = [{ count: 2 }];
    ['collection', 'deck_cards', 'games', 'watchlist', 'profile'].forEach((t) => { countResults[t] = [{ count: 0 }]; });
    selectResults.decks = [
      { data: null, error: { code: '500', message: 'server exploded' } }
    ];

    let caught = null;
    try {
      await bulkPull();
    } catch (err) {
      caught = err;
    }
    expect(caught).not.toBeNull();
    expect(caught.name || caught.constructor?.name).toMatch(/BulkPullError|Error/);
    expect(caught.table).toBe('decks');
    expect(caught.total).toBe(2);
    expect(typeof caught.pulled).toBe('number');
  });
});
