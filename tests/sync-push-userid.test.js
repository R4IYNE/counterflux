// tests/sync-push-userid.test.js
// Phase 14 Plan 1 — Issue A regression lock: payload.user_id must be stamped
// with currentUserId before supabase.upsert(). Closes audit Issue A from
// .planning/v1.1-MILESTONE-AUDIT.md (SQLSTATE 23502 latent bug).
//
// The bug chain (from the audit):
//   1. src/stores/collection.js:446 hard-codes user_id: null on new row inserts
//   2. src/stores/deck.js + src/stores/game.js never set user_id (undefined)
//   3. sync-engine hook snapshots payload via JSON.parse(JSON.stringify(obj))
//      which preserves null / undefined on user_id
//   4. flushQueue maps rows = latestByRow.values().map(e => e.payload)
//      — NO user_id backfill before .upsert()
//   5. Supabase counterflux.* tables declare user_id NOT NULL with no
//      DEFAULT auth.uid() → upsert returns SQLSTATE 23502 → classifyError
//      → permanent → dead-letter + notification bell spam
//
// Fix (Task 2 — Option A, 1-line): stamp payload.user_id = currentUserId
// BEFORE the upsert, in the put-branch of flushQueue. This file locks down
// the invariant so no future regression re-introduces the audit bug.

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';

// ---------------------------------------------------------------------------
// Hoisted Supabase mock (before module import) — mirrors tests/sync-engine-push.test.js
// ---------------------------------------------------------------------------
const upsertResults = []; // queue of results to return from upsert() in order
const upsertCalls = [];   // log of { table, rows } for assertions

