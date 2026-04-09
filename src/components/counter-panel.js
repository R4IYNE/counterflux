/**
 * Counter Panel -- popover for managing additional counters per player.
 * Supports 8 counter types: Energy, Experience, Treasure, Monarch, Initiative,
 * Day/Night, City's Blessing, Storm. Monarch/Initiative are exclusive (one player only).
 * Day/Night is a global toggle.
 */

const COUNTER_TYPES = [
  { name: 'ENERGY', key: 'energy', numeric: true },
  { name: 'EXPERIENCE', key: 'experience', numeric: true },
  { name: 'TREASURE', key: 'treasure', numeric: true },
  { name: 'MONARCH', key: 'monarch', numeric: false, exclusive: true },
  { name: 'INITIATIVE', key: 'initiative', numeric: false, exclusive: true },
  { name: "DAY/NIGHT", key: 'day_night', numeric: false, global: true },
  { name: "CITY'S BLESSING", key: 'citys_blessing', numeric: false },
  { name: 'STORM', key: 'storm', numeric: true },
];

/**
 * Render the counter panel popover HTML with Alpine bindings.
 * @returns {string} HTML string
 */
export function renderCounterPanel() {
  // Build the per-player counter sections
  const playerCountersTemplate = COUNTER_TYPES
    .filter(c => !c.global)
    .map(c => {
      if (c.exclusive) {
        // Exclusive counters: clicking for one player removes from all others
        return `
          <button
            class="cursor-pointer font-mono text-[11px] tracking-[0.15em] uppercase py-[4px] px-[8px]"
            :style="('${c.key}' in player.counters) ? 'background: #0D52BD; border: 1px solid #0D52BD; color: #EAECEE; font-weight: 700;' : 'background: #1C1F28; border: 1px solid #2A2D3A; color: #7A8498; font-weight: 400;'"
            @click.stop="
              if ('${c.key}' in player.counters) {
                $store.game.toggleCounter(pIdx, '${c.key}');
              } else {
                // Remove from all other players first
                $store.game.players.forEach((p, i) => {
                  if ('${c.key}' in p.counters) {
                    $store.game.toggleCounter(i, '${c.key}');
                  }
                });
                $store.game.toggleCounter(pIdx, '${c.key}');
              }
            "
          >${c.name}</button>
        `;
      } else if (c.numeric) {
        // Numeric counters: toggle on/off, show +/- when active
        return `
          <div class="flex items-center gap-[4px]">
            <button
              class="cursor-pointer font-mono text-[11px] tracking-[0.15em] uppercase py-[4px] px-[8px]"
              :style="('${c.key}' in player.counters) ? 'background: #0D52BD; border: 1px solid #0D52BD; color: #EAECEE; font-weight: 700;' : 'background: #1C1F28; border: 1px solid #2A2D3A; color: #7A8498; font-weight: 400;'"
              @click.stop="$store.game.toggleCounter(pIdx, '${c.key}')"
            >${c.name}</button>
            <template x-if="'${c.key}' in player.counters">
              <div class="flex items-center gap-[4px]">
                <button
                  class="flex items-center justify-center w-[24px] h-[24px] cursor-pointer font-mono text-[11px] font-bold"
                  style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;"
                  @click.stop="$store.game.adjustCounter(pIdx, '${c.key}', -1)"
                >-</button>
                <span class="font-mono text-[11px] tracking-[0.15em] font-bold"
                      style="color: #EAECEE; min-width: 20px; text-align: center;"
                      x-text="player.counters['${c.key}']"></span>
                <button
                  class="flex items-center justify-center w-[24px] h-[24px] cursor-pointer font-mono text-[11px] font-bold"
                  style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;"
                  @click.stop="$store.game.adjustCounter(pIdx, '${c.key}', 1)"
                >+</button>
              </div>
            </template>
          </div>
        `;
      } else {
        // Non-numeric, non-exclusive, non-global (City's Blessing)
        return `
          <button
            class="cursor-pointer font-mono text-[11px] tracking-[0.15em] uppercase py-[4px] px-[8px]"
            :style="('${c.key}' in player.counters) ? 'background: #0D52BD; border: 1px solid #0D52BD; color: #EAECEE; font-weight: 700;' : 'background: #1C1F28; border: 1px solid #2A2D3A; color: #7A8498; font-weight: 400;'"
            @click.stop="$store.game.toggleCounter(pIdx, '${c.key}')"
          >${c.name}</button>
        `;
      }
    }).join('\n');

  return `
    <div x-data="{ open: false, dayNight: 'DAY' }"
         class="relative">
      <!-- Trigger button -->
      <button
        class="flex items-center justify-center w-[48px] h-[48px] cursor-pointer"
        style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;"
        @mouseenter="$el.style.background = '#2A2D3A'"
        @mouseleave="$el.style.background = '#1C1F28'"
        @click.stop="open = !open"
        aria-label="Counters">
        <span class="material-symbols-outlined" style="font-size: 24px;">more_horiz</span>
      </button>

      <!-- Popover -->
      <div x-show="open"
           x-cloak
           @click.outside="open = false"
           class="absolute flex flex-col gap-[16px] p-[16px]"
           style="background: #14161C; border: 1px solid #2A2D3A; z-index: 40; bottom: 72px; right: 0; min-width: 280px; max-height: 400px; overflow-y: auto;">

        <!-- Header -->
        <span class="font-mono text-[11px] tracking-[0.15em] font-bold uppercase"
              style="color: #EAECEE;">COUNTERS</span>

        <!-- Day/Night global toggle -->
        <div class="flex items-center gap-[8px]">
          <button
            class="cursor-pointer font-mono text-[11px] tracking-[0.15em] uppercase py-[4px] px-[8px]"
            :style="dayNight === 'DAY' ? 'background: #F39C12; border: 1px solid #F39C12; color: #0B0C10; font-weight: 700;' : 'background: #0D52BD; border: 1px solid #0D52BD; color: #EAECEE; font-weight: 700;'"
            @click.stop="dayNight = dayNight === 'DAY' ? 'NIGHT' : 'DAY'"
          >DAY/NIGHT</button>
          <span class="font-mono text-[11px] tracking-[0.15em] font-bold"
                :style="dayNight === 'DAY' ? 'color: #F39C12;' : 'color: #0D52BD;'"
                x-text="dayNight"></span>
        </div>

        <!-- Per-player counters -->
        <template x-for="(player, pIdx) in $store.game.players" :key="pIdx">
          <div class="flex flex-col gap-[8px]">
            <!-- Player name -->
            <span class="font-mono text-[11px] tracking-[0.15em] font-bold uppercase"
                  :style="'color: ' + ['#0D52BD', '#E23838', '#2ECC71', '#F39C12', '#A855F7', '#22D3EE'][player.color_index] + ';'"
                  x-text="player.name"></span>

            <!-- Counter buttons -->
            <div class="flex flex-wrap gap-[4px]">
              ${playerCountersTemplate}
            </div>
          </div>
        </template>
      </div>
    </div>
  `;
}
