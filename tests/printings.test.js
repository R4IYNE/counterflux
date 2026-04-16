import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * COLLECT-04 core: loadPrintings(card) fetches every paper printing of the
 * card's oracle via Scryfall, filters to games:paper, sorts released_at DESC,
 * and paginates has_more/next_page.
 *
 * Implementation lives on $store.collection.loadPrintings — but the test
 * imports it through the store factory (initCollectionStore) + an Alpine shim.
 */

// Minimal Alpine shim so initCollectionStore can register the store without a
// real Alpine runtime. We only need `.store(name, obj)` and `.store(name)`.
function createAlpineStub() {
  const stores = {};
  return {
    store(name, obj) {
      if (obj === undefined) return stores[name];
      stores[name] = obj;
      return stores[name];
    },
    __stores: stores,
  };
}

describe('COLLECT-04: loadPrintings (paper filter + DESC sort + pagination)', () => {
  let fetchMock;
  let alpineStub;
  let originalAlpine;
  let collectionStore;

  beforeEach(async () => {
    // Reset queue internal state between tests
    const queueMod = await import('../src/services/scryfall-queue.js');
    if (typeof queueMod.__resetQueueForTests === 'function') {
      queueMod.__resetQueueForTests();
    }

    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    alpineStub = createAlpineStub();
    originalAlpine = globalThis.Alpine;
    // alpinejs ESM default export — we patch the live module's .store path.
    // The store module `import Alpine from 'alpinejs'`, so we stub that export.
    const AlpineMod = await import('alpinejs');
    vi.spyOn(AlpineMod.default, 'store').mockImplementation((name, obj) => {
      return alpineStub.store(name, obj);
    });

    const { initCollectionStore } = await import('../src/stores/collection.js');
    initCollectionStore();
    collectionStore = alpineStub.store('collection');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.Alpine = originalAlpine;
  });

  it('Test 1: filters to paper-only printings (3 paper + 1 mtgo → 3 entries)', async () => {
    const mockCard = {
      id: 'oracle-lb-1',
      oracle_id: 'oracle-lb',
      prints_search_uri: 'https://api.scryfall.com/cards/search?q=oracleid%3Aoracle-lb',
    };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { id: 'p1', set: 'lea', set_name: 'Alpha', released_at: '1993-08-05', collector_number: '161', image_uris: { small: 'a.jpg' }, prices: { eur: '100' }, games: ['paper'] },
          { id: 'p2', set: 'm10', set_name: 'M10', released_at: '2009-07-17', collector_number: '146', image_uris: { small: 'b.jpg' }, prices: { eur: '2.40' }, games: ['paper', 'mtgo'] },
          { id: 'p3', set: 'mtgo1', set_name: 'MTGO Only', released_at: '2020-01-01', collector_number: '1', image_uris: { small: 'c.jpg' }, prices: { eur: null }, games: ['mtgo'] },
          { id: 'p4', set: 'jmp', set_name: 'Jumpstart', released_at: '2020-07-17', collector_number: '342', image_uris: { small: 'd.jpg' }, prices: { eur: '0.80' }, games: ['paper', 'arena'] },
        ],
        has_more: false,
      }),
    });
    const printings = await collectionStore.loadPrintings(mockCard);
    expect(printings).toHaveLength(3);
    const ids = printings.map(p => p.id).sort();
    expect(ids).toEqual(['p1', 'p2', 'p4']);
  });

  it('Test 2: result is sorted released_at DESC (newest first, D-16)', async () => {
    const mockCard = {
      id: 'oracle-lb-2',
      oracle_id: 'oracle-lb-2',
      prints_search_uri: 'https://api.scryfall.com/cards/search?q=oracleid%3Aoracle-lb-2',
    };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { id: 'old', set: 'lea', released_at: '1993-08-05', games: ['paper'], image_uris: {}, prices: { eur: '100' }, set_name: 'Alpha', collector_number: '161' },
          { id: 'new', set: 'cmm', released_at: '2023-08-04', games: ['paper'], image_uris: {}, prices: { eur: '2.40' }, set_name: 'Commander Masters', collector_number: '100' },
          { id: 'mid', set: 'm10', released_at: '2009-07-17', games: ['paper'], image_uris: {}, prices: { eur: '5' }, set_name: 'M10', collector_number: '146' },
        ],
        has_more: false,
      }),
    });
    const printings = await collectionStore.loadPrintings(mockCard);
    expect(printings.map(p => p.id)).toEqual(['new', 'mid', 'old']);
  });

  it('Test 3: each entry contains the fields needed by the UI', async () => {
    const mockCard = {
      id: 'oracle-sol-ring',
      oracle_id: 'oracle-sol-ring',
      prints_search_uri: 'https://api.scryfall.com/cards/search?q=oracleid%3Asol-ring',
    };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          {
            id: 'p1',
            set: 'cmm',
            set_name: 'Commander Masters',
            released_at: '2023-08-04',
            collector_number: '100',
            image_uris: { small: 'cmm.jpg' },
            prices: { eur: '2.40' },
            games: ['paper'],
          },
        ],
        has_more: false,
      }),
    });
    const printings = await collectionStore.loadPrintings(mockCard);
    expect(printings[0]).toMatchObject({
      id: 'p1',
      set: 'cmm',
      set_name: 'Commander Masters',
      released_at: '2023-08-04',
      collector_number: '100',
    });
    expect(printings[0].image_uris).toEqual({ small: 'cmm.jpg' });
    expect(printings[0].prices).toEqual({ eur: '2.40' });
    expect(printings[0].games).toEqual(['paper']);
  });

  it('Test 4: fallback URL uses oracleid when prints_search_uri is missing (Pitfall 3)', async () => {
    const mockCard = {
      id: 'oracle-fallback',
      oracle_id: 'oracle-fallback-123',
      // no prints_search_uri
    };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [], has_more: false }),
    });
    await collectionStore.loadPrintings(mockCard);
    expect(fetchMock).toHaveBeenCalled();
    const [urlCalled] = fetchMock.mock.calls[0];
    expect(urlCalled).toContain('oracleid');
    expect(urlCalled).toContain('oracle-fallback-123');
    expect(urlCalled).toContain('unique=prints');
  });

  it('Test 5: paginated response (has_more + next_page) accumulates across pages', async () => {
    const mockCard = {
      id: 'oracle-multi',
      oracle_id: 'oracle-multi',
      prints_search_uri: 'https://api.scryfall.com/cards/search?q=oracleid%3Aoracle-multi&page=1',
    };
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 'p1', set: 'a', set_name: 'A', released_at: '2024-01-01', collector_number: '1', image_uris: {}, prices: { eur: '1' }, games: ['paper'] },
            { id: 'p2', set: 'b', set_name: 'B', released_at: '2023-01-01', collector_number: '2', image_uris: {}, prices: { eur: '2' }, games: ['paper'] },
          ],
          has_more: true,
          next_page: 'https://api.scryfall.com/cards/search?q=oracleid%3Aoracle-multi&page=2',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 'p3', set: 'c', set_name: 'C', released_at: '2022-01-01', collector_number: '3', image_uris: {}, prices: { eur: '3' }, games: ['paper'] },
          ],
          has_more: false,
        }),
      });
    const printings = await collectionStore.loadPrintings(mockCard);
    expect(printings).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
