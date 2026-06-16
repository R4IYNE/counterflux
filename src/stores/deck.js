import Alpine from 'alpinejs';
import { db } from '../db/schema.js';
import { classifyType, TYPE_ORDER } from '../utils/type-classifier.js';
import { suggestTags, DEFAULT_TAGS } from '../utils/tag-heuristics.js';
import { computeDeckAnalytics } from '../utils/deck-analytics.js';
import { matchesDeckFilter } from '../utils/deck-filter.js';
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
    deckFilter: { type: 'All', cmc: 'All', owned: 'All', colours: null },

    setDeckFilter(patch) {
      this.deckFilter = { ...this.deckFilter, ...patch };
    },

    get cardCount() {
      return this.activeCards.reduce((sum, c) => sum + c.quantity, 0);
    },

    get slotsRemaining() {
      return this.activeDeck ? this.activeDeck.deck_size - this.cardCount : 0;
    },

    get groupedByType() {
      const groups = {};
      for (const entry of this.activeCards) {
        if (!matchesDeckFilter(entry, this.deckFilter)) continue;
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
      const rows = await db.decks.orderBy('updated_at').reverse().toArray();
      // Alpine reactivity gotcha — pre-init the reactive keys deck-landing
      // mutates (`_cardCount`, `_commanderCard`) BEFORE assigning to this.decks.
      // Properties absent at Proxy-wrap time get no subscribers; later writes
      // are silently dropped from the dep graph. See enrichDecks in
      // src/components/deck-landing.js. Do NOT remove this loop.
      for (const d of rows) {
        if (d._cardCount === undefined) d._cardCount = 0;
        if (d._commanderCard === undefined) d._commanderCard = null;
      }
      this.decks = rows;
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

      // Intelligence + analytics layer — DEFERRED to a separate macrotask so a
      // slow or failing EDHREC fetch (e.g. a commander EDHREC has no page for,
      // which 403s after the full proxy timeout — twice, for synergies +
      // combos = ~30s) can NEVER delay loadDeck resolving, and thus can never
      // delay the deck editor opening. Fire-and-forget; the panels show their
      // own loading/empty states and the intelligence store toasts on failure.
      setTimeout(() => {
        void (async () => {
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
            // Gap detection is synchronous — runs from local analytics.
            const analytics = computeDeckAnalytics(this.activeCards);
            intel.updateGaps(analytics, this.activeDeck.deck_size || 100, this.activeDeck.tags || []);
          }
        })().catch((err) => console.warn('[deck] intelligence load failed', err));
      }, 0);
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
          // Commander singleton rule has TWO exemptions:
          //  1. Basic lands — unlimited copies (Mountain, Forest, etc.)
          //  2. Cards with "any number of cards named" oracle text
          //     (Shadowborn Apostle, Rat Colony, Persistent Petitioners, etc.)
          // Both should bump quantity instead of returning a singleton warning.
          const isBasicLand = /Basic\s+Land/i.test(card?.type_line || '');
          const isAnyNumber = card?.oracle_text?.includes('any number of cards named');
          if (isBasicLand || isAnyNumber) {
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

      // Auto-suggest tags if not provided.
      // Pass type_line so basic lands (Mountain, Forest, etc.) skip
      // functional categorisation — without this guard their oracle text
      // ("{T}: Add {R}.") matches the Ramp regex and they tag as Ramp.
      let cardTags = tags;
      if (!cardTags) {
        const card = await db.cards.get(scryfallId);
        cardTags = suggestTags(card?.oracle_text, card?.type_line);
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

    /**
     * Set a deck card's quantity directly. Used by the basic-land tile
     * +/- steppers (v1.2 hot-fix). When `quantity <= 0`, removes the card
     * via the existing removeCard path (preserves undo + activity log).
     *
     * Returns { added: true } on success, { error: true } on failure.
     */
    async updateCardQuantity(deckCardId, quantity) {
      if (!this.activeDeck) return { error: true };
      const deckCard = await db.deck_cards.get(deckCardId);
      if (!deckCard) return { error: true };
      if (quantity <= 0) {
        return this.removeCard(deckCardId);
      }
      await db.deck_cards.update(deckCardId, { quantity });
      await db.decks.update(this.activeDeck.id, { updated_at: new Date().toISOString() });
      // Optimistic local mutation so the tile re-renders without a full
      // reload (loadDeck() also fires below for canonical state).
      this.activeCards = this.activeCards.map((c) =>
        c.id === deckCardId ? { ...c, quantity } : c
      );
      await this.loadDeck(this.activeDeck.id);
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
      // Remove from the UI FIRST — synchronously, before any await — so the tile
      // vanishes (and the confirm modal closes) instantly even when Dexie is
      // busy. The snapshot reads below are tiny but can stall behind a
      // background sync/worker transaction that locks the object stores; gating
      // the UI on them is what made delete feel like it took ~20s. The deferred
      // hard-delete is always scheduled below, so the UI and DB can't drift.
      const wasActive = this.activeDeck?.id === deckId;
      this.decks = this.decks.filter(d => d.id !== deckId);
      if (wasActive) {
        this.activeDeck = null;
        this.activeCards = [];
      }

      // Snapshot the clean DB rows for undo (best-effort), then register the
      // 10s deferred delete + undo toast. Runs after the UI update, off the
      // caller's critical path.
      let deck = null;
      let deckCards = [];
      try {
        deck = await db.decks.get(deckId);
        deckCards = await db.deck_cards.where('deck_id').equals(deckId).toArray();
      } catch {
        // Snapshot is best-effort — the delete is still scheduled below.
      }
      const deckName = deck?.name || 'deck';

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
          // Restore: re-add deck and cards (deck may be null if the snapshot
          // read failed — nothing to restore in that case).
          if (deck) await db.decks.add(deck);
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
        // Pass type_line so basic lands skip functional categorisation
        // (otherwise re-categorisation would re-tag them as Ramp).
        const newTags = suggestTags(card?.oracle_text, card?.type_line);
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
