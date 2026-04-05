import { describe, it, expect } from 'vitest';
import { suggestTags, DEFAULT_TAGS } from '../src/utils/tag-heuristics.js';

describe('suggestTags', () => {
  it('suggests Ramp for land search text', () => {
    expect(suggestTags('Search your library for a basic land card')).toContain('Ramp');
  });

  it('suggests Card Draw for draw text', () => {
    expect(suggestTags('Draw two cards')).toContain('Card Draw');
  });

  it('suggests Removal for destroy target creature', () => {
    expect(suggestTags('Destroy target creature')).toContain('Removal');
  });

  it('suggests Board Wipes for destroy all creatures', () => {
    expect(suggestTags('Destroy all creatures')).toContain('Board Wipes');
  });

  it('suggests Protection for hexproof', () => {
    expect(suggestTags('has hexproof')).toContain('Protection');
  });

  it('suggests Recursion for graveyard return', () => {
    expect(suggestTags('Return target creature card from your graveyard')).toContain('Recursion');
  });

  it('suggests Win Conditions for opponent loses', () => {
    expect(suggestTags('Each opponent loses the game')).toContain('Win Conditions');
  });

  it('returns empty array for empty string', () => {
    expect(suggestTags('')).toEqual([]);
  });

  it('returns empty array for null', () => {
    expect(suggestTags(null)).toEqual([]);
  });
});

describe('DEFAULT_TAGS', () => {
  it('is array of 8 strings', () => {
    expect(DEFAULT_TAGS).toHaveLength(8);
    expect(DEFAULT_TAGS).toEqual([
      'Ramp', 'Card Draw', 'Removal', 'Board Wipes',
      'Win Conditions', 'Protection', 'Recursion', 'Utility'
    ]);
  });
});
