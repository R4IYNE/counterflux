import Alpine from 'alpinejs';
import { db } from '../db/schema.js';
import { classifyType, TYPE_ORDER } from '../utils/type-classifier.js';
import { suggestTags, DEFAULT_TAGS } from '../utils/tag-heuristics.js';
import { computeDeckAnalytics } from '../utils/deck-analytics.js';
import { logActivity } from '../services/activity.js';

// Re-export for backward compatibility
export { computeDeckAnalytics } from '../utils/deck-analytics.js';

/**
 * Initialise the Alpine deck store.
 * Call during app startup alongside initCollectionStore().
 */
export function initDeckStore() {
  Alpine.store('deck', {
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

    get groupedByType() {
      const groups = {};
      for (const entry of this.activeCards) {
        const type = classifyType(entry.card?.type_line);
        if (!groups[type]) groups[type] = [];
        groups[type].push(entry);
      }
      // Sort groups by TYPE_ORDER
      const sorted = {};
      for (const type of TYPE_ORDER) {
        if (groups[type]) sorted[type] = groups[type];
      }
      return sorted;
    },

    get analytics() {
      return computeDeckAnalytics(this.activeCards);
    },

    async loadDecks() {
      this.decks = await db.decks.orderBy('updated_at').reverse().toArray();
    },

    async createDeck({ name, format = 'commander', deck_size = 100, commander_id = null, partner_id = null, companion_id = null, color_identity = [] }) {
      const now = new Date().toISOString();
      const id = await db.decks.add({
        name,
        format,
        deck_size,
        commander_id,
        partner_id,
        companion_id,
        color_identity,
        tags: [...DEFAULT_TAGS],
        created_at: now,
        updated_at: now,
      });
      await this.loadDecks();
      logActivity('deck_created', `Created deck "${name}"`, id);
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
      let ownedSet = new Set();
      try {
        const collectionEntries = scryfallIds.length > 0
          ? await db.collection.where('scryfall_id').anyOf(scryfallIds).toArray()
          : [];
        ownedSet = new Set(collectionEntries.map(e => e.scryfall_id));
      } catch {
        // collection table may not be available in some test contexts
      }

      this.activeCards = deckCards.map(dc => ({
        ...dc,
        card: cardMap[dc.scryfall_id] || null,
        owned: ownedSet.has(dc.scryfall_id),
      }));
      this.loading = false;

      // Trigger intelligence layer fetch (non-blocking)
      const intel = Alpine.store('intelligence');
      if (intel && this.activeDeck?.commander_id) {
        const commanderCard = await db.cards.get(this.activeDeck.commander_id);
        if (commanderCard?.name) {
          intel.fetchForCommander(commanderCard.name);
          // Build deck info with commander name for Spellbook
          const deckInfo = {
            ...this.activeDeck,
            commander_name: commanderCard.name,
          };
          intel.fetchCombos(deckInfo, this.activeCards);
        }
        intel.loadDeckThresholds(deckId);
        // Gap detection is synchronous — runs immediately from local analytics
        const analytics = computeDeckAnalytics(this.activeCards);
        intel.updateGaps(analytics, this.activeDeck.deck_size || 100);
      }
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
          const card = await db.cards.get(scryfallId);
          if (card?.oracle_text?.includes('any number of cards named')) {
            await db.deck_cards.update(existing.id, { quantity: existing.quantity + 1 });
            await db.decks.update(deckId, { updated_at: new Date().toISOString() });
            await this.loadDeck(deckId);
            return { added: true };
          }
          return { warning: true, message: `${card?.name || 'Card'} is already in this deck (singleton format).` };
        }
      } else {
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
      const deckCard = await db.deck_cards.get(deckCardId);
      if (!deckCard) return;
      const card = await db.cards.get(deckCard.scryfall_id);
      const cardName = card?.name || 'card';
      const deckName = this.activeDeck.name;

      // Remove from UI immediately (optimistic)
      this.activeCards = this.activeCards.filter(c => c.id !== deckCardId);

      Alpine.store('undo').push(
        'deck_card_remove',
        deckCard,
        `Removed ${cardName} from ${deckName}.`,
        async () => {
          await db.deck_cards.delete(deckCardId);
          await db.decks.update(this.activeDeck.id, { updated_at: new Date().toISOString() });
          logActivity('deck_edited', `Removed ${cardName} from "${deckName}"`, deckCard.scryfall_id);
        },
        async () => {
          // Restore: re-add to DB and reload
          await db.deck_cards.add(deckCard);
          if (this.activeDeck) await this.loadDeck(this.activeDeck.id);
        }
      );
    },

    async updateCardTags(deckCardId, tags) {
      await db.deck_cards.update(deckCardId, { tags });
      if (this.activeDeck) await this.loadDeck(this.activeDeck.id);
    },

    async reorderCard(deckCardId, newSortOrder) {
      await db.deck_cards.update(deckCardId, { sort_order: newSortOrder });
      if (this.activeDeck) await this.loadDeck(this.activeDeck.id);
    },

    async deleteDeck(deckId) {
      const deck = await db.decks.get(deckId);
      if (!deck) return;
      const deckCards = await db.deck_cards.where('deck_id').equals(deckId).toArray();
      const deckName = deck.name;

      // Remove from UI immediately (optimistic)
      this.decks = this.decks.filter(d => d.id !== deckId);
      if (this.activeDeck?.id === deckId) {
        this.activeDeck = null;
        this.activeCards = [];
      }

      Alpine.store('undo').push(
        'deck_delete',
        { deck, deckCards },
        `Deleted deck "${deckName}".`,
        async () => {
          await db.transaction('rw', [db.decks, db.deck_cards], async () => {
            await db.deck_cards.where('deck_id').equals(deckId).delete();
            await db.decks.delete(deckId);
          });
          logActivity('deck_edited', `Deleted deck "${deckName}"`);
        },
        async () => {
          // Restore: re-add deck and cards
          await db.decks.add(deck);
          if (deckCards.length > 0) await db.deck_cards.bulkAdd(deckCards);
          await this.loadDecks();
        }
      );
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

    /**
     * Re-categorize all cards in the active deck using latest heuristics.
     * Overwrites existing tags with fresh suggestTags() results.
     */
    async recategorizeAll() {
      if (!this.activeDeck) return 0;
      const deckId = this.activeDeck.id;
      const deckCards = await db.deck_cards.where('deck_id').equals(deckId).toArray();
      let updated = 0;
      for (const dc of deckCards) {
        const card = await db.cards.get(dc.scryfall_id);
        const newTags = suggestTags(card?.oracle_text);
        await db.deck_cards.update(dc.id, { tags: newTags });
        updated++;
      }
      await db.decks.update(deckId, { tags: [...DEFAULT_TAGS], updated_at: new Date().toISOString() });
      await this.loadDeck(deckId);
      return updated;
    },

    async changeCommander(deckId, newCommanderId, newColorIdentity) {
      await db.decks.update(deckId, {
        commander_id: newCommanderId,
        color_identity: newColorIdentity,
        updated_at: new Date().toISOString(),
      });
      if (this.activeDeck?.id === deckId) {
        this.activeDeck = await db.decks.get(deckId);
      }
    },
  });
}
