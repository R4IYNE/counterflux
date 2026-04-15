/**
 * Web Worker for Scryfall bulk data download, stream-parsing, and Dexie storage.
 *
 * CRITICAL: Dexie runs INSIDE this Worker. Card data never crosses the Worker
 * boundary via postMessage. Only progress numbers and control messages cross.
 * This avoids serializing 300MB of card data.
 *
 * Message protocol:
 *   Main -> Worker:
 *     { type: 'start', downloadUri, expectedSize }
 *     { type: 'check', cachedUpdatedAt }
 *
 *   Worker -> Main:
 *     { type: 'progress', downloaded, total, parsed }
 *     { type: 'complete', totalParsed }
 *     { type: 'error', message }
 *     { type: 'check-result', needsRefresh, downloadUri, updatedAt, expectedSize }
 */
import Dexie from 'dexie';
import { processStream } from './bulk-data-pipeline.js';

// CRITICAL: Identical schema to src/db/schema.js — Dexie in the Worker
// accesses the same IndexedDB database named 'counterflux'
const db = new Dexie('counterflux');
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
// Phase 7 Plan 3 — mirror of main-thread v6 + v7 declarations.
// The worker only TOUCHES `cards` and `meta`, but Dexie requires every
// connection to the same IDB to declare the full schema chain. No .upgrade()
// callbacks here — only the main thread runs the upgrade via
// src/services/migration.js; the worker just needs matching store declarations
// so Dexie's schema-version compare passes when it opens after the upgrade.
// ============================================================
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

const SCRYFALL_BULK_API = 'https://api.scryfall.com/bulk-data/default-cards';
const USER_AGENT = 'Counterflux/1.0 (MTG collection manager)';

self.onmessage = async (e) => {
  const { type } = e.data;

  if (type === 'start') {
    const { downloadUri, expectedSize } = e.data;

    try {
      const response = await fetch(downloadUri, {
        headers: { 'User-Agent': USER_AGENT }
      });

      if (!response.ok) {
        self.postMessage({ type: 'error', message: `Download failed: HTTP ${response.status}` });
        return;
      }

      // CRITICAL: Use expectedSize from bulk-data metadata (the `size` field),
      // NOT Content-Length header (may be missing due to chunked transfer encoding)
      await processStream({
        stream: response.body,
        expectedSize,
        db,
        batchSize: 1000,
        onMessage: (msg) => self.postMessage(msg)
      });
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message || String(err) });
    }
  }

  if (type === 'check') {
    const { cachedUpdatedAt } = e.data;

    try {
      // CRITICAL: Always fetch fresh metadata — never cache download_uri
      const response = await fetch(SCRYFALL_BULK_API, {
        headers: { 'User-Agent': USER_AGENT }
      });

      if (!response.ok) {
        self.postMessage({ type: 'error', message: `Metadata check failed: HTTP ${response.status}` });
        return;
      }

      const data = await response.json();
      const serverUpdatedAt = data.updated_at;
      const needsRefresh = !cachedUpdatedAt || new Date(serverUpdatedAt) > new Date(cachedUpdatedAt);

      self.postMessage({
        type: 'check-result',
        needsRefresh,
        downloadUri: data.download_uri,
        updatedAt: serverUpdatedAt,
        expectedSize: data.size
      });
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message || String(err) });
    }
  }
};
