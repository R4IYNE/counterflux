import { db } from './schema.js';
import { suggestTags } from '../utils/tag-heuristics.js';

/**
 * Check if a card is a paper-legal printing (not memorabilia/digital-only).
 * Cards without a games field are treated as paper (test fixtures, legacy data).
 */
function isPaperLegal(card) {
  if (card.set_type === 'memorabilia') return false;
  if (!card.games) return true; // no games field = assume paper
  return card.games.includes('paper');
}

/**
 * Phase 13 Plan 3 — D-05: inspect $store.bulkdata.status and return an
 * early annotated-empty result when the archive hasn't finished indexing.
 * This lets Treasure Cruise (add-card-panel.js) and Thousand-Year Storm
 * (deck-search-panel.js) distinguish "no matches" from "bulk data still
 * downloading" and render the appropriate skeleton placeholder.
 *
 * @returns {{ results: Array, bulkDataNotReady: true, message: string } | null}
 */
function bulkDataGate() {
  const alpine = (typeof window !== 'undefined' && window.Alpine) || null;
  const store = alpine?.store ? alpine.store('bulkdata') : null;
  if (store && store.status !== 'ready') {
    return {
      results: [],
      bulkDataNotReady: true,
      message: 'Bulk data loading…',
    };
  }
  return null;
}

export async function searchCards(query, limit = 12) {
  // D-05 guard — shape the empty result so consumers can render a placeholder.
  // Historical contract: on non-match, searchCards returns []. We preserve
  // that by returning [] when the gate fires; the flag lives on the array
  // itself so consumers can opt-in.
  const gated = bulkDataGate();
  if (gated) {
    const empty = [];
    empty.bulkDataNotReady = true;
    empty.message = gated.message;
    return empty;
  }

  if (!query || query.length < 2) return [];

  const normalised = query.toLowerCase();

  // Title-case each word to match MTG card name format for indexed lookup
  const titleCased = normalised.replace(/\b\w/g, c => c.toUpperCase());

  const raw = await db.cards
    .where('name')
    .startsWith(titleCased)
    .limit(limit * 5)
    .toArray();

  // Deduplicate by oracle_id, prefer cheapest paper-legal printing
  const seen = new Map(); // oracle_id -> card
  for (const card of raw) {
    if (card.name && card.name.startsWith('A-')) continue;
    if (!isPaperLegal(card)) continue;
    const key = card.oracle_id || card.id;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, card);
    } else {
      // Keep cheapest
      const priceA = parseFloat(existing.prices?.usd || existing.prices?.usd_foil) || 999;
      const priceB = parseFloat(card.prices?.usd || card.prices?.usd_foil) || 999;
      if (priceB < priceA) seen.set(key, card);
    }
    if (seen.size >= limit) break;
  }
  let results = [...seen.values()];

  // Fallback: substring match only when prefix search found nothing
  // (skip when we have any prefix results — the full table scan is too slow)
  if (results.length === 0) {
    const additional = await db.cards
      .filter(card => card.name.toLowerCase().includes(normalised) && isPaperLegal(card))
      .limit(limit * 5)
      .toArray();
    for (const card of additional) {
      if (card.name && card.name.startsWith('A-')) continue;
      const key = card.oracle_id || card.id;
      if (seen.has(key)) continue;
      seen.set(key, card);
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
  // D-05 guard — mirror searchCards() so deck-search-panel.js's browse-mode
  // initial load also surfaces the placeholder while bulk data is still
  // indexing.
  const gated = bulkDataGate();
  if (gated) {
    const empty = [];
    empty.bulkDataNotReady = true;
    empty.message = gated.message;
    return empty;
  }

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

      // Skip Alchemy rebalanced cards and non-paper/memorabilia printings
      if (card.name && card.name.startsWith('A-')) continue;
      if (!isPaperLegal(card)) continue;

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
