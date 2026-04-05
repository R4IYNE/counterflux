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
  mana_cost: '{R}',
  oracle_text: 'Lightning Bolt deals 3 damage to any target.',
  keywords: [],
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
  mana_cost: '{1}',
  oracle_text: '{T}: Add {C}{C}.',
  keywords: [],
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
  mana_cost: '{U}{U}',
  oracle_text: 'Counter target spell.',
  keywords: [],
  prices: { eur: '0.80', eur_foil: '2.50' },
};

const CARD_RATS = {
  id: 'rats-001',
  name: 'Rat Colony',
  oracle_id: 'oracle-rats',
  set: 'dom',
  collector_number: '101',
  cmc: 2,
  color_identity: ['B'],
  type_line: 'Creature \u2014 Rat',
  mana_cost: '{1}{B}',
  oracle_text: 'Rat Colony gets +1/+0 for each other Rat you control.\nA deck can have any number of cards named Rat Colony.',
  keywords: [],
  prices: { eur: '0.20' },
};

/**
 * Create a deck store as a plain object for testing (same pattern as collection-store.test.js).
 * The store operates directly against Dexie without Alpine.
 */
function createDeckStore() {
  // We re-implement the core store logic for testing against real Dexie
  return {
    decks: [],
    activeDeck: null,
    activeCards: [],
    viewMode: 'grid',
    loading: false,

    get cardCount() {
      return this.activeCards.reduce((sum, c) => sum + c.quantity, 0);
    },

    get slotsRemaining() {
      return this.activeDeck ? this.activeDeck.deck_size - this.cardCount : 0;
    },

    async loadDecks() {
      this.decks = await db.decks.orderBy('updated_at').reverse().toArray();
    },

    async createDeck({ name, format = 'commander', deck_size = 100, commander_id = null, color_identity = [] }) {
      const now = new Date().toISOString();
      const id = await db.decks.add({
        name,
        format,
        deck_size,
        commander_id,
        partner_id: null,
        companion_id: null,
        color_identity,
        tags: ['Ramp', 'Card Draw', 'Removal', 'Board Wipes', 'Win Conditions', 'Protection', 'Recursion', 'Utility'],
        created_at: now,
        updated_at: now,
      });
      await this.loadDecks();
      return id;
    },

    async loadDeck(deckId) {
      this.loading = true;
      this.activeDeck = await db.decks.get(deckId);
      const deckCards = await db.deck_cards.where('deck_id').equals(deckId).toArray();
      const scryfallIds = [...new Set(deckCards.map(dc => dc.scryfall_id))];
      const cards = scryfallIds.length > 0
        ? await db.cards.where('id').anyOf(scryfallIds).toArray()
        : [];
      const cardMap = Object.fromEntries(cards.map(c => [c.id, Object.freeze(c)]));

      // Check owned status from collection
      const collectionEntries = scryfallIds.length > 0
        ? await db.collection.where('scryfall_id').anyOf(scryfallIds).toArray()
        : [];
      const ownedSet = new Set(collectionEntries.map(e => e.scryfall_id));

      this.activeCards = deckCards.map(dc => ({
        ...dc,
        card: cardMap[dc.scryfall_id] || null,
        owned: ownedSet.has(dc.scryfall_id),
      }));
      this.loading = false;
    },

    async addCard(scryfallId, tags) {
      if (!this.activeDeck) return;
      const deckId = this.activeDeck.id;
      const format = this.activeDeck.format;

      // Check singleton rule for commander format
      if (format === 'commander') {
        const existing = await db.deck_cards
          .where('[deck_id+scryfall_id]')
          .equals([deckId, scryfallId])
          .first();

        if (existing) {
          // Check for "any number of cards named" exemption
          const card = await db.cards.get(scryfallId);
          if (card?.oracle_text?.includes('any number of cards named')) {
            // Exempt from singleton rule — increment quantity
            await db.deck_cards.update(existing.id, { quantity: existing.quantity + 1 });
            await db.decks.update(deckId, { updated_at: new Date().toISOString() });
            await this.loadDeck(deckId);
            return { added: true };
          }
          return { warning: true, message: `${card?.name || 'Card'} is already in this deck (singleton format).` };
        }
      } else {
        // Non-commander: increment quantity if exists
        const existing = await db.deck_cards
          .where('[deck_id+scryfall_id]')
          .equals([deckId, scryfallId])
          .first();
        if (existing) {
          await db.deck_cards.update(existing.id, { quantity: existing.quantity + 1 });
          await db.decks.update(deckId, { updated_at: new Date().toISOString() });
          await this.loadDeck(deckId);
          return { added: true };
        }
      }

      // Auto-suggest tags if not provided
      let cardTags = tags;
      if (!cardTags) {
        const card = await db.cards.get(scryfallId);
        const { suggestTags } = await import('../src/utils/tag-heuristics.js');
        cardTags = suggestTags(card?.oracle_text);
      }

      await db.deck_cards.add({
        deck_id: deckId,
        scryfall_id: scryfallId,
        quantity: 1,
        tags: cardTags || [],
        sort_order: 0,
      });
      await db.decks.update(deckId, { updated_at: new Date().toISOString() });
      await this.loadDeck(deckId);
      return { added: true };
    },

    async removeCard(deckCardId) {
      if (!this.activeDeck) return;
      await db.deck_cards.delete(deckCardId);
      await db.decks.update(this.activeDeck.id, { updated_at: new Date().toISOString() });
      await this.loadDeck(this.activeDeck.id);
    },

    async updateCardTags(deckCardId, tags) {
      await db.deck_cards.update(deckCardId, { tags });
      if (this.activeDeck) await this.loadDeck(this.activeDeck.id);
    },

    async deleteDeck(deckId) {
      await db.transaction('rw', [db.decks, db.deck_cards], async () => {
        await db.deck_cards.where('deck_id').equals(deckId).delete();
        await db.decks.delete(deckId);
      });
      if (this.activeDeck?.id === deckId) {
        this.activeDeck = null;
        this.activeCards = [];
      }
      await this.loadDecks();
    },

    async duplicateDeck(deckId) {
      const deck = await db.decks.get(deckId);
      if (!deck) return;
      const now = new Date().toISOString();
      const newId = await db.decks.add({
        ...deck,
        id: undefined,
        name: deck.name + ' (Copy)',
        created_at: now,
        updated_at: now,
      });
      const cards = await db.deck_cards.where('deck_id').equals(deckId).toArray();
      for (const card of cards) {
        await db.deck_cards.add({
          ...card,
          id: undefined,
          deck_id: newId,
        });
      }
      await this.loadDecks();
      return newId;
    },

    async renameDeck(deckId, newName) {
      await db.decks.update(deckId, { name: newName, updated_at: new Date().toISOString() });
      await this.loadDecks();
      if (this.activeDeck?.id === deckId) {
        this.activeDeck = await db.decks.get(deckId);
      }
    },
  };
}

