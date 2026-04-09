/**
 * Turn Timer -- stopwatch display with play/pause/reset controls.
 * Embedded within the floating toolbar. Displays MM:SS from $store.game.timerSeconds.
 */

/**
 * Render the turn timer HTML with Alpine bindings.
 * @returns {string} HTML string
 */
export function renderTurnTimer() {
  return `
    <div class="flex items-center gap-[8px]">
      <div class="flex flex-col items-center">
        <span class="font-mono text-[11px] tracking-[0.15em] uppercase"
              style="color: #7A8498; font-weight: 400;">TIME</span>
        <span class="font-mono text-[11px] tracking-[0.15em] font-bold"
              style="color: #EAECEE;"
              x-text="Math.floor($store.game.timerSeconds / 60).toString().padStart(2, '0') + ':' + ($store.game.timerSeconds % 60).toString().padStart(2, '0')"></span>
      </div>

      <!-- Play/Pause button -->
      <button
        class="flex items-center justify-center w-[32px] h-[32px] cursor-pointer"
        style="background: transparent; border: 1px solid #2A2D3A; color: #EAECEE;"
        @mouseenter="$el.style.background = '#1C1F28'"
        @mouseleave="$el.style.background = 'transparent'"
        @click="$store.game.timerRunning ? $store.game.pauseTimer() : $store.game.startTimer()">
        <span class="material-symbols-outlined" style="font-size: 20px;"
              x-text="$store.game.timerRunning ? 'pause' : 'play_arrow'"></span>
      </button>

      <!-- Reset button -->
      <button
        class="flex items-center justify-center w-[32px] h-[32px] cursor-pointer"
        style="background: transparent; border: 1px solid #2A2D3A; color: #EAECEE;"
        @mouseenter="$el.style.background = '#1C1F28'"
        @mouseleave="$el.style.background = 'transparent'"
        @click="$store.game.resetTimer()">
        <span class="material-symbols-outlined" style="font-size: 20px;">replay</span>
      </button>
    </div>
  `;
}
