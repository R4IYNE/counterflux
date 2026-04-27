/**
 * COLLECT-02 core: src/services/precons.js — Scryfall /sets orchestration.
 *
 * Exports:
 *   - fetchPrecons({ forceRefresh })  — list + filter + sort + cache
 *   - fetchPreconDecklist(code)       — paginate set's search_uri, is_commander
 *   - invalidatePreconsCache()        — clear Dexie
 *
 * Tests assert:
 *   - Filters to commander + duel_deck (excludes expansion, core, starter per D-09)
 *   - Sorts released_at DESC, tiebreak name ASC (D-12)
 *   - 7-day TTL cache (D-11) — second call within TTL skips fetch
 *   - forceRefresh bypasses cache
 *   - Falls back to stale cache on fetch error
 *   - fetchPreconDecklist paginates has_more/next_page
 *   - is_commander flagged for legendary creatures (type_line contains 'Legendary' + 'Creature')
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockSetsResponse, mockDecklistPages } from './fixtures/scryfall-precons.js';

// Stub alpinejs so importing downstream modules doesn't trigger Alpine init
const __alpineStores = {};
vi.mock('alpinejs', () => ({
  default: {
    store(name, obj) {
      if (obj === undefined) return __alpineStores[name];
      __alpineStores[name] = obj;
      return __alpineStores[name];
    },
  },
}));

describe('COLLECT-02: src/services/precons.js', () => {
  let fetchMock;

  beforeEach(async () => {
    for (const k of Object.keys(__alpineStores)) delete __alpineStores[k];

    // Reset scryfall-queue internal state
    const queueMod = await import('../src/services/scryfall-queue.js');
    if (typeof queueMod.__resetQueueForTests === 'function') {
      queueMod.__resetQueueForTests();
    }

    // Clear the Dexie precons_cache table between tests
    const { db } = await import('../src/db/schema.js');
    if (db.tables.find((t) => t.name === 'precons_cache')) {
      await db.precons_cache.clear();
    }

    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Test 1 — fetchPrecons calls queueScryfallRequest(/sets), filters, sorts DESC', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockSetsResponse,
    });
    const { fetchPrecons } = await import('../src/services/precons.js');
    const precons = await fetchPrecons();

    // D-09 + FOLLOWUP-4A (Phase 08.1): commander + duel_deck PLUS allowlist
    // codes (cmm, clb, pca, arc, pltc) — 4 baseline + 5 allowlist = 9 rows.
    // Non-precons (expansion, core, starter) and mb2 (set_type masters but NOT
    // allowlisted) are still filtered out.
    expect(precons).toHaveLength(9);
    const setTypes = new Set(precons.map((p) => p.set_type));
    expect(setTypes).toEqual(new Set(['commander', 'duel_deck', 'masters', 'draft_innovation', 'planechase', 'archenemy', 'promo']));

    // D-12: sorted released_at DESC
    expect(precons[0].released_at).toBe('2023-09-08'); // woc (newest)
    expect(precons[0].code).toBe('woc');

    // Last should be the oldest — dd2 (2008-11-07) is older than arc (2010-06-18).
    expect(precons[precons.length - 1].code).toBe('dd2'); // 2008-11-07
  });

  it('Test 2 — second call within 7-day TTL returns cache, does NOT re-fetch', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockSetsResponse,
    });
    const { fetchPrecons } = await import('../src/services/precons.js');
    await fetchPrecons();
    const callsAfterFirst = fetchMock.mock.calls.length;
    expect(callsAfterFirst).toBe(1);

    // Second call within TTL — no new fetch
    await fetchPrecons();
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
  });

  it('Test 3 — forceRefresh re-fetches even if cache is fresh', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSetsResponse,
    });
    const { fetchPrecons } = await import('../src/services/precons.js');
    await fetchPrecons();
    expect(fetchMock.mock.calls.length).toBe(1);

    await fetchPrecons({ forceRefresh: true });
    expect(fetchMock.mock.calls.length).toBe(2);
  });

  it('Test 4 — falls back to stale cache on fetch error', async () => {
    // Prime the cache with a successful fetch
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockSetsResponse,
    });
    const { fetchPrecons } = await import('../src/services/precons.js');
    const first = await fetchPrecons();
    expect(first).toHaveLength(9);

    // Force a refresh that fails — must fall back to stale cache
    fetchMock.mockRejectedValueOnce(new Error('Network down'));
    const stale = await fetchPrecons({ forceRefresh: true });
    expect(stale).toHaveLength(9);
    // Still sorted
    expect(stale[0].code).toBe('woc');
  });

  it('Test 5 — fetchPreconDecklist paginates + marks is_commander via type_line heuristic', async () => {
    // Prime the cache first (needed to know the search_uri for woc)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockSetsResponse,
    });
    const { fetchPrecons, fetchPreconDecklist } = await import('../src/services/precons.js');
    await fetchPrecons();

    // Two pages for woc (has_more: true, then has_more: false)
    const wocPages = mockDecklistPages('woc');
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => wocPages[0] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => wocPages[1] });

    const decklist = await fetchPreconDecklist('woc');
    // Should accumulate both pages: 2 + 1 = 3 cards
    expect(decklist).toHaveLength(3);

    // Pitfall 5: type_line 'Legendary Creature — Faerie Rogue' → is_commander: true
    const commander = decklist.find((e) => e.scryfall_id === 'woc-001');
    expect(commander).toBeDefined();
    expect(commander.is_commander).toBe(true);

    // Non-legendary creature → is_commander: false
    const nonCommander = decklist.find((e) => e.scryfall_id === 'woc-002');
    expect(nonCommander).toBeDefined();
    expect(nonCommander.is_commander).toBe(false);
  });

  it('Test 6 — fetchPreconDecklist caches: second call within TTL skips fetch', async () => {
    // Prime precons cache
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockSetsResponse,
    });
    const { fetchPrecons, fetchPreconDecklist } = await import('../src/services/precons.js');
    await fetchPrecons();

    const cmmPages = mockDecklistPages('cmm');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => cmmPages[0],
    });
    const first = await fetchPreconDecklist('cmm');
    expect(first.length).toBeGreaterThan(0);
    const callCountAfterFirst = fetchMock.mock.calls.length;

    // Second call should NOT hit fetch
    const second = await fetchPreconDecklist('cmm');
    expect(second.length).toBe(first.length);
    expect(fetchMock.mock.calls.length).toBe(callCountAfterFirst);
  });
});

describe('FOLLOWUP-4A: PRECON_EXTRA_CODES allowlist (Phase 08.1)', () => {
  let fetchMock;

  beforeEach(async () => {
    for (const k of Object.keys(__alpineStores)) delete __alpineStores[k];
    const queueMod = await import('../src/services/scryfall-queue.js');
    if (typeof queueMod.__resetQueueForTests === 'function') queueMod.__resetQueueForTests();
    const { db } = await import('../src/db/schema.js');
    if (db.tables.find((t) => t.name === 'precons_cache')) await db.precons_cache.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.restoreAllMocks());

  it('Test A1 — cmm (set_type masters, reclassified) is included via allowlist', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockSetsResponse });
    const { fetchPrecons } = await import('../src/services/precons.js');
    const precons = await fetchPrecons();
    expect(precons.find((p) => p.code === 'cmm')).toBeDefined();
  });

  it('Test A2 — clb / pca / arc / pltc (non-commander set_types) all included', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockSetsResponse });
    const { fetchPrecons } = await import('../src/services/precons.js');
    const codes = (await fetchPrecons()).map((p) => p.code);
    expect(codes).toContain('clb');
    expect(codes).toContain('pca');
    expect(codes).toContain('arc');
    expect(codes).toContain('pltc');
  });

  it('Test A3 — mb2 (set_type masters but NOT in allowlist) is filtered out', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockSetsResponse });
    const { fetchPrecons } = await import('../src/services/precons.js');
    const codes = (await fetchPrecons()).map((p) => p.code);
    expect(codes).not.toContain('mb2');
  });

  it('Test A4 — total count = baseline (commander+duel_deck) + 5 allowlist additions', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockSetsResponse });
    const { fetchPrecons } = await import('../src/services/precons.js');
    const precons = await fetchPrecons();
    // After cmm reclassification: baseline = 4 (woc, ltc commander + dd2, ddu duel_deck)
    // Allowlist additions = 5 (cmm now via allowlist, plus clb, pca, arc, pltc)
    // Total = 9. mb2 (masters, not allowlisted) is correctly filtered out.
    expect(precons).toHaveLength(9);
  });

  it('Test A5 — PRECON_EXTRA_CODES export shape', async () => {
    const { PRECON_EXTRA_CODES } = await import('../src/services/precons.js');
    expect(Array.isArray(PRECON_EXTRA_CODES)).toBe(true);
    expect(new Set(PRECON_EXTRA_CODES)).toEqual(new Set([
      'cmm', 'clb', 'cmr', 'cm1', 'cc1', 'cc2',
      'pd2', 'pd3', 'h09', 'pca', 'pc2', 'hop',
      'arc', 'e01', 'pltc', 'gnt', 'gn2', 'gn3',
    ]));
    expect(PRECON_EXTRA_CODES).toHaveLength(18);
  });
});

describe('FOLLOWUP-4B: isMultiDeckBundle helper (Phase 08.1)', () => {
  it('returns true when decklist.length > 200', async () => {
    const { isMultiDeckBundle } = await import('../src/services/precons.js');
    expect(isMultiDeckBundle({ decklist: new Array(201).fill({}) })).toBe(true);
    expect(isMultiDeckBundle({ decklist: new Array(500).fill({}) })).toBe(true);
  });

  it('returns false at or below 200 cards', async () => {
    const { isMultiDeckBundle } = await import('../src/services/precons.js');
    expect(isMultiDeckBundle({ decklist: new Array(200).fill({}) })).toBe(false);
    expect(isMultiDeckBundle({ decklist: new Array(99).fill({}) })).toBe(false);
    expect(isMultiDeckBundle({ decklist: [] })).toBe(false);
  });

  it('returns false on missing/null/empty inputs', async () => {
    const { isMultiDeckBundle } = await import('../src/services/precons.js');
    expect(isMultiDeckBundle(null)).toBe(false);
    expect(isMultiDeckBundle(undefined)).toBe(false);
    expect(isMultiDeckBundle({})).toBe(false);
    expect(isMultiDeckBundle({ decklist: null })).toBe(false);
  });
});

// Phase 14.07e — splitPreconIntoDecks now consumes a curated WotC deck-name
// manifest in src/data/precon-deck-manifests.js. Returns [] for products
// without a manifest (caller falls back to full-bundle ADD ALL).
describe('Phase 14.07e: splitPreconIntoDecks (manifest-driven)', () => {
  function _commander(name, ci, id = name.toLowerCase().replace(/[^a-z]+/g, '-')) {
    return { scryfall_id: id, quantity: 1, is_commander: true, name, color_identity: ci, type_line: 'Legendary Creature' };
  }
  function _support(name, ci, id = name.toLowerCase().replace(/[^a-z]+/g, '-')) {
    return { scryfall_id: id, quantity: 1, is_commander: false, name, color_identity: ci, type_line: 'Creature' };
  }

  it('returns [] when decklist has no color_identity metadata (legacy cache)', async () => {
    const { splitPreconIntoDecks } = await import('../src/services/precons.js');
    const legacyDecklist = [
      { scryfall_id: 'a', quantity: 1, is_commander: true },
      { scryfall_id: 'b', quantity: 1, is_commander: false },
    ];
    expect(splitPreconIntoDecks({ code: 'fin', decklist: legacyDecklist })).toEqual([]);
  });

  it('returns [] when there is no manifest entry for this set code', async () => {
    const { splitPreconIntoDecks } = await import('../src/services/precons.js');
    const decklist = [_commander('Some Commander', ['R'])];
    expect(splitPreconIntoDecks({ code: 'unknown-set', decklist })).toEqual([]);
  });

  it('returns [] when manifest exists but no manifest commanders are in the decklist', async () => {
    const { splitPreconIntoDecks } = await import('../src/services/precons.js');
    // 'fin' manifest expects Cloud / Tifa / Aerith / etc. Decklist has none.
    const decklist = [_commander('Random Commander', ['R'])];
    expect(splitPreconIntoDecks({ code: 'fin', decklist })).toEqual([]);
  });

  it('builds named decks from the fin manifest and assigns supporters by subset match', async () => {
    const { splitPreconIntoDecks } = await import('../src/services/precons.js');
    const decklist = [
      // Limit Break (Cloud + Tifa) — give them a shared mono-W identity for the test
      _commander('Cloud, Ex-SOLDIER', ['W']),
      _commander('Tifa, Martial Artist', ['W']),
      // Revival Trance (Aerith + Sephiroth) — GW
      _commander('Aerith, Last Ancient', ['G', 'W']),
      _commander('Sephiroth, Fabled SOLDIER', ['G', 'W']),
      // Counter Blow (Tidus + Yuna)
      _commander('Tidus, Yuna’s Guardian', ['U']),
      _commander('Yuna, Grand Summoner', ['U']),
      // Scions & Spellcraft (Y'shtola + G'raha) — straight + curly apostrophes to test normalisation
      _commander("Y'shtola, Night's Blessed", ['B']),
      _commander('G’raha Tia, Scion Reborn', ['B']),
      _support('Plains', []),
      _support('Cultivate', ['G']),
    ];

    const decks = splitPreconIntoDecks({ code: 'fin', decklist });
    expect(decks).toHaveLength(4);
    const names = decks.map(d => d.name);
    expect(names).toEqual(['Limit Break', 'Revival Trance', 'Counter Blow', 'Scions & Spellcraft']);

    const limitBreak = decks.find(d => d.name === 'Limit Break');
    expect(limitBreak.commanders.map(c => c.name).sort()).toEqual(['Cloud, Ex-SOLDIER', 'Tifa, Martial Artist']);

    const revival = decks.find(d => d.name === 'Revival Trance');
    // GW union → cultivate (G) fits
    expect(revival.cards.some(c => c.name === 'Cultivate')).toBe(true);

    // Smart-quote tolerance worked
    const scions = decks.find(d => d.name === 'Scions & Spellcraft');
    expect(scions.commanders).toHaveLength(2);
  });

  it('skips manifest decks whose commanders are not in the cache yet (graceful degradation)', async () => {
    const { splitPreconIntoDecks } = await import('../src/services/precons.js');
    const decklist = [
      _commander('Cloud, Ex-SOLDIER', ['W']),
      _commander('Tifa, Martial Artist', ['W']),
      // None of the other 3 decks' commanders are in the decklist
      _support('Plains', []),
    ];
    const decks = splitPreconIntoDecks({ code: 'fin', decklist });
    expect(decks).toHaveLength(1);
    expect(decks[0].name).toBe('Limit Break');
  });

  it('caps each manifest deck at 100 cards (1 commander + 99 supporters)', async () => {
    const { splitPreconIntoDecks } = await import('../src/services/precons.js');
    const supporters = [];
    for (let i = 0; i < 150; i++) supporters.push(_support('Card ' + i, ['W'], 'sup-' + i));
    const decklist = [
      _commander('Cloud, Ex-SOLDIER', ['W']),
      _commander('Tifa, Martial Artist', ['W']),
      ...supporters,
    ];
    const decks = splitPreconIntoDecks({ code: 'fin', decklist });
    expect(decks).toHaveLength(1);
    // 2 commanders + up to 99 supporters
    expect(decks[0].cards.filter(c => !c.is_commander).length).toBeLessThanOrEqual(99);
    expect(decks[0].cards.length).toBeLessThanOrEqual(101);
  });
});
