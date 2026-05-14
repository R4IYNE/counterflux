import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchBulkDataMeta, shouldRefresh, SCRYFALL_BULK_API, USER_AGENT } from '../src/utils/scryfall.js';

describe('Scryfall utils', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchBulkDataMeta', () => {
    it('sends User-Agent header matching Counterflux/1.0', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ updated_at: '2026-04-01T00:00:00Z' }),
      };
      const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
      globalThis.fetch = fetchSpy;

      await fetchBulkDataMeta();

      expect(fetchSpy).toHaveBeenCalledWith(SCRYFALL_BULK_API, {
        headers: { 'User-Agent': USER_AGENT },
      });
      expect(USER_AGENT).toContain('Counterflux/1.0');
    });

    it('throws on non-ok response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      });

      await expect(fetchBulkDataMeta()).rejects.toThrow('Scryfall API error: 503');
    });
  });

  describe('shouldRefresh', () => {
    it('returns true when cachedUpdatedAt is null', () => {
      expect(shouldRefresh(null, '2026-04-01T00:00:00Z')).toBe(true);
    });

    it('returns true when server timestamp is newer', () => {
      expect(shouldRefresh('2026-04-01T00:00:00Z', '2026-04-02T00:00:00Z')).toBe(true);
    });

    it('returns false when timestamps are the same', () => {
      expect(shouldRefresh('2026-04-01T00:00:00Z', '2026-04-01T00:00:00Z')).toBe(false);
    });

    it('returns false when cached is newer than server', () => {
      expect(shouldRefresh('2026-04-02T00:00:00Z', '2026-04-01T00:00:00Z')).toBe(false);
    });
  });

  describe('constants', () => {
    // Quick task 260514-uqc Layer 2: switched from default-cards (~500MB
    // / ~500k printings) to oracle-cards (~100MB / ~30k cards). Layer 1's
    // API fallback in src/db/search.js covers the search/browse flows
    // during the smaller boot bulk-streaming window (~30-60s vs 3-5 min).
    it('SCRYFALL_BULK_API points to oracle-cards endpoint', () => {
      expect(SCRYFALL_BULK_API).toBe('https://api.scryfall.com/bulk-data/oracle-cards');
    });
  });
});
