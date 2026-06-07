// Phase 17 (v1.3) — deckgen client wrapper tests.
//
// Covers:
//   - Local Dexie cache hits short-circuit the network call
//   - Missing token returns a typed unauthenticated result (no fetch)
//   - Network errors map to typed result, no throws
//   - HTTP status codes map to the right typed code

import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../src/db/schema.js';
import { generateDeck } from '../src/services/deckgen.js';

function mockFetch(impl) {
  globalThis.fetch = vi.fn(impl);
}

beforeEach(async () => {
  await db.deckgen_cache.clear();
  delete globalThis.fetch;
});

describe('generateDeck — local cache', () => {
  it('returns cached response without calling fetch', async () => {
    const cachedResponse = { recommended: [{ scryfall_id: 'c1', role: 'RAMP' }] };
    // Seed the cache with a hash that matches the inputs below
    const { buildCacheKey } = await import('../src/services/deckgen-candidates.js');
    const hash = buildCacheKey({
      commanderId: 'cmdr-1',
      powerLevel: 5,
      mode: 'build',
      archetypeHint: '',
      collectionHash: 'no-collection',
    });
    await db.deckgen_cache.put({
      hash,
      user_id: null,
      response: cachedResponse,
      fetched_at: Date.now(),
    });

    mockFetch(() => { throw new Error('should not be called'); });

    const result = await generateDeck({
      commanderId: 'cmdr-1',
      powerLevel: 5,
      mode: 'build',
      collectionHash: 'no-collection',
      getAccessToken: async () => 'token',
    });

    expect(result.ok).toBe(true);
    expect(result.cacheHit).toBe(true);
    expect(result.response).toEqual(cachedResponse);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('skips expired cache entries', async () => {
    const { buildCacheKey } = await import('../src/services/deckgen-candidates.js');
    const hash = buildCacheKey({
      commanderId: 'cmdr-1',
      powerLevel: 5,
      mode: 'build',
      archetypeHint: '',
      collectionHash: 'no-collection',
    });
    await db.deckgen_cache.put({
      hash,
      user_id: null,
      response: { recommended: [] },
      fetched_at: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
    });

    mockFetch(async () => ({
      ok: true,
      json: async () => ({ recommended: [], cache_hit: false }),
    }));

    const result = await generateDeck({
      commanderId: 'cmdr-1',
      powerLevel: 5,
      mode: 'build',
      collectionHash: 'no-collection',
      getAccessToken: async () => 'token',
    });

    expect(result.ok).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });
});

describe('generateDeck — authentication', () => {
  it('returns unauthenticated when no token is provided', async () => {
    mockFetch(() => { throw new Error('should not be called'); });
    const result = await generateDeck({
      commanderId: 'cmdr-1',
      powerLevel: 5,
      mode: 'build',
      collectionHash: 'no-collection',
      getAccessToken: async () => null,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('unauthenticated');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns unauthenticated when getAccessToken throws', async () => {
    mockFetch(() => { throw new Error('should not be called'); });
    const result = await generateDeck({
      commanderId: 'cmdr-1',
      powerLevel: 5,
      mode: 'build',
      collectionHash: 'no-collection',
      getAccessToken: async () => { throw new Error('no session'); },
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('unauthenticated');
  });

  it('sends the token in the Authorization header', async () => {
    mockFetch(async () => ({
      ok: true,
      json: async () => ({ recommended: [] }),
    }));
    await generateDeck({
      commanderId: 'cmdr-1',
      powerLevel: 5,
      mode: 'build',
      collectionHash: 'no-collection',
      getAccessToken: async () => 'my-token-123',
    });
    const callArgs = globalThis.fetch.mock.calls[0][1];
    expect(callArgs.headers.Authorization).toBe('Bearer my-token-123');
  });
});

describe('generateDeck — error mapping', () => {
  it('maps 429 to budget_exhausted', async () => {
    mockFetch(async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: 'daily limit reached', detail: 'try again tomorrow' }),
    }));
    const result = await generateDeck({
      commanderId: 'cmdr-1',
      powerLevel: 5,
      mode: 'build',
      collectionHash: 'no-collection',
      getAccessToken: async () => 'token',
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('budget_exhausted');
  });

  it('maps 401 to unauthenticated', async () => {
    mockFetch(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: 'invalid token' }),
    }));
    const result = await generateDeck({
      commanderId: 'cmdr-1',
      powerLevel: 5,
      mode: 'build',
      collectionHash: 'no-collection',
      getAccessToken: async () => 'expired-token',
    });
    expect(result.code).toBe('unauthenticated');
  });

  it('maps 409 to insufficient_candidates', async () => {
    mockFetch(async () => ({
      ok: false,
      status: 409,
      json: async () => ({ error: 'insufficient candidates' }),
    }));
    const result = await generateDeck({
      commanderId: 'cmdr-1',
      powerLevel: 5,
      mode: 'build',
      collectionHash: 'no-collection',
      getAccessToken: async () => 'token',
    });
    expect(result.code).toBe('insufficient_candidates');
  });

  it('maps 502 to ai_provider_error', async () => {
    mockFetch(async () => ({
      ok: false,
      status: 502,
      json: async () => ({ error: 'AI provider error' }),
    }));
    const result = await generateDeck({
      commanderId: 'cmdr-1',
      powerLevel: 5,
      mode: 'build',
      collectionHash: 'no-collection',
      getAccessToken: async () => 'token',
    });
    expect(result.code).toBe('ai_provider_error');
  });

  it('maps network failure to network_error without throwing', async () => {
    mockFetch(async () => { throw new TypeError('Failed to fetch'); });
    const result = await generateDeck({
      commanderId: 'cmdr-1',
      powerLevel: 5,
      mode: 'build',
      collectionHash: 'no-collection',
      getAccessToken: async () => 'token',
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('network_error');
  });
});

describe('generateDeck — happy path cache mirror', () => {
  it('writes the response to local cache on a successful fetch', async () => {
    const response = { recommended: [{ scryfall_id: 'c1' }], cache_hit: false };
    mockFetch(async () => ({
      ok: true,
      json: async () => response,
    }));

    await generateDeck({
      commanderId: 'cmdr-1',
      powerLevel: 5,
      mode: 'build',
      collectionHash: 'no-collection',
      getAccessToken: async () => 'token',
    });

    const { buildCacheKey } = await import('../src/services/deckgen-candidates.js');
    const hash = buildCacheKey({
      commanderId: 'cmdr-1',
      powerLevel: 5,
      mode: 'build',
      archetypeHint: '',
      collectionHash: 'no-collection',
    });
    const stored = await db.deckgen_cache.get(hash);
    expect(stored).toBeDefined();
    expect(stored.response).toEqual(response);
  });
});

describe('generateDeck — input validation', () => {
  it('returns invalid_input when commanderId is missing', async () => {
    mockFetch(() => { throw new Error('should not be called'); });
    const result = await generateDeck({
      powerLevel: 5,
      mode: 'build',
      collectionHash: 'no-collection',
      getAccessToken: async () => 'token',
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('invalid_input');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
