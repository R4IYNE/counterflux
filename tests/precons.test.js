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

    // D-09: only commander + duel_deck (expansion, core, starter filtered out)
    expect(precons).toHaveLength(5);
    const setTypes = new Set(precons.map((p) => p.set_type));
    expect(setTypes).toEqual(new Set(['commander', 'duel_deck']));

    // D-12: sorted released_at DESC
    expect(precons[0].released_at).toBe('2023-09-08'); // woc (newest)
    expect(precons[0].code).toBe('woc');

    // Last should be the oldest
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
    expect(first).toHaveLength(5);

    // Force a refresh that fails — must fall back to stale cache
    fetchMock.mockRejectedValueOnce(new Error('Network down'));
    const stale = await fetchPrecons({ forceRefresh: true });
    expect(stale).toHaveLength(5);
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
