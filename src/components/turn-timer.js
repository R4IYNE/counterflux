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
    <div class="flex flex-col items-center">
      <span class="font-mono text-[11px] tracking-[0.15em] uppercase"
            style="color: #7A8498; font-weight: 400;">TIME</span>
      <span class="font-mono text-[11px] tracking-[0.15em] font-bold"
            style="color: #EAECEE;"
            x-text="Math.floor($store.game.timerSeconds / 60).toString().padStart(2, '0') + ':' + ($store.game.timerSeconds % 60).toString().padStart(2, '0')"></span>
    </div>
  `;
}
