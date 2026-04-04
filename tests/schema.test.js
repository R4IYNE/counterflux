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
