import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../src/db/schema.js';
import { computeGameStats } from '../src/utils/game-stats.js';

/**
 * Create a game store as a plain object for testing (same pattern as deck-store.test.js).
 * The store operates directly against Dexie without Alpine.
 */
function createGameStore() {
  const toastCalls = [];

  return {
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
    _timerInterval: null,
    gameStartedAt: null,
    games: [],
    expandedPlayer: null,
    _toastCalls: toastCalls,

    get stats() {
      return computeGameStats(this.games);
    },

    addOpponent() {
      if (this.opponents.length >= 5) return;
      this.opponents.push({ name: '', commander: '', partner: null });
    },

    removeOpponent(index) {
      this.opponents.splice(index, 1);
    },

    startGame() {
      if (!this.selectedDeckId && !this.manualCommander.trim()) {
        return false;
      }
      if (this.opponents.length < 1) {
        return false;
      }

      const playerCount = this.opponents.length + 1;
      const players = [];

      players.push({
        name: 'You',
        commander: this.manualCommander.trim() || null,
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

      for (let i = 1; i < playerCount; i++) {
        players[0].commander_damage[i] = 0;
      }

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
        for (let j = 0; j < playerCount; j++) {
          if (j !== i + 1) player.commander_damage[j] = 0;
        }
        players.push(player);
      }

      this.players = players;
      this.view = 'active';
      this.currentTurn = 1;
      this.gameStartedAt = new Date().toISOString();
      return true;
    },

    adjustLife(playerIndex, amount) {
      if (!this.players[playerIndex]) return;
      this.players[playerIndex].life += amount;
      this.players[playerIndex].life_history.push(this.players[playerIndex].life);
    },

    adjustPoison(playerIndex, amount) {
      if (!this.players[playerIndex]) return;
      const newVal = this.players[playerIndex].poison + amount;
      this.players[playerIndex].poison = Math.max(0, newVal);
      if (this.players[playerIndex].poison >= 10 && !this.players[playerIndex].eliminated) {
        this.players[playerIndex].eliminated = true;
        toastCalls.push({ type: 'poison', player: playerIndex });
      }
    },

    adjustCommanderDamage(targetIndex, sourceIndex, amount) {
      if (!this.players[targetIndex]) return;
      const current = this.players[targetIndex].commander_damage[sourceIndex] || 0;
      const newVal = Math.max(0, current + amount);
      this.players[targetIndex].commander_damage[sourceIndex] = newVal;
      if (newVal >= 21 && !this.players[targetIndex].eliminated) {
        this.players[targetIndex].eliminated = true;
        toastCalls.push({ type: 'commander_damage', target: targetIndex, source: sourceIndex });
      }
    },

    adjustTax(playerIndex, amount) {
      if (!this.players[playerIndex]) return;
      const newVal = this.players[playerIndex].tax_count + amount;
      this.players[playerIndex].tax_count = Math.max(0, newVal);
    },

    async saveGame(winnerIndex, eliminationOrder) {
      const gameRecord = {
        deck_id: this.selectedDeckId,
        started_at: this.gameStartedAt,
        ended_at: new Date().toISOString(),
        turn_count: this.currentTurn,
        winner_index: winnerIndex,
        players: JSON.parse(JSON.stringify(this.players)),
        elimination_order: eliminationOrder || null,
      };
      await db.games.add(gameRecord);
      await this.loadHistory();
    },

    async loadHistory() {
      this.games = await db.games.orderBy('started_at').reverse().toArray();
    },

    async deleteGame(gameId) {
      await db.games.delete(gameId);
      await this.loadHistory();
    },
  };
}

describe('Game Store', () => {
  let store;

  beforeEach(async () => {
    // Clear games and meta tables
    await db.games.clear();
    await db.meta.clear();
    store = createGameStore();
  });

  describe('setup', () => {
    it('startGame returns false without deck or commander', () => {
      store.opponents = [{ name: 'Alice', commander: 'Krenko', partner: null }];
      const result = store.startGame();
      expect(result).toBe(false);
      expect(store.view).toBe('setup');
    });

    it('startGame returns false without opponents', () => {
      store.manualCommander = 'Niv-Mizzet, Parun';
      const result = store.startGame();
      expect(result).toBe(false);
      expect(store.view).toBe('setup');
    });

    it('startGame creates correct players array with life_history initialized', () => {
      store.manualCommander = 'Niv-Mizzet, Parun';
      store.startingLife = 40;
      store.opponents = [
        { name: 'Alice', commander: 'Krenko, Mob Boss', partner: null },
        { name: 'Bob', commander: 'Edgar Markov', partner: null },
      ];

      const result = store.startGame();
      expect(result).toBe(true);
      expect(store.view).toBe('active');
      expect(store.players).toHaveLength(3);

      // Player 0 = You
      expect(store.players[0].name).toBe('You');
      expect(store.players[0].commander).toBe('Niv-Mizzet, Parun');
      expect(store.players[0].life).toBe(40);
      expect(store.players[0].life_history).toEqual([40]);
      expect(store.players[0].poison).toBe(0);
      expect(store.players[0].eliminated).toBe(false);

      // Commander damage initialized for other players
      expect(store.players[0].commander_damage).toEqual({ 1: 0, 2: 0 });

      // Player 1 = Alice
      expect(store.players[1].name).toBe('Alice');
      expect(store.players[1].commander).toBe('Krenko, Mob Boss');
    });

    it('startGame sets currentTurn to 1 and gameStartedAt', () => {
      store.manualCommander = 'Niv-Mizzet';
      store.opponents = [{ name: 'Alice', commander: 'Krenko', partner: null }];
      store.startGame();
      expect(store.currentTurn).toBe(1);
      expect(store.gameStartedAt).toBeTruthy();
    });
  });

  describe('commander damage', () => {
    beforeEach(() => {
      store.manualCommander = 'Niv-Mizzet';
      store.opponents = [{ name: 'Alice', commander: 'Krenko', partner: null }];
      store.startGame();
    });

    it('adjustCommanderDamage increments correctly', () => {
      store.adjustCommanderDamage(0, 1, 5);
      expect(store.players[0].commander_damage[1]).toBe(5);
      store.adjustCommanderDamage(0, 1, 3);
      expect(store.players[0].commander_damage[1]).toBe(8);
    });

    it('adjustCommanderDamage flags eliminated at 21', () => {
      store.adjustCommanderDamage(0, 1, 21);
      expect(store.players[0].eliminated).toBe(true);
      expect(store._toastCalls).toHaveLength(1);
      expect(store._toastCalls[0].type).toBe('commander_damage');
    });

    it('adjustCommanderDamage clamps at 0 (no negative)', () => {
      store.adjustCommanderDamage(0, 1, -5);
      expect(store.players[0].commander_damage[1]).toBe(0);
    });
  });

  describe('poison', () => {
    beforeEach(() => {
      store.manualCommander = 'Niv-Mizzet';
      store.opponents = [{ name: 'Alice', commander: 'Krenko', partner: null }];
      store.startGame();
    });

    it('adjustPoison increments correctly', () => {
      store.adjustPoison(0, 3);
      expect(store.players[0].poison).toBe(3);
    });

    it('adjustPoison flags eliminated at 10', () => {
      store.adjustPoison(0, 10);
      expect(store.players[0].eliminated).toBe(true);
      expect(store.players[0].poison).toBe(10);
    });

    it('adjustPoison clamps at 0', () => {
      store.adjustPoison(0, 2);
      store.adjustPoison(0, -5);
      expect(store.players[0].poison).toBe(0);
    });
  });

  describe('tax', () => {
    beforeEach(() => {
      store.manualCommander = 'Niv-Mizzet';
      store.opponents = [{ name: 'Alice', commander: 'Krenko', partner: null }];
      store.startGame();
    });

    it('adjustTax increments tax_count', () => {
      store.adjustTax(0, 1);
      expect(store.players[0].tax_count).toBe(1);
      store.adjustTax(0, 1);
      expect(store.players[0].tax_count).toBe(2);
    });

    it('computed tax cost is tax_count * 2', () => {
      store.adjustTax(0, 3);
      expect(store.players[0].tax_count * 2).toBe(6);
    });

    it('adjustTax clamps at 0', () => {
      store.adjustTax(0, 1);
      store.adjustTax(0, -5);
      expect(store.players[0].tax_count).toBe(0);
    });
  });

  describe('life', () => {
    beforeEach(() => {
      store.manualCommander = 'Niv-Mizzet';
      store.opponents = [{ name: 'Alice', commander: 'Krenko', partner: null }];
      store.startGame();
    });

    it('adjustLife adds and subtracts correctly', () => {
      store.adjustLife(0, -5);
      expect(store.players[0].life).toBe(35);
      store.adjustLife(0, 10);
      expect(store.players[0].life).toBe(45);
    });

    it('adjustLife pushes to life_history', () => {
      store.adjustLife(0, -3);
      store.adjustLife(0, -2);
      expect(store.players[0].life_history).toEqual([40, 37, 35]);
    });
  });

  describe('persistence', () => {
    it('saveGame writes to db.games', async () => {
      store.manualCommander = 'Niv-Mizzet';
      store.selectedDeckId = 42;
      store.opponents = [{ name: 'Alice', commander: 'Krenko', partner: null }];
      store.startGame();

      await store.saveGame(0, null);
      const allGames = await db.games.toArray();
      expect(allGames).toHaveLength(1);
      expect(allGames[0].deck_id).toBe(42);
      expect(allGames[0].winner_index).toBe(0);
      expect(allGames[0].players).toHaveLength(2);
    });

    it('loadHistory reads from db.games sorted by started_at desc', async () => {
      await db.games.add({
        deck_id: 1,
        started_at: '2026-03-01T18:00:00Z',
        ended_at: '2026-03-01T19:00:00Z',
        turn_count: 10,
        winner_index: 0,
        players: [],
      });
      await db.games.add({
        deck_id: 1,
        started_at: '2026-03-02T18:00:00Z',
        ended_at: '2026-03-02T19:00:00Z',
        turn_count: 8,
        winner_index: 1,
        players: [],
      });

      await store.loadHistory();
      expect(store.games).toHaveLength(2);
      // Most recent first
      expect(store.games[0].started_at).toBe('2026-03-02T18:00:00Z');
      expect(store.games[1].started_at).toBe('2026-03-01T18:00:00Z');
    });

    it('deleteGame removes from db and reloads', async () => {
      const id = await db.games.add({
        deck_id: 1,
        started_at: '2026-03-01T18:00:00Z',
        ended_at: '2026-03-01T19:00:00Z',
        turn_count: 10,
        winner_index: 0,
        players: [],
      });

      await store.loadHistory();
      expect(store.games).toHaveLength(1);

      await store.deleteGame(id);
      expect(store.games).toHaveLength(0);
    });
  });
});

// ============================================================
// Phase 9 Plan 3 — Vandalblast turn mechanics + post-game stats
// (GAME-07 store-side / GAME-08 / GAME-09 / GAME-10)
//
// These tests exercise the REAL Alpine-backed initGameStore() — not the
// plain-object createGameStore() harness above. We mock alpinejs so the store
// registration is captured into a local registry; the spinner is mocked so
// startGame() awaits resolve immediately with a deterministic winnerIndex.
// ============================================================

vi.mock('../src/components/first-player-spinner.js', () => ({
  spinForFirstPlayer: vi.fn().mockResolvedValue(0),
}));

const _alpineStores = {};
vi.mock('alpinejs', () => ({
  default: {
    store(name, def) {
      if (def !== undefined) _alpineStores[name] = def;
      return _alpineStores[name];
    },
  },
}));

import { initGameStore } from '../src/stores/game.js';
import { spinForFirstPlayer } from '../src/components/first-player-spinner.js';

describe('game-store Plan 3 turn mechanics', () => {
  let game;
  let _dateNowSpy;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Register a no-op toast store BEFORE initGameStore (toast lookups can occur).
    _alpineStores.toast = {
      error: vi.fn(),
      warning: vi.fn(),
      success: vi.fn(),
      show: vi.fn(),
    };
    initGameStore();
    game = _alpineStores.game;

    // Bootstrap a 3-player game (You + Bob + Carol) for tests.
    // We deliberately DO NOT use vi.useFakeTimers() here — it deadlocks with
    // fake-indexeddb's internal timer-based microtask ordering. Instead, we
    // spy on Date.now() to control the wall clock used by nextTurn() and
    // saveGame(); RAF stays real (or stubbed via tests/setup.js).
    game.opponents = [
      { name: 'Bob', commander: 'Krenko', partner: null },
      { name: 'Carol', commander: 'Niv-Mizzet', partner: null },
    ];
    game.manualCommander = 'You';
    game.selectedDeckId = null;
    game.startingLife = 40;
  });

  afterEach(async () => {
    if (_dateNowSpy) _dateNowSpy.mockRestore();
    _dateNowSpy = null;
    await db.games.clear();
    await db.meta.delete('active_game');
    // Reset Alpine state between tests
    if (game) {
      game.view = 'setup';
      game.players = [];
      game.activePlayerIndex = null;
      game.turn_laps = [];
      game.turnStartedAt = null;
      game.pauseTimer?.();
    }
  });

  /** Helper: pin Date.now() to a controllable value across the test. */
  function pinDateNow(initial) {
    let now = initial;
    _dateNowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now);
    return {
      set(t) { now = t; },
      advance(ms) { now += ms; },
    };
  }

  describe('GAME-07 store-side', () => {
    it('startGame() awaits spinner; sets activePlayerIndex + is_first on chosen player', async () => {
      spinForFirstPlayer.mockResolvedValue(2);
      await game.startGame();
      expect(game.activePlayerIndex).toBe(2);
      expect(game.players[2].is_first).toBe(true);
      expect(game.players[0].is_first).toBeFalsy();
      expect(game.players[1].is_first).toBeFalsy();
    });
  });

  describe('GAME-08 active player advance', () => {
    it('nextTurn advances activePlayerIndex modulo players.length', async () => {
      spinForFirstPlayer.mockResolvedValue(0);
      await game.startGame();
      expect(game.activePlayerIndex).toBe(0);
      game.nextTurn();
      expect(game.activePlayerIndex).toBe(1);
      game.nextTurn();
      expect(game.activePlayerIndex).toBe(2);
      game.nextTurn();
      expect(game.activePlayerIndex).toBe(0); // wrap
    });

    it('nextTurn skips eliminated players', async () => {
      spinForFirstPlayer.mockResolvedValue(0);
      await game.startGame();
      game.players[1].eliminated = true;
      game.nextTurn();
      expect(game.activePlayerIndex).toBe(2); // skipped 1
    });
  });

  describe('GAME-09 turn_laps push + persistence', () => {
    it('nextTurn pushes Date.now() - turnStartedAt onto turn_laps', async () => {
      const t0 = 1_700_000_000_000;
      const clock = pinDateNow(t0);
      spinForFirstPlayer.mockResolvedValue(0);
      await game.startGame();
      // startGame re-anchored turnStartedAt to t0 (Date.now() pinned to t0).
      expect(game.turnStartedAt).toBe(t0);

      clock.set(t0 + 5000);
      game.nextTurn();
      expect(game.turn_laps).toEqual([5000]);

      clock.set(t0 + 5000 + 12000);
      game.nextTurn();
      expect(game.turn_laps).toEqual([5000, 12000]);
    });

    it('saveGame persists turn_laps to db.games row', async () => {
      const t0 = 1_700_000_000_000;
      const clock = pinDateNow(t0);
      spinForFirstPlayer.mockResolvedValue(0);
      await game.startGame();
      expect(game.turnStartedAt).toBe(t0);

      clock.set(t0 + 8000);
      game.nextTurn();
      clock.set(t0 + 8000 + 3000);
      await game.saveGame(0, []);

      const saved = await db.games.toArray();
      expect(saved.length).toBe(1);
      expect(saved[0].turn_laps).toEqual([8000, 3000]);
    });
  });

  describe('GAME-10 wall-clock anchor', () => {
    it('lap accurate after 30min jump (proves wall-clock not setInterval)', async () => {
      const t0 = 1_700_000_000_000;
      const clock = pinDateNow(t0);
      spinForFirstPlayer.mockResolvedValue(0);
      await game.startGame();
      expect(game.turnStartedAt).toBe(t0);

      // Jump 30 minutes forward without any timer ticks
      clock.set(t0 + 30 * 60 * 1000);
      game.nextTurn();

      expect(game.turn_laps[0]).toBe(30 * 60 * 1000);
    });

    it('startTimer uses requestAnimationFrame (not setInterval)', async () => {
      spinForFirstPlayer.mockResolvedValue(0);
      await game.startGame();
      game.startTimer();
      expect(game._timerRafId).not.toBeNull();
      expect(game._timerInterval).toBeNull();
      game.pauseTimer();
      expect(game._timerRafId).toBeNull();
    });
  });

  describe('reset state', () => {
    it('_resetState clears Plan 3 fields', async () => {
      spinForFirstPlayer.mockResolvedValue(0);
      await game.startGame();
      game.turn_laps.push(1000);
      game._resetState();
      expect(game.activePlayerIndex).toBeNull();
      expect(game.turn_laps).toEqual([]);
      expect(game.turnStartedAt).toBeNull();
    });
  });

  // ============================================================
  // Phase 9 Plan 06 — Gap 6 (timer auto-start on startGame + nextTurn)
  //
  // BUG: in Plan 3's shipped source, startTimer() is only invoked via the
  // floating-toolbar's manual play/pause button (floating-toolbar.js:59). When
  // the user clicks Start Game, the spinner resolves and the game becomes
  // active, but the visible turn-timer never ticks — users have to find the
  // floating-toolbar button and press it manually. Per GAME-09/GAME-10 spec,
  // the timer should auto-start when a game begins AND re-start on each
  // NEXT TURN.
  //
  // FIX: startGame() calls this.startTimer() after the spinner resolves;
  // nextTurn() calls this.pauseTimer() → this.startTimer() so the current RAF
  // loop is cancelled cleanly and a new loop starts anchored to the new
  // turnStartedAt.
  // ============================================================

  describe('gap 6 (timer auto-start on startGame + nextTurn)', () => {
    it('startGame auto-starts the timer (timerRunning === true post-resolve)', async () => {
      spinForFirstPlayer.mockResolvedValue(0);
      const ok = await game.startGame();
      expect(ok).toBe(true);
      expect(game.timerRunning).toBe(true);
    });

    it('nextTurn auto-restarts the timer (timerRunning true after turn advance)', async () => {
      const t0 = 1_700_000_000_000;
      const clock = pinDateNow(t0);
      spinForFirstPlayer.mockResolvedValue(0);
      await game.startGame();
      expect(game.timerRunning).toBe(true);

      clock.advance(5000); // 5s into turn 1
      game.nextTurn();
      // Without the fix, pauseTimer() at the end of nextTurn leaves this false.
      expect(game.timerRunning).toBe(true);
    });

    it('turn_laps accumulates one entry per nextTurn (3 clicks = 3 laps)', async () => {
      const t0 = 1_700_000_000_000;
      const clock = pinDateNow(t0);
      spinForFirstPlayer.mockResolvedValue(0);
      await game.startGame();
      expect(game.turnStartedAt).toBe(t0);

      clock.advance(10_000);
      game.nextTurn();
      clock.advance(15_000);
      game.nextTurn();
      clock.advance(8_000);
      game.nextTurn();

      expect(game.turn_laps.length).toBe(3);
      expect(game.turn_laps[0]).toBe(10_000);
      expect(game.turn_laps[1]).toBe(15_000);
      expect(game.turn_laps[2]).toBe(8_000);
    });
  });
});
