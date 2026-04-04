import Dexie from 'dexie';

export const db = new Dexie('counterflux');

db.version(1).stores({
  cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
  meta: 'key'
});

export async function getBulkMeta() {
  return db.meta.get('bulk-data');
}

export async function setBulkMeta(meta) {
  return db.meta.put({ key: 'bulk-data', ...meta });
}
