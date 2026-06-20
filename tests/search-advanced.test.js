import { describe, it, expect } from 'vitest';
import { isAdvancedQuery } from '../src/db/search.js';

describe('isAdvancedQuery (L8) — Scryfall operator detection', () => {
  it('detects keyword:value operators', () => {
    for (const q of ['t:creature', 'o:draw', 'c:rg', 'is:commander', 'set:mh3', 'r:mythic', 'type:instant', 'kw:flying', 'a:"rk post"']) {
      expect(isAdvancedQuery(q), q).toBe(true);
    }
  });

  it('detects comparison operators', () => {
    for (const q of ['pow>=5', 'tou<2', 'cmc=3', 'mv>=7', 'power>4', 'year>=2020']) {
      expect(isAdvancedQuery(q), q).toBe(true);
    }
  });

  it('detects negated + mid-string operators', () => {
    expect(isAdvancedQuery('-is:reprint')).toBe(true);
    expect(isAdvancedQuery('goblin t:creature')).toBe(true);
  });

  it('does NOT flag plain card-name searches', () => {
    for (const q of ['Lightning Bolt', 'Sol Ring', 'Urza', 'Yawgmoth', 'fire', 'birds of paradise', "Ajani's Pridemate"]) {
      expect(isAdvancedQuery(q), q).toBe(false);
    }
  });

  it('is null/garbage safe', () => {
    expect(isAdvancedQuery(null)).toBe(false);
    expect(isAdvancedQuery(undefined)).toBe(false);
    expect(isAdvancedQuery(42)).toBe(false);
  });
});
