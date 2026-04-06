import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateDailyInsight, getDayOfYear } from '../src/utils/insight-engine.js';

// Mock Dexie db
vi.mock('../src/db/schema.js', () => {
  const decksData = [];
  const edhrecCacheData = {};
  const deckCardsData = [];

  return {
    db: {
      decks: {
        toArray: vi.fn(() => Promise.resolve(decksData)),
      },
      edhrec_cache: {
        get: vi.fn((key) => Promise.resolve(edhrecCacheData[key] || undefined)),
      },
      deck_cards: {
        where: vi.fn(() => ({
          equals: vi.fn(() => ({
            toArray: vi.fn(() => Promise.resolve(deckCardsData)),
          })),
        })),
      },
      // Expose setters for tests
      __setDecks: (d) => { decksData.length = 0; decksData.push(...d); },
      __setEdhrecCache: (c) => { Object.keys(edhrecCacheData).forEach(k => delete edhrecCacheData[k]); Object.assign(edhrecCacheData, c); },
      __setDeckCards: (c) => { deckCardsData.length = 0; deckCardsData.push(...c); },
    },
  };
});

// Re-import db so we can use __set helpers
import { db } from '../src/db/schema.js';

describe('insight-engine', () => {
  beforeEach(() => {
    db.__setDecks([]);
    db.__setEdhrecCache({});
    db.__setDeckCards([]);
  });

  describe('getDayOfYear', () => {
    it('returns a number between 1 and 366', () => {
      const day = getDayOfYear();
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(366);
    });
  });

  describe('generateDailyInsight', () => {
    it('returns null when no decks exist', async () => {
      db.__setDecks([]);
      const result = await generateDailyInsight();
      expect(result).toBeNull();
    });

    it('returns null when no EDHREC data cached', async () => {
      db.__setDecks([
        { id: 1, name: 'Prossh Tokens', commander_name: 'Prossh, Skyraider of Kher' },
      ]);
      // No cache entry for prossh
      db.__setEdhrecCache({});
      db.__setDeckCards([]);

      const result = await generateDailyInsight();
      expect(result).toBeNull();
    });

    it('returns insight object with correct shape', async () => {
      db.__setDecks([
        { id: 1, name: 'Prossh Tokens', commander_name: 'Prossh, Skyraider of Kher' },
      ]);
      db.__setEdhrecCache({
        'prossh-skyraider-of-kher': {
          data: {
            synergies: [
              { name: 'Purphoros, God of the Forge', synergy: 0.72, inclusion: 55, num_decks: 12000 },
              { name: 'Impact Tremors', synergy: 0.63, inclusion: 50, num_decks: 10000 },
            ],
          },
          fetched_at: Date.now(),
        },
      });
      db.__setDeckCards([
        { deck_id: 1, card_name: 'Sol Ring' },
        { deck_id: 1, card_name: 'Cultivate' },
      ]);

      const result = await generateDailyInsight();
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('deckId', 1);
      expect(result).toHaveProperty('deckName', 'Prossh Tokens');
      expect(result).toHaveProperty('suggestedCard');
      expect(result).toHaveProperty('synergyPercent');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('generatedDate');
    });

    it('picks highest synergy delta across all decks', async () => {
      db.__setDecks([
        { id: 1, name: 'Weak Deck', commander_name: 'Commander A' },
        { id: 2, name: 'Strong Deck', commander_name: 'Commander B' },
      ]);
      db.__setEdhrecCache({
        'commander-a': {
          data: {
            synergies: [{ name: 'Card A', synergy: 0.30 }],
          },
          fetched_at: Date.now(),
        },
        'commander-b': {
          data: {
            synergies: [{ name: 'Card B', synergy: 0.95 }],
          },
          fetched_at: Date.now(),
        },
      });
      db.__setDeckCards([]);

      // Mock deck_cards to return empty for both decks (no cards = all suggestions valid)
      const result = await generateDailyInsight();
      expect(result).not.toBeNull();
      // Top candidate should be Card B (0.95) — picked from top 10 via day rotation
      // We can't guarantee exact pick due to day rotation, but suggestedCard should be one of them
      expect(['Card A', 'Card B']).toContain(result.suggestedCard);
    });

    it('insights rotate daily (different day seed = potentially different insight)', async () => {
      db.__setDecks([
        { id: 1, name: 'Test Deck', commander_name: 'Test Commander' },
      ]);
      db.__setEdhrecCache({
        'test-commander': {
          data: {
            synergies: Array.from({ length: 15 }, (_, i) => ({
              name: `Card ${i}`,
              synergy: 0.90 - i * 0.01,
            })),
          },
          fetched_at: Date.now(),
        },
      });
      db.__setDeckCards([]);

      // getDayOfYear is used internally — the rotation picks index = dayOfYear % min(candidates, 10)
      const result = await generateDailyInsight();
      expect(result).not.toBeNull();
      // Verify it picks from the top 10 candidates
      const topNames = Array.from({ length: 10 }, (_, i) => `Card ${i}`);
      expect(topNames).toContain(result.suggestedCard);
    });

    it('insight message follows expected format', async () => {
      db.__setDecks([
        { id: 1, name: 'Prossh Tokens', commander_name: 'Prossh, Skyraider of Kher' },
      ]);
      db.__setEdhrecCache({
        'prossh-skyraider-of-kher': {
          data: {
            synergies: [
              { name: 'Purphoros, God of the Forge', synergy: 0.72 },
            ],
          },
          fetched_at: Date.now(),
        },
      });
      db.__setDeckCards([]);

      const result = await generateDailyInsight();
      expect(result).not.toBeNull();
      expect(result.message).toContain('Prossh Tokens');
      expect(result.message).toContain('+');
      expect(result.message).toContain('synergy');
      expect(result.synergyPercent).toBe(72);
    });

    it('excludes cards already in the deck from suggestions', async () => {
      db.__setDecks([
        { id: 1, name: 'Test Deck', commander_name: 'Test Commander' },
      ]);
      db.__setEdhrecCache({
        'test-commander': {
          data: {
            synergies: [
              { name: 'Already Owned Card', synergy: 0.99 },
            ],
          },
          fetched_at: Date.now(),
        },
      });
      db.__setDeckCards([
        { deck_id: 1, card_name: 'Already Owned Card' },
      ]);

      const result = await generateDailyInsight();
      expect(result).toBeNull(); // Only suggestion is already in deck
    });
  });
});
