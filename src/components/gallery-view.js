import { renderCardTile } from './card-tile.js';

/**
 * Gallery view component for the Treasure Cruise collection screen.
 *
 * Renders a responsive grid of card tiles. Uses Alpine x-for for small
 * collections and the virtual scroller for large ones (200+ items).
 *
 * @returns {string} HTML string with Alpine bindings
 */
export function renderGalleryView() {
  return `
    <div x-data="{
      get items() { return $store.collection.sorted; }
    }">
      <!-- Direct render for small collections -->
      <template x-if="items.length <= 200">
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-[24px]">
          <template x-for="(entry, idx) in items" :key="entry.id || idx">
            <div class="card-tile-hover cursor-pointer flex flex-col"
                 style="background: #14161C; border: 1px solid #2A2D3A;"
                 @click="$store.search.selectResult(entry.card)"
                 @contextmenu.prevent="$dispatch('card-context-menu', { entry: entry, x: $event.clientX, y: $event.clientY })">
              <!-- Image area -->
              <div class="relative overflow-hidden" style="aspect-ratio: 63/88;">
                <img
                  :src="entry.card?._thumbnail || entry.card?.image_uris?.small || entry.card?.card_faces?.[0]?.image_uris?.small || ''"
                  :alt="entry.card?.name || 'Card'"
                  class="w-full h-full object-cover opacity-80 transition-all duration-500"
                  loading="lazy"
                  onerror="this.style.display='none'"
                >
                <!-- Gradient overlay -->
                <div class="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-[#14161C] to-transparent pointer-events-none"></div>
                <template x-if="entry.quantity > 1">
                  <span class="qty-badge" x-text="'x' + entry.quantity"></span>
                </template>
                <template x-if="entry.foil">
                  <span class="foil-badge absolute bottom-0 left-0 mb-[8px] ml-[8px]">FOIL</span>
                </template>
              </div>
              <!-- Metadata -->
              <div class="p-[8px] flex flex-col gap-[2px]">
                <span class="text-[14px] font-bold leading-[1.3] truncate"
                      style="font-family: 'Space Grotesk', sans-serif; color: #EAECEE;"
                      x-text="entry.card?.name || 'Unknown'"></span>
                <span class="font-mono text-[11px] tracking-[0.15em]"
                      style="color: #0D52BD;"
                      x-text="window.__cf_eurToGbp(entry.foil ? entry.card?.prices?.eur_foil : entry.card?.prices?.eur)"></span>
                <span class="font-mono text-[11px] tracking-[0.15em]"
                      style="color: #4A5064;"
                      x-text="(entry.card?.set_name || entry.card?.set || '').toUpperCase()"></span>
              </div>
            </div>
          </template>
        </div>
      </template>

      <!-- Virtual scrolling for large collections -->
      <template x-if="items.length > 200">
        <div x-data="{
          init() {
            this.setupVirtualScroller();
            this.$watch('items', () => this.scroller?.update());
          },
          scroller: null,
          async setupVirtualScroller() {
            const { createVirtualScroller } = await import('./virtual-scroller.js');
            const store = this.$store.collection;
            this.scroller = createVirtualScroller(this.$el, {
              itemHeight: 320,
              columns: 4,
              overscan: 2,
              getItemCount: () => store.sorted.length,
              renderItem: (i) => {
                const entry = store.sorted[i];
                if (!entry) return '';
                const card = entry.card;
                const imgSrc = card?._thumbnail || card?.image_uris?.small || card?.card_faces?.[0]?.image_uris?.small || '';
                const name = card?.name || 'Unknown';
                const eurPrice = entry.foil ? card?.prices?.eur_foil : card?.prices?.eur;
                const price = window.__cf_eurToGbp ? window.__cf_eurToGbp(eurPrice) : (eurPrice || '--');
                const setName = (card?.set_name || card?.set || '').toUpperCase();
                const qtyBadge = entry.quantity > 1 ? '<span class=\"qty-badge\">x' + entry.quantity + '</span>' : '';
                const foilBadge = entry.foil ? '<span class=\"foil-badge absolute bottom-0 left-0 mb-[8px] ml-[8px]\">FOIL</span>' : '';
                return '<div class=\"card-tile-hover cursor-pointer flex flex-col\" style=\"background: #14161C; border: 1px solid #2A2D3A;\">'
                  + '<div class=\"relative overflow-hidden\" style=\"aspect-ratio: 63/88;\">'
                  + '<img src=\"' + imgSrc + '\" alt=\"' + name + '\" class=\"w-full h-full object-cover opacity-80 transition-all duration-500\" loading=\"lazy\" onerror=\"this.style.display=\'none\'\">'
                  + '<div class=\"absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-[#14161C] to-transparent pointer-events-none\"></div>'
                  + qtyBadge + foilBadge
                  + '</div>'
                  + '<div class=\"p-[8px] flex flex-col gap-[2px]\">'
                  + '<span class=\"text-[14px] font-bold leading-[1.3] truncate\" style=\"font-family: Space Grotesk, sans-serif; color: #EAECEE;\">' + name + '</span>'
                  + '<span class=\"font-mono text-[11px] tracking-[0.15em]\" style=\"color: #0D52BD;\">' + price + '</span>'
                  + '<span class=\"font-mono text-[11px] tracking-[0.15em]\" style=\"color: #4A5064;\">' + setName + '</span>'
                  + '</div></div>';
              }
            });
          },
          destroy() {
            this.scroller?.destroy();
          }
        }" class="min-h-[400px]" style="height: calc(100vh - 400px);"></div>
      </template>
    </div>
  `;
}
