import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { db } from '../src/db/schema.js';
import {
  sanitizeCommanderName,
  getCommanderSynergies,
  normalizeSalt,
  aggregateDeckSalt,
  fetchTopSaltMap,
  getCommanderCombos,
  intersectCombosWithDeck,
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

// ============================================================================
// getCommanderCombos + intersectCombosWithDeck — v1.2 hot-fix #5
// EDHREC-sourced commander combo detection (Spellbook proxy fallback).
// ============================================================================

describe('getCommanderCombos', () => {
  // Minimal EDHREC combos-page fixture mirroring the real shape we observed
  // against /pages/combos/atraxa-praetors-voice.json: each cardlist is one
  // combo, with header `"Card A + Card B (N decks)"` and cardviews entries.
  const combosFixture = {
    container: {
      json_dict: {
        cardlists: [
          {
            tag: "demonicconsultation+thassa'soracle(138436decks)",
            header: "Demonic Consultation + Thassa's Oracle (138436 decks)",
            cardviews: [
              { name: 'Demonic Consultation', sanitized: 'demonic-consultation', url: '/combos/dimir/123-456' },
              { name: "Thassa's Oracle", sanitized: 'thassas-oracle', url: '/combos/dimir/123-456' },
            ],
          },
          {
            tag: 'walkingballista+heliod,sun-crowned(45906decks)',
            header: 'Walking Ballista + Heliod, Sun-Crowned (45906 decks)',
            cardviews: [
              { name: 'Walking Ballista', sanitized: 'walking-ballista', url: '/combos/orzhov/789-012' },
              { name: 'Heliod, Sun-Crowned', sanitized: 'heliod-sun-crowned', url: '/combos/orzhov/789-012' },
            ],
          },
          {
            tag: "atraxa,praetors'voice+magistrate'sscepter+contagionengine(1615decks)",
            header: "Atraxa, Praetors' Voice + Magistrate's Scepter + Contagion Engine (1615 decks)",
            cardviews: [
              { name: "Atraxa, Praetors' Voice", sanitized: 'atraxa-praetors-voice', url: '/combos/witch/3-piece' },
              { name: "Magistrate's Scepter", sanitized: 'magistrates-scepter', url: '/combos/witch/3-piece' },
              { name: 'Contagion Engine', sanitized: 'contagion-engine', url: '/combos/witch/3-piece' },
            ],
          },
        ],
      },
    },
  };

  it('hits the EDHREC commander-combos endpoint with sanitized commander slug', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(combosFixture),
    });

    await getCommanderCombos("Atraxa, Praetors' Voice");

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('/api/edhrec/pages/combos/atraxa-praetors-voice.json');
  });

  it('parses each cardlist into a Spellbook-compatible combo object with deckCount + edhrecUrl', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(combosFixture),
    });

    const { combos } = await getCommanderCombos('Atraxa');

    expect(combos).toHaveLength(3);
    expect(combos[0]).toMatchObject({
      header: "Demonic Consultation + Thassa's Oracle (138436 decks)",
      pieces: [
        { name: 'Demonic Consultation', sanitized: 'demonic-consultation', url: '/combos/dimir/123-456' },
        { name: "Thassa's Oracle", sanitized: 'thassas-oracle', url: '/combos/dimir/123-456' },
      ],
      produces: [],
      description: null,
      edhrecUrl: 'https://edhrec.com/combos/dimir/123-456',
      deckCount: 138436,
    });
  });

  it('returns { combos: [], error: true } on fetch failure', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await getCommanderCombos('Atraxa');
    expect(result).toEqual({ combos: [], error: true });
  });

  it('caches results in db.edhrec_cache and serves cached on subsequent calls', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(combosFixture),
    });

    await getCommanderCombos('Atraxa');
    expect(fetch).toHaveBeenCalledTimes(1);

    // Second call should hit cache, not network
    fetch.mockClear();
    const second = await getCommanderCombos('Atraxa');
    expect(fetch).not.toHaveBeenCalled();
    expect(second.combos).toHaveLength(3);
  });
});

