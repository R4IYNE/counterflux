import Alpine from 'alpinejs';
import { db } from '../db/schema.js';
import { logActivity } from '../services/activity.js';
import { queueScryfallRequest } from '../services/scryfall-queue.js';
import { fetchPrecons, fetchPreconDecklist, invalidatePreconsCache } from '../services/precons.js';
import { tsToMs } from '../utils/timestamps.js';

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
        // added_at can be a number (legacy) or ISO string — compare numerically.
        return mul * (tsToMs(a.added_at) - tsToMs(b.added_at));
      default:
        return 0;
    }
  });
  return sorted;
}

// ---------------------------------------------------------------------------
// Derived-state memoisation (perf 260616).
//
// `filtered` / `sorted` / `grouped` / `stats` are O(n) (or O(n log n))
// projections over the WHOLE collection. As plain getters they recomputed on
// every access — and the render path hammers them: the grouped x-for re-reads
// `grouped` on every reactive tick, the gallery virtual scroller reads `sorted`
// once per visible tile per scroll frame, and the no-results check reads
// `sorted` alongside. On a large synced collection that turned routine
// interactions (filter / search / scroll / navigate) into multi-second
// main-thread freezes — which in turn starved the gotrue Web-Locks release
// callback ("lock not released within 5000ms") and the Realtime heartbeat
// (CHANNEL_ERROR). Memoising collapses each access to O(1) when nothing changed.
//
// Validity = same `entries` array reference AND same input signature (entries
// `_rev` + active filters + sort). `entries` is reassigned on every load and
// optimistic mutation; `_rev` covers the one in-place mutation (undo restore).
// The ref check also isolates separate store instances (test re-init).
const _memo = {
  filtered: { ref: null, sig: null, val: [] },
  sorted: { ref: null, sig: null, val: [] },
  grouped: { ref: null, sig: null, val: [] },
  stats: { ref: null, sig: null, val: null },
};

/**
 * Initialise the Alpine collection store.
 * Call during app startup alongside initAppStore().
 */
