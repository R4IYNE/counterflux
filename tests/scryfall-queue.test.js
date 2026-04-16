import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * COLLECT-04 / COLLECT-06 foundation: the Scryfall rate-limited request queue.
 * Per Scryfall ToS (see .planning/research/PITFALLS.md §13):
 *  - All requests MUST include a User-Agent header
 *  - Minimum 50-100ms spacing between requests
 *  - Non-2xx responses MUST throw (so callers can surface errors to UI)
 *  - Concurrent invocations MUST serialise (ascending wall-clock order)
 *
 * These tests describe the contract for `src/services/scryfall-queue.js`
 * which is a NEW module (Pitfall 1 — CONTEXT + STACK claimed it existed;
 * in reality only the bulk-data fetcher exists).
 */
describe('scryfall-queue', () => {
  let fetchMock;

  beforeEach(async () => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);
    // Reset the module-level state between tests so timing assertions are
    // independent (the queue is a module-singleton by design).
    const mod = await import('../src/services/scryfall-queue.js');
    if (typeof mod.__resetQueueForTests === 'function') {
      mod.__resetQueueForTests();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('injects User-Agent: Counterflux/1.1 header on every request', async () => {
    const { queueScryfallRequest } = await import('../src/services/scryfall-queue.js');
    await queueScryfallRequest('https://api.scryfall.com/sets');
    expect(fetchMock).toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0];
    expect(init).toBeDefined();
    expect(init.headers).toBeDefined();
    expect(init.headers['User-Agent']).toMatch(/^Counterflux\/1\.1/);
  });

  it('spaces consecutive requests by >=100ms wall-clock', async () => {
    const { queueScryfallRequest } = await import('../src/services/scryfall-queue.js');
    const t0 = Date.now();
    await queueScryfallRequest('https://api.scryfall.com/sets');
    await queueScryfallRequest('https://api.scryfall.com/sets');
    const t1 = Date.now();
    // Two sequential requests must span at least MIN_DELAY_MS (100ms).
    expect(t1 - t0).toBeGreaterThanOrEqual(100);
  });

  it('throws on non-2xx response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'not found' }),
    });
    const { queueScryfallRequest } = await import('../src/services/scryfall-queue.js');
    await expect(
      queueScryfallRequest('https://api.scryfall.com/cards/not-a-real-id')
    ).rejects.toThrow(/Scryfall 404/);
  });

  it('10 concurrent calls resolve in ascending wall-clock order (serial, not parallel)', async () => {
    const { queueScryfallRequest } = await import('../src/services/scryfall-queue.js');
    const finishedAt = [];
    const calls = [];
    for (let i = 0; i < 10; i++) {
      calls.push(
        queueScryfallRequest(`https://api.scryfall.com/sets?n=${i}`).then(() => {
          finishedAt.push(Date.now());
        })
      );
    }
    await Promise.all(calls);
    // Timestamps must be monotonically non-decreasing — proves serial execution.
    for (let i = 1; i < finishedAt.length; i++) {
      expect(finishedAt[i]).toBeGreaterThanOrEqual(finishedAt[i - 1]);
    }
    // 10 calls × >=100ms spacing = at least ~900ms total duration from first to last.
    expect(finishedAt[finishedAt.length - 1] - finishedAt[0]).toBeGreaterThanOrEqual(800);
  });
});
