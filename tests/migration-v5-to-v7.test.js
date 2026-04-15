/**
 * Migration v5 → v7 comprehensive test suite (Phase 7 Plan 3 — Task 6).
 *
 * D-17 HARD GATE: every assertion here must be green before the migration is
 * considered safe to ship. Coverage:
 *   - v1, v2, v3, v4, v5 fixture chains (every prior version)
 *   - Empty / 500-card / 10-deck / active-game states
 *   - FK integrity after deck_id remap (D-02)
 *   - Backfill correctness (updated_at, synced_at, user_id, turn_laps)
 *   - New sync_queue / sync_conflicts / profile tables created with correct PK shapes
 *   - schema_version meta row (D-12)
 *   - Orphan deck_cards skipped (Pitfall C)
 *   - Idempotency: reopening at v7 does NOT re-run the upgrade
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  openAtV1,
  openAtV2,
  openAtV3,
  openAtV4,
  openAtV5,
  seed500Cards,
  seed10DecksWithCards,
  seedActiveGame,
  deleteTestDb,
  reopenAtV7,
} from './fixtures/v5-snapshots.js';

const TEST_DB = 'mig-v5-to-v7-test';

describe('migration v5 → v7 (SCHEMA-01, SCHEMA-02 — D-17 hard gate)', () => {
  beforeEach(async () => {
    await deleteTestDb(TEST_DB);
  });
  afterEach(async () => {
    await deleteTestDb(TEST_DB);
  });

  it('Test 1 — empty v5 state migrates without error', async () => {
    const v5 = await openAtV5(TEST_DB);
    await v5.close();
    const v7 = await reopenAtV7(TEST_DB);
    expect(v7.verno).toBe(7);
    expect(await v7.collection_next.count()).toBe(0);
    expect(await v7.decks_next.count()).toBe(0);
    expect(await v7.deck_cards_next.count()).toBe(0);
    expect(await v7.games_next.count()).toBe(0);
    expect(await v7.watchlist_next.count()).toBe(0);
    await v7.close();
  });

  it('Test 2 — 500-card collection migrates with UUID PKs and backfills', async () => {
    const v5 = await openAtV5(TEST_DB);
    await seed500Cards(v5);
    await v5.close();
    const v7 = await reopenAtV7(TEST_DB);
    const rows = await v7.collection_next.toArray();
    expect(rows).toHaveLength(500);
    for (const r of rows.slice(0, 10)) {
      expect(r.id).toMatch(/^[0-9a-f-]{36}$/); // UUID v4 shape
      expect(typeof r.updated_at).toBe('number');
      expect(r.synced_at).toBeNull();
      expect(r.user_id).toBeNull();
      expect(r.scryfall_id).toMatch(/^fixture-card-/);
    }
    await v7.close();
  });

  it('Test 3 — 10 decks with deck_cards: FK integrity preserved (D-02)', async () => {
    const v5 = await openAtV5(TEST_DB);
    await seed10DecksWithCards(v5);
    const v5DecksCount = await v5.decks.count();
    const v5DcCount = await v5.deck_cards.count();
    await v5.close();
    const v7 = await reopenAtV7(TEST_DB);
    expect(await v7.decks_next.count()).toBe(v5DecksCount);
    expect(await v7.deck_cards_next.count()).toBe(v5DcCount);
    const allDeckIds = new Set((await v7.decks_next.toArray()).map((d) => d.id));
    const dcs = await v7.deck_cards_next.toArray();
    for (const dc of dcs) {
      expect(allDeckIds.has(dc.deck_id)).toBe(true);
    }
    await v7.close();
  });

  it('Test 4 — active game gets turn_laps: [] backfilled (D-09)', async () => {
    const v5 = await openAtV5(TEST_DB);
    await seedActiveGame(v5);
    await v5.close();
    const v7 = await reopenAtV7(TEST_DB);
    const games = await v7.games_next.toArray();
    expect(games).toHaveLength(1);
    expect(Array.isArray(games[0].turn_laps)).toBe(true);
    expect(games[0].turn_laps).toEqual([]);
    expect(typeof games[0].updated_at).toBe('number');
    expect(games[0].player_count).toBe(4); // v5 field preserved
    await v7.close();
  });

  it('Test 5 — fresh v1 DB walks the full v1..v7 chain without error', async () => {
    const v1 = await openAtV1(TEST_DB);
    await v1.close();
    const v7 = await reopenAtV7(TEST_DB);
    expect(v7.verno).toBe(7);
    await v7.close();
  });

  it('Test 5a — v2 → v7 (collection-only partial chain)', async () => {
    const v2 = await openAtV2(TEST_DB);
    await v2.collection.bulkAdd([
      { scryfall_id: 'v2-card-01', category: 'collection', foil: false },
      { scryfall_id: 'v2-card-02', category: 'collection', foil: true },
      { scryfall_id: 'v2-card-03', category: 'wishlist', foil: false },
      { scryfall_id: 'v2-card-04', category: 'collection', foil: false },
      { scryfall_id: 'v2-card-05', category: 'collection', foil: false },
      { scryfall_id: 'v2-card-06', category: 'collection', foil: false },
      { scryfall_id: 'v2-card-07', category: 'collection', foil: false },
      { scryfall_id: 'v2-card-08', category: 'collection', foil: false },
      { scryfall_id: 'v2-card-09', category: 'collection', foil: false },
      { scryfall_id: 'v2-card-10', category: 'collection', foil: false },
    ]);
    await v2.close();
    const v7 = await reopenAtV7(TEST_DB);
    expect(v7.verno).toBe(7);
    expect(await v7.collection_next.count()).toBe(10);
    expect(await v7.decks_next.count()).toBe(0);
    expect(await v7.deck_cards_next.count()).toBe(0);
    expect(await v7.games_next.count()).toBe(0);
    expect(await v7.watchlist_next.count()).toBe(0);
    const rows = await v7.collection_next.toArray();
    for (const r of rows.slice(0, 3)) {
      expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(typeof r.updated_at).toBe('number');
      expect(r.synced_at).toBeNull();
    }
    await v7.close();
  });

  it('Test 6 — v3 → v7 (collection + decks + deck_cards, no v5-tables)', async () => {
    const v3 = await openAtV3(TEST_DB);
    await v3.collection.bulkAdd([
      { scryfall_id: 'sc-1', category: 'collection', foil: false },
      { scryfall_id: 'sc-2', category: 'collection', foil: false },
      { scryfall_id: 'sc-3', category: 'collection', foil: true },
      { scryfall_id: 'sc-4', category: 'wishlist', foil: false },
      { scryfall_id: 'sc-5', category: 'collection', foil: false },
    ]);
    await v3.decks.bulkAdd([
      { name: 'D1', format: 'commander', updated_at: Date.now() },
      { name: 'D2', format: 'commander', updated_at: Date.now() },
    ]);
    await v3.close();
    const v7 = await reopenAtV7(TEST_DB);
    expect(await v7.collection_next.count()).toBe(5);
    expect(await v7.decks_next.count()).toBe(2);
    expect(await v7.watchlist_next.count()).toBe(0);
    expect(await v7.games_next.count()).toBe(0);
    await v7.close();
  });

  it('Test 6a — v4 → v7 (adds *_cache tables; no watchlist/games/price_history)', async () => {
    const v4 = await openAtV4(TEST_DB);
    const collRows = Array.from({ length: 20 }, (_, i) => ({
      scryfall_id: `v4-card-${i}`,
      category: 'collection',
      foil: false,
    }));
    await v4.collection.bulkAdd(collRows);
    const deckIds = [];
    for (let i = 0; i < 3; i++) {
      const id = await v4.decks.add({
        name: `V4 Deck ${i}`,
        format: 'commander',
        updated_at: Date.now(),
      });
      deckIds.push(id);
    }
    for (const deckId of deckIds) {
      await v4.deck_cards.bulkAdd([
        { deck_id: deckId, scryfall_id: `v4-dc-${deckId}-a` },
        { deck_id: deckId, scryfall_id: `v4-dc-${deckId}-b` },
      ]);
    }
    await v4.edhrec_cache.put({
      commander: 'atraxa-praetors-voice',
      recs: ['card-a', 'card-b'],
      cached_at: Date.now(),
    });
    await v4.close();

    const v7 = await reopenAtV7(TEST_DB);
    expect(v7.verno).toBe(7);
    expect(await v7.collection_next.count()).toBe(20);
    expect(await v7.decks_next.count()).toBe(3);
    expect(await v7.deck_cards_next.count()).toBe(6);
    const edhrec = await v7.edhrec_cache.get('atraxa-praetors-voice');
    expect(edhrec).toBeDefined();
    expect(edhrec.recs).toEqual(['card-a', 'card-b']);
    expect(await v7.watchlist_next.count()).toBe(0);
    expect(await v7.games_next.count()).toBe(0);
    expect(await v7.price_history.count()).toBe(0);
    const allDeckIds = new Set((await v7.decks_next.toArray()).map((d) => d.id));
    for (const dc of await v7.deck_cards_next.toArray()) {
      expect(allDeckIds.has(dc.deck_id)).toBe(true);
    }
    await v7.close();
  });

  it('Test 7 — idempotent: reopening at v7 is a no-op', async () => {
    const v5 = await openAtV5(TEST_DB);
    await seed500Cards(v5);
    await v5.close();
    const first = await reopenAtV7(TEST_DB);
    const beforeCount = await first.collection_next.count();
    const beforeIds = (await first.collection_next.toArray()).map((r) => r.id).sort();
    await first.close();
    const second = await reopenAtV7(TEST_DB);
    expect(second.verno).toBe(7);
    expect(await second.collection_next.count()).toBe(beforeCount);
    const afterIds = (await second.collection_next.toArray()).map((r) => r.id).sort();
    // UUIDs stable — v6.upgrade did not re-run on second open
    expect(afterIds).toEqual(beforeIds);
    await second.close();
  });

  it('Test 8 — schema_version meta row written (D-12)', async () => {
    const v5 = await openAtV5(TEST_DB);
    await v5.close();
    const v7 = await reopenAtV7(TEST_DB);
    const sv = await v7.meta.get('schema_version');
    expect(sv).toBeDefined();
    expect(sv.version).toBe(7);
    expect(typeof sv.migrated_at).toBe('string');
    await v7.close();
  });

  it('Test 9 — sync_queue, sync_conflicts, profile tables created with correct PK shape', async () => {
    const v5 = await openAtV5(TEST_DB);
    await v5.close();
    const v7 = await reopenAtV7(TEST_DB);
    expect(v7.tables.find((t) => t.name === 'sync_queue')).toBeDefined();
    expect(v7.tables.find((t) => t.name === 'sync_conflicts')).toBeDefined();
    expect(v7.tables.find((t) => t.name === 'profile')).toBeDefined();
    expect(v7.tables.find((t) => t.name === 'sync_queue').schema.primKey.auto).toBe(true);
    expect(v7.tables.find((t) => t.name === 'profile').schema.primKey.auto).toBeFalsy();
    await v7.close();
  });

  it('Test 10 — orphan deck_cards row is skipped, not crashed (Pitfall C)', async () => {
    const v5 = await openAtV5(TEST_DB);
    const realDeckId = await v5.decks.add({
      name: 'Real',
      format: 'commander',
      updated_at: Date.now(),
    });
    await v5.deck_cards.bulkAdd([
      { deck_id: realDeckId, scryfall_id: 'real-card-1' },
      { deck_id: realDeckId, scryfall_id: 'real-card-2' },
      { deck_id: 99999, scryfall_id: 'orphan-card' }, // orphan FK
    ]);
    await v5.close();
    const v7 = await reopenAtV7(TEST_DB);
    // Orphan skipped — only the 2 valid deck_cards rows survived.
    expect(await v7.deck_cards_next.count()).toBe(2);
    expect(await v7.decks_next.count()).toBe(1);
    await v7.close();
  });
});
