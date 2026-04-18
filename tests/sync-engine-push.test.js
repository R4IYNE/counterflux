// tests/sync-engine-push.test.js
// Phase 11 Plan 4 Wave 0 — sync-engine push pipeline + outbox hook + error classification.
//
// Covers SYNC-02 (hook outbox) and SYNC-03 (batched push + classifyError matrix).
//
// 1.  creating hook enqueues sync_queue row with payload + user_id tag
// 2.  updating hook enqueues with op=put + merged payload
// 3.  deleting hook enqueues with op=del + payload=null
// 4.  non-synced tables (cards / meta / price_history / precons_cache) do NOT enqueue
// 5-9.  classifyError matrix: 429 / 5xx / network / timeout → transient;
//       400 / 401 / 403 / 409 / 422 / PGRST301 / SQLSTATE 42501 / unknown → permanent
// 10. flushQueue groups by table in FK-safe order (collection, decks, deck_cards, games, watchlist, profile)
// 11. flushQueue dedup — 3 put ops on same row_id → 1 upsert call with latest payload
// 12. flushQueue success deletes queue entries
// 13. flushQueue success stamps synced_at on source row (under suppression)
// 14. flushQueue permanent error dead-letters to sync_conflicts AND deletes queue entry
// 15. flushQueue transient error increments attempts (stays in queue)
// 16. attempts reaches 3 → dead-letter even if classified transient

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';

// ---------------------------------------------------------------------------
// Hoisted Supabase mock (before module import)
// ---------------------------------------------------------------------------
const upsertResults = []; // queue of results to return from upsert() in order
const upsertCalls = [];   // log of (tableName, rows) for assertions
const deleteResults = [];
const deleteCalls = [];

function makeUpsertChain(tableName) {
  return {
    upsert: vi.fn(async (rows) => {
      upsertCalls.push({ table: tableName, rows });
      const next = upsertResults.length ? upsertResults.shift() : { error: null };
      return next;
    }),
    delete: vi.fn(() => ({
      eq: vi.fn(async (_col, rowId) => {
        deleteCalls.push({ table: tableName, rowId });
        const next = deleteResults.length ? deleteResults.shift() : { error: null };
        return next;
      })
    }))
  };
}

const supabaseStub = {
  schema: vi.fn((_schemaName) => ({
    from: vi.fn((tableName) => makeUpsertChain(tableName))
  }))
};
const getSupabaseMock = vi.fn(() => supabaseStub);
vi.mock('../src/services/supabase.js', () => ({
  getSupabase: getSupabaseMock,
  __resetSupabaseClient: vi.fn()
}));

// ---------------------------------------------------------------------------
// Alpine store registry (auth lookup for currentUserId)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Imports under test (loaded after mocks installed in beforeEach)
// ---------------------------------------------------------------------------
let installSyncHooks, flushQueue, classifyError, withHooksSuppressed, __resetSyncEngineForTests;
let db;

beforeEach(async () => {
  // Reset navigator.onLine = true
  vi.stubGlobal('navigator', { onLine: true });
  installAlpineWindow();
  storeRegistry.auth = { status: 'authed', user: { id: 'user-test-uuid' } };
  storeRegistry.sync = { status: 'synced', pending_count: 0, _transition: vi.fn(), last_error: null, last_synced_at: null };

  upsertResults.length = 0;
  upsertCalls.length = 0;
  deleteResults.length = 0;
  deleteCalls.length = 0;

  // Fresh indexeddb per test
  await Dexie.delete('counterflux');

  vi.resetModules();
  // Re-apply mock after resetModules
  vi.doMock('../src/services/supabase.js', () => ({
    getSupabase: getSupabaseMock,
    __resetSupabaseClient: vi.fn()
  }));

  const schemaMod = await import('../src/db/schema.js');
  db = schemaMod.db;
  // Make sure db is open before installing hooks
  await db.open();

  const engineMod = await import('../src/services/sync-engine.js');
  installSyncHooks = engineMod.installSyncHooks;
  flushQueue = engineMod.flushQueue;
  classifyError = engineMod.classifyError;
  withHooksSuppressed = engineMod.withHooksSuppressed;
  __resetSyncEngineForTests = engineMod.__resetSyncEngineForTests;
  if (__resetSyncEngineForTests) __resetSyncEngineForTests();
  installSyncHooks();
});

