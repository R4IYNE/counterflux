import { db } from '../db/schema.js';

const MAX_ENTRIES = 50;
const ACTIVITY_KEY = 'activity_log';

/**
 * Log an activity entry to the activity log in the meta table.
 * @param {string} type - Activity type (e.g. 'card_added', 'deck_created')
 * @param {string} message - Human-readable description
 * @param {string|null} entityId - Optional entity identifier
 */
export async function logActivity(type, message, entityId = null) {
  const record = await db.meta.get(ACTIVITY_KEY);
  const entries = record?.entries || [];

  entries.unshift({
    type,
    message,
    entityId,
    timestamp: new Date().toISOString(),
  });

  if (entries.length > MAX_ENTRIES) {
    entries.length = MAX_ENTRIES;
  }

  await db.meta.put({ key: ACTIVITY_KEY, entries });
}

/**
 * Get all activity entries in reverse chronological order (newest first).
 * @returns {Promise<Array>} Activity entries
 */
export async function getActivity() {
  const record = await db.meta.get(ACTIVITY_KEY);
  return record?.entries || [];
}
