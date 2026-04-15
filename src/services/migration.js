/**
 * Migration orchestrator (Phase 7 Plan 3 — SCHEMA-01..03).
 *
 * Runs BEFORE Alpine and any other store init. Gates app boot until the
 * Dexie v5→v6→v7 upgrade completes (or fails visibly).
 *
 * Sequence:
 *   1. sweepOldBackups() — D-16, best-effort cleanup of stale localStorage keys
 *   2. Register db.on('blocked') + db.on('versionchange') handlers BEFORE db.open
 *      (Pitfall F — Dexie attaches listeners early; registering after open
 *      misses the first blocked event).
 *   3. Detect whether an existing `counterflux` IDB exists; if so, open a probe
 *      Dexie at v5 ONLY to snapshot pre-migration data for the localStorage
 *      backup. A VersionError from the probe means the user is already at v6+
 *      — skip backup silently. Any OTHER probe error surfaces via the blocking
 *      modal (quota, corruption).
 *   4. await db.open() on the production singleton — Dexie runs the v6 + v7
 *      upgrade callbacks if currentVersion < 7.
 *   5. On success: migration complete, orchestrator resolves, caller proceeds
 *      with store init + Alpine.start.
 *   6. On failure: blocking modal stays up, error rethrown.
 */
import Dexie from 'dexie';
import { db } from '../db/schema.js';
import {
  backupBeforeMigration,
  sweepOldBackups,
  MigrationBackupFailedError,
} from './migration-backup.js';
import {
  showBlockingModal,
  hideBlockingModal,
} from '../components/migration-blocked-modal.js';

export async function runMigration() {
  // 1. Sweep stale backups (D-16) — best-effort; never block boot on sweep failure.
  try {
    if (typeof localStorage !== 'undefined') sweepOldBackups();
  } catch (e) {
    console.warn('[migration] sweep failed (non-fatal)', e);
  }

  // 2. Register blocked + versionchange handlers BEFORE opening (Pitfall F).
  db.on('blocked', (event) => {
    console.warn('[migration] blocked by another tab', event);
    showBlockingModal({
      title: 'Counterflux is upgrading',
      body: 'Please close any other Counterflux tabs so we can finish updating your local data.',
    });
  });
  db.on('ready', () => {
    hideBlockingModal();
  });
  db.on('versionchange', (event) => {
    console.warn('[migration] versionchange — another tab is upgrading; closing connection', event);
    db.close();
    // A versionchange means a newer version was opened by another tab. This
    // tab is now on a stale schema — a reload is required. We warn via alert
    // because Alpine + toast are not yet booted when migration runs.
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      setTimeout(() => {
        window.alert('Counterflux was updated in another tab. Please reload this page.');
      }, 0);
    }
  });

  try {
    // 3. Probe-at-v5 for backup snapshot
    const existing = await detectExistingDb('counterflux');
    if (existing) {
      let probeDb = null;
      try {
        probeDb = await openProbeAtV5();
      } catch (probeErr) {
        const name = probeErr?.name || probeErr?.inner?.name;
        if (name === 'VersionError') {
          // User's persisted DB is already at v6+ — no v5 snapshot to take.
          console.info(
            '[migration] probe at v5 rejected with VersionError — user already at v6+; skipping backup',
          );
          probeDb = null;
        } else {
          // Surface other open failures (quota, corrupted IDB) via the blocking modal.
          throw probeErr;
        }
      }
      if (probeDb) {
        try {
          await backupBeforeMigration(probeDb);
        } finally {
          try {
            probeDb.close();
          } catch {
            /* best-effort */
          }
        }
      }
    }

    // 4. Open the real singleton — triggers v6 + v7 upgrade callbacks if needed.
    await db.open();

    console.info('[migration] complete; db.verno=', db.verno);
  } catch (e) {
    console.error('[migration] FAILED', e);
    if (e instanceof MigrationBackupFailedError) {
      // Backup failed before the upgrade ran — refuse to proceed. User's v5
      // data remains intact on disk.
      showBlockingModal({
        title: 'Backup failed — migration aborted',
        body:
          e.message +
          ' — please reach out for help; your v5 data is still safe on disk.',
      });
    } else {
      showBlockingModal({
        title: 'Migration failed',
        body:
          'Counterflux could not upgrade your local database. Your v5 data is intact. Error: ' +
          (e?.message || String(e)),
      });
    }
    throw e;
  } finally {
    // Reset the migration progress indicator so subsequent boots (after a hard
    // reload post-migration) don't render a stale percentage.
    try {
      if (typeof window !== 'undefined' && window.Alpine?.store) {
        const store = window.Alpine.store('bulkdata');
        if (store) store.migrationProgress = null;
      }
    } catch {
      /* decorative */
    }
  }
}

/**
 * Does an IDB named `name` already exist on disk? Used to short-circuit the
 * backup probe for fresh installs (no backup needed, no probe to open).
 */
async function detectExistingDb(name) {
  if (typeof indexedDB === 'undefined') return false;
  if (typeof indexedDB.databases === 'function') {
    try {
      const dbs = await indexedDB.databases();
      return dbs.some((d) => d.name === name);
    } catch {
      return true; // safe default — backup is no-op for fresh DBs anyway
    }
  }
  return true;
}

/**
 * Open a throwaway Dexie pinned at exactly v5. If the persisted IDB is already
 * at v6+, this rejects with VersionError — caller treats that as "no snapshot
 * needed, skip backup".
 */
async function openProbeAtV5() {
  const probe = new Dexie('counterflux');
  probe.version(1).stores({
    cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
    meta: 'key',
  });
  probe.version(2).stores({
    cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
    meta: 'key',
    collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]',
  });
  probe.version(3).stores({
    cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
    meta: 'key',
    collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]',
    decks: '++id, name, format, updated_at',
    deck_cards: '++id, deck_id, scryfall_id, [deck_id+scryfall_id]',
  });
  probe.version(4).stores({
    cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
    meta: 'key',
    collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]',
    decks: '++id, name, format, updated_at',
    deck_cards: '++id, deck_id, scryfall_id, [deck_id+scryfall_id]',
    edhrec_cache: 'commander',
    combo_cache: 'deck_id',
    card_salt_cache: 'sanitized',
  });
  probe.version(5).stores({
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
    games: '++id, deck_id, started_at, ended_at',
  });
  await probe.open();
  return probe;
}