export function initCollectionStore() {
  Alpine.store('collection', {
    entries: [],
    // perf 260616 — bumped on every `entries` mutation; part of the derived-
    // getter memo signature so `filtered`/`sorted`/`grouped`/`stats` recompute
    // exactly once per data change instead of on every reactive access.
    _rev: 0,
    // 260516-gly: the GROUPED view is now THE gallery — the old per-entry
    // gallery tab was removed. Internal value renamed to 'gallery' so the
    // tab label, the viewMode value, and the user's mental model all
    // converge on one name. renderGroupedView() is still the render
    // function (filename TBD — not worth the churn yet).
    viewMode: 'gallery',
    sortBy: 'name-asc',
    filters: {
      colours: [],
      category: 'all',
      search: '',
      // Audit fix #8: active set filter (set code) + its display name. Set by
      // clicking a set in the SETS completion view; previously a dead no-op.
      set: null,
      setName: '',
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
    // 260516-pcd: when the user clicks a per-deck tile in the precon
    // browser (manifest-driven), set this alongside selectedPreconCode so
    // VIEW B drills straight into the deck preview instead of stopping at
    // the manifest-deck tile picker. Cleared whenever the user backs out.
    pendingDeckKey: null,
    preconsLoading: false,
    preconsError: null,
    precons: [], // sorted newest-first by fetchPrecons() (D-12)
    preconDecklistLoading: false,
    preconDecklistError: null,
    // Phase 14.07j — reactive flag flipped once the lazy-loaded MTGJSON
    // deck-membership JSON has resolved. Alpine getters in precon-browser
    // depend on this to force a re-render after the dynamic import lands.
    preconMembershipsLoaded: false,

    // Cheap, collision-free signature of the inputs `filtered` depends on.
    // Reading `_rev` + each filter field here registers the reactive deps, so
    // Alpine still re-renders when they change even on a memo cache hit.
    _filterSig() {
      const f = this.filters;
      return this._rev + ':' + JSON.stringify([f.category, f.colours, f.search, f.set]);
    },

    get filtered() {
      const ref = this.entries;
      const sig = this._filterSig();
      const m = _memo.filtered;
      if (m.ref === ref && m.sig === sig) return m.val;

      let items = ref;
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
      if (this.filters.set) {
        items = items.filter(e => e.card?.set === this.filters.set);
      }
      m.ref = ref; m.sig = sig; m.val = items;
      return items;
    },

    get sorted() {
      const ref = this.entries;
      const sig = this._filterSig() + '|' + this.sortBy;
      const m = _memo.sorted;
      if (m.ref === ref && m.sig === sig) return m.val;
      const val = sortEntries(this.filtered, this.sortBy);
      m.ref = ref; m.sig = sig; m.val = val;
      return val;
    },

    /**
     * Grouped view (260516-08x): collapse entries that share an oracle_id (or
     * card name fallback when oracle_id is missing) into a single group with
     * aggregate counts across printings + foil/non-foil. The returned shape is
     * consumed by src/components/grouped-view.js.
     *
     * Each group entry:
     *   - key            unique grouping key (oracle_id || name || scryfall_id)
     *   - card           the representative card (most expensive printing wins)
     *   - totalQty       sum of entry.quantity across all matching entries
     *   - foilQty        sum across foil:true entries
     *   - nonFoilQty     sum across foil:false entries
     *   - printingCount  distinct scryfall_ids in the group
     *   - entries        the raw collection entries (for click-to-expand later)
     *   - estimatedValue EUR price * qty rolled up per entry (foil vs non-foil)
     *
     * Conditions are not yet stored on collection entries (v10 schema has no
     * column). When that schema change lands, extend each group with a
     * `byCondition` breakdown — the grouped tile already reserves a row for it.
     */
    get grouped() {
      const ref = this.entries;
      const sig = this._filterSig() + '|' + this.sortBy;
      const m = _memo.grouped;
      if (m.ref === ref && m.sig === sig) return m.val;

      const items = this.filtered;
      const groups = new Map();
      for (const entry of items) {
        const card = entry.card;
        // Fallback chain — oracle_id is the strongest grouping key (same card
        // across all printings), name catches catalog-miss rows, scryfall_id
        // is the per-printing last resort so a missing-metadata row still
        // appears (rather than being silently dropped).
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

        // Prefer the most expensive printing's card object as the
        // representative so the tile image isn't whatever Dexie returned first.
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

      // Materialise printings as a count + sort alphabetically by name.
      const out = [];
      for (const g of groups.values()) {
        out.push({
          ...g,
          printingCount: g.printings.size,
          printings: undefined, // drop the Set from the public shape
        });
      }
      // 260516-gly: respect $store.collection.sortBy so the sort dropdown
      // in the filter-bar (NAME A-Z, PRICE DESC/ASC, SET RELEASE, DATE
      // ADDED) works the same way it does on the legacy per-entry views.
      const [field, dir] = (this.sortBy || 'name-asc').split('-');
      const mul = dir === 'desc' ? -1 : 1;
      out.sort((a, b) => {
        switch (field) {
          case 'price':
            return mul * ((a.estimatedValue || 0) - (b.estimatedValue || 0));
          case 'set':
            return mul * (
              (a.card?.released_at || '').localeCompare(b.card?.released_at || '')
            );
          case 'date': {
            // Date-added on a group = newest added_at across its entries
            // (a single newly-added printing surfaces the whole group).
            const newestOf = (g) => (g.entries || []).reduce((m, e) => {
              const t = e.added_at ? Date.parse(e.added_at) : 0;
              return t > m ? t : m;
            }, 0);
            return mul * (newestOf(a) - newestOf(b));
          }
          case 'name':
          default:
            return mul * (a.card?.name || '').localeCompare(b.card?.name || '');
        }
      });
      m.ref = ref; m.sig = sig; m.val = out;
      return out;
    },

    get stats() {
      const ref = this.entries;
      const sig = String(this._rev);
      const m = _memo.stats;
      if (m.ref === ref && m.sig === sig) return m.val;
      const val = {
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
      m.ref = ref; m.sig = sig; m.val = val;
      return val;
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
      this._rev++;   // perf 260616 — invalidate derived-getter memo
      this.loading = false;

      // 260522-hyd: recovery sweep for entries whose db.cards row is missing
      // (typically precon imports done before fetchPreconDecklist started
      // persisting full card objects to db.cards). Fire-and-forget — runs
      // in the background, re-renders the gallery once cards land. Without
      // this, an entire precon's worth of rows shows as 'Unknown' / £0.00
      // until the user manually re-imports the precon. Skips ids already
      // attempted in this session to prevent infinite refetch when an id
      // is unrecoverable (404 from Scryfall — card was deleted/remapped).
      if (!this._hydrateAttempted) this._hydrateAttempted = new Set();
      const missing = [...new Set(
        raw.filter((e) => e.scryfall_id
                       && !cardMap[e.scryfall_id]
                       && !this._hydrateAttempted.has(e.scryfall_id))
          .map((e) => e.scryfall_id)
      )];
      if (missing.length > 0) {
        for (const id of missing) this._hydrateAttempted.add(id);
        this.hydrateMissingCards(missing).catch((err) => {
          console.warn('[collection] background hydrate sweep failed:', err);
        });
      }
    },

    /**
     * 260522-hyd: batch-fetch full Scryfall card objects for the given
     * scryfall_ids and persist them to db.cards. Re-runs loadEntries after
     * the writes land so the gallery picks up the new metadata. Uses
     * /cards/collection (POST, up to 75 ids per request, 100ms-spaced
     * via the shared __cf_lastScryfallHit timestamp the precon-browser
     * hydrators also use).
     */
    async hydrateMissingCards(ids) {
      if (!ids || !ids.length) return;
      // Verify they're still missing — concurrent loadEntries calls or a
      // recent direct fetch may have already filled some in.
      const existing = await db.cards.where('id').anyOf(ids).toArray();
      const haveIds = new Set(existing.map((c) => c.id));
      const stillMissing = ids.filter((id) => !haveIds.has(id));
      if (!stillMissing.length) return;

      const lastHitKey = '__cf_lastScryfallHit';
      let fetchedCount = 0;
      for (let i = 0; i < stillMissing.length; i += 75) {
        const batch = stillMissing.slice(i, i + 75);
        const now = Date.now();
        const wait = Math.max(0, 100 - (now - (window?.[lastHitKey] || 0)));
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        if (typeof window !== 'undefined') window[lastHitKey] = Date.now();
        try {
          const response = await fetch('https://api.scryfall.com/cards/collection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifiers: batch.map((id) => ({ id })) }),
          });
          if (!response.ok) {
            console.warn('[collection] hydrateMissingCards batch failed:', response.status);
            continue;
          }
          const data = await response.json();
          for (const card of (data.data || [])) {
            if (card?.id) {
              try { await db.cards.put(card); fetchedCount++; } catch {}
            }
          }
        } catch (err) {
          console.warn('[collection] hydrateMissingCards batch threw:', err);
        }
      }
      if (fetchedCount > 0) {
        // Re-join so the gallery picks up the new metadata. Awaits its
        // own missing-sweep but stillMissing will now be a subset (or 0).
        await this.loadEntries();
      }
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

    /**
     * Quick task 260516-stg — apply a staged flyout edit diff in one batch.
     * The flyout snapshots the matching entries on open, mutates a working
     * copy as the user clicks qty/foil/remove/change-printing/split, then
     * calls this on SAVE to apply everything at once. Lets us defer DB
     * writes until the user explicitly commits.
     *
     * Working entries with `_isNew: true` are split-additions or any other
     * net-new rows from the flyout flow; they get appended (or merged into
     * a sibling) on save. Originals missing from `working` are deleted.
     *
     * Scope notes:
     * - Sibling-merge on update (e.g. toggling foil into a row that already
     *   exists with the same scryfall_id/category) is intentionally NOT
     *   applied here — the simpler `db.collection.update` keeps row ids
     *   stable so the staging snapshot stays consistent. Worst case: two
     *   rows with the same (scryfall_id, foil, category). Rare; tolerable.
     * - Card metadata is hydrated via the Scryfall API on cache miss so
     *   the new printing's row renders correctly immediately afterwards.
     *
     * @param {Array} originals  flyout's snapshot of matchingEntries at open
     * @param {Array} working    current working copy with edits applied
     */
    async applyFlyoutDiff(originals, working) {
      const originalsById = new Map((originals || []).map(e => [e.id, e]));
      const workingExisting = (working || []).filter(e => e && !e._isNew);
      const workingNew = (working || []).filter(e => e && e._isNew);
      const workingById = new Map(workingExisting.map(e => [e.id, e]));

      // 1. Deletes — any original whose id is missing from working
      for (const id of originalsById.keys()) {
        if (!workingById.has(id)) {
          await db.collection.delete(id);
        }
      }

      // 2. Updates — diff each working entry against its original
      for (const [id, w] of workingById.entries()) {
        const o = originalsById.get(id);
        if (!o) continue;

        const updates = {};
        if ((w.quantity || 0) !== (o.quantity || 0)) {
          updates.quantity = Math.max(1, w.quantity || 1);
        }
        if ((w.foil ? 1 : 0) !== (o.foil ? 1 : 0)) {
          updates.foil = w.foil ? 1 : 0;
        }
        if (w.scryfall_id && w.scryfall_id !== o.scryfall_id) {
          // Hydrate db.cards for the new printing before the update so the
          // UI re-render after loadEntries() doesn't show a "no metadata"
          // tile while a follow-up fetch is in flight.
          let newCard = await db.cards.get(w.scryfall_id);
          if (!newCard) {
            try {
              const fetched = await queueScryfallRequest(
                `https://api.scryfall.com/cards/${encodeURIComponent(w.scryfall_id)}`,
              );
              if (fetched && fetched.id) {
                await db.cards.put(fetched);
              }
            } catch (err) {
              console.error('[Counterflux] applyFlyoutDiff: printing fetch failed', err);
              continue; // skip this entry's printing change, keep other updates
            }
          }
          updates.scryfall_id = w.scryfall_id;
        }

        if (Object.keys(updates).length > 0) {
          await db.collection.update(id, updates);
        }
      }

      // 3. New entries — splits or freshly-added rows from the flyout
      for (const n of workingNew) {
        if (!n.scryfall_id) continue;

        // Hydrate db.cards if missing.
        let card = await db.cards.get(n.scryfall_id);
        if (!card) {
          try {
            const fetched = await queueScryfallRequest(
              `https://api.scryfall.com/cards/${encodeURIComponent(n.scryfall_id)}`,
            );
            if (fetched && fetched.id) {
              await db.cards.put(fetched);
            }
          } catch (err) {
            console.error('[Counterflux] applyFlyoutDiff: new-entry fetch failed', err);
            continue;
          }
        }

        // Sibling-merge: if a row already exists with the same
        // (scryfall_id, foil, category), bump its quantity instead of
        // creating a duplicate row.
        const foilKey = n.foil ? 1 : 0;
        const sibling = await db.collection
          .where('[scryfall_id+foil]')
          .equals([n.scryfall_id, foilKey])
          .and(e => e.category === (n.category || 'owned'))
          .first();

        if (sibling) {
          await db.collection.update(sibling.id, {
            quantity: (sibling.quantity || 0) + (n.quantity || 1),
          });
        } else {
          await db.collection.add({
            scryfall_id: n.scryfall_id,
            quantity: n.quantity || 1,
            foil: foilKey,
            category: n.category || 'owned',
            added_at: new Date().toISOString(),
          });
        }
      }

      await this.loadEntries();
    },

    /**
     * Quick task 260516-rls — flip foil/non-foil on a collection entry.
     * If a sibling entry exists with the new foil + same scryfall_id +
     * same category, merge into it (sum qty, delete source) so we don't
     * end up with duplicate (scryfall_id, foil, category) rows.
     */
    async toggleFoilForEntry(entryId) {
      const entry = await db.collection.get(entryId);
      if (!entry) return;
      // newFoil is already 0/1 (defensive against entry.foil being boolean,
      // null, or undefined — IndexedDB rejects boolean keys, see
      // splitAndChangePrinting for the rationale).
      const newFoil = entry.foil ? 0 : 1;

      const sibling = await db.collection
        .where('[scryfall_id+foil]')
        .equals([entry.scryfall_id, newFoil])
        .and(e => e.category === entry.category && e.id !== entry.id)
        .first();

      if (sibling) {
        await db.collection.update(sibling.id, {
          quantity: (sibling.quantity || 0) + (entry.quantity || 0),
        });
        await db.collection.delete(entry.id);
      } else {
        await db.collection.update(entry.id, { foil: newFoil });
      }
      await this.loadEntries();
    },

    /**
     * Quick task 260516-pks — split N copies of an entry to a different
     * printing without moving the rest. e.g. you own 4x Lightning Bolt from
     * set A and want 2 of them to be set B; calling this with qty=2 reduces
     * the source entry to 2 and creates (or merges into) a new entry with
     * 2 copies of set B's printing. When qty >= entry.quantity this
     * collapses to changePrintingForEntry (no remainder left behind).
     *
     * @param {number} entryId          source collection entry to split
     * @param {number} qty              copies to move to the new printing
     * @param {string} newScryfallId    target printing's scryfall id
     */
    async splitAndChangePrinting(entryId, qty, newScryfallId) {
      const entry = await db.collection.get(entryId);
      if (!entry || !qty || qty < 1) return;
      const ownedQty = entry.quantity || 0;
      const moveQty = Math.min(qty, ownedQty);
      if (moveQty < 1) return;

      // Coerce foil to 0/1 — IndexedDB rejects boolean keys, and historical
      // entries from older addCard paths may have stored `foil: false` or
      // `foil: true` which breaks .where('[scryfall_id+foil]').equals([...])
      // with `bound IDBKeyRange not a valid key`. Normalising here keeps the
      // query valid regardless of how the source row was persisted.
      const foilKey = entry.foil ? 1 : 0;

      // Full-quantity moves delegate to the in-place printing swap — no
      // remainder to leave behind, no need to create a new entry.
      if (moveQty >= ownedQty) {
        return this.changePrintingForEntry(entryId, newScryfallId);
      }

      // Hydrate db.cards for the new printing — oracle-cards bulk feed
      // doesn't carry every printing, so non-canonical IDs may miss.
      let newCard = await db.cards.get(newScryfallId);
      if (!newCard) {
        try {
          const fetched = await queueScryfallRequest(
            `https://api.scryfall.com/cards/${encodeURIComponent(newScryfallId)}`,
          );
          if (fetched && fetched.id) {
            newCard = fetched;
            await db.cards.put(fetched);
          }
        } catch (err) {
          console.error('[Counterflux] splitAndChangePrinting: fetch failed', err);
          return;
        }
      }

      // If a sibling entry exists for the destination (newPrinting, foil,
      // category), merge into it; otherwise create a new entry. The Dexie
      // creating hook supplies a UUID for new rows automatically.
      const sibling = await db.collection
        .where('[scryfall_id+foil]')
        .equals([newScryfallId, foilKey])
        .and(e => e.category === entry.category && e.id !== entry.id)
        .first();

      if (sibling) {
        await db.collection.update(sibling.id, {
          quantity: (sibling.quantity || 0) + moveQty,
        });
      } else {
        await db.collection.add({
          scryfall_id: newScryfallId,
          quantity: moveQty,
          foil: foilKey,
          category: entry.category,
          added_at: new Date().toISOString(),
        });
      }

      // Reduce the source entry to leave the unsplit portion behind.
      await db.collection.update(entry.id, {
        quantity: ownedQty - moveQty,
      });

      await this.loadEntries();
    },

    /**
     * Quick task 260516-rls — change which printing (scryfall_id) a
     * collection entry points to. Fetches the new printing's card metadata
     * via Scryfall API on cache miss so db.cards is hydrated before the
     * UI re-renders. Merges with an existing (newScryfallId, foil, category)
     * sibling if one already exists, otherwise updates in place.
     */
    async changePrintingForEntry(entryId, newScryfallId) {
      const entry = await db.collection.get(entryId);
      if (!entry || entry.scryfall_id === newScryfallId) return;

      // Coerce foil to 0/1 — IndexedDB rejects boolean keys (see
      // splitAndChangePrinting for the rationale).
      const foilKey = entry.foil ? 1 : 0;

      // Hydrate db.cards for the new printing — oracle-cards bulk feed
      // doesn't carry every printing, so non-canonical IDs may miss.
      let newCard = await db.cards.get(newScryfallId);
      if (!newCard) {
        try {
          const fetched = await queueScryfallRequest(
            `https://api.scryfall.com/cards/${encodeURIComponent(newScryfallId)}`,
          );
          if (fetched && fetched.id) {
            newCard = fetched;
            await db.cards.put(fetched);
          }
        } catch (err) {
          console.error('[Counterflux] changePrintingForEntry: fetch failed', err);
          return;
        }
      }

      const sibling = await db.collection
        .where('[scryfall_id+foil]')
        .equals([newScryfallId, foilKey])
        .and(e => e.category === entry.category && e.id !== entry.id)
        .first();

      if (sibling) {
        await db.collection.update(sibling.id, {
          quantity: (sibling.quantity || 0) + (entry.quantity || 0),
        });
        await db.collection.delete(entry.id);
      } else {
        await db.collection.update(entry.id, { scryfall_id: newScryfallId });
      }
      await this.loadEntries();
    },

    /**
     * Quick task 260516-mss — bulk-delete multiple collection entries in a
     * single Dexie transaction. Used by the gallery multi-select toolbar.
     * Unlike deleteEntry, this skips the undo system — mass-delete is an
     * intentional action that the caller is expected to gate behind a
     * confirm() dialog at the UI layer.
     *
     * @param {Array} entryIds
     */
    async deleteEntries(entryIds) {
      if (!Array.isArray(entryIds) || entryIds.length === 0) return;
      await db.collection.bulkDelete(entryIds);
      await this.loadEntries();
    },

    async deleteEntry(entryId) {
      const entry = await db.collection.get(entryId);
      if (!entry) return;
      const card = await db.cards.get(entry.scryfall_id);
      const cardName = card?.name || 'card';

      // Remove from UI immediately (optimistic)
      this.entries = this.entries.filter(e => e.id !== entryId);
      this._rev++;   // perf 260616 — invalidate derived-getter memo

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
          // Restore: re-add to UI (in-place — same array ref, so bump _rev)
          this.entries.push(entry);
          this.entries.sort((a, b) => (a.id || 0) - (b.id || 0));
          this._rev++;   // perf 260616 — invalidate derived-getter memo
        }
      );
    },

    /**
     * Audit fix #9 — atomic batch add for mass-entry + CSV import.
     *
     * Previously this looped addCard(), and EACH addCard ran its own indexed
     * lookup AND a full loadEntries() (re-read the whole collection + re-join
     * cards + kick background hydration). On a 300-row import that's an
     * O(N×collection) cliff and N redundant re-renders. Now: one transaction,
     * one trailing loadEntries, and one undo entry covering the whole batch
     * (mirrors the addCardsFromIds / addAllFromPrecon precon pattern, which was
     * already fixed — mass-entry + CSV were the stragglers).
     *
     * @param {Array<{scryfallId, quantity, foil, category}>} entries
     * @param {{ label?: string }} [options]
     * @returns {{ added: number }} number of entries processed
     */
    async addBatch(entries, { label } = {}) {
      const list = (entries || []).filter(e => e && e.scryfallId);
      if (list.length === 0) return { added: 0 };

      const nowIso = new Date().toISOString();
      const addedIds = [];
      const updated = [];

      await db.transaction('rw', db.collection, async () => {
        for (const entry of list) {
          const foilNum = entry.foil ? 1 : 0;
          const category = entry.category || 'owned';
          const qty = entry.quantity || 1;

          const existing = await db.collection
            .where('[scryfall_id+foil]')
            .equals([entry.scryfallId, foilNum])
            .and(e => e.category === category)
            .first();

          if (existing) {
            updated.push({ id: existing.id, prevQuantity: existing.quantity });
            await db.collection.update(existing.id, {
              quantity: existing.quantity + qty,
              updated_at: nowIso,
              synced_at: null,
            });
          } else {
            const newId = await db.collection.add({
              scryfall_id: entry.scryfallId,
              quantity: qty,
              foil: foilNum,
              category,
              added_at: nowIso,
              updated_at: nowIso,
              synced_at: null,
              user_id: null,
            });
            addedIds.push(newId);
          }
        }
      });

      await this.loadEntries();

      const total = list.length;
      const sourceLabel = label || 'import';

      const undoStore = (typeof window !== 'undefined') ? window.Alpine?.store?.('undo') : null;
      if (undoStore?.push) {
        const message = `Added ${total} card${total === 1 ? '' : 's'} from ${sourceLabel}.`;
        const invert = async () => {
          await db.transaction('rw', db.collection, async () => {
            if (addedIds.length) await db.collection.bulkDelete(addedIds);
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
        undoStore.push('collection_add_batch', { added: addedIds, updated, source: 'add_batch' }, message, async () => {}, invert);
      }

      try {
        logActivity('card_added', `Added ${total} cards from ${sourceLabel}`);
      } catch { /* decorative */ }

      return { added: total };
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
     * Audit fix #8 — filter the collection to a single set and jump to the
     * gallery so the result is visible. Called from the SETS completion view.
     */
    filterBySet(setCode, setName = '') {
      this.filters.set = setCode || null;
      this.filters.setName = setName || setCode || '';
      this.filters.search = '';
      this.setViewMode('gallery');
    },

    clearSetFilter() {
      this.filters.set = null;
      this.filters.setName = '';
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
        // Phase 14.07j — kick the lazy MTGJSON membership load in parallel
        // so the splitter has data ready by the time the user drills into
        // a multi-deck bundle. Sets preconMembershipsLoaded reactively
        // when the dynamic import resolves; Alpine x-data getters in
        // precon-browser depend on this flag to recompute the deck tiles.
        if (!this.preconMembershipsLoaded) {
          import('../services/precons.js').then(async (mod) => {
            await mod.loadPreconDeckMemberships();
            this.preconMembershipsLoaded = true;
          });
        }
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
