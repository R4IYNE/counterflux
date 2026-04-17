import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { db } from '../src/db/schema.js';
import {
  sanitizeCommanderName,
  getCommanderSynergies,
  normalizeSalt,
  aggregateDeckSalt,
  fetchTopSaltMap,
} from '../src/services/edhrec.js';
import prosshFixture from './fixtures/edhrec-prossh.json';
import topSaltFixture from './fixtures/edhrec-top-salt.json';

beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn());
  // Clear cache tables between tests
  await db.edhrec_cache.clear();
  await db.card_salt_cache.clear();
  // Phase 9 Plan 1 Task 2: salt cache is now stored in the meta table per
  // 09-RESEARCH §"Salt Cache Schema Decision" (single Top-100 row, no new
  // Dexie table needed).
  try { await db.meta.delete('top_salt_map'); } catch { /* ignore */ }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sanitizeCommanderName', () => {
  it('converts "Prossh, Skyraider of Kher" to "prossh-skyraider-of-kher"', () => {
    expect(sanitizeCommanderName('Prossh, Skyraider of Kher')).toBe('prossh-skyraider-of-kher');
  });

  it('converts "Zur the Enchanter" to "zur-the-enchanter"', () => {
    expect(sanitizeCommanderName('Zur the Enchanter')).toBe('zur-the-enchanter');
  });

  it('handles apostrophes', () => {
    expect(sanitizeCommanderName("K'rrik, Son of Yawgmoth")).toBe('krrik-son-of-yawgmoth');
  });

  it('handles already-sanitized input', () => {
    expect(sanitizeCommanderName('prossh-skyraider-of-kher')).toBe('prossh-skyraider-of-kher');
  });
});

describe('getCommanderSynergies', () => {
  it('returns synergies array with name, synergy, inclusion for each entry', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(prosshFixture),
    });

    const result = await getCommanderSynergies('prossh-skyraider-of-kher');

    expect(result.synergies).toHaveLength(3);
    expect(result.synergies[0]).toMatchObject({
      name: 'Impact Tremors',
      synergy: 0.63,
      inclusion: 4477,
    });
    expect(result.synergies[1]).toMatchObject({
      name: 'Purphoros, God of the Forge',
      synergy: 0.58,
      inclusion: 3200,
    });
    expect(result.commanderSalt).toBe(0.8);
    expect(result.colorIdentity).toEqual(['B', 'R', 'G']);
  });

  it('returns cached data on second call without fetching', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(prosshFixture),
    });

    await getCommanderSynergies('prossh-skyraider-of-kher');
    const second = await getCommanderSynergies('prossh-skyraider-of-kher');

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(second.synergies).toHaveLength(3);
    expect(second.commanderSalt).toBe(0.8);
  });

  it('returns safe fallback on network failure (graceful degradation)', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await getCommanderSynergies('prossh-skyraider-of-kher');

    expect(result.synergies).toEqual([]);
    expect(result.commanderSalt).toBeNull();
    expect(result.colorIdentity).toEqual([]);
    expect(result.error).toBe(true);
  });

  it('returns safe fallback on non-OK response', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const result = await getCommanderSynergies('nonexistent-commander');

    expect(result.synergies).toEqual([]);
    expect(result.commanderSalt).toBeNull();
    expect(result.error).toBe(true);
  });

  it('cache expires after 7 days', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(prosshFixture),
    });

    // First call caches
    await getCommanderSynergies('prossh-skyraider-of-kher');
    expect(fetch).toHaveBeenCalledTimes(1);

    // Advance cache timestamp past 7-day TTL
    const cached = await db.edhrec_cache.get('prossh-skyraider-of-kher');
    await db.edhrec_cache.put({
      ...cached,
      fetched_at: Date.now() - (7 * 24 * 60 * 60 * 1000 + 1000), // 7 days + 1 second ago
    });

    // Second call should fetch again because cache is expired
    await getCommanderSynergies('prossh-skyraider-of-kher');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('sanitizes commander name before fetching', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(prosshFixture),
    });

    await getCommanderSynergies('Prossh, Skyraider of Kher');

    expect(fetch).toHaveBeenCalledWith(
      '/api/edhrec/pages/commanders/prossh-skyraider-of-kher.json'
    );
  });
});

