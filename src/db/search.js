import { db } from './schema.js';

export async function searchCards(query, limit = 12) {
  if (!query || query.length < 2) return [];

  const normalised = query.toLowerCase();

  const results = await db.cards
    .where('name')
    .startsWithIgnoreCase(normalised)
    .limit(limit)
    .toArray();

  if (results.length < limit) {
    const seen = new Set(results.map(c => c.oracle_id));
    const additional = await db.cards
      .filter(card => card.name.toLowerCase().includes(normalised) && !seen.has(card.oracle_id))
      .limit(limit - results.length)
      .toArray();
    results.push(...additional);
  }

  return results.slice(0, limit);
}