afterEach(async () => {
  if (__resetSyncEngineForTests) __resetSyncEngineForTests();
  if (db && db.isOpen()) db.close();
  vi.unstubAllGlobals();
});

// ===========================================================================
// Outbox hooks — Dexie creating / updating / deleting
// ===========================================================================

describe('sync-engine push: outbox hooks', () => {
  test('creating hook enqueues sync_queue row with payload + user_id tag', async () => {
    await db.collection.add({ scryfall_id: 'abc', category: 'main', foil: false });
    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(1);
    expect(queue[0].table_name).toBe('collection');
    expect(queue[0].op).toBe('put');
    expect(queue[0].user_id).toBe('user-test-uuid');
    expect(queue[0].payload.scryfall_id).toBe('abc');
    expect(queue[0].attempts).toBe(0);
    expect(typeof queue[0].created_at).toBe('number');
  });

  test('updating hook enqueues with op=put + merged payload', async () => {
    const id = crypto.randomUUID();
    await db.decks.add({ id, name: 'Izzet Storm', format: 'commander' });
    // Clear the enqueue from the create
    await db.sync_queue.clear();

    await db.decks.update(id, { name: 'Izzet Phoenix' });
    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(1);
    expect(queue[0].op).toBe('put');
    expect(queue[0].table_name).toBe('decks');
    expect(queue[0].row_id).toBe(id);
    expect(queue[0].payload.name).toBe('Izzet Phoenix');
  });

  test('deleting hook enqueues with op=del + payload=null', async () => {
    const id = crypto.randomUUID();
    await db.watchlist.add({ id, scryfall_id: 'xyz' });
    await db.sync_queue.clear();

    await db.watchlist.delete(id);
    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(1);
    expect(queue[0].op).toBe('del');
    expect(queue[0].table_name).toBe('watchlist');
    expect(queue[0].row_id).toBe(id);
    expect(queue[0].payload).toBe(null);
  });

  test('non-synced tables (cards / meta / price_history / precons_cache) do NOT enqueue', async () => {
    await db.cards.add({ id: 'card-id-1', name: 'Counterspell', oracle_id: 'oid', set: 'lea' });
    await db.meta.put({ key: 'some-key', value: 'some-value' });
    await db.price_history.add({ scryfall_id: 'card-id-1', date: '2026-04-18' });
    await db.precons_cache.add({ code: 'cmm', set_type: 'masters' });

    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(0);
  });
});

// ===========================================================================
// classifyError matrix
// ===========================================================================

