/**
 * @param {StorageManager} [storage] - optional override for testing; defaults to navigator.storage
 */
export async function requestPersistentStorage(storage) {
  const mgr = storage ?? globalThis.navigator?.storage;
  if (!mgr?.persist) return { supported: false };
  const alreadyPersisted = await mgr.persisted();
  if (alreadyPersisted) return { supported: true, granted: true };
  const granted = await mgr.persist();
  return { supported: true, granted };
}

/**
 * @param {StorageManager} [storage] - optional override for testing; defaults to navigator.storage
 */
export async function getStorageEstimate(storage) {
  const mgr = storage ?? globalThis.navigator?.storage;
  if (!mgr?.estimate) return null;
  const { usage, quota } = await mgr.estimate();
  return { usage, quota, percentUsed: Math.round((usage / quota) * 100) };
}
