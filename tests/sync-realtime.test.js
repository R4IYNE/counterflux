// tests/sync-realtime.test.js
// Phase 11 Plan 5 Wave 0 — SYNC-03 Realtime pull side (single schema-wide channel).
//
//  1. subscribeRealtime creates single channel 'counterflux-household'
//  2. applyRealtimeChange INSERT → db.table.add under suppression
//  3. applyRealtimeChange UPDATE → LWW merge
//  4. applyRealtimeChange DELETE → db.table.delete under suppression
//  5. applyRealtimeChange ignores non-synced tables
//  6. suppression prevents hook re-enqueue after realtime-applied write
//  7. unsubscribeRealtime tears down channel

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';

// ---------------------------------------------------------------------------
// Supabase + channel stub — captures channel name + postgres_changes handler
// ---------------------------------------------------------------------------
const channelState = {
  createdChannels: [],
  capturedHandler: null,
  subscribeCalls: 0,
  unsubscribeCalls: 0,
  lastOnOpts: null,
};

function makeChannelStub(name) {
  channelState.createdChannels.push(name);
  const obj = {
    name,
    on: vi.fn(function (event, opts, handler) {
      channelState.capturedHandler = handler;
      channelState.lastOnOpts = opts;
      return this;
    }),
    subscribe: vi.fn(function () {
      channelState.subscribeCalls++;
      return this;
    }),
    unsubscribe: vi.fn(() => { channelState.unsubscribeCalls++; })
  };
  return obj;
}

const supabaseStub = {
  schema: vi.fn(() => ({ from: vi.fn() })),
  channel: vi.fn((name) => makeChannelStub(name))
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
let subscribeRealtime, unsubscribeRealtime, applyRealtimeChange;

beforeEach(async () => {
  vi.stubGlobal('navigator', { onLine: true });
  installAlpineWindow();
  storeRegistry.auth = { status: 'authed', user: { id: 'user-test-uuid' } };
  storeRegistry.sync = { status: 'synced', _transition: vi.fn() };

  channelState.createdChannels.length = 0;
  channelState.capturedHandler = null;
  channelState.subscribeCalls = 0;
  channelState.unsubscribeCalls = 0;
  channelState.lastOnOpts = null;
  supabaseStub.channel.mockClear();
  supabaseStub.schema.mockClear();

  await Dexie.delete('counterflux');
  vi.resetModules();

  const schemaMod = await import('../src/db/schema.js');
  db = schemaMod.db;
  await db.open();

  const engineMod = await import('../src/services/sync-engine.js');
  if (engineMod.__resetSyncEngineForTests) engineMod.__resetSyncEngineForTests();
  engineMod.installSyncHooks();

  const rtMod = await import('../src/services/sync-realtime.js');
  subscribeRealtime = rtMod.subscribeRealtime;
  unsubscribeRealtime = rtMod.unsubscribeRealtime;
  applyRealtimeChange = rtMod.applyRealtimeChange;
});

afterEach(async () => {
  if (typeof unsubscribeRealtime === 'function') unsubscribeRealtime();
  if (db && db.isOpen()) db.close();
  vi.unstubAllGlobals();
});

describe('subscribeRealtime — single schema-wide channel', () => {
  test('subscribeRealtime creates single channel counterflux-household', async () => {
    await subscribeRealtime();
    expect(channelState.createdChannels).toContain('counterflux-household');
    // Single channel — called once
    expect(supabaseStub.channel).toHaveBeenCalledTimes(1);
    expect(channelState.subscribeCalls).toBe(1);
    // Schema-wide filter (counterflux), event wildcard
    expect(channelState.lastOnOpts).toMatchObject({ schema: 'counterflux' });
  });

  test('subscribeRealtime is idempotent — does not create a second channel', async () => {
    await subscribeRealtime();
    await subscribeRealtime();
    expect(supabaseStub.channel).toHaveBeenCalledTimes(1);
  });

  test('unsubscribeRealtime tears down channel', async () => {
    await subscribeRealtime();
    unsubscribeRealtime();
    expect(channelState.unsubscribeCalls).toBe(1);
  });
});

describe('applyRealtimeChange — dispatcher by payload.table', () => {
  test('applyRealtimeChange INSERT → db.table.add under suppression', async () => {
    const id = crypto.randomUUID();
    await applyRealtimeChange({
      schema: 'counterflux',
      table: 'collection',
      eventType: 'INSERT',
      new: { id, scryfall_id: 'sc1', category: 'main', foil: false, updated_at: new Date(500).toISOString() },
      old: null
    });

    const row = await db.collection.get(id);
    expect(row).toBeTruthy();
    expect(row.scryfall_id).toBe('sc1');

    // Suppression: no sync_queue entry should have been enqueued
    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(0);
  });

  test('applyRealtimeChange UPDATE → LWW merge (remote newer wins)', async () => {
    const id = crypto.randomUUID();
    await db.collection.add({ id, scryfall_id: 'old', category: 'main', foil: false, updated_at: 100 });
    await db.sync_queue.clear();

    await applyRealtimeChange({
      schema: 'counterflux',
      table: 'collection',
      eventType: 'UPDATE',
      new: { id, scryfall_id: 'new', category: 'main', foil: false, updated_at: new Date(500).toISOString() },
      old: null
    });

    const row = await db.collection.get(id);
    expect(row.scryfall_id).toBe('new');
    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(0);
  });

  test('applyRealtimeChange DELETE → db.table.delete under suppression', async () => {
    const id = crypto.randomUUID();
    await db.collection.add({ id, scryfall_id: 'to-kill', category: 'main', foil: false });
    await db.sync_queue.clear();

    await applyRealtimeChange({
      schema: 'counterflux',
      table: 'collection',
      eventType: 'DELETE',
      new: null,
      old: { id }
    });

    const row = await db.collection.get(id);
    expect(row).toBeUndefined();

    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(0);
  });

  test('applyRealtimeChange ignores non-synced tables', async () => {
    // e.g., an unrelated admin table in the counterflux schema — should no-op
    await applyRealtimeChange({
      schema: 'counterflux',
      table: 'admin_audit',
      eventType: 'INSERT',
      new: { id: 'xyz', note: 'should be ignored' },
      old: null
    });
    // cards is also in Dexie but NOT in the synced list — ensure no write
    // Dexie doesn't have admin_audit anyway; just confirm queue is clean
    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(0);
  });

  test('suppression prevents hook re-enqueue after realtime-applied write', async () => {
    // Apply a realtime insert; confirm that the subsequent write did NOT go through the outbox hooks.
    const id = crypto.randomUUID();
    await applyRealtimeChange({
      schema: 'counterflux',
      table: 'decks',
      eventType: 'INSERT',
      new: { id, name: 'From Cloud', format: 'commander', updated_at: new Date(1000).toISOString() },
      old: null
    });

    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(0); // outbox hook suppressed

    // A normal write AFTER should still enqueue (suppression did not leak)
    await db.decks.add({ name: 'Local deck', format: 'commander' });
    const queue2 = await db.sync_queue.toArray();
    expect(queue2.length).toBe(1);
    expect(queue2[0].payload.name).toBe('Local deck');
  });
});
