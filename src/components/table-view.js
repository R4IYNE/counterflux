/**
 * Table view component for the Treasure Cruise collection screen.
 *
 * Renders a sortable data table with columns: Name, Set, Qty, Foil, Price (EUR), Category.
 * Active sort column highlighted in primary colour with direction arrow.
 *
 * @returns {string} HTML string with Alpine bindings
 */
export function renderTableView() {
  return `
    <div x-data="{
      get items() { return $store.collection.sorted; },
      get currentSort() { return $store.collection.sortBy; },
      toggleSort(field) {
        const [currentField, currentDir] = this.currentSort.split('-');
        if (currentField === field) {
          if (currentDir === 'asc') {
            $store.collection.setSortBy(field + '-desc');
          } else {
            $store.collection.setSortBy('name-asc');
          }
        } else {
          $store.collection.setSortBy(field + '-asc');
        }
      },
      isSortedBy(field) {
        return this.currentSort.startsWith(field + '-');
      },
      sortDir(field) {
        if (!this.isSortedBy(field)) return '';
        return this.currentSort.split('-')[1];
      }
    }">
      <div class="overflow-x-auto">
        <table class="w-full" style="border-collapse: collapse;">
          <!-- Header -->
          <thead>
            <tr style="border-bottom: 1px solid #2A2D3A;">
              <th @click="toggleSort('name')"
                  class="text-left px-[16px] py-[8px] font-mono text-[11px] uppercase tracking-[0.15em] font-bold cursor-pointer select-none"
                  :style="isSortedBy('name') ? 'color: #0D52BD;' : 'color: #7A8498;'">
                NAME
                <template x-if="isSortedBy('name')">
                  <span class="material-symbols-outlined align-middle" style="font-size: 11px;"
                        x-text="sortDir('name') === 'asc' ? 'arrow_upward' : 'arrow_downward'"></span>
                </template>
              </th>
              <th @click="toggleSort('set')"
                  class="text-left px-[16px] py-[8px] font-mono text-[11px] uppercase tracking-[0.15em] font-bold cursor-pointer select-none"
                  :style="isSortedBy('set') ? 'color: #0D52BD;' : 'color: #7A8498;'">
                SET
                <template x-if="isSortedBy('set')">
                  <span class="material-symbols-outlined align-middle" style="font-size: 11px;"
                        x-text="sortDir('set') === 'asc' ? 'arrow_upward' : 'arrow_downward'"></span>
                </template>
              </th>
              <th class="text-left px-[16px] py-[8px] font-mono text-[11px] uppercase tracking-[0.15em] font-bold"
                  style="color: #7A8498;">
                QTY
              </th>
              <th class="text-left px-[16px] py-[8px] font-mono text-[11px] uppercase tracking-[0.15em] font-bold"
                  style="color: #7A8498;">
                FOIL
              </th>
              <th @click="toggleSort('price')"
                  class="text-left px-[16px] py-[8px] font-mono text-[11px] uppercase tracking-[0.15em] font-bold cursor-pointer select-none"
                  :style="isSortedBy('price') ? 'color: #0D52BD;' : 'color: #7A8498;'">
                PRICE (GBP)
                <template x-if="isSortedBy('price')">
                  <span class="material-symbols-outlined align-middle" style="font-size: 11px;"
                        x-text="sortDir('price') === 'asc' ? 'arrow_upward' : 'arrow_downward'"></span>
                </template>
              </th>
              <th @click="toggleSort('date')"
                  class="text-left px-[16px] py-[8px] font-mono text-[11px] uppercase tracking-[0.15em] font-bold cursor-pointer select-none"
                  :style="isSortedBy('date') ? 'color: #0D52BD;' : 'color: #7A8498;'">
                CATEGORY
                <template x-if="isSortedBy('date')">
                  <span class="material-symbols-outlined align-middle" style="font-size: 11px;"
                        x-text="sortDir('date') === 'asc' ? 'arrow_upward' : 'arrow_downward'"></span>
                </template>
              </th>
            </tr>
          </thead>
          <!-- Body -->
          <tbody>
            <template x-for="(entry, idx) in items" :key="entry.id || idx">
              <tr style="border-bottom: 1px solid #2A2D3A;"
                  class="cursor-pointer transition-colors duration-150 hover:bg-[#1C1F28]"
                  @click="$store.search.selectResult(entry.card)"
                  @contextmenu.prevent="$dispatch('card-context-menu', { entry: entry, x: $event.clientX, y: $event.clientY })">
                <td class="px-[16px] py-[8px]"
                    style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; color: #EAECEE;"
                    x-text="entry.card?.name || 'Unknown'"></td>
                <td class="px-[16px] py-[8px] font-mono text-[11px] tracking-[0.15em]"
                    style="color: #7A8498;"
                    x-text="(entry.card?.set_name || entry.card?.set || '').toUpperCase()"></td>
                <td class="px-[16px] py-[8px] font-mono text-[11px] tracking-[0.15em]"
                    style="color: #EAECEE;"
                    x-text="entry.quantity"></td>
                <td class="px-[16px] py-[8px]">
                  <template x-if="entry.foil">
                    <span class="foil-badge">FOIL</span>
                  </template>
                </td>
                <td class="px-[16px] py-[8px] font-mono text-[11px] tracking-[0.15em]"
                    style="color: #0D52BD;"
                    x-text="window.__cf_eurToGbp(entry.foil ? entry.card?.prices?.eur_foil : entry.card?.prices?.eur)"></td>
                <td class="px-[16px] py-[8px] font-mono text-[11px] tracking-[0.15em] font-bold uppercase"
                    style="color: #EAECEE;"
                    x-text="(entry.category || 'owned').toUpperCase()"></td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>
  `;
}
