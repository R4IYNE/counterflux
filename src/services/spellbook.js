/**
 * Commander Spellbook API client.
 * Fetches combo data for a deck's card list via the find-my-combos endpoint.
 * Caching is handled by the intelligence store (Plan 03), not here.
 */

// Proxy through Vite dev server to avoid CORS issues.
// In production, wire /api/spellbook to a serverless proxy or edge function.
const SPELLBOOK_BASE = '/api/spellbook';

/**
 * Map raw Spellbook combo response to app-friendly shape.
 * @param {Object} raw - Single combo from Spellbook API results
 * @returns {Object} Mapped combo with pieces, produces, description
 */
function mapCombo(raw) {
  return {
    id: raw.id,
    pieces: raw.uses.map((u) => ({
      name: u.card.name,
      cardId: u.card.id,
      zoneLocations: u.zoneLocations || [],
    })),
    produces: raw.produces.map((p) => p.feature.name),
    description: raw.description,
    manaNeeded: raw.manaNeeded || '',
    prerequisites: raw.easyPrerequisites || '',
  };
}

/**
 * Fetch combos for a deck from Commander Spellbook.
 * @param {string[]} commanderNames - Commander card names
 * @param {string[]} cardNames - Card names in the 99
 * @returns {Promise<{included: Object[], almostIncluded: Object[], error?: boolean}>}
 */
export async function findDeckCombos(commanderNames, cardNames) {
  try {
    const body = {
      commanders: commanderNames.map((name) => ({ card: name })),
      main: cardNames.map((name) => ({ card: name })),
    };

    const res = await fetch(`${SPELLBOOK_BASE}/find-my-combos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Spellbook ${res.status}`);
    const data = await res.json();

    return {
      included: (data.results?.included || []).map(mapCombo),
      almostIncluded: (data.results?.almostIncluded || []).map(mapCombo),
    };
  } catch {
    return { included: [], almostIncluded: [], error: true };
  }
}
