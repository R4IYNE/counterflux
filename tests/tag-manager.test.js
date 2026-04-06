import { describe, it, expect } from 'vitest';
import { suggestTags, DEFAULT_TAGS } from '../src/utils/tag-heuristics.js';

describe('suggestTags', () => {
  it('suggests Ramp for land search text', () => {
    expect(suggestTags('Search your library for a basic land card')).toContain('Ramp');
  });

  it('suggests Draw for draw text', () => {
    expect(suggestTags('Draw two cards')).toContain('Draw');
  });

  it('suggests Removal for destroy target creature', () => {
    expect(suggestTags('Destroy target creature')).toContain('Removal');
  });

  it('suggests Board Wipe for destroy all creatures', () => {
    expect(suggestTags('Destroy all creatures')).toContain('Board Wipe');
  });

  it('suggests Protection for hexproof', () => {
    expect(suggestTags('has hexproof')).toContain('Protection');
  });

  it('suggests Recursion for graveyard return', () => {
    expect(suggestTags('Return target creature card from your graveyard')).toContain('Recursion');
  });

  it('suggests Finisher for opponent loses', () => {
    expect(suggestTags('Each opponent loses the game')).toContain('Finisher');
  });

  it('suggests Counter Spell for counter target spell', () => {
    expect(suggestTags('Counter target spell')).toContain('Counter Spell');
  });

  it('suggests Tokens for create token', () => {
    expect(suggestTags('Create a 1/1 white Soldier creature token')).toContain('Tokens');
  });

  it('suggests Tutor for search your library', () => {
    expect(suggestTags('Search your library for a card')).toContain('Tutor');
  });

  it('returns empty array for empty string', () => {
    expect(suggestTags('')).toEqual([]);
  });

  it('returns empty array for null', () => {
    expect(suggestTags(null)).toEqual([]);
  });
});

describe('DEFAULT_TAGS', () => {
  it('is array of 18 Archidekt-aligned categories', () => {
    expect(DEFAULT_TAGS).toHaveLength(18);
    expect(DEFAULT_TAGS).toContain('Ramp');
    expect(DEFAULT_TAGS).toContain('Draw');
    expect(DEFAULT_TAGS).toContain('Removal');
    expect(DEFAULT_TAGS).toContain('Board Wipe');
    expect(DEFAULT_TAGS).toContain('Finisher');
    expect(DEFAULT_TAGS).toContain('Counter Spell');
    expect(DEFAULT_TAGS).toContain('Tokens');
    expect(DEFAULT_TAGS).toContain('Tutor');
  });
});
