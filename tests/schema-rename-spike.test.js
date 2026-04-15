/**
 * Dexie 4.x rename-pattern spike (Phase 7 Plan 3 — Task 3a).
 *
 * Front-loads the question "can Task 3 ship variant (a) with the `_next` suffix
 * approach, or does it need the three-version variant (c)?" against real Dexie
 * + fake-indexeddb BEFORE we wire the production schema in Task 3.
 *
 * Three tests:
 *   1. Opens v6 with both legacy and `_next` tables side by side.
 *   2. Reopens at v7 declaring `collection: null` — legacy dropped, `_next` retained.
 *   3. Reopens at v8 recreating `collection` with the NEW UUID-PK shape — proves
 *      we CAN reuse the clean name in a later version (variant a full-rename
 *      is viable as a future follow-up).
 *
 * Pass criteria for the plan:
 *   - Tests 1 + 2 MUST pass — variant (a) is viable.
 *   - Test 3 is informational: if it passes, a future v8 can drop `_next` and
 *     hand Phases 9/11 clean names; if it fails, `_next` is the permanent name.
 */
import { describe, it, expect, afterEach } from 'vitest';
import Dexie from 'dexie';

const DB_A = 'spike-a-db';

describe('Dexie 4.x rename-pattern spike (picks Task 3 variant)', () => {
  afterEach(async () => {
    await Dexie.delete(DB_A);
  });

  it('Test 1 — v6 with collection + collection_next side-by-side opens cleanly', async () => {
    const db = new Dexie(DB_A);
    db.version(6).stores({
      collection: '++id, scryfall_id',
      collection_next: 'id, scryfall_id',
    });
    await db.open();
    expect(db.verno).toBe(6);
    await db.collection.add({ scryfall_id: 'sc-1' });
    await db.collection_next.add({ id: 'uuid-1', scryfall_id: 'sc-1' });
    expect(await db.collection.count()).toBe(1);
    expect(await db.collection_next.count()).toBe(1);
    await db.close();
  });

  it('Test 2 — v7 drops collection (null) while keeping collection_next', async () => {
    // Arrange at v6
    const db6 = new Dexie(DB_A);
    db6.version(6).stores({
      collection: '++id, scryfall_id',
      collection_next: 'id, scryfall_id',
    });
    await db6.open();
    await db6.collection_next.add({ id: 'uuid-2', scryfall_id: 'sc-2' });
    await db6.close();

    // Act: reopen at v7 declaring full chain including the null-drop at v7
    const db7 = new Dexie(DB_A);
    db7.version(6).stores({
      collection: '++id, scryfall_id',
      collection_next: 'id, scryfall_id',
    });
    db7.version(7).stores({
      collection: null,
      collection_next: 'id, scryfall_id',
    });
    await db7.open();
    expect(db7.verno).toBe(7);
    const tables = db7.tables.map((t) => t.name);
    expect(tables).not.toContain('collection');
    expect(tables).toContain('collection_next');
    expect(await db7.collection_next.count()).toBe(1);
    await db7.close();
  });

  it('Test 3 — v8 can recreate collection with the NEW shape after v7 nulled it', async () => {
    // Arrange: walk chain v6 → v7
    const db7 = new Dexie(DB_A);
    db7.version(6).stores({
      collection: '++id, scryfall_id',
      collection_next: 'id, scryfall_id',
    });
    db7.version(7).stores({
      collection: null,
      collection_next: 'id, scryfall_id',
    });
    await db7.open();
    await db7.collection_next.add({ id: 'uuid-3', scryfall_id: 'sc-3' });
    await db7.close();

    // Act: reopen at v8 reusing the `collection` name with a new UUID-PK shape.
    const db8 = new Dexie(DB_A);
    db8.version(6).stores({
      collection: '++id, scryfall_id',
      collection_next: 'id, scryfall_id',
    });
    db8.version(7).stores({
      collection: null,
      collection_next: 'id, scryfall_id',
    });
    db8
      .version(8)
      .stores({
        collection: 'id, scryfall_id',
        collection_next: 'id, scryfall_id',
      })
      .upgrade(async (tx) => {
        const rows = await tx.table('collection_next').toArray();
        if (rows.length) await tx.table('collection').bulkAdd(rows);
      });
    await db8.open();
    expect(db8.verno).toBe(8);
    const tables = db8.tables.map((t) => t.name);
    expect(tables).toContain('collection');
    expect(await db8.collection.count()).toBe(1);
    expect((await db8.collection.toArray())[0].id).toBe('uuid-3');
    await db8.close();
  });
});
