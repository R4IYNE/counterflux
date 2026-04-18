// tests/sync-schema-v10.test.js
// Phase 11 Plan 1 Wave 0 — Dexie v9→v10 migration gate (SYNC-01).
//
// Asserts that src/db/schema.js declares v10 and that v10 adds a `deleted_at`
// indexed column to the 5 synced data tables (collection, decks, deck_cards,
// games, watchlist) while leaving `profile` unchanged (per D-15). Additive
// migration — no upgrade callback, no data loss on existing rows, UUID
// creating-hook still fires for newly inserted rows.
//
// This test RED's against src/db/schema.js while the file is still at v9;
// Task 2 (the v10 additive bump) flips it GREEN. The tests import the live
// `db` singleton so a regression to v9 would re-RED them.
//
// Pattern: fake-indexeddb + Dexie.delete between tests for isolation.

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import 'fake-indexeddb/auto';
import { db as prodDb } from '../src/db/schema.js';

const DB_NAME = 'counterflux-test-v10';

function declareV1toV9(db) {
  db.version(1).stores({
    cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
    meta: 'key'
  });
  db.version(2).stores({
    cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
    meta: 'key',
    collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]'
  });
  db.version(3).stores({
    cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
    meta: 'key',
    collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]',
    decks: '++id, name, format, updated_at',
    deck_cards: '++id, deck_id, scryfall_id, [deck_id+scryfall_id]'
  });
  db.version(4).stores({
    cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
    meta: 'key',
    collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]',
    decks: '++id, name, format, updated_at',
    deck_cards: '++id, deck_id, scryfall_id, [deck_id+scryfall_id]',
    edhrec_cache: 'commander',
    combo_cache: 'deck_id',
    card_salt_cache: 'sanitized'
  });
  db.version(5).stores({
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
    games: '++id, deck_id, started_at, ended_at'
  });
  db.version(6).stores({
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
    sync_conflicts: '++id, table_name, detected_at'
  });
  db.version(7).stores({
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
    sync_conflicts: '++id, table_name, detected_at'
  });
  db.version(8).stores({
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
    sync_conflicts: '++id, table_name, detected_at'
  });
  db.version(9).stores({
    collection: 'id, scryfall_id, category, foil, user_id, updated_at, synced_at, [scryfall_id+foil], [scryfall_id+category]',
    decks: 'id, name, format, user_id, updated_at, synced_at',
    deck_cards: 'id, deck_id, scryfall_id, user_id, updated_at, synced_at, [deck_id+scryfall_id]',
    games: 'id, deck_id, user_id, started_at, ended_at, updated_at, synced_at',
    watchlist: 'id, &scryfall_id, user_id, updated_at, synced_at',
    cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
    meta: 'key',
    price_history: '++id, scryfall_id, date, updated_at, [scryfall_id+date]',
    edhrec_cache: 'commander',
    combo_cache: 'deck_id',
    card_salt_cache: 'sanitized',
    profile: 'id, user_id, updated_at',
    sync_queue: '++id, table_name, user_id, created_at',
    sync_conflicts: '++id, table_name, detected_at',
    precons_cache: 'code, set_type, released_at, updated_at'
  });
}

/** Install the same UUID-auto-assign hook pattern used by src/db/schema.js. */
function installUuidHooks(db) {
  const UUID_TABLES = ['collection', 'decks', 'deck_cards', 'games', 'watchlist', 'profile'];
  for (const tableName of UUID_TABLES) {
    db.table(tableName).hook('creating', function (primKey, obj) {
      if (obj && obj.id == null) {
        obj.id = crypto.randomUUID();
      }
    });
  }
}

beforeEach(async () => {
  await Dexie.delete(DB_NAME);
});

afterEach(async () => {
  await Dexie.delete(DB_NAME);
});

