import { renderReleaseCalendar } from '../components/release-calendar.js';
import { renderPreordainTabs } from '../components/preordain-tabs.js';
import { renderSpoilerGallery } from '../components/spoiler-gallery.js';
import { renderWatchlistPanel } from '../components/watchlist-panel.js';
import { renderMoversPanel } from '../components/movers-panel.js';

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

        <!-- Watchlist tab -->
        <template x-if="$store.market.activeTab === 'watchlist'">
          ${renderWatchlistPanel()}
        </template>

        <!-- Movers tab -->
        <template x-if="$store.market.activeTab === 'movers'">
          ${renderMoversPanel()}
        </template>

      </div>

    </div>
  `;

  // Cleanup on unmount
  container._cleanup = () => {
    // Future cleanup if needed
  };
}
