import { db } from '../db/schema.js';
import { queueScryfallRequest } from './scryfall-queue.js';

const SETS_CACHE_KEY = 'scryfall-sets';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RELEVANT_SET_TYPES = ['expansion', 'commander', 'masters', 'core', 'draft_innovation', 'funny'];

let _memoryCache = [];

/**
 * Fetch Scryfall sets with 24h IndexedDB cache.
 * Filters to relevant set types, excludes sub-products (parent_set_code).
 * @returns {Promise<Array<{ code: string, name: string, set_type: string, released_at: string, icon_svg_uri: string, card_count: number }>>}
 */
export async function fetchSets() {
  // Check IndexedDB cache
  const cached = await db.meta.get(SETS_CACHE_KEY);
  if (cached && cached.updated_at && (Date.now() - cached.updated_at) < CACHE_TTL_MS) {
    _memoryCache = cached.data;
    return _memoryCache;
  }

  // Phase 8 Plan 2: route via the rate-limited queue (User-Agent + 100ms
  // spacing enforced in src/services/scryfall-queue.js).
  let json;
  try {
    json = await queueScryfallRequest('https://api.scryfall.com/sets');
  } catch (err) {
    // Fall back to stale cache if available
    if (cached && cached.data) {
      _memoryCache = cached.data;
      return _memoryCache;
    }
    throw new Error(`Failed to fetch sets: ${err.message}`);
  }

  const sets = (json.data || [])
    .filter(s => RELEVANT_SET_TYPES.includes(s.set_type) && !s.parent_set_code)
    .map(s => ({
      code: s.code,
      name: s.name,
      set_type: s.set_type,
      released_at: s.released_at,
      icon_svg_uri: s.icon_svg_uri,
      card_count: s.card_count,
    }));

  // Cache in IndexedDB
  await db.meta.put({
    key: SETS_CACHE_KEY,
    data: sets,
    updated_at: Date.now(),
  });

  _memoryCache = sets;
  return sets;
}

/**
 * Get cached sets from memory (synchronous).
 * Returns [] if fetchSets hasn't been called yet.
 * @returns {Array}
 */
export function getCachedSets() {
  return _memoryCache;
}