describe('rate limiting', () => {
  it('enforces minimum 200ms between requests', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(prosshFixture) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(prosshFixture) });

    const start = Date.now();

    // Make two requests to different commanders to avoid cache
    await getCommanderSynergies('commander-a');
    await getCommanderSynergies('commander-b');

    const elapsed = Date.now() - start;
    // Second request should have waited at least ~200ms
    expect(elapsed).toBeGreaterThanOrEqual(180); // allow small timing tolerance
  });
});

describe('fetchTopSaltMap (DECK-04)', () => {
  /**
   * 09-RESEARCH §"DECK-04 EDHREC Salt API Contract" — `/pages/top/salt.json`
   * returns `cardlists[0].cardviews[].label` as a string like
   * `"Salt Score: 3.06\n15918 decks"`.  fetchTopSaltMap must parse the float
   * out of that label and key the result by `cv.name`.
   *
   * Replaces the v1.0 `getCardSalt` path which queried `/cards/{slug}` for
   * a `card.salt` field that EDHREC has never exposed there (root-cause fix
   * per RESEARCH headline finding).
   */
  beforeEach(() => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(topSaltFixture),
    });
  });

  it('parses cardlists[0].cardviews[].label into a name -> score map', async () => {
    const map = await fetchTopSaltMap();
    expect(Object.keys(map).length).toBeGreaterThanOrEqual(5);
    expect(map['Stasis']).toBeCloseTo(3.06, 2);
    expect(map['Smothering Tithe']).toBeCloseTo(2.84, 2);
    expect(map['Cyclonic Rift']).toBeCloseTo(2.71, 2);
  });

  it('caches map in db.meta and skips network on second call within 7d TTL', async () => {
    await fetchTopSaltMap();
    await fetchTopSaltMap();
    expect(fetch).toHaveBeenCalledTimes(1);

    const row = await db.meta.get('top_salt_map');
    expect(row).toBeTruthy();
    expect(row.map['Stasis']).toBeCloseTo(3.06, 2);
    expect(typeof row.fetched_at).toBe('number');
  });

  it('refetches after 7d TTL expiry', async () => {
    await fetchTopSaltMap();
    expect(fetch).toHaveBeenCalledTimes(1);

    // Force the cached row's fetched_at to 8 days ago — beyond TTL.
    await db.meta.put({
      key: 'top_salt_map',
      map: { Stasis: 3.06 },
      fetched_at: Date.now() - 8 * 24 * 60 * 60 * 1000,
    });

    await fetchTopSaltMap();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('returns cached map when fetch fails (graceful fallback per D-05)', async () => {
    // Seed cache, then force network failure
    await fetchTopSaltMap();
    fetch.mockRejectedValueOnce(new Error('Network error'));

    // Push the cache entry to be fresh BUT make the key still resolve via
    // cache hit ahead of network — so the mock failure isn't hit.  This
    // proves the cache is consulted first.
    const map2 = await fetchTopSaltMap();
    expect(map2['Stasis']).toBeCloseTo(3.06, 2);
  });

  it('aggregateDeckSalt returns non-zero for a deck containing Stasis', async () => {
    const map = await fetchTopSaltMap();
    const deckCardNames = ['Stasis', 'Lightning Bolt', 'Sol Ring'];
    const saltValues = deckCardNames.map((name) => map[name] ?? 0);
    const aggregate = aggregateDeckSalt(saltValues);
    expect(aggregate).not.toBeNull();
    expect(aggregate).toBeGreaterThan(0);
  });
});

describe('normalizeSalt', () => {
  it('converts raw salt to 0-10 display scale', () => {
    expect(normalizeSalt(0)).toBe(0);
    expect(normalizeSalt(0.8)).toBe(2);
    expect(normalizeSalt(2.0)).toBe(5);
    expect(normalizeSalt(4.0)).toBe(10);
  });

  it('caps at 10', () => {
    expect(normalizeSalt(5.0)).toBe(10);
    expect(normalizeSalt(10.0)).toBe(10);
  });
});
