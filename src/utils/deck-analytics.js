/**
 * Deck analytics computation.
 * Pure function for single-pass analysis of deck card arrays.
 * Extracted from deck store for independent testability.
 */

import { classifyType } from './type-classifier.js';
import { eurToGbpValue } from '../services/currency.js';

/**
 * Compute deck analytics in a single pass over the active cards array.
 * @param {Array} cards - activeCards array with { card, quantity, tags, owned }
 * @returns {Object} Analytics object
 */
export function computeDeckAnalytics(cards) {
  const manaCurve = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, '7+': 0 };
  const colourPie = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  const typeBreakdown = {};
  const tagBreakdown = {};
  let totalCmc = 0;
  let nonLandCount = 0;
  let totalPrice = 0;
  let unownedPrice = 0;
  let mostExpensive = { name: '', price: 0 };

  for (const entry of cards) {
    const card = entry.card;
    if (!card) continue;

    const qty = entry.quantity || 1;
    const type = classifyType(card.type_line);
    const isLand = type === 'Land';

    // Type breakdown
    typeBreakdown[type] = (typeBreakdown[type] || 0) + qty;

    // Mana curve (exclude lands)
    if (!isLand) {
      const cmc = card.cmc || 0;
      const bucket = cmc >= 7 ? '7+' : cmc;
      manaCurve[bucket] = (manaCurve[bucket] || 0) + qty;
      totalCmc += cmc * qty;
      nonLandCount += qty;
    }

    // Colour pie: count mana symbols from mana_cost
    const manaCost = card.mana_cost || '';
    const symbols = manaCost.match(/\{([WUBRGC])\}/g) || [];
    for (const sym of symbols) {
      const colour = sym.replace(/[{}]/g, '');
      if (colourPie[colour] !== undefined) {
        colourPie[colour] += qty;
      }
    }

    // Tag breakdown
    const tags = entry.tags || [];
    for (const tag of tags) {
      tagBreakdown[tag] = (tagBreakdown[tag] || 0) + qty;
    }

    // Price calculations
    const eurPrice = parseFloat(card.prices?.eur || '0');
    const gbpPrice = eurToGbpValue(eurPrice);
    const totalCardPrice = gbpPrice * qty;
    totalPrice += totalCardPrice;

    if (!entry.owned) {
      unownedPrice += totalCardPrice;
    }

    if (gbpPrice > mostExpensive.price) {
      mostExpensive = { name: card.name || '', price: gbpPrice };
    }
  }

  return {
    manaCurve,
    colourPie,
    typeBreakdown,
    tagBreakdown,
    averageCmc: nonLandCount > 0 ? totalCmc / nonLandCount : 0,
    totalPrice,
    unownedPrice,
    mostExpensive,
  };
}
