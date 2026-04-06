import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { db } from '../src/db/schema.js';
import {
  sanitizeCommanderName,
  getCommanderSynergies,
  getCardSalt,
  normalizeSalt,
} from '../src/services/edhrec.js';
import prosshFixture from './fixtures/edhrec-prossh.json';

beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn());
  // Clear cache tables between tests
  await db.edhrec_cache.clear();
  await db.card_salt_cache.clear();
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
      'https://json.edhrec.com/pages/commanders/prossh-skyraider-of-kher.json',
      expect.any(Object)
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

describe('getCardSalt', () => {
  it('fetches and returns card salt score', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        container: { json_dict: { card: { salt: 1.46 } } },
      }),
    });

    const salt = await getCardSalt('Sol Ring');
    expect(salt).toBe(1.46);
  });

  it('returns null on failure', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    const salt = await getCardSalt('Sol Ring');
    expect(salt).toBeNull();
  });

  it('caches card salt', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        container: { json_dict: { card: { salt: 1.46 } } },
      }),
    });

    await getCardSalt('Sol Ring');
    await getCardSalt('Sol Ring');

    expect(fetch).toHaveBeenCalledTimes(1);
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
