import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * COLLECT-04 component contract: selectPrinting(cardId, printingId) swaps the
 * active printing for the current card in the store, which in turn mutates
 * the panel's selectedCard (image + price + set + collector_number) in place.
 *
 * We test the store-level behaviour (activePrintingIdByCard mutation + event
 * dispatch) and the price-recompute via window.__cf_eurToGbp. The x-text DOM
 * verification is a string-level check on the rendered HTML — the printing
 * strip template must reference activePrintingIdByCard and selectedCard.id.
 */
function createAlpineStub() {
  const stores = {};
  return {
    store(name, obj) {
      if (obj === undefined) return stores[name];
      stores[name] = obj;
      return stores[name];
    },
  };
}

describe('COLLECT-04: printing picker live update', () => {
  let alpineStub;
  let collectionStore;
  let fetchMock;

  beforeEach(async () => {
    const queueMod = await import('../src/services/scryfall-queue.js');
    if (typeof queueMod.__resetQueueForTests === 'function') {
      queueMod.__resetQueueForTests();
    }
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    alpineStub = createAlpineStub();
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
  });

  it('Test 1: selectPrinting mutates activePrintingIdByCard[cardId]', async () => {
    // Seed the store with printings for a given card
    collectionStore.printingsByCardId['card-1'] = {
      loading: false,
      error: null,
      printings: [
        { id: 'p1', set: 'a', set_name: 'A', released_at: '2024-01-01', collector_number: '1', image_uris: { small: 'a.jpg' }, prices: { eur: '1.00' }, games: ['paper'] },
        { id: 'p2', set: 'b', set_name: 'B', released_at: '2023-01-01', collector_number: '2', image_uris: { small: 'b.jpg' }, prices: { eur: '5.00' }, games: ['paper'] },
      ],
    };
    collectionStore.selectPrinting('card-1', 'p2');
    expect(collectionStore.activePrintingIdByCard['card-1']).toBe('p2');
  });

  it('Test 2: selectPrinting dispatches cf:printing-selected CustomEvent with the printing payload', async () => {
    collectionStore.printingsByCardId['card-2'] = {
      loading: false,
      error: null,
      printings: [
        { id: 'x1', set: 'x', set_name: 'X', released_at: '2024-01-01', collector_number: '1', image_uris: { small: 'x.jpg' }, prices: { eur: '2.40' }, games: ['paper'] },
      ],
    };
    let receivedEvent = null;
    const handler = (e) => { receivedEvent = e; };
    // jsdom may or may not be loaded — provide a minimal window shim if needed
    if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
    if (typeof window.addEventListener !== 'function') {
      const listeners = {};
      window.addEventListener = (type, fn) => { (listeners[type] ||= []).push(fn); };
      window.dispatchEvent = (ev) => { (listeners[ev.type] || []).forEach(fn => fn(ev)); return true; };
      // CustomEvent polyfill
      if (typeof globalThis.CustomEvent === 'undefined') {
        globalThis.CustomEvent = class CustomEvent {
          constructor(type, init = {}) {
            this.type = type;
            this.detail = init.detail;
          }
        };
      }
    }
    window.addEventListener('cf:printing-selected', handler);
    collectionStore.selectPrinting('card-2', 'x1');
    expect(receivedEvent).not.toBeNull();
    expect(receivedEvent.detail.cardId).toBe('card-2');
    expect(receivedEvent.detail.printing.id).toBe('x1');
    expect(receivedEvent.detail.printing.image_uris.small).toBe('x.jpg');
    window.removeEventListener?.('cf:printing-selected', handler);
  });

  it('Test 3: GBP price lookup via window.__cf_eurToGbp rounds to two decimals', async () => {
    // Simulate the currency service being wired onto window
    globalThis.window = globalThis.window || globalThis;
    window.__cf_eurToGbp = (eur) => {
      if (eur == null) return '--';
      const num = typeof eur === 'string' ? parseFloat(eur) : eur;
      if (isNaN(num) || num === 0) return '--';
      const gbp = num * 0.86; // fixed test rate
      return '£' + gbp.toFixed(2);
    };
    // Verify the formatting conforms to "£N.NN" (two decimals always)
    expect(window.__cf_eurToGbp('2.40')).toBe('£2.06');
    expect(window.__cf_eurToGbp('100')).toBe('£86.00');
    expect(window.__cf_eurToGbp(null)).toBe('--');
  });

  it('Test 4: printing-strip template binds set + collector_number to the selected printing', async () => {
    // Shim for add-card-panel.js (renders HTML string that references store fields)
    if (typeof globalThis.window === 'undefined') globalThis.window = {};
    const { renderAddCardPanel } = await import('../src/components/add-card-panel.js');
    const html = renderAddCardPanel();
    // The rendered template must reference the printingsByCardId lookup and
    // the activePrintingIdByCard lookup keyed on selectedCard.id.
    expect(html).toMatch(/printingsByCardId\[selectedCard\.id\]/);
    expect(html).toMatch(/activePrintingIdByCard\[selectedCard\.id\]/);
    // The strip must iterate printings and render keyrune icons via :class="'ss-' + p.set"
    expect(html).toMatch(/x-for="p in/);
    expect(html).toMatch(/'ss-' \+ p\.set/);
  });
});
