export const SCRYFALL_BULK_API = 'https://api.scryfall.com/bulk-data/default-cards';
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
