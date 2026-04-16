/**
 * COLLECT-02 / D-07 / D-24: Dexie v9 additive schema bump.
 *
 * These tests target the PRODUCTION schema module (src/db/schema.js). They
 * will fail until Task 3 declares v9 in that module with the precons_cache
 * store. The tests assert:
 *   - Test 1: Fresh open of the production DB reports verno >= 9 and
 *     precons_cache is queryable.
 *   - Test 2: v8 → v9 additive: pre-seeding v8 data then opening the
 *     production schema preserves collection rows (additive-only migration).
 *   - Test 3: precons_cache indices (set_type, released_at) support lookups.
 *   - Test 4: precons_cache is a string-PK table — inserting without `code`
 *     throws (confirms UUID_TABLES was NOT extended to include it).
 *
 * NOTE: the production src/db/schema.js uses a hard-coded database name
 * ('counterflux'). fake-indexeddb isolates us; vitest order matters. We reset
 * the counterflux database between tests via `db.delete()`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';

const COUNTERFLUX_DB = 'counterflux';

// Helper to delete any existing counterflux DB so the production module opens fresh
async function freshDb() {
  try {
    // Close any open production instance
    const { db } = await import('../src/db/schema.js');
    if (db.isOpen()) await db.close();
  } catch {
    /* ignore */
  }
  await Dexie.delete(COUNTERFLUX_DB);
}

