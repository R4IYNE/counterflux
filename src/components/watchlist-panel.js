/**
 * Watchlist panel component for Preordain (Market Intel) screen.
 * Renders a card watchlist with sparklines, trend indicators,
 * inline alert editing, and add-card search.
 */

import { renderSparkline } from '../utils/sparkline.js';
import { db } from '../db/schema.js';

/**
 * Render the watchlist panel HTML string with Alpine.js bindings.
 * @returns {string} HTML markup
 */
export function renderWatchlistPanel() {
  return `
    <div x-data="watchlistPanelData()" x-init="init()">
      <!-- Search input to add cards -->
      <div class="relative mb-md">
        <input
          type="text"
          x-model="searchQuery"
          @input.debounce.200ms="searchCards()"
          @keydown.escape="clearSearch()"
          placeholder="ADD CARD"
          class="w-full bg-surface-hover border border-border-ghost text-text-primary px-md py-sm outline-none focus:border-primary"
          style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700;"
        >
        <!-- Search results dropdown -->
        <div
          x-show="searchResults.length > 0"
          x-cloak
          class="absolute left-0 right-0 top-full z-30 bg-surface border border-border-ghost max-h-[240px] overflow-y-auto"
          style="box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);"
        >
          <template x-for="card in searchResults" :key="card.id">
            <button
              @click="addCard(card)"
              class="w-full text-left px-md py-sm flex items-center gap-sm hover:bg-surface-hover transition-colors cursor-pointer bg-transparent border-none"
            >
              <span
                class="text-text-primary truncate"
                style="font-family: 'Space Grotesk', sans-serif; font-size: 14px;"
                x-text="card.name"
              ></span>
              <span
                class="text-text-dim ml-auto flex-shrink-0"
                style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em;"
                x-text="card.set ? card.set.toUpperCase() : ''"
              ></span>
            </button>
          </template>
        </div>
      </div>

      <!-- Empty state -->
      <template x-if="$store.market.watchlist.length === 0 && !$store.market.loading">
        <div class="py-xl text-center w-full">
          <span class="material-symbols-outlined text-[48px] text-text-dim mb-md">visibility_off</span>
          <h3
            class="text-text-primary mb-sm"
            style="font-family: 'Space Grotesk', sans-serif; font-size: 20px; font-weight: 700;"
          >No Cards on Watch</h3>
          <p
            class="text-text-muted mx-auto max-w-[320px]"
            style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; line-height: 1.5;"
          >Right-click any card and select "Watch Price" to track its value here. Mila will alert you when prices cross your thresholds.</p>
        </div>
      </template>

      <!-- Watchlist entries -->
      <template x-if="$store.market.watchlist.length > 0">
        <div class="flex flex-col">
          <template x-for="entry in $store.market.watchlist" :key="entry.id">
            <div
              x-data="watchlistEntry(entry)"
              x-init="loadCard()"
              class="flex items-center gap-sm py-sm border-b border-border-ghost"
              style="padding: 8px 0;"
            >
              <!-- Card thumbnail -->
              <div class="w-[48px] h-[48px] flex-shrink-0 overflow-hidden bg-surface-hover">
                <img
                  x-show="cardData && cardData.image_uris"
                  :src="cardData?.image_uris?.small || cardData?.image_uris?.normal || ''"
                  :alt="cardData?.name || ''"
                  class="w-full h-full object-cover"
                  loading="lazy"
                >
              </div>

              <!-- Card name -->
              <span
                class="flex-1 truncate text-text-primary"
                style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 400;"
                x-text="cardData?.name || 'Loading...'"
              ></span>

              <!-- Current price -->
              <span
                class="flex-shrink-0 text-text-primary"
                style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em;"
                x-text="currentPrice"
              ></span>

              <!-- Sparkline -->
              <div class="flex-shrink-0 flex items-center gap-xs">
                <div x-html="sparklineSvg" class="flex-shrink-0"></div>
                <div class="flex gap-[2px]">
                  <template x-for="p in ['7d', '30d', '90d']" :key="p">
                    <button
                      @click="sparklinePeriod = p; loadSparkline()"
                      :class="sparklinePeriod === p ? 'text-text-primary' : 'text-text-dim'"
                      class="bg-transparent border-none cursor-pointer px-[2px]"
                      style="font-family: 'JetBrains Mono', monospace; font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em;"
                      x-text="p.toUpperCase()"
                    ></button>
                  </template>
                </div>
              </div>

              <!-- Trend indicator -->
              <span
                class="flex-shrink-0 min-w-[80px] text-right"
                :class="trendValue >= 0 ? 'text-success' : 'text-secondary'"
                style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 400; letter-spacing: 0.15em;"
                x-text="trendDisplay"
              ></span>

              <!-- Alert config (inline) -->
              <div class="flex-shrink-0 min-w-[120px]">
                <template x-if="!editingAlert">
                  <button
                    @click="editingAlert = true"
                    class="bg-transparent border-none cursor-pointer text-text-dim hover:text-text-primary transition-colors flex items-center gap-xs"
                    style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em;"
                  >
                    <span class="material-symbols-outlined text-[14px]">notifications</span>
                    <span x-text="alertDisplay"></span>
                  </button>
                </template>
                <template x-if="editingAlert">
                  <div class="flex items-center gap-[4px]" @keydown.escape="cancelAlertEdit()">
                    <select
                      x-model="editAlertType"
                      class="bg-surface-hover border border-border-ghost text-text-primary outline-none focus:border-primary py-[2px] px-[4px]"
                      style="font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase;"
                    >
                      <option value="">NONE</option>
                      <option value="below">BELOW</option>
                      <option value="above">ABOVE</option>
                      <option value="change_pct">CHANGE %</option>
                    </select>
                    <input
                      x-show="editAlertType !== ''"
                      type="number"
                      x-model.number="editAlertThreshold"
                      step="0.01"
                      min="0"
                      @keydown.enter="saveAlertEdit()"
                      @blur="saveAlertEdit()"
                      class="w-[60px] bg-surface-hover border border-border-ghost text-text-primary px-[4px] py-[2px] outline-none focus:border-primary"
                      style="font-family: 'JetBrains Mono', monospace; font-size: 10px;"
                      placeholder="0.00"
                    >
                  </div>
                </template>
              </div>

              <!-- Remove button -->
              <button
                @click="removeCard()"
                class="flex-shrink-0 text-text-dim hover:text-secondary transition-colors bg-transparent border-none cursor-pointer p-[4px]"
                aria-label="Remove from watchlist"
              >
                <span class="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          </template>
        </div>
      </template>
    </div>
  `;
}

