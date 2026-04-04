import Alpine from 'alpinejs';
import { db } from '../db/schema.js';

/**
 * Sort collection entries by the given sort key.
 * @param {Array} items - Collection entries with joined card data
 * @param {string} sortBy - Sort key (e.g., 'name-asc', 'price-desc')
 * @returns {Array} Sorted copy of the entries
 */
function sortEntries(items, sortBy) {
  const sorted = [...items];
  const [field, dir] = sortBy.split('-');
  const mul = dir === 'desc' ? -1 : 1;

  sorted.sort((a, b) => {
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
  return sorted;
}

/**
 * Initialise the Alpine collection store.
 * Call during app startup alongside initAppStore().
 */
export function initCollectionStore() {
  Alpine.store('collection', {
    entries: [],
    viewMode: 'gallery',
    sortBy: 'name-asc',
    filters: {
      colours: [],
      category: 'all',
      search: '',
    },
    analyticsOpen: false,
    loading: false,
    massEntryOpen: false,
    importOpen: false,
    addCardOpen: false,

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
      return sortEntries(this.filtered, this.sortBy);
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

    async addBatch(entries) {
      let added = 0;
      for (const entry of entries) {
        await this.addCard(
          entry.scryfallId,
          entry.quantity || 1,
          entry.foil || false,
          entry.category || 'owned'
        );
        added++;
      }
      return { added };
    },

    setViewMode(mode) {
      this.viewMode = mode;
    },

    setSortBy(sort) {
      this.sortBy = sort;
    },

    toggleColour(colour) {
      const idx = this.filters.colours.indexOf(colour);
      if (idx === -1) {
        this.filters.colours.push(colour);
      } else {
        this.filters.colours.splice(idx, 1);
      }
    },

    setCategory(category) {
      this.filters.category = category;
    },
  });
}
