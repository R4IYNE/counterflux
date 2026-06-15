// src/utils/deck-filter.js
//
// Pure predicate for filtering a deck's cards (the centre panel "99") by
// Type / Mana cost / Owned / Colour. Operates on an activeCards entry
// ({ card: {type_line, cmc, color_identity}, owned }). Default filter is
// pass-through so an unfiltered deck renders unchanged.

export const EMPTY_DECK_FILTER = { type: 'All', cmc: 'All', owned: 'All', colours: null };

export function isEmptyDeckFilter(f) {
  if (!f) return true;
  return (f.type === 'All' || !f.type)
    && (f.cmc === 'All' || !f.cmc)
    && (f.owned === 'All' || !f.owned)
    && (!f.colours || !(f.colours instanceof Set) || f.colours.size === 0);
}

export function matchesDeckFilter(entry, filter) {
  if (!filter || isEmptyDeckFilter(filter)) return true;
  const card = entry?.card || {};
  // Type
  if (filter.type && filter.type !== 'All') {
    if (!String(card.type_line || '').toLowerCase().includes(filter.type.toLowerCase())) return false;
  }
  // Mana cost (cmc)
  if (filter.cmc && filter.cmc !== 'All') {
    const cmc = Number(card.cmc || 0);
    if (filter.cmc === '7+') { if (cmc < 7) return false; }
    else if (cmc !== parseInt(filter.cmc, 10)) return false;
  }
  // Owned
  if (filter.owned === 'Owned' && !entry?.owned) return false;
  if (filter.owned === 'Missing' && entry?.owned) return false;
  // Colour (Set of WUBRG + 'C' for colourless). Card matches if every colour
  // in its identity is selected; a colourless card matches only if 'C' selected.
  if (filter.colours instanceof Set && filter.colours.size > 0) {
    const ci = Array.isArray(card.color_identity) ? card.color_identity : [];
    if (ci.length === 0) { if (!filter.colours.has('C')) return false; }
    else if (!ci.every(c => filter.colours.has(c))) return false;
  }
  return true;
}
