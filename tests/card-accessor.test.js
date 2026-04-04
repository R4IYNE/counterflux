import { describe, it, expect } from 'vitest';
import {
  getCardImage,
  getCardName,
  getCardFrontName,
  getCardManaCost,
  getCardOracleText,
  getCardTypeLine,
  getCardThumbnail,
} from '../src/db/card-accessor.js';
import sampleCards from './fixtures/sample-cards.json';

const byLayout = (layout) => sampleCards.find(c => c.layout === layout);

describe('Card accessor', () => {
  describe('getCardImage', () => {
    it('returns root image_uris for normal layout', () => {
      const card = byLayout('normal');
      const url = getCardImage(card);
      expect(url).toBe(card.image_uris.normal);
    });

    it('returns card_faces[0].image_uris for transform layout', () => {
      const card = byLayout('transform');
      const url = getCardImage(card);
      expect(url).toBe(card.card_faces[0].image_uris.normal);
    });

    it('returns card_faces[1].image_uris for transform layout face=1', () => {
      const card = byLayout('transform');
      const url = getCardImage(card, 1);
      expect(url).toBe(card.card_faces[1].image_uris.normal);
    });

    it('returns card_faces[0].image_uris for modal_dfc layout', () => {
      const card = byLayout('modal_dfc');
      const url = getCardImage(card);
      expect(url).toBe(card.card_faces[0].image_uris.normal);
    });

    it('returns root image_uris for split layout', () => {
      const card = byLayout('split');
      const url = getCardImage(card);
      expect(url).toBe(card.image_uris.normal);
    });

    it('returns root image_uris for adventure layout', () => {
      const card = byLayout('adventure');
      const url = getCardImage(card);
      expect(url).toBe(card.image_uris.normal);
    });

    it('returns root image_uris for flip layout', () => {
      const card = byLayout('flip');
      const url = getCardImage(card);
      expect(url).toBe(card.image_uris.normal);
    });

    it('returns root image_uris for meld layout', () => {
      const card = byLayout('meld');
      const url = getCardImage(card);
      expect(url).toBe(card.image_uris.normal);
    });

    it('returns root image_uris for saga layout', () => {
      const card = byLayout('saga');
      const url = getCardImage(card);
      expect(url).toBe(card.image_uris.normal);
    });

    it('returns specified size', () => {
      const card = byLayout('normal');
      const url = getCardImage(card, 0, 'small');
      expect(url).toBe(card.image_uris.small);
    });
  });

  describe('getCardName', () => {
    it('returns full name including both faces for DFC', () => {
      const card = byLayout('transform');
      expect(getCardName(card)).toBe('Delver of Secrets // Insectile Aberration');
    });

    it('returns name for normal layout', () => {
      const card = byLayout('normal');
      expect(getCardName(card)).toBe('Lightning Bolt');
    });
  });

  describe('getCardFrontName', () => {
    it('returns front face name for DFC', () => {
      const card = byLayout('transform');
      expect(getCardFrontName(card)).toBe('Delver of Secrets');
    });

    it('returns name for normal layout (no faces)', () => {
      const card = byLayout('normal');
      expect(getCardFrontName(card)).toBe('Lightning Bolt');
    });
  });

  describe('getCardManaCost', () => {
    it('returns mana_cost from root for normal layout', () => {
      const card = byLayout('normal');
      expect(getCardManaCost(card)).toBe('{R}');
    });

    it('returns mana_cost from card_faces[0] for DFC (transform)', () => {
      const card = byLayout('transform');
      expect(getCardManaCost(card)).toBe('{U}');
    });

    it('returns mana_cost from root for split layout', () => {
      const card = byLayout('split');
      expect(getCardManaCost(card)).toBe('{1}{R} // {1}{U}');
    });

    it('returns mana_cost from root for adventure layout', () => {
      const card = byLayout('adventure');
      expect(getCardManaCost(card)).toBe('{2}{R}');
    });
  });

  describe('getCardOracleText', () => {
    it('returns oracle_text from root for normal layout', () => {
      const card = byLayout('normal');
      expect(getCardOracleText(card)).toBe('Lightning Bolt deals 3 damage to any target.');
    });

    it('joins both faces with separator for DFC cards', () => {
      const card = byLayout('transform');
      const text = getCardOracleText(card);
      expect(text).toContain('At the beginning of your upkeep');
      expect(text).toContain('---');
      expect(text).toContain('Flying');
    });

    it('returns oracle_text from root for meld layout', () => {
      const card = byLayout('meld');
      expect(getCardOracleText(card)).toContain('Flying, vigilance');
    });
  });

  describe('getCardTypeLine', () => {
    it('returns type_line from root for normal layout', () => {
      const card = byLayout('normal');
      expect(getCardTypeLine(card)).toBe('Instant');
    });

    it('returns type_line from root for DFC (has composite type_line)', () => {
      const card = byLayout('transform');
      expect(getCardTypeLine(card)).toContain('Creature');
    });
  });

  describe('getCardThumbnail', () => {
    it('returns small image for normal layout', () => {
      const card = byLayout('normal');
      expect(getCardThumbnail(card)).toBe(card.image_uris.small);
    });

    it('returns small image from card_faces[0] for transform layout', () => {
      const card = byLayout('transform');
      expect(getCardThumbnail(card)).toBe(card.card_faces[0].image_uris.small);
    });
  });
});
