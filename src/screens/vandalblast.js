import { renderGameSetup } from '../components/game-setup.js';
import { renderPlayerGrid, cleanupLifeButtons } from '../components/player-card.js';
import { renderFloatingToolbar } from '../components/floating-toolbar.js';
import { renderPostGameOverlay } from '../components/post-game-overlay.js';
import { renderGameHistoryView } from '../components/game-history-view.js';

/**
 * VANDALBLAST // GAME TRACKER
 * Full game tracker screen with setup form, active game player grid,
 * and history view toggle.
 */
export function mount(container) {
  const Alpine = window.Alpine;
  const store = Alpine?.store('game');

  // Initialize game store if not yet initialized
  if (store && typeof store.init === 'function') {
    store.init();
  }

  container.innerHTML = `
    <div x-data class="flex flex-col gap-[24px]">

      <!-- Screen header -->
      <div class="flex items-center justify-between">
        <!-- Back button (mobile only) -->
        <button
          class="md:hidden flex items-center justify-center w-[40px] h-[40px] cursor-pointer"
          style="background: transparent; border: none; color: #EAECEE;"
          @click="window.history.back()"
          aria-label="Go back">
          <span class="material-symbols-outlined" style="font-size: 24px;">arrow_back</span>
        </button>

        <!-- Overline (hidden on mobile) -->
        <span class="hidden md:block font-mono uppercase text-[11px] tracking-[0.15em] font-bold"
              style="color: #7A8498;">VANDALBLAST // GAME TRACKER</span>

        <!-- View toggle -->
        <div class="flex items-center gap-0">
          <button
            @click="$store.game.historyView = false"
            :class="!$store.game.historyView ? 'tab-active' : 'tab-inactive'"
            class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold cursor-pointer px-[16px] py-[8px] bg-transparent"
            style="border-top: none; border-left: none; border-right: none;"
          >ACTIVE GAME</button>
          <button
            @click="$store.game.historyView = true; $store.game.loadHistory()"
            :class="$store.game.historyView ? 'tab-active' : 'tab-inactive'"
            class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold cursor-pointer px-[16px] py-[8px] bg-transparent"
            style="border-top: none; border-left: none; border-right: none;"
          >HISTORY</button>
        </div>
      </div>

      <!-- Active Game content -->
      <template x-if="!$store.game.historyView">
        <div>
          <!-- Setup view -->
          <template x-if="$store.game.view === 'setup'">
            ${renderGameSetup()}
          </template>

          <!-- Active game view -->
          <template x-if="$store.game.view === 'active'">
            ${renderPlayerGrid()}
          </template>

          <!-- Post-game summary -->
          <template x-if="$store.game.view === 'summary'">
            <div><!-- placeholder for x-if single root -->
            </div>
          </template>
        </div>
      </template>

      <!-- History view -->
      <template x-if="$store.game.historyView">
        ${renderGameHistoryView()}
      </template>

    </div>

    <!-- Floating toolbar (visible during active game only) -->
    ${renderFloatingToolbar()}

    <!-- Post-game overlay (manages own visibility via x-show) -->
    ${renderPostGameOverlay()}
  `;

  // Cleanup on unmount
  const prevCleanup = container._cleanup;
  container._cleanup = () => {
    cleanupLifeButtons();
    if (prevCleanup) prevCleanup();
  };
}
