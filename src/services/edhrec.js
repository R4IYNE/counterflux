import { db } from '../db/schema.js';

// EDHREC_BASE serves /api/edhrec/* in both environments:
// dev → Vite proxy (vite.config.js:7-12); prod → Vercel Function (api/edhrec/[...path].js).
const EDHREC_BASE = '/api/edhrec';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const REQUEST_DELAY_MS = 200; // Rate limit: 5 req/sec max

let lastRequestTime = 0;

/**
 * Sanitize a commander name into EDHREC's URL-safe slug format.
 * "Prossh, Skyraider of Kher" -> "prossh-skyraider-of-kher"
 * "K'rrik, Son of Yawgmoth" -> "krrik-son-of-yawgmoth"
 * @param {string} name
 * @returns {string}
 */
export function sanitizeCommanderName(name) {
  return name
    .toLowerCase()
    .replace(/[',]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+$/, '')
    .replace(/^-+/, '');
}

/**
 * Rate-limited fetch wrapper. Enforces minimum REQUEST_DELAY_MS between calls.
 * Returns null on failure (graceful degradation per D-03).
 * @param {string} url
 * @returns {Promise<object|null>}
 */
async function rateLimitedFetch(url) {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < REQUEST_DELAY_MS) {
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();

  // User-Agent is a forbidden header in browsers (silently stripped).
  // EDHREC doesn't require it — safe to omit.
  const res = await fetch(url);
  if (!res.ok) throw new Error(`EDHREC ${res.status}`);
  return res.json();
}

/**
 * Fetch commander synergy data from EDHREC with caching.
 * Returns cached data if within TTL, otherwise fetches fresh.
 * On any error, returns safe fallback (D-03).
 *
 * @param {string} commanderName - Commander name or sanitized slug
 * @returns {Promise<{synergies: Array, commanderSalt: number|null, colorIdentity: string[], error?: boolean}>}
 */
export async function getCommanderSynergies(commanderName) {
  const sanitized = sanitizeCommanderName(commanderName);

  try {
    // Check cache
    const cached = await db.edhrec_cache.get(sanitized);
    if (cached && Date.now() - cached.fetched_at < CACHE_TTL_MS) {
      return cached.data;
    }

    // Fetch fresh
    const data = await rateLimitedFetch(
      `${EDHREC_BASE}/pages/commanders/${sanitized}.json`
    );

    // Extract high synergy cards
    const cardlists = data.container?.json_dict?.cardlists || [];
    const highSynergy =
      cardlists.find((cl) => cl.tag === 'highsynergycards')?.cardviews || [];

    const result = {
      synergies: highSynergy.map((cv) => ({
        name: cv.name,
        synergy: cv.synergy,
        inclusion: cv.inclusion,
        num_decks: cv.num_decks,
        url: cv.url,
        sanitized: cv.sanitized,
      })),
      commanderSalt: data.container?.json_dict?.card?.salt ?? null,
      colorIdentity: data.container?.json_dict?.card?.color_identity || [],
    };

    // Cache result
    await db.edhrec_cache.put({
      commander: sanitized,
      data: result,
      fetched_at: Date.now(),
    });

    return result;
  } catch {
    return { synergies: [], commanderSalt: null, colorIdentity: [], error: true };
  }
}

// === Top-Saltiest bulk fetch (DECK-04 root-cause fix) =====================
//
// 09-RESEARCH headline finding: the v1.0 `getCardSalt(name)` path queried
// `/pages/cards/{slug}.json` for a `container.json_dict.card.salt` field
// that EDHREC has NEVER returned at that location.  Per direct HTTP probe
// during research:
//
//   • `/pages/commanders/{slug}.json` → carries the COMMANDER's own salt
//     under `container.json_dict.card.salt` (already consumed via
//     getCommanderSynergies above).
//   • `/pages/cards/{slug}.json` → no `card.salt`; only `similar[].salt`
//     for the card-page's related-card list.
//   • `/pages/top/salt.json` → returns the canonical Top-100 saltiest
//     cards as `cardlists[0].cardviews[]`, with each entry's `label`
//     formatted as the string `"Salt Score: 3.06\n15918 decks"`.  This
//     is the only endpoint that exposes per-card salt in a usable form.
//
// We fetch the Top-100 ONCE per 7d, parse it into a name → score map,
// and cache the whole map in the existing `meta` table (per 09-RESEARCH
// §"Salt Cache Schema Decision" — single row, no schema bump, mirrors
// the edhrec_cache + combo_cache "one fetch one row" philosophy).
//
// Cards outside the Top-100 carry effectively zero salt (< ~0.4 in the
// EDHREC database) and are treated as 0 in deck aggregates.
//
// The legacy `getCardSalt` function is REMOVED (was structurally broken,
// never returned non-null in any production scenario).
const TOP_SALT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOP_SALT_META_KEY = 'top_salt_map';

/**
 * Fetch EDHREC's Top-100 Saltiest cards as a name → raw salt-score map.
 * Cached for 7 days in the meta table (key: 'top_salt_map').
 *
 * @returns {Promise<Record<string, number>>} name → raw salt score (0..~3)
 */
export async function fetchTopSaltMap() {
  // Cache hit?
  let cached = null;
  try {
    cached = await db.meta.get(TOP_SALT_META_KEY);
  } catch {
    // db.meta unavailable in some contexts; fall through to network
  }
  if (cached && cached.map && (Date.now() - cached.fetched_at) < TOP_SALT_TTL_MS) {
    return cached.map;
  }

  try {
    const data = await rateLimitedFetch(`${EDHREC_BASE}/pages/top/salt.json`);
    const cardviews = data?.container?.json_dict?.cardlists?.[0]?.cardviews ?? [];
    const map = {};
    for (const cv of cardviews) {
      const label = cv.label || '';
      const m = label.match(/Salt Score:\s*([\d.]+)/);
      if (m && cv.name) {
        map[cv.name] = parseFloat(m[1]);
      }
    }
    try {
      await db.meta.put({ key: TOP_SALT_META_KEY, map, fetched_at: Date.now() });
    } catch {
      // Cache write failure is non-fatal — return the fresh map anyway.
    }
    return map;
  } catch {
    // Network failure with no cache → empty map (Mila stays quiet).
    // Network failure WITH cache (even stale) → keep serving stale per D-05.
    return (cached && cached.map) ? cached.map : {};
  }
}

/**
 * Normalize raw EDHREC salt score (typically 0-4) to a 0-10 display scale.
 * @param {number|null} rawSalt
 * @returns {number}
 */
export function normalizeSalt(rawSalt) {
  if (rawSalt == null || isNaN(rawSalt)) return 0;
  return Math.min(10, Math.round(rawSalt * 2.5));
}

/**
 * Aggregate deck salt score from individual card salt values.
 * Computes arithmetic mean then normalizes to 0-10 scale.
 * @param {Array<number|null|undefined>} saltValues
 * @returns {number|null}
 */
export function aggregateDeckSalt(saltValues) {
  const valid = (saltValues || []).filter(
    (v) => v !== null && v !== undefined && !isNaN(v)
  );
  if (valid.length === 0) return null;
  const mean = valid.reduce((sum, v) => sum + v, 0) / valid.length;
  return normalizeSalt(mean);
}

// === Commander combos (v1.2 hot-fix #5 — Spellbook proxy fallback) ===
//
// EDHREC's `/pages/combos/{commander-slug}.json` endpoint returns the canonical
// list of known combos that involve a given commander. Each combo arrives as a
// `cardlist` entry whose `tag` and `header` encode the participating cards +
// deck-count popularity, e.g.:
//
//   tag:    "demonicconsultation+thassa'soracle(138436decks)"
//   header: "Demonic Consultation + Thassa's Oracle (138436 decks)"
//   cardviews: [{name, sanitized, url, id}, ...]
//
// `cardview.url` looks like `/combos/golgari/1529-1887` and resolves to the
// EDHREC combo page where the user can read the produces / prerequisites /
// description (Spellbook-equivalent metadata that EDHREC doesn't surface in
// the JSON). We expose `edhrecUrl: "https://edhrec.com${cv.url}"` so the UI
// can link out.
//
// What this replaces: SEED-004 captures the full story — Spellbook's
// /find-my-combos returns HTTP 400 when proxied through Vercel (root cause
// not isolated yet). Until SEED-004 is closed, EDHREC commander-combos provide
// 70-80% of Spellbook's value (included + almost-included detection from the
// commander's combo list, computed client-side via intersectCombosWithDeck).
// What's missing: combos that don't involve the commander, structured
// "produces" metadata (infinite mana / damage / etc.), and combo descriptions.

const COMBOS_TTL_MS = 24 * 60 * 60 * 1000; // 24h — combos shift slowly

/**
 * Parse an EDHREC combo cardlist tag's deck-count footer.
 * Extracts the integer from "(NNNNdecks)" suffix. Returns 0 if missing.
 * @param {string} tagOrHeader
 * @returns {number}
 */
function parseDeckCount(tagOrHeader) {
  const m = (tagOrHeader || '').match(/\((\d+)\s*decks?\)/i);
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * Fetch the EDHREC commander-combos list.
 *
 * @param {string} commanderName Commander display name; sanitized internally.
 * @returns {Promise<{combos: Array, error?: boolean}>}
 *   combos: [{
 *     id,           // EDHREC combo path (used as stable key)
 *     header,       // human-readable "Card A + Card B (N decks)"
 *     pieces,       // [{ name, sanitized, url }] — Spellbook-compatible shape
 *     produces,     // [] — EDHREC doesn't expose; UI falls through to "COMBO" default
 *     description,  // null
 *     edhrecUrl,    // absolute URL to the combo page on edhrec.com
 *     deckCount,    // popularity (decks running the combo)
 *   }]
 */
export async function getCommanderCombos(commanderName) {
  const sanitized = sanitizeCommanderName(commanderName);

  try {
    const cached = await db.edhrec_cache.get('combos:' + sanitized);
    if (cached && Date.now() - cached.fetched_at < COMBOS_TTL_MS) {
      return cached.data;
    }

    const data = await rateLimitedFetch(
      `${EDHREC_BASE}/pages/combos/${sanitized}.json`
    );
    const cardlists = data?.container?.json_dict?.cardlists ?? [];

    const combos = cardlists.map((cl) => {
      const cardviews = cl.cardviews ?? [];
      const firstUrl = cardviews[0]?.url || '';
      // EDHREC returns paths like `/combos/golgari/1529-1887` — make absolute.
      const edhrecUrl = firstUrl.startsWith('/')
        ? `https://edhrec.com${firstUrl}`
        : firstUrl;
      return {
        id: firstUrl || cl.tag, // fallback to tag if url missing
        header: cl.header || cl.tag,
        pieces: cardviews.map((cv) => ({
          name: cv.name,
          sanitized: cv.sanitized,
          url: cv.url,
        })),
        produces: [],
        description: null,
        edhrecUrl,
        deckCount: parseDeckCount(cl.header || cl.tag),
      };
    });

    // EDHREC returns combos in deck-count order already; preserve that order
    // so most-popular surfaces first when we slice for the panel.

    const result = { combos };

    try {
      await db.edhrec_cache.put({
        commander: 'combos:' + sanitized,
        data: result,
        fetched_at: Date.now(),
      });
    } catch {
      // Cache write failure is non-fatal.
    }

    return result;
  } catch {
    return { combos: [], error: true };
  }
}

/**
 * Classify EDHREC combos against a deck's card list.
 *
 * - included: every piece of the combo is in the deck (commander counts).
 * - almostIncluded: exactly one piece is missing — the deckbuilder action is
 *   "add this one card and the combo lights up." Combos missing 2+ cards are
 *   filtered out (too speculative; would clutter the panel).
 *
 * Pieces in `almostIncluded` carry `missing: boolean` to let the UI render the
 * red "+ Card Name" affordance for the gap, matching the existing Spellbook
 * combo panel shape exactly.
 *
 * Card name matching is done on the lowercase exact name. EDHREC uses the
 * canonical Scryfall display name in `cardview.name`, so direct comparison
 * against deck card names works for the 99 + commander.
 *
 * @param {Array} combos Output of getCommanderCombos().combos
 * @param {string[]} deckCardNames All non-commander card names in the deck
 * @param {string[]} commanderNames Commander + partner (always "in deck")
 * @returns {{ included: Array, almostIncluded: Array }}
 */
export function intersectCombosWithDeck(combos, deckCardNames, commanderNames = []) {
  const inDeck = new Set([
    ...commanderNames.map((n) => (n || '').toLowerCase()),
    ...deckCardNames.map((n) => (n || '').toLowerCase()),
  ]);
  inDeck.delete(''); // strip blank entries

  const included = [];
  const almostIncluded = [];

  for (const combo of combos || []) {
    const pieces = combo.pieces || [];
    if (pieces.length === 0) continue;

    let presentCount = 0;
    for (const piece of pieces) {
      if (inDeck.has((piece.name || '').toLowerCase())) presentCount++;
    }

    if (presentCount === pieces.length) {
      included.push({ ...combo, pieces: pieces.map((p) => ({ ...p, missing: false })) });
    } else if (presentCount === pieces.length - 1) {
      almostIncluded.push({
        ...combo,
        pieces: pieces.map((p) => ({
          ...p,
          missing: !inDeck.has((p.name || '').toLowerCase()),
        })),
      });
    }
    // 2+ missing: skip (too speculative, would flood the panel)
  }

  return { included, almostIncluded };
}
