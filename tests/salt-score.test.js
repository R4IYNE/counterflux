import { describe, it, expect } from 'vitest';
import { normalizeSalt, aggregateDeckSalt } from '../src/services/edhrec.js';

describe('normalizeSalt', () => {
  it('returns 0 for salt of 0', () => {
    expect(normalizeSalt(0)).toBe(0);
  });

  it('returns 2 for salt of 0.8 (mild range)', () => {
    expect(normalizeSalt(0.8)).toBe(2);
  });

  it('returns 4 for salt of 1.5 (spicy range)', () => {
    expect(normalizeSalt(1.5)).toBe(4);
  });

  it('returns 5 for salt of 2.0', () => {
    expect(normalizeSalt(2.0)).toBe(5);
  });

  it('returns 8 for salt of 3.2 (critical range)', () => {
    expect(normalizeSalt(3.2)).toBe(8);
  });

  it('returns 10 for salt of 4.0', () => {
    expect(normalizeSalt(4.0)).toBe(10);
  });

  it('caps at 10 for salt of 5.0', () => {
    expect(normalizeSalt(5.0)).toBe(10);
  });

  it('caps at 10 for very high salt values', () => {
    expect(normalizeSalt(10.0)).toBe(10);
  });

  it('handles null gracefully', () => {
    expect(normalizeSalt(null)).toBe(0);
  });

  it('handles undefined gracefully', () => {
    expect(normalizeSalt(undefined)).toBe(0);
  });

  it('handles NaN gracefully', () => {
    expect(normalizeSalt(NaN)).toBe(0);
  });
});

describe('aggregateDeckSalt', () => {
  it('returns null for empty array', () => {
    expect(aggregateDeckSalt([])).toBeNull();
  });

  it('returns null for array of all nulls', () => {
    expect(aggregateDeckSalt([null, undefined])).toBeNull();
  });

  it('computes average then normalizes for valid array', () => {
    // [0.8, 1.5, 0.2, 3.0] -> mean = 1.375 -> normalizeSalt(1.375) = Math.round(1.375 * 2.5) = Math.round(3.4375) = 3
    expect(aggregateDeckSalt([0.8, 1.5, 0.2, 3.0])).toBe(3);
  });

  it('filters out null and undefined values', () => {
    // [0.8, null, 1.5, undefined, 0.2, 3.0] -> valid = [0.8, 1.5, 0.2, 3.0] -> mean = 1.375 -> 3
    expect(aggregateDeckSalt([0.8, null, 1.5, undefined, 0.2, 3.0])).toBe(3);
  });

  it('works with single value', () => {
    // [2.0] -> mean = 2.0 -> normalizeSalt(2.0) = 5
    expect(aggregateDeckSalt([2.0])).toBe(5);
  });

  it('returns null for null input', () => {
    expect(aggregateDeckSalt(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(aggregateDeckSalt(undefined)).toBeNull();
  });

  it('caps aggregate at 10 for very salty decks', () => {
    // [4.0, 4.5, 5.0] -> mean = 4.5 -> normalizeSalt(4.5) = min(10, round(11.25)) = 10
    expect(aggregateDeckSalt([4.0, 4.5, 5.0])).toBe(10);
  });
});
