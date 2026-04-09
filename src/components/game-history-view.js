/**
 * Game history view for Vandalblast (Game Tracker).
 * Shows aggregate stats cards at top and chronological past games list.
 * All game data from IndexedDB -- no network calls required.
 *
 * // PERF-03: Game Tracker fully offline -- all data from IndexedDB, no network calls
 */

import { renderGameStatsCard } from './game-stats-card.js';
import { renderLifeChart, destroyLifeChart } from './life-chart.js';

/**
 * Format minutes to a human-readable string.
 * @param {number} minutes
 * @returns {string} e.g. "1h 23m" or "45m"
 */
function formatMinutes(minutes) {
  if (!minutes || minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * Format an ISO date string to DD MMM YYYY.
 * @param {string} isoDate
 * @returns {string}
 */
function formatDate(isoDate) {
  if (!isoDate) return '--';
  const d = new Date(isoDate);
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const day = String(d.getDate()).padStart(2, '0');
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Compute game duration in minutes from started_at and ended_at.
 * @param {string} startedAt
 * @param {string} endedAt
 * @returns {number} Duration in minutes
 */
function gameDurationMinutes(startedAt, endedAt) {
  if (!startedAt || !endedAt) return 0;
  return Math.floor((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000);
}

/**
 * Render the game history view HTML with Alpine bindings.
 * Stats summary cards at top, past games list below.
 * @returns {string} HTML string with Alpine directives
 */
export function renderGameHistoryView() {
  return `
    <div x-data="gameHistoryView()">
      <!-- Stats Summary Row -->
      <div class="flex flex-wrap gap-md mb-lg">
        ${renderGameStatsCard('WIN RATE', "$store.game.stats.winRate.toFixed(0) + '%'")}
        ${renderGameStatsCard('GAMES PLAYED', '$store.game.stats.totalGames')}
        ${renderGameStatsCard('BEST DECK', "$store.game.stats.bestDeck?.name || '--'")}
        ${renderGameStatsCard('AVG GAME LENGTH', "formatAvgLength($store.game.stats.avgGameLength)")}
        ${renderGameStatsCard('MOST PLAYED', "$store.game.stats.mostPlayed?.commanderName || '--'")}
        ${renderGameStatsCard('WIN STREAK', '$store.game.stats.currentWinStreak')}
      </div>

      <!-- Past Games List -->
      <template x-if="$store.game.games.length > 0">
        <div>
          <h2
            class="mb-md"
            style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #EAECEE; letter-spacing: 0.01em;"
          >PAST GAMES</h2>

          <div class="flex flex-col gap-sm">
            <template x-for="(game, gi) in $store.game.games" :key="game.id || gi">
              <div
                class="flex items-center gap-md px-md py-md cursor-pointer transition-colors hover:bg-surface-hover group"
                style="background: #14161C; border: 1px solid #2A2D3A;"
                @click="openGameReview(game)"
              >
                <!-- Date -->
                <span
                  style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 400; color: #7A8498; letter-spacing: 0.15em; text-transform: uppercase; white-space: nowrap;"
                  x-text="formatGameDate(game.started_at)"
                ></span>

                <!-- Commander / Deck -->
                <span
                  class="flex-1 truncate"
                  style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; color: #EAECEE;"
                  x-text="game.players?.[0]?.commander || 'Unknown'"
                ></span>

                <!-- Opponent count -->
                <span
                  style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 400; color: #7A8498; letter-spacing: 0.15em; white-space: nowrap;"
                  x-text="'vs ' + ((game.players?.length || 1) - 1) + ' opponents'"
                ></span>

                <!-- Winner indicator -->
                <span
                  x-show="game.winner_index === 0"
                  style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; color: #2ECC71; letter-spacing: 0.15em; text-transform: uppercase;"
                >WON</span>
                <span
                  x-show="game.winner_index !== 0 && game.winner_index != null"
                  style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 400; color: #7A8498; letter-spacing: 0.15em;"
                  x-text="game.players?.[game.winner_index]?.name || '--'"
                ></span>
                <span
                  x-show="game.winner_index == null"
                  style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 400; color: #4A5064; letter-spacing: 0.15em;"
                >--</span>

                <!-- Duration -->
                <span
                  style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 400; color: #4A5064; letter-spacing: 0.15em; white-space: nowrap;"
                  x-text="formatGameDuration(game.started_at, game.ended_at)"
                ></span>

                <!-- Turns -->
                <span
                  style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 400; color: #4A5064; letter-spacing: 0.15em; white-space: nowrap;"
                  x-text="(game.turn_count || 0) + ' turns'"
                ></span>

                <!-- Delete button -->
                <button
                  @click.stop="deleteGame(game.id, gi)"
                  class="opacity-0 group-hover:opacity-100 transition-opacity px-xs cursor-pointer"
                  style="background: none; border: none; color: #7A8498; font-size: 16px;"
                  title="Delete game"
                  aria-label="Delete game"
                >
                  <span class="material-symbols-outlined" style="font-size: 18px;">close</span>
                </button>
              </div>
            </template>
          </div>
        </div>
      </template>

      <!-- Empty State -->
      <template x-if="$store.game.games.length === 0">
        <div class="flex flex-col items-center justify-center py-3xl" style="min-height: 300px;">
          <h3
            class="mb-sm"
            style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #EAECEE;"
          >No Games Recorded</h3>
          <p
            style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; color: #7A8498; max-width: 400px; text-align: center;"
          >Start a game from the Active Game view. Mila will keep track of your victories and defeats.</p>
        </div>
      </template>
    </div>
  `;
}

/**
 * Alpine component function for game history view.
 * Manages past game review and deletion with undo support.
 */
export function gameHistoryView() {
  return {
    _undoTimer: null,
    _deletedGame: null,

    formatGameDate(isoDate) {
      return formatDate(isoDate);
    },

    formatGameDuration(startedAt, endedAt) {
      const mins = gameDurationMinutes(startedAt, endedAt);
      return formatMinutes(mins);
    },

    formatAvgLength(minutes) {
      return formatMinutes(minutes);
    },

    openGameReview(game) {
      // Populate store with game data and switch to read-only summary view
      const store = this.$store.game;
      store.players = JSON.parse(JSON.stringify(game.players || []));
      store.currentTurn = game.turn_count || 0;
      store.gameStartedAt = game.started_at;
      store._readOnly = true;
      store._historyWinner = game.winner_index;
      store._historyElimination = game.elimination_order || [];
      store.view = 'summary';
    },

    async deleteGame(gameId, index) {
      // Cancel any pending undo
      if (this._undoTimer) {
        clearTimeout(this._undoTimer);
        this._undoTimer = null;
      }

      // Store for undo
      const games = this.$store.game.games;
      this._deletedGame = { ...games[index], id: gameId };

      // Delete from DB
      await this.$store.game.deleteGame(gameId);

      // Show undo toast
      const toast = this.$store.toast;
      if (toast) {
        const undoFn = async () => {
          if (this._deletedGame) {
            // Re-add the game
            const { db } = await import('../db/schema.js');
            await db.games.add(this._deletedGame);
            await this.$store.game.loadHistory();
            this._deletedGame = null;
          }
        };

        if (toast.showUndo) {
          toast.showUndo('Game deleted from history.', undoFn);
        } else if (toast.show) {
          toast.show('Game deleted from history.', 'info');
        }
      }

      // Clear undo data after 5s
      this._undoTimer = setTimeout(() => {
        this._deletedGame = null;
        this._undoTimer = null;
      }, 5000);
    },

    destroy() {
      if (this._undoTimer) {
        clearTimeout(this._undoTimer);
      }
    },
  };
}
