// Root-cause fix for the 1654 sync errors (22008) + dashboard localeCompare crash:
// timestamps stored as numbers / numeric-strings / ISO across the synced tables.

import { describe, it, expect } from 'vitest';
import { tsToMs, toIsoTimestamp, byTimestampDesc } from '../src/utils/timestamps.js';

describe('tsToMs', () => {
  it('passes through finite numbers (epoch ms)', () => {
    expect(tsToMs(1777662820234)).toBe(1777662820234);
  });
  it('parses epoch-ms numeric strings', () => {
    expect(tsToMs('1777662820234')).toBe(1777662820234);
  });
  it('parses ISO-8601 strings', () => {
    expect(tsToMs('2026-05-01T00:00:00.000Z')).toBe(Date.parse('2026-05-01T00:00:00.000Z'));
  });
  it('returns 0 for null/empty/garbage/non-finite', () => {
    expect(tsToMs(null)).toBe(0);
    expect(tsToMs(undefined)).toBe(0);
    expect(tsToMs('')).toBe(0);
    expect(tsToMs('not a date')).toBe(0);
    expect(tsToMs(NaN)).toBe(0);
  });
  it('never throws and yields a usable comparator (the dashboard crash)', () => {
    const decks = [{ updated_at: 1777662820234 }, { updated_at: '2026-06-01T00:00:00Z' }, { updated_at: null }];
    expect(() => [...decks].sort(byTimestampDesc('updated_at'))).not.toThrow();
    const sorted = [...decks].sort(byTimestampDesc('updated_at'));
    expect(tsToMs(sorted[0].updated_at)).toBeGreaterThanOrEqual(tsToMs(sorted[1].updated_at));
  });
});

describe('toIsoTimestamp', () => {
  it('converts a number to ISO', () => {
    expect(toIsoTimestamp(1777662820234)).toBe(new Date(1777662820234).toISOString());
  });
  it('converts an epoch-ms numeric string to ISO (the field _isoStampTimestamps used to miss)', () => {
    expect(toIsoTimestamp('1777662820234')).toBe(new Date(1777662820234).toISOString());
  });
  it('leaves genuine ISO strings untouched', () => {
    const iso = '2026-05-01T12:00:00.000Z';
    expect(toIsoTimestamp(iso)).toBe(iso);
  });
  it('leaves null / undefined untouched', () => {
    expect(toIsoTimestamp(null)).toBeNull();
    expect(toIsoTimestamp(undefined)).toBeUndefined();
  });
  it('does not mangle short non-timestamp strings', () => {
    expect(toIsoTimestamp('owned')).toBe('owned');
    expect(toIsoTimestamp('2026')).toBe('2026');
  });
});
