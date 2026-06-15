// tests/deckgen-stream-parse.test.js
import { describe, it, expect } from 'vitest';
import { extractRecommendedCards } from '../src/services/deckgen-stream-parse.js';

describe('extractRecommendedCards', () => {
  it('returns only the cards whose JSON object has fully closed', () => {
    const buffer =
      '{"recommended":[' +
      '{"scryfall_id":"a1","role":"RAMP","reasoning":"fast mana"},' +
      '{"scryfall_id":"b2","role":"DRAW","reasoning":"card adv"},' +
      '{"scryfall_id":"c3","role":"WIN'; // <- last object still streaming
    const cards = extractRecommendedCards(buffer);
    expect(cards.map(c => c.scryfall_id)).toEqual(['a1', 'b2']);
    expect(cards[0]).toMatchObject({ scryfall_id: 'a1', role: 'RAMP', reasoning: 'fast mana' });
  });

  it('returns [] when no complete card object exists yet', () => {
    expect(extractRecommendedCards('{"recommended":[{"scryfall_id":"a1"')).toEqual([]);
  });

  it('ignores text before the recommended array', () => {
    expect(extractRecommendedCards('blah {"recommended":[{"scryfall_id":"a1","role":"X"}]')[0])
      .toMatchObject({ scryfall_id: 'a1', role: 'X', reasoning: undefined });
  });

  it('passes through swap_out for retune/upgrade cards', () => {
    const buffer = '{"recommended":[{"scryfall_id":"a1","role":"RAMP","swap_out":"old1"}]';
    expect(extractRecommendedCards(buffer)[0]).toMatchObject({ scryfall_id: 'a1', swap_out: 'old1' });
  });

  it('tolerates a brace inside a string value', () => {
    const buffer = '{"recommended":[{"scryfall_id":"a1","role":"X","reasoning":"uses {0} mana"}]';
    expect(extractRecommendedCards(buffer)[0].reasoning).toBe('uses {0} mana');
  });
});