describe('Deck Store', () => {
  let store;

  beforeEach(async () => {
    await db.cards.clear();
    await db.collection.clear();
    await db.decks.clear();
    await db.deck_cards.clear();
    // Seed test cards
    await db.cards.bulkPut([CARD_BOLT, CARD_SOL, CARD_COUNTER, CARD_RATS]);
    store = createDeckStore();
  });

  describe('createDeck', () => {
    it('inserts a deck into db.decks and returns id', async () => {
      const id = await store.createDeck({
        name: 'Test Deck',
        format: 'commander',
        deck_size: 100,
        commander_id: null,
        color_identity: ['U', 'R'],
      });
      expect(id).toBeDefined();
      expect(typeof id).toBe('number');
      const deck = await db.decks.get(id);
      expect(deck.name).toBe('Test Deck');
      expect(deck.format).toBe('commander');
      expect(deck.deck_size).toBe(100);
    });
  });

  describe('loadDecks', () => {
    it('populates store.decks sorted by updated_at desc', async () => {
      await store.createDeck({ name: 'Old Deck' });
      // Add a small delay to ensure different timestamps
      await new Promise(r => setTimeout(r, 10));
      await store.createDeck({ name: 'New Deck' });
      await store.loadDecks();
      expect(store.decks).toHaveLength(2);
      expect(store.decks[0].name).toBe('New Deck');
      expect(store.decks[1].name).toBe('Old Deck');
    });
  });

  describe('loadDeck', () => {
    it('sets activeDeck and activeCards with joined Scryfall card data', async () => {
      const deckId = await store.createDeck({ name: 'My Deck' });
      await store.loadDeck(deckId);
      await store.addCard('bolt-001', ['Removal']);
      expect(store.activeDeck.name).toBe('My Deck');
      expect(store.activeCards).toHaveLength(1);
      expect(store.activeCards[0].card.name).toBe('Lightning Bolt');
    });
  });

  describe('addCard', () => {
    it('inserts deck_card record and reloads', async () => {
      const deckId = await store.createDeck({ name: 'My Deck' });
      await store.loadDeck(deckId);
      await store.addCard('bolt-001', ['Removal']);
      expect(store.activeCards).toHaveLength(1);
      expect(store.activeCards[0].scryfall_id).toBe('bolt-001');
      expect(store.activeCards[0].quantity).toBe(1);
    });

    it('returns warning for duplicate in commander format (singleton)', async () => {
      const deckId = await store.createDeck({ name: 'Commander Deck', format: 'commander' });
      await store.loadDeck(deckId);
      await store.addCard('bolt-001', ['Removal']);
      const result = await store.addCard('bolt-001', ['Removal']);
      expect(result.warning).toBe(true);
      expect(result.message).toContain('already in this deck');
      expect(store.activeCards).toHaveLength(1); // still 1
    });

    it('allows singleton-exempt cards (any number of cards named) to add duplicate', async () => {
      const deckId = await store.createDeck({ name: 'Commander Deck', format: 'commander' });
      await store.loadDeck(deckId);
      await store.addCard('rats-001', []);
      const result = await store.addCard('rats-001', []);
      expect(result.warning).toBeUndefined();
      expect(store.activeCards).toHaveLength(1);
      expect(store.activeCards[0].quantity).toBe(2);
    });

    it('increments quantity for duplicate in 60-card format', async () => {
      const deckId = await store.createDeck({ name: 'Standard Deck', format: 'standard', deck_size: 60 });
      await store.loadDeck(deckId);
      await store.addCard('bolt-001', ['Removal']);
      await store.addCard('bolt-001', ['Removal']);
      expect(store.activeCards).toHaveLength(1);
      expect(store.activeCards[0].quantity).toBe(2);
    });
  });

  describe('removeCard', () => {
    it('deletes record and decrements card count', async () => {
      const deckId = await store.createDeck({ name: 'My Deck' });
      await store.loadDeck(deckId);
      await store.addCard('bolt-001', ['Removal']);
      expect(store.cardCount).toBe(1);
      const cardId = store.activeCards[0].id;
      await store.removeCard(cardId);
      expect(store.cardCount).toBe(0);
      expect(store.activeCards).toHaveLength(0);
    });
  });

  describe('updateCardTags', () => {
    it('updates tags array on deck_card record', async () => {
      const deckId = await store.createDeck({ name: 'My Deck' });
      await store.loadDeck(deckId);
      await store.addCard('bolt-001', ['Removal']);
      const cardId = store.activeCards[0].id;
      await store.updateCardTags(cardId, ['Removal', 'Win Conditions']);
      expect(store.activeCards[0].tags).toEqual(['Removal', 'Win Conditions']);
    });
  });

  describe('deleteDeck', () => {
    it('removes deck and all its deck_cards', async () => {
      const deckId = await store.createDeck({ name: 'My Deck' });
      await store.loadDeck(deckId);
      await store.addCard('bolt-001', []);
      await store.addCard('sol-001', []);
      await store.deleteDeck(deckId);
      expect(store.activeDeck).toBeNull();
      expect(store.activeCards).toEqual([]);
      const remaining = await db.deck_cards.where('deck_id').equals(deckId).count();
      expect(remaining).toBe(0);
    });
  });

  describe('duplicateDeck', () => {
    it('creates copy with "(Copy)" suffix', async () => {
      const deckId = await store.createDeck({ name: 'My Deck' });
      await store.loadDeck(deckId);
      await store.addCard('bolt-001', []);
      const newId = await store.duplicateDeck(deckId);
      expect(newId).toBeDefined();
      const newDeck = await db.decks.get(newId);
      expect(newDeck.name).toBe('My Deck (Copy)');
      const newCards = await db.deck_cards.where('deck_id').equals(newId).toArray();
      expect(newCards).toHaveLength(1);
    });
  });

  describe('renameDeck', () => {
    it('updates deck name', async () => {
      const deckId = await store.createDeck({ name: 'My Deck' });
      await store.loadDeck(deckId);
      await store.renameDeck(deckId, 'Renamed Deck');
      expect(store.activeDeck.name).toBe('Renamed Deck');
    });
  });

  describe('cardCount getter', () => {
    it('returns total quantity of cards in active deck', async () => {
      const deckId = await store.createDeck({ name: 'Deck', format: 'standard', deck_size: 60 });
      await store.loadDeck(deckId);
      await store.addCard('bolt-001', []);
      await store.addCard('bolt-001', []);
      await store.addCard('sol-001', []);
      expect(store.cardCount).toBe(3); // 2 bolts + 1 sol ring
    });
  });

  describe('slotsRemaining getter', () => {
    it('returns deck_size minus cardCount', async () => {
      const deckId = await store.createDeck({ name: 'Deck', deck_size: 100 });
      await store.loadDeck(deckId);
      await store.addCard('bolt-001', []);
      expect(store.slotsRemaining).toBe(99);
    });
  });
});
