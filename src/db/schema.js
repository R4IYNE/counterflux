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
  games: '++id, deck_id, started_at, ended_at'
});

export async function getBulkMeta() {
  return db.meta.get('bulk-data');
}

export async function setBulkMeta(meta) {
  return db.meta.put({ key: 'bulk-data', ...meta });
}