function makeUpsertChain(tableName) {
  return {
    upsert: vi.fn(async (rows) => {
      upsertCalls.push({ table: tableName, rows });
      const next = upsertResults.length ? upsertResults.shift() : { error: null };
      return next;
    }),
    delete: vi.fn(() => ({
      eq: vi.fn(async () => ({ error: null }))
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
// Alpine store registry — auth lookup for currentUserId.
// Per-test mutation of storeRegistry.auth drives _currentUserId() / _authStatus().
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
let flushQueue, __resetSyncEngineForTests;
let db;

beforeEach(async () => {
  vi.stubGlobal('navigator', { onLine: true });
  installAlpineWindow();
  // Default to authed as user-aaa-111 — individual tests mutate storeRegistry.auth
  storeRegistry.auth = { status: 'authed', user: { id: 'user-aaa-111' } };
  storeRegistry.sync = { status: 'synced', pending_count: 0, _transition: vi.fn(), last_error: null, last_synced_at: null };

  upsertResults.length = 0;
  upsertCalls.length = 0;

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
  await db.open();

  const engineMod = await import('../src/services/sync-engine.js');
  flushQueue = engineMod.flushQueue;
  __resetSyncEngineForTests = engineMod.__resetSyncEngineForTests;
  if (__resetSyncEngineForTests) __resetSyncEngineForTests();
  // NOTE: We do NOT call installSyncHooks() here — this test seeds sync_queue
  // directly to isolate the flushQueue push behaviour from the hook path.
});

afterEach(() => {
  if (__resetSyncEngineForTests) __resetSyncEngineForTests();
  if (db && db.isOpen()) db.close();
  vi.unstubAllGlobals();
});

// ===========================================================================
// Issue A — payload.user_id MUST be stamped before upsert
// ===========================================================================

describe('Issue A — payload.user_id stamped on push (audit 2026-04-22)', () => {
  test('flushQueue stamps payload.user_id with currentUserId on every upserted row', async () => {
    // Auth as user-aaa-111 (default from beforeEach is already this user, but
    // re-assert explicitly so the test reads self-contained)
    storeRegistry.auth = { status: 'authed', user: { id: 'user-aaa-111' } };

    // Seed 3 put-ops in sync_queue for `collection` with payload.user_id: null
    // — mimics the src/stores/collection.js:446 hard-coded null that reaches
    // the sync engine via JSON.parse(JSON.stringify(obj)) in the Dexie hook.
    await db.sync_queue.bulkAdd([
      { table_name: 'collection', row_id: 'r1', op: 'put', payload: { id: 'r1', scryfall_id: 's1', user_id: null, quantity: 1, updated_at: 1, synced_at: null }, user_id: 'user-aaa-111', created_at: 1, attempts: 0 },
      { table_name: 'collection', row_id: 'r2', op: 'put', payload: { id: 'r2', scryfall_id: 's2', user_id: null, quantity: 1, updated_at: 1, synced_at: null }, user_id: 'user-aaa-111', created_at: 2, attempts: 0 },
      { table_name: 'collection', row_id: 'r3', op: 'put', payload: { id: 'r3', scryfall_id: 's3', user_id: null, quantity: 1, updated_at: 1, synced_at: null }, user_id: 'user-aaa-111', created_at: 3, attempts: 0 },
    ]);

    await flushQueue();

    expect(upsertCalls.length).toBe(1);
    expect(upsertCalls[0].table).toBe('collection');
    expect(upsertCalls[0].rows.length).toBe(3);
    for (const row of upsertCalls[0].rows) {
      expect(row.user_id).not.toBeNull();
      expect(row.user_id).not.toBeUndefined();
      expect(row.user_id).toBe('user-aaa-111');
    }
  });

  test('flushQueue overwrites a stale payload.user_id with currentUserId (cross-user safety at push seam)', async () => {
    storeRegistry.auth = { status: 'authed', user: { id: 'user-aaa-111' } };

    // Seed a put-op whose payload carries a DIFFERENT user_id (simulates a row
    // migrated from another account, or a hypothetical corruption). The client
    // MUST be the authority on user_id at push time — PITFALLS §7 cross-user
    // safety net. The spread-and-stamp ordering in Task 2 guarantees the
    // currentUserId overwrites the stale value, never the other way around.
    await db.sync_queue.add({
      table_name: 'decks',
      row_id: 'd1',
      op: 'put',
      payload: { id: 'd1', name: 'stale', user_id: 'DIFFERENT-USER-999', updated_at: 1, synced_at: null },
      user_id: 'user-aaa-111',
      created_at: 1,
      attempts: 0,
    });

    await flushQueue();

    expect(upsertCalls.length).toBe(1);
    expect(upsertCalls[0].table).toBe('decks');
    expect(upsertCalls[0].rows.length).toBe(1);
    expect(upsertCalls[0].rows[0].user_id).toBe('user-aaa-111');
    // Also — and critically — the stale payload.user_id must NOT have won.
    expect(upsertCalls[0].rows[0].user_id).not.toBe('DIFFERENT-USER-999');
  });

  test('flushQueue with anonymous auth does not push (existing guard preserved)', async () => {
    // Anonymous — no user.id
    storeRegistry.auth = { status: 'anonymous', user: null };

    // Seed one put-op (would normally flush under authed user, but anonymous
    // auth must short-circuit at sync-engine.js line 359).
    await db.sync_queue.add({
      table_name: 'collection',
      row_id: 'r1',
      op: 'put',
      payload: { id: 'r1', scryfall_id: 's1', user_id: null, quantity: 1, updated_at: 1, synced_at: null },
      user_id: 'user-aaa-111',
      created_at: 1,
      attempts: 0,
    });

    await flushQueue();

    // No upsert calls — the authStatus !== 'authed' guard blocks the flush.
    expect(upsertCalls.length).toBe(0);
  });

  test('flushQueue with authed-but-missing-user.id does not push (existing guard preserved)', async () => {
    // Status is 'authed' but user has no id property — should still short-circuit
    // at the `if (!currentUserId) return` guard (sync-engine.js line 363).
    storeRegistry.auth = { status: 'authed', user: {} };

    await db.sync_queue.add({
      table_name: 'collection',
      row_id: 'r1',
      op: 'put',
      payload: { id: 'r1', scryfall_id: 's1', user_id: null, quantity: 1, updated_at: 1, synced_at: null },
      user_id: 'user-aaa-111',
      created_at: 1,
      attempts: 0,
    });

    await flushQueue();

    // No upsert calls — missing user.id blocks the flush.
    expect(upsertCalls.length).toBe(0);
  });
});
