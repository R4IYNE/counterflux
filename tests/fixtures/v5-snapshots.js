/**
 * Migration test fixtures (Phase 7 Plan 3 — Task 1).
 *
 * Opens a Dexie instance at an arbitrary historical version (v1..v5) and seeds
 * it with realistic user states for the migration v5→v7 test suite (Task 6).
 *
 * IMPORTANT: Each openAtVN helper declares the FULL schema chain up to N INLINE
 * — it deliberately does NOT import from `src/db/schema.js` because that module
 * extends through v7 during this plan and would force fixtures to open at v7.
 *
 * Per D-17 (07-CONTEXT.md): coverage = v1, v2, v3, v4, v5 fixtures × empty /
 * 500-card / 10-deck / active-game states.
 */
import Dexie from 'dexie';

// ------------------------------------------------------------
// openAtVN — open a fresh Dexie instance at exactly version N
// ------------------------------------------------------------

export async function openAtV1(dbName) {
  const db = new Dexie(dbName);
  db.version(1).stores({
    cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
    meta: 'key',
  });
  await db.open();
  return db;
}

export async function openAtV2(dbName) {
  const db = new Dexie(dbName);
  db.version(1).stores({
    cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
    meta: 'key',
  });
  db.version(2).stores({
    cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
    meta: 'key',
    collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]',
  });
  await db.open();
  return db;
}

export async function openAtV3(dbName) {
  const db = new Dexie(dbName);
  db.version(1).stores({
    cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
    meta: 'key',
  });
  db.version(2).stores({
    cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
    meta: 'key',
    collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]',
  });
  db.version(3).stores({
    cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
    meta: 'key',
    collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]',
    decks: '++id, name, format, updated_at',
    deck_cards: '++id, deck_id, scryfall_id, [deck_id+scryfall_id]',
  });
  await db.open();
  return db;
}

export async function openAtV4(dbName) {
  const db = new Dexie(dbName);
  db.version(1).stores({
    cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
    meta: 'key',
  });
  db.version(2).stores({
    cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
    meta: 'key',
    collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]',
  });
  db.version(3).stores({
    cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
    meta: 'key',
    collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]',
    decks: '++id, name, format, updated_at',
    deck_cards: '++id, deck_id, scryfall_id, [deck_id+scryfall_id]',
  });
  db.version(4).stores({
    cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
    meta: 'key',
    collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]',
    decks: '++id, name, format, updated_at',
    deck_cards: '++id, deck_id, scryfall_id, [deck_id+scryfall_id]',
    edhrec_cache: 'commander',
    combo_cache: 'deck_id',
    card_salt_cache: 'sanitized',
  });
  await db.open();
  return db;
}

export async function openAtV5(dbName) {
  const db = new Dexie(dbName);
  db.version(1).stores({
    cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
    meta: 'key',
  });
  db.version(2).stores({
    cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
    meta: 'key',
    collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]',
  });
  db.version(3).stores({
    cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
    meta: 'key',
    collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]',
    decks: '++id, name, format, updated_at',
    deck_cards: '++id, deck_id, scryfall_id, [deck_id+scryfall_id]',
  });
  db.version(4).stores({
    cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
    meta: 'key',
    collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]',
    decks: '++id, name, format, updated_at',
    deck_cards: '++id, deck_id, scryfall_id, [deck_id+scryfall_id]',
    edhrec_cache: 'commander',
    combo_cache: 'deck_id',
    card_salt_cache: 'sanitized',
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
    games: '++id, deck_id, started_at, ended_at',
  });
  await db.open();
  return db;
}

// ------------------------------------------------------------
// seed helpers — mutate the passed db instance
// ------------------------------------------------------------

export async function seedEmpty(_db) {
  // no-op — named helper for readability in tests
}

export async function seed500Cards(db) {
  const rows = Array.from({ length: 500 }, (_, i) => ({
    scryfall_id: `fixture-card-${i.toString().padStart(4, '0')}`,
    category: i % 5 === 0 ? 'wishlist' : 'collection',
    foil: i % 7 === 0,
    qty: 1 + (i % 4),
    added_at: Date.now() - i * 1000,
  }));
  await db.collection.bulkAdd(rows);
}

export async function seed10DecksWithCards(db) {
  // Insert 10 decks; capture their auto-assigned numeric ids; insert deck_cards referencing them.
  const deckIds = [];
  for (let i = 0; i < 10; i++) {
    const id = await db.decks.add({
      name: `Fixture Deck ${i}`,
      format: 'commander',
      updated_at: Date.now() - i * 60000,
      commander_id: `commander-fixture-${i}`,
    });
    deckIds.push(id);
  }
  // Use a deterministic counter instead of Math.random so tests are reproducible.
  let dcCounter = 0;
  for (const deckId of deckIds) {
    const cardCount = 5 + (dcCounter % 45); // 5..49 — deterministic spread
    dcCounter++;
    const dcRows = Array.from({ length: cardCount }, (_, k) => ({
      deck_id: deckId,
      scryfall_id: `dc-card-${deckId}-${k}`,
      qty: 1,
    }));
    await db.deck_cards.bulkAdd(dcRows);
  }
}

