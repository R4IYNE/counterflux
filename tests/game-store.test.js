import { describe, it, expect, beforeEach, vi } from 'vitest';
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
