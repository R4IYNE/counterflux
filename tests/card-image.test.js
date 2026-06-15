// Card-art-by-name resolution for synergy suggestions + combo pieces.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

// card-image.js → db/schema.js imports alpinejs (touches window); mock it so
// this stays a clean node-env unit test (same approach as the other db tests).
vi.mock('alpinejs', () => ({ default: { store: () => ({}) } }));

import { db } from '../src/db/schema.js';
import { cardImageByName } from '../src/utils/card-image.js';

beforeEach(async () => {
  await db.cards.clear();
});

describe('cardImageByName', () => {
  it('returns art_crop when present', async () => {
    await db.cards.put({ id: 'a', name: 'Sol Ring', image_uris: { art_crop: 'art.jpg', small: 'small.jpg' } });
    expect(await cardImageByName('Sol Ring')).toBe('art.jpg');
  });

  it('falls back to small when art_crop absent', async () => {
    await db.cards.put({ id: 'b', name: 'Arcane Signet', image_uris: { small: 'small.jpg' } });
    expect(await cardImageByName('Arcane Signet')).toBe('small.jpg');
  });

  it('handles double-faced cards via card_faces', async () => {
    await db.cards.put({ id: 'c', name: 'Valki, God of Lies', card_faces: [{ image_uris: { art_crop: 'front.jpg' } }] });
    expect(await cardImageByName('Valki, God of Lies')).toBe('front.jpg');
  });

  it('returns empty string on miss / blank / no image', async () => {
    await db.cards.put({ id: 'd', name: 'No Art Card' });
    expect(await cardImageByName('No Art Card')).toBe('');
    expect(await cardImageByName('Nonexistent')).toBe('');
    expect(await cardImageByName('')).toBe('');
    expect(await cardImageByName(null)).toBe('');
  });
});
