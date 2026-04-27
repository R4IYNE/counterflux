/**
 * COLLECT-02 store contract: src/stores/collection.js add-all-from-precon.
 *
 * addAllFromPrecon(code):
 *   - Reads the precon's decklist from in-memory store or precons_cache
 *   - Uses a Dexie transaction to merge duplicates (same scryfall_id + foil:0 +
 *     category:'owned' increments quantity) and insert new rows
 *   - Triggers loadEntries() EXACTLY ONCE at the end (Pitfall 2: not N+1)
 *   - Registers a SINGLE undo entry that inverts the entire batch (D-08)
 *   - Fires the toast string "Added N cards from {name} to collection." (UI-SPEC)
 *   - Closes preconBrowserOpen; panel stays open (D-06)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockBundlePages } from './fixtures/scryfall-precons.js';

const __alpineStores = {};
vi.mock('alpinejs', () => ({
  default: {
    store(name, obj) {
      if (obj === undefined) return __alpineStores[name];
      __alpineStores[name] = obj;
      return __alpineStores[name];
    },
  },
}));

describe('COLLECT-02: addAllFromPrecon (batch add, single reload, single undo)', () => {
  let collectionStore;

  beforeEach(async () => {
    for (const k of Object.keys(__alpineStores)) delete __alpineStores[k];

    // Minimal toast + undo store shims
    const toastCalls = [];
    __alpineStores.toast = {
      success: (msg) => toastCalls.push({ type: 'success', msg }),
      show: (msg) => toastCalls.push({ type: 'show', msg }),
      _calls: toastCalls,
    };
    const undoCalls = [];
    __alpineStores.undo = {
      stack: [],
      push: (...args) => {
        // Mirror production signature: push(type, data, message, commitFn, restoreFn)
        const entry = { type: args[0], data: args[1], message: args[2], commitFn: args[3], restoreFn: args[4] };
        __alpineStores.undo.stack.push(entry);
        undoCalls.push(entry);
        return entry;
      },
      _calls: undoCalls,
    };

    // Expose Alpine to window for undo-store lookup in addAllFromPrecon
    if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
    globalThis.window.Alpine = {
      store(name) {
        return __alpineStores[name];
      },
    };

    // Reset Dexie precons_cache + collection
    const { db } = await import('../src/db/schema.js');
    if (db.tables.find((t) => t.name === 'precons_cache')) await db.precons_cache.clear();
    await db.collection.clear();

    // Reset scryfall queue
    const queueMod = await import('../src/services/scryfall-queue.js');
    if (typeof queueMod.__resetQueueForTests === 'function') queueMod.__resetQueueForTests();

    const { initCollectionStore } = await import('../src/stores/collection.js');
    initCollectionStore();
    collectionStore = __alpineStores.collection;

    // Seed the store with a test precon containing 99 cards
    const decklist = [];
    decklist.push({ scryfall_id: 'cmm-001', quantity: 1, is_commander: true });
    for (let i = 2; i <= 99; i++) {
      decklist.push({ scryfall_id: `cmm-${String(i).padStart(3, '0')}`, quantity: 1, is_commander: false });
    }
    collectionStore.precons = [
      {
        code: 'cmm',
        name: 'Commander Masters',
        set_type: 'commander',
        released_at: '2023-08-04',
        image_url: 'https://svgs.scryfall.io/sets/cmm.svg',
        search_uri: 'https://api.scryfall.com/cards/search?q=set%3Acmm&unique=prints',
        decklist,
        updated_at: Date.now(),
      },
    ];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Test 1 — addAllFromPrecon inserts all 99 rows into db.collection', async () => {
    const { db } = await import('../src/db/schema.js');
    expect(await db.collection.count()).toBe(0);

    await collectionStore.addAllFromPrecon('cmm');

    expect(await db.collection.count()).toBe(99);
  });

  it('Test 2 — addAllFromPrecon merges duplicates on [scryfall_id+foil+category]', async () => {
    const { db } = await import('../src/db/schema.js');
    // Pre-seed collection with cmm-001 at quantity 2
    await db.collection.add({
      scryfall_id: 'cmm-001',
      quantity: 2,
      foil: 0,
      category: 'owned',
      added_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      synced_at: null,
      user_id: null,
    });
    expect(await db.collection.count()).toBe(1);

    await collectionStore.addAllFromPrecon('cmm');

    // 1 pre-seeded merged row + 98 new rows = 99 unique
    expect(await db.collection.count()).toBe(99);
    const merged = await db.collection.where('scryfall_id').equals('cmm-001').first();
    expect(merged.quantity).toBe(3); // 2 + 1 = 3
  });

  it('Test 3 — addAllFromPrecon triggers loadEntries EXACTLY ONCE (Pitfall 2)', async () => {
    const loadSpy = vi.spyOn(collectionStore, 'loadEntries');

    await collectionStore.addAllFromPrecon('cmm');

    expect(loadSpy).toHaveBeenCalledTimes(1);
  });

  it('Test 4 — addAllFromPrecon registers EXACTLY ONE undo entry of type collection_add_batch', async () => {
    const undo = __alpineStores.undo;
    expect(undo._calls).toHaveLength(0);

    await collectionStore.addAllFromPrecon('cmm');

    expect(undo._calls).toHaveLength(1);
    expect(undo._calls[0].type).toBe('collection_add_batch');
    expect(undo._calls[0].message).toMatch(/Added 99 cards from Commander Masters/);
  });

  it('Test 5 — undo inverse bulk-deletes new rows AND restores prevQuantity on bumped rows', async () => {
    const { db } = await import('../src/db/schema.js');
    // Pre-seed cmm-001 at quantity 2 so undo must restore it (not delete)
    await db.collection.add({
      scryfall_id: 'cmm-001',
      quantity: 2,
      foil: 0,
      category: 'owned',
      added_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      synced_at: null,
      user_id: null,
    });
    const bumpedRowBefore = await db.collection.where('scryfall_id').equals('cmm-001').first();
    const preseededId = bumpedRowBefore.id;

    await collectionStore.addAllFromPrecon('cmm');
    expect(await db.collection.count()).toBe(99);
    // After add-all, cmm-001 quantity should have been bumped to 3
    const bumpedAfter = await db.collection.where('scryfall_id').equals('cmm-001').first();
    expect(bumpedAfter.quantity).toBe(3);

    // Trigger undo via the stored restoreFn
    const entry = __alpineStores.undo._calls[0];
    expect(entry).toBeDefined();
    const invert = entry.restoreFn;
    expect(typeof invert).toBe('function');
    await invert();

    // After invert: 98 rows removed; cmm-001 restored to quantity 2
    expect(await db.collection.count()).toBe(1);
    const restoredBumped = await db.collection.get(preseededId);
    expect(restoredBumped).toBeDefined();
    expect(restoredBumped.quantity).toBe(2);
  });

  it('Test 6 — toast fires exact UI-SPEC string: "Added N cards from {name} to collection."', async () => {
    const toast = __alpineStores.toast;
    expect(toast._calls).toHaveLength(0);

    await collectionStore.addAllFromPrecon('cmm');

    // At least one success toast with the exact template
    const success = toast._calls.find((c) => c.type === 'success');
    expect(success).toBeDefined();
    expect(success.msg).toBe('Added 99 cards from Commander Masters to collection.');
  });
});

// Phase 14.07d — addAllFromPrecon now adds the FULL decklist regardless of
// bundle status. The 4B/4C iterations (block ADD ALL on multi-deck products)
// were the wrong UX: the user explicitly wants to mark a whole boxed product
// as owned, including all its bundled decks. The bundle is communicated via
// an inline warning banner (preserved) but no longer gates the action.
describe('Phase 14.07d: addAllFromPrecon multi-deck bundle (post-revert behaviour)', () => {
  let collectionStore;

  beforeEach(async () => {
    for (const k of Object.keys(__alpineStores)) delete __alpineStores[k];

    const toastCalls = [];
    __alpineStores.toast = {
      success: (msg) => toastCalls.push({ type: 'success', msg }),
      show: (msg) => toastCalls.push({ type: 'show', msg }),
      _calls: toastCalls,
    };
    const undoCalls = [];
    __alpineStores.undo = {
      stack: [],
      push: (...args) => {
        const entry = { type: args[0], data: args[1], message: args[2], commitFn: args[3], restoreFn: args[4] };
        __alpineStores.undo.stack.push(entry);
        undoCalls.push(entry);
        return entry;
      },
      _calls: undoCalls,
    };
    if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
    globalThis.window.Alpine = { store: (n) => __alpineStores[n] };

    const { db } = await import('../src/db/schema.js');
    if (db.tables.find((t) => t.name === 'precons_cache')) await db.precons_cache.clear();
    await db.collection.clear();
    const queueMod = await import('../src/services/scryfall-queue.js');
    if (typeof queueMod.__resetQueueForTests === 'function') queueMod.__resetQueueForTests();

    const { initCollectionStore } = await import('../src/stores/collection.js');
    initCollectionStore();
    collectionStore = __alpineStores.collection;

    const bundlePages = mockBundlePages('bundle-test');
    const decklist = bundlePages[0].data.map((card) => ({
      scryfall_id: card.id,
      quantity: 1,
      is_commander: false,
    }));
    collectionStore.precons = [{
      code: 'bundle-test',
      name: 'Multi-Deck Bundle Product',
      set_type: 'commander',
      released_at: '2024-01-01',
      image_url: '',
      search_uri: '',
      decklist,
      updated_at: Date.now(),
    }];
    collectionStore.preconBrowserOpen = true;
    collectionStore.selectedPreconCode = 'bundle-test';
  });

  afterEach(() => vi.restoreAllMocks());

  it('Test D1 — addAllFromPrecon writes ALL bundle rows (no early-return)', async () => {
    const { db } = await import('../src/db/schema.js');
    await collectionStore.addAllFromPrecon('bundle-test');
    expect(await db.collection.count()).toBe(250);
  });

  it('Test D2 — bundle fires the success toast with the full count', async () => {
    await collectionStore.addAllFromPrecon('bundle-test');
    const success = __alpineStores.toast._calls.find(c => c.type === 'success');
    expect(success).toBeTruthy();
    expect(success.msg).toBe('Added 250 cards from Multi-Deck Bundle Product to collection.');
  });

  it('Test D3 — bundle registers exactly one undo entry', async () => {
    await collectionStore.addAllFromPrecon('bundle-test');
    expect(__alpineStores.undo._calls).toHaveLength(1);
    expect(__alpineStores.undo._calls[0].type).toBe('collection_add_batch');
  });

  it('Test D4 — loadEntries called exactly once (batched render)', async () => {
    const loadSpy = vi.spyOn(collectionStore, 'loadEntries');
    await collectionStore.addAllFromPrecon('bundle-test');
    expect(loadSpy).toHaveBeenCalledTimes(1);
  });

  it('Test D5 — browser closes after add', async () => {
    await collectionStore.addAllFromPrecon('bundle-test');
    expect(collectionStore.preconBrowserOpen).toBe(false);
    expect(collectionStore.selectedPreconCode).toBeNull();
  });
});

describe('Phase 14.07d: precon-browser bundle banner render', () => {
  it('renderPreconBrowser HTML still surfaces a MULTI-DECK PRODUCT banner', async () => {
    if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
    const { renderPreconBrowser } = await import('../src/components/precon-browser.js');
    const html = renderPreconBrowser();
    expect(html).toMatch(/MULTI-DECK PRODUCT/);
    expect(html).toMatch(/isBundle/);
    // New banner copy — only fires on bundles, no longer gates ADD ALL.
    expect(html).toMatch(/bundles multiple decks/);
  });
});
