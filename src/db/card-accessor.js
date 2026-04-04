/**
 * Unified card data accessor for all Scryfall card layouts.
 *
 * Double-sided layouts (images on card_faces):
 *   transform, modal_dfc, double_faced_token, reversible_card
 *
 * Single-image layouts (image at root):
 *   normal, saga, leveler, class, mutate, prototype, split, flip, adventure, meld
 */

const DOUBLE_SIDED_LAYOUTS = ['transform', 'modal_dfc', 'double_faced_token', 'reversible_card'];

export function getCardImage(card, face = 0, size = 'normal') {
  if (DOUBLE_SIDED_LAYOUTS.includes(card.layout)) {
    return card.card_faces?.[face]?.image_uris?.[size] ?? null;
  }
  return card.image_uris?.[size] ?? null;
}

export function getCardName(card) {
  return card.name;
}

export function getCardFrontName(card) {
  if (card.card_faces?.length) return card.card_faces[0].name;
  return card.name;
}

export function getCardManaCost(card) {
  if (card.mana_cost) return card.mana_cost;
  if (card.card_faces?.length) return card.card_faces[0].mana_cost;
  return '';
}

export function getCardOracleText(card) {
  if (card.oracle_text) return card.oracle_text;
  if (card.card_faces?.length) {
    return card.card_faces.map(f => f.oracle_text).filter(Boolean).join('\n---\n');
  }
  return '';
}

export function getCardTypeLine(card) {
  if (card.type_line) return card.type_line;
  if (card.card_faces?.length) return card.card_faces[0].type_line;
  return '';
}

export function getCardThumbnail(card) {
  return getCardImage(card, 0, 'small');
}