describe('Dexie v9→v10 migration — deleted_at additive column (SYNC-01)', () => {
  test('src/db/schema.js declares v10 with deleted_at on the 5 synced data tables', async () => {
    // Read prodDb's verno (highest declared version). v10 must be declared.
    expect(prodDb.verno).toBeGreaterThanOrEqual(10);

    // Open a throwaway copy that mirrors the production declaration chain.
    // We inspect the prod Dexie instance's table schemas directly — if open
    // hasn't been called yet in this test context, we need to open it against
    // fake-indexeddb so runtime schema metadata is available.
    if (!prodDb.isOpen()) {
      try {
        await prodDb.open();
      } catch (e) {
        // The prod db target is named 'counterflux' — fake-indexeddb accepts it.
        // If open fails, surface that as a hard failure.
        throw e;
      }
    }

    const schemaFor = (tableName) => {
      const t = prodDb.table(tableName);
      const primKeyName = t.schema.primKey?.name ?? '';
      const indexNames = t.schema.indexes.map((i) => i.name);
      return [primKeyName, ...indexNames];
    };

    // The 5 synced data tables MUST have deleted_at as an indexed column.
    for (const tableName of ['collection', 'decks', 'deck_cards', 'games', 'watchlist']) {
      const names = schemaFor(tableName);
      expect(
        names.includes('deleted_at'),
        `${tableName} should declare deleted_at in v10 schema string (got [${names.join(', ')}])`
      ).toBe(true);
    }

    // Profile MUST NOT gain a deleted_at index (D-15 — profile is never soft-deleted).
    const profileNames = schemaFor('profile');
    expect(
      profileNames.includes('deleted_at'),
      'profile must NOT include deleted_at (D-15)'
    ).toBe(false);
  });

  test('v9→v10 upgrade preserves existing rows with deleted_at undefined/null', async () => {
    // 1. Open at v9, seed rows. This exercises the isolated test DB, not prod.
    const seedDb = new Dexie(DB_NAME);
    declareV1toV9(seedDb);
    await seedDb.open();

    const deckId = crypto.randomUUID();
    await seedDb.table('collection').bulkAdd([
      { id: crypto.randomUUID(), scryfall_id: 'abc', category: 'main', foil: false, user_id: null, updated_at: Date.now(), synced_at: null },
      { id: crypto.randomUUID(), scryfall_id: 'def', category: 'main', foil: false, user_id: null, updated_at: Date.now(), synced_at: null },
      { id: crypto.randomUUID(), scryfall_id: 'ghi', category: 'sideboard', foil: true, user_id: null, updated_at: Date.now(), synced_at: null },
    ]);
    await seedDb.table('decks').add({
      id: deckId,
      name: 'Test Deck',
      format: 'commander',
      user_id: null,
      updated_at: Date.now(),
      synced_at: null
    });
    await seedDb.table('games').bulkAdd([
      { id: crypto.randomUUID(), deck_id: deckId, user_id: null, started_at: Date.now(), ended_at: Date.now(), updated_at: Date.now(), synced_at: null },
      { id: crypto.randomUUID(), deck_id: deckId, user_id: null, started_at: Date.now(), ended_at: Date.now(), updated_at: Date.now(), synced_at: null },
    ]);
    seedDb.close();

    // 2. Re-open at v10 (same declaration chain as prod, just under the test DB name).
    const db = new Dexie(DB_NAME);
    declareV1toV9(db);
    db.version(10).stores({
      collection: 'id, scryfall_id, category, foil, user_id, updated_at, synced_at, deleted_at, [scryfall_id+foil], [scryfall_id+category]',
      decks: 'id, name, format, user_id, updated_at, synced_at, deleted_at',
      deck_cards: 'id, deck_id, scryfall_id, user_id, updated_at, synced_at, deleted_at, [deck_id+scryfall_id]',
      games: 'id, deck_id, user_id, started_at, ended_at, updated_at, synced_at, deleted_at',
      watchlist: 'id, &scryfall_id, user_id, updated_at, synced_at, deleted_at',
      cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
      meta: 'key',
      price_history: '++id, scryfall_id, date, updated_at, [scryfall_id+date]',
      edhrec_cache: 'commander',
      combo_cache: 'deck_id',
      card_salt_cache: 'sanitized',
      profile: 'id, user_id, updated_at',
      sync_queue: '++id, table_name, user_id, created_at',
      sync_conflicts: '++id, table_name, detected_at',
      precons_cache: 'code, set_type, released_at, updated_at'
    });
    await db.open();

    // Rows still present.
    const collectionRows = await db.table('collection').toArray();
    const decksRows = await db.table('decks').toArray();
    const gamesRows = await db.table('games').toArray();

    expect(collectionRows).toHaveLength(3);
    expect(decksRows).toHaveLength(1);
    expect(gamesRows).toHaveLength(2);

    // Every row's deleted_at is undefined (additive; Dexie treats undefined as "not present").
    for (const row of collectionRows) {
      expect(row.deleted_at).toBeUndefined();
    }
    for (const row of decksRows) {
      expect(row.deleted_at).toBeUndefined();
    }
    for (const row of gamesRows) {
      expect(row.deleted_at).toBeUndefined();
    }

    db.close();
  });

  test('UUID creating-hook still fires on v10 — new row without id gets crypto.randomUUID()', async () => {
    const db = new Dexie(DB_NAME);
    declareV1toV9(db);
    db.version(10).stores({
      collection: 'id, scryfall_id, category, foil, user_id, updated_at, synced_at, deleted_at, [scryfall_id+foil], [scryfall_id+category]',
      decks: 'id, name, format, user_id, updated_at, synced_at, deleted_at',
      deck_cards: 'id, deck_id, scryfall_id, user_id, updated_at, synced_at, deleted_at, [deck_id+scryfall_id]',
      games: 'id, deck_id, user_id, started_at, ended_at, updated_at, synced_at, deleted_at',
      watchlist: 'id, &scryfall_id, user_id, updated_at, synced_at, deleted_at',
      cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
      meta: 'key',
      price_history: '++id, scryfall_id, date, updated_at, [scryfall_id+date]',
      edhrec_cache: 'commander',
      combo_cache: 'deck_id',
      card_salt_cache: 'sanitized',
      profile: 'id, user_id, updated_at',
      sync_queue: '++id, table_name, user_id, created_at',
      sync_conflicts: '++id, table_name, detected_at',
      precons_cache: 'code, set_type, released_at, updated_at'
    });
    installUuidHooks(db);
    await db.open();

    // Insert without supplying id — hook must stamp one.
    await db.table('collection').add({
      scryfall_id: 'xyz',
      category: 'main',
      foil: false,
      user_id: null,
      updated_at: Date.now(),
      synced_at: null
    });

    const rows = await db.table('collection').toArray();
    expect(rows).toHaveLength(1);
    expect(typeof rows[0].id).toBe('string');
    // UUID v4 shape: 8-4-4-4-12 hex
    expect(rows[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(rows[0].deleted_at).toBeUndefined();

    db.close();
  });
});
