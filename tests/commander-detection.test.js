import { describe, it, expect } from 'vitest';
import {
  isLegendary,
  hasPartner,
  hasPartnerWith,
  choosesBackground,
  isBackground,
  isCompanion,
  hasFriendsForever,
  mergeColorIdentity,
} from '../src/utils/commander-detection.js';

describe('isLegendary', () => {
  it('returns true for Legendary Creature', () => {
    expect(isLegendary({ type_line: 'Legendary Creature \u2014 Human Wizard' })).toBe(true);
  });

  it('returns false for non-legendary Creature', () => {
    expect(isLegendary({ type_line: 'Creature \u2014 Elf' })).toBe(false);
  });

  it('returns true for Legendary Planeswalker', () => {
    expect(isLegendary({ type_line: 'Legendary Planeswalker \u2014 Jace' })).toBe(true);
  });

  it('returns false for Legendary Enchantment (not Creature/Planeswalker)', () => {
    expect(isLegendary({ type_line: 'Legendary Enchantment' })).toBe(false);
  });

  it('returns true for card with "can be your commander" in oracle_text', () => {
    expect(isLegendary({
      type_line: 'Enchantment',
      oracle_text: 'This card can be your commander.',
    })).toBe(true);
  });
});

describe('hasPartner', () => {
  it('returns true for generic Partner keyword', () => {
    expect(hasPartner({ keywords: ['Partner'], oracle_text: 'Partner' })).toBe(true);
  });

  it('returns false when oracle_text contains "Partner with" (specific partner)', () => {
    expect(hasPartner({ keywords: ['Partner'], oracle_text: 'Partner with Brallin, Skyshark Rider' })).toBe(false);
  });

  it('returns false when no Partner keyword', () => {
    expect(hasPartner({ keywords: [], oracle_text: '' })).toBe(false);
  });
});

describe('hasPartnerWith', () => {
  it('returns true when oracle_text matches target name', () => {
    expect(hasPartnerWith(
      { oracle_text: 'Partner with Brallin, Skyshark Rider' },
      'Brallin, Skyshark Rider'
    )).toBe(true);
  });

  it('returns false when target name does not match', () => {
    expect(hasPartnerWith(
      { oracle_text: 'Partner with Brallin, Skyshark Rider' },
      'Haldan, Avid Arcanist'
    )).toBe(false);
  });
});

describe('choosesBackground', () => {
  it('returns true when keywords include Choose a Background', () => {
    expect(choosesBackground({ keywords: ['Choose a Background'] })).toBe(true);
  });

  it('returns false when keyword not present', () => {
    expect(choosesBackground({ keywords: ['Partner'] })).toBe(false);
  });
});

describe('isBackground', () => {
  it('returns true for Background type_line', () => {
    expect(isBackground({ type_line: 'Legendary Enchantment \u2014 Background' })).toBe(true);
  });

  it('returns false for non-Background', () => {
    expect(isBackground({ type_line: 'Enchantment \u2014 Aura' })).toBe(false);
  });
});

describe('isCompanion', () => {
  it('returns true when keywords include Companion', () => {
    expect(isCompanion({ keywords: ['Companion'] })).toBe(true);
  });

  it('returns false when Companion not in keywords', () => {
    expect(isCompanion({ keywords: ['Flash'] })).toBe(false);
  });
});

describe('hasFriendsForever', () => {
  it('returns true when keywords include Friends forever', () => {
    expect(hasFriendsForever({ keywords: ['Friends forever'] })).toBe(true);
  });

  it('returns false when not present', () => {
    expect(hasFriendsForever({ keywords: [] })).toBe(false);
  });
});

describe('mergeColorIdentity', () => {
  it('merges two color identity arrays, deduplicates, and sorts', () => {
    expect(mergeColorIdentity(['U', 'R'], ['G'])).toEqual(['G', 'R', 'U']);
  });

  it('handles overlapping colors', () => {
    expect(mergeColorIdentity(['U', 'R'], ['R', 'G'])).toEqual(['G', 'R', 'U']);
  });

  it('handles empty arrays', () => {
    expect(mergeColorIdentity([], ['B'])).toEqual(['B']);
  });
});
