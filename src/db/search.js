import { db } from './schema.js';

export async function searchCards(query, limit = 12) {
  if (!query || query.length < 2) return [];

  const normalised = query.toLowerCase();

  // Use case-sensitive startsWith with title-cased query for the indexed lookup
  // (MTG card names are title-cased, so this hits the B-tree index directly)
  const titleCased = normalised.charAt(0).toUpperCase() + normalised.slice(1);

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

  // Fallback: substring match for cards that contain the query anywhere
  if (results.length < limit) {
    const remaining = limit - results.length;
    const additional = await db.cards
      .filter(card => card.name.toLowerCase().includes(normalised) && !seen.has(card.oracle_id || card.id))
      .limit(remaining * 3)
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