export async function seedActiveGame(db) {
  await db.games.add({
    deck_id: null,
    started_at: Date.now() - 3600000,
    ended_at: null,
    player_count: 4,
    turn_history: [
      { turn: 1, player: 0, duration_ms: 45000 },
      { turn: 2, player: 1, duration_ms: 60000 },
    ],
  });
}

// ------------------------------------------------------------
// Test harness helpers
// ------------------------------------------------------------

/**
 * Delete a test database cleanly. Used in beforeEach/afterEach hooks.
 */
export async function deleteTestDb(dbName) {
  await Dexie.delete(dbName);
}

/**
 * Open a fresh Dexie instance against `dbName` declaring the FULL production
 * v1..v7 chain inline, so migration tests exercise the exact production
 * upgrade callbacks without mutating the `src/db/schema.js` singleton.
 *
 * The store declarations here MUST remain byte-equivalent to those in
 * `src/db/schema.js` v1..v7. If the production chain changes, update this
 * helper too.
 */
export async function reopenAtV7(dbName) {
  const db = new Dexie(dbName);

  // v1..v5 — mirror of current production chain
  db.version(1).stores({
    cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
    meta: 'key',
  });
  db.version(2).stores({
    cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
    meta: 'key',
    collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]',
  });
  db.version(3).stores({
    cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
    meta: 'key',
    collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]',
    decks: '++id, name, format, updated_at',
    deck_cards: '++id, deck_id, scryfall_id, [deck_id+scryfall_id]',
  });
  db.version(4).stores({
    cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
    meta: 'key',
    collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]',
    decks: '++id, name, format, updated_at',
    deck_cards: '++id, deck_id, scryfall_id, [deck_id+scryfall_id]',
    edhrec_cache: 'commander',
    combo_cache: 'deck_id',
    card_salt_cache: 'sanitized',
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
    games: '++id, deck_id, started_at, ended_at',
  });

  // v6 — shadow *_next tables with UUID PKs; keeps legacy tables readable.
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
    sync_conflicts: '++id, table_name, detected_at',
  }).upgrade(async (tx) => {
    const now = Date.now();

    // 1. collection → collection_next
    const oldCollection = await tx.table('collection').toArray();
    for (const row of oldCollection) {
      const { id: _legacyId, ...rest } = row;
      await tx.table('collection_next').add({
        ...rest,
        id: crypto.randomUUID(),
        user_id: null,
        updated_at: now,
        synced_at: null,
      });
    }

    // 2. decks → decks_next (populate remap BEFORE deck_cards loop — Pitfall C)
    const oldDecks = await tx.table('decks').toArray();
    const deckRemap = new Map();
    for (const deck of oldDecks) {
      const newId = crypto.randomUUID();
      deckRemap.set(deck.id, newId);
      const { id: _legacyId, ...rest } = deck;
      await tx.table('decks_next').add({
        ...rest,
        id: newId,
        user_id: null,
        updated_at: deck.updated_at || now,
        synced_at: null,
      });
    }

    // 3. deck_cards → deck_cards_next with FK remap; orphans skipped.
    const oldDeckCards = await tx.table('deck_cards').toArray();
    for (const dc of oldDeckCards) {
      const newDeckId = deckRemap.get(dc.deck_id);
      if (!newDeckId) continue;
      const { id: _legacyId, ...rest } = dc;
      await tx.table('deck_cards_next').add({
        ...rest,
        id: crypto.randomUUID(),
        deck_id: newDeckId,
        user_id: null,
        updated_at: now,
        synced_at: null,
      });
    }

    // 4. games → games_next (+ turn_laps backfill + deck_id remap)
    const oldGames = await tx.table('games').toArray();
    for (const game of oldGames) {
      const newDeckId = game.deck_id != null ? (deckRemap.get(game.deck_id) ?? null) : null;
      const { id: _legacyId, ...rest } = game;
      await tx.table('games_next').add({
        ...rest,
        id: crypto.randomUUID(),
        deck_id: newDeckId,
        user_id: null,
        turn_laps: Array.isArray(game.turn_laps) ? game.turn_laps : [],
        updated_at: now,
        synced_at: null,
      });
    }

    // 5. watchlist → watchlist_next
    const oldWatchlist = await tx.table('watchlist').toArray();
    for (const row of oldWatchlist) {
      const { id: _legacyId, ...rest } = row;
      await tx.table('watchlist_next').add({
        ...rest,
        id: crypto.randomUUID(),
        user_id: null,
        updated_at: now,
        synced_at: null,
      });
    }

    // 6. price_history.updated_at backfill (no PK change)
    await tx.table('price_history').toCollection().modify((row) => {
      if (row.updated_at == null) row.updated_at = now;
    });

    // 7. schema_version meta row
    await tx.table('meta').put({
      key: 'schema_version',
      version: 6,
      migrated_at: new Date().toISOString(),
    });
  });

  // v7 — drop legacy autoincrement tables; *_next remains canonical.
  db.version(7).stores({
    cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
    meta: 'key',
    collection: null,
    decks: null,
    deck_cards: null,
    games: null,
    watchlist: null,
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
  }).upgrade(async (tx) => {
    await tx.table('meta').put({
      key: 'schema_version',
      version: 7,
      migrated_at: new Date().toISOString(),
    });
  });

  await db.open();
  return db;
}
