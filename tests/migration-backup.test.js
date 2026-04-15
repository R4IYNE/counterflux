import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  openAtV5,
  seed500Cards,
  seed10DecksWithCards,
  deleteTestDb,
} from './fixtures/v5-snapshots.js';
import {
  backupBeforeMigration,
  sweepOldBackups,
  listBackups,
  BACKUP_KEY_PREFIX,
  MigrationBackupFailedError,
  USER_TABLES,
} from '../src/services/migration-backup.js';

const TEST_DB = 'mig-backup-test';

// Minimal localStorage shim for node env (fake-indexeddb/auto does not ship one).
function installLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => {
      store.set(k, String(v));
    },
    removeItem: (k) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (i) => Array.from(store.keys())[i] ?? null,
  };
}

describe('migration backup (SCHEMA-03 / D-13..D-17b)', () => {
  beforeEach(() => {
    installLocalStorage();
    localStorage.clear();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await deleteTestDb(TEST_DB);
  });

  it('writes a single localStorage key with ISO-timestamp suffix', async () => {
    const db = await openAtV5(TEST_DB);
    await seed500Cards(db);
    const key = await backupBeforeMigration(db);
    expect(key).toMatch(/^counterflux_v5_backup_\d{4}-\d{2}-\d{2}T/);
    expect(localStorage.getItem(key)).toBeTruthy();
    await db.close();
  });

  it('snapshot contains exactly the 6 user tables (D-13 scope)', async () => {
    const db = await openAtV5(TEST_DB);
    await seed500Cards(db);
    await seed10DecksWithCards(db);
    const key = await backupBeforeMigration(db);
    const snap = JSON.parse(localStorage.getItem(key));
    for (const t of USER_TABLES) expect(snap).toHaveProperty(t);
    // No card/meta/cache leakage
    expect(snap).not.toHaveProperty('cards');
    expect(snap).not.toHaveProperty('meta');
    expect(snap).not.toHaveProperty('edhrec_cache');
    await db.close();
  });

  it('round-trip validates by JSON.parse (D-17b)', async () => {
    const db = await openAtV5(TEST_DB);
    await seed500Cards(db);
    const key = await backupBeforeMigration(db);
    const parsed = JSON.parse(localStorage.getItem(key));
    expect(parsed.collection).toHaveLength(500);
    await db.close();
  });

  it('throws MigrationBackupFailedError when readback row count differs from written', async () => {
    const db = await openAtV5(TEST_DB);
    await seed500Cards(db);

    // Install a getItem spy that returns a 0-row snapshot when our backup key
    // is read back — simulates corruption between write and read-back.
    const realGet = localStorage.getItem.bind(localStorage);
    const realSet = localStorage.setItem.bind(localStorage);
    let backupKey = null;
    localStorage.setItem = (k, v) => {
      realSet(k, v);
      if (k.startsWith(BACKUP_KEY_PREFIX)) backupKey = k;
    };
    localStorage.getItem = (k) => {
      if (k === backupKey) {
        // Deliberately mismatched: 0 rows in every table.
        return JSON.stringify({
          collection: [],
          decks: [],
          deck_cards: [],
          games: [],
          watchlist: [],
          price_history: [],
        });
      }
      return realGet(k);
    };

    await expect(backupBeforeMigration(db)).rejects.toThrow(MigrationBackupFailedError);
    await db.close();
  });

  it('skips when db.verno is 0 (fresh) or >= 6 (already migrated)', async () => {
    const fresh = { verno: 0, table: () => ({ toArray: async () => [] }) };
    expect(await backupBeforeMigration(fresh)).toBeNull();
    const future = { verno: 7, table: () => ({ toArray: async () => [] }) };
    expect(await backupBeforeMigration(future)).toBeNull();
  });

  it('sweepOldBackups removes keys older than 7 days, keeps newer', () => {
    const now = Date.now();
    localStorage.setItem(
      `${BACKUP_KEY_PREFIX}${new Date(now - 8 * 24 * 3600 * 1000).toISOString()}`,
      '{}',
    );
    localStorage.setItem(
      `${BACKUP_KEY_PREFIX}${new Date(now - 1 * 24 * 3600 * 1000).toISOString()}`,
      '{}',
    );
    const removed = sweepOldBackups(now);
    expect(removed).toHaveLength(1);
    expect(listBackups()).toHaveLength(1);
  });

  it('on QuotaExceededError, throws MigrationBackupFailedError mentioning quota', async () => {
    const db = await openAtV5(TEST_DB);
    await seed500Cards(db);

    localStorage.setItem = () => {
      const e = new Error('quota');
      e.name = 'QuotaExceededError';
      throw e;
    };

    await expect(backupBeforeMigration(db)).rejects.toThrow(/quota/i);
    await db.close();
  });
});
