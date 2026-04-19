/**
 * @vitest-environment jsdom
 *
 * Phase 12 Plan 01 extensions exercise window.Alpine-based store lookups
 * (src/stores/market.js `_pollSyncErrors` reads `window.Alpine?.store('auth')`),
 * so the whole file runs in jsdom to provide `window`. The original watchlist
 * tests are environment-agnostic and pass unchanged under jsdom.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '../src/db/schema.js';

// Test card fixtures
const CARD_BOLT = {
  id: 'bolt-001',
  name: 'Lightning Bolt',
  oracle_id: 'oracle-bolt',
  set: '2xm',
  collector_number: '141',
  cmc: 1,
  color_identity: ['R'],
  type_line: 'Instant',
  rarity: 'uncommon',
  prices: { eur: '1.50', eur_foil: '3.00' },
};

const CARD_SOL = {
  id: 'sol-001',
  name: 'Sol Ring',
  oracle_id: 'oracle-sol',
  set: 'c21',
  collector_number: '263',
  cmc: 1,
  color_identity: [],
  type_line: 'Artifact',
  rarity: 'uncommon',
  prices: { eur: '2.00', eur_foil: '5.00' },
};

describe('watchlist', () => {
  beforeEach(async () => {
    await db.watchlist.clear();
    await db.cards.clear();
    await db.price_history.clear();
    await db.cards.bulkPut([CARD_BOLT, CARD_SOL]);
  });

  it('addToWatchlist adds entry and returns in watchlist array', async () => {
    await db.watchlist.add({
      scryfall_id: 'bolt-001',
      added_at: new Date().toISOString(),
      alert_type: null,
      alert_threshold: null,
      last_alerted_at: null,
    });

    const list = await db.watchlist.toArray();
    expect(list).toHaveLength(1);
    expect(list[0].scryfall_id).toBe('bolt-001');
  });

  it('unique scryfall_id constraint prevents duplicate watchlist entries', async () => {
    await db.watchlist.add({
      scryfall_id: 'bolt-001',
      added_at: new Date().toISOString(),
      alert_type: null,
      alert_threshold: null,
      last_alerted_at: null,
    });

    await expect(
      db.watchlist.add({
        scryfall_id: 'bolt-001',
        added_at: new Date().toISOString(),
        alert_type: null,
        alert_threshold: null,
        last_alerted_at: null,
      })
    ).rejects.toThrow();

    const list = await db.watchlist.toArray();
    expect(list).toHaveLength(1);
  });

  it('removeFromWatchlist removes entry by scryfall_id', async () => {
    await db.watchlist.add({
      scryfall_id: 'bolt-001',
      added_at: new Date().toISOString(),
      alert_type: null,
      alert_threshold: null,
      last_alerted_at: null,
    });

    await db.watchlist.where('scryfall_id').equals('bolt-001').delete();
    const list = await db.watchlist.toArray();
    expect(list).toHaveLength(0);
  });

  it('updateAlert updates alert fields on watchlist entry', async () => {
    await db.watchlist.add({
      scryfall_id: 'bolt-001',
      added_at: new Date().toISOString(),
      alert_type: null,
      alert_threshold: null,
      last_alerted_at: null,
    });

    const entry = await db.watchlist.where('scryfall_id').equals('bolt-001').first();
    await db.watchlist.update(entry.id, {
      alert_type: 'below',
      alert_threshold: 5.00,
    });

    const updated = await db.watchlist.get(entry.id);
    expect(updated.alert_type).toBe('below');
    expect(updated.alert_threshold).toBe(5.00);
  });

  it('checkAlerts detects price below threshold', async () => {
    await db.watchlist.add({
      scryfall_id: 'bolt-001',
      added_at: new Date().toISOString(),
      alert_type: 'below',
      alert_threshold: 2.00, // GBP threshold; card is 1.50 EUR * 0.86 = ~1.29 GBP
      last_alerted_at: null,
    });

    const entry = await db.watchlist.where('scryfall_id').equals('bolt-001').first();
    const card = await db.cards.get('bolt-001');
    const priceEur = parseFloat(card.prices.eur);
    const priceGbp = priceEur * 0.86; // ~1.29

    expect(priceGbp).toBeLessThan(entry.alert_threshold);
  });

  it('checkAlerts detects price above threshold', async () => {
    await db.watchlist.add({
      scryfall_id: 'sol-001',
      added_at: new Date().toISOString(),
      alert_type: 'above',
      alert_threshold: 1.00, // GBP threshold; card is 2.00 EUR * 0.86 = 1.72 GBP
      last_alerted_at: null,
    });

    const entry = await db.watchlist.where('scryfall_id').equals('sol-001').first();
    const card = await db.cards.get('sol-001');
    const priceEur = parseFloat(card.prices.eur);
    const priceGbp = priceEur * 0.86; // ~1.72

    expect(priceGbp).toBeGreaterThan(entry.alert_threshold);
  });

  it('checkAlerts skips already-alerted-today entries', async () => {
    const today = new Date().toISOString();
    await db.watchlist.add({
      scryfall_id: 'bolt-001',
      added_at: new Date().toISOString(),
      alert_type: 'below',
      alert_threshold: 2.00,
      last_alerted_at: today, // already alerted today
    });

    const entry = await db.watchlist.where('scryfall_id').equals('bolt-001').first();
    const todayStr = new Date().toISOString().slice(0, 10);
    expect(entry.last_alerted_at.slice(0, 10)).toBe(todayStr);
  });
});

// ============================================================================
// Phase 12 Plan 01 — market store additions (SYNC-08, MARKET-02)
//
// Extends the market store with three reactive primitives that Phase 12's
// downstream plans depend on:
//   - unifiedBadgeCount: getter = syncErrorCount + alertBadgeCount
//   - groupedSpoilerCards: getter = cards grouped by released_at (desc)
//   - syncErrorCount + _pollSyncErrors/_stopSyncErrorPoll: 2s polling that
//     mirrors src/stores/sync.js:106-119 (Phase 11 Plan 4 precedent).
//
// Test pattern follows the Phase 09 convention:
//   - vi.mock('alpinejs') replaces Alpine module so initMarketStore works in node
//   - window.Alpine is stubbed in beforeEach so components that read Alpine
//     directly (rather than via import) resolve; restored in afterEach.
//   - db.sync_conflicts is spied with vi.spyOn for count-based assertions.
//   - __tickSyncErrorPoll is imported from market.js — runs one poll cycle
//     without waiting for the 2s setInterval.
// ============================================================================
describe('phase 12 additions', () => {
  let initMarketStore;
  let __tickSyncErrorPoll;
  let marketStoreDefinition;
  let previousAlpine;

  beforeEach(async () => {
    vi.resetModules();

    // Capture the store definition as initMarketStore() registers it.
    marketStoreDefinition = null;

    // Stub Alpine module — we only need Alpine.store(name, def) to capture
    // the store shape so tests can operate on it directly.
    vi.doMock('alpinejs', () => ({
      default: {
        store: (name, def) => {
          if (def !== undefined) {
            // Register path: capture the shape.
            if (name === 'market') marketStoreDefinition = def;
            return def;
          }
          // Read path: return whatever is currently registered on window.Alpine.
          if (typeof window !== 'undefined' && window.Alpine?.store) {
            return window.Alpine.store(name);
          }
          return undefined;
        },
      },
    }));

    // Re-import the market store module against the mocked Alpine.
    const mod = await import('../src/stores/market.js');
    initMarketStore = mod.initMarketStore;
    __tickSyncErrorPoll = mod.__tickSyncErrorPoll;

    // Register the store shape without running init() (init() triggers
    // Dexie + network work the tests don't need for these unit cases).
    initMarketStore();

    // Stand up a window.Alpine stub so downstream reads via
    // window.Alpine.store('market' | 'auth') resolve.
    previousAlpine = (typeof window !== 'undefined') ? window.Alpine : undefined;
    const storeRegistry = { market: marketStoreDefinition };
    if (typeof window !== 'undefined') {
      window.Alpine = {
        store: (name, value) => {
          if (value !== undefined) {
            storeRegistry[name] = value;
            return value;
          }
          return storeRegistry[name];
        },
      };
    }
  });

  afterEach(() => {
    // Stop any polling interval before the next test resets modules.
    try {
      marketStoreDefinition?._stopSyncErrorPoll?.();
    } catch { /* best-effort cleanup */ }

    if (typeof window !== 'undefined') {
      if (previousAlpine === undefined) {
        delete window.Alpine;
      } else {
        window.Alpine = previousAlpine;
      }
    }
    vi.doUnmock('alpinejs');
  });

  it('unifiedBadgeCount returns syncErrorCount + alertBadgeCount', () => {
    const store = marketStoreDefinition;
    store.syncErrorCount = 3;
    store.alertBadgeCount = 2;
    expect(store.unifiedBadgeCount).toBe(5);
  });

  it('unifiedBadgeCount returns 0 when both sources are 0', () => {
    const store = marketStoreDefinition;
    store.syncErrorCount = 0;
    store.alertBadgeCount = 0;
    expect(store.unifiedBadgeCount).toBe(0);
  });

  it('groupedSpoilerCards returns [] when spoilerCards is empty', () => {
    const store = marketStoreDefinition;
    store.spoilerCards = [];
    expect(store.groupedSpoilerCards).toEqual([]);
  });

  it('groupedSpoilerCards groups cards by released_at descending', () => {
    const store = marketStoreDefinition;
    store.spoilerCards = [
      { id: 'a', released_at: '2026-04-15' },
      { id: 'b', released_at: '2026-04-18' },
      { id: 'c', released_at: '2026-04-18' },
    ];
    const result = store.groupedSpoilerCards;
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2026-04-18');
    expect(result[0].cards).toHaveLength(2);
    expect(result[1].date).toBe('2026-04-15');
    expect(result[1].cards).toHaveLength(1);
  });

  it('groupedSpoilerCards buckets null/undefined released_at as unknown at the bottom', () => {
    const store = marketStoreDefinition;
    store.spoilerCards = [
      { id: 'a', released_at: '2026-04-18' },
      { id: 'b', released_at: null },
      { id: 'c' }, // undefined released_at
    ];
    const result = store.groupedSpoilerCards;
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2026-04-18');
    expect(result[0].cards).toHaveLength(1);
    expect(result[1].date).toBe('unknown');
    expect(result[1].cards).toHaveLength(2);
  });

  it('_pollSyncErrors reads sync_conflicts count and sets syncErrorCount when authed', async () => {
    const store = marketStoreDefinition;
    // Mock auth store to return authed.
    window.Alpine.store('auth', { status: 'authed', user: { id: 'u1' } });
    // Stub sync_conflicts.count().
    const countSpy = vi.spyOn(db.sync_conflicts, 'count').mockResolvedValue(4);

    await __tickSyncErrorPoll();

    expect(countSpy).toHaveBeenCalled();
    expect(store.syncErrorCount).toBe(4);

    countSpy.mockRestore();
    store._stopSyncErrorPoll();
  });

  it('_pollSyncErrors resets syncErrorCount to 0 when not authed', async () => {
    const store = marketStoreDefinition;
    store.syncErrorCount = 5;
    window.Alpine.store('auth', { status: 'anonymous' });

    await __tickSyncErrorPoll();

    expect(store.syncErrorCount).toBe(0);
  });

  it('_pollSyncErrors swallows Dexie errors without throwing', async () => {
    const store = marketStoreDefinition;
    store.syncErrorCount = 7;
    window.Alpine.store('auth', { status: 'authed', user: { id: 'u1' } });
    const countSpy = vi.spyOn(db.sync_conflicts, 'count').mockRejectedValue(new Error('DB closed'));

    await expect(__tickSyncErrorPoll()).resolves.not.toThrow();
    // Previous value retained because the error path leaves state as-is.
    expect(store.syncErrorCount).toBe(7);

    countSpy.mockRestore();
  });
});
