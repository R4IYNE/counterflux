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

// Build a mock 200 response whose body streams the given NDJSON lines, so the
// stream-reading path (readNdjsonStream) is exercised the same way as prod.
function streamRes(lines) {
  const chunks = lines.map((l) => new TextEncoder().encode(l + '\n'));
  let i = 0;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () =>
          i < chunks.length ? { done: false, value: chunks[i++] } : { done: true, value: undefined },
      }),
    },
  };
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

    mockFetch(async () => streamRes([
      JSON.stringify({ type: 'done', recommended: [], cache_hit: false }),
    ]));

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
    mockFetch(async () => streamRes([
      JSON.stringify({ type: 'done', recommended: [] }),
    ]));
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
    mockFetch(async () => streamRes([
      JSON.stringify({ type: 'done', ...response }),
    ]));

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

describe('generateDeck — streaming protocol', () => {
  it('reports progress events and resolves on the done event', async () => {
    const onProgress = vi.fn();
    mockFetch(async () => streamRes([
      JSON.stringify({ type: 'progress', cards: 12 }),
      JSON.stringify({ type: 'progress', cards: 60 }),
      JSON.stringify({ type: 'done', recommended: [{ scryfall_id: 'c1', role: 'RAMP' }], cache_hit: false }),
    ]));
    const result = await generateDeck({
      commanderId: 'cmdr-1', powerLevel: 5, mode: 'build', collectionHash: 'no-collection',
      getAccessToken: async () => 'token', onProgress,
    });
    expect(result.ok).toBe(true);
    expect(result.response.recommended).toHaveLength(1);
    expect(onProgress).toHaveBeenCalledWith(12);
    expect(onProgress).toHaveBeenCalledWith(60);
    // protocol field stripped from the returned/cached body
    expect(result.response.type).toBeUndefined();
  });

  it('maps a mid-stream error event to a typed failure', async () => {
    mockFetch(async () => streamRes([
      JSON.stringify({ type: 'progress', cards: 5 }),
      JSON.stringify({ type: 'error', code: 'ai_provider_timeout', message: 'Mila took too long.' }),
    ]));
    const result = await generateDeck({
      commanderId: 'cmdr-1', powerLevel: 5, mode: 'build', collectionHash: 'no-collection',
      getAccessToken: async () => 'token',
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe('ai_provider_timeout');
  });

  it('handles a done event split across chunk boundaries', async () => {
    const doneLine = JSON.stringify({ type: 'done', recommended: [{ scryfall_id: 'x' }], cache_hit: false }) + '\n';
    const mid = Math.floor(doneLine.length / 2);
    const enc = new TextEncoder();
    const chunks = [enc.encode(doneLine.slice(0, mid)), enc.encode(doneLine.slice(mid))];
    let i = 0;
    mockFetch(async () => ({
      ok: true,
      body: { getReader: () => ({ read: async () => i < chunks.length ? { done: false, value: chunks[i++] } : { done: true } }) },
    }));
    const result = await generateDeck({
      commanderId: 'cmdr-1', powerLevel: 5, mode: 'build', collectionHash: 'no-collection',
      getAccessToken: async () => 'token',
    });
    expect(result.ok).toBe(true);
    expect(result.response.recommended).toHaveLength(1);
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
