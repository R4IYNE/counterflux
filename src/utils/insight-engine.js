import { db } from '../db/schema.js';
import { sanitizeCommanderName } from '../services/edhrec.js';

/**
 * Get the day-of-year (1-366) for the current date.
 * Used as a seed for daily insight rotation (D-16).
 * Exported for testing.
 * @param {Date} [date] - Optional date override (defaults to now)
 * @returns {number}
 */
export function getDayOfYear(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

/**
 * Generate a daily deck upgrade insight for Mila's dashboard panel.
 *
 * Algorithm:
 * 1. Load all decks with a commander_name
 * 2. For each deck, check EDHREC cache for synergy data
 * 3. Filter out synergy suggestions already in the deck
 * 4. Sort all candidates by synergy descending
 * 5. Use day-of-year to rotate through top 10 candidates
 *
 * Per D-14: Focused on deck upgrade suggestions from EDHREC synergy data.
 * Per D-15: Service only -- dashboard UI wiring is Phase 6.
 * Per D-16: One insight per day, rotated through top candidates.
 *
 * @returns {Promise<Object|null>} Insight object or null if no suggestions available
 */
export async function generateDailyInsight() {
  const decks = await db.decks.toArray();
  if (!decks || decks.length === 0) return null;

  const candidates = [];

  for (const deck of decks) {
    if (!deck.commander_name) continue;

    const sanitized = sanitizeCommanderName(deck.commander_name);
    const cached = await db.edhrec_cache.get(sanitized);
    if (!cached?.data?.synergies?.length) continue;

    // Load deck cards to filter out cards already in the deck
    const deckCards = await db.deck_cards
      .where('deck_id')
      .equals(deck.id)
      .toArray();
    const deckCardNames = new Set(deckCards.map((c) => c.card_name || ''));

    for (const suggestion of cached.data.synergies) {
      if (deckCardNames.has(suggestion.name)) continue;

      candidates.push({
        deckId: deck.id,
        deckName: deck.name,
        suggestedCard: suggestion.name,
        synergy: suggestion.synergy,
      });
    }
  }

  if (candidates.length === 0) return null;

  // Sort by synergy descending
  candidates.sort((a, b) => b.synergy - a.synergy);

  // Rotate through top 10 candidates using day-of-year as seed
  const dayOfYear = getDayOfYear();
  const poolSize = Math.min(candidates.length, 10);
  const index = dayOfYear % poolSize;
  const candidate = candidates[index];

  const synergyPercent = Math.round(candidate.synergy * 100);

  return {
    deckId: candidate.deckId,
    deckName: candidate.deckName,
    suggestedCard: candidate.suggestedCard,
    synergyPercent,
    message: `Swap in ${candidate.suggestedCard} for your ${candidate.deckName} deck \u2014 +${synergyPercent}% synergy on EDHREC`,
    generatedDate: new Date().toISOString().slice(0, 10),
  };
}
