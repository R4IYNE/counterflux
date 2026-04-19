/**
 * Spoiler gallery component for the Preordain screen.
 *
 * Phase 12 Plan 04 rewrite — sectioned grid grouped by released_at with
 * day headers, fixed 2/3/4 column layout (D-06), hover-reveal watchlist
 * bookmark (MARKET-03), full-size hover card preview (MARKET-02, D-08),
 * and the custom Keyrune set-filter dropdown from Plan 02 (MARKET-01).
 *
 * Design contract refs: 12-CONTEXT.md D-06, D-07, D-08, D-09, D-10.
 * Architecture refs: 12-RESEARCH.md §Pattern 5 (date grouping), §Pattern 6
 * (hover preview), §Pattern 7 (bookmark CSS), §Pitfall 3 (DFC fallback),
 * §Pitfall 8 (empty-group guard).
 *
 * Importantly — this file does NOT import or reference the notification
 * surface; the bookmark icon glyph swap is the visual feedback per D-10.
 * tests/spoiler-gallery.test.js enforces this invariant via a static-grep
 * gate over the file source (no notification-surface references anywhere).
 *
 * @returns {string} HTML string with Alpine bindings
 */
import { renderSpoilerSetFilter } from './spoiler-set-filter.js';

export function renderSpoilerGallery() {
  return `
    <div x-data="{
      isNew(dateStr) {
        return dateStr && (Date.now() - new Date(dateStr).getTime()) < 48 * 60 * 60 * 1000;
      },
      formatReleaseDate(dateStr) {
        if (!dateStr || dateStr === 'unknown') return 'UNRELEASED';
        const d = new Date(dateStr);
        const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        return months[d.getMonth()] + ' ' + String(d.getDate()).padStart(2, '0') + ', ' + d.getFullYear();
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

      <!-- Set selector (Plan 12-02 custom keyrune dropdown — replaces native <select>) -->
      <div class="flex items-center gap-[8px]">
        <span class="font-mono uppercase text-[11px] tracking-[0.15em] font-bold"
              style="color: #7A8498;">SET:</span>
        ${renderSpoilerSetFilter()}
      </div>

      <!-- Filter bar (UNCHANGED from pre-Phase-12 — colour/rarity/type) -->
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
        <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[24px]">
          <template x-for="i in 6" :key="'skel-' + i">
            <div class="shimmer" style="aspect-ratio: 63/88; background: #14161C; border: 1px solid #2A2D3A;"></div>
          </template>
        </div>
      </template>

      <!-- Sectioned grid — grouped by released_at, newest first (MARKET-02 / D-07).
           Outer x-if on groupedSpoilerCards.length > 0 per Pitfall 8 so the empty
           state templates below stay the single source of truth for "no cards" UX. -->
      <template x-if="!$store.market.loading && $store.market.groupedSpoilerCards.length > 0">
        <div class="flex flex-col gap-[32px]">
          <template x-for="group in $store.market.groupedSpoilerCards" :key="group.date">
            <section>
              <!-- Day header: 'APR 18, 2026 • 12 CARDS' (D-07) -->
              <div class="pb-[8px] mb-[16px] flex items-center gap-[12px]"
                   style="border-bottom: 1px solid #2A2D3A;">
                <span
                  class="font-mono uppercase text-[11px] tracking-[0.15em] font-bold"
                  style="color: #7A8498;"
                  x-text="formatReleaseDate(group.date) + ' • ' + group.cards.length + ' CARDS'"
                ></span>
              </div>

              <!-- Fixed 2/3/4 column grid (D-06) — legacy responsive 5/6-col scale removed -->
              <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[24px]">
                <template x-for="card in group.cards" :key="card.id">
                  <div
                    x-data="{
                      hovered: false,
                      flipLeft: false,
                      card: card,
                      get isWatching() {
                        return $store.market.watchlist.some(w => w.scryfall_id === this.card.id);
                      }
                    }"
                    @mouseenter="hovered = true; const r = $el.getBoundingClientRect(); flipLeft = (window.innerWidth - r.right) < 270;"
                    @mouseleave="hovered = false"
                    class="card-tile-hover cursor-pointer flex flex-col relative"
                    style="background: #14161C; border: 1px solid #2A2D3A;"
                    @click="$store.search.selectResult(card)"
                    @contextmenu.prevent="$dispatch('card-context-menu', { entry: { card: card }, x: $event.clientX, y: $event.clientY })"
                  >
                    <!-- Hover-reveal bookmark button (MARKET-03 / D-09, D-10).
                         Persistent via .is-watching class when card is on watchlist;
                         glyph swaps between bookmark_add and bookmark — no notification fires. -->
                    <button
                      type="button"
                      class="cf-spoiler-bookmark"
                      :class="{ 'is-watching': isWatching }"
                      :aria-label="isWatching ? ('Remove ' + card.name + ' from watchlist') : ('Add ' + card.name + ' to watchlist')"
                      :title="isWatching ? 'Remove from watchlist' : 'Add to watchlist'"
                      @click.stop="isWatching ? $store.market.removeFromWatchlist(card.id) : $store.market.addToWatchlist(card.id)"
                    >
                      <span class="material-symbols-outlined" x-text="isWatching ? 'bookmark' : 'bookmark_add'"></span>
                    </button>

                    <!-- Thumbnail image area -->
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
                      <!-- NEW badge (48h window — existing behaviour preserved) -->
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

                    <!-- Hover preview overlay (MARKET-02 / D-08).
                         DFC-safe via card_faces[0].image_uris.normal fallback (Pitfall 3).
                         flipLeft computed on @mouseenter when within 270px of viewport right edge. -->
                    <div
                      x-show="hovered"
                      x-transition.opacity.duration.150ms
                      class="cf-hover-preview absolute top-0 w-[250px] pointer-events-none"
                      :class="flipLeft ? 'right-full mr-[8px]' : 'left-full ml-[8px]'"
                      style="z-index: 40;"
                    >
                      <img
                        :src="card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || ''"
                        :alt="card.name"
                        class="w-full"
                        style="aspect-ratio: 63/88; object-fit: cover; border: 1px solid #2A2D3A; box-shadow: 0 8px 24px rgba(0,0,0,0.6);"
                        onerror="this.style.display='none'"
                      >
                    </div>
                  </div>
                </template>
              </div>
            </section>
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