describe('sync-engine push: classifyError matrix (D-10)', () => {
  test('classifyError: 429 → transient', () => {
    expect(classifyError({ code: '429', message: 'Too Many Requests' })).toBe('transient');
  });

  test('classifyError: 500 / 502 / 503 → transient', () => {
    expect(classifyError({ code: '500', message: 'Internal Server Error' })).toBe('transient');
    expect(classifyError({ code: '502', message: 'Bad Gateway' })).toBe('transient');
    expect(classifyError({ code: '503', message: 'Service Unavailable' })).toBe('transient');
  });

  test('classifyError: network / timeout / fetch fail → transient (by message regex when no code)', () => {
    expect(classifyError({ message: 'network error' })).toBe('transient');
    expect(classifyError({ message: 'fetch failed' })).toBe('transient');
    expect(classifyError({ message: 'Request timeout' })).toBe('transient');
    expect(classifyError({ code: 'network', message: '' })).toBe('transient');
  });

  test('classifyError: 400 / 401 / 403 / 409 / 422 → permanent', () => {
    expect(classifyError({ code: '400' })).toBe('permanent');
    expect(classifyError({ code: '401' })).toBe('permanent');
    expect(classifyError({ code: '403' })).toBe('permanent');
    expect(classifyError({ code: '409' })).toBe('permanent');
    expect(classifyError({ code: '422' })).toBe('permanent');
  });

  test('classifyError: PGRST301 → permanent (auth rejection)', () => {
    expect(classifyError({ code: 'PGRST301', message: 'JWT expired' })).toBe('permanent');
    expect(classifyError({ code: 'PGRST204', message: 'column missing' })).toBe('permanent');
  });

  test('classifyError: SQLSTATE 42501 (RLS) + 22xxx + 23xxx → permanent', () => {
    expect(classifyError({ code: '42501', message: 'RLS violation' })).toBe('permanent');
    expect(classifyError({ code: '22001', message: 'value too long' })).toBe('permanent');
    expect(classifyError({ code: '23505', message: 'unique violation' })).toBe('permanent');
  });

  test('classifyError: unknown code → permanent (fail-fast default)', () => {
    expect(classifyError({ code: 'ZZZ999', message: 'mystery' })).toBe('permanent');
  });
});

// ===========================================================================
// flushQueue — FK order, dedup, success + error paths, backoff
// ===========================================================================

