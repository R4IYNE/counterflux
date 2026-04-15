/**
 * Pre-migration backup service (SCHEMA-03, Phase 7 Plan 3).
 *
 * Per D-13: backs up the six user-generated tables (collection, decks, deck_cards,
 *           games, watchlist, price_history). `cards`, `meta`, and `*_cache` are
 *           excluded — they are regeneratable from Scryfall.
 * Per D-14: single localStorage key `counterflux_v5_backup_<ISO-timestamp>`,
 *           synchronous write so the backup is guaranteed durable before Dexie
 *           opens v6.
 * Per D-16: 7-day TTL sweep on every boot; older keys are removed.
 * Per D-17b: writes then reads back + JSON.parses to validate round-trip
 *            integrity. If row count differs from what was written, abort the
 *            migration with a user-visible error rather than proceeding on a
 *            corrupt safety net.
 * Per Pitfall D: on QuotaExceededError, attempt a file-download fallback
 *                (Blob + URL.createObjectURL) before surfacing the error.
 */

export const BACKUP_KEY_PREFIX = 'counterflux_v5_backup_';
export const BACKUP_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (D-16)
export const USER_TABLES = [
  'collection',
  'decks',
  'deck_cards',
  'games',
  'watchlist',
  'price_history',
]; // D-13

export class MigrationBackupFailedError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'MigrationBackupFailedError';
    if (cause) this.cause = cause;
  }
}

/**
 * Snapshot every user table, write to localStorage, validate round-trip.
 * Returns the backup key on success, or null if the backup was skipped
 * (fresh install or already-migrated db).
 */
export async function backupBeforeMigration(db) {
  // Skip if fresh install or already-migrated (verno is 0 before open; >=6 means
  // the v5 pre-migration snapshot is already irrelevant).
  const currentVersion = db.verno;
  if (currentVersion === 0 || currentVersion >= 6) {
    console.info('[migration-backup] skipping — db.verno=', currentVersion);
    return null;
  }

  // 1. Snapshot every user table (D-13 scope). Tables that don't exist on older
  //    schema versions (e.g., watchlist/games/price_history are v5+) are caught
  //    and recorded as empty arrays — safer than failing the backup.
  const snapshot = {};
  let totalRows = 0;
  for (const table of USER_TABLES) {
    try {
      snapshot[table] = await db.table(table).toArray();
      totalRows += snapshot[table].length;
    } catch {
      snapshot[table] = [];
    }
  }

  const isoTs = new Date().toISOString();
  const key = `${BACKUP_KEY_PREFIX}${isoTs}`;
  const json = JSON.stringify(snapshot);

  // 2. Write — handle quota fallback (Pitfall D).
  try {
    localStorage.setItem(key, json);
  } catch (e) {
    if (e?.name === 'QuotaExceededError') {
      try {
        downloadBackupFile(json, isoTs);
      } catch {
        // swallow — the primary error is more useful to the user
      }
      throw new MigrationBackupFailedError(
        `localStorage quota exceeded (${(json.length / 1024 / 1024).toFixed(2)}MB). A downloadable backup was attempted — check Downloads.`,
        e,
      );
    }
    throw new MigrationBackupFailedError('Backup write failed', e);
  }

  // 3. Round-trip validate (D-17b) — read back, JSON.parse, row-count compare.
  const readback = localStorage.getItem(key);
  if (!readback) {
    throw new MigrationBackupFailedError('Backup write succeeded but readback returned null');
  }
  let parsed;
  try {
    parsed = JSON.parse(readback);
  } catch (e) {
    localStorage.removeItem(key); // don't leave a corrupt backup
    throw new MigrationBackupFailedError('Backup written but JSON.parse failed on read-back', e);
  }
  let parsedRowCount = 0;
  for (const table of USER_TABLES) {
    parsedRowCount += (parsed[table] || []).length;
  }
  if (parsedRowCount !== totalRows) {
    localStorage.removeItem(key);
    throw new MigrationBackupFailedError(
      `Backup row count mismatch: wrote ${totalRows}, read ${parsedRowCount}`,
    );
  }

  console.info(
    `[migration-backup] saved & validated (${(json.length / 1024).toFixed(1)}KB, ${totalRows} rows) at key=${key}`,
  );
  return key;
}

/**
 * Remove backups older than BACKUP_TTL_MS. Called on every boot (D-16).
 * `now` is injectable for testing.
 */
export function sweepOldBackups(now = Date.now()) {
  const removed = [];
  // Iterate backwards because we mutate localStorage as we go.
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key?.startsWith(BACKUP_KEY_PREFIX)) continue;
    const isoTs = key.substring(BACKUP_KEY_PREFIX.length);
    const ts = new Date(isoTs).getTime();
    if (Number.isNaN(ts)) continue;
    if (now - ts > BACKUP_TTL_MS) {
      localStorage.removeItem(key);
      removed.push(key);
    }
  }
  if (removed.length) {
    console.info(`[migration-backup] swept ${removed.length} old backup(s):`, removed);
  }
  return removed;
}

/**
 * Return all current backup keys in insertion order.
 */
export function listBackups() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(BACKUP_KEY_PREFIX)) out.push(key);
  }
  return out;
}

/**
 * Deserialize and return a backup. Throws MigrationBackupFailedError if the
 * key is missing. Parse errors bubble up as SyntaxError — caller decides
 * how to surface them (used only from the "restore" UX).
 */
export function restoreFromBackup(key) {
  const json = localStorage.getItem(key);
  if (!json) throw new MigrationBackupFailedError(`Backup key not found: ${key}`);
  return JSON.parse(json);
}

/**
 * Blob-based download fallback for when localStorage quota is exceeded.
 * Only called from the QuotaExceededError branch — best-effort so the error
 * path never masks the primary failure.
 */
function downloadBackupFile(json, isoTs) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `counterflux-v5-backup-${isoTs}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
