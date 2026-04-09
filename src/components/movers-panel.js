/**
 * Market movers panel component for Preordain (Market Intel) screen.
 * Displays top gainers and losers in a two-column layout with period toggles.
 */

/**
 * Render the movers panel HTML string with Alpine.js bindings.
 * @returns {string} HTML markup
 */
export function renderMoversPanel() {
  return `
    <div>
      <!-- Period toggle -->
      <div class="flex items-center gap-sm mb-md">
        <template x-for="period in ['24h', '7d', '30d']" :key="period">
          <button
            @click="$store.market.moversPeriod = period; $store.market.loadMovers()"
            :class="$store.market.moversPeriod === period ? 'text-text-primary' : 'text-text-dim'"
            class="bg-transparent border-none cursor-pointer px-sm py-xs transition-colors hover:text-text-primary"
            style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700;"
            x-text="period.toUpperCase()"
          ></button>
        </template>
      </div>

      <!-- Empty state -->
      <template x-if="$store.market.gainers.length === 0 && $store.market.losers.length === 0 && !$store.market.loading">
        <div class="py-xl text-center w-full">
          <span class="material-symbols-outlined text-[48px] text-text-dim mb-md">trending_up</span>
          <h3
            class="text-text-primary mb-sm"
            style="font-family: 'Space Grotesk', sans-serif; font-size: 20px; font-weight: 700;"
          >Market Data Loading</h3>
          <p
            class="text-text-muted mx-auto max-w-[320px]"
            style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; line-height: 1.5;"
          >Price history builds over time. Check back after a few days of data collection for market movers.</p>
        </div>
      </template>

      <!-- Two-column layout: Gainers / Losers -->
      <template x-if="$store.market.gainers.length > 0 || $store.market.losers.length > 0">
        <div class="grid grid-cols-2 gap-lg">
          <!-- TOP GAINERS -->
          <div>
            <h3
              class="mb-sm text-success"
              style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700;"
            >TOP GAINERS</h3>
            <div class="flex flex-col">
              <template x-for="(card, idx) in $store.market.gainers.slice(0, 10)" :key="card.scryfall_id">
                <div class="flex items-center gap-sm py-xs border-b border-border-ghost" style="padding: 6px 0;">
                  <!-- Rank -->
                  <span
                    class="text-text-dim flex-shrink-0 w-[20px] text-right"
                    style="font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.15em; font-weight: 400;"
                    x-text="idx + 1"
                  ></span>
                  <!-- Card name -->
                  <span
                    class="flex-1 truncate text-text-primary"
                    style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 400;"
                    x-text="card.name || card.scryfall_id"
                  ></span>
                  <!-- Current price -->
                  <span
                    class="flex-shrink-0 text-text-primary"
                    style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em;"
                    x-text="window.__cf_eurToGbp ? window.__cf_eurToGbp(card.currentPrice) : '--'"
                  ></span>
                  <!-- Change amount -->
                  <span
                    class="flex-shrink-0 text-success"
                    style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 400; letter-spacing: 0.15em;"
                    x-text="'+' + (card.change != null ? card.change.toFixed(2) : '0.00')"
                  ></span>
                  <!-- Change percentage -->
                  <span
                    class="flex-shrink-0 text-success"
                    style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 400; letter-spacing: 0.15em;"
                    x-text="'+' + (card.changePct != null ? card.changePct.toFixed(1) : '0.0') + '%'"
                  ></span>
                </div>
              </template>
            </div>
          </div>

          <!-- TOP LOSERS -->
          <div>
            <h3
              class="mb-sm text-secondary"
              style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700;"
            >TOP LOSERS</h3>
            <div class="flex flex-col">
              <template x-for="(card, idx) in $store.market.losers.slice(0, 10)" :key="card.scryfall_id">
                <div class="flex items-center gap-sm py-xs border-b border-border-ghost" style="padding: 6px 0;">
                  <!-- Rank -->
                  <span
                    class="text-text-dim flex-shrink-0 w-[20px] text-right"
                    style="font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.15em; font-weight: 400;"
                    x-text="idx + 1"
                  ></span>
                  <!-- Card name -->
                  <span
                    class="flex-1 truncate text-text-primary"
                    style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 400;"
                    x-text="card.name || card.scryfall_id"
                  ></span>
                  <!-- Current price -->
                  <span
                    class="flex-shrink-0 text-text-primary"
                    style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em;"
                    x-text="window.__cf_eurToGbp ? window.__cf_eurToGbp(card.currentPrice) : '--'"
                  ></span>
                  <!-- Change amount -->
                  <span
                    class="flex-shrink-0 text-secondary"
                    style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 400; letter-spacing: 0.15em;"
                    x-text="(card.change != null ? card.change.toFixed(2) : '0.00')"
                  ></span>
                  <!-- Change percentage -->
                  <span
                    class="flex-shrink-0 text-secondary"
                    style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 400; letter-spacing: 0.15em;"
                    x-text="(card.changePct != null ? card.changePct.toFixed(1) : '0.0') + '%'"
                  ></span>
                </div>
              </template>
            </div>
          </div>
        </div>
      </template>
    </div>
  `;
}
