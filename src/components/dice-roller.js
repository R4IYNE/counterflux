/**
 * Dice Roller -- popover with d4-d20 dice options and high roll mode.
 * Positioned above the floating toolbar, triggered by dice icon button.
 */

/**
 * Render the dice roller popover HTML with Alpine bindings.
 * @returns {string} HTML string
 */
export function renderDiceRoller() {
  const dice = [
    { label: 'D4', sides: 4 },
    { label: 'D6', sides: 6 },
    { label: 'D8', sides: 8 },
    { label: 'D10', sides: 10 },
    { label: 'D12', sides: 12 },
    { label: 'D20', sides: 20 },
  ];

  const diceButtons = dice.map(d => `
    <button
      class="flex items-center justify-center w-[48px] h-[48px] cursor-pointer font-mono text-[11px] tracking-[0.15em] font-bold uppercase"
      style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;"
      @mouseenter="$el.style.background = '#2A2D3A'"
      @mouseleave="$el.style.background = '#1C1F28'"
      @click.stop="
        if (highRoll) {
          highRollResults = $store.game.players.map((p, i) => ({
            name: p.name,
            value: Math.floor(Math.random() * ${d.sides}) + 1
          }));
          const maxVal = Math.max(...highRollResults.map(r => r.value));
          highRollResults.forEach(r => r.isMax = r.value === maxVal);
          diceType = '${d.label}';
          result = null;
          clearTimeout(fadeTimer);
          fadeTimer = setTimeout(() => { highRollResults = []; diceType = null; }, 3000);
        } else {
          result = Math.floor(Math.random() * ${d.sides}) + 1;
          diceType = '${d.label}';
          highRollResults = [];
          animating = true;
          setTimeout(() => { animating = false; }, 400);
          clearTimeout(fadeTimer);
          fadeTimer = setTimeout(() => { result = null; diceType = null; }, 3000);
        }
      "
    >${d.label}</button>
  `).join('');

  return `
    <div x-data="{ open: false, result: null, diceType: null, fadeTimer: null, highRoll: false, highRollResults: [], animating: false }"
         class="relative">
      <!-- Trigger button -->
      <button
        class="flex items-center justify-center w-[48px] h-[48px] cursor-pointer"
        style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;"
        @mouseenter="$el.style.background = '#2A2D3A'"
        @mouseleave="$el.style.background = '#1C1F28'"
        @click.stop="open = !open"
        aria-label="Roll Dice">
        <span class="material-symbols-outlined" style="font-size: 24px;">casino</span>
      </button>

      <!-- Popover -->
      <div x-show="open"
           x-cloak
           @click.outside="open = false"
           class="absolute p-[16px] flex flex-col gap-[16px] items-center"
           style="background: #14161C; border: 1px solid #2A2D3A; z-index: 40; bottom: 72px; left: 50%; transform: translateX(-50%); min-width: 180px;">

        <!-- Dice grid -->
        <div class="grid grid-cols-3 gap-[8px]">
          ${diceButtons}
        </div>

        <!-- High Roll toggle -->
        <button
          class="w-full py-[8px] cursor-pointer font-mono text-[11px] tracking-[0.15em] uppercase"
          :class="highRoll ? 'font-bold' : 'font-normal'"
          :style="highRoll ? 'background: #0D52BD; border: 1px solid #0D52BD; color: #EAECEE;' : 'background: #1C1F28; border: 1px solid #2A2D3A; color: #7A8498;'"
          @click.stop="highRoll = !highRoll"
        >HIGH ROLL</button>

        <!-- Single result display -->
        <template x-if="result !== null && highRollResults.length === 0">
          <div class="flex flex-col items-center gap-[4px]"
               :class="animating ? 'dice-roll-anim' : ''"
               style="transition: opacity 0.3s ease;">
            <span class="font-mono text-[11px] tracking-[0.15em] uppercase"
                  style="color: #7A8498;"
                  x-text="diceType"></span>
            <span style="font-family: 'Syne', sans-serif; font-size: 48px; font-weight: 700; line-height: 1.1; color: #EAECEE;"
                  x-text="result"></span>
          </div>
        </template>

        <!-- High roll results -->
        <template x-if="highRollResults.length > 0">
          <div class="flex flex-col gap-[4px] w-full">
            <span class="font-mono text-[11px] tracking-[0.15em] uppercase text-center"
                  style="color: #7A8498;"
                  x-text="diceType + ' - HIGH ROLL'"></span>
            <template x-for="(hr, i) in highRollResults" :key="i">
              <div class="flex items-center justify-between px-[8px] py-[4px]"
                   :style="hr.isMax ? 'color: #0D52BD; font-weight: 700;' : 'color: #7A8498;'">
                <span class="font-mono text-[11px] tracking-[0.15em] uppercase" x-text="hr.name"></span>
                <span style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700;"
                      x-text="hr.value"></span>
              </div>
            </template>
          </div>
        </template>
      </div>
    </div>
  `;
}
