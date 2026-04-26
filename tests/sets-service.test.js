import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '../src/db/schema.js';
import { fetchSets, getCachedSets } from '../src/services/sets.js';

const MOCK_SETS_RESPONSE = {
  data: [
    { code: 'mkm', name: 'Murders at Karlov Manor', set_type: 'expansion', released_at: '2024-02-09', icon_svg_uri: 'https://example.com/mkm.svg', card_count: 286, parent_set_code: undefined },
    { code: 'cmm', name: 'Commander Masters', set_type: 'masters', released_at: '2023-08-04', icon_svg_uri: 'https://example.com/cmm.svg', card_count: 400, parent_set_code: undefined },
    { code: 'ltc', name: 'LTC Commander Decks', set_type: 'commander', released_at: '2023-06-16', icon_svg_uri: 'https://example.com/ltc.svg', card_count: 60, parent_set_code: 'ltr' },
    { code: 'unf', name: 'Unfinity', set_type: 'funny', released_at: '2022-10-07', icon_svg_uri: 'https://example.com/unf.svg', card_count: 244, parent_set_code: undefined },
    { code: 'pmkm', name: 'MKM Promos', set_type: 'promo', released_at: '2024-02-09', icon_svg_uri: 'https://example.com/pmkm.svg', card_count: 50, parent_set_code: undefined },
    { code: 'm21', name: 'Core Set 2021', set_type: 'core', released_at: '2020-07-03', icon_svg_uri: 'https://example.com/m21.svg', card_count: 274, parent_set_code: undefined },
  ],
};

describe('sets service', () => {
  beforeEach(async () => {
    await db.meta.delete('scryfall-sets');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchSets returns filtered set objects (relevant types only)', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_SETS_RESPONSE),
    });

    const sets = await fetchSets();
    expect(sets).toHaveLength(4);
    expect(sets.map(s => s.code).sort()).toEqual(['cmm', 'm21', 'mkm', 'unf']);
  });

  it('fetchSets excludes sets with parent_set_code', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_SETS_RESPONSE),
    });

    const sets = await fetchSets();
    const codes = sets.map(s => s.code);
    expect(codes).not.toContain('ltc');
  });

  it('getCachedSets returns sets after fetchSets populates memory cache', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_SETS_RESPONSE),
    });

    await fetchSets();
    const cached = getCachedSets();
    expect(cached).toHaveLength(4);
    expect(cached.map(s => s.code).sort()).toEqual(['cmm', 'm21', 'mkm', 'unf']);
  });

  // Phase 14.07 — set list must be newest-first so the Preordain spoiler
  // selector dropdown shows current/upcoming sets at the top, not 1993.
  it('fetchSets returns sets sorted newest-first by released_at, tiebreak by name ASC', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: [
          // Two same-day to exercise tiebreak
          { code: 'b21', name: 'Beta Set', set_type: 'expansion', released_at: '2024-02-09', icon_svg_uri: '', card_count: 100, parent_set_code: undefined },
          { code: 'a21', name: 'Alpha Set', set_type: 'expansion', released_at: '2024-02-09', icon_svg_uri: '', card_count: 100, parent_set_code: undefined },
          { code: 'old', name: 'Older Set', set_type: 'expansion', released_at: '1993-08-05', icon_svg_uri: '', card_count: 295, parent_set_code: undefined },
          { code: 'new', name: 'Newer Set', set_type: 'expansion', released_at: '2026-04-25', icon_svg_uri: '', card_count: 200, parent_set_code: undefined },
        ],
      }),
    });

    const sets = await fetchSets();
    // Expected order: 2026-04-25 (new) → 2024-02-09 alpha → 2024-02-09 beta → 1993-08-05 (old)
    expect(sets.map(s => s.code)).toEqual(['new', 'a21', 'b21', 'old']);
  });

  it('fetchSets caches in meta table and subsequent call uses cache within 24h', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_SETS_RESPONSE),
    });

    const first = await fetchSets();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(first).toHaveLength(4);

    const second = await fetchSets();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(second).toHaveLength(4);

    const cached = await db.meta.get('scryfall-sets');
    expect(cached).toBeDefined();
    expect(cached.data).toHaveLength(4);
  });
});
