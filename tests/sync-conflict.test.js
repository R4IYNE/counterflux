// tests/sync-conflict.test.js
// Phase 11 Plan 5 Wave 0 — SYNC-05 row-level LWW resolver + deck_cards atomic merge.
//
// Row-level LWW per CONTEXT D-02 (REQUIREMENTS "field-level" text superseded —
// see 11-05-PLAN.md notes and RESEARCH §Phase Requirements footnote).
//
//  1. resolveLWW: remote newer → remote wins
//  2. resolveLWW: local newer → local wins
//  3. resolveLWW: tie → cloud wins (D-02)
//  4. deck_cards atomic: different ids same (deck_id, scryfall_id), cloud newer → cloud wins +
//     local logs to sync_conflicts with reason 'deck_cards_atomic_merge'
//  5. deck_cards: local newer wins + remote logs to sync_conflicts
//  6. deck_cards: matching ids uses regular resolveLWW (no conflict entry)
//  7. local-delete + remote-update → sync_conflicts entry for user review

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';

// ---------------------------------------------------------------------------
// Supabase stub — conflict tests don't hit network but sync-pull.js imports it.
// ---------------------------------------------------------------------------
vi.mock('../src/services/supabase.js', () => ({
  getSupabase: () => ({
    schema: () => ({ from: () => ({
      select: () => ({ gt: async () => ({ data: [], error: null }), range: async () => ({ data: [], error: null }), order: function () { return this; } }),
      upsert: async () => ({ error: null }),
      delete: () => ({ eq: async () => ({ error: null }), neq: async () => ({ error: null }) })
    }) }),
    channel: () => ({ on: function () { return this; }, subscribe: function () { return this; }, unsubscribe: () => {} })
  }),
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
let resolveLWW, resolveDeckCardConflict;

beforeEach(async () => {
  vi.stubGlobal('navigator', { onLine: true });
  installAlpineWindow();
  storeRegistry.auth = { status: 'authed', user: { id: 'user-test-uuid' } };
  storeRegistry.sync = { status: 'synced', _transition: vi.fn() };

  await Dexie.delete('counterflux');
  vi.resetModules();

  const schemaMod = await import('../src/db/schema.js');
  db = schemaMod.db;
  await db.open();

  const pullMod = await import('../src/services/sync-pull.js');
  resolveLWW = pullMod.resolveLWW;
  resolveDeckCardConflict = pullMod.resolveDeckCardConflict;

  const engineMod = await import('../src/services/sync-engine.js');
  if (engineMod.__resetSyncEngineForTests) engineMod.__resetSyncEngineForTests();
});

afterEach(async () => {
  if (db && db.isOpen()) db.close();
  vi.unstubAllGlobals();
});

describe('resolveLWW — row-level, tie → cloud (D-02)', () => {
  test('remote newer → remote wins', () => {
    const local = { id: 'a', updated_at: 100 };
    const remote = { id: 'a', updated_at: 200 };
    const result = resolveLWW(local, remote);
    expect(result.winner).toBe('remote');
    expect(result.row).toEqual(remote);
  });

  test('local newer → local wins', () => {
    const local = { id: 'a', updated_at: 300 };
    const remote = { id: 'a', updated_at: 200 };
    const result = resolveLWW(local, remote);
    expect(result.winner).toBe('local');
    expect(result.row).toEqual(local);
  });

  test('tie → cloud wins (D-02)', () => {
    const local = { id: 'a', updated_at: 500 };
    const remote = { id: 'a', updated_at: 500 };
    const result = resolveLWW(local, remote);
    expect(result.winner).toBe('remote');
    expect(result.row).toEqual(remote);
  });

  test('ISO-string updated_at is normalised correctly', () => {
    const local = { id: 'a', updated_at: 1000 };
    const remote = { id: 'a', updated_at: new Date(2000).toISOString() };
    const result = resolveLWW(local, remote);
    expect(result.winner).toBe('remote');
  });
});

describe('deck_cards atomic merge — composite (deck_id, scryfall_id)', () => {
  test('different ids same composite, cloud newer → cloud wins + local logs to sync_conflicts with reason deck_cards_atomic_merge', async () => {
    const local = { id: 'local-uuid', deck_id: 'd1', scryfall_id: 'sc1', updated_at: 100 };
    const remote = { id: 'remote-uuid', deck_id: 'd1', scryfall_id: 'sc1', updated_at: 200 };

    const result = await resolveDeckCardConflict(local, remote);
    expect(result.winner).toBe('remote');
    expect(result.row.id).toBe('remote-uuid');

    const conflicts = await db.sync_conflicts.toArray();
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].table_name).toBe('deck_cards');
    expect(conflicts[0].error_code).toBe('deck_cards_atomic_merge');
    expect(conflicts[0].row_id).toBe('local-uuid'); // loser id
  });

  test('different ids same composite, local newer → local wins + remote logs to sync_conflicts', async () => {
    const local = { id: 'local-uuid', deck_id: 'd2', scryfall_id: 'sc2', updated_at: 500 };
    const remote = { id: 'remote-uuid', deck_id: 'd2', scryfall_id: 'sc2', updated_at: 200 };

    const result = await resolveDeckCardConflict(local, remote);
    expect(result.winner).toBe('local');
    expect(result.row.id).toBe('local-uuid');

    const conflicts = await db.sync_conflicts.toArray();
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].row_id).toBe('remote-uuid'); // loser id
    expect(conflicts[0].error_code).toBe('deck_cards_atomic_merge');
  });

  test('matching ids uses regular resolveLWW (no conflict entry)', async () => {
    const local = { id: 'same-uuid', deck_id: 'd3', scryfall_id: 'sc3', updated_at: 100 };
    const remote = { id: 'same-uuid', deck_id: 'd3', scryfall_id: 'sc3', updated_at: 200 };

    const result = await resolveDeckCardConflict(local, remote);
    expect(result.winner).toBe('remote');

    const conflicts = await db.sync_conflicts.toArray();
    expect(conflicts.length).toBe(0);
  });
});

describe('unresolvable conflict paths → sync_conflicts', () => {
  test('local-delete + remote-update → sync_conflicts entry', async () => {
    // Simulate: local row has deleted_at set (soft-deleted); remote has a newer update.
    // The resolver in sync-pull.js should detect this and log a conflict.
    const pullMod = await import('../src/services/sync-pull.js');
    // Expect an exported helper that routes the local-delete + remote-update case.
    expect(typeof pullMod.logLocalDeleteRemoteUpdateConflict).toBe('function');

    const local = { id: 'row1', deleted_at: 1000, updated_at: 900 };
    const remote = { id: 'row1', updated_at: 2000 };
    await pullMod.logLocalDeleteRemoteUpdateConflict('collection', local, remote);

    const conflicts = await db.sync_conflicts.toArray();
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].table_name).toBe('collection');
    expect(conflicts[0].error_code).toBe('local_delete_remote_update');
    expect(conflicts[0].row_id).toBe('row1');
  });
});
