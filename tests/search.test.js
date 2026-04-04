import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../src/db/schema.js';
import { searchCards } from '../src/db/search.js';
import sampleCards from './fixtures/sample-cards.json';

describe('searchCards', () => {
  beforeAll(async () => {
    await db.cards.bulkPut(sampleCards);
  });

  afterAll(async () => {
    await db.cards.clear();
  });

  it('returns empty array for query shorter than 2 chars', async () => {
    const results = await searchCards('L');
    expect(results).toEqual([]);
  });

  it('returns empty array for empty query', async () => {
    const results = await searchCards('');
    expect(results).toEqual([]);
  });

  it('returns empty array for null query', async () => {
    const results = await searchCards(null);
    expect(results).toEqual([]);
  });

  it('returns cards matching name prefix (startsWithIgnoreCase)', async () => {
    const results = await searchCards('light');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('Lightning Bolt');
  });

  it('returns results case-insensitively', async () => {
    const results = await searchCards('LIGHT');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('Lightning Bolt');
  });

  it('falls back to contains search when prefix yields few results', async () => {
    // "bolt" doesn't start any card name but is contained in "Lightning Bolt"
    const results = await searchCards('bolt');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(c => c.name.includes('Bolt'))).toBe(true);
  });

  it('respects limit parameter', async () => {
    const results = await searchCards('the', 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });
});
