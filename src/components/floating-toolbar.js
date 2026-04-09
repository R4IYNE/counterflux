/**
 * Floating Toolbar -- persistent bottom bar during active gameplay.
 * Contains turn counter, timer display, dice/coin/timer/counters tools,
 * and End Game button. Only visible when game view is 'active'.
 */

import { renderDiceRoller } from './dice-roller.js';
import { renderCoinFlipper } from './coin-flipper.js';
import { renderTurnTimer } from './turn-timer.js';
import { renderCounterPanel } from './counter-panel.js';

/**
 * Render the floating toolbar HTML with Alpine bindings.
 * @returns {string} HTML string
 */
export function renderFloatingToolbar() {
  return `
    <div x-data="{ showEndConfirm: false }"
         x-show="$store.game.view === 'active'"
         x-cloak
         style="position: fixed; bottom: 0; left: 0; right: 0; height: 64px; background: #14161C; border-top: 1px solid #2A2D3A; z-index: 30;"
         class="flex items-center justify-center gap-[24px] px-[16px]">

      <!-- Turn counter -->
      <div class="flex items-center gap-[8px]">
        <div class="flex flex-col items-center">
          <span class="font-mono text-[11px] tracking-[0.15em] uppercase"
                style="color: #7A8498; font-weight: 400;">TURN</span>
          <span style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; line-height: 1.2; color: #EAECEE;"
                x-text="$store.game.currentTurn"></span>
        </div>
        <button
          class="cursor-pointer font-mono text-[11px] tracking-[0.15em] font-bold uppercase py-[4px] px-[8px]"
          style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;"
          @mouseenter="$el.style.background = '#2A2D3A'"
          @mouseleave="$el.style.background = '#1C1F28'"
          @click="$store.game.nextTurn()"
        >NEXT TURN</button>
      </div>

      <!-- Timer display -->
      ${renderTurnTimer()}

      <!-- Separator -->
      <div style="width: 1px; height: 32px; background: #2A2D3A;"></div>

      <!-- Dice roller -->
      ${renderDiceRoller()}

      <!-- Coin flipper -->
      ${renderCoinFlipper()}

      <!-- Timer toggle (play/pause) -->
      <button
        class="flex items-center justify-center w-[48px] h-[48px] cursor-pointer"
        style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;"
        @mouseenter="$el.style.background = '#2A2D3A'"
        @mouseleave="$el.style.background = '#1C1F28'"
        @click="$store.game.timerRunning ? $store.game.pauseTimer() : $store.game.startTimer()"
        aria-label="Toggle Timer">
        <span class="material-symbols-outlined" style="font-size: 24px;"
              x-text="$store.game.timerRunning ? 'pause' : 'timer'"></span>
      </button>

      <!-- Counter panel -->
      ${renderCounterPanel()}

      <!-- Fullscreen toggle -->
      <button
        class="flex items-center justify-center w-[48px] h-[48px] cursor-pointer"
        style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;"
        @mouseenter="$el.style.background = '#2A2D3A'"
        @mouseleave="$el.style.background = '#1C1F28'"
        @click="$store.app.gameFullscreen = !$store.app.gameFullscreen"
        aria-label="Toggle Fullscreen">
        <span class="material-symbols-outlined" style="font-size: 24px;"
              x-text="$store.app.gameFullscreen ? 'fullscreen_exit' : 'fullscreen'"></span>
      </button>

      <!-- Separator -->
      <div style="width: 1px; height: 32px; background: #2A2D3A;"></div>

      <!-- End Game button -->
      <button
        class="cursor-pointer font-mono text-[11px] tracking-[0.15em] font-bold uppercase py-[8px] px-[16px]"
        style="background: #E23838; border: 1px solid #E23838; color: #EAECEE;"
        @mouseenter="$el.style.background = '#C42F2F'"
        @mouseleave="$el.style.background = '#E23838'"
        @click="showEndConfirm = true"
      >END GAME</button>

      <!-- End Game confirmation modal -->
      <template x-if="showEndConfirm">
        <div class="fixed inset-0 flex items-center justify-center"
             style="background: rgba(11, 12, 16, 0.8); z-index: 50;"
             @click.self="showEndConfirm = false">
          <div class="flex flex-col gap-[16px] p-[24px]"
               style="background: #14161C; border: 1px solid #2A2D3A; max-width: 400px; width: 90%;">
            <span style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #EAECEE;">
              End this game?
            </span>
            <p style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; color: #7A8498;">
              You can still save results.
            </p>
            <div class="flex items-center justify-end gap-[8px]">
              <button
                class="cursor-pointer font-mono text-[11px] tracking-[0.15em] font-bold uppercase py-[8px] px-[16px]"
                style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;"
                @click="showEndConfirm = false"
              >Continue Playing</button>
              <button
                class="cursor-pointer font-mono text-[11px] tracking-[0.15em] font-bold uppercase py-[8px] px-[16px]"
                style="background: #E23838; border: 1px solid #E23838; color: #EAECEE;"
                @click="showEndConfirm = false; $store.game.endGame()"
              >End Game</button>
            </div>
          </div>
        </div>
      </template>
    </div>
  `;
}
