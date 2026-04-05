import { db } from './schema.js';

export async function searchCards(query, limit = 12) {
  if (!query || query.length < 2) return [];

  const normalised = query.toLowerCase();

  // Fetch more than limit to account for duplicate printings
  const raw = await db.cards
    .where('name')
    .startsWithIgnoreCase(normalised)
    .limit(limit * 4)
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

  // Fallback: substring match for cards that don't start with the query
  if (results.length < limit) {
    const additional = await db.cards
      .filter(card => card.name.toLowerCase().includes(normalised) && !seen.has(card.oracle_id || card.id))
      .limit((limit - results.length) * 4)
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
