/**
 * Filter bar component for the Treasure Cruise collection screen.
 *
 * Contains sort dropdown, colour filter pips (WUBRG), category filter,
 * and action buttons (Add Card, Mass Entry, Import CSV, Export CSV).
 *
 * @returns {string} HTML string with Alpine bindings
 */

const MTG_COLOURS = [
  { code: 'W', name: 'White', hex: '#F9FAF4' },
  { code: 'U', name: 'Blue', hex: '#0E68AB' },
  { code: 'B', name: 'Black', hex: '#150B00' },
  { code: 'R', name: 'Red', hex: '#D3202A' },
  { code: 'G', name: 'Green', hex: '#00733E' },
];

export function renderFilterBar() {
  const colourPips = MTG_COLOURS.map(c => `
    <button
      @click="$store.collection.toggleColour('${c.code}')"
      :style="$store.collection.filters.colours.includes('${c.code}')
        ? 'background: ${c.hex}; box-shadow: 0 0 0 2px ${c.hex};'
        : 'background: #1C1F28;'"
      class="w-[24px] h-[24px] cursor-pointer border border-[#2A2D3A] flex items-center justify-center font-mono text-[11px] font-bold"
      :class="$store.collection.filters.colours.includes('${c.code}') ? '' : 'hover:border-[#4A5064]'"
      aria-label="Filter by ${c.name}"
      title="${c.name}"
    >${c.code}</button>
  `).join('');

  return `
    <div class="flex items-center gap-[16px] p-[16px] flex-wrap"
         style="background: #1C1F28;">

      <!-- Sort dropdown -->
      <div class="flex items-center gap-[8px]">
        <span class="font-mono uppercase text-[11px] tracking-[0.15em] font-bold"
              style="color: #7A8498;">SORT:</span>
        <select
          x-model="$store.collection.sortBy"
          class="font-mono text-[11px] uppercase tracking-[0.15em] cursor-pointer px-[8px] py-[4px] outline-none"
          style="background: #0B0C10; border: 1px solid #2A2D3A; color: #EAECEE;"
        >
          <option value="price-desc">PRICE DESCENDING</option>
          <option value="price-asc">PRICE ASCENDING</option>
          <option value="name-asc">NAME A-Z</option>
          <option value="name-desc">NAME Z-A</option>
          <option value="set-asc">SET RELEASE</option>
          <option value="date-desc">DATE ADDED</option>
        </select>
      </div>

      <!-- Colour filter pips -->
      <div class="flex items-center gap-[4px]">
        ${colourPips}
      </div>

      <!-- Category filter -->
      <div class="flex items-center gap-[8px]">
        <span class="font-mono uppercase text-[11px] tracking-[0.15em] font-bold"
              style="color: #7A8498;">CATEGORY:</span>
        <button
          @click="$store.collection.setCategory('all')"
          :style="$store.collection.filters.category === 'all' ? 'color: #0D52BD;' : 'color: #7A8498;'"
          class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold cursor-pointer bg-transparent border-0 hover:text-[#EAECEE]"
        >ALL</button>
        <button
          @click="$store.collection.setCategory('owned')"
          :style="$store.collection.filters.category === 'owned' ? 'color: #0D52BD;' : 'color: #7A8498;'"
          class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold cursor-pointer bg-transparent border-0 hover:text-[#EAECEE]"
        >OWNED</button>
        <button
          @click="$store.collection.setCategory('wishlist')"
          :style="$store.collection.filters.category === 'wishlist' ? 'color: #0D52BD;' : 'color: #7A8498;'"
          class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold cursor-pointer bg-transparent border-0 hover:text-[#EAECEE]"
        >WISHLIST</button>
      </div>

      <!-- Spacer -->
      <div class="flex-1"></div>

      <!-- Action buttons -->
      <div class="flex items-center gap-[8px]">
        <button
          @click="$store.collection.addCardOpen = true"
          class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold cursor-pointer px-[16px] py-[8px]"
          style="background: #0D52BD; color: #EAECEE; border: none;"
        >ADD CARD</button>
        <button
          @click="$store.collection.massEntryOpen = true"
          class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold cursor-pointer px-[16px] py-[8px]"
          style="background: #1C1F28; color: #EAECEE; border: 1px solid #2A2D3A;"
        >MASS ENTRY</button>
        <button
          @click="$store.collection.importOpen = true"
          class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold cursor-pointer px-[16px] py-[8px]"
          style="background: #1C1F28; color: #EAECEE; border: 1px solid #2A2D3A;"
        >IMPORT CSV</button>
        <button
          @click="$dispatch('export-csv')"
          class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold cursor-pointer px-[16px] py-[8px]"
          style="background: #1C1F28; color: #EAECEE; border: 1px solid #2A2D3A;"
        >EXPORT CSV</button>
      </div>

    </div>
  `;
}
