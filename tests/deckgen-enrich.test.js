import { describe, it, expect } from 'vitest';
import { enrichWithIntelligence } from '../src/services/deckgen-enrich.js';

describe('enrichWithIntelligence', () => {
  const recs = [{ scryfall_id: 'a1', role: 'RAMP', approved: true }];
  it('tags an existing rec that is a known synergy/combo', () => {
    const out = enrichWithIntelligence({
      recommendations: recs,
      synergies: [{ scryfall_id: 'a1' }],
      combos: { almostIncluded: [] },
      deckScryfallIds: new Set(),
    });
    expect(out.find(r => r.scryfall_id === 'a1').source).toBe('synergy');
  });
  it('appends a missed combo piece as an opt-in extra (approved:false)', () => {
    const out = enrichWithIntelligence({
      recommendations: recs,
      synergies: [],
      combos: { almostIncluded: [{ scryfall_id: 'z9' }] },
      deckScryfallIds: new Set(),
    });
    const z = out.find(r => r.scryfall_id === 'z9');
    expect(z).toMatchObject({ source: 'combo', approved: false });
  });
  it('does not append a synergy already in the deck or recs', () => {
    const out = enrichWithIntelligence({
      recommendations: recs,
      synergies: [{ scryfall_id: 'a1' }, { scryfall_id: 'inDeck' }],
      combos: { almostIncluded: [] },
      deckScryfallIds: new Set(['inDeck']),
    });
    expect(out.filter(r => r.scryfall_id === 'inDeck')).toHaveLength(0);
    expect(out).toHaveLength(1);
  });
});
