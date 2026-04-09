import { renderReleaseCalendar } from '../components/release-calendar.js';
import { renderPreordainTabs } from '../components/preordain-tabs.js';
import { renderSpoilerGallery } from '../components/spoiler-gallery.js';

/**
 * Preordain -- Market Intel screen.
 * Release calendar, three-tab navigation (Spoilers / Watchlist / Movers),
 * and tab content area.
 */
export function mount(container) {
  const Alpine = window.Alpine;
  const store = Alpine?.store('market');

  // Initialize market store if not already done
  if (store && !store._initialized) {
    store._initialized = true;
    store.init();
  }

  container.innerHTML = `
    <div x-data class="flex flex-col gap-[24px]">

      <!-- Screen overline -->
      <span class="font-mono uppercase text-[11px] tracking-[0.15em] font-bold mb-[16px]"
            style="color: #7A8498;">PREORDAIN // MARKET INTEL</span>

      <!-- Release calendar (persistent, always visible above tabs) -->
      ${renderReleaseCalendar()}

      <!-- Tab bar -->
      <div class="mt-[24px]">
        ${renderPreordainTabs()}
      </div>

      <!-- Tab content area -->
      <div class="min-h-[400px]">

        <!-- Spoilers tab -->
        <template x-if="$store.market.activeTab === 'spoilers'">
          ${renderSpoilerGallery()}
        </template>

        <!-- Watchlist tab (placeholder) -->
        <template x-if="$store.market.activeTab === 'watchlist'">
          <div class="flex flex-col items-center justify-center py-[64px] gap-[16px] text-center">
            <img
              src="/assets/assetsmila-izzet.png"
              alt="Mila -- Izzet Familiar"
              class="w-16 h-16 object-cover"
              style="filter: grayscale(1) opacity(0.5);"
            >
            <h2 class="syne-header" style="font-size: 20px; font-weight: 700; line-height: 1.2; letter-spacing: 0.01em; color: #EAECEE;">No Cards on Watch</h2>
            <p style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; line-height: 1.5; color: #7A8498; max-width: 28rem;">
              Right-click any card and select "Watch Price" to track its value here. Mila will alert you when prices cross your thresholds.
            </p>
          </div>
        </template>

        <!-- Movers tab (placeholder) -->
        <template x-if="$store.market.activeTab === 'movers'">
          <div class="flex flex-col items-center justify-center py-[64px] gap-[16px] text-center">
            <img
              src="/assets/assetsmila-izzet.png"
              alt="Mila -- Izzet Familiar"
              class="w-16 h-16 object-cover"
              style="filter: grayscale(1) opacity(0.5);"
            >
            <h2 class="syne-header" style="font-size: 20px; font-weight: 700; line-height: 1.2; letter-spacing: 0.01em; color: #EAECEE;">Market Data Loading</h2>
            <p style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; line-height: 1.5; color: #7A8498; max-width: 28rem;">
              Price history builds over time. Check back after a few days of data collection for market movers.
            </p>
          </div>
        </template>

      </div>

    </div>
  `;

  // Cleanup on unmount
  container._cleanup = () => {
    // Future cleanup if needed
  };
}
