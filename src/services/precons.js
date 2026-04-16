// src/services/precons.js
// COLLECT-02 / Plan 3 — Scryfall precon browser data layer.
//
// Mirrors src/services/sets.js blueprint (Dexie cache + TTL + queue-routed
// fetch + stale fallback) but persists to the Dexie precons_cache table
// (not the meta table) so decklists can be stored long-term and re-used
// across sessions.
//
// Contract:
//   - fetchPrecons({ forceRefresh })      — returns sorted commander + duel_deck
//   - fetchPreconDecklist(code)           — paginates search_uri, heuristic is_commander
//   - invalidatePreconsCache()            — clear Dexie precons_cache
//
// All Scryfall calls route through queueScryfallRequest (Plan 2) for
// User-Agent + 100ms spacing per ToS. Bare fetch() is forbidden (Pitfall 13).

import { db } from '../db/schema.js';
import { queueScryfallRequest } from './scryfall-queue.js';

// D-09: Commander + duel_deck only. starter (Welcome Deck 2017, etc.) is
// intentionally excluded — these are intro products, not user-collectable
// precons.
const PRECON_SET_TYPES = ['commander', 'duel_deck'];

// D-11: 7-day TTL. Precon products rarely change post-release (Pitfall 16
// mentions Scryfall DOES issue corrections, but 7 days is the sweet spot
// between "too eager" and "stale").
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Fetch all Commander + Duel Deck precon products from Scryfall.
 *
 * Cached in Dexie precons_cache with 7-day TTL. Sorted newest-first
 * (released_at DESC, tiebreak name ASC per D-12). On fetch error, falls
 * back to the stale cache if any rows exist; re-throws if nothing cached.
 *
 * @param {{ forceRefresh?: boolean }} [options]
 * @returns {Promise<Array<Precon>>}
 */
export async function fetchPrecons({ forceRefresh = false } = {}) {
  if (!forceRefresh) {
    try {
      const cached = await db.precons_cache.toArray();
      if (cached.length) {
        const fresh = cached.filter((p) => (Date.now() - (p.updated_at || 0)) < TTL_MS);
        if (fresh.length > 0) {
          return sortPrecons(fresh);
        }
      }
    } catch (err) {
      console.warn('[precons] cache read failed:', err);
    }
  }

  try {
    const json = await queueScryfallRequest('https://api.scryfall.com/sets');
    const now = Date.now();
    const products = (json.data || [])
      .filter((s) => PRECON_SET_TYPES.includes(s.set_type))
      .map((s) => ({
        code: s.code,
        name: s.name,
        set_type: s.set_type,
        released_at: s.released_at || '',
        image_url: s.icon_svg_uri || '',
        search_uri: s.search_uri || '',
        decklist: null, // populated lazily by fetchPreconDecklist
        updated_at: now,
      }));

    // Preserve any cached decklists on refresh (bulkPut overwrites, so
    // manually merge prior decklist fields back in).
    const existing = await db.precons_cache.toArray();
    const byCode = Object.fromEntries(existing.map((p) => [p.code, p]));
    for (const p of products) {
      if (byCode[p.code]?.decklist) {
        p.decklist = byCode[p.code].decklist;
      }
    }
    await db.precons_cache.bulkPut(products);
    return sortPrecons(products);
  } catch (err) {
    // Fallback: return stale cache on network/API error
    try {
      const stale = await db.precons_cache.toArray();
      if (stale.length) {
        console.warn('[precons] fetch failed, returning stale cache:', err);
        return sortPrecons(stale);
      }
    } catch (readErr) {
      console.warn('[precons] stale cache read also failed:', readErr);
    }
    throw err;
  }
}

/**
 * Fetch the decklist for a single precon by paginating its Scryfall
 * search_uri (unique=prints). Filters to games.includes('paper') (scopes to
 * paper-only per Phase 8 milestone) and marks is_commander via the type_line
 * heuristic (Pitfall 5 — Scryfall does NOT flag commanders within a precon;
 * we infer from "Legendary" + "Creature"|"Planeswalker").
 *
 * Writes the decklist back to precons_cache so the 7-day TTL covers it.
 *
 * @param {string} code - Scryfall set code (e.g., 'cmm', 'dd2')
 * @returns {Promise<Array<DecklistEntry>>}
 */
export async function fetchPreconDecklist(code) {
  const cached = await db.precons_cache.get(code);
  if (cached?.decklist && (Date.now() - (cached.updated_at || 0)) < TTL_MS) {
    return cached.decklist;
  }
  if (!cached?.search_uri) {
    throw new Error(`No search_uri cached for precon ${code}. Call fetchPrecons() first.`);
  }

  const cards = [];
  let url = cached.search_uri;
  while (url) {
    const page = await queueScryfallRequest(url);
    for (const card of (page.data || [])) {
      // Paper-only (v1.1 milestone scope): skip MTGO/Arena-only printings
      if (card.games && !card.games.includes('paper')) continue;
      cards.push({
        scryfall_id: card.id,
        quantity: 1, // unique=prints returns one row per printing; precon qty always 1
        is_commander: inferIsCommander(card),
      });
    }
    url = page.has_more ? page.next_page : null;
  }

  const now = Date.now();
  await db.precons_cache.update(code, { decklist: cards, updated_at: now });
  return cards;
}

/**
 * Force-clear the precons cache. Used by the REFRESH button in the
 * precon-browser header (D-11 manual invalidation).
 */
export async function invalidatePreconsCache() {
  await db.precons_cache.clear();
}

/**
 * Pitfall 5: type-line heuristic for commander detection.
 *
 * Scryfall does NOT flag which card within a precon is the commander.
 * We infer it from the type_line — commanders are Legendary Creatures (or
 * Legendary Planeswalkers with the "can be your commander" clause, which we
 * approximate by matching Planeswalker). Expect false positives (non-
 * commander legends like Legendary Artifacts), but:
 *   (a) the badge is visual hint only, not authoritative
 *   (b) D-10 commits all cards identically regardless of this flag
 *
 * @param {{ type_line?: string }} card
 * @returns {boolean}
 */
function inferIsCommander(card) {
  const typeLine = card.type_line || '';
  const isLegendary = typeLine.includes('Legendary');
  const isCreatureOrWalker = typeLine.includes('Creature') || typeLine.includes('Planeswalker');
  return isLegendary && isCreatureOrWalker;
}

function sortPrecons(list) {
  return [...list].sort((a, b) => {
    const d = (b.released_at || '').localeCompare(a.released_at || '');
    return d !== 0 ? d : (a.name || '').localeCompare(b.name || '');
  });
}
