/**
 * Resolve card art from the local Scryfall catalog (db.cards) by exact name.
 *
 * Used by surfaces that only carry a card NAME (EDHREC synergy suggestions,
 * Commander Spellbook combo pieces) and want to show a thumbnail. `name` is an
 * indexed column on the cards table, so the lookup is cheap + offline.
 */

import { db } from '../db/schema.js';

/**
 * @param {string} name - exact card name
 * @returns {Promise<string>} art-crop / small image URL, or '' on miss.
 */
export async function cardImageByName(name) {
  if (!name) return '';
  try {
    const c = await db.cards.where('name').equals(name).first();
    if (!c) return '';
    return (
      c.image_uris?.art_crop ||
      c.image_uris?.small ||
      c.card_faces?.[0]?.image_uris?.art_crop ||
      c.card_faces?.[0]?.image_uris?.small ||
      ''
    );
  } catch {
    return '';
  }
}

/**
 * Set an <img>'s src from the catalog by card name (fire-and-forget). Hides the
 * element on miss/error so callers can render the <img> synchronously and let
 * the art fill in. DFC fronts whose name doesn't exactly match (e.g. stored as
 * "Front // Back") simply stay hidden — a graceful no-op, not a broken icon.
 *
 * @param {HTMLImageElement} img
 * @param {string} name
 */
export async function hydrateCardImg(img, name) {
  if (!img) return;
  const src = await cardImageByName(name);
  if (src) {
    img.src = src;
  } else {
    img.style.visibility = 'hidden';
  }
}
