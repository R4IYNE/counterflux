import { describe, it, expect } from 'vitest';
import { getIncrement } from '../src/utils/game-stats.js';

describe('getIncrement (long-press acceleration)', () => {
  it('returns 1 for 0ms hold', () => {
    expect(getIncrement(0)).toBe(1);
  });

  it('returns 1 for 500ms hold', () => {
    expect(getIncrement(500)).toBe(1);
  });

  it('returns 1 for 999ms hold (just under tier 2)', () => {
    expect(getIncrement(999)).toBe(1);
  });

  it('returns 5 for 1000ms hold (tier 2 boundary)', () => {
    expect(getIncrement(1000)).toBe(5);
  });

  it('returns 5 for 1500ms hold', () => {
    expect(getIncrement(1500)).toBe(5);
  });

  it('returns 5 for 1999ms hold (just under tier 3)', () => {
    expect(getIncrement(1999)).toBe(5);
  });

  it('returns 10 for 2000ms hold (tier 3 boundary)', () => {
    expect(getIncrement(2000)).toBe(10);
  });

  it('returns 10 for 5000ms hold', () => {
    expect(getIncrement(5000)).toBe(10);
  });
});
