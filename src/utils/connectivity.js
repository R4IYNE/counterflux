/**
 * Determine connectivity status based on online state and bulk data freshness.
 * @param {boolean} isOnline - Whether the browser reports online status
 * @param {string|null} bulkDataUpdatedAt - ISO timestamp of last bulk data update
 * @returns {{ state: 'live'|'stale'|'offline', label: string, color: string }}
 */
export function getConnectivityStatus(isOnline, bulkDataUpdatedAt) {
  if (!isOnline) {
    return { state: 'offline', label: 'OFFLINE', color: 'secondary' };
  }

  if (bulkDataUpdatedAt) {
    const ageMs = Date.now() - new Date(bulkDataUpdatedAt).getTime();
    if (ageMs > 86400000) {
      const hours = Math.floor(ageMs / 3600000);
      return { state: 'stale', label: `STALE ${hours}H`, color: 'warning' };
    }
  }

  return { state: 'live', label: 'LIVE', color: 'success' };
}