describe('sync-engine push: flushQueue pipeline', () => {
  test('flushQueue groups by table in FK-safe order: collection, decks, deck_cards, games, watchlist, profile', async () => {
    // Seed queue with entries across all 6 tables in a scrambled order
    const uid = 'user-test-uuid';
    await db.sync_queue.bulkAdd([
      { table_name: 'profile', op: 'put', row_id: 'p1', user_id: uid, payload: { id: 'p1', display_name: 'James' }, attempts: 0, created_at: Date.now() },
      { table_name: 'watchlist', op: 'put', row_id: 'w1', user_id: uid, payload: { id: 'w1', scryfall_id: 'wxy' }, attempts: 0, created_at: Date.now() },
      { table_name: 'deck_cards', op: 'put', row_id: 'dc1', user_id: uid, payload: { id: 'dc1', deck_id: 'd1', scryfall_id: 'sc1' }, attempts: 0, created_at: Date.now() },
      { table_name: 'games', op: 'put', row_id: 'g1', user_id: uid, payload: { id: 'g1', deck_id: 'd1' }, attempts: 0, created_at: Date.now() },
      { table_name: 'decks', op: 'put', row_id: 'd1', user_id: uid, payload: { id: 'd1', name: 'Lore' }, attempts: 0, created_at: Date.now() },
      { table_name: 'collection', op: 'put', row_id: 'c1', user_id: uid, payload: { id: 'c1', scryfall_id: 'sc1' }, attempts: 0, created_at: Date.now() }
    ]);

    await flushQueue();

    // upsertCalls should be ordered: collection, decks, deck_cards, games, watchlist, profile
    const order = upsertCalls.map(c => c.table);
    expect(order).toEqual(['collection', 'decks', 'deck_cards', 'games', 'watchlist', 'profile']);
  });

  test('flushQueue dedup: 3 put ops on same row_id → 1 upsert call with latest payload', async () => {
    const uid = 'user-test-uuid';
    const row_id = 'd1';
    await db.sync_queue.bulkAdd([
      { table_name: 'decks', op: 'put', row_id, user_id: uid, payload: { id: row_id, name: 'First' }, attempts: 0, created_at: 1000 },
      { table_name: 'decks', op: 'put', row_id, user_id: uid, payload: { id: row_id, name: 'Second' }, attempts: 0, created_at: 2000 },
      { table_name: 'decks', op: 'put', row_id, user_id: uid, payload: { id: row_id, name: 'Third' }, attempts: 0, created_at: 3000 }
    ]);

    await flushQueue();

    // One upsert call, with the latest payload
    const deckCalls = upsertCalls.filter(c => c.table === 'decks');
    expect(deckCalls.length).toBe(1);
    expect(deckCalls[0].rows.length).toBe(1);
    expect(deckCalls[0].rows[0].name).toBe('Third');
  });

  test('flushQueue success deletes queue entries', async () => {
    const uid = 'user-test-uuid';
    await db.sync_queue.bulkAdd([
      { table_name: 'decks', op: 'put', row_id: 'd1', user_id: uid, payload: { id: 'd1', name: 'A' }, attempts: 0, created_at: Date.now() }
    ]);

    await flushQueue();
    expect(await db.sync_queue.count()).toBe(0);
  });

  test('flushQueue success stamps synced_at on source row (under suppression — no re-enqueue)', async () => {
    const uid = 'user-test-uuid';
    const row_id = crypto.randomUUID();

    // Seed a source row directly (bypass hook by using suppression helper)
    await withHooksSuppressed(() => db.decks.add({ id: row_id, name: 'Pre-seeded' }));

    // Enqueue a pending put
    await db.sync_queue.add({
      table_name: 'decks', op: 'put', row_id, user_id: uid,
      payload: { id: row_id, name: 'Pre-seeded' }, attempts: 0, created_at: Date.now()
    });

    await flushQueue();

    const updated = await db.decks.get(row_id);
    expect(typeof updated.synced_at).toBe('number');
    // No extra queue entry from the synced_at update (suppression worked)
    expect(await db.sync_queue.count()).toBe(0);
  });

  test('flushQueue permanent error dead-letters to sync_conflicts AND deletes queue entry', async () => {
    const uid = 'user-test-uuid';
    // Force the next upsert call to return a permanent error
    upsertResults.push({ error: { code: '403', message: 'Forbidden — RLS violation' } });

    await db.sync_queue.add({
      table_name: 'decks', op: 'put', row_id: 'd1', user_id: uid,
      payload: { id: 'd1', name: 'Denied' }, attempts: 0, created_at: Date.now()
    });

    await flushQueue();

    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(0);

    const conflicts = await db.sync_conflicts.toArray();
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].table_name).toBe('decks');
    expect(conflicts[0].error_code).toBe('403');
  });

  test('flushQueue transient error increments attempts (stays in queue)', async () => {
    const uid = 'user-test-uuid';
    upsertResults.push({ error: { code: '429', message: 'Too Many Requests' } });

    await db.sync_queue.add({
      table_name: 'decks', op: 'put', row_id: 'd1', user_id: uid,
      payload: { id: 'd1', name: 'Rate-limited' }, attempts: 0, created_at: Date.now()
    });

    await flushQueue();

    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(1);
    expect(queue[0].attempts).toBe(1);
    expect(queue[0].last_error).toMatch(/Too Many Requests/);

    // No dead-letter yet — transient
    expect(await db.sync_conflicts.count()).toBe(0);
  });

  test('attempts reaches 3 → dead-letter even if classified transient', async () => {
    const uid = 'user-test-uuid';
    upsertResults.push({ error: { code: '503', message: 'Service Unavailable' } });

    // Pre-seed with attempts=2 so that after +1 failure attempts would hit 3 → dead-letter
    await db.sync_queue.add({
      table_name: 'decks', op: 'put', row_id: 'd1', user_id: uid,
      payload: { id: 'd1', name: 'Struggling' }, attempts: 2, created_at: Date.now()
    });

    await flushQueue();

    // Should be dead-lettered since attempts reached 3 (transient but budget spent)
    expect(await db.sync_queue.count()).toBe(0);
    expect(await db.sync_conflicts.count()).toBe(1);
    const c = (await db.sync_conflicts.toArray())[0];
    expect(c.error_code).toBe('503');
  });
});
