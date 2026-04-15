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

describe('v7 schema shape (Phase 7 Plan 3 — SCHEMA-01)', () => {
  it('db.verno is 7 after open', () => {
    // db is opened lazily on first access — force-open via a trivial read
    expect(db.verno >= 0).toBe(true); // sanity
    return db.open().then(() => {
      expect(db.verno).toBe(7);
    });
  });

  it('legacy autoincrement tables (collection/decks/deck_cards/games/watchlist) are absent at v7', async () => {
    await db.open();
    const names = db.tables.map((t) => t.name);
    expect(names).not.toContain('collection');
    expect(names).not.toContain('decks');
    expect(names).not.toContain('deck_cards');
    expect(names).not.toContain('games');
    expect(names).not.toContain('watchlist');
  });

  it('canonical *_next tables exist with text UUID PK (auto === false)', async () => {
    await db.open();
    const names = db.tables.map((t) => t.name);
    for (const t of [
      'collection_next',
      'decks_next',
      'deck_cards_next',
      'games_next',
      'watchlist_next',
    ]) {
      expect(names).toContain(t);
    }
    const collectionNext = db.tables.find((t) => t.name === 'collection_next');
    expect(collectionNext.schema.primKey.name).toBe('id');
    expect(collectionNext.schema.primKey.auto).toBeFalsy();
  });

  it('collection_next indexes include user_id, updated_at, synced_at', async () => {
    await db.open();
    const collectionNext = db.tables.find((t) => t.name === 'collection_next');
    const indexNames = collectionNext.schema.indexes.map((i) => i.name);
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

  // schema_version meta row is written by the v7 upgrade callback during the
  // first `db.open()` of the Dexie singleton. The parent describe's beforeEach
  // clears `meta` for test isolation, so we can't assert the row on the shared
  // singleton here — the migration-v5-to-v7 suite covers that behaviour against
  // a fresh test DB.
});
