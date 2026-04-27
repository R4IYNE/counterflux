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

// Phase 14.07j — splitPreconIntoDecks now consumes the static MTGJSON
// membership data at src/data/precon-deck-memberships.json. Returns []
// for products without a membership entry (caller falls back to
// full-bundle ADD ALL). Tests use vi.doMock to inject synthetic
// membership data so they don't depend on real WotC product IDs.
describe('Phase 14.07j: splitPreconIntoDecks (MTGJSON membership-driven)', () => {
  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../src/services/precons.js');
    mod.__setPreconDeckMembershipsForTests({
      memberships: {
        fic: {
          'Limit Break (FINAL FANTASY VII)': [
            { id: 'fic-1-cloud', name: 'Cloud, Ex-SOLDIER' },
            { id: 'fic-1-tifa', name: 'Tifa, Martial Artist' },
            { id: 'fic-1-c1', name: 'Lightning Bolt' },
            { id: 'fic-1-c2', name: 'Plains' },
          ],
          'Revival Trance (FINAL FANTASY VI)': [
            { id: 'fic-2-terra', name: 'Terra, Herald of Hope' },
            { id: 'fic-2-celes', name: 'Celes, Rune Knight' },
            { id: 'fic-2-c1', name: 'Cultivate' },
          ],
        },
      },
    });
  });
  afterEach(async () => {
    const mod = await import('../src/services/precons.js');
    mod.__setPreconDeckMembershipsForTests(null);
  });

  function _card(id, name, isCommander = false, ci = []) {
    return { scryfall_id: id, quantity: 1, is_commander: isCommander, name, color_identity: ci, type_line: isCommander ? 'Legendary Creature' : 'Creature' };
  }

  it('returns [] when decklist is empty or missing', async () => {
    const { splitPreconIntoDecks } = await import('../src/services/precons.js');
    expect(splitPreconIntoDecks({ code: 'fic', decklist: [] })).toEqual([]);
    expect(splitPreconIntoDecks({ code: 'fic' })).toEqual([]);
  });

  it('returns [] when set code has no membership entry', async () => {
    const { splitPreconIntoDecks } = await import('../src/services/precons.js');
    const decklist = [_card('x-1', 'Some Card')];
    expect(splitPreconIntoDecks({ code: 'unknown-set', decklist })).toEqual([]);
  });

  it('builds decks by exact-id lookup against the membership map', async () => {
    const { splitPreconIntoDecks } = await import('../src/services/precons.js');
    const decklist = [
      _card('fic-1-cloud', 'Cloud, Ex-SOLDIER', true, ['W']),
      _card('fic-1-tifa', 'Tifa, Martial Artist', false, ['W', 'R']),
      _card('fic-1-c1', 'Lightning Bolt', false, ['R']),
      _card('fic-1-c2', 'Plains', false, []),
      _card('fic-2-terra', 'Terra, Herald of Hope', true, ['W']),
      _card('fic-2-celes', 'Celes, Rune Knight', false, ['W']),
      _card('fic-2-c1', 'Cultivate', false, ['G']),
      _card('unrelated', 'Random Card', false, ['B']),
    ];
    const decks = splitPreconIntoDecks({ code: 'fic', decklist });
    expect(decks).toHaveLength(2);

    const limitBreak = decks.find(d => d.name.includes('Limit Break'));
    expect(limitBreak.cards).toHaveLength(4);
    expect(limitBreak.cards.map(c => c.scryfall_id).sort())
      .toEqual(['fic-1-c1', 'fic-1-c2', 'fic-1-cloud', 'fic-1-tifa']);
    expect(limitBreak.commanders.map(c => c.name)).toContain('Cloud, Ex-SOLDIER');

    const revival = decks.find(d => d.name.includes('Revival Trance'));
    expect(revival.cards).toHaveLength(3);
    expect(revival.cards.map(c => c.scryfall_id).sort())
      .toEqual(['fic-2-c1', 'fic-2-celes', 'fic-2-terra']);

    // Identity union: Limit Break has W (Cloud) + WR (Tifa) + R (Bolt) + colorless (Plains) → RW
    expect(limitBreak.identityLabel).toBe('RW');
    expect(revival.identityLabel).toBe('GW');
  });

  it('Phase 14.07L — keeps tile entries for decks with no local matches; total comes from MTGJSON, cards is empty', async () => {
    const { splitPreconIntoDecks } = await import('../src/services/precons.js');
    const decklist = [
      _card('fic-1-cloud', 'Cloud, Ex-SOLDIER', true, ['W']),
      _card('fic-1-tifa', 'Tifa, Martial Artist', false, ['W']),
      _card('fic-1-c1', 'Lightning Bolt', false, ['R']),
      _card('fic-1-c2', 'Plains', false, []),
      // None of fic-2's cards are in the decklist
    ];
    const decks = splitPreconIntoDecks({ code: 'fic', decklist });
    // Both decks render so the user sees the full bundle structure;
    // Revival Trance just has cards: [] for preview. ADD ALL still works
    // via scryfallIds.
    expect(decks).toHaveLength(2);
    const revival = decks.find(d => d.name.includes('Revival Trance'));
    expect(revival.cards).toHaveLength(0);
    expect(revival.scryfallIds).toHaveLength(3);
    expect(revival.total).toBe(3);
  });

  it('only includes cards in `cards` that exist in BOTH the membership list AND the decklist', async () => {
    const { splitPreconIntoDecks } = await import('../src/services/precons.js');
    // Decklist has only 2 of the 4 IDs the membership lists for Limit Break.
    const decklist = [
      _card('fic-1-cloud', 'Cloud, Ex-SOLDIER', true, ['W']),
      _card('fic-1-c1', 'Lightning Bolt', false, ['R']),
      _card('fic-2-terra', 'Terra, Herald of Hope', true, ['W']),
      _card('fic-2-celes', 'Celes, Rune Knight', false, ['W']),
      _card('fic-2-c1', 'Cultivate', false, ['G']),
    ];
    const decks = splitPreconIntoDecks({ code: 'fic', decklist });
    const limitBreak = decks.find(d => d.name.includes('Limit Break'));
    // `cards` is the locally-renderable subset (2 of 4)
    expect(limitBreak.cards).toHaveLength(2);
    expect(limitBreak.cards.map(c => c.scryfall_id).sort()).toEqual(['fic-1-c1', 'fic-1-cloud']);
    // Phase 14.07L — `scryfallIds` is the FULL MTGJSON id list (all 4),
    // and `total` reflects the WotC-published count regardless of local
    // cache misses. ADD ALL uses scryfallIds, tile shows total.
    expect(limitBreak.scryfallIds).toEqual(['fic-1-cloud', 'fic-1-tifa', 'fic-1-c1', 'fic-1-c2']);
    expect(limitBreak.total).toBe(4);
  });

  it('Phase 14.07L — total + scryfallIds reflect MTGJSON truth even when local cache misses bonus-set cards', async () => {
    const { splitPreconIntoDecks } = await import('../src/services/precons.js');
    // Decklist completely missing fic-1-tifa AND fic-1-c2 (no name fallback either).
    const decklist = [
      _card('fic-1-cloud', 'Cloud, Ex-SOLDIER', true, ['W']),
      _card('fic-1-c1', 'Lightning Bolt', false, ['R']),
    ];
    const decks = splitPreconIntoDecks({ code: 'fic', decklist });
    const limitBreak = decks.find(d => d.name.includes('Limit Break'));
    expect(limitBreak.cards).toHaveLength(2); // local subset
    expect(limitBreak.scryfallIds).toHaveLength(4); // MTGJSON truth
    expect(limitBreak.total).toBe(4);
  });

  // Phase 14.07k — name fallback. MTGJSON sometimes lists a different
  // printing's scryfall_id than the local Scryfall search returns
  // (bonus-set basics, alt-art, etc.). Falling back to name match
  // recovers those so the deck count stays honest.
  it('falls back to name match when the scryfall_id misses (different printing)', async () => {
    const { splitPreconIntoDecks } = await import('../src/services/precons.js');
    // MTGJSON expects fic-1-c2 (Plains printing A); local cache has plains-printing-B.
    // Name "Plains" should match across printings.
    const decklist = [
      _card('fic-1-cloud', 'Cloud, Ex-SOLDIER', true, ['W']),
      _card('fic-1-tifa', 'Tifa, Martial Artist', false, ['W']),
      _card('fic-1-c1', 'Lightning Bolt', false, ['R']),
      _card('plains-printing-B', 'Plains', false, []),  // different id, same name
    ];
    const decks = splitPreconIntoDecks({ code: 'fic', decklist });
    const limitBreak = decks.find(d => d.name.includes('Limit Break'));
    // All 4 IDs satisfied — Plains via name fallback
    expect(limitBreak.cards).toHaveLength(4);
    expect(limitBreak.cards.some(c => c.scryfall_id === 'plains-printing-B')).toBe(true);
  });

  it('handles legacy bare-string entries (pre-14-07k JSON) for backwards compat', async () => {
    const mod = await import('../src/services/precons.js');
    mod.__setPreconDeckMembershipsForTests({
      memberships: {
        fic: {
          'Limit Break (FINAL FANTASY VII)': ['fic-1-cloud', 'fic-1-tifa'],
        },
      },
    });
    const { splitPreconIntoDecks } = mod;
    const decklist = [
      _card('fic-1-cloud', 'Cloud, Ex-SOLDIER', true, ['W']),
      _card('fic-1-tifa', 'Tifa, Martial Artist', false, ['W']),
    ];
    const decks = splitPreconIntoDecks({ code: 'fic', decklist });
    expect(decks).toHaveLength(1);
    expect(decks[0].cards).toHaveLength(2);
  });
});
