import { db } from './schema.js';

export async function searchCards(query, limit = 12) {
  if (!query || query.length < 2) return [];

  const normalised = query.toLowerCase();

  // Title-case each word to match MTG card name format for indexed lookup
  const titleCased = normalised.replace(/\b\w/g, c => c.toUpperCase());

  const raw = await db.cards
    .where('name')
    .startsWith(titleCased)
    .limit(limit * 3)
    .toArray();

  // Deduplicate by oracle_id (keep first printing per unique card)
  const seen = new Set();
  const results = [];
  for (const card of raw) {
    const key = card.oracle_id || card.id;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(card);
    if (results.length >= limit) break;
  }

  // Fallback: substring match only when prefix search found nothing
  // (skip when we have any prefix results — the full table scan is too slow)
  if (results.length === 0) {
    const additional = await db.cards
      .filter(card => card.name.toLowerCase().includes(normalised))
      .limit(limit * 3)
      .toArray();
    for (const card of additional) {
      const key = card.oracle_id || card.id;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(card);
      if (results.length >= limit) break;
    }
  }

  return results;
}
