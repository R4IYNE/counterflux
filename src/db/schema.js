import Dexie from 'dexie';

export const db = new Dexie('counterflux');

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

// ============================================================
// Schema v6 — Phase 7 Plan 3 (variant a — _next suffix, confirmed by
// tests/schema-rename-spike.test.js).
//
// Creates `*_next` shadow tables with the FINAL UUID-PK shape + sync fields.
// Keeps the original autoincrement tables declared so the upgrade callback
// can read from them. Adds sync_queue, sync_conflicts, profile under their
// final clean names (they carry no legacy data; no rename needed). Adds
// price_history.updated_at (no PK change — straight index add via modify()).
// Writes schema_version meta row.
//
// Backfills per D-07..D-09:
//   - updated_at = Date.now() at migration time
//   - synced_at  = null
//   - user_id    = null
//   - games.turn_laps = [] when absent
//
// FK ordering (Pitfall C): decks_next is fully populated BEFORE deck_cards_next
// iteration so the deckRemap Map is complete. Orphan deck_cards (deck_id
// pointing at a deleted deck) are logged + skipped, never crash the upgrade.
//
// Progress (D-17a): total row count is captured first, then
// `Alpine.store('bulkdata').migrationProgress` is updated at ~10% increments
// so the splash-screen indicator can render while the upgrade runs.
// ============================================================
db.version(6).stores({
  // Legacy v5 tables — kept declared so tx.table('collection') etc. works
  cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
  meta: 'key',
  collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]',
  decks: '++id, name, format, updated_at',
  deck_cards: '++id, deck_id, scryfall_id, [deck_id+scryfall_id]',
  games: '++id, deck_id, started_at, ended_at',
  watchlist: '++id, &scryfall_id',
  price_history: '++id, scryfall_id, date, updated_at, [scryfall_id+date]', // D-11: add updated_at index
  edhrec_cache: 'commander',
  combo_cache: 'deck_id',
  card_salt_cache: 'sanitized',

  // Shadow tables with final UUID-PK shape + sync fields (D-01a shuffle)
  collection_next: 'id, scryfall_id, category, foil, user_id, updated_at, synced_at, [scryfall_id+foil], [scryfall_id+category]',
  decks_next: 'id, name, format, user_id, updated_at, synced_at',
  deck_cards_next: 'id, deck_id, scryfall_id, user_id, updated_at, synced_at, [deck_id+scryfall_id]',
  games_next: 'id, deck_id, user_id, started_at, ended_at, updated_at, synced_at',
  watchlist_next: 'id, &scryfall_id, user_id, updated_at, synced_at',

  // New final-shape tables (D-04..D-06, D-10) — ship under clean names from v6
  profile: 'id, user_id, updated_at',
  sync_queue: '++id, table_name, user_id, created_at',
  sync_conflicts: '++id, table_name, detected_at'
}).upgrade(async (tx) => {
  try {
    const now = Date.now();

    // Count total rows across the five migrated tables (D-17a progress accounting)
    const [cC, cD, cDC, cG, cW] = await Promise.all([
      tx.table('collection').count(),
      tx.table('decks').count(),
      tx.table('deck_cards').count(),
      tx.table('games').count(),
      tx.table('watchlist').count()
    ]);
    const totalRows = cC + cD + cDC + cG + cW;
    let processed = 0;
    let lastEmittedPct = -1;
    const emitProgress = () => {
      const pct = totalRows > 0 ? Math.floor((processed / totalRows) * 100) : 100;
      if (pct - lastEmittedPct >= 10 || pct === 100) {
        try {
          if (typeof window !== 'undefined' && window.Alpine?.store) {
            const store = window.Alpine.store('bulkdata');
            if (store) store.migrationProgress = pct;
          }
        } catch {
          /* decorative — never block the upgrade on UI write failures */
        }
        lastEmittedPct = pct;
      }
    };

    // 1. collection → collection_next
    const oldCollection = await tx.table('collection').toArray();
    for (const row of oldCollection) {
      const { id: _legacyId, ...rest } = row;
      await tx.table('collection_next').add({
        ...rest,
        id: crypto.randomUUID(),
        user_id: null,
        updated_at: now,
        synced_at: null
      });
      processed++;
      emitProgress();
    }

    // 2. decks → decks_next (Pitfall C: populate deckRemap FULLY before deck_cards loop)
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
        synced_at: null
      });
      processed++;
      emitProgress();
    }
    if (deckRemap.size !== oldDecks.length) {
      throw new Error(`[migration v6] deckRemap size mismatch: ${deckRemap.size} vs ${oldDecks.length}`);
    }

    // 3. deck_cards → deck_cards_next with FK remap (D-02). Orphans skipped.
    const oldDeckCards = await tx.table('deck_cards').toArray();
    for (const dc of oldDeckCards) {
      const newDeckId = deckRemap.get(dc.deck_id);
      if (!newDeckId) {
        console.warn('[migration v6] orphan deck_card skipped:', dc);
        processed++;
        emitProgress();
        continue;
      }
      const { id: _legacyId, ...rest } = dc;
      await tx.table('deck_cards_next').add({
        ...rest,
        id: crypto.randomUUID(),
        deck_id: newDeckId,
        user_id: null,
        updated_at: now,
        synced_at: null
      });
      processed++;
      emitProgress();
    }

    // 4. games → games_next (+ turn_laps backfill D-09 + deck_id FK remap)
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
        synced_at: null
      });
      processed++;
      emitProgress();
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
        synced_at: null
      });
      processed++;
      emitProgress();
    }

    // 6. price_history.updated_at backfill (D-11; no PK change — straight modify)
    await tx.table('price_history').toCollection().modify((row) => {
      if (row.updated_at == null) row.updated_at = now;
    });

    // 7. schema_version meta row (D-12)
    await tx.table('meta').put({
      key: 'schema_version',
      version: 6,
      migrated_at: new Date().toISOString()
    });

    emitProgress(); // final 100%
  } catch (e) {
    console.error('[migration v6] FAILED', e);
    throw e;
  }
});

