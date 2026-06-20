// Regression guard for the real collection.addBatch — the headline CSV /
// mass-entry import path. A prior bug (this._clampQty vs the module-level
// _clampQty) threw a TypeError inside the Dexie transaction and imported ZERO
// cards; the existing collection-store tests use a REPLICA store, so they never
// exercised the real method. This test drives the actual store.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

const storeRegistry = {};
vi.mock('alpinejs', () => ({
  default: {
    store: (name, value) => {
      if (value !== undefined) storeRegistry[name] = value;
      return storeRegistry[name];
    },
  },
}));

import Alpine from 'alpinejs';
import { db } from '../src/db/schema.js';
import { initCollectionStore } from '../src/stores/collection.js';

beforeEach(async () => {
  await db.collection.clear();
  await db.cards.clear();
  for (const k of Object.keys(storeRegistry)) delete storeRegistry[k];
  storeRegistry.undo = { push: vi.fn() };
  // addBatch reads window.Alpine?.store('undo'); point it at the mock registry.
  globalThis.window = globalThis.window || {};
  globalThis.window.Alpine = Alpine;
  initCollectionStore();
  await db.cards.bulkPut([
    { id: 'card-a', name: 'Card A', oracle_id: 'o-a', prices: { eur: '1.00' } },
    { id: 'card-b', name: 'Card B', oracle_id: 'o-b', prices: { eur: '2.00' } },
  ]);
});

describe('collection.addBatch (real store)', () => {
  it('imports rows, clamps quantity (M31), and normalizes condition/language (M4)', async () => {
    const store = storeRegistry.collection;
    await store.addBatch(
      [
        { scryfallId: 'card-a', quantity: 3, foil: false, category: 'owned', condition: 'Good', language: 'English' },
        { scryfallId: 'card-b', quantity: -5, foil: true, category: 'owned' },
      ],
      { label: 'TEST' },
    );

    const rows = await db.collection.toArray();
    expect(rows).toHaveLength(2);

    const a = rows.find((r) => r.scryfall_id === 'card-a');
    const b = rows.find((r) => r.scryfall_id === 'card-b');

    expect(a.quantity).toBe(3);
    expect(a.condition).toBe('LP');  // 'Good' -> LP
    expect(a.language).toBe('en');   // 'English' -> en
    expect(b.quantity).toBe(1);      // -5 clamped to a positive integer (M31)
    expect(b.condition).toBe('NM');  // default
    expect(b.language).toBe('en');   // default
  });

  it('merges into an existing [scryfall_id+foil] stack without overwriting condition', async () => {
    const store = storeRegistry.collection;
    await store.addBatch([{ scryfallId: 'card-a', quantity: 2, foil: false, category: 'owned', condition: 'HP' }], {});
    await store.addBatch([{ scryfallId: 'card-a', quantity: 1, foil: false, category: 'owned', condition: 'NM' }], {});

    const rows = await db.collection.where('scryfall_id').equals('card-a').toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(3);     // 2 + 1 merged
    expect(rows[0].condition).toBe('HP'); // first stack's condition preserved
  });
});
