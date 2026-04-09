import { describe, it, expect } from 'vitest';

// Test card data
const CARDS = [
  {
    id: 'card-1',
    name: 'Lightning Bolt',
    color_identity: ['R'],
    rarity: 'uncommon',
    type_line: 'Instant',
    released_at: new Date().toISOString().slice(0, 10), // today
  },
  {
    id: 'card-2',
    name: 'Counterspell',
    color_identity: ['U'],
    rarity: 'uncommon',
    type_line: 'Instant',
    released_at: '2021-06-18',
  },
  {
    id: 'card-3',
    name: 'Sol Ring',
    color_identity: [],
    rarity: 'uncommon',
    type_line: 'Artifact',
    released_at: '2021-04-23',
  },
  {
    id: 'card-4',
    name: 'Wrath of God',
    color_identity: ['W'],
    rarity: 'rare',
    type_line: 'Sorcery',
    released_at: '2020-01-01',
  },
  {
    id: 'card-5',
    name: 'Izzet Charm',
    color_identity: ['U', 'R'],
    rarity: 'uncommon',
    type_line: 'Instant',
    released_at: '2023-01-01',
  },
];

/**
 * Apply spoiler filters to a card array (matches the store's _applyFilters logic).
 */
function applyFilters(cards, filters) {
  let filtered = cards;

  if (filters.colours && filters.colours.length > 0) {
    filtered = filtered.filter(c =>
      filters.colours.every(col => (c.color_identity || []).includes(col))
    );
  }

  if (filters.rarity && filters.rarity !== 'all') {
    filtered = filtered.filter(c => c.rarity === filters.rarity);
  }

  if (filters.type && filters.type !== 'all') {
    filtered = filtered.filter(c =>
      (c.type_line || '').toLowerCase().includes(filters.type.toLowerCase())
    );
  }

  return filtered;
}

/**
 * Check if a card is "new" (released within 48 hours).
 */
function isNewCard(releasedAt) {
  if (!releasedAt) return false;
  const releaseDate = new Date(releasedAt);
  const now = new Date();
  const diffMs = now - releaseDate;
  return diffMs >= 0 && diffMs <= 48 * 60 * 60 * 1000;
}

describe('spoiler filters', () => {
  it('colour filter returns only matching color_identity cards', () => {
    const result = applyFilters(CARDS, { colours: ['R'], rarity: 'all', type: 'all' });
    expect(result).toHaveLength(2); // Lightning Bolt (R) and Izzet Charm (U, R)
    expect(result.every(c => c.color_identity.includes('R'))).toBe(true);
  });

  it('rarity filter returns only matching rarity', () => {
    const result = applyFilters(CARDS, { colours: [], rarity: 'rare', type: 'all' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Wrath of God');
  });

  it('type filter returns only cards with matching type_line', () => {
    const result = applyFilters(CARDS, { colours: [], rarity: 'all', type: 'artifact' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Sol Ring');
  });

  it('combined filters (colour + rarity) intersect correctly', () => {
    const result = applyFilters(CARDS, { colours: ['R'], rarity: 'uncommon', type: 'all' });
    // Lightning Bolt (R, uncommon) and Izzet Charm (U+R, uncommon)
    expect(result).toHaveLength(2);
    expect(result.every(c => c.color_identity.includes('R') && c.rarity === 'uncommon')).toBe(true);
  });

  it('NEW badge logic: card released within 48 hours returns true', () => {
    const now = new Date();
    expect(isNewCard(now.toISOString().slice(0, 10))).toBe(true);

    // A card released 3 days ago is not new
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    expect(isNewCard(threeDaysAgo.toISOString().slice(0, 10))).toBe(false);
  });
});
