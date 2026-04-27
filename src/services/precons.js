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

// Phase 14.07j — precon-deck-memberships.json is ~800KB of MTGJSON-sourced
// scryfall_id arrays. Eager-importing it would bloat the main bundle and
// regress LCP/Phase 7's perf baseline. Dynamic-import on first use instead;
// the precon-browser is the only consumer and is opened by explicit user
// action.
let _membershipsCache = null;
let _membershipsLoading = null;
export async function loadPreconDeckMemberships() {
  if (_membershipsCache) return _membershipsCache;
  if (_membershipsLoading) return _membershipsLoading;
  _membershipsLoading = import('../data/precon-deck-memberships.json')
    .then((mod) => {
      _membershipsCache = mod.default || mod;
      return _membershipsCache;
    })
    .catch((err) => {
      console.warn('[precons] failed to load deck memberships:', err);
      _membershipsCache = { memberships: {} };
      return _membershipsCache;
    });
  return _membershipsLoading;
}
// Test-only escape hatch so vi.doMock can inject membership fixtures.
export function __setPreconDeckMembershipsForTests(value) {
  _membershipsCache = value;
  _membershipsLoading = null;
}

// D-09: Commander + duel_deck only. starter (Welcome Deck 2017, etc.) is
// intentionally excluded — these are intro products, not user-collectable
// precons.
const PRECON_SET_TYPES = ['commander', 'duel_deck'];

// FOLLOWUP-4A (Phase 08.1) — code-level allowlist for confirmed Commander/
// multiplayer precon products that Scryfall classifies under non-commander
// set_types (per .planning/debug/precon-browser-missing-commander-decks.md
// Cause 1). Surgical: NO set_type widening — that would let in ~60 unwanted
// draft/reprint sets like Mystery Booster 2 (mb2), Double Masters 2022 (2x2),
// Dominaria Remastered (dmr).
//
// Coverage:
//   cmm                      Commander Masters (set_type: masters)
//   cmr, clb                 Commander Legends I + II (set_type: draft_innovation)
//   pca, pc2, hop            Planechase (set_type: planechase)
//   arc, e01                 Archenemy (set_type: archenemy)
//   pd2, pd3, h09            Premium Deck Series (set_type: premium_deck)
//   cm1                      Commander's Arsenal (set_type: arsenal)
//   cc1, cc2                 Commander Collection Green/Black (set_type: arsenal)
//   gnt, gn2, gn3            Game Night (set_type: box)
//   pltc                     Tales of Middle-earth Deluxe Commander Kit (set_type: promo)
export const PRECON_EXTRA_CODES = [
  'cmm',
  'clb', 'cmr',
  'pca', 'pc2', 'hop',
  'arc', 'e01',
  'pd2', 'pd3', 'h09',
  'cm1',
  'cc1', 'cc2',
  'gnt', 'gn2', 'gn3',
  'pltc',
];

// FOLLOWUP-4B (Phase 08.1) — multi-deck bundle threshold. Scryfall does not
// expose deck-membership metadata, so several Commander products (Doctor Who
// 1178 cards, Fallout 1068, Warhammer 40K 617, Tales of Middle-earth 591,
// Final Fantasy 486, Commander Masters 1067 once allowlisted) load as a
// single 'set' containing 4-5 separate WotC decks. ADD ALL would dump every
// card from every deck into the user's collection — wrong. The bundle guard
// detects these via decklist length and surfaces a warning state
// (per .planning/debug/precon-browser-missing-commander-decks.md Cause 2).
//
// Picking 200 catches 4-deck bundles cleanly; an older 5-deck product like
// Commander 2013 (356 cards) is also correctly flagged. False negatives
// possible only if Scryfall ever ships a 199-card single deck (none observed).
const MULTI_DECK_BUNDLE_THRESHOLD = 200;

/**
 * FOLLOWUP-4B (Phase 08.1) — bundle detector.
 *
 * Returns true iff the precon's decklist exceeds the multi-deck-bundle
 * threshold (200 cards). Used by precon-browser.js to swap the decklist
 * preview for a 'multi-deck product' warning, and by collection.js
 * addAllFromPrecon to early-return without committing any writes.
 *
 * Defensive: handles missing/null/empty decklists by returning false
 * (a precon with no decklist is not a bundle — it's a load-error state
 * handled separately by preconDecklistError).
 *
 * @param {{ decklist?: Array }} precon
 * @returns {boolean}
 */
