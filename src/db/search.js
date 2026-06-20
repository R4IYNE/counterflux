import { db } from './schema.js';
import { suggestTags } from '../utils/tag-heuristics.js';
import { queueScryfallRequest } from '../services/scryfall-queue.js';

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
 * Returns true when the local Dexie catalog is ready to serve queries.
 * - When `window.Alpine.store('bulkdata')` exists, gate on `.status === 'ready'`.
 * - When Alpine is absent (test env or pre-mount), assume ready so the Dexie
 *   path runs against fixtures.
 *
 * Quick task 260514-uqc Layer 1: callers now route to the Scryfall REST API
 * fallback when this returns false (was: returned an empty-with-flag result).
 */
function isBulkDataReady() {
  const alpine = (typeof window !== 'undefined' && window.Alpine) || null;
  const store = alpine?.store ? alpine.store('bulkdata') : null;
  if (!store) return true; // no Alpine store available → assume ready (test env / pre-mount)
  return store.status === 'ready';
}

/**
 * Quick task 260514-uqc Layer 1 — Scryfall REST API fallback for searchCards.
 * Hits /cards/search through queueScryfallRequest (User-Agent + 100ms spacing
 * per Scryfall ToS). Filters to paper-legal printings and drops Alchemy
 * rebalanced cards (A-* prefix), matching the Dexie path's rules. Caps the
 * result at `limit`. On API error (e.g. 404 no-match) returns [].
 *
 * @param {string} query - User-typed query (already validated >= 2 chars)
 * @param {number} limit - Max results
 * @returns {Promise<Object[]>}
 */
async function searchCardsViaApi(query, limit) {
  const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=cards&order=name&include_extras=false`;
  try {
    const response = await queueScryfallRequest(url);
    const data = Array.isArray(response?.data) ? response.data : [];
    const filtered = [];
    for (const card of data) {
      if (card?.name && card.name.startsWith('A-')) continue;
      if (!isPaperLegal(card)) continue;
      filtered.push(card);
      if (filtered.length >= limit) break;
    }
    return filtered;
  } catch (_err) {
    // 404 no-match (and any other transient API error) → empty results.
    // The consumer pattern in deck-search-panel.js / add-card-panel.js
    // already renders the standard "no results" path for [].
    return [];
  }
}

/**
 * Quick task 260514-uqc Layer 1 — Scryfall REST API fallback for browseCards.
 * Composes a Scryfall query string from colour identity + filters and hits
 * /cards/search. The `filters.tag` heuristic is intentionally NOT translated
 * — it's a client-side oracle-text heuristic that the consumer applies
 * post-fetch (preserves the parity behaviour with the Dexie path).
 *
 * @param {string[]} colorIdentity
 * @param {object} filters
 * @param {number} limit
 * @returns {Promise<Object[]>}
 */
async function browseCardsViaApi(colorIdentity = [], filters = {}, limit = 20) {
  const parts = [];

  // Colour identity: `identity<=ABC` means "card identity is within ABC".
  // Empty colorIdentity → don't constrain (commander has no identity context yet).
  if (colorIdentity.length > 0) {
    const ci = colorIdentity.map(c => String(c).toUpperCase()).join('');
    parts.push(`identity<=${ci}`);
  }

  // Type filter
  if (filters.type && filters.type !== 'All') {
    parts.push(`type:${String(filters.type).toLowerCase()}`);
  }

  // CMC filter
  if (filters.cmc && filters.cmc !== 'All') {
    if (filters.cmc === '7+') {
      parts.push('cmc>=7');
    } else {
      parts.push(`cmc=${parseInt(filters.cmc, 10)}`);
    }
  }

  // Rarity filter
  if (filters.rarity && filters.rarity !== 'All') {
    parts.push(`rarity:${String(filters.rarity).toLowerCase()}`);
  }

  // Always paper-only (defensive; /cards/search is already paper-biased
  // for the default unique=cards mode, but be explicit).
  parts.push('game:paper');

  // Wildcard fallback when no constraints were added (effectively
  // "any colourless paper card") — Scryfall requires at least one term.
  if (parts.length === 1) {
    // Only `game:paper` was pushed; add a broad name filter that matches
    // any non-empty card name.
    parts.unshift('name:/./');
  }

  const q = parts.join(' ');
  const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&unique=cards&order=name`;

  try {
    const response = await queueScryfallRequest(url);
    const data = Array.isArray(response?.data) ? response.data : [];
    const filtered = [];
    for (const card of data) {
      if (card?.name && card.name.startsWith('A-')) continue;
      if (!isPaperLegal(card)) continue;
      filtered.push(card);
      if (filtered.length >= limit) break;
    }
    return filtered;
  } catch (_err) {
    return [];
  }
}

export async function searchCards(query, limit = 12) {
  if (!query || query.length < 2) return [];

  // Quick task 260514-uqc Layer 1 — when the local Dexie catalog isn't ready
  // yet, fall through to the Scryfall REST API instead of returning the
  // legacy empty-with-flag. This restores search functionality during the
  // bulk-streaming window (was the 3-5 min dead-time the user perceived).
  if (!isBulkDataReady()) {
    return await searchCardsViaApi(query, limit);
  }

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
      // Keep cheapest. Rank by EUR (audit P2-M4: the whole valuation pipeline is
      // EUR — ranking by USD here surfaced a printing chosen by a currency the
      // app never shows). Missing/0 prices sort as Infinity so a genuinely
      // priced printing always beats an unpriced one (audit L29 — the old `|| 999`
      // mis-ranked €0/no-price rows as cheap... actually expensive).
      const eur = (c) => {
        const p = parseFloat(c.prices?.eur || c.prices?.eur_foil);
        return Number.isFinite(p) && p > 0 ? p : Infinity;
      };
      if (eur(card) < eur(existing)) seen.set(key, card);
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
  // Quick task 260514-uqc Layer 1 — mirror searchCards(): route to the
  // Scryfall REST API while the bulk catalog is still streaming so
  // Thousand-Year Storm's deck-search panel surfaces real cards on
  // first paint instead of an empty browse list.
  if (!isBulkDataReady()) {
    return await browseCardsViaApi(colorIdentity, filters, limit);
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
