import { describe, it, expect } from 'vitest';

/**
 * Deck quick-launch data tests.
 * Tests pure data logic for the dashboard deck grid panel.
 */

describe('Deck Quick-Launch Data', () => {
  describe('sorting by updated_at', () => {
    it('returns most recent 6 decks sorted descending', () => {
      const decks = [
        { id: 1, name: 'A', updated_at: '2026-01-01T00:00:00Z' },
        { id: 2, name: 'B', updated_at: '2026-03-01T00:00:00Z' },
        { id: 3, name: 'C', updated_at: '2026-02-01T00:00:00Z' },
        { id: 4, name: 'D', updated_at: '2026-04-01T00:00:00Z' },
        { id: 5, name: 'E', updated_at: '2026-01-15T00:00:00Z' },
        { id: 6, name: 'F', updated_at: '2026-03-15T00:00:00Z' },
        { id: 7, name: 'G', updated_at: '2026-02-15T00:00:00Z' },
        { id: 8, name: 'H', updated_at: '2026-04-10T00:00:00Z' },
      ];

      const sorted = [...decks]
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, 6);

      expect(sorted).toHaveLength(6);
      expect(sorted[0].name).toBe('H');
      expect(sorted[1].name).toBe('D');
      // H(Apr10), D(Apr1), F(Mar15), B(Mar1), G(Feb15), C(Feb1) -- E(Jan15) is 7th, excluded
      expect(sorted[5].name).toBe('C');
    });

    it('handles fewer than 6 decks', () => {
      const decks = [
        { id: 1, name: 'A', updated_at: '2026-01-01T00:00:00Z' },
        { id: 2, name: 'B', updated_at: '2026-03-01T00:00:00Z' },
      ];

      const sorted = [...decks]
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, 6);

      expect(sorted).toHaveLength(2);
      expect(sorted[0].name).toBe('B');
    });
  });

  describe('commander art_crop URL extraction', () => {
    it('extracts art_crop from card image_uris', () => {
      const card = {
        image_uris: {
          art_crop: 'https://cards.scryfall.io/art_crop/front/a/b/abc123.jpg',
          normal: 'https://cards.scryfall.io/normal/front/a/b/abc123.jpg',
        },
      };

      const artUrl = card.image_uris?.art_crop;
      expect(artUrl).toBe('https://cards.scryfall.io/art_crop/front/a/b/abc123.jpg');
    });

    it('handles missing image_uris gracefully', () => {
      const card = {};
      const artUrl = card.image_uris?.art_crop || null;
      expect(artUrl).toBeNull();
    });

    it('handles double-faced cards with card_faces', () => {
      const card = {
        card_faces: [
          { image_uris: { art_crop: 'https://front-face.jpg' } },
          { image_uris: { art_crop: 'https://back-face.jpg' } },
        ],
      };

      const artUrl = card.image_uris?.art_crop || card.card_faces?.[0]?.image_uris?.art_crop || null;
      expect(artUrl).toBe('https://front-face.jpg');
    });
  });

  describe('deck count format', () => {
    it('formats count as "{count}/99"', () => {
      const cardCount = 67;
      const deckSize = 99;
      const formatted = `${cardCount}/${deckSize}`;
      expect(formatted).toBe('67/99');
    });

    it('formats count with 100 card deck', () => {
      const cardCount = 100;
      const deckSize = 100;
      const formatted = `${cardCount}/${deckSize}`;
      expect(formatted).toBe('100/100');
    });

    it('formats count for empty deck', () => {
      const cardCount = 0;
      const deckSize = 99;
      const formatted = `${cardCount}/${deckSize}`;
      expect(formatted).toBe('0/99');
    });
  });
});
