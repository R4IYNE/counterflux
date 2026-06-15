// Feature #7 — deckFilter wiring. Verifies the real initDeckStore()
// groupedByType getter filters activeCards through matchesDeckFilter.
// Mocks alpinejs with a store registry (matches deckgen-store.test.js).

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
import { initDeckStore } from '../src/stores/deck.js';

beforeEach(() => {
  for (const k of Object.keys(storeRegistry)) delete storeRegistry[k];
  initDeckStore();
});

describe('deck store — deckFilter', () => {
  it('groupedByType is unchanged by the default (pass-through) deckFilter', () => {
    const store = Alpine.store('deck');
    store.activeCards = [
      { id: '1', card: { type_line: 'Creature', cmc: 2, color_identity: [] }, owned: true },
      { id: '2', card: { type_line: 'Instant', cmc: 1, color_identity: [] }, owned: true },
    ];
    const flat = Object.values(store.groupedByType).flat();
    expect(flat.map(e => e.id).sort()).toEqual(['1', '2']);
  });

  it('groupedByType respects deckFilter (type)', () => {
    const store = Alpine.store('deck');
    store.activeCards = [
      { id: '1', card: { type_line: 'Creature', cmc: 2, color_identity: [] }, owned: true },
      { id: '2', card: { type_line: 'Instant', cmc: 1, color_identity: [] }, owned: true },
    ];
    store.setDeckFilter({ type: 'Creature' });
    const flat = Object.values(store.groupedByType).flat();
    expect(flat.map(e => e.id)).toEqual(['1']);
  });
});
