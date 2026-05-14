// Quick task 260514-uqc Layer 2: switched from default-cards (~500MB / ~500k
// printings) to oracle-cards (~100MB / ~30k cards). Shrinks the boot
// bulk-streaming window from 3-5 min to ~30-60s on broadband; Layer 1's
// API-fallback in src/db/search.js covers search/browse while this is in flight.
export const SCRYFALL_BULK_API = 'https://api.scryfall.com/bulk-data/oracle-cards';
export const USER_AGENT = 'Counterflux/1.0 (MTG collection manager)';

export async function fetchBulkDataMeta() {
  const response = await fetch(SCRYFALL_BULK_API, {
    headers: { 'User-Agent': USER_AGENT }
  });
  if (!response.ok) throw new Error(`Scryfall API error: ${response.status}`);
  return response.json();
}

export function shouldRefresh(cachedUpdatedAt, serverUpdatedAt) {
  if (!cachedUpdatedAt) return true;
  return new Date(serverUpdatedAt) > new Date(cachedUpdatedAt);
}
