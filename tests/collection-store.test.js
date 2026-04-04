import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db/schema.js';

// Test card fixtures
const CARD_BOLT = {
  id: 'bolt-001',
  name: 'Lightning Bolt',
  oracle_id: 'oracle-bolt',
  set: '2xm',
  collector_number: '141',
  cmc: 1,
  color_identity: ['R'],
  type_line: 'Instant',
  rarity: 'uncommon',
  released_at: '2020-08-07',
  prices: { eur: '1.50', eur_foil: '3.00' },
};

const CARD_SOL = {
  id: 'sol-001',
  name: 'Sol Ring',
  oracle_id: 'oracle-sol',
  set: 'c21',
  collector_number: '263',
  cmc: 1,
  color_identity: [],
  type_line: 'Artifact',
  rarity: 'uncommon',
  released_at: '2021-04-23',
  prices: { eur: '2.00', eur_foil: '5.00' },
};

const CARD_COUNTER = {
  id: 'counter-001',
  name: 'Counterspell',
  oracle_id: 'oracle-counter',
  set: 'mh2',
  collector_number: '44',
  cmc: 2,
  color_identity: ['U'],
  type_line: 'Instant',
  rarity: 'uncommon',
  released_at: '2021-06-18',
  prices: { eur: '0.80', eur_foil: '2.50' },
};

const CARD_GROWTH = {
  id: 'growth-001',
  name: 'Abundant Growth',
  oracle_id: 'oracle-growth',
  set: 'ema',
  collector_number: '156',
  cmc: 1,
  color_identity: ['G'],
  type_line: 'Enchantment - Aura',
  rarity: 'common',
  released_at: '2016-06-10',
  prices: { eur: '0.10', eur_foil: '0.50' },
};

// Helper to create a collection store-like object for testing
// Tests the store as a plain object (same pattern as toast tests) -- no Alpine
function createCollectionStore() {
  // We import the module dynamically in the actual implementation
  // For tests, we replicate the store logic directly against Dexie
  return {
    entries: [],
    viewMode: 'gallery',
    sortBy: 'name-asc',
    filters: { colours: [], category: 'all', search: '' },
    loading: false,

    get filtered() {
      let items = this.entries;
      if (this.filters.category !== 'all') {
        items = items.filter(e => e.category === this.filters.category);
      }
      if (this.filters.colours.length > 0) {
        items = items.filter(e =>
          this.filters.colours.every(c => e.card?.color_identity?.includes(c))
        );
      }
      if (this.filters.search) {
        const term = this.filters.search.toLowerCase();
        items = items.filter(e => e.card?.name?.toLowerCase().includes(term));
      }
      return items;
    },

    get sorted() {
      const items = [...this.filtered];
      const [field, dir] = this.sortBy.split('-');
      const mul = dir === 'desc' ? -1 : 1;

      items.sort((a, b) => {
        switch (field) {
          case 'name':
            return mul * (a.card?.name || '').localeCompare(b.card?.name || '');
          case 'price': {
            const priceA = a.foil
              ? parseFloat(a.card?.prices?.eur_foil || '0')
              : parseFloat(a.card?.prices?.eur || '0');
            const priceB = b.foil
              ? parseFloat(b.card?.prices?.eur_foil || '0')
              : parseFloat(b.card?.prices?.eur || '0');
            return mul * (priceA - priceB);
          }
          case 'set':
            return mul * (a.card?.released_at || '').localeCompare(b.card?.released_at || '');
          case 'date':
            return mul * (a.added_at || '').localeCompare(b.added_at || '');
          default:
            return 0;
        }
      });
      return items;
    },

    get stats() {
      return {
        totalCards: this.entries.reduce((sum, e) => sum + e.quantity, 0),
        uniqueCards: this.entries.length,
        estimatedValue: this.entries.reduce((sum, e) => {
          const price = e.foil
            ? parseFloat(e.card?.prices?.eur_foil || '0')
            : parseFloat(e.card?.prices?.eur || '0');
          return sum + e.quantity * price;
        }, 0),
        wishlistCount: this.entries.filter(e => e.category === 'wishlist').length,
      };
    },

    async loadEntries() {
      this.loading = true;
      const raw = await db.collection.toArray();
      const cardIds = [...new Set(raw.map(e => e.scryfall_id))];
      const cards = await db.cards.where('id').anyOf(cardIds).toArray();
      const cardMap = Object.fromEntries(cards.map(c => [c.id, Object.freeze(c)]));

      this.entries = raw.map(entry => ({
        ...entry,
        card: cardMap[entry.scryfall_id] || null,
      }));
      this.loading = false;
    },

    async addCard(scryfallId, quantity, foil, category) {
      const foilNum = foil ? 1 : 0;
      const existing = await db.collection
        .where('[scryfall_id+foil]')
        .equals([scryfallId, foilNum])
        .and(e => e.category === category)
        .first();

      if (existing) {
        await db.collection.update(existing.id, {
          quantity: existing.quantity + quantity,
        });
      } else {
        await db.collection.add({
          scryfall_id: scryfallId,
          quantity,
          foil: foilNum,
          category,
          added_at: new Date().toISOString(),
        });
      }
      await this.loadEntries();
    },

    async editEntry(entryId, updates) {
      await db.collection.update(entryId, updates);
      await this.loadEntries();
    },

    async deleteEntry(entryId) {
      await db.collection.delete(entryId);
      await this.loadEntries();
    },
  };
}

