/**
 * Timestamp normalisation helpers.
 *
 * The synced tables accumulated MIXED timestamp representations over time:
 *   - the v6 schema migration backfilled `updated_at` as Date.now() NUMBERS (D-07),
 *   - later write paths stamped ISO-8601 STRINGS (new Date().toISOString()),
 *   - some values round-tripped as numeric STRINGS ("1777662820234").
 *
 * Two consumers can't cope with that inconsistency:
 *   1. Postgres `timestamptz` columns reject anything that isn't a valid
 *      timestamp literal → SQLSTATE 22008 ("date/time field value out of range")
 *      → sync push dead-letters. (sync-engine only converted literal numbers.)
 *   2. UI sorts using String.prototype.localeCompare throw
 *      "localeCompare is not a function" the moment a value is a number.
 *
 * These helpers normalise all three forms so both sides are robust regardless
 * of how a given row's timestamp was stamped.
 */

/**
 * Coerce any timestamp representation to epoch milliseconds for comparison/sorting.
 * Returns 0 for null/empty/unparseable so sorts never throw.
 * @param {number|string|null|undefined} v
 * @returns {number}
 */
export function tsToMs(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    if (/^\d+$/.test(v)) return Number(v);          // epoch-ms numeric string
    const parsed = Date.parse(v);                    // ISO-8601 string
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Coerce a number or epoch-ms numeric-string to an ISO-8601 string suitable for
 * a Postgres `timestamptz` column. Leaves genuine ISO strings, null, and
 * undefined untouched so it's safe to run over a whole row.
 * @param {number|string|null|undefined} v
 * @returns {string|null|undefined|*}
 */
export function toIsoTimestamp(v) {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return new Date(v).toISOString();
  }
  if (typeof v === 'string' && /^\d{10,}$/.test(v.trim())) {
    const n = Number(v.trim());
    if (Number.isFinite(n)) return new Date(n).toISOString();
  }
  return v;
}

/**
 * Descending comparator by a timestamp field, robust to number/string/ISO.
 * @param {string} field
 * @returns {(a: object, b: object) => number}
 */
export function byTimestampDesc(field) {
  return (a, b) => tsToMs(b?.[field]) - tsToMs(a?.[field]);
}
