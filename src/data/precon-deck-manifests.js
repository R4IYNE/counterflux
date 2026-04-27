// src/data/precon-deck-manifests.js
//
// Phase 14.07e — curated deck-name → commander-name mapping for multi-deck
// Commander products. Scryfall doesn't expose deck-membership metadata, so
// the splitter heuristic in 14-07c produced one "deck" per legendary creature
// in the set (19 tiny tiles for Final Fantasy Commander instead of the
// 4 actual WotC decks). This file fixes that by supplying the WotC deck names
// + commander-name assignments per known multi-deck product.
//
// Adding a product:
//   1. Add an entry keyed by the Scryfall set code (lowercase).
//   2. List each WotC deck with its name + array of commander card names
//      (matched case-insensitively against `name` in the Scryfall decklist).
//   3. Non-commander cards are assigned to the first deck whose union of
//      commander color identities is a superset of the card's color identity
//      (same subset rule splitPreconIntoDecks used in 14-07c).
//
// Best-effort: deck-to-commander assignments below are best-guess from public
// product info. If a mapping is wrong, fix the entry and the splitter will
// pick up the correction without other code changes.
//
// Products without a manifest entry fall back to the full-bundle ADD ALL flow
// shipped in 14-07d (informational banner above the decklist; no tile grid).

export const PRECON_DECK_MANIFESTS = {
  // Final Fantasy Commander (2025 — set code 'fin').
  // 4 decks, 2 face commanders each per WotC product page.
  // Reference: https://magic.wizards.com/en/news/announcements/final-fantasy-commander
  fin: [
    {
      name: 'Limit Break',
      commanderNames: ['Cloud, Ex-SOLDIER', 'Tifa, Martial Artist'],
    },
    {
      name: 'Revival Trance',
      commanderNames: ['Aerith, Last Ancient', 'Sephiroth, Fabled SOLDIER'],
    },
    {
      name: 'Counter Blow',
      commanderNames: ['Tidus, Yuna’s Guardian', 'Yuna, Grand Summoner'],
    },
    {
      name: 'Scions & Spellcraft',
      commanderNames: ['Y’shtola, Night’s Blessed', 'G’raha Tia, Scion Reborn'],
    },
  ],
  // Doctor Who Commander (2023 — set code 'who').
  // 4 decks, themed around Doctors + companions.
  // Reference: https://magic.wizards.com/en/news/announcements/doctor-who-commander-decks
  who: [
    { name: 'Blast from the Past', commanderNames: [] },
    { name: 'Timey-Wimey', commanderNames: [] },
    { name: 'Masters of Evil', commanderNames: [] },
    { name: 'Paradox Power', commanderNames: [] },
  ],
};

/**
 * @param {string} code - Scryfall set code (any case).
 * @returns {Array<{name: string, commanderNames: string[]}>|null}
 */
export function getDeckManifest(code) {
  if (!code) return null;
  return PRECON_DECK_MANIFESTS[code.toLowerCase()] || null;
}
