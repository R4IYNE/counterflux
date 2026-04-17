import Alpine from 'alpinejs';
import { db } from '../db/schema.js';
import { computeGameStats } from '../utils/game-stats.js';
import { spinForFirstPlayer } from '../components/first-player-spinner.js';

/**
 * Debounce helper for auto-save.
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Initialize the Alpine game store for the Vandalblast (Game Tracker) screen.
 * Manages game setup, active game state, and history/stats.
 *
 * Call during app startup after other stores are initialized.
 */
export function initGameStore() {
  const _debouncedAutoSave = debounce(async function () {
    const store = Alpine.store('game');
    if (store.view !== 'active') return;
    const snapshot = {
      view: store.view,
      selectedDeckId: store.selectedDeckId,
      manualCommander: store.manualCommander,
      startingLife: store.startingLife,
      opponents: JSON.parse(JSON.stringify(store.opponents)),
      players: JSON.parse(JSON.stringify(store.players)),
      currentTurn: store.currentTurn,
      timerSeconds: store.timerSeconds,
      gameStartedAt: store.gameStartedAt,
      expandedPlayer: store.expandedPlayer,
      // Plan 3 (D-17, D-18): persist active player + lap history + wall-clock anchor
      activePlayerIndex: store.activePlayerIndex,
      turn_laps: [...(store.turn_laps || [])],
      turnStartedAt: store.turnStartedAt,
    };
    await db.meta.put({ key: 'active_game', ...snapshot });
  }, 2000);

  Alpine.store('game', {
    // === State ===
    view: 'setup',
    historyView: false,
    selectedDeckId: null,
    manualCommander: '',
    startingLife: 40,
    opponents: [],
    players: [],
    currentTurn: 0,
    timerSeconds: 0,
    timerRunning: false,
    _timerInterval: null,    // legacy — set to null and superseded by _timerRafId
    _timerRafId: null,       // GAME-10 (D-18) — RAF id for display tick
    gameStartedAt: null,
    games: [],
    expandedPlayer: null,

    // GAME-08 (D-16): active player rotation (0-indexed). null when no game active.
    activePlayerIndex: null,
    // GAME-09 (D-17): per-turn lap durations in ms. Schema field exists since
    // Phase 7 v6 migration; this store field mirrors what gets persisted.
    turn_laps: [],
    // GAME-10 (D-18): wall-clock anchor for turn timer (Date.now() snapshot at
    // turn start). Replaces setInterval accumulation which is throttled to 1Hz
    // in background tabs (Pitfall P-1).
    turnStartedAt: null,

    // === Computed ===
    get stats() {
      return computeGameStats(this.games);
    },

    // === Setup Methods ===

    addOpponent() {
      if (this.opponents.length >= 5) return; // Max 6 total players
      this.opponents.push({ name: '', commander: '', partner: null });
    },

    removeOpponent(index) {
      this.opponents.splice(index, 1);
    },

    // === Game Lifecycle ===

    async startGame() {
      // Validate: must have deck or manual commander
      if (!this.selectedDeckId && !this.manualCommander.trim()) {
        Alpine.store('toast')?.error('Select a deck or enter a commander name.');
        return false;
      }
      // Validate: at least 1 opponent
      if (this.opponents.length < 1) {
        Alpine.store('toast')?.error('Add at least one opponent.');
        return false;
      }

      const playerCount = this.opponents.length + 1;

      // Build players array
      const players = [];

      // Player 0 = you
      const yourCommander = this.manualCommander.trim() || null;
      players.push({
        name: 'You',
        commander: yourCommander,
        partner: null,
        color_index: 0,
        life: this.startingLife,
        life_history: [this.startingLife],
        poison: 0,
        commander_damage: {},
        tax_count: 0,
        counters: {},
        eliminated: false,
        elimination_order: null,
      });

      // Initialize commander damage tracking for player 0
      for (let i = 1; i < playerCount; i++) {
        players[0].commander_damage[i] = 0;
      }

      // Opponents
      for (let i = 0; i < this.opponents.length; i++) {
        const opp = this.opponents[i];
        const player = {
          name: opp.name || `Opponent ${i + 1}`,
          commander: opp.commander || '',
          partner: opp.partner || null,
          color_index: i + 1,
          life: this.startingLife,
          life_history: [this.startingLife],
          poison: 0,
          commander_damage: {},
          tax_count: 0,
          counters: {},
          eliminated: false,
          elimination_order: null,
        };
        // Commander damage from all other players
        for (let j = 0; j < playerCount; j++) {
          if (j !== i + 1) player.commander_damage[j] = 0;
        }
        players.push(player);
      }

      this.players = players;
      this.view = 'active';
      this.currentTurn = 1;
      this.gameStartedAt = new Date().toISOString();
      this.timerSeconds = 0;
      this.timerRunning = false;

      // GAME-09 + GAME-10 init: clear lap history, snapshot wall-clock anchor.
      this.turn_laps = [];
      this.turnStartedAt = Date.now();

      // Auto-save initial state BEFORE spinner so a partial game survives crash
      _debouncedAutoSave();

      // GAME-07 (D-15): pick first player via slot-machine spinner. Awaits ~3s
      // in normal motion; instant under prefers-reduced-motion: reduce.
      try {
        const winnerIndex = await spinForFirstPlayer(this.players.map((p) => p.name));
        if (
          typeof winnerIndex === 'number' &&
          winnerIndex >= 0 &&
          winnerIndex < this.players.length
        ) {
          this.players[winnerIndex].is_first = true;
          this.activePlayerIndex = winnerIndex;
          // Re-anchor turnStartedAt to the moment the spinner concluded so the
          // first player's lap timer starts when the spinner unveils them, not
          // ~3 seconds before.
          this.turnStartedAt = Date.now();
        } else {
          this.activePlayerIndex = 0;
          this.players[0].is_first = true;
        }
      } catch {
        // Graceful fallback: pick player 0 if spinner throws
        this.activePlayerIndex = 0;
        this.players[0].is_first = true;
      }

      _debouncedAutoSave();

      // Gap 6 fix (Phase 9 Plan 06): auto-start the wall-clock timer now that
      // the spinner has resolved and turnStartedAt has been re-anchored.
      // Without this, the timer only runs if the user manually clicks the play
      // button in the floating toolbar — turn_laps would still populate via
      // the Date.now() anchor, but the visible timer display would freeze at
      // 00:00 and users cannot see elapsed time during play.
      this.startTimer();

      return true;
    },

    // === In-Game Adjustments ===

    adjustLife(playerIndex, amount) {
      if (!this.players[playerIndex]) return;
      this.players[playerIndex].life += amount;
      this.players[playerIndex].life_history.push(this.players[playerIndex].life);
      _debouncedAutoSave();
    },

    adjustPoison(playerIndex, amount) {
      if (!this.players[playerIndex]) return;
      const newVal = this.players[playerIndex].poison + amount;
      this.players[playerIndex].poison = Math.max(0, newVal);
      if (this.players[playerIndex].poison >= 10 && !this.players[playerIndex].eliminated) {
        this.players[playerIndex].eliminated = true;
        Alpine.store('toast')?.show?.(`${this.players[playerIndex].name} has 10+ poison counters!`, 'warning') ||
          Alpine.store('toast')?.warning?.(`${this.players[playerIndex].name} has 10+ poison counters!`);
      }
      _debouncedAutoSave();
    },

    adjustCommanderDamage(targetIndex, sourceIndex, amount) {
      if (!this.players[targetIndex]) return;
      const current = this.players[targetIndex].commander_damage[sourceIndex] || 0;
      const newVal = Math.max(0, current + amount);
      this.players[targetIndex].commander_damage[sourceIndex] = newVal;
      if (newVal >= 21 && !this.players[targetIndex].eliminated) {
        this.players[targetIndex].eliminated = true;
        Alpine.store('toast')?.show?.(`${this.players[targetIndex].name} has 21+ commander damage!`, 'warning') ||
          Alpine.store('toast')?.warning?.(`${this.players[targetIndex].name} has 21+ commander damage!`);
      }
      _debouncedAutoSave();
    },

    adjustTax(playerIndex, amount) {
      if (!this.players[playerIndex]) return;
      const newVal = this.players[playerIndex].tax_count + amount;
      this.players[playerIndex].tax_count = Math.max(0, newVal);
      _debouncedAutoSave();
    },

    adjustCounter(playerIndex, counterName, amount) {
      if (!this.players[playerIndex]) return;
      const counters = this.players[playerIndex].counters;
      const current = counters[counterName] || 0;
      counters[counterName] = Math.max(0, current + amount);
      _debouncedAutoSave();
    },

    toggleCounter(playerIndex, counterName) {
      if (!this.players[playerIndex]) return;
      const counters = this.players[playerIndex].counters;
      if (counterName in counters) {
        delete counters[counterName];
      } else {
        counters[counterName] = 0;
      }
      _debouncedAutoSave();
    },

    // === Turn Management ===

    nextTurn() {
      // GAME-09 (D-17): push wall-clock lap onto turn_laps before re-anchoring
      if (this.turnStartedAt != null) {
        const lap = Date.now() - this.turnStartedAt;
        if (lap >= 0) this.turn_laps.push(lap);
      }
      // GAME-10 (D-18): re-anchor for the next turn
      this.turnStartedAt = Date.now();

      // Existing behaviour: increment counter + snapshot life history
      this.currentTurn++;
      for (const player of this.players) {
        player.life_history.push(player.life);
      }

      // GAME-08 (D-16): advance active player (skip eliminated players)
      if (this.activePlayerIndex != null && this.players.length > 0) {
        let next = (this.activePlayerIndex + 1) % this.players.length;
        let safety = this.players.length;
        while (this.players[next]?.eliminated && safety > 0) {
          next = (next + 1) % this.players.length;
          safety--;
        }
        this.activePlayerIndex = next;
      }

      // Gap 6 fix (Phase 9 Plan 06): re-start the timer for the new turn.
      // Previously this was only pauseTimer() which forced the user to
      // manually restart the timer on every NEXT TURN click. The lap anchor
      // (turnStartedAt) was already re-set at the top of this method, so
      // startTimer() picks up from the new anchor and the display ticks from
      // 00:00 for the new turn. We call pauseTimer() FIRST to cancel the
      // previous RAF loop cleanly — startTimer's `if (this.timerRunning) return`
      // early-exit would otherwise prevent the new loop from starting.
      this.pauseTimer();   // cancel the current RAF loop cleanly
      this.startTimer();   // start a new RAF loop anchored to the new turnStartedAt
      _debouncedAutoSave();
    },

    // === Timer ===

    startTimer() {
      if (this.timerRunning) return;
      this.timerRunning = true;
      // GAME-10 (D-18 / P-1): wall-clock anchor + RAF display tick.
      // setInterval is throttled to 1Hz in background tabs; a 30-min backgrounded
      // turn would record as ~5min via interval counting. The Date.now() anchor
      // stays accurate regardless of background throttling.
      if (this.turnStartedAt == null) this.turnStartedAt = Date.now();

      const tick = () => {
        if (!this.timerRunning) return;
        this.timerSeconds = Math.floor((Date.now() - this.turnStartedAt) / 1000);
        this._timerRafId = requestAnimationFrame(tick);
      };
      this._timerRafId = requestAnimationFrame(tick);
    },

    pauseTimer() {
      this.timerRunning = false;
      if (this._timerRafId != null) {
        cancelAnimationFrame(this._timerRafId);
        this._timerRafId = null;
      }
      // Defensive: clear legacy interval if any code path still set it
      if (this._timerInterval) {
        clearInterval(this._timerInterval);
        this._timerInterval = null;
      }
    },

    resetTimer() {
      this.pauseTimer();
      this.timerSeconds = 0;
      this.turnStartedAt = null;
    },

    // === Game End ===

    endGame() {
      this.view = 'summary';
      this.pauseTimer();
    },

    async saveGame(winnerIndex, eliminationOrder) {
      // GAME-09: push final lap before saving (turn that ended without nextTurn)
      if (this.turnStartedAt != null) {
        const finalLap = Date.now() - this.turnStartedAt;
        if (finalLap >= 0) this.turn_laps.push(finalLap);
        this.turnStartedAt = null;
      }

      const gameRecord = {
        deck_id: this.selectedDeckId,
        started_at: this.gameStartedAt,
        ended_at: new Date().toISOString(),
        turn_count: this.currentTurn,
        winner_index: winnerIndex,
        players: JSON.parse(JSON.stringify(this.players)),  // includes is_first per-player
        elimination_order: eliminationOrder ? [...eliminationOrder] : null,
        // GAME-09 (D-17): turn_laps persisted to schema field (Phase 7 v6 backfill)
        turn_laps: [...this.turn_laps],
        // GAME-08 snapshot of final activePlayerIndex (replay reference)
        active_player_index: this.activePlayerIndex,
      };

      await db.games.add(gameRecord);
      await this.loadHistory();

      // Clear active game from meta
      await db.meta.delete('active_game');

      // Reset to setup
      this._resetState();
    },

    async discardGame() {
      await db.meta.delete('active_game');
      this._resetState();
    },

    // === History ===

    async loadHistory() {
      this.games = await db.games.orderBy('started_at').reverse().toArray();
    },

    async deleteGame(gameId) {
      await db.games.delete(gameId);
      await this.loadHistory();
    },

    // === Lifecycle ===

    async init() {
      await this.loadHistory();

      // Check for interrupted game
      const saved = await db.meta.get('active_game');
      if (saved) {
        this.view = saved.view || 'active';
        this.selectedDeckId = saved.selectedDeckId;
        this.manualCommander = saved.manualCommander || '';
        this.startingLife = saved.startingLife || 40;
        this.opponents = saved.opponents || [];
        this.players = saved.players || [];
        this.currentTurn = saved.currentTurn || 1;
        this.timerSeconds = saved.timerSeconds || 0;
        this.gameStartedAt = saved.gameStartedAt;
        this.expandedPlayer = saved.expandedPlayer;
        // Plan 3: restore lap state + active player + wall-clock anchor
        this.activePlayerIndex = saved.activePlayerIndex ?? null;
        this.turn_laps = saved.turn_laps || [];
        this.turnStartedAt = saved.turnStartedAt ?? null;
      }
    },

    // === UI Helpers ===

    toggleExpanded(playerIndex) {
      this.expandedPlayer = this.expandedPlayer === playerIndex ? null : playerIndex;
    },

    // === Internal ===

    _resetState() {
      this.view = 'setup';
      this.selectedDeckId = null;
      this.manualCommander = '';
      this.startingLife = 40;
      this.opponents = [];
      this.players = [];
      this.currentTurn = 0;
      this.timerSeconds = 0;
      this.timerRunning = false;
      this.gameStartedAt = null;
      this.expandedPlayer = null;
      // Plan 3: clear new fields
      this.activePlayerIndex = null;
      this.turn_laps = [];
      this.turnStartedAt = null;
      this.pauseTimer();
    },
  });
}