export function isMultiDeckBundle(precon) {
  if (!precon || !Array.isArray(precon.decklist)) return false;
  return precon.decklist.length > MULTI_DECK_BUNDLE_THRESHOLD;
}

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
      .filter((s) => PRECON_SET_TYPES.includes(s.set_type) || PRECON_EXTRA_CODES.includes(s.code))
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
        // Phase 14.07c — capture metadata needed to split multi-deck bundles
        // into individual virtual decks (Doctor Who, Fallout, Final Fantasy,
        // Tales of Middle-earth, Warhammer 40K, Commander Masters). Splitting
        // requires color identity to group cards under a commander, plus
        // name/type_line for tile rendering. Older cache entries without
        // these fields fall back to the legacy "MULTI-DECK PRODUCT" gate.
        name: card.name || '',
        color_identity: Array.isArray(card.color_identity) ? card.color_identity : [],
        type_line: card.type_line || '',
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

/**
 * Phase 14.07j — split a multi-deck bundle into the actual WotC decks using
 * the static MTGJSON-sourced membership data in src/data/precon-deck-memberships.json.
 *
 * Earlier iterations (14-07c..e) tried a color-identity heuristic that
 * produced wrong card counts (101/87/43/54 for Final Fantasy instead of
 * 100/100/100/100) because cards that fit multiple decks fell into whichever
 * iterated first. 14-07j replaces the heuristic with deterministic O(1)
 * lookup against MTGJSON's WotC-verified deck lists, regenerated at build
 * time via `npm run sync:precons` (scripts/sync-precon-decks.mjs).
 *
 * Output for each deck is exactly the WotC-published 100-card list.
 *
 * Returns [] when no membership entry exists for the precon's set code so
 * the caller falls back to the 14-07d full-bundle ADD ALL flow.
 *
 * @param {{ code?: string, decklist?: Array }} precon
 * @returns {Array<{ key: string, name: string, identity: string[], identityLabel: string, commanders: Array, cards: Array, total: number }>}
 */
export function splitPreconIntoDecks(precon) {
  const list = precon?.decklist;
  if (!Array.isArray(list) || list.length === 0) return [];

  // The membership data is lazy-loaded — caller (precon-browser) must call
  // loadPreconDeckMemberships() before relying on this function. While the
  // cache is unloaded, return [] so the UI falls back to the full-bundle
  // banner instead of flashing inconsistent state.
  if (!_membershipsCache) return [];

  const code = (precon?.code || '').toLowerCase();
  const bundleMap = (_membershipsCache?.memberships || {})[code];
  if (!bundleMap || Object.keys(bundleMap).length === 0) return [];

  // Phase 14.07k — match by both scryfall_id AND name. Scryfall's
  // unique=prints search returns one row per printing in the focal set;
  // MTGJSON occasionally lists a different printing's id (e.g. bonus-set
  // cards that ride along with the boxed product but live in a sibling
  // Scryfall set). Falling back to name match recovers those, restoring
  // the full 100-card-per-deck count.
  const byId = new Map();
  const byName = new Map();
  const _normName = (s) => (s || '').toLowerCase().trim();
  for (const card of list) {
    if (card?.scryfall_id) byId.set(card.scryfall_id, card);
    if (card?.name) {
      const key = _normName(card.name);
      // Keep the first-seen printing only; we only need a representative
      // card object for downstream UI (the count comes from how many times
      // we push the reference into deckCards).
      if (!byName.has(key)) byName.set(key, card);
    }
  }

  const _idDisplay = (ci) => {
    const sorted = (ci || []).slice().sort();
    return sorted.length === 0 ? 'Colorless' : sorted.join('');
  };

  // Backwards-compat: older membership JSONs (pre-14-07k) stored a flat
  // string[] of scryfall IDs. Newer ones store {id, name}[]. Normalise.
  const _normEntry = (entry) => {
    if (typeof entry === 'string') return { id: entry, name: '' };
    return { id: entry?.id || '', name: entry?.name || '' };
  };

  const decks = [];
  for (const [deckName, rawEntries] of Object.entries(bundleMap)) {
    const deckCards = [];
    const commanders = [];
    const identitySet = new Set();
    for (const entry of (rawEntries || [])) {
      const { id, name } = _normEntry(entry);
      const card = byId.get(id) || byName.get(_normName(name));
      if (!card) continue;
      deckCards.push(card);
      if (card.is_commander) commanders.push(card);
      for (const ci of (card.color_identity || [])) identitySet.add(ci);
    }
    if (deckCards.length === 0) continue;
    const identity = Array.from(identitySet);
    decks.push({
      key: code + '::' + deckName,
      name: deckName,
      identity,
      identityLabel: _idDisplay(identity),
      commanders,
      cards: deckCards,
      total: deckCards.length,
    });
  }

  return decks;
}

function sortPrecons(list) {
  return [...list].sort((a, b) => {
    const d = (b.released_at || '').localeCompare(a.released_at || '');
    return d !== 0 ? d : (a.name || '').localeCompare(b.name || '');
  });
}
