// tests/sync-engine-cross-user.test.js
// Phase 11 Plan 4 Wave 0 — PITFALLS §7 cross-user queue contamination gate (SYNC-06).
//
// User A signs in, makes 50 local edits offline → queue tagged with user_id=A.
// User A signs out (queue preserved per D-22). User B signs in on same browser.
// flushQueue() MUST NOT push A's entries under B's auth — B's Postgres would
// receive A's row data under B's JWT, which is catastrophic cross-user data leak.
//
// Tests:
//   1. queue tagged with user A stays in queue under user B auth (no upsert called)
//   2. only current-user entries are flushed — 2 for user-a + 1 for user-b: with
//      user-b auth, flushQueue pushes only the 1 user-b entry; 2 user-a remain
//   3. user_id missing (anonymous) blocks flush entirely — no upsert calls

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';

// ---------------------------------------------------------------------------
// Hoisted Supabase mock
// ---------------------------------------------------------------------------
const upsertCalls = [];
const deleteCalls = [];

function makeChain(tableName) {
  return {
    upsert: vi.fn(async (rows) => {
      upsertCalls.push({ table: tableName, rows });
      return { error: null };
    }),
    delete: vi.fn(() => ({
      eq: vi.fn(async (_col, rowId) => {
        deleteCalls.push({ table: tableName, rowId });
        return { error: null };
      })
    }))
  };
}
const supabaseStub = {
  schema: vi.fn(() => ({ from: vi.fn((t) => makeChain(t)) }))
};
vi.mock('../src/services/supabase.js', () => ({
  getSupabase: () => supabaseStub,
  __resetSupabaseClient: vi.fn()
}));

// ---------------------------------------------------------------------------
// Alpine window stub
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

let db, installSyncHooks, flushQueue, withHooksSuppressed, __resetSyncEngineForTests;

beforeEach(async () => {
  installAlpineWindow();
  storeRegistry.sync = { status: 'synced', pending_count: 0, _transition: vi.fn(), last_error: null, last_synced_at: null };
  vi.stubGlobal('navigator', { onLine: true });
  upsertCalls.length = 0;
  deleteCalls.length = 0;

  await Dexie.delete('counterflux');
  vi.resetModules();

  const schemaMod = await import('../src/db/schema.js');
  db = schemaMod.db;
  await db.open();

  const engineMod = await import('../src/services/sync-engine.js');
  installSyncHooks = engineMod.installSyncHooks;
  flushQueue = engineMod.flushQueue;
  withHooksSuppressed = engineMod.withHooksSuppressed;
  __resetSyncEngineForTests = engineMod.__resetSyncEngineForTests;
  if (__resetSyncEngineForTests) __resetSyncEngineForTests();
  installSyncHooks();
});

afterEach(() => {
  if (__resetSyncEngineForTests) __resetSyncEngineForTests();
  if (db && db.isOpen()) db.close();
  vi.unstubAllGlobals();
});

describe('cross-user queue safety (PITFALLS §7 / SYNC-06)', () => {
  test('queue tagged with user A stays in queue under user B auth (no upsert called)', async () => {
    // Seed 3 entries tagged with user-a-uuid
    const userAEntries = [
      { table_name: 'decks', op: 'put', row_id: 'd1', user_id: 'user-a-uuid', payload: { id: 'd1', name: 'Izzet Storm' }, attempts: 0, created_at: Date.now() },
      { table_name: 'decks', op: 'put', row_id: 'd2', user_id: 'user-a-uuid', payload: { id: 'd2', name: 'Golgari Grave' }, attempts: 0, created_at: Date.now() },
      { table_name: 'collection', op: 'put', row_id: 'c1', user_id: 'user-a-uuid', payload: { id: 'c1', scryfall_id: 'sc1' }, attempts: 0, created_at: Date.now() }
    ];
    await db.sync_queue.bulkAdd(userAEntries);

    // Switch auth to user B
    storeRegistry.auth = { status: 'authed', user: { id: 'user-b-uuid' } };

    await flushQueue();

    // User A's 3 entries stay in queue
    expect(await db.sync_queue.count()).toBe(3);
    // No upserts happened — flushQueue short-circuited on user_id filter
    expect(upsertCalls.length).toBe(0);
  });

  test('only current-user entries are flushed — PITFALLS §7 user_id stays in queue', async () => {
    const entries = [
      // 2 for user-a — stay in queue
      { table_name: 'decks', op: 'put', row_id: 'da1', user_id: 'user-a-uuid', payload: { id: 'da1', name: 'A1' }, attempts: 0, created_at: Date.now() },
      { table_name: 'decks', op: 'put', row_id: 'da2', user_id: 'user-a-uuid', payload: { id: 'da2', name: 'A2' }, attempts: 0, created_at: Date.now() },
      // 1 for user-b — should flush
      { table_name: 'decks', op: 'put', row_id: 'db1', user_id: 'user-b-uuid', payload: { id: 'db1', name: 'B1' }, attempts: 0, created_at: Date.now() }
    ];
    await db.sync_queue.bulkAdd(entries);

    // Seed source row for user-b so synced_at update works
    await withHooksSuppressed(() =>
      db.decks.add({ id: 'db1', name: 'B1' })
    );

    // Auth as user B
    storeRegistry.auth = { status: 'authed', user: { id: 'user-b-uuid' } };

    await flushQueue();

    // One upsert call for user-b row
    expect(upsertCalls.length).toBe(1);
    expect(upsertCalls[0].rows[0].id).toBe('db1');

    // User A's 2 entries remain in queue — cross-user preservation (PITFALLS §7)
    const remaining = await db.sync_queue.toArray();
    expect(remaining.length).toBe(2);
    expect(remaining.every(r => r.user_id === 'user-a-uuid')).toBe(true);
  });

  test('user_id missing (anonymous) blocks flush entirely — no upsert calls', async () => {
    await db.sync_queue.bulkAdd([
      { table_name: 'decks', op: 'put', row_id: 'd1', user_id: 'user-a-uuid', payload: { id: 'd1', name: 'Lore' }, attempts: 0, created_at: Date.now() }
    ]);

    // Anonymous auth — no user.id present
    storeRegistry.auth = { status: 'anonymous', user: null };

    await flushQueue();

    // Queue intact; no upsert
    expect(await db.sync_queue.count()).toBe(1);
    expect(upsertCalls.length).toBe(0);
  });
});