/**
 * Alpine.data registration for watchlist panel top-level state.
 */
if (typeof window !== 'undefined') {
  document.addEventListener('alpine:init', () => {
    window.Alpine.data('watchlistPanelData', () => ({
      searchQuery: '',
      searchResults: [],

      init() {
        // Show pending alerts as toasts on load
        const market = this.$store.market;
        if (market.pendingAlerts && market.pendingAlerts.length > 0) {
          for (const alert of market.pendingAlerts) {
            const direction = alert.alert_type === 'below' ? 'below' : alert.alert_type === 'above' ? 'above' : 'changed past';
            this.$store.toast.show(
              `Price alert: ${alert.card_name} is now \u00a3${alert.current_price_gbp.toFixed(2)} (${direction} your \u00a3${alert.alert_threshold} target).`,
              'warning'
            );
          }
        }
      },

      async searchCards() {
        const q = this.searchQuery.trim();
        if (q.length < 2) {
          this.searchResults = [];
          return;
        }
        try {
          const results = await db.cards
            .where('name')
            .startsWithIgnoreCase(q)
            .limit(10)
            .toArray();
          this.searchResults = results;
        } catch {
          this.searchResults = [];
        }
      },

      clearSearch() {
        this.searchQuery = '';
        this.searchResults = [];
      },

      async addCard(card) {
        await this.$store.market.addToWatchlist(card.id);
        this.$store.toast.show(`${card.name} added to watchlist.`, 'success');
        this.clearSearch();
      },
    }));

    window.Alpine.data('watchlistEntry', (entry) => ({
      cardData: null,
      currentPrice: '--',
      sparklineSvg: '',
      sparklinePeriod: '7d',
      trendValue: 0,
      trendDisplay: '--',
      editingAlert: false,
      editAlertType: entry.alert_type || '',
      editAlertThreshold: entry.alert_threshold || 0,

      get alertDisplay() {
        if (!entry.alert_type) return 'SET';
        const label = entry.alert_type === 'change_pct' ? '%' : '\u00a3';
        const prefix = entry.alert_type === 'below' ? '<' : entry.alert_type === 'above' ? '>' : '\u00b1';
        return `${prefix}${label}${entry.alert_threshold ?? ''}`;
      },

      async loadCard() {
        try {
          const card = await db.cards.get(entry.scryfall_id);
          this.cardData = card;
          if (card) {
            const eurToGbp = window.__cf_eurToGbp;
            this.currentPrice = eurToGbp ? eurToGbp(card.prices?.eur) : '--';
          }
          await this.loadSparkline();
          this.computeTrend();
        } catch (e) {
          console.error('[Watchlist] Error loading card:', e);
        }
      },

      async loadSparkline() {
        try {
          const history = await db.price_history
            .where('scryfall_id')
            .equals(entry.scryfall_id)
            .sortBy('date');

          // Filter by period
          const now = Date.now();
          const periodMs = {
            '7d': 7 * 86400000,
            '30d': 30 * 86400000,
            '90d': 90 * 86400000,
          };
          const cutoff = now - (periodMs[this.sparklinePeriod] || periodMs['7d']);
          const filtered = history.filter(h => new Date(h.date).getTime() >= cutoff);
          const prices = filtered.map(h => h.price_eur);

          this.sparklineSvg = renderSparkline(prices, 80, 24);

          // Compute trend from filtered data
          if (prices.length >= 2) {
            const first = prices[0];
            const last = prices[prices.length - 1];
            const change = last - first;
            const pct = first !== 0 ? (change / first) * 100 : 0;
            const eurToGbpValue = window.__cf_eurToGbpValue || ((v) => v * 0.86);
            const changeGbp = eurToGbpValue(Math.abs(change));
            this.trendValue = change;
            const sign = change >= 0 ? '+' : '-';
            this.trendDisplay = `${sign}\u00a3${changeGbp.toFixed(2)} (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`;
          } else {
            this.trendValue = 0;
            this.trendDisplay = '--';
          }
        } catch {
          this.sparklineSvg = '';
        }
      },

      computeTrend() {
        // Trend is computed inside loadSparkline
      },

      cancelAlertEdit() {
        this.editingAlert = false;
        this.editAlertType = entry.alert_type || '';
        this.editAlertThreshold = entry.alert_threshold || 0;
      },

      async saveAlertEdit() {
        if (this.editAlertType === '') {
          await this.$store.market.updateAlert(entry.scryfall_id, null, null);
        } else {
          await this.$store.market.updateAlert(
            entry.scryfall_id,
            this.editAlertType,
            this.editAlertThreshold
          );
        }
        this.editingAlert = false;
      },

      async removeCard() {
        const name = this.cardData?.name || 'Card';
        const scryfallId = entry.scryfall_id;
        await this.$store.market.removeFromWatchlist(scryfallId);

        // Show undo toast
        this.$store.toast.show(
          `${name} removed from watchlist.`,
          'info'
        );

        // Note: Undo would require re-adding - keeping simple with toast notification.
        // A full undo system would need to preserve alert config before deletion.
      },
    }));
  });
}
