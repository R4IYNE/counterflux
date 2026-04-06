import { db } from '../db/schema.js';

const EDHREC_BASE = 'https://json.edhrec.com';
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

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Counterflux/1.0' },
  });
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

/**
 * Fetch a single card's salt score from EDHREC.
 * @param {string} cardName
 * @returns {Promise<number|null>}
 */
export async function getCardSalt(cardName) {
  const sanitized = sanitizeCommanderName(cardName);

  try {
    // Check cache
    const cached = await db.card_salt_cache.get(sanitized);
    if (cached && Date.now() - cached.fetched_at < CACHE_TTL_MS) {
      return cached.salt;
    }

    // Fetch fresh
    const data = await rateLimitedFetch(`${EDHREC_BASE}/cards/${sanitized}`);
    const salt = data.container?.json_dict?.card?.salt ?? null;

    // Cache
    if (salt !== null) {
      await db.card_salt_cache.put({
        sanitized,
        salt,
        fetched_at: Date.now(),
      });
    }

    return salt;
  } catch {
    return null;
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
