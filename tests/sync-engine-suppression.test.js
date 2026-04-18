// tests/sync-engine-suppression.test.js
// Phase 11 Plan 4 Wave 0 — Pitfall 11-B regression guard (synchronous `_suppressHooks`).
//
// Pitfall 11-B: if `withHooksSuppressed` is declared as `async (fn) => { ... }`, the
// `_suppressHooks = false` runs in the `finally` BEFORE any `await`-ed work inside
// `fn` resolves — hooks fired from interleaved code paths see the flag as false.
//
// This file:
//   1. `withHooksSuppressed(() => db.collection.put(x))` — hook sees flag true; no sync_queue entry
//   2. withHooksSuppressed resets flag in finally even if fn throws
//   3. **REGRESSION GATE (PITFALL 11-B):** reads src/services/sync-engine.js and asserts
//      `withHooksSuppressed` is NOT declared as `async` (static grep gate)
//   4. Two sequential withHooksSuppressed calls do not leak state into each other
//
// The third test is the load-bearing regression gate — it works even if the module
// doesn't exist (file not found = test fails loudly, which is the expected RED state
// before the sync-engine ships).

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';

// ---------------------------------------------------------------------------
// Supabase mock (not actually used by this suite, but required so sync-engine
// import doesn't fail trying to load the real supabase-js in node env).
// ---------------------------------------------------------------------------
vi.mock('../src/services/supabase.js', () => ({
  getSupabase: () => ({
    schema: () => ({ from: () => ({ upsert: async () => ({ error: null }), delete: () => ({ eq: async () => ({ error: null }) }) }) })
  }),
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

// ---------------------------------------------------------------------------
// Module loader
// ---------------------------------------------------------------------------
const SYNC_ENGINE_PATH = resolve(process.cwd(), 'src/services/sync-engine.js');

let db, installSyncHooks, withHooksSuppressed, isSuppressed, __resetSyncEngineForTests;

beforeEach(async () => {
  installAlpineWindow();
  storeRegistry.auth = { status: 'authed', user: { id: 'user-test-uuid' } };
  storeRegistry.sync = { status: 'synced', pending_count: 0, _transition: vi.fn() };

  vi.stubGlobal('navigator', { onLine: true });

  await Dexie.delete('counterflux');
  vi.resetModules();

  const schemaMod = await import('../src/db/schema.js');
  db = schemaMod.db;
  await db.open();

  const engineMod = await import('../src/services/sync-engine.js');
  installSyncHooks = engineMod.installSyncHooks;
  withHooksSuppressed = engineMod.withHooksSuppressed;
  isSuppressed = engineMod.isSuppressed;
  __resetSyncEngineForTests = engineMod.__resetSyncEngineForTests;
  if (__resetSyncEngineForTests) __resetSyncEngineForTests();
  installSyncHooks();
});

afterEach(() => {
  if (__resetSyncEngineForTests) __resetSyncEngineForTests();
  if (db && db.isOpen()) db.close();
  vi.unstubAllGlobals();
});

describe('withHooksSuppressed: synchronous flag (Pitfall 11-B regression gate)', () => {
  test('withHooksSuppressed(() => db.collection.put(x)) — hook sees flag true; no sync_queue entry', async () => {
    const id = crypto.randomUUID();
    // Use synchronous wrapper — Dexie hook fires during .add() call stack,
    // BEFORE the returned promise resolves
    const p = withHooksSuppressed(() =>
      db.collection.add({ id, scryfall_id: 'sc1', category: 'main', foil: false })
    );
    await p;

    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(0); // suppressed — nothing enqueued
  });

  test('withHooksSuppressed resets flag in finally even if fn throws', async () => {
    expect(() =>
      withHooksSuppressed(() => { throw new Error('boom'); })
    ).toThrow('boom');

    // Flag must be cleared — subsequent writes should enqueue as normal
    await db.collection.add({ scryfall_id: 'sc2', category: 'main', foil: false });
    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(1);
    if (typeof isSuppressed === 'function') {
      expect(isSuppressed()).toBe(false);
    }
  });

  test('PITFALL 11-B REGRESSION: withHooksSuppressed MUST NOT be declared as async (static grep gate)', () => {
    expect(existsSync(SYNC_ENGINE_PATH)).toBe(true);
    const src = readFileSync(SYNC_ENGINE_PATH, 'utf8');

    // Gate 1: must not be `async function withHooksSuppressed`
    expect(/async\s+function\s+withHooksSuppressed/.test(src)).toBe(false);
    // Gate 2: must not be exported as an async arrow function
    expect(/withHooksSuppressed\s*=\s*async\s*(\(|function)/.test(src)).toBe(false);
    // Gate 3: must be declared as a regular function (positive proof)
    expect(/function\s+withHooksSuppressed\s*\(/.test(src)).toBe(true);
  });

  test('sequential calls: two withHooksSuppressed calls do not leak into each other', async () => {
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();

    await withHooksSuppressed(() => db.collection.add({ id: id1, scryfall_id: 'a1', category: 'main', foil: false }));
    // Between the two, hooks should be active again — a normal write enqueues
    await db.collection.add({ id: crypto.randomUUID(), scryfall_id: 'between', category: 'main', foil: false });
    await withHooksSuppressed(() => db.collection.add({ id: id2, scryfall_id: 'a2', category: 'main', foil: false }));

    // Only the middle write should have enqueued
    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(1);
    expect(queue[0].payload.scryfall_id).toBe('between');
  });
});
