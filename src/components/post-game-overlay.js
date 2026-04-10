/**
 * Post-game summary overlay for Vandalblast (Game Tracker).
 * Full-screen overlay with winner selection, elimination order,
 * game stats, life total chart, and save/discard actions.
 */

import { destroyLifeChart, renderLifeChart } from './life-chart.js';

/**
 * Format a duration in milliseconds to a human-readable string.
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted string like "1h 23m" or "45m"
 */
function formatDuration(ms) {
  if (!ms || ms <= 0) return '0m';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Render the post-game summary overlay HTML with Alpine bindings.
 * Visible when $store.game.view === 'summary'.
 *
 * Supports read-only mode for reviewing past games from history.
 *
 * @returns {string} HTML string with Alpine directives
 */
export function renderPostGameOverlay() {
  return `
    <div
      x-data="postGameOverlay()"
      x-show="$store.game.view === 'summary'"
      x-cloak
      style="position: fixed; inset: 0; z-index: 50; background: #14161C; padding: 32px; overflow-y: auto;"
      @keydown.escape.window="closeOverlay()"
    >
      <!-- Header -->
      <h1
        class="text-center mb-xl"
        style="font-family: 'Syne', sans-serif; font-size: 48px; font-weight: 700; color: #EAECEE; line-height: 1.1; letter-spacing: -0.02em;"
      >GAME OVER</h1>

      <!-- Winner Selection -->
      <div class="mb-lg">
        <span
          class="block mb-sm"
          style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #7A8498;"
        >WINNER</span>
        <div class="flex flex-wrap gap-sm">
          <template x-for="(player, idx) in $store.game.players" :key="idx">
            <button
              @click="selectWinner(idx)"
              class="px-md py-sm cursor-pointer transition-colors"
              :class="winnerIndex === idx
                ? 'bg-surface-hover border-2 border-primary text-text-primary'
                : 'bg-surface border border-border-ghost text-text-muted hover:bg-surface-hover'"
              style="font-family: 'Space Grotesk', sans-serif; font-size: 14px;"
              x-text="player.name"
              :disabled="readOnly"
            ></button>
          </template>
        </div>
      </div>

      <!-- Game Stats: Duration + Turns -->
      <div class="flex gap-xl mb-lg">
        <div>
          <span
            class="block mb-xs"
            style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #7A8498;"
          >DURATION</span>
          <span
            style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #EAECEE;"
            x-text="computedDuration"
          ></span>
        </div>
        <div>
          <span
            class="block mb-xs"
            style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #7A8498;"
          >TURNS</span>
          <span
            style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #EAECEE;"
            x-text="$store.game.currentTurn"
          ></span>
        </div>
      </div>

      <!-- Elimination Order -->
      <div class="mb-lg">
        <span
          class="block mb-sm"
          style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #7A8498;"
        >ELIMINATION ORDER</span>
        <div class="flex flex-wrap gap-sm">
          <template x-for="(player, idx) in $store.game.players" :key="'elim-' + idx">
            <button
              @click="toggleElimination(idx)"
              class="px-md py-sm cursor-pointer transition-colors relative"
              :class="getEliminationIndex(idx) >= 0
                ? 'bg-surface-hover border border-secondary text-text-primary'
                : 'bg-surface border border-border-ghost text-text-muted hover:bg-surface-hover'"
              style="font-family: 'Space Grotesk', sans-serif; font-size: 14px;"
              :disabled="readOnly"
            >
              <span x-text="player.name"></span>
              <span
                x-show="getEliminationIndex(idx) >= 0"
                class="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center text-text-primary"
                style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; background: #E23838;"
                x-text="getEliminationIndex(idx) + 1"
              ></span>
            </button>
          </template>
        </div>
      </div>

      <!-- Life Total History Chart -->
      <div class="mb-lg">
        <h2
          class="mb-md"
          style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #EAECEE; letter-spacing: 0.01em;"
        >LIFE TOTAL HISTORY</h2>
        <div style="max-height: 400px; position: relative;">
          <canvas id="life-chart-canvas" style="max-height: 400px;"></canvas>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-md" x-show="!readOnly">
        <button
          @click="saveAndClose()"
          class="px-lg py-sm cursor-pointer transition-colors"
          style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; background: #0D52BD; color: #EAECEE; border: none;"
        >Save & Close</button>
        <button
          @click="showDiscardConfirm = true"
          class="px-lg py-sm cursor-pointer transition-colors"
          style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; background: #E23838; color: #EAECEE; border: none;"
        >Discard Game</button>
      </div>

      <!-- Read-only close button -->
      <div class="flex gap-md" x-show="readOnly">
        <button
          @click="closeOverlay()"
          class="px-lg py-sm cursor-pointer transition-colors"
          style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; background: #1C1F28; color: #EAECEE; border: 1px solid #2A2D3A;"
        >Close</button>
      </div>

      <!-- Discard confirmation modal -->
      <div
        x-show="showDiscardConfirm"
        x-cloak
        class="fixed inset-0 flex items-center justify-center"
        style="z-index: 60; background: rgba(11, 12, 16, 0.8);"
      >
        <div
          class="p-xl"
          style="background: #14161C; border: 1px solid #2A2D3A; max-width: 400px; width: 100%;"
        >
          <p
            class="mb-lg"
            style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; color: #EAECEE;"
          >Discard this game? All tracking data will be lost.</p>
          <div class="flex gap-md">
            <button
              @click="showDiscardConfirm = false"
              class="px-lg py-sm cursor-pointer"
              style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; background: #1C1F28; color: #EAECEE; border: 1px solid #2A2D3A;"
            >Keep Playing</button>
            <button
              @click="discardGame()"
              class="px-lg py-sm cursor-pointer"
              style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; background: #E23838; color: #EAECEE; border: none;"
            >Discard</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Alpine component function for post-game overlay.
 * Manages winner selection, elimination order, chart lifecycle, and save/discard.
 */
export function postGameOverlay() {
  return {
    winnerIndex: null,
    eliminationOrder: [],
    showDiscardConfirm: false,
    readOnly: false,
    computedDuration: '0m',

    init() {
      // Compute duration
      this._computeDuration();

      // Render life chart after DOM settles
      this.$nextTick(() => {
        const players = this.$store.game.players;
        if (players && players.length > 0) {
          renderLifeChart('life-chart-canvas', players);
        }
      });

      // Check if read-only mode (opened from history)
      if (this.$store.game._readOnly) {
        this.readOnly = true;
        // Restore winner/elimination from stored data
        if (this.$store.game._historyWinner != null) {
          this.winnerIndex = this.$store.game._historyWinner;
        }
        if (this.$store.game._historyElimination) {
          this.eliminationOrder = [...this.$store.game._historyElimination];
        }
      }
    },

    _computeDuration() {
      const startedAt = this.$store.game.gameStartedAt;
      if (!startedAt) {
        this.computedDuration = '0m';
        return;
      }
      const start = new Date(startedAt).getTime();
      const end = Date.now();
      const ms = end - start;
      const totalMinutes = Math.floor(ms / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      if (hours > 0) {
        this.computedDuration = `${hours}h ${minutes}m`;
      } else {
        this.computedDuration = `${totalMinutes}m`;
      }
    },

    selectWinner(idx) {
      if (this.readOnly) return;
      this.winnerIndex = this.winnerIndex === idx ? null : idx;
    },

    toggleElimination(idx) {
      if (this.readOnly) return;
      const pos = this.eliminationOrder.indexOf(idx);
      if (pos >= 0) {
        this.eliminationOrder.splice(pos, 1);
      } else {
        this.eliminationOrder.push(idx);
      }
    },

    getEliminationIndex(idx) {
      return this.eliminationOrder.indexOf(idx);
    },

    async saveAndClose() {
      if (this.readOnly) return;
      await this.$store.game.saveGame(this.winnerIndex, this.eliminationOrder);
      destroyLifeChart();
      const toast = this.$store.toast;
      if (toast) {
        (toast.success || toast.show)?.call(toast, 'Game saved to history.');
      }
    },

    async discardGame() {
      this.showDiscardConfirm = false;
      await this.$store.game.discardGame();
      destroyLifeChart();
    },

    closeOverlay() {
      destroyLifeChart();
      // If read-only, restore to history view
      if (this.readOnly) {
        this.$store.game.view = 'setup';
        this.$store.game.historyView = true;
        this.$store.game._readOnly = false;
        this.$store.game._historyWinner = null;
        this.$store.game._historyElimination = null;
        this.$store.game.players = [];
      } else {
        this.$store.game.view = 'setup';
      }
    },

    destroy() {
      destroyLifeChart();
    },
  };
}
