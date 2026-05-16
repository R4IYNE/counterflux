/**
 * Grouped view component for the Treasure Cruise collection screen.
 *
 * Aggregates collection entries by oracle_id (same card across printings),
 * showing total qty owned + foil/non-foil split + printings breakdown per
 * tile. The grouping logic lives in the collection store's `grouped` getter
 * (src/stores/collection.js); this component is the render surface.
 *
 * Quick task 260516-08x.
 *
 * @returns {string} HTML string with Alpine bindings
 */
export function renderGroupedView() {
  return `
    <div x-data="{
      get groups() { return $store.collection.grouped; }
    }">
      <!-- No-results state is rendered by the screen-level template
           (treasure-cruise.js) via $store.collection.sorted.length === 0,
           which fires for the grouped view too. -->
      <template x-if="groups.length > 0">
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-[24px]">
          <template x-for="(g, idx) in groups" :key="g.key">
            <div class="card-tile-hover cursor-pointer flex flex-col"
                 tabindex="0"
                 style="background: #14161C; border: 1px solid #2A2D3A; position: relative;"
                 @click="g.card && $store.search.selectResult(g.card)"
                 @contextmenu.prevent="g.entries && g.entries[0] && $dispatch('card-context-menu', { entry: g.entries[0], x: $event.clientX, y: $event.clientY })">
              <!-- Image area -->
              <div class="relative overflow-hidden" style="aspect-ratio: 63/88;">
                <img
                  :src="g.card?._thumbnail || g.card?.image_uris?.small || g.card?.card_faces?.[0]?.image_uris?.small || ''"
                  :alt="g.card?.name || 'Card'"
                  class="w-full h-full object-cover opacity-80 transition-all duration-500"
                  loading="lazy"
                  onerror="this.style.display='none'"
                >
                <!-- Gradient overlay -->
                <div class="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-[#14161C] to-transparent pointer-events-none"></div>

                <!-- Owned-count badge (always visible in grouped view — the primary affordance).
                     260516-grd: previous "N PRINTS" pill removed per user request;
                     the printing count is still surfaced inside the flyout's
                     IN YOUR COLLECTION breakdown when the user clicks in. -->
                <span class="qty-badge" x-text="'x' + g.totalQty"></span>
              </div>

              <!-- Metadata -->
              <div class="p-[8px] flex flex-col gap-[2px]">
                <span class="text-[14px] font-bold leading-[1.3] truncate"
                      style="font-family: 'Space Grotesk', sans-serif; color: #EAECEE;"
                      x-text="g.card?.name || 'Unknown'"></span>

                <!-- Foil / non-foil breakdown line -->
                <span class="font-mono text-[10px] tracking-[0.1em] uppercase font-bold"
                      style="color: #7A8498;"
                      x-text="
                        (g.nonFoilQty > 0 ? g.nonFoilQty + ' NORMAL' : '')
                        + (g.foilQty > 0 && g.nonFoilQty > 0 ? ' · ' : '')
                        + (g.foilQty > 0 ? g.foilQty + ' FOIL' : '')
                      "></span>

                <!-- Estimated value (rolled up across printings) -->
                <span class="font-mono text-[11px] tracking-[0.15em]"
                      style="color: #0D52BD;"
                      x-text="window.__cf_eurToGbpValue
                        ? window.__cf_eurToGbpValue(g.estimatedValue).toFixed(2).replace(/^/, '£')
                        : ('€' + g.estimatedValue.toFixed(2))"></span>
              </div>
            </div>
          </template>
        </div>
      </template>
    </div>
  `;
}
