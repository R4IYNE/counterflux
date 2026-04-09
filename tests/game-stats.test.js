import { describe, it, expect } from 'vitest';
import { computeGameStats } from '../src/utils/game-stats.js';

/**
 * Helper to create a game record for testing.
 */
function makeGame(overrides = {}) {
  return {
    id: overrides.id || 1,
    deck_id: overrides.deck_id || 1,
    started_at: overrides.started_at || '2026-03-01T18:00:00Z',
    ended_at: overrides.ended_at || '2026-03-01T19:00:00Z',
    turn_count: overrides.turn_count || 10,
    winner_index: overrides.winner_index ?? 0,
    players: overrides.players || [
      { name: 'You', commander: 'Niv-Mizzet, Parun' },
      { name: 'Alice', commander: 'Krenko, Mob Boss' },
    ],
    elimination_order: overrides.elimination_order || null,
  };
}

describe('computeGameStats', () => {
  it('returns zeros for empty array', () => {
    const stats = computeGameStats([]);
    expect(stats.totalGames).toBe(0);
    expect(stats.wins).toBe(0);
    expect(stats.winRate).toBe(0);
    expect(stats.avgGameLength).toBe(0);
    expect(stats.avgTurns).toBe(0);
    expect(stats.bestDeck).toBeNull();
    expect(stats.mostPlayed).toBeNull();
    expect(stats.currentWinStreak).toBe(0);
    expect(stats.longestWinStreak).toBe(0);
    expect(stats.winRateByDeck).toEqual([]);
    expect(stats.winRateByPlayer).toEqual([]);
  });

  it('returns zeros for null input', () => {
    const stats = computeGameStats(null);
    expect(stats.totalGames).toBe(0);
  });

  it('computes correct win rate for 3 games (2 wins = 66.67%)', () => {
    const games = [
      makeGame({ id: 1, winner_index: 0, started_at: '2026-03-01T18:00:00Z' }),
      makeGame({ id: 2, winner_index: 0, started_at: '2026-03-02T18:00:00Z' }),
      makeGame({ id: 3, winner_index: 1, started_at: '2026-03-03T18:00:00Z' }),
    ];
    const stats = computeGameStats(games);
    expect(stats.totalGames).toBe(3);
    expect(stats.wins).toBe(2);
    expect(stats.winRate).toBe(66.67);
  });

  it('computes avgGameLength from timestamps', () => {
    const games = [
      makeGame({
        id: 1,
        started_at: '2026-03-01T18:00:00Z',
        ended_at: '2026-03-01T19:00:00Z', // 60 min
      }),
      makeGame({
        id: 2,
        started_at: '2026-03-02T18:00:00Z',
        ended_at: '2026-03-02T18:30:00Z', // 30 min
      }),
    ];
    const stats = computeGameStats(games);
    expect(stats.avgGameLength).toBe(45); // (60 + 30) / 2
  });

  it('computes avgTurns correctly', () => {
    const games = [
      makeGame({ id: 1, turn_count: 12 }),
      makeGame({ id: 2, turn_count: 8 }),
    ];
    const stats = computeGameStats(games);
    expect(stats.avgTurns).toBe(10);
  });

  it('returns bestDeck with highest win rate (min 2 games)', () => {
    const games = [
      makeGame({ id: 1, deck_id: 1, winner_index: 0, started_at: '2026-03-01T18:00:00Z', players: [{ name: 'You', commander: 'Niv-Mizzet' }, { name: 'Alice', commander: 'Krenko' }] }),
      makeGame({ id: 2, deck_id: 1, winner_index: 0, started_at: '2026-03-02T18:00:00Z', players: [{ name: 'You', commander: 'Niv-Mizzet' }, { name: 'Alice', commander: 'Krenko' }] }),
      makeGame({ id: 3, deck_id: 2, winner_index: 0, started_at: '2026-03-03T18:00:00Z', players: [{ name: 'You', commander: 'Muldrotha' }, { name: 'Bob', commander: 'Edgar' }] }),
      makeGame({ id: 4, deck_id: 2, winner_index: 1, started_at: '2026-03-04T18:00:00Z', players: [{ name: 'You', commander: 'Muldrotha' }, { name: 'Bob', commander: 'Edgar' }] }),
    ];
    const stats = computeGameStats(games);
    expect(stats.bestDeck).not.toBeNull();
    expect(stats.bestDeck.name).toBe('Niv-Mizzet');
    expect(stats.bestDeck.winRate).toBe(100);
    expect(stats.bestDeck.gamesPlayed).toBe(2);
  });

  it('returns null bestDeck when no deck has 2+ games', () => {
    const games = [
      makeGame({ id: 1, deck_id: 1, winner_index: 0 }),
    ];
    const stats = computeGameStats(games);
    expect(stats.bestDeck).toBeNull();
  });

  it('returns mostPlayed commander', () => {
    const games = [
      makeGame({ id: 1, players: [{ name: 'You', commander: 'Niv-Mizzet' }, { name: 'Alice', commander: 'Krenko' }] }),
      makeGame({ id: 2, players: [{ name: 'You', commander: 'Niv-Mizzet' }, { name: 'Bob', commander: 'Edgar' }] }),
      makeGame({ id: 3, players: [{ name: 'You', commander: 'Muldrotha' }, { name: 'Alice', commander: 'Krenko' }] }),
    ];
    const stats = computeGameStats(games);
    expect(stats.mostPlayed.commanderName).toBe('Niv-Mizzet');
    expect(stats.mostPlayed.gamesPlayed).toBe(2);
  });

  it('computes currentWinStreak from most recent games', () => {
    const games = [
      makeGame({ id: 1, winner_index: 1, started_at: '2026-03-01T18:00:00Z' }),
      makeGame({ id: 2, winner_index: 0, started_at: '2026-03-02T18:00:00Z' }),
      makeGame({ id: 3, winner_index: 0, started_at: '2026-03-03T18:00:00Z' }),
      makeGame({ id: 4, winner_index: 0, started_at: '2026-03-04T18:00:00Z' }),
    ];
    const stats = computeGameStats(games);
    expect(stats.currentWinStreak).toBe(3);
  });

  it('currentWinStreak is 0 when most recent game is a loss', () => {
    const games = [
      makeGame({ id: 1, winner_index: 0, started_at: '2026-03-01T18:00:00Z' }),
      makeGame({ id: 2, winner_index: 1, started_at: '2026-03-02T18:00:00Z' }),
    ];
    const stats = computeGameStats(games);
    expect(stats.currentWinStreak).toBe(0);
  });

  it('computes longestWinStreak across entire history', () => {
    const games = [
      makeGame({ id: 1, winner_index: 0, started_at: '2026-03-01T18:00:00Z' }),
      makeGame({ id: 2, winner_index: 0, started_at: '2026-03-02T18:00:00Z' }),
      makeGame({ id: 3, winner_index: 0, started_at: '2026-03-03T18:00:00Z' }),
      makeGame({ id: 4, winner_index: 1, started_at: '2026-03-04T18:00:00Z' }),
      makeGame({ id: 5, winner_index: 0, started_at: '2026-03-05T18:00:00Z' }),
    ];
    const stats = computeGameStats(games);
    expect(stats.longestWinStreak).toBe(3);
    expect(stats.currentWinStreak).toBe(1);
  });

  it('computes winRateByDeck grouped correctly', () => {
    const games = [
      makeGame({ id: 1, deck_id: 1, winner_index: 0, started_at: '2026-03-01T18:00:00Z', players: [{ name: 'You', commander: 'Niv-Mizzet' }, { name: 'Alice', commander: 'Krenko' }] }),
      makeGame({ id: 2, deck_id: 1, winner_index: 1, started_at: '2026-03-02T18:00:00Z', players: [{ name: 'You', commander: 'Niv-Mizzet' }, { name: 'Alice', commander: 'Krenko' }] }),
      makeGame({ id: 3, deck_id: 2, winner_index: 0, started_at: '2026-03-03T18:00:00Z', players: [{ name: 'You', commander: 'Muldrotha' }, { name: 'Bob', commander: 'Edgar' }] }),
    ];
    const stats = computeGameStats(games);
    expect(stats.winRateByDeck).toHaveLength(2);
    const deck1 = stats.winRateByDeck.find(d => d.deckId === 1);
    expect(deck1.wins).toBe(1);
    expect(deck1.games).toBe(2);
    expect(deck1.winRate).toBe(50);
    const deck2 = stats.winRateByDeck.find(d => d.deckId === 2);
    expect(deck2.wins).toBe(1);
    expect(deck2.games).toBe(1);
    expect(deck2.winRate).toBe(100);
  });

  it('computes winRateByPlayer for opponents', () => {
    const games = [
      makeGame({ id: 1, winner_index: 0, players: [{ name: 'You', commander: 'Niv' }, { name: 'Alice', commander: 'Krenko' }, { name: 'Bob', commander: 'Edgar' }] }),
      makeGame({ id: 2, winner_index: 1, players: [{ name: 'You', commander: 'Niv' }, { name: 'Alice', commander: 'Krenko' }] }),
    ];
    const stats = computeGameStats(games);
    const alice = stats.winRateByPlayer.find(p => p.playerName === 'Alice');
    expect(alice.wins).toBe(1); // You won game 1
    expect(alice.losses).toBe(1); // You lost game 2
    const bob = stats.winRateByPlayer.find(p => p.playerName === 'Bob');
    expect(bob.wins).toBe(1);
    expect(bob.losses).toBe(0);
  });
});
