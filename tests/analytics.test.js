import { describe, it, expect } from 'vitest';
import {
  computeColourBreakdown,
  computeRarityBreakdown,
  computeTopSets,
  computeTopValuable,
} from '../src/components/analytics-panel.js';

describe('computeColourBreakdown', () => {
  it('counts cards by colour identity', () => {
    const entries = [
      { quantity: 1, card: { color_identity: ['R'] } },
      { quantity: 1, card: { color_identity: ['U', 'R'] } },
      { quantity: 1, card: { color_identity: [] } },
    ];
    const result = computeColourBreakdown(entries);
    expect(result.R).toBe(2);
    expect(result.U).toBe(1);
    expect(result.C).toBe(1);
    expect(result.W).toBe(0);
    expect(result.B).toBe(0);
    expect(result.G).toBe(0);
  });

  it('handles multicolour cards counting each colour', () => {
    const entries = [
      { quantity: 2, card: { color_identity: ['W', 'U', 'B'] } },
    ];
    const result = computeColourBreakdown(entries);
    expect(result.W).toBe(2);
    expect(result.U).toBe(2);
    expect(result.B).toBe(2);
    expect(result.R).toBe(0);
  });

  it('handles colourless cards with empty identity', () => {
    const entries = [
      { quantity: 3, card: { color_identity: [] } },
    ];
    const result = computeColourBreakdown(entries);
    expect(result.C).toBe(3);
  });

  it('returns all zeros for empty collection', () => {
    const result = computeColourBreakdown([]);
    expect(result).toEqual({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, M: 0 });
  });
});

describe('computeRarityBreakdown', () => {
  it('counts cards by rarity', () => {
    const entries = [
      { quantity: 1, card: { rarity: 'common' } },
      { quantity: 1, card: { rarity: 'rare' } },
      { quantity: 1, card: { rarity: 'rare' } },
    ];
    const result = computeRarityBreakdown(entries);
    expect(result).toEqual({ common: 1, uncommon: 0, rare: 2, mythic: 0 });
  });

  it('returns all zeros for empty collection', () => {
    const result = computeRarityBreakdown([]);
    expect(result).toEqual({ common: 0, uncommon: 0, rare: 0, mythic: 0 });
  });
});

describe('computeTopSets', () => {
  it('returns sets sorted by card count descending, top 10', () => {
    const entries = [
      { quantity: 4, card: { set_name: 'Modern Horizons 2' } },
      { quantity: 1, card: { set_name: 'Masters 25' } },
      { quantity: 2, card: { set_name: 'Modern Horizons 2' } },
      { quantity: 3, card: { set_name: 'Commander Legends' } },
    ];
    const result = computeTopSets(entries);
    expect(result[0]).toEqual({ name: 'Modern Horizons 2', count: 6 });
    expect(result[1]).toEqual({ name: 'Commander Legends', count: 3 });
    expect(result[2]).toEqual({ name: 'Masters 25', count: 1 });
  });

  it('returns empty array for empty collection', () => {
    expect(computeTopSets([])).toEqual([]);
  });
});

describe('computeTopValuable', () => {
  it('sorts entries by price descending, top 10', () => {
    const entries = [
      { quantity: 1, foil: false, card: { name: 'Lightning Bolt', set_name: 'A25', prices: { eur: '2.50' } } },
      { quantity: 1, foil: false, card: { name: 'Mana Crypt', set_name: '2XM', prices: { eur: '150.00' } } },
      { quantity: 1, foil: true, card: { name: 'Sol Ring', set_name: 'CMR', prices: { eur: '3.00', eur_foil: '10.00' } } },
    ];
    const result = computeTopValuable(entries);
    expect(result[0].name).toBe('Mana Crypt');
    expect(result[0].price).toBe(150);
    expect(result[1].name).toBe('Sol Ring');
    expect(result[1].price).toBe(10);
    expect(result[2].name).toBe('Lightning Bolt');
    expect(result[2].price).toBe(2.5);
  });

  it('returns empty array for empty collection', () => {
    expect(computeTopValuable([])).toEqual([]);
  });
});
