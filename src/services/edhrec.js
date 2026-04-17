import { db } from '../db/schema.js';

// Proxy through Vite dev server to avoid CORS preflight rejection from CloudFront.
// In production, wire /api/edhrec to a serverless proxy or edge function.
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
