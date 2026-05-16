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
      selectedKeys: new Set(),
      _bump: 0,
      get groups() { return $store.collection.grouped; },
      get selectedCount() {
        // bump is read here so Alpine treeshake doesn't drop the dep
        return this._bump, this.selectedKeys.size;
      },
      isSelected(key) {
        return this._bump, this.selectedKeys.has(key);
      },
      toggleSelect(key) {
        if (this.selectedKeys.has(key)) this.selectedKeys.delete(key);
        else this.selectedKeys.add(key);
        this._bump++;
      },
      selectAllOnPage() {
        for (const g of this.groups) this.selectedKeys.add(g.key);
        this._bump++;
      },
      clearSelection() {
        this.selectedKeys.clear();
        this._bump++;
      },
      async deleteSelected() {
        if (this.selectedKeys.size === 0) return;
        // 260516-mss: explicit confirm before destructive bulk-delete.
        // Window.confirm is intentionally synchronous + native — keeps the
        // 'I really mean this' moment unmistakable. Counts singular cards
        // and total copies so the user sees the real blast radius.
        const sel = this.groups.filter(g => this.selectedKeys.has(g.key));
        const totalCopies = sel.reduce((s, g) => s + (g.totalQty || 0), 0);
        const cardCount = sel.length;
        const cardsLabel = cardCount === 1 ? '1 card' : (cardCount + ' cards');
        const copiesLabel = totalCopies === 1 ? '1 copy' : (totalCopies + ' copies');
        const msg = 'Permanently remove ' + cardsLabel + ' (' + copiesLabel + ') from your collection?\\n\\nThis cannot be undone.';
        if (!window.confirm(msg)) return;
        const ids = sel.flatMap(g => (g.entries || []).map(e => e.id)).filter(Boolean);
        await $store.collection.deleteEntries(ids);
        this.selectedKeys.clear();
        this._bump++;
        $store.toast?.success?.('Removed ' + cardsLabel + ' from collection.');
      }
    }">
      <!-- No-results state is rendered by the screen-level template
           (treasure-cruise.js) via $store.collection.sorted.length === 0,
           which fires for the grouped view too. -->
      <template x-if="groups.length > 0">
        <div class="flex flex-col gap-[16px]">
          <!-- 260516-gsr: in-view sort affordance + 260516-mss: multi-select
               toolbar. When selection is empty the row reads as
               'N UNIQUE CARDS · SORT [dropdown]'. When N cards are selected
               it swaps into 'N SELECTED · SELECT ALL · CLEAR · DELETE'
               with the destructive button styled red. -->
          <div class="flex items-center justify-between" style="padding: 4px 0;">
            <template x-if="selectedCount === 0">
              <span class="font-mono uppercase text-[11px] tracking-[0.15em] text-text-muted"
                x-text="groups.length + (groups.length === 1 ? ' UNIQUE CARD' : ' UNIQUE CARDS')"></span>
            </template>
            <template x-if="selectedCount > 0">
              <div class="flex items-center gap-sm">
                <span class="font-mono uppercase text-[11px] tracking-[0.15em] font-bold text-primary"
                  x-text="selectedCount + ' SELECTED'"></span>
                <button
                  @click="selectAllOnPage()"
                  class="font-mono uppercase text-[10px] tracking-[0.1em] font-bold cursor-pointer"
                  style="background: transparent; border: 1px solid var(--color-border-ghost); color: var(--color-text-muted); padding: 4px 8px;"
                  onmouseenter="this.style.color='var(--color-text-primary)'; this.style.borderColor='var(--color-primary)'"
                  onmouseleave="this.style.color='var(--color-text-muted)'; this.style.borderColor='var(--color-border-ghost)'"
                >SELECT ALL</button>
                <button
                  @click="clearSelection()"
                  class="font-mono uppercase text-[10px] tracking-[0.1em] font-bold cursor-pointer"
                  style="background: transparent; border: 1px solid var(--color-border-ghost); color: var(--color-text-muted); padding: 4px 8px;"
                  onmouseenter="this.style.color='var(--color-text-primary)'; this.style.borderColor='var(--color-primary)'"
                  onmouseleave="this.style.color='var(--color-text-muted)'; this.style.borderColor='var(--color-border-ghost)'"
                >CLEAR</button>
                <button
                  @click="deleteSelected()"
                  class="font-mono uppercase text-[10px] tracking-[0.1em] font-bold cursor-pointer"
                  style="background: var(--color-secondary); border: 1px solid var(--color-secondary); color: var(--color-text-primary); padding: 4px 8px;"
                  onmouseenter="this.style.boxShadow='0 0 8px var(--color-glow-red, rgba(226,56,56,0.5))'"
                  onmouseleave="this.style.boxShadow='none'"
                  x-text="'DELETE ' + selectedCount"
                ></button>
              </div>
            </template>
            <div class="flex items-center gap-sm">
              <template x-if="selectedCount === 0">
                <button
                  @click="selectAllOnPage()"
                  class="font-mono uppercase text-[10px] tracking-[0.1em] font-bold cursor-pointer"
                  style="background: transparent; border: 1px solid var(--color-border-ghost); color: var(--color-text-muted); padding: 4px 8px;"
                  onmouseenter="this.style.color='var(--color-text-primary)'; this.style.borderColor='var(--color-primary)'"
                  onmouseleave="this.style.color='var(--color-text-muted)'; this.style.borderColor='var(--color-border-ghost)'"
                >SELECT ALL</button>
              </template>
              <span class="font-mono uppercase text-[10px] tracking-[0.1em] font-bold text-text-muted">SORT</span>
              <select
                x-model="$store.collection.sortBy"
                class="font-mono text-[11px] uppercase tracking-[0.15em] cursor-pointer px-sm py-xs outline-none"
                style="background: var(--color-background, #0B0C10); border: 1px solid var(--color-border-ghost, #2A2D3A); color: var(--color-text-primary, #E8E6E3); padding: 4px 8px;">
                <option value="name-asc">NAME A-Z</option>
                <option value="name-desc">NAME Z-A</option>
                <option value="price-desc">PRICE HIGH-LOW</option>
                <option value="price-asc">PRICE LOW-HIGH</option>
                <option value="date-desc">DATE ADDED (NEW)</option>
                <option value="date-asc">DATE ADDED (OLD)</option>
                <option value="set-asc">SET RELEASE</option>
              </select>
            </div>
          </div>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-[24px]">
          <template x-for="(g, idx) in groups" :key="g.key">
            <div class="card-tile-hover cursor-pointer flex flex-col"
                 tabindex="0"
                 :style="isSelected(g.key) ? 'background: #14161C; border: 2px solid var(--color-primary, #0D52BD); position: relative; box-shadow: 0 0 12px var(--color-glow-blue, rgba(13,82,189,0.4));' : 'background: #14161C; border: 1px solid #2A2D3A; position: relative;'"
                 @click="g.card && $store.search.selectResult(g.card)"
                 @contextmenu.prevent="g.entries && g.entries[0] && $dispatch('card-context-menu', { entry: g.entries[0], x: $event.clientX, y: $event.clientY })">
              <!-- Multi-select checkbox (260516-mss) — visible always; clicks
                   here stop propagation so they don't open the card flyout.
                   Sits top-left so it doesn't fight with the qty-badge. -->
              <button
                type="button"
                @click.stop="toggleSelect(g.key)"
                :title="isSelected(g.key) ? 'Deselect this card' : 'Select for bulk actions'"
                :aria-pressed="isSelected(g.key)"
                :style="isSelected(g.key) ? 'background: var(--color-primary, #0D52BD); border: 1px solid var(--color-primary, #0D52BD); color: var(--color-text-primary, #E8E6E3);' : 'background: rgba(20,22,28,0.85); border: 1px solid var(--color-border-ghost, #2A2D3A); color: var(--color-text-muted, #8A8F98);'"
                style="position: absolute; top: 8px; left: 8px; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; z-index: 5;"
              >
                <span class="material-symbols-outlined" style="font-size: 16px;"
                  x-text="isSelected(g.key) ? 'check_box' : 'check_box_outline_blank'"></span>
              </button>
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

                <!-- Owned-count badge — 260516-qty: only rendered for x2+ so
                     singletons read clean. Single copies are the common case;
                     the badge is signal for "you have multiples" specifically. -->
                <template x-if="g.totalQty >= 2">
                  <span class="qty-badge" x-text="'x' + g.totalQty"></span>
                </template>
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