describe('Dexie v9 additive schema (COLLECT-02 / D-07 / D-24)', () => {
  beforeEach(async () => {
    await freshDb();
  });
  afterEach(async () => {
    await freshDb();
  });

  it('Test 1 — Fresh production DB opens at v9 with precons_cache queryable', async () => {
    const { db } = await import('../src/db/schema.js');
    await db.open();
    expect(db.verno).toBeGreaterThanOrEqual(9);
    const preconsTable = db.tables.find((t) => t.name === 'precons_cache');
    expect(preconsTable).toBeDefined();
    // Queryable (no throw) — count is 0 on fresh DB
    expect(await db.precons_cache.count()).toBe(0);
  });

  it('Test 2 — v8 data survives the v8 → v9 additive upgrade', async () => {
    // Pre-open the counterflux DB at v8 only (inline, halting before v9)
    const v8 = new Dexie(COUNTERFLUX_DB);
    v8.version(1).stores({
      cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
      meta: 'key',
    });
    v8.version(2).stores({
      cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
      meta: 'key',
      collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]',
    });
    v8.version(3).stores({
      cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
      meta: 'key',
      collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]',
      decks: '++id, name, format, updated_at',
      deck_cards: '++id, deck_id, scryfall_id, [deck_id+scryfall_id]',
    });
    v8.version(4).stores({
      cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
      meta: 'key',
      collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]',
      decks: '++id, name, format, updated_at',
      deck_cards: '++id, deck_id, scryfall_id, [deck_id+scryfall_id]',
      edhrec_cache: 'commander',
      combo_cache: 'deck_id',
      card_salt_cache: 'sanitized',
    });
    v8.version(5).stores({
      cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
      meta: 'key',
      collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]',
      decks: '++id, name, format, updated_at',
      deck_cards: '++id, deck_id, scryfall_id, [deck_id+scryfall_id]',
      edhrec_cache: 'commander',
      combo_cache: 'deck_id',
      card_salt_cache: 'sanitized',
      watchlist: '++id, &scryfall_id',
      price_history: '++id, scryfall_id, date, [scryfall_id+date]',
      games: '++id, deck_id, started_at, ended_at',
    });
    v8.version(6).stores({
      cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
      meta: 'key',
      collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]',
      decks: '++id, name, format, updated_at',
      deck_cards: '++id, deck_id, scryfall_id, [deck_id+scryfall_id]',
      games: '++id, deck_id, started_at, ended_at',
      watchlist: '++id, &scryfall_id',
      price_history: '++id, scryfall_id, date, updated_at, [scryfall_id+date]',
      edhrec_cache: 'commander',
      combo_cache: 'deck_id',
      card_salt_cache: 'sanitized',
      collection_next: 'id, scryfall_id, category, foil, user_id, updated_at, synced_at, [scryfall_id+foil], [scryfall_id+category]',
      decks_next: 'id, name, format, user_id, updated_at, synced_at',
      deck_cards_next: 'id, deck_id, scryfall_id, user_id, updated_at, synced_at, [deck_id+scryfall_id]',
      games_next: 'id, deck_id, user_id, started_at, ended_at, updated_at, synced_at',
      watchlist_next: 'id, &scryfall_id, user_id, updated_at, synced_at',
      profile: 'id, user_id, updated_at',
      sync_queue: '++id, table_name, user_id, created_at',
      sync_conflicts: '++id, table_name, detected_at',
    });
    v8.version(7).stores({
      collection: null,
      decks: null,
      deck_cards: null,
      games: null,
      watchlist: null,
      collection_next: 'id, scryfall_id, category, foil, user_id, updated_at, synced_at, [scryfall_id+foil], [scryfall_id+category]',
      decks_next: 'id, name, format, user_id, updated_at, synced_at',
      deck_cards_next: 'id, deck_id, scryfall_id, user_id, updated_at, synced_at, [deck_id+scryfall_id]',
      games_next: 'id, deck_id, user_id, started_at, ended_at, updated_at, synced_at',
      watchlist_next: 'id, &scryfall_id, user_id, updated_at, synced_at',
      cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
      meta: 'key',
      price_history: '++id, scryfall_id, date, updated_at, [scryfall_id+date]',
      edhrec_cache: 'commander',
      combo_cache: 'deck_id',
      card_salt_cache: 'sanitized',
      profile: 'id, user_id, updated_at',
      sync_queue: '++id, table_name, user_id, created_at',
      sync_conflicts: '++id, table_name, detected_at',
    });
    v8.version(8).stores({
      collection: 'id, scryfall_id, category, foil, user_id, updated_at, synced_at, [scryfall_id+foil], [scryfall_id+category]',
      decks: 'id, name, format, user_id, updated_at, synced_at',
      deck_cards: 'id, deck_id, scryfall_id, user_id, updated_at, synced_at, [deck_id+scryfall_id]',
      games: 'id, deck_id, user_id, started_at, ended_at, updated_at, synced_at',
      watchlist: 'id, &scryfall_id, user_id, updated_at, synced_at',
      collection_next: null,
      decks_next: null,
      deck_cards_next: null,
      games_next: null,
      watchlist_next: null,
      cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
      meta: 'key',
      price_history: '++id, scryfall_id, date, updated_at, [scryfall_id+date]',
      edhrec_cache: 'commander',
      combo_cache: 'deck_id',
      card_salt_cache: 'sanitized',
      profile: 'id, user_id, updated_at',
      sync_queue: '++id, table_name, user_id, created_at',
      sync_conflicts: '++id, table_name, detected_at',
    });
    await v8.open();
    await v8.collection.bulkAdd([
      { id: crypto.randomUUID(), scryfall_id: 'card-a', category: 'owned', foil: 0, quantity: 1, updated_at: Date.now(), synced_at: null, user_id: null },
      { id: crypto.randomUUID(), scryfall_id: 'card-b', category: 'owned', foil: 0, quantity: 2, updated_at: Date.now(), synced_at: null, user_id: null },
      { id: crypto.randomUUID(), scryfall_id: 'card-c', category: 'wishlist', foil: 1, quantity: 1, updated_at: Date.now(), synced_at: null, user_id: null },
    ]);
    expect(await v8.collection.count()).toBe(3);
    await v8.close();

    // Now open via the production module (which declares through v9)
    const { db } = await import('../src/db/schema.js');
    await db.open();
    expect(db.verno).toBeGreaterThanOrEqual(9);
    expect(await db.collection.count()).toBe(3);
    const rows = await db.collection.toArray();
    expect(rows.map((r) => r.scryfall_id).sort()).toEqual(['card-a', 'card-b', 'card-c']);
    expect(await db.precons_cache.count()).toBe(0);
  });

  it('Test 3 — precons_cache indices (set_type, released_at) support lookups', async () => {
    const { db } = await import('../src/db/schema.js');
    await db.open();
    const now = Date.now();
    await db.precons_cache.bulkPut([
      { code: 'cmm', name: 'Commander Masters', set_type: 'commander', released_at: '2023-08-04', image_url: '', search_uri: '', decklist: null, updated_at: now },
      { code: 'dd2', name: 'Duel Decks: Jace vs Chandra', set_type: 'duel_deck', released_at: '2008-11-07', image_url: '', search_uri: '', decklist: null, updated_at: now },
      { code: 'woc', name: 'Wilds of Eldraine Commander', set_type: 'commander', released_at: '2023-09-08', image_url: '', search_uri: '', decklist: null, updated_at: now },
    ]);
    const byCode = await db.precons_cache.get('cmm');
    expect(byCode).toBeDefined();
    expect(byCode.name).toBe('Commander Masters');

    const commanders = await db.precons_cache.where('set_type').equals('commander').toArray();
    expect(commanders).toHaveLength(2);

    const by2023 = await db.precons_cache.where('released_at').above('2023-01-01').toArray();
    expect(by2023.length).toBeGreaterThanOrEqual(2);
  });

  it('Test 4 — precons_cache is a string-PK table (NOT extended UUID_TABLES) — add() without code throws', async () => {
    const { db } = await import('../src/db/schema.js');
    await db.open();
    let threw = false;
    try {
      await db.precons_cache.add({
        name: 'Should Fail',
        set_type: 'commander',
        released_at: '2024-01-01',
        updated_at: Date.now(),
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});