// ============================================================
// Schema v7 — drop-legacy phase (variant a).
//
// Dexie cannot rename tables within one version, so we null-drop the legacy
// autoincrement tables here. The `*_next` tables remain under their suffixed
// names — these become the PERMANENT names consumed by Phase 9 (turn_laps)
// and Phase 11 (sync engine). A future milestone can collapse the `_next`
// suffix via a v8 bump (proven feasible by tests/schema-rename-spike.test.js
// Test 3); for now, ugly-but-correct is the right trade-off.
// ============================================================
db.version(7).stores({
  // Drop legacy autoincrement tables (key appears once per literal — as null)
  collection: null,
  decks: null,
  deck_cards: null,
  games: null,
  watchlist: null,

  // Keep migrated tables under their canonical (_next) names
  collection_next: 'id, scryfall_id, category, foil, user_id, updated_at, synced_at, [scryfall_id+foil], [scryfall_id+category]',
  decks_next: 'id, name, format, user_id, updated_at, synced_at',
  deck_cards_next: 'id, deck_id, scryfall_id, user_id, updated_at, synced_at, [deck_id+scryfall_id]',
  games_next: 'id, deck_id, user_id, started_at, ended_at, updated_at, synced_at',
  watchlist_next: 'id, &scryfall_id, user_id, updated_at, synced_at',

  // Unchanged pass-through
  cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
  meta: 'key',
  price_history: '++id, scryfall_id, date, updated_at, [scryfall_id+date]',
  edhrec_cache: 'commander',
  combo_cache: 'deck_id',
  card_salt_cache: 'sanitized',
  profile: 'id, user_id, updated_at',
  sync_queue: '++id, table_name, user_id, created_at',
  sync_conflicts: '++id, table_name, detected_at'
}).upgrade(async (tx) => {
  try {
    // Legacy autoincrement tables were dropped by the stores() declaration
    // above. `*_next` carries all migrated rows forward. The only work here
    // is updating the schema_version row so the meta table reflects the
    // reached version — used by debug logs + future cloud error reports.
    await tx.table('meta').put({
      key: 'schema_version',
      version: 7,
      migrated_at: new Date().toISOString()
    });

    // Reset migrationProgress to 100 so any lingering splash indicator clears
    try {
      if (typeof window !== 'undefined' && window.Alpine?.store) {
        const store = window.Alpine.store('bulkdata');
        if (store) store.migrationProgress = 100;
      }
    } catch {
      /* decorative */
    }
  } catch (e) {
    console.error('[migration v7] FAILED', e);
    throw e;
  }
});

export async function getBulkMeta() {
  return db.meta.get('bulk-data');
}

export async function setBulkMeta(meta) {
  return db.meta.put({ key: 'bulk-data', ...meta });
}
