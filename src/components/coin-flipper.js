/**
 * Coin Flipper -- popover with a single flip button and animated HEADS/TAILS result.
 * Positioned above the floating toolbar, triggered by coin icon button.
 */

/**
 * Render the coin flipper popover HTML with Alpine bindings.
 * @returns {string} HTML string
 */
export function renderCoinFlipper() {
  return `
    <div x-data="{ open: false, result: null, animating: false }"
         class="relative">
      <!-- Trigger button -->
      <button
        class="flex items-center justify-center w-[48px] h-[48px] cursor-pointer"
        style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;"
        @mouseenter="$el.style.background = '#2A2D3A'"
        @mouseleave="$el.style.background = '#1C1F28'"
        @click.stop="open = !open"
        aria-label="Flip Coin">
        <span class="material-symbols-outlined" style="font-size: 24px;">monetization_on</span>
      </button>

      <!-- Popover -->
      <div x-show="open"
           x-cloak
           @click.outside="open = false"
           class="absolute p-[16px] flex flex-col gap-[16px] items-center"
           style="background: #14161C; border: 1px solid #2A2D3A; z-index: 40; bottom: 72px; left: 50%; transform: translateX(-50%); min-width: 140px;">

        <!-- Flip button -->
        <button
          class="cursor-pointer font-mono text-[11px] tracking-[0.15em] font-bold uppercase py-[8px]"
          style="background: #0D52BD; border: 1px solid #0D52BD; color: #EAECEE; width: 96px;"
          @mouseenter="$el.style.background = '#1048A0'"
          @mouseleave="$el.style.background = '#0D52BD'"
          @click.stop="
            animating = true;
            result = Math.random() < 0.5 ? 'HEADS' : 'TAILS';
            setTimeout(() => { animating = false; }, 300);
          "
        >FLIP</button>

        <!-- Result display -->
        <template x-if="result !== null">
          <div class="flex items-center justify-center"
               :class="animating ? 'coin-flip-anim' : ''"
               style="perspective: 600px;">
            <span style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; line-height: 1.2; letter-spacing: 0.01em; color: #EAECEE;"
                  :style="animating ? 'transform: rotateY(180deg); transition: transform 300ms ease;' : 'transform: rotateY(0deg); transition: transform 300ms ease;'"
                  x-text="result"></span>
          </div>
        </template>
      </div>
    </div>
  `;
}