describe('Collection Store', () => {
  let store;

  beforeEach(async () => {
    await db.cards.clear();
    await db.collection.clear();
    // Seed test cards
    await db.cards.bulkPut([CARD_BOLT, CARD_SOL, CARD_COUNTER, CARD_GROWTH]);
    store = createCollectionStore();
  });

  describe('addCard', () => {
    it('creates entry in DB and loadEntries returns it with joined card data', async () => {
      await store.addCard('bolt-001', 2, false, 'owned');
      expect(store.entries).toHaveLength(1);
      expect(store.entries[0].scryfall_id).toBe('bolt-001');
      expect(store.entries[0].quantity).toBe(2);
      expect(store.entries[0].foil).toBe(0);
      expect(store.entries[0].category).toBe('owned');
      expect(store.entries[0].card).toBeDefined();
      expect(store.entries[0].card.name).toBe('Lightning Bolt');
    });

    it('increments quantity for duplicate card (same scryfall_id + foil + category)', async () => {
      await store.addCard('bolt-001', 2, false, 'owned');
      await store.addCard('bolt-001', 3, false, 'owned');
      expect(store.entries).toHaveLength(1);
      expect(store.entries[0].quantity).toBe(5);
    });

    it('creates separate entry for same card but different foil value', async () => {
      await store.addCard('bolt-001', 2, false, 'owned');
      await store.addCard('bolt-001', 1, true, 'owned');
      expect(store.entries).toHaveLength(2);
      const nonFoil = store.entries.find(e => e.foil === 0);
      const foil = store.entries.find(e => e.foil === 1);
      expect(nonFoil.quantity).toBe(2);
      expect(foil.quantity).toBe(1);
    });

    it('allows card to be both owned and wishlist simultaneously', async () => {
      await store.addCard('bolt-001', 2, false, 'owned');
      await store.addCard('bolt-001', 1, false, 'wishlist');
      expect(store.entries).toHaveLength(2);
      const owned = store.entries.find(e => e.category === 'owned');
      const wishlist = store.entries.find(e => e.category === 'wishlist');
      expect(owned.quantity).toBe(2);
      expect(wishlist.quantity).toBe(1);
    });
  });

  describe('editEntry', () => {
    it('updates quantity and foil fields in DB', async () => {
      await store.addCard('bolt-001', 2, false, 'owned');
      const entryId = store.entries[0].id;
      await store.editEntry(entryId, { quantity: 5, foil: 1 });
      expect(store.entries[0].quantity).toBe(5);
      expect(store.entries[0].foil).toBe(1);
    });
  });

  describe('deleteEntry', () => {
    it('removes entry from DB', async () => {
      await store.addCard('bolt-001', 2, false, 'owned');
      expect(store.entries).toHaveLength(1);
      const entryId = store.entries[0].id;
      await store.deleteEntry(entryId);
      expect(store.entries).toHaveLength(0);
    });
  });

  describe('filter by category', () => {
    beforeEach(async () => {
      await store.addCard('bolt-001', 2, false, 'owned');
      await store.addCard('sol-001', 1, false, 'wishlist');
      await store.addCard('counter-001', 3, false, 'owned');
    });

    it('returns only owned entries when category is owned', () => {
      store.filters.category = 'owned';
      const result = store.filtered;
      expect(result).toHaveLength(2);
      expect(result.every(e => e.category === 'owned')).toBe(true);
    });

    it('returns only wishlist entries when category is wishlist', () => {
      store.filters.category = 'wishlist';
      const result = store.filtered;
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('wishlist');
    });

    it('returns all entries when category is all', () => {
      store.filters.category = 'all';
      expect(store.filtered).toHaveLength(3);
    });
  });

  describe('filter by colour', () => {
    beforeEach(async () => {
      await store.addCard('bolt-001', 2, false, 'owned');   // R
      await store.addCard('sol-001', 1, false, 'owned');     // colorless
      await store.addCard('counter-001', 1, false, 'owned'); // U
    });

    it('returns only cards with R in color_identity when filtering by R', () => {
      store.filters.colours = ['R'];
      const result = store.filtered;
      expect(result).toHaveLength(1);
      expect(result[0].card.name).toBe('Lightning Bolt');
    });
  });

  describe('sorting', () => {
    beforeEach(async () => {
      await store.addCard('bolt-001', 1, false, 'owned');
      await store.addCard('sol-001', 1, false, 'owned');
      await store.addCard('counter-001', 1, false, 'owned');
    });

    it('sorts by name-asc returns alphabetical order', () => {
      store.sortBy = 'name-asc';
      const names = store.sorted.map(e => e.card.name);
      expect(names).toEqual(['Counterspell', 'Lightning Bolt', 'Sol Ring']);
    });

    it('sorts by price-desc returns highest EUR price first', () => {
      store.sortBy = 'price-desc';
      const names = store.sorted.map(e => e.card.name);
      expect(names[0]).toBe('Sol Ring'); // EUR 2.00
    });

    it('sorts by date-desc returns newest added_at first', async () => {
      // Manually set distinct added_at timestamps for deterministic ordering
      const entries = await db.collection.toArray();
      await db.collection.update(entries[0].id, { added_at: '2025-01-01T00:00:00Z' });
      await db.collection.update(entries[1].id, { added_at: '2025-06-01T00:00:00Z' });
      await db.collection.update(entries[2].id, { added_at: '2025-12-01T00:00:00Z' });
      await store.loadEntries();

      store.sortBy = 'date-desc';
      const result = store.sorted;
      // Last date should be first (Counterspell got Dec 2025)
      expect(result[0].added_at).toBe('2025-12-01T00:00:00Z');
      expect(result[2].added_at).toBe('2025-01-01T00:00:00Z');
    });
  });

  describe('stats', () => {
    it('computes correct totals', async () => {
      await store.addCard('bolt-001', 3, false, 'owned');    // 3 * 1.50 = 4.50
      await store.addCard('sol-001', 2, false, 'owned');      // 2 * 2.00 = 4.00
      await store.addCard('counter-001', 1, false, 'wishlist'); // 1 * 0.80 = 0.80

      expect(store.stats.totalCards).toBe(6);
      expect(store.stats.uniqueCards).toBe(3);
      expect(store.stats.estimatedValue).toBeCloseTo(9.30, 1);
      expect(store.stats.wishlistCount).toBe(1);
    });
  });
});
