import { db } from '../db/schema.js';

/**
 * Compute set completion statistics from collection entries and card database.
 *
 * @param {Array} entries - Collection entries with joined card data (only 'owned' category)
 * @param {Array} allCards - All cards from Dexie cards table
 * @param {string} rarityFilter - Rarity tier filter: 'all', 'common', 'uncommon', 'rare', 'mythic'
 * @returns {Array} Array of { set, setName, owned, total, pct } sorted by owned descending
 */
export function computeSetCompletion(entries, allCards, rarityFilter = 'all') {
  // Group all cards by set, filtered by rarity
  const totalsBySet = {};
  for (const card of allCards) {
    if (rarityFilter !== 'all' && card.rarity !== rarityFilter) continue;
    const set = card.set;
    if (!set) continue;
    if (!totalsBySet[set]) {
      totalsBySet[set] = { set, setName: card.set_name || set, total: 0, owned: 0 };
    }
    totalsBySet[set].total++;
  }

  // Count owned cards per set (only owned category, filtered by rarity)
  for (const entry of entries) {
    if (entry.category !== 'owned') continue;
    const card = entry.card;
    if (!card) continue;
    if (rarityFilter !== 'all' && card.rarity !== rarityFilter) continue;
    const set = card.set;
    if (set && totalsBySet[set]) {
      totalsBySet[set].owned += entry.quantity;
    }
  }

  // Calculate percentages and sort
  return Object.values(totalsBySet)
    .map(s => ({
      ...s,
      pct: s.total > 0 ? Math.round((s.owned / s.total) * 100) : 0,
    }))
    .sort((a, b) => b.owned - a.owned);
}

/**
 * Set completion view component for the Treasure Cruise collection screen.
 *
 * Shows per-set progress bars with rarity filter buttons.
 *
 * @returns {string} HTML string with Alpine bindings
 */
export function renderSetCompletionView() {
  return `
    <div x-data="{
      rarityFilter: 'all',
      completionData: [],
      loading: false,

      async init() {
        await this.computeData();
        this.$watch('rarityFilter', () => this.computeData());
        this.$watch('$store.collection.entries', () => this.computeData());
      },

      async computeData() {
        this.loading = true;
        try {
          const { computeSetCompletion } = await import('./set-completion.js');
          const allCards = await (await import('../db/schema.js')).db.cards.toArray();
          this.completionData = computeSetCompletion(
            $store.collection.entries,
            allCards,
            this.rarityFilter
          );
        } catch (e) {
          console.error('[SetCompletion] Error computing data:', e);
          this.completionData = [];
        }
        this.loading = false;
      },

      filterToSet(setCode) {
        $store.collection.filters.search = '';
        $store.collection.setViewMode('gallery');
        // Will need set filter in future; for now use search
      }
    }">

      <!-- Rarity filter buttons -->
      <div class="flex items-center gap-[8px] mb-[24px]">
        <template x-for="rarity in ['all', 'common', 'uncommon', 'rare', 'mythic']" :key="rarity">
          <button
            @click="rarityFilter = rarity"
            :style="rarityFilter === rarity ? 'background: #0D52BD; color: #EAECEE;' : 'background: transparent; color: #7A8498;'"
            class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold cursor-pointer px-[12px] py-[4px] border-0 hover:text-[#EAECEE]"
            x-text="rarity.toUpperCase()"
          ></button>
        </template>
      </div>

      <!-- Loading -->
      <template x-if="loading">
        <div class="flex items-center gap-[8px] py-[24px]">
          <span class="material-symbols-outlined text-primary animate-spin" style="font-size: 16px;">progress_activity</span>
          <span class="font-mono text-[11px] uppercase tracking-[0.15em]" style="color: #7A8498;">COMPUTING SET COMPLETION...</span>
        </div>
      </template>

      <!-- Set list -->
      <template x-if="!loading">
        <div class="flex flex-col gap-[16px]">
          <template x-for="setData in completionData" :key="setData.set">
            <div class="flex flex-col gap-[4px] p-[16px] cursor-pointer transition-colors duration-150 hover:bg-[#1C1F28]"
                 style="border-bottom: 1px solid #2A2D3A;"
                 @click="filterToSet(setData.set)">
              <!-- Set header row -->
              <div class="flex items-center gap-[8px]">
                <i class="ss" :class="'ss-' + setData.set" style="font-size: 16px; color: #7A8498;"></i>
                <span class="text-[14px] font-bold flex-1"
                      style="font-family: 'Space Grotesk', sans-serif; color: #EAECEE;"
                      x-text="setData.setName"></span>
                <span class="font-mono text-[11px] tracking-[0.15em]"
                      style="color: #7A8498;"
                      x-text="setData.owned + '/' + setData.total"></span>
                <span class="font-mono text-[11px] tracking-[0.15em] font-bold"
                      style="color: #0D52BD;"
                      x-text="setData.pct + '% COMPLETE'"></span>
              </div>
              <!-- Progress bar -->
              <div class="w-full h-[4px]" style="background: #2A2D3A;">
                <div class="h-full transition-all duration-300"
                     :class="setData.pct > 0 ? 'progress-glow' : ''"
                     :style="'width: ' + setData.pct + '%; background: #0D52BD;'"></div>
              </div>
            </div>
          </template>

          <!-- Empty state -->
          <template x-if="completionData.length === 0">
            <div class="flex items-center justify-center py-[32px]">
              <span class="font-mono text-[11px] uppercase tracking-[0.15em]"
                    style="color: #7A8498;">No set data available</span>
            </div>
          </template>
        </div>
      </template>

    </div>
  `;
}
