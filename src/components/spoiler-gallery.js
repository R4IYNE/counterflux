/**
 * Spoiler gallery component for the Preordain screen.
 *
 * Set selector dropdown, colour/rarity/type filters, card grid with NEW badges,
 * loading skeletons, and empty states.
 *
 * @returns {string} HTML string with Alpine bindings
 */
export function renderSpoilerGallery() {
  return `
    <div x-data="{
      isNew(dateStr) {
        return dateStr && (Date.now() - new Date(dateStr).getTime()) < 48 * 60 * 60 * 1000;
      },
      toggleColour(code) {
        const colours = $store.market.spoilerFilters.colours;
        const idx = colours.indexOf(code);
        if (idx === -1) {
          colours.push(code);
        } else {
          colours.splice(idx, 1);
        }
        $store.market.filterSpoilers();
      }
    }" class="flex flex-col gap-[16px]">

      <!-- Set selector -->
      <div class="flex items-center gap-[8px]">
        <span class="font-mono uppercase text-[11px] tracking-[0.15em] font-bold"
              style="color: #7A8498;">SET:</span>
        <select
          @change="$store.market.loadSpoilers($event.target.value)"
          class="font-mono text-[11px] uppercase tracking-[0.15em] cursor-pointer px-[8px] py-[4px] outline-none"
          style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;"
        >
          <option value="">SELECT SET</option>
          <template x-for="set in $store.market.sets" :key="set.code">
            <option :value="set.code" x-text="set.name + ' (' + set.card_count + ')'"></option>
          </template>
        </select>
      </div>

      <!-- Filter bar -->
      <div class="flex items-center gap-[16px] flex-wrap"
           style="background: #1C1F28; padding: 8px 16px;">

        <!-- COLOUR multi-select -->
        <div class="flex items-center gap-[8px]">
          <span class="font-mono uppercase text-[11px] tracking-[0.15em] font-bold"
                style="color: #7A8498;">COLOUR</span>
          <div class="flex items-center gap-[4px]">
            <button @click="toggleColour('W')"
                    :style="$store.market.spoilerFilters.colours.includes('W') ? 'background: #0D52BD; color: #EAECEE;' : 'background: #1C1F28; color: #7A8498;'"
                    class="w-[28px] h-[28px] cursor-pointer border border-[#2A2D3A] flex items-center justify-center"
                    aria-label="Filter White"><i class="ms ms-w"></i></button>
            <button @click="toggleColour('U')"
                    :style="$store.market.spoilerFilters.colours.includes('U') ? 'background: #0D52BD; color: #EAECEE;' : 'background: #1C1F28; color: #7A8498;'"
                    class="w-[28px] h-[28px] cursor-pointer border border-[#2A2D3A] flex items-center justify-center"
                    aria-label="Filter Blue"><i class="ms ms-u"></i></button>
            <button @click="toggleColour('B')"
                    :style="$store.market.spoilerFilters.colours.includes('B') ? 'background: #0D52BD; color: #EAECEE;' : 'background: #1C1F28; color: #7A8498;'"
                    class="w-[28px] h-[28px] cursor-pointer border border-[#2A2D3A] flex items-center justify-center"
                    aria-label="Filter Black"><i class="ms ms-b"></i></button>
            <button @click="toggleColour('R')"
                    :style="$store.market.spoilerFilters.colours.includes('R') ? 'background: #0D52BD; color: #EAECEE;' : 'background: #1C1F28; color: #7A8498;'"
                    class="w-[28px] h-[28px] cursor-pointer border border-[#2A2D3A] flex items-center justify-center"
                    aria-label="Filter Red"><i class="ms ms-r"></i></button>
            <button @click="toggleColour('G')"
                    :style="$store.market.spoilerFilters.colours.includes('G') ? 'background: #0D52BD; color: #EAECEE;' : 'background: #1C1F28; color: #7A8498;'"
                    class="w-[28px] h-[28px] cursor-pointer border border-[#2A2D3A] flex items-center justify-center"
                    aria-label="Filter Green"><i class="ms ms-g"></i></button>
          </div>
        </div>

        <!-- RARITY dropdown -->
        <div class="flex items-center gap-[8px]">
          <span class="font-mono uppercase text-[11px] tracking-[0.15em] font-bold"
                style="color: #7A8498;">RARITY</span>
          <select
            x-model="$store.market.spoilerFilters.rarity"
            @change="$store.market.filterSpoilers()"
            class="font-mono text-[11px] uppercase tracking-[0.15em] cursor-pointer px-[8px] py-[4px] outline-none"
            style="background: #0B0C10; border: 1px solid #2A2D3A; color: #EAECEE;"
          >
            <option value="all">ALL</option>
            <option value="common">COMMON</option>
            <option value="uncommon">UNCOMMON</option>
            <option value="rare">RARE</option>
            <option value="mythic">MYTHIC</option>
          </select>
        </div>

        <!-- TYPE dropdown -->
        <div class="flex items-center gap-[8px]">
          <span class="font-mono uppercase text-[11px] tracking-[0.15em] font-bold"
                style="color: #7A8498;">TYPE</span>
          <select
            x-model="$store.market.spoilerFilters.type"
            @change="$store.market.filterSpoilers()"
            class="font-mono text-[11px] uppercase tracking-[0.15em] cursor-pointer px-[8px] py-[4px] outline-none"
            style="background: #0B0C10; border: 1px solid #2A2D3A; color: #EAECEE;"
          >
            <option value="all">ALL</option>
            <option value="creature">CREATURE</option>
            <option value="instant">INSTANT</option>
            <option value="sorcery">SORCERY</option>
            <option value="enchantment">ENCHANTMENT</option>
            <option value="artifact">ARTIFACT</option>
            <option value="planeswalker">PLANESWALKER</option>
            <option value="land">LAND</option>
          </select>
        </div>
      </div>

      <!-- Loading skeleton -->
      <template x-if="$store.market.loading">
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-[24px]">
          <template x-for="i in 6" :key="'skel-' + i">
            <div class="shimmer" style="aspect-ratio: 63/88; background: #14161C; border: 1px solid #2A2D3A;"></div>
          </template>
        </div>
      </template>

      <!-- Card grid -->
      <template x-if="!$store.market.loading && $store.market.spoilerCards.length > 0">
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-[24px]">
          <template x-for="(card, idx) in $store.market.spoilerCards" :key="card.id || idx">
            <div class="card-tile-hover cursor-pointer flex flex-col relative"
                 style="background: #14161C; border: 1px solid #2A2D3A;"
                 @click="$store.search.selectResult(card)"
                 @contextmenu.prevent="$dispatch('card-context-menu', { entry: { card: card }, x: $event.clientX, y: $event.clientY })">
              <!-- Image area -->
              <div class="relative overflow-hidden" style="aspect-ratio: 63/88;">
                <img
                  :src="card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small || ''"
                  :alt="card.name || 'Card'"
                  class="w-full h-full object-cover opacity-80 transition-all duration-500"
                  loading="lazy"
                  onerror="this.style.display='none'"
                >
                <!-- Gradient overlay -->
                <div class="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-[#14161C] to-transparent pointer-events-none"></div>
                <!-- NEW badge -->
                <template x-if="isNew(card.released_at)">
                  <span class="badge-new absolute top-[4px] right-[4px]">NEW</span>
                </template>
              </div>
              <!-- Metadata -->
              <div class="p-[8px] flex flex-col gap-[2px]">
                <span class="text-[14px] font-bold leading-[1.3] truncate"
                      style="font-family: 'Space Grotesk', sans-serif; color: #EAECEE;"
                      x-text="card.name || 'Unknown'"></span>
                <span class="font-mono text-[11px] tracking-[0.15em]"
                      style="color: #0D52BD;"
                      x-text="window.__cf_eurToGbp(card.prices?.eur)"></span>
                <span class="font-mono text-[11px] tracking-[0.15em]"
                      style="color: #4A5064;"
                      x-text="(card.set_name || card.set || '').toUpperCase()"></span>
              </div>
            </div>
          </template>
        </div>
      </template>

      <!-- No cards for set -->
      <template x-if="!$store.market.loading && $store.market.spoilerCards.length === 0 && $store.market.activeSet">
        <div class="flex flex-col items-center justify-center py-[64px] gap-[16px] text-center">
          <span style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; color: #7A8498;">
            No cards revealed yet for this set.
          </span>
        </div>
      </template>

      <!-- Empty state: no set selected -->
      <template x-if="!$store.market.activeSet && !$store.market.loading">
        <div class="flex flex-col items-center justify-center py-[64px] gap-[16px] text-center">
          <img
            src="/assets/assetsmila-izzet.png"
            alt="Mila -- Izzet Familiar"
            class="w-16 h-16 object-cover"
            style="filter: grayscale(1) opacity(0.5);"
          >
          <p style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; line-height: 1.5; color: #7A8498; max-width: 28rem;">
            Select a set above to browse spoiler cards.
          </p>
        </div>
      </template>

    </div>
  `;
}
