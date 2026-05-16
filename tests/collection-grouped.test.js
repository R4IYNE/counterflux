/**
 * Quick task 260516-08x — Grouped view aggregation.
 *
 * Tests the `grouped` getter in src/stores/collection.js that collapses
 * collection entries sharing an oracle_id into a single tile with aggregate
 * totals across printings + foil/non-foil. Conditions are not yet stored on
 * collection entries (v10 schema has no column) — when that lands, extend
 * the grouped shape with `byCondition` and gate those assertions on the
 * presence of the field.
 */
import { describe, it, expect } from 'vitest';

/**
 * Inlined replica of the `grouped` getter from src/stores/collection.js.
 * Same pattern as the existing tests/collection-store.test.js helper —
 * the store getter is plain JS over `this.entries` so we exercise it
 * against a fixtured `entries` array directly.
 */
function computeGrouped(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const card = entry.card;
    const key = card?.oracle_id || card?.name || entry.scryfall_id;
    if (!key) continue;

    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        card,
        totalQty: 0,
        foilQty: 0,
        nonFoilQty: 0,
        printings: new Set(),
        entries: [],
        estimatedValue: 0,
      };
      groups.set(key, g);
    }

    const qty = entry.quantity || 0;
    g.totalQty += qty;
    if (entry.foil) g.foilQty += qty;
    else g.nonFoilQty += qty;
    if (entry.scryfall_id) g.printings.add(entry.scryfall_id);
    g.entries.push(entry);

    const eurStr = entry.foil
      ? card?.prices?.eur_foil
      : card?.prices?.eur;
    g.estimatedValue += qty * (parseFloat(eurStr || '0') || 0);

    if (card && (!g.card || g.card === card)) {
      // first encounter — keep
    } else if (card) {
      const newPrice = parseFloat(
        (entry.foil ? card?.prices?.eur_foil : card?.prices?.eur) || '0',
      ) || 0;
      const curPrice = parseFloat(
        (g.card?.prices?.eur_foil || g.card?.prices?.eur || '0'),
      ) || 0;
      if (newPrice > curPrice) g.card = card;
    }
  }

  const out = [];
  for (const g of groups.values()) {
    out.push({
      ...g,
      printingCount: g.printings.size,
      printings: undefined,
    });
  }
  out.sort((a, b) =>
    (a.card?.name || '').localeCompare(b.card?.name || ''),
  );
  return out;
}

const boltM10 = {
  id: 'bolt-m10', oracle_id: 'oracle-bolt', name: 'Lightning Bolt',
  set: 'm10', collector_number: '146', prices: { eur: '1.20', eur_foil: '3.50' },
};
const boltStrixhaven = {
  id: 'bolt-stx', oracle_id: 'oracle-bolt', name: 'Lightning Bolt',
  set: 'stx', collector_number: '5', prices: { eur: '4.00', eur_foil: '8.00' },
};
const solRing = {
  id: 'sol-c21', oracle_id: 'oracle-sol', name: 'Sol Ring',
  set: 'c21', collector_number: '263', prices: { eur: '2.00', eur_foil: '5.00' },
};

