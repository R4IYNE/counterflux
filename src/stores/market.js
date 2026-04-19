import Alpine from 'alpinejs';
import { db } from '../db/schema.js';
import { snapshotWatchlistPrices, computeMovers } from '../services/price-history.js';
import { fetchSets } from '../services/sets.js';
import { eurToGbpValue } from '../services/currency.js';

/**
 * Initialise the Alpine market store (Preordain screen).
 * Call during app startup alongside other store inits.
 */
export function initMarketStore() {
  Alpine.store('market', {
    watchlist: [],
    activeSet: null,
    spoilerCards: [],
    spoilerFilters: { colours: [], rarity: 'all', type: 'all' },
    moversPeriod: '7d',
    gainers: [],
    losers: [],
    sets: [],
    pendingAlerts: [],
    alertBadgeCount: 0,
    // Phase 12 Plan 01 (SYNC-08) — polled from db.sync_conflicts every 2s
    // by _pollSyncErrors. Feeds unifiedBadgeCount (bell badge source).
    syncErrorCount: 0,
    activeTab: 'spoilers',
    loading: false,

    // Phase 12 Plan 01 (SYNC-08, D-02) — bell badge source of truth.
    // Sums sync errors + price alerts so the topbar bell surfaces a single
    // unified count. Downstream Plan 03 (bell popover) consumes this getter.
    get unifiedBadgeCount() {
      return (this.syncErrorCount || 0) + (this.alertBadgeCount || 0);
    },

    // Phase 12 Plan 01 (MARKET-02, D-07) — spoiler gallery data source.
    // Groups spoilerCards by released_at descending; null/undefined dates
    // bucket into 'unknown' and sort last. Downstream Plan 04 (spoiler
    // gallery) renders <section> per group with a date header.
    get groupedSpoilerCards() {
      const groups = new Map();
      for (const card of this.spoilerCards) {
        const date = card && card.released_at ? card.released_at : 'unknown';
        if (!groups.has(date)) groups.set(date, []);
        groups.get(date).push(card);
      }
      return [...groups.entries()]
        .sort(([a], [b]) => {
          if (a === 'unknown') return 1;
          if (b === 'unknown') return -1;
          return b.localeCompare(a);
        })
        .map(([date, cards]) => ({ date, cards }));
    },

    async init() {
      this.loading = true;
      try {
        this.watchlist = await db.watchlist.toArray();
        this.sets = await fetchSets();
        await snapshotWatchlistPrices();
        await this.checkAlerts();
        await this.loadMovers();
        // Phase 12 Plan 01 (SYNC-08) — kick off 2s sync-conflicts poll.
        // Returns synchronously once the interval is scheduled; safe to
        // call here without await.
        this._pollSyncErrors();
      } catch (err) {
        console.error('[Market] Init error:', err);
      } finally {
        this.loading = false;
      }
    },

    // Phase 12 Plan 01 (SYNC-08) — 2s polling interval that mirrors the
    // Phase 11 Plan 4 pattern in src/stores/sync.js:106-119.
    //
    // Auth-gated: when auth.status !== 'authed', resets syncErrorCount to 0
    // immediately (Pitfall 5 — prevents cross-user contamination without
    // waiting for the next tick). Dexie errors are swallowed so a
    // mid-migration state never throws into the interval loop.
    _pollSyncErrors() {
      if (this._syncErrorInterval) return;
      this._syncErrorInterval = setInterval(async () => {
        try {
          const auth = window.Alpine?.store?.('auth');
          if (!auth || auth.status !== 'authed') {
            if (this.syncErrorCount !== 0) this.syncErrorCount = 0;
            return;
          }
          this.syncErrorCount = await db.sync_conflicts.count();
        } catch {
          // Dexie mid-migration / closed — leave syncErrorCount as-is
        }
      }, 2000);
    },

    _stopSyncErrorPoll() {
      if (this._syncErrorInterval) {
        clearInterval(this._syncErrorInterval);
        this._syncErrorInterval = null;
      }
    },

    async addToWatchlist(scryfallId, alertType = null, alertThreshold = null) {
      // Enforce unique scryfall_id
      const existing = await db.watchlist.where('scryfall_id').equals(scryfallId).first();
      if (existing) return;

      await db.watchlist.add({
        scryfall_id: scryfallId,
        added_at: new Date().toISOString(),
        alert_type: alertType,
        alert_threshold: alertThreshold,
        last_alerted_at: null,
      });
      this.watchlist = await db.watchlist.toArray();
    },

    async removeFromWatchlist(scryfallId) {
      await db.watchlist.where('scryfall_id').equals(scryfallId).delete();
      this.watchlist = await db.watchlist.toArray();
    },

    async updateAlert(scryfallId, alertType, alertThreshold) {
      const entry = await db.watchlist.where('scryfall_id').equals(scryfallId).first();
      if (!entry) return;
      await db.watchlist.update(entry.id, {
        alert_type: alertType,
        alert_threshold: alertThreshold,
      });
      this.watchlist = await db.watchlist.toArray();
    },

    async checkAlerts() {
      const alerts = [];
      const today = new Date().toISOString().slice(0, 10);

      for (const entry of this.watchlist) {
        if (!entry.alert_type || entry.alert_threshold == null) continue;

        // Skip if already alerted today
        if (entry.last_alerted_at && entry.last_alerted_at.slice(0, 10) === today) continue;

        const card = await db.cards.get(entry.scryfall_id);
        if (!card) continue;

        const priceEur = parseFloat(card.prices?.eur || '0');
        if (priceEur === 0) continue;

        const priceGbp = eurToGbpValue(priceEur);
        let triggered = false;

        if (entry.alert_type === 'below' && priceGbp < entry.alert_threshold) {
          triggered = true;
        } else if (entry.alert_type === 'above' && priceGbp > entry.alert_threshold) {
          triggered = true;
        } else if (entry.alert_type === 'change_pct') {
          // Check percentage change from price history
          const history = await db.price_history
            .where('scryfall_id')
            .equals(entry.scryfall_id)
            .sortBy('date');
          if (history.length >= 2) {
            const earliest = history[0].price_eur;
            const latest = history[history.length - 1].price_eur;
            const pctChange = earliest !== 0 ? Math.abs((latest - earliest) / earliest) * 100 : 0;
            if (pctChange >= entry.alert_threshold) {
              triggered = true;
            }
          }
        }

        if (triggered) {
          alerts.push({
            scryfall_id: entry.scryfall_id,
            alert_type: entry.alert_type,
            alert_threshold: entry.alert_threshold,
            current_price_gbp: eurToGbpValue(priceEur),
            card_name: card.name,
          });
          await db.watchlist.update(entry.id, {
            last_alerted_at: new Date().toISOString(),
          });
        }
      }

      this.pendingAlerts = alerts;
      this.alertBadgeCount = alerts.length;
      // Reload watchlist to pick up last_alerted_at changes
      this.watchlist = await db.watchlist.toArray();
    },

    async loadSpoilers(setCode) {
      this.activeSet = setCode;
      const allCards = await db.cards.where('set').equals(setCode).toArray();
      this.spoilerCards = this._applyFilters(allCards);
    },

    filterSpoilers() {
      if (!this.activeSet) return;
      // Re-filter from the full set data
      db.cards.where('set').equals(this.activeSet).toArray().then(allCards => {
        this.spoilerCards = this._applyFilters(allCards);
      });
    },

    _applyFilters(cards) {
      let filtered = cards;

      // Colour filter: card must contain all selected colours
      if (this.spoilerFilters.colours.length > 0) {
        filtered = filtered.filter(c =>
          this.spoilerFilters.colours.every(col =>
            (c.color_identity || []).includes(col)
          )
        );
      }

      // Rarity filter
      if (this.spoilerFilters.rarity !== 'all') {
        filtered = filtered.filter(c => c.rarity === this.spoilerFilters.rarity);
      }

      // Type filter
      if (this.spoilerFilters.type !== 'all') {
        filtered = filtered.filter(c =>
          (c.type_line || '').toLowerCase().includes(this.spoilerFilters.type.toLowerCase())
        );
      }

      return filtered;
    },

    async loadMovers() {
      const result = await computeMovers(this.moversPeriod);
      this.gainers = result.gainers;
      this.losers = result.losers;
    },

    setTab(tab) {
      this.activeTab = tab;
    },
  });
}

// Phase 12 Plan 01 (SYNC-08) — test-only helper.
// Runs a single poll cycle synchronously so Vitest can assert syncErrorCount
// transitions without waiting for the 2s setInterval. Mirrors the inner
// callback of `_pollSyncErrors` verbatim — when the interval body changes,
// update both together.
export async function __tickSyncErrorPoll() {
  const store = window.Alpine?.store?.('market');
  if (!store) return;
  try {
    const auth = window.Alpine?.store?.('auth');
    if (!auth || auth.status !== 'authed') {
      if (store.syncErrorCount !== 0) store.syncErrorCount = 0;
      return;
    }
    store.syncErrorCount = await db.sync_conflicts.count();
  } catch {
    // swallow — matches _pollSyncErrors interval-body behaviour
  }
}
