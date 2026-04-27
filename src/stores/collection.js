import Alpine from 'alpinejs';
import { db } from '../db/schema.js';
import { logActivity } from '../services/activity.js';
import { queueScryfallRequest } from '../services/scryfall-queue.js';
import { fetchPrecons, fetchPreconDecklist, invalidatePreconsCache } from '../services/precons.js';

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
    // Phase 8 Plan 2 — COLLECT-06 LHS panel open state. Pitfall 6: null (first
    // boot) defaults to OPEN per D-03; subsequent state persists to localStorage
    // key `tc_panel_open`.
    panelOpen: (() => {
      try {
        const stored = typeof localStorage !== 'undefined'
          ? localStorage.getItem('tc_panel_open')
          : null;
        if (stored === null) return true;
        return stored === 'true';
      } catch {
        return true;
      }
    })(),
    // Phase 8 Plan 2 — COLLECT-04 printing picker state (in-memory, per-card).
    // Keyed by the oracle card's scryfall id (card.id from search result).
    printingsByCardId: {},      // { [cardId]: { loading, error, printings: [] } }
    activePrintingIdByCard: {}, // { [cardId]: printingId }

    // Phase 8 Plan 3 — COLLECT-02 precon browser state.
    preconBrowserOpen: false,
    selectedPreconCode: null,
    preconsLoading: false,
    preconsError: null,
    precons: [], // sorted newest-first by fetchPrecons() (D-12)
    preconDecklistLoading: false,
    preconDecklistError: null,

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

      // Log activity
      const card = await db.cards.get(scryfallId);
      logActivity('card_added', `Added ${quantity || 1}x ${card?.name || 'card'} to collection`, scryfallId);
    },

    async editEntry(entryId, updates) {
      await db.collection.update(entryId, updates);
      await this.loadEntries();
    },

    async deleteEntry(entryId) {
      const entry = await db.collection.get(entryId);
      if (!entry) return;
      const card = await db.cards.get(entry.scryfall_id);
      const cardName = card?.name || 'card';

      // Remove from UI immediately (optimistic)
      this.entries = this.entries.filter(e => e.id !== entryId);

      // Defer actual DB deletion via undo system (D-09, D-10)
      Alpine.store('undo').push(
        'collection_remove',
        entry,
        `Removed ${cardName} from collection.`,
        async () => {
          await db.collection.delete(entryId);
          logActivity('card_removed', `Removed ${cardName} from collection`, entry.scryfall_id);
        },
        () => {
          // Restore: re-add to UI
          this.entries.push(entry);
          this.entries.sort((a, b) => (a.id || 0) - (b.id || 0));
        }
      );
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

    /**
     * Phase 8 Plan 2 — COLLECT-04.
     * Flip the LHS panel open state; persist to localStorage tc_panel_open
     * so the preference survives reloads. D-28 / Pitfall 6.
     */
    togglePanel() {
      this.panelOpen = !this.panelOpen;
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('tc_panel_open', String(this.panelOpen));
        }
      } catch { /* swallow — localStorage may be disabled in private mode */ }
    },

    /**
     * Phase 8 Plan 2 — COLLECT-04.
     * Fetch all paper printings of a card via Scryfall. Uses the rate-limited
     * queue (scryfall-queue.js) + User-Agent per ToS. Filters games:paper,
     * sorts released_at DESC (D-16), paginates has_more/next_page.
     *
     * Branch A per 08-02-SPIKE-NOTES.md: card.prints_search_uri is retained
     * by the bulk-data pipeline, so we use it directly. The oracleid fallback
     * is kept as defensive coverage for test fixtures or old-schema cards.
     *
     * @param {object} card - a Scryfall card object with at minimum `id`;
     *   prefers `prints_search_uri`, falls back to constructing from `oracle_id`.
     * @returns {Promise<Array>} the filtered + sorted paper printings.
     */
    async loadPrintings(card) {
      if (!card || !card.id) return [];
      const cached = this.printingsByCardId[card.id];
      if (cached && !cached.loading && !cached.error && cached.printings?.length) {
        return cached.printings;
      }
      this.printingsByCardId[card.id] = { loading: true, error: null, printings: [] };

      try {
        let url = card.prints_search_uri
          || `https://api.scryfall.com/cards/search?q=oracleid%3A${encodeURIComponent(card.oracle_id || '')}&unique=prints`;

        const printings = [];
        while (url) {
          const page = await queueScryfallRequest(url);
          for (const p of (page.data || [])) {
            if (p.games?.includes('paper')) {
              printings.push({
                id: p.id,
                set: p.set,
                set_name: p.set_name,
                released_at: p.released_at,
                collector_number: p.collector_number,
                image_uris: p.image_uris,
                prices: p.prices,
                games: p.games,
              });
            }
          }
          url = page.has_more ? page.next_page : null;
        }
        // D-16: newest first. Use localeCompare on ISO date strings (lexicographic
        // ordering is correct for YYYY-MM-DD).
        printings.sort((a, b) => (b.released_at || '').localeCompare(a.released_at || ''));

        this.printingsByCardId[card.id] = { loading: false, error: null, printings };
        // D-14: default-pick = newest paper printing (index 0 after DESC sort)
        if (printings.length && !this.activePrintingIdByCard[card.id]) {
          this.activePrintingIdByCard[card.id] = printings[0].id;
        }
        return printings;
      } catch (err) {
        this.printingsByCardId[card.id] = {
          loading: false,
          error: err.message || String(err),
          printings: [],
        };
        return [];
      }
    },

    /**
     * Phase 8 Plan 2 — COLLECT-04.
     * Switch the active printing for the given card. Mutates
     * activePrintingIdByCard and dispatches a `cf:printing-selected`
     * CustomEvent so the panel's x-data can refresh its selectedCard view
     * (image + price + set + collector_number in place).
     */
    selectPrinting(cardId, printingId) {
      const bucket = this.printingsByCardId[cardId];
      if (!bucket) return;
      const printing = bucket.printings.find(p => p.id === printingId);
      if (!printing) return;
      this.activePrintingIdByCard[cardId] = printingId;
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('cf:printing-selected', {
          detail: { cardId, printing },
        }));
      }
    },

    /**
     * Phase 8 Plan 3 — COLLECT-02.
     * Load precon products via fetchPrecons() and populate this.precons.
     * Called on BROWSE PRECONS click and on REFRESH button.
     */
    async loadPrecons({ forceRefresh = false } = {}) {
      this.preconsLoading = true;
      this.preconsError = null;
      try {
        this.precons = await fetchPrecons({ forceRefresh });
      } catch (err) {
        this.preconsError = err.message || 'Failed to load precons';
        this.precons = [];
      } finally {
        this.preconsLoading = false;
      }
    },

    /**
     * Phase 8 Plan 3 — COLLECT-02.
     * Click a tile → show decklist preview (D-10: preview required before
     * commit). Lazy-loads the decklist for the selected precon and reflects
     * it back into this.precons so Alpine re-renders the preview pane.
     */
    async selectPrecon(code) {
      this.selectedPreconCode = code;
      const precon = this.precons.find(p => p.code === code);
      if (!precon) return;
      if (precon.decklist && precon.decklist.length) return; // already loaded
      this.preconDecklistLoading = true;
      this.preconDecklistError = null;
      try {
        const decklist = await fetchPreconDecklist(code);
        const idx = this.precons.findIndex(p => p.code === code);
        if (idx >= 0) this.precons[idx] = { ...this.precons[idx], decklist };
      } catch (err) {
        this.preconDecklistError = err.message || 'Failed to load decklist';
      } finally {
        this.preconDecklistLoading = false;
      }
    },

    /**
     * Phase 8 Plan 3 — COLLECT-02 core.
     * Commit the entire precon decklist to the collection as
     * category:'owned', foil:false (D-08). CRITICAL (Pitfall 2): uses a
     * Dexie transaction with direct bulk-write semantics — NOT a for-loop
     * over addCard (which would trigger N+1 loadEntries calls). Fires
     * loadEntries() EXACTLY ONCE at the end. Registers EXACTLY ONE undo
     * entry (Pattern 6) whose inverse (a) bulkDeletes newly-inserted rows,
     * and (b) restores prevQuantity on rows that were bumped (Pitfall 7
     * structured payload so manual edits between add-all and undo don't
     * corrupt the inverse).
     *
     * Closes the precon browser on success. Panel stays open (D-06).
     *
     * @param {string} code - Scryfall set code of the precon to add
     */
    async addAllFromPrecon(code) {
      let precon = this.precons.find(p => p.code === code);
      if (!precon) {
        // Fall back to Dexie (e.g., if loadPrecons hasn't been called yet)
        precon = await db.precons_cache.get(code);
      }
      if (!precon?.decklist?.length) {
        throw new Error(`Precon ${code} has no decklist; call selectPrecon first.`);
      }

      // Phase 14.07d — bundle guard removed. The 4B/4C iterations treated
      // multi-deck Commander products (Doctor Who, Final Fantasy, etc.) as
      // un-addable. The intended UX is the opposite: if a user owns the
      // boxed product, ADD ALL adds every card from every bundled deck
      // into their collection. The accurate count is communicated in the
      // toast + activity log; per-deck filtering is a v1.2 nice-to-have.


      const nowIso = new Date().toISOString();
      const added = [];       // IDs of newly-inserted rows (for undo bulkDelete)
      const updated = [];     // [{ id, prevQuantity }] for undo restore

      // Atomic commit — all-or-nothing. On failure, nothing persists.
      await db.transaction('rw', db.collection, async () => {
        for (const entry of precon.decklist) {
          // Merge on existing [scryfall_id+foil+category] composite (D-08)
          const existing = await db.collection
            .where('[scryfall_id+foil]')
            .equals([entry.scryfall_id, 0])
            .and(e => e.category === 'owned')
            .first();

          if (existing) {
            updated.push({ id: existing.id, prevQuantity: existing.quantity });
            await db.collection.update(existing.id, {
              quantity: existing.quantity + entry.quantity,
              updated_at: nowIso,
              synced_at: null,
            });
          } else {
            // creating-hook at schema.js bottom supplies UUID when `id` omitted
            const row = {
              scryfall_id: entry.scryfall_id,
              quantity: entry.quantity,
              foil: 0,
              category: 'owned',
              added_at: nowIso,
              updated_at: nowIso,
              synced_at: null,
              user_id: null,
            };
            const newId = await db.collection.add(row);
            added.push(newId);
          }
        }
      });

      // Pitfall 2: exactly ONE reload regardless of row count
      await this.loadEntries();

      // Single undo entry — inverse covers both new inserts AND bumped
      // quantities (D-08 + Pitfall 7 structured payload).
      const undoStore = (typeof window !== 'undefined') ? window.Alpine?.store?.('undo') : null;
      if (undoStore?.push) {
        const totalCount = precon.decklist.length;
        const preconName = precon.name;
        const message = `Added ${totalCount} cards from ${preconName}.`;
        const invert = async () => {
          await db.transaction('rw', db.collection, async () => {
            if (added.length) {
              await db.collection.bulkDelete(added);
            }
            for (const { id, prevQuantity } of updated) {
              const row = await db.collection.get(id);
              if (row) {
                await db.collection.update(id, {
                  quantity: prevQuantity,
                  updated_at: new Date().toISOString(),
                  synced_at: null,
                });
              }
            }
          });
          await this.loadEntries();
        };
        // Mirror production undo signature:
        //   push(type, data, message, commitFn, restoreFn)
        // The writes have already committed above, so commitFn is a no-op.
        // restoreFn is the inverse that reverses the whole batch.
        undoStore.push('collection_add_batch', { added, updated, code }, message, async () => {}, invert);
      }

      // Activity log — mirror existing pattern in other add paths
      try {
        logActivity('precon_added', `Added ${precon.decklist.length} cards from ${precon.name}`);
      } catch { /* decorative */ }

      // Toast — EXACT string per 08-UI-SPEC §Copywriting Contract
      const toast = (typeof window !== 'undefined') ? window.Alpine?.store?.('toast') : null;
      if (toast?.success) {
        toast.success(`Added ${precon.decklist.length} cards from ${precon.name} to collection.`);
      }

      // Close the browser; panel stays open (D-06)
      this.preconBrowserOpen = false;
      this.selectedPreconCode = null;
    },

    /**
     * Phase 14.07c — add a subset of cards by scryfall_id list.
     *
     * Used by precon-browser virtual-deck view: when a user picks one deck out
     * of a multi-deck bundle (Doctor Who, Final Fantasy, etc.), only that
     * deck's cards should land in the collection, not the entire bundle.
     *
     * Mirrors addAllFromPrecon's transaction shape (atomic merge-on-existing
     * + undo + activity log + toast) but operates on an arbitrary scryfall_id
     * array instead of a precon decklist.
     *
     * @param {string[]} scryfallIds - flat list of card ids to add
     * @param {{ label?: string }} [options]
     */
    async addCardsFromIds(scryfallIds, { label } = {}) {
      if (!Array.isArray(scryfallIds) || scryfallIds.length === 0) return;

      const nowIso = new Date().toISOString();
      const added = [];
      const updated = [];

      await db.transaction('rw', db.collection, async () => {
        for (const scryfallId of scryfallIds) {
          const existing = await db.collection
            .where('[scryfall_id+foil]')
            .equals([scryfallId, 0])
            .and(e => e.category === 'owned')
            .first();

          if (existing) {
            updated.push({ id: existing.id, prevQuantity: existing.quantity });
            await db.collection.update(existing.id, {
              quantity: existing.quantity + 1,
              updated_at: nowIso,
              synced_at: null,
            });
          } else {
            const row = {
              scryfall_id: scryfallId,
              quantity: 1,
              foil: 0,
              category: 'owned',
              added_at: nowIso,
              updated_at: nowIso,
              synced_at: null,
              user_id: null,
            };
            const newId = await db.collection.add(row);
            added.push(newId);
          }
        }
      });

      await this.loadEntries();

      const sourceLabel = label || 'selected deck';
      const total = scryfallIds.length;

      const undoStore = (typeof window !== 'undefined') ? window.Alpine?.store?.('undo') : null;
      if (undoStore?.push) {
        const message = `Added ${total} cards from ${sourceLabel}.`;
        const invert = async () => {
          await db.transaction('rw', db.collection, async () => {
            if (added.length) await db.collection.bulkDelete(added);
            for (const { id, prevQuantity } of updated) {
              const row = await db.collection.get(id);
              if (row) {
                await db.collection.update(id, {
                  quantity: prevQuantity,
                  updated_at: new Date().toISOString(),
                  synced_at: null,
                });
              }
            }
          });
          await this.loadEntries();
        };
        undoStore.push('collection_add_batch', { added, updated, source: 'cards_from_ids' }, message, async () => {}, invert);
      }

      try {
        logActivity('precon_added', `Added ${total} cards from ${sourceLabel}`);
      } catch { /* decorative */ }

      const toast = (typeof window !== 'undefined') ? window.Alpine?.store?.('toast') : null;
      if (toast?.success) {
        toast.success(`Added ${total} cards from ${sourceLabel} to collection.`);
      }

      this.preconBrowserOpen = false;
      this.selectedPreconCode = null;
    },

    /**
     * Phase 8 Plan 3 — close the precon browser without committing.
     */
    closePreconBrowser() {
      this.preconBrowserOpen = false;
      this.selectedPreconCode = null;
    },

    /**
     * Phase 8 Plan 3 — manual REFRESH button (D-11). Clears the Dexie
     * cache and re-fetches from Scryfall.
     *
     * Phase 14.07f — additionally drop the currently-selected precon code
     * + re-select it so the decklist is refetched with the latest metadata
     * fields (Phase 14.07c added color_identity / name / type_line — older
     * caches don't have them, blocking the manifest splitter). Without this
     * step REFRESH appears to do nothing when a precon is already selected:
     * the user sees the precon header but no tile grid + no decklist
     * because the selected precon's `.decklist` is now null in the cache
     * and selectPrecon() isn't re-invoked automatically.
     */
    async refreshPrecons() {
      const previouslySelected = this.selectedPreconCode;
      // Drop the selection BEFORE clearing so VIEW B unmounts cleanly.
      this.selectedPreconCode = null;
      await invalidatePreconsCache();
      await this.loadPrecons({ forceRefresh: true });
      // Re-fetch the previously-selected decklist so the user lands back
      // on the same precon view with fresh data (instead of a stuck
      // empty-state where the selected precon has decklist: null).
      if (previouslySelected) {
        try {
          await this.selectPrecon(previouslySelected);
        } catch (err) {
          console.warn('[precons] re-select after refresh failed:', err);
        }
      }
    },
  });
}
