import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../src/db/schema.js';
import { searchCards, browseCards } from '../src/db/search.js';
import sampleCards from './fixtures/sample-cards.json';
import { queueScryfallRequest } from '../src/services/scryfall-queue.js';

vi.mock('../src/services/scryfall-queue.js', () => ({
  queueScryfallRequest: vi.fn(),
  __resetQueueForTests: vi.fn(),
}));

describe('searchCards', () => {
  beforeAll(async () => {
    await db.cards.bulkPut(sampleCards);
  });

  afterAll(async () => {
    await db.cards.clear();
  });

  it('returns empty array for query shorter than 2 chars', async () => {
    const results = await searchCards('L');
    expect(results).toEqual([]);
  });

  it('returns empty array for empty query', async () => {
    const results = await searchCards('');
    expect(results).toEqual([]);
  });

  it('returns empty array for null query', async () => {
    const results = await searchCards(null);
    expect(results).toEqual([]);
  });

  it('returns cards matching name prefix (startsWithIgnoreCase)', async () => {
    const results = await searchCards('light');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('Lightning Bolt');
  });

  it('returns results case-insensitively', async () => {
    const results = await searchCards('LIGHT');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('Lightning Bolt');
  });

  it('falls back to contains search when prefix yields few results', async () => {
    // "bolt" doesn't start any card name but is contained in "Lightning Bolt"
    const results = await searchCards('bolt');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(c => c.name.includes('Bolt'))).toBe(true);
  });

  it('respects limit parameter', async () => {
    const results = await searchCards('the', 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });
});

// Quick task 260514-uqc — Layer 1 API fallback contract.
// When window.Alpine.store('bulkdata').status !== 'ready', search.js must
// fall through to queueScryfallRequest() instead of returning the legacy
// empty-with-flag result.
describe('searchCards/browseCards — Scryfall API fallback when bulkdata not ready (260514-uqc)', () => {
  beforeEach(() => {
    // Stub Alpine.store('bulkdata') as streaming. The src/db/search.js gate
    // resolves `window` via `typeof window !== 'undefined' && window.Alpine`,
    // so we polyfill a minimal `window` on globalThis for the node test env.
    if (typeof globalThis.window === 'undefined') {
      globalThis.window = globalThis;
    }
    globalThis.window.Alpine = {
      store: (name) => {
        if (name === 'bulkdata') return { status: 'streaming' };
        return null;
      },
    };
    queueScryfallRequest.mockReset();
  });

  afterEach(() => {
    if (globalThis.window) delete globalThis.window.Alpine;
  });

  it("falls through to Scryfall API when bulkdata.status !== 'ready' and query is valid", async () => {
    queueScryfallRequest.mockResolvedValueOnce({
      data: [{
        id: 'fake-uuid-counterspell',
        oracle_id: 'oracle-counterspell',
        name: 'Counterspell',
        set: 'lea',
        collector_number: '55',
        type_line: 'Instant',
        mana_cost: '{U}{U}',
        cmc: 2,
        color_identity: ['U'],
        rarity: 'rare',
        oracle_text: 'Counter target spell.',
        games: ['paper'],
        image_uris: { small: 'https://example/img.jpg' },
        prices: { eur: '0.50' },
      }],
      has_more: false,
    });

    const results = await searchCards('counter', 12);

    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Counterspell');
    expect(queueScryfallRequest).toHaveBeenCalledTimes(1);
    const calledUrl = queueScryfallRequest.mock.calls[0][0];
    expect(calledUrl).toMatch(/cards\/search/);
    expect(calledUrl).toMatch(/counter/);
  });

  it("falls through to Scryfall API when bulkdata.status !== 'ready' for browseCards", async () => {
    queueScryfallRequest.mockResolvedValueOnce({
      data: [{
        id: 'fake-uuid-llanowar',
        oracle_id: 'oracle-llanowar',
        name: 'Llanowar Elves',
        set: 'm12',
        collector_number: '182',
        type_line: 'Creature — Elf Druid',
        mana_cost: '{G}',
        cmc: 1,
        color_identity: ['G'],
        rarity: 'common',
        oracle_text: '{T}: Add {G}.',
        games: ['paper'],
        image_uris: { small: 'https://example/img.jpg' },
        prices: { eur: '0.25' },
      }],
      has_more: false,
    });

    const results = await browseCards(['U'], { type: 'Creature' }, 20);

    expect(queueScryfallRequest).toHaveBeenCalledTimes(1);
    const calledUrl = queueScryfallRequest.mock.calls[0][0];
    // identity<=U (lowercase url-encoded) + type:creature should both appear in the query
    expect(calledUrl).toMatch(/cards\/search/);
    expect(decodeURIComponent(calledUrl)).toMatch(/identity<=U/i);
    expect(decodeURIComponent(calledUrl)).toMatch(/type:creature/i);
    expect(results.length).toBe(1);
  });

  it('returns [] when API fallback throws (e.g. 404 no-match)', async () => {
    queueScryfallRequest.mockRejectedValueOnce(new Error('Scryfall 404: cards/search'));

    const results = await searchCards('xyzzqq', 12);

    expect(results).toEqual([]);
  });
});
