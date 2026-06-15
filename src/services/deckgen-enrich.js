// src/services/deckgen-enrich.js
//
// Merge the commander's EDHREC synergies + Spellbook "almost-included" combo
// pieces (from the intelligence store) into the brew recommendations:
//   - tag any existing rec that matches a synergy/combo (combo wins ties)
//   - append missed synergy/combo cards as opt-in extras (approved:false),
//     skipping anything already in the deck or recs
// Pure + deterministic. Cap appended extras so the list isn't flooded.

const MAX_EXTRAS = 8;

export function enrichWithIntelligence({ recommendations, synergies = [], combos = {}, deckScryfallIds = new Set() }) {
  const comboIds = new Set((combos.almostIncluded || []).map(c => c.scryfall_id).filter(Boolean));
  const synergyIds = new Set((synergies || []).map(s => s.scryfall_id).filter(Boolean));
  const tagFor = (id) => (comboIds.has(id) ? 'combo' : synergyIds.has(id) ? 'synergy' : null);

  const out = recommendations.map(r => {
    const tag = tagFor(r.scryfall_id);
    return tag ? { ...r, source: tag } : r;
  });

  const present = new Set(out.map(r => r.scryfall_id));
  const candidates = [
    ...[...comboIds].map(id => ({ id, source: 'combo' })),
    ...[...synergyIds].map(id => ({ id, source: 'synergy' })),
  ];
  let added = 0;
  for (const { id, source } of candidates) {
    if (added >= MAX_EXTRAS) break;
    if (!id || present.has(id) || deckScryfallIds.has(id)) continue;
    present.add(id);
    out.push({ scryfall_id: id, role: source === 'combo' ? 'WIN_CON' : 'SUPPORT', source, approved: false });
    added++;
  }
  return out;
}
