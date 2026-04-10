import { describe, it, expect } from 'vitest';
import { computeDeckAnalytics } from '../src/utils/deck-analytics.js';

describe('computeDeckAnalytics', () => {
  it('returns zeroed analytics object for empty array', () => {
    const result = computeDeckAnalytics([]);
    expect(result.manaCurve).toEqual({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, '7+': 0 });
    expect(result.colourPie).toEqual({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
    expect(result.typeBreakdown).toEqual({});
    expect(result.tagBreakdown).toEqual({});
    expect(result.averageCmc).toBe(0);
    expect(result.totalPrice).toBe(0);
    expect(result.unownedPrice).toBe(0);
    expect(result.mostExpensive).toEqual({ name: '', price: 0 });
  });

  it('computes manaCurve correctly for 3 creatures at CMC 2, 3, 5', () => {
    const cards = [
      { quantity: 1, card: { cmc: 2, type_line: 'Creature', mana_cost: '{1}{G}', prices: {} }, tags: [], owned: true },
      { quantity: 1, card: { cmc: 3, type_line: 'Creature', mana_cost: '{2}{U}', prices: {} }, tags: [], owned: true },
      { quantity: 1, card: { cmc: 5, type_line: 'Creature', mana_cost: '{3}{R}{R}', prices: {} }, tags: [], owned: true },
    ];
    const result = computeDeckAnalytics(cards);
    expect(result.manaCurve[2]).toBe(1);
    expect(result.manaCurve[3]).toBe(1);
    expect(result.manaCurve[5]).toBe(1);
    expect(result.manaCurve[0]).toBe(0);
    expect(result.manaCurve[1]).toBe(0);
    expect(result.manaCurve[4]).toBe(0);
    expect(result.manaCurve[6]).toBe(0);
    expect(result.manaCurve['7+']).toBe(0);
  });

  it('excludes lands from mana curve', () => {
    const cards = [
      { quantity: 1, card: { cmc: 0, type_line: 'Basic Land \u2014 Island', mana_cost: '', prices: {} }, tags: [], owned: true },
      { quantity: 1, card: { cmc: 2, type_line: 'Creature', mana_cost: '{1}{U}', prices: {} }, tags: [], owned: true },
    ];
    const result = computeDeckAnalytics(cards);
    // Only the creature should be in the curve
    expect(result.manaCurve[0]).toBe(0);
    expect(result.manaCurve[2]).toBe(1);
  });

  it('counts mana symbols from mana_cost for colour pie', () => {
    const cards = [
      { quantity: 1, card: { cmc: 3, type_line: 'Creature', mana_cost: '{1}{U}{U}', prices: {} }, tags: [], owned: true },
      { quantity: 1, card: { cmc: 2, type_line: 'Instant', mana_cost: '{R}{G}', prices: {} }, tags: [], owned: true },
    ];
    const result = computeDeckAnalytics(cards);
    expect(result.colourPie.U).toBe(2);
    expect(result.colourPie.R).toBe(1);
    expect(result.colourPie.G).toBe(1);
    expect(result.colourPie.W).toBe(0);
    expect(result.colourPie.B).toBe(0);
  });

  it('groups type breakdown by classifyType result', () => {
    const cards = [
      { quantity: 1, card: { cmc: 2, type_line: 'Creature \u2014 Elf', mana_cost: '{1}{G}', prices: {} }, tags: [], owned: true },
      { quantity: 1, card: { cmc: 2, type_line: 'Artifact Creature \u2014 Golem', mana_cost: '{2}', prices: {} }, tags: [], owned: true },
      { quantity: 1, card: { cmc: 1, type_line: 'Instant', mana_cost: '{U}', prices: {} }, tags: [], owned: true },
    ];
    const result = computeDeckAnalytics(cards);
    expect(result.typeBreakdown.Creature).toBe(2); // both creatures
    expect(result.typeBreakdown.Instant).toBe(1);
  });

  it('counts tags across all cards for tag breakdown', () => {
    const cards = [
      { quantity: 1, card: { cmc: 1, type_line: 'Instant', mana_cost: '{U}', prices: {} }, tags: ['Card Draw', 'Utility'], owned: true },
      { quantity: 1, card: { cmc: 2, type_line: 'Sorcery', mana_cost: '{1}{G}', prices: {} }, tags: ['Ramp'], owned: true },
      { quantity: 1, card: { cmc: 3, type_line: 'Instant', mana_cost: '{2}{U}', prices: {} }, tags: ['Card Draw'], owned: true },
    ];
    const result = computeDeckAnalytics(cards);
    expect(result.tagBreakdown['Card Draw']).toBe(2);
    expect(result.tagBreakdown.Ramp).toBe(1);
    expect(result.tagBreakdown.Utility).toBe(1);
  });

  it('totals EUR prices converted to GBP via eurToGbpValue', () => {
    const cards = [
      { quantity: 1, card: { cmc: 1, type_line: 'Instant', mana_cost: '{U}', prices: { eur: '10.00' }, name: 'Card A' }, tags: [], owned: true },
      { quantity: 2, card: { cmc: 2, type_line: 'Creature', mana_cost: '{1}{R}', prices: { eur: '5.00' }, name: 'Card B' }, tags: [], owned: true },
    ];
    const result = computeDeckAnalytics(cards);
    // eurToGbpValue uses fallback rate 0.86: (10 + 5*2) * 0.86 = 17.20
    expect(result.totalPrice).toBeCloseTo(17.20, 1);
  });

  it('identifies most expensive card', () => {
    const cards = [
      { quantity: 1, card: { cmc: 1, type_line: 'Instant', mana_cost: '{U}', prices: { eur: '2.00' }, name: 'Cheap Card' }, tags: [], owned: true },
      { quantity: 1, card: { cmc: 5, type_line: 'Creature', mana_cost: '{3}{G}{G}', prices: { eur: '25.00' }, name: 'Expensive Card' }, tags: [], owned: true },
    ];
    const result = computeDeckAnalytics(cards);
    expect(result.mostExpensive.name).toBe('Expensive Card');
    expect(result.mostExpensive.price).toBeCloseTo(25 * 0.86, 1);
  });

  it('unownedPrice only sums cards where owned=false', () => {
    const cards = [
      { quantity: 1, card: { cmc: 1, type_line: 'Instant', mana_cost: '{U}', prices: { eur: '10.00' }, name: 'Owned' }, tags: [], owned: true },
      { quantity: 1, card: { cmc: 2, type_line: 'Creature', mana_cost: '{1}{R}', prices: { eur: '5.00' }, name: 'Missing' }, tags: [], owned: false },
    ];
    const result = computeDeckAnalytics(cards);
    // Only the unowned card: 5 * 0.86 = 4.30
    expect(result.unownedPrice).toBeCloseTo(4.30, 1);
  });

  it('averageCmc divides total CMC by non-land card count', () => {
    const cards = [
      { quantity: 1, card: { cmc: 2, type_line: 'Creature', mana_cost: '{1}{G}', prices: {} }, tags: [], owned: true },
      { quantity: 1, card: { cmc: 4, type_line: 'Creature', mana_cost: '{3}{R}', prices: {} }, tags: [], owned: true },
      { quantity: 1, card: { cmc: 0, type_line: 'Basic Land', mana_cost: '', prices: {} }, tags: [], owned: true },
    ];
    const result = computeDeckAnalytics(cards);
    // Average of 2 and 4 (land excluded) = 3
    expect(result.averageCmc).toBe(3);
  });

  it('handles quantity > 1 correctly in mana curve', () => {
    const cards = [
      { quantity: 3, card: { cmc: 2, type_line: 'Creature', mana_cost: '{1}{W}', prices: {} }, tags: [], owned: true },
    ];
    const result = computeDeckAnalytics(cards);
    expect(result.manaCurve[2]).toBe(3);
  });

  it('handles CMC 7+ in the 7+ bucket', () => {
    const cards = [
      { quantity: 1, card: { cmc: 8, type_line: 'Creature', mana_cost: '{6}{G}{G}', prices: {} }, tags: [], owned: true },
      { quantity: 1, card: { cmc: 10, type_line: 'Sorcery', mana_cost: '{8}{U}{U}', prices: {} }, tags: [], owned: true },
    ];
    const result = computeDeckAnalytics(cards);
    expect(result.manaCurve['7+']).toBe(2);
  });

  it('counts colorless mana symbols as C', () => {
    const cards = [
      { quantity: 1, card: { cmc: 2, type_line: 'Artifact', mana_cost: '{2}', prices: {} }, tags: [], owned: true },
      { quantity: 1, card: { cmc: 1, type_line: 'Creature', mana_cost: '{C}', prices: {} }, tags: [], owned: true },
    ];
    const result = computeDeckAnalytics(cards);
    expect(result.colourPie.C).toBe(1); // Only {C} counts, not generic {2}
  });

  it('PERF-04: computes analytics for 100-card deck in under 100ms', () => {
    // Simulate a full 99-card Commander deck
    const cards = Array.from({ length: 99 }, (_, i) => ({
      quantity: 1,
      card: {
        cmc: (i % 7) + 1,
        type_line: i < 30 ? 'Creature' : i < 45 ? 'Instant' : i < 60 ? 'Sorcery' : i < 70 ? 'Artifact' : i < 80 ? 'Enchantment' : 'Basic Land',
        mana_cost: `{${i % 5}}{${'WUBRG'[i % 5]}}`,
        prices: { eur: String((Math.random() * 20).toFixed(2)) },
        name: `Test Card ${i}`,
      },
      tags: ['Utility'],
      owned: i % 3 !== 0,
    }));

    const start = performance.now();
    const result = computeDeckAnalytics(cards);
    const end = performance.now();

    expect(end - start).toBeLessThan(100);
    expect(result.averageCmc).toBeGreaterThan(0);
  });
});
