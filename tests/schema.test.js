import { describe, it, expect, beforeEach } from 'vitest';
import { db, getBulkMeta, setBulkMeta } from '../src/db/schema.js';

describe('Dexie schema', () => {
  beforeEach(async () => {
    // Clear tables between tests
    await db.cards.clear();
    await db.meta.clear();
  });

  it('db.cards and db.meta tables are accessible after schema init', () => {
    expect(db.cards).toBeDefined();
    expect(db.meta).toBeDefined();
    expect(db.name).toBe('counterflux');
  });

  it('schema version(1) creates indexed fields including compound [set+collector_number]', () => {
    const cardsSchema = db.tables.find(t => t.name === 'cards');
    expect(cardsSchema).toBeDefined();

    // Check that the schema string includes the compound index
    const schema = cardsSchema.schema;
    expect(schema.primKey.name).toBe('id');

    const indexNames = schema.indexes.map(i => i.name);
    expect(indexNames).toContain('name');
    expect(indexNames).toContain('oracle_id');
    expect(indexNames).toContain('set');
    expect(indexNames).toContain('collector_number');
    expect(indexNames).toContain('cmc');
    expect(indexNames).toContain('[set+collector_number]');
  });

  it('getBulkMeta returns undefined when no data stored', async () => {
    const result = await getBulkMeta();
    expect(result).toBeUndefined();
  });

  it('setBulkMeta stores and retrieves metadata', async () => {
    await setBulkMeta({ updated_at: '2026-04-01T00:00:00Z', card_count: 100000 });
    const result = await getBulkMeta();
    expect(result).toBeDefined();
    expect(result.key).toBe('bulk-data');
    expect(result.updated_at).toBe('2026-04-01T00:00:00Z');
    expect(result.card_count).toBe(100000);
  });

  it('can insert and retrieve a card from cards table', async () => {
    const card = {
      id: 'test-123',
      name: 'Test Card',
      oracle_id: 'oracle-123',
      set: 'tst',
      collector_number: '1',
      cmc: 3,
      color_identity: ['U'],
      type_line: 'Instant',
    };
    await db.cards.put(card);
    const retrieved = await db.cards.get('test-123');
    expect(retrieved.name).toBe('Test Card');
  });
});

describe('v8 schema shape (Phase 7 Plan 3 — SCHEMA-01, variant c with clean names)', () => {
  it('db.verno is 8 after open', () => {
    expect(db.verno >= 0).toBe(true); // sanity
    return db.open().then(() => {
      expect(db.verno).toBe(8);
    });
  });

  it('clean-named tables exist at v8 with text UUID PK (auto === false)', async () => {
    await db.open();
    const names = db.tables.map((t) => t.name);
    for (const t of ['collection', 'decks', 'deck_cards', 'games', 'watchlist']) {
      expect(names).toContain(t);
    }
    const collection = db.tables.find((t) => t.name === 'collection');
    expect(collection.schema.primKey.name).toBe('id');
    expect(collection.schema.primKey.auto).toBeFalsy();
  });

  it('shadow *_next tables are dropped at v8', async () => {
    await db.open();
    const names = db.tables.map((t) => t.name);
    expect(names).not.toContain('collection_next');
    expect(names).not.toContain('decks_next');
    expect(names).not.toContain('deck_cards_next');
    expect(names).not.toContain('games_next');
    expect(names).not.toContain('watchlist_next');
  });

  it('collection indexes include user_id, updated_at, synced_at', async () => {
    await db.open();
    const collection = db.tables.find((t) => t.name === 'collection');
    const indexNames = collection.schema.indexes.map((i) => i.name);
    expect(indexNames).toContain('user_id');
    expect(indexNames).toContain('updated_at');
    expect(indexNames).toContain('synced_at');
  });

  it('sync_queue has ++id auto PK; profile has text PK', async () => {
    await db.open();
    const syncQueue = db.tables.find((t) => t.name === 'sync_queue');
    const profile = db.tables.find((t) => t.name === 'profile');
    expect(syncQueue).toBeDefined();
    expect(profile).toBeDefined();
    expect(syncQueue.schema.primKey.auto).toBe(true);
    expect(profile.schema.primKey.auto).toBeFalsy();
  });

  it('sync_conflicts table exists with expected indexes', async () => {
    await db.open();
    const syncConflicts = db.tables.find((t) => t.name === 'sync_conflicts');
    expect(syncConflicts).toBeDefined();
    const indexNames = syncConflicts.schema.indexes.map((i) => i.name);
    expect(indexNames).toContain('table_name');
    expect(indexNames).toContain('detected_at');
  });

  // schema_version meta row is written by the v7/v8 upgrade callbacks during
  // first `db.open()`. The parent describe's beforeEach clears `meta` for test
  // isolation, so we can't assert the row on the shared singleton here — the
  // migration-v5-to-v7 suite covers it against a fresh test DB.
});
