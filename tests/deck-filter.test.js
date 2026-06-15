import { describe, it, expect } from 'vitest';
import { matchesDeckFilter, isEmptyDeckFilter, EMPTY_DECK_FILTER } from '../src/utils/deck-filter.js';

const mk = (over = {}) => ({ card: { type_line: 'Creature — Elf', cmc: 3, color_identity: ['G'] }, owned: true, ...over });

describe('matchesDeckFilter', () => {
  it('passes everything for the empty filter', () => {
    expect(matchesDeckFilter(mk(), EMPTY_DECK_FILTER)).toBe(true);
    expect(isEmptyDeckFilter(EMPTY_DECK_FILTER)).toBe(true);
  });
  it('filters by type substring (case-insensitive)', () => {
    expect(matchesDeckFilter(mk(), { type: 'Creature' })).toBe(true);
    expect(matchesDeckFilter(mk(), { type: 'Instant' })).toBe(false);
  });
  it('filters by cmc incl. 7+', () => {
    expect(matchesDeckFilter(mk({ card: { cmc: 3 } }), { cmc: '3' })).toBe(true);
    expect(matchesDeckFilter(mk({ card: { cmc: 3 } }), { cmc: '4' })).toBe(false);
    expect(matchesDeckFilter(mk({ card: { cmc: 8 } }), { cmc: '7+' })).toBe(true);
    expect(matchesDeckFilter(mk({ card: { cmc: 5 } }), { cmc: '7+' })).toBe(false);
  });
  it('filters by owned/missing', () => {
    expect(matchesDeckFilter(mk({ owned: true }), { owned: 'Owned' })).toBe(true);
    expect(matchesDeckFilter(mk({ owned: false }), { owned: 'Owned' })).toBe(false);
    expect(matchesDeckFilter(mk({ owned: false }), { owned: 'Missing' })).toBe(true);
  });
  it('filters by colour identity (incl. colourless via C)', () => {
    const colours = new Set(['G']);
    expect(matchesDeckFilter(mk({ card: { color_identity: ['G'] } }), { colours })).toBe(true);
    expect(matchesDeckFilter(mk({ card: { color_identity: ['G','U'] } }), { colours })).toBe(false);
    expect(matchesDeckFilter(mk({ card: { color_identity: [] } }), { colours: new Set(['G']) })).toBe(false);
    expect(matchesDeckFilter(mk({ card: { color_identity: [] } }), { colours: new Set(['C']) })).toBe(true);
  });
});
