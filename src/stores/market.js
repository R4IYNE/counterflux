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
    activeTab: 'spoilers',
    loading: false,

    async init() {
      this.loading = true;
      try {
        this.watchlist = await db.watchlist.toArray();
        this.sets = await fetchSets();
        await snapshotWatchlistPrices();
        await this.checkAlerts();
        await this.loadMovers();
      } catch (err) {
        console.error('[Market] Init error:', err);
      } finally {
        this.loading = false;
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
