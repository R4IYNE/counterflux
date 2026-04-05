import { db } from './schema.js';
import { suggestTags } from '../utils/tag-heuristics.js';

export async function searchCards(query, limit = 12) {
  if (!query || query.length < 2) return [];

  const normalised = query.toLowerCase();

  // Title-case each word to match MTG card name format for indexed lookup
  const titleCased = normalised.replace(/\b\w/g, c => c.toUpperCase());

  const raw = await db.cards
    .where('name')
    .startsWith(titleCased)
    .limit(limit * 3)
    .toArray();

  // Deduplicate by oracle_id (keep first printing per unique card)
  const seen = new Set();
  const results = [];
  for (const card of raw) {
    if (card.name && card.name.startsWith('A-')) continue;
    const key = card.oracle_id || card.id;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(card);
    if (results.length >= limit) break;
  }

  // Fallback: substring match only when prefix search found nothing
  // (skip when we have any prefix results — the full table scan is too slow)
  if (results.length === 0) {
    const additional = await db.cards
      .filter(card => card.name.toLowerCase().includes(normalised))
      .limit(limit * 3)
      .toArray();
    for (const card of additional) {
      if (card.name && card.name.startsWith('A-')) continue;
      const key = card.oracle_id || card.id;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(card);
      if (results.length >= limit) break;
    }
  }

  return results;
}

/**
 * Browse cards filtered by colour identity. Returns cards sorted by name.
 * Used for the deck search panel's default "suggestions" view.
 * @param {string[]} colorIdentity - Allowed colours (e.g. ['G','W'])
 * @param {Object} [filters] - Optional filters
 * @param {string} [filters.type] - Type line filter (e.g. 'Creature')
 * @param {string} [filters.cmc] - CMC filter (e.g. '3', '7+')
 * @param {string} [filters.rarity] - Rarity filter
 * @param {number} [limit=20] - Max results
 * @returns {Promise<Object[]>}
 */
export async function browseCards(colorIdentity = [], filters = {}, limit = 20) {
  const seen = new Set();
  const results = [];
  const batchSize = 200;
  let offset = 0;
  const maxScanned = 5000; // safety cap

  while (results.length < limit && offset < maxScanned) {
    const batch = await db.cards.orderBy('name').offset(offset).limit(batchSize).toArray();
    if (batch.length === 0) break;
    offset += batch.length;

    for (const card of batch) {
      const key = card.oracle_id || card.id;
      if (seen.has(key)) continue;

      // Skip Alchemy rebalanced cards (A- prefix, digital-only)
      if (card.name && card.name.startsWith('A-')) continue;

      // Colour identity filter
      if (colorIdentity.length > 0) {
        const cardCI = card.color_identity || [];
        if (!cardCI.every(c => colorIdentity.includes(c))) continue;
      }

      // Type filter
      if (filters.type && filters.type !== 'All') {
        if (!(card.type_line || '').includes(filters.type)) continue;
      }

      // CMC filter
      if (filters.cmc && filters.cmc !== 'All') {
        if (filters.cmc === '7+') {
          if ((card.cmc || 0) < 7) continue;
        } else {
          if ((card.cmc || 0) !== parseInt(filters.cmc, 10)) continue;
        }
      }

      // Rarity filter
      if (filters.rarity && filters.rarity !== 'All') {
        if (card.rarity !== filters.rarity) continue;
      }

      // Category filter
      if (filters.tag && filters.tag !== 'All') {
        const cardTags = suggestTags(card?.oracle_text);
        if (!cardTags.includes(filters.tag)) continue;
      }

      seen.add(key);
      results.push(card);
      if (results.length >= limit) break;
    }
  }

  return results;
}
