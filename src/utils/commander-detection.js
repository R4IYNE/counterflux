/**
 * Commander-specific card detection utilities.
 * Identifies partner types, legendary status, companion, and background mechanics.
 */

/**
 * Check if a card can be a commander (legendary creature/planeswalker or special text).
 * @param {Object} card - Scryfall card object
 * @returns {boolean}
 */
export function isLegendary(card) {
  const typeLine = card?.type_line || '';
  const oracleText = card?.oracle_text || '';

  // Must be Legendary AND a Creature or Planeswalker
  const isLegendaryCreatureOrPW =
    typeLine.includes('Legendary') &&
    (typeLine.includes('Creature') || typeLine.includes('Planeswalker'));

  // Edge case: some cards say "can be your commander"
  const canBeCommander = oracleText.toLowerCase().includes('can be your commander');

  return isLegendaryCreatureOrPW || canBeCommander;
}

/**
 * Check if card has generic Partner (not "Partner with").
 * @param {Object} card - Scryfall card object
 * @returns {boolean}
 */
export function hasPartner(card) {
  const keywords = card?.keywords || [];
  const oracleText = card?.oracle_text || '';

  if (!keywords.includes('Partner')) return false;

  // Generic Partner does NOT include "Partner with" in oracle text
  return !/Partner with /i.test(oracleText);
}

/**
 * Check if card has "Partner with" targeting a specific card.
 * @param {Object} card - Scryfall card object
 * @param {string} targetName - Name of the partner card to check
 * @returns {boolean}
 */
export function hasPartnerWith(card, targetName) {
  const oracleText = card?.oracle_text || '';
  return oracleText.includes(`Partner with ${targetName}`);
}

/**
 * Check if card has "Choose a Background" keyword.
 * @param {Object} card - Scryfall card object
 * @returns {boolean}
 */
export function choosesBackground(card) {
  const keywords = card?.keywords || [];
  return keywords.includes('Choose a Background');
}

/**
 * Check if card is a Background enchantment.
 * @param {Object} card - Scryfall card object
 * @returns {boolean}
 */
export function isBackground(card) {
  const typeLine = card?.type_line || '';
  return typeLine.includes('Background');
}

/**
 * Check if card has Companion keyword.
 * @param {Object} card - Scryfall card object
 * @returns {boolean}
 */
export function isCompanion(card) {
  const keywords = card?.keywords || [];
  return keywords.includes('Companion');
}

/**
 * Check if card has Friends forever keyword.
 * @param {Object} card - Scryfall card object
 * @returns {boolean}
 */
export function hasFriendsForever(card) {
  const keywords = card?.keywords || [];
  return keywords.includes('Friends forever');
}

/**
 * Merge two color identity arrays, deduplicate, and sort alphabetically.
 * @param {string[]} identity1
 * @param {string[]} identity2
 * @returns {string[]} Merged and sorted color identity
 */
export function mergeColorIdentity(identity1, identity2) {
  return [...new Set([...(identity1 || []), ...(identity2 || [])])].sort();
}