describe('260516-08x: collection store `grouped` getter', () => {
  it('collapses entries with the same oracle_id into a single group', () => {
    const entries = [
      { id: 1, scryfall_id: 'bolt-m10', quantity: 3, foil: 0, category: 'owned', card: boltM10 },
      { id: 2, scryfall_id: 'bolt-stx', quantity: 1, foil: 0, category: 'owned', card: boltStrixhaven },
      { id: 3, scryfall_id: 'sol-c21', quantity: 1, foil: 0, category: 'owned', card: solRing },
    ];
    const groups = computeGrouped(entries);
    expect(groups).toHaveLength(2);
    const bolt = groups.find(g => g.key === 'oracle-bolt');
    expect(bolt.totalQty).toBe(4);
    expect(bolt.printingCount).toBe(2);
  });

  it('sums foil + non-foil separately', () => {
    const entries = [
      { id: 1, scryfall_id: 'bolt-m10', quantity: 3, foil: 0, category: 'owned', card: boltM10 },
      { id: 2, scryfall_id: 'bolt-m10', quantity: 1, foil: 1, category: 'owned', card: boltM10 },
      { id: 3, scryfall_id: 'bolt-stx', quantity: 2, foil: 1, category: 'owned', card: boltStrixhaven },
    ];
    const groups = computeGrouped(entries);
    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.nonFoilQty).toBe(3);
    expect(g.foilQty).toBe(3);
    expect(g.totalQty).toBe(6);
  });

  it('picks the most expensive printing as the representative card', () => {
    // Strixhaven Lightning Bolt (eur 4.00) > M10 (eur 1.20)
    const entries = [
      { id: 1, scryfall_id: 'bolt-m10', quantity: 1, foil: 0, card: boltM10 },
      { id: 2, scryfall_id: 'bolt-stx', quantity: 1, foil: 0, card: boltStrixhaven },
    ];
    const groups = computeGrouped(entries);
    expect(groups[0].card.set).toBe('stx');
  });

  it('rolls up estimated value across printings, foil-aware', () => {
    // 3x M10 non-foil @ 1.20 = 3.60
    // 2x STX foil @ 8.00 = 16.00
    // total = 19.60
    const entries = [
      { id: 1, scryfall_id: 'bolt-m10', quantity: 3, foil: 0, card: boltM10 },
      { id: 2, scryfall_id: 'bolt-stx', quantity: 2, foil: 1, card: boltStrixhaven },
    ];
    const groups = computeGrouped(entries);
    expect(groups[0].estimatedValue).toBeCloseTo(19.6, 2);
  });

  it('falls back to card.name when oracle_id is missing', () => {
    const noOracle = { ...boltM10, oracle_id: undefined };
    const entries = [
      { id: 1, scryfall_id: 'bolt-m10', quantity: 1, foil: 0, card: noOracle },
    ];
    const groups = computeGrouped(entries);
    expect(groups[0].key).toBe('Lightning Bolt');
  });

  it('preserves all entries in the group for click-through expansion', () => {
    const entries = [
      { id: 1, scryfall_id: 'bolt-m10', quantity: 3, foil: 0, card: boltM10 },
      { id: 2, scryfall_id: 'bolt-stx', quantity: 1, foil: 1, card: boltStrixhaven },
    ];
    const groups = computeGrouped(entries);
    expect(groups[0].entries).toHaveLength(2);
  });

  it('sorts groups alphabetically by card name', () => {
    const entries = [
      { id: 1, scryfall_id: 'sol-c21', quantity: 1, foil: 0, card: solRing },
      { id: 2, scryfall_id: 'bolt-m10', quantity: 1, foil: 0, card: boltM10 },
    ];
    const groups = computeGrouped(entries);
    expect(groups[0].card.name).toBe('Lightning Bolt');
    expect(groups[1].card.name).toBe('Sol Ring');
  });

  it('260516-gly sort dispatch — price desc puts most-valuable group first', () => {
    // Replica of the price branch in the store getter post-260516-gly.
    const groups = computeGrouped([
      { id: 1, scryfall_id: 'bolt-m10', quantity: 1, foil: 0, card: boltM10 }, // 1.20
      { id: 2, scryfall_id: 'sol-c21', quantity: 1, foil: 0, card: solRing },  // 2.00
    ]);
    // Apply the price-desc sort branch from the store getter
    groups.sort((a, b) => -1 * ((a.estimatedValue || 0) - (b.estimatedValue || 0)));
    expect(groups[0].card.name).toBe('Sol Ring');
    expect(groups[1].card.name).toBe('Lightning Bolt');
  });

  it('260516-gly sort dispatch — date-desc surfaces most-recently-added group first', () => {
    const groups = computeGrouped([
      { id: 1, scryfall_id: 'bolt-m10', quantity: 1, foil: 0, card: boltM10, added_at: '2025-01-01T00:00:00.000Z' },
      { id: 2, scryfall_id: 'sol-c21', quantity: 1, foil: 0, card: solRing, added_at: '2026-05-01T00:00:00.000Z' },
    ]);
    // Apply the date-desc sort branch from the store getter
    const newestOf = (g) => (g.entries || []).reduce((m, e) => {
      const t = e.added_at ? Date.parse(e.added_at) : 0;
      return t > m ? t : m;
    }, 0);
    groups.sort((a, b) => -1 * (newestOf(a) - newestOf(b)));
    expect(groups[0].card.name).toBe('Sol Ring');
    expect(groups[1].card.name).toBe('Lightning Bolt');
  });

  it('does not drop the printings Set leaving raw internals on the public shape', () => {
    const entries = [
      { id: 1, scryfall_id: 'bolt-m10', quantity: 1, foil: 0, card: boltM10 },
    ];
    const groups = computeGrouped(entries);
    expect(groups[0].printings).toBeUndefined();
    expect(typeof groups[0].printingCount).toBe('number');
  });
});
