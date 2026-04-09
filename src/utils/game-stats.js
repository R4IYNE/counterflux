/**
 * Pure utility functions for game statistics computation.
 * No Alpine or Dexie dependency — operates on plain game record arrays.
 */

/**
 * Long-press acceleration tiers for life/counter adjustment.
 * Returns the increment step based on how long the button has been held.
 * @param {number} heldMs - Duration the button has been held in milliseconds
 * @returns {number} Increment value: 1, 5, or 10
 */
export function getIncrement(heldMs) {
  if (heldMs >= 2000) return 10;
  if (heldMs >= 1000) return 5;
  return 1;
}

/**
 * Compute aggregate game statistics from an array of game records.
 * @param {Array} games - Array of game records from IndexedDB
 * @returns {Object} Computed statistics
 */
export function computeGameStats(games) {
  if (!games || games.length === 0) {
    return {
      totalGames: 0,
      wins: 0,
      winRate: 0,
      avgGameLength: 0,
      avgTurns: 0,
      bestDeck: null,
      mostPlayed: null,
      currentWinStreak: 0,
      longestWinStreak: 0,
      winRateByDeck: [],
      winRateByPlayer: [],
    };
  }

  const totalGames = games.length;
  const wins = games.filter(g => g.winner_index === 0).length;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 10000) / 100 : 0;

  // Average game length in minutes
  const gameLengths = games
    .filter(g => g.started_at && g.ended_at)
    .map(g => {
      const start = new Date(g.started_at).getTime();
      const end = new Date(g.ended_at).getTime();
      return (end - start) / 60000; // ms to minutes
    })
    .filter(len => len >= 0);
  const avgGameLength = gameLengths.length > 0
    ? Math.round((gameLengths.reduce((s, l) => s + l, 0) / gameLengths.length) * 100) / 100
    : 0;

  // Average turns
  const turnCounts = games.filter(g => g.turn_count > 0).map(g => g.turn_count);
  const avgTurns = turnCounts.length > 0
    ? Math.round((turnCounts.reduce((s, t) => s + t, 0) / turnCounts.length) * 100) / 100
    : 0;

  // Win rate by deck
  const deckMap = {};
  for (const game of games) {
    const dId = game.deck_id;
    if (dId == null) continue;
    if (!deckMap[dId]) {
      const commanderName = game.players?.[0]?.commander || 'Unknown';
      deckMap[dId] = { deckId: dId, commanderName, wins: 0, games: 0 };
    }
    deckMap[dId].games++;
    if (game.winner_index === 0) deckMap[dId].wins++;
  }
  const winRateByDeck = Object.values(deckMap).map(d => ({
    ...d,
    winRate: d.games > 0 ? Math.round((d.wins / d.games) * 10000) / 100 : 0,
  }));

  // Best deck (minimum 2 games)
  const qualifiedDecks = winRateByDeck.filter(d => d.games >= 2);
  const bestDeck = qualifiedDecks.length > 0
    ? qualifiedDecks.sort((a, b) => b.winRate - a.winRate)[0]
    : null;
  const bestDeckResult = bestDeck
    ? { name: bestDeck.commanderName, winRate: bestDeck.winRate, gamesPlayed: bestDeck.games }
    : null;

  // Most played commander
  const commanderCount = {};
  for (const game of games) {
    const cName = game.players?.[0]?.commander;
    if (!cName) continue;
    commanderCount[cName] = (commanderCount[cName] || 0) + 1;
  }
  const mostPlayedEntries = Object.entries(commanderCount);
  const mostPlayed = mostPlayedEntries.length > 0
    ? mostPlayedEntries.sort((a, b) => b[1] - a[1]).map(([commanderName, gamesPlayed]) => ({ commanderName, gamesPlayed }))[0]
    : null;

  // Streaks — sort by started_at ascending for chronological order
  const sorted = [...games].sort((a, b) =>
    new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  );

  let longestWinStreak = 0;
  let currentStreak = 0;
  for (const game of sorted) {
    if (game.winner_index === 0) {
      currentStreak++;
      if (currentStreak > longestWinStreak) longestWinStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  }

  // Current win streak — count from most recent game backwards
  let currentWinStreak = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].winner_index === 0) {
      currentWinStreak++;
    } else {
      break;
    }
  }

  // Win rate by player (opponents)
  const playerMap = {};
  for (const game of games) {
    if (!game.players) continue;
    const isWin = game.winner_index === 0;
    // Players at index 1+ are opponents
    for (let i = 1; i < game.players.length; i++) {
      const name = game.players[i].name;
      if (!name) continue;
      if (!playerMap[name]) playerMap[name] = { playerName: name, wins: 0, losses: 0 };
      if (isWin) {
        playerMap[name].wins++;
      } else {
        playerMap[name].losses++;
      }
    }
  }
  const winRateByPlayer = Object.values(playerMap);

  return {
    totalGames,
    wins,
    winRate,
    avgGameLength,
    avgTurns,
    bestDeck: bestDeckResult,
    mostPlayed,
    currentWinStreak,
    longestWinStreak,
    winRateByDeck,
    winRateByPlayer,
  };
}
