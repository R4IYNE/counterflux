import { db } from '../db/schema.js';

/**
 * Get today's date as YYYY-MM-DD string.
 */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Snapshot current prices for all watchlist entries.
 * Skips cards already snapshot today. Prunes records older than 90 days.
 */
export async function snapshotWatchlistPrices() {
  const watchlist = await db.watchlist.toArray();
  if (watchlist.length === 0) return;

  const today = todayStr();
  const cardIds = watchlist.map(w => w.scryfall_id);

  // Check which cards already have today's snapshot
  const existing = await db.price_history
    .where('[scryfall_id+date]')
    .anyOf(cardIds.map(id => [id, today]))
    .toArray();
  const existingSet = new Set(existing.map(e => e.scryfall_id));

  // Get current prices from cards table
  const cards = await db.cards.where('id').anyOf(cardIds).toArray();
  const cardMap = Object.fromEntries(cards.map(c => [c.id, c]));

  // Create snapshots for cards not yet recorded today
  const snapshots = [];
  for (const entry of watchlist) {
    if (existingSet.has(entry.scryfall_id)) continue;
    const card = cardMap[entry.scryfall_id];
    if (!card) continue;

    const price = parseFloat(card.prices?.eur || '0');
    if (price === 0) continue;

    snapshots.push({
      scryfall_id: entry.scryfall_id,
      date: today,
      price_eur: price,
    });
  }

  if (snapshots.length > 0) {
    await db.price_history.bulkAdd(snapshots);
  }

  // Prune records older than 90 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const oldRecords = await db.price_history
    .where('date')
    .below(cutoffStr)
    .primaryKeys();

  if (oldRecords.length > 0) {
    await db.price_history.bulkDelete(oldRecords);
  }
}

/**
 * Compute price trend for a given card over a period.
 * @param {string} scryfallId
 * @param {number} days - Number of days to look back
 * @returns {{ prices: number[], change: number, changePct: number, direction: 'up'|'down'|'flat' }}
 */
export async function computeTrend(scryfallId, days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const records = await db.price_history
    .where('scryfall_id')
    .equals(scryfallId)
    .and(r => r.date >= cutoffStr)
    .sortBy('date');

  const prices = records.map(r => r.price_eur);

  if (prices.length < 2) {
    return { prices, change: 0, changePct: 0, direction: 'flat' };
  }

  const earliest = prices[0];
  const latest = prices[prices.length - 1];
  const change = latest - earliest;
  const changePct = earliest !== 0 ? (change / earliest) * 100 : 0;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';

  return { prices, change, changePct, direction };
}

/**
 * Compute market movers over a period.
 * @param {string} period - '7d' or '30d'
 * @param {number} limit - Max results per category
 * @returns {{ gainers: Array, losers: Array }}
 */
export async function computeMovers(period, limit = 10) {
  const days = period === '30d' ? 30 : 7;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const records = await db.price_history
    .where('date')
    .aboveOrEqual(cutoffStr)
    .toArray();

  // Group by scryfall_id
  const grouped = {};
  for (const r of records) {
    if (!grouped[r.scryfall_id]) grouped[r.scryfall_id] = [];
    grouped[r.scryfall_id].push(r);
  }

  const movers = [];
  for (const [scryfallId, entries] of Object.entries(grouped)) {
    if (entries.length < 2) continue;
    entries.sort((a, b) => a.date.localeCompare(b.date));
    const earliest = entries[0].price_eur;
    const latest = entries[entries.length - 1].price_eur;
    const change = latest - earliest;
    const changePct = earliest !== 0 ? (change / earliest) * 100 : 0;

    movers.push({
      scryfall_id: scryfallId,
      change,
      changePct,
      currentPrice: latest,
    });
  }

  // Sort by absolute change descending
  movers.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  const gainers = movers.filter(m => m.change > 0).slice(0, limit);
  const losers = movers.filter(m => m.change < 0).slice(0, limit);

  return { gainers, losers };
}