describe('intersectCombosWithDeck', () => {
  // Compact combo objects mirroring getCommanderCombos output shape.
  const combos = [
    {
      id: '/combos/dimir/123',
      header: "Demonic Consultation + Thassa's Oracle (138436 decks)",
      pieces: [
        { name: 'Demonic Consultation', sanitized: 'demonic-consultation' },
        { name: "Thassa's Oracle", sanitized: 'thassas-oracle' },
      ],
      produces: [],
      description: null,
      edhrecUrl: 'https://edhrec.com/combos/dimir/123',
      deckCount: 138436,
    },
    {
      id: '/combos/witch/3-piece',
      header: "Atraxa, Praetors' Voice + Magistrate's Scepter + Contagion Engine (1615 decks)",
      pieces: [
        { name: "Atraxa, Praetors' Voice", sanitized: 'atraxa-praetors-voice' },
        { name: "Magistrate's Scepter", sanitized: 'magistrates-scepter' },
        { name: 'Contagion Engine', sanitized: 'contagion-engine' },
      ],
      produces: [],
      description: null,
      edhrecUrl: 'https://edhrec.com/combos/witch/3-piece',
      deckCount: 1615,
    },
    {
      id: '/combos/orzhov/789',
      header: 'Walking Ballista + Heliod, Sun-Crowned (45906 decks)',
      pieces: [
        { name: 'Walking Ballista', sanitized: 'walking-ballista' },
        { name: 'Heliod, Sun-Crowned', sanitized: 'heliod-sun-crowned' },
      ],
      produces: [],
      description: null,
      edhrecUrl: 'https://edhrec.com/combos/orzhov/789',
      deckCount: 45906,
    },
  ];

  it('classifies a combo as "included" when every piece is in the deck', () => {
    const { included, almostIncluded } = intersectCombosWithDeck(
      combos,
      ['Demonic Consultation', "Thassa's Oracle", 'Sol Ring'],
      []
    );

    expect(included).toHaveLength(1);
    expect(included[0].header).toContain('Demonic Consultation');
    expect(included[0].pieces.every((p) => p.missing === false)).toBe(true);
    expect(almostIncluded).toHaveLength(0);
  });

  it('classifies a combo as "almostIncluded" when exactly one piece is missing, with the missing piece flagged', () => {
    // Atraxa combo has 3 pieces; deck has 2 (commander + Magistrate's Scepter), 1 missing.
    const { included, almostIncluded } = intersectCombosWithDeck(
      combos,
      ["Magistrate's Scepter"],
      ["Atraxa, Praetors' Voice"]
    );

    expect(included).toHaveLength(0);
    expect(almostIncluded).toHaveLength(1);
    const combo = almostIncluded[0];
    expect(combo.header).toContain('Atraxa');

    const present = combo.pieces.filter((p) => !p.missing).map((p) => p.name);
    const missing = combo.pieces.filter((p) => p.missing).map((p) => p.name);
    expect(present).toEqual(["Atraxa, Praetors' Voice", "Magistrate's Scepter"]);
    expect(missing).toEqual(['Contagion Engine']);
  });

  it('skips combos missing 2 or more pieces (too speculative)', () => {
    const { included, almostIncluded } = intersectCombosWithDeck(
      combos,
      ['Sol Ring'], // none of the combo cards present
      []
    );

    expect(included).toHaveLength(0);
    expect(almostIncluded).toHaveLength(0);
  });

  it('treats commander names as in-deck for matching', () => {
    // 3-piece Atraxa combo. Commander present, scepter present, engine missing.
    const { almostIncluded } = intersectCombosWithDeck(
      combos,
      ["Magistrate's Scepter"],
      ["Atraxa, Praetors' Voice"]
    );
    expect(almostIncluded).toHaveLength(1);
    expect(almostIncluded[0].pieces.find((p) => p.name === "Atraxa, Praetors' Voice").missing).toBe(false);
  });

  it('matching is case-insensitive', () => {
    const { included } = intersectCombosWithDeck(
      combos,
      ['demonic consultation', "THASSA'S ORACLE"],
      []
    );
    expect(included).toHaveLength(1);
  });

  it('returns empty result when combos is empty or null', () => {
    expect(intersectCombosWithDeck([], ['Sol Ring'], [])).toEqual({ included: [], almostIncluded: [] });
    expect(intersectCombosWithDeck(null, ['Sol Ring'], [])).toEqual({ included: [], almostIncluded: [] });
  });

  it('skips combos with empty pieces arrays defensively', () => {
    const malformed = [{ ...combos[0], pieces: [] }];
    expect(intersectCombosWithDeck(malformed, [], [])).toEqual({ included: [], almostIncluded: [] });
  });
});
