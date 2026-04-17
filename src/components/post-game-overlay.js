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
 * Format milliseconds as mm:ss for turn-pacing tiles (GAME-09 / D-19).
 * @param {number} ms
 * @returns {string}
 */
function formatLap(ms) {
  if (!ms || ms <= 0 || isNaN(ms)) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Compute pacing stats from turn_laps + players.
 * Per CONTEXT D-19 + RESEARCH GAME-09 third row.
 *
 * @param {number[]} turnLaps - per-turn durations in ms
 * @param {Array} players - $store.game.players (we use .name; lap index modulo
 *   players.length identifies which player owned which turn)
 * @returns {{
 *   longestTurn: number,
 *   longestPlayerName: string,
 *   avgTurn: number,
 *   perPlayerAvg: Array<{ name: string, avgMs: number }>,
 * }}
 */
export function computePacingStats(turnLaps, players) {
  const laps = (turnLaps || []).filter(
    (n) => typeof n === 'number' && n > 0 && !isNaN(n)
  );
  if (laps.length === 0 || !players || players.length === 0) {
    return { longestTurn: 0, longestPlayerName: '', avgTurn: 0, perPlayerAvg: [] };
  }

  // longestTurn + which player took it (lap index modulo player count maps to
  // player index — turn order rotates predictably from activePlayerIndex=0)
  let longestIdx = 0;
  for (let i = 1; i < laps.length; i++) {
    if (laps[i] > laps[longestIdx]) longestIdx = i;
  }
  const longestTurn = laps[longestIdx];
  const longestPlayerIndex = longestIdx % players.length;
  const longestPlayerName = players[longestPlayerIndex]?.name || `Player ${longestPlayerIndex + 1}`;

  // avgTurn (overall mean)
  const avgTurn = laps.reduce((sum, n) => sum + n, 0) / laps.length;

  // perPlayerAvg: group by index modulo player count
  const buckets = players.map(() => []);
  for (let i = 0; i < laps.length; i++) {
    buckets[i % players.length].push(laps[i]);
  }
  const perPlayerAvg = players.map((p, idx) => {
    const playerLaps = buckets[idx];
    const avgMs =
      playerLaps.length > 0
        ? playerLaps.reduce((s, n) => s + n, 0) / playerLaps.length
        : 0;
    return { name: p.name || `Player ${idx + 1}`, avgMs };
  });
  // Sort slowest first per D-19
  perPlayerAvg.sort((a, b) => b.avgMs - a.avgMs);

  return { longestTurn, longestPlayerName, avgTurn, perPlayerAvg };
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

      <!-- TURN PACING (GAME-09 / D-19) — three tiles computed from turn_laps -->
      <div class="mb-lg" x-show="$store.game.turn_laps && $store.game.turn_laps.length > 0">
        <h2
          class="mb-md"
          style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #EAECEE; letter-spacing: 0.01em;"
        >TURN PACING</h2>
        <div class="flex gap-md" style="padding: 24px; background: #14161C; border: 1px solid #2A2D3A;">

          <!-- LONGEST TURN tile -->
          <div class="flex flex-col" style="flex: 1; min-width: 120px;">
            <span
              class="block mb-xs"
              style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #7A8498;"
            >LONGEST TURN</span>
            <span
              style="font-family: 'JetBrains Mono', monospace; font-size: 32px; font-weight: 700; color: #0D52BD; line-height: 1;"
              x-text="pacing.longestTurnDisplay"
            ></span>
            <span
              class="mt-xs"
              style="font-family: 'Space Grotesk', sans-serif; font-size: 11px; color: #7A8498; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
              :title="pacing.longestPlayerName"
              x-text="pacing.longestPlayerName"
            ></span>
          </div>

          <!-- AVG TURN tile -->
          <div class="flex flex-col" style="flex: 1; min-width: 120px;">
            <span
              class="block mb-xs"
              style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #7A8498;"
            >AVG TURN</span>
            <span
              style="font-family: 'JetBrains Mono', monospace; font-size: 32px; font-weight: 700; color: #0D52BD; line-height: 1;"
              x-text="pacing.avgTurnDisplay"
            ></span>
          </div>

          <!-- PER-PLAYER AVG tile -->
          <div class="flex flex-col" style="flex: 2; min-width: 200px;">
            <span
              class="block mb-xs"
              style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #7A8498;"
            >PER-PLAYER AVG</span>
            <div class="flex flex-col gap-xs">
              <template x-for="(p, idx) in pacing.perPlayerAvg" :key="'pp-' + idx">
                <div class="flex items-center justify-between gap-md">
                  <span
                    style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; color: #EAECEE; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1;"
                    :title="p.name"
                    x-text="p.name"
                  ></span>
                  <span
                    style="font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 700; color: #0D52BD; flex-shrink: 0;"
                    x-text="p.avgDisplay"
                  ></span>
                </div>
              </template>
            </div>
          </div>

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
    // GAME-09 (D-19): TURN PACING tile data, populated by _computePacing
    pacing: {
      longestTurn: 0,
      longestPlayerName: '',
      avgTurn: 0,
      perPlayerAvg: [],
      longestTurnDisplay: '0:00',
      avgTurnDisplay: '0:00',
    },

    init() {
      // Compute duration
      this._computeDuration();
      // GAME-09 (D-19): compute TURN PACING stats
      this._computePacing();

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

    _computePacing() {
      const stats = computePacingStats(
        this.$store.game.turn_laps,
        this.$store.game.players
      );
      this.pacing = {
        longestTurn: stats.longestTurn,
        longestPlayerName: stats.longestPlayerName,
        avgTurn: stats.avgTurn,
        perPlayerAvg: stats.perPlayerAvg.map((p) => ({
          name: p.name,
          avgMs: p.avgMs,
          avgDisplay: formatLap(p.avgMs),
        })),
        longestTurnDisplay: formatLap(stats.longestTurn),
        avgTurnDisplay: formatLap(stats.avgTurn),
      };
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
