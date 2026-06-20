// src/services/deck-legality.js
//
// Deck legality validation (audit M2 / M22 / H5 / L9). Pure, side-effect-free
// so it is trivially testable and can run on a built deck OR on a freshly
// resolved import list before any of it is written.
//
// Scope (non-blocking — these surface as WARNINGS, never hard rejections):
//   - Colour identity   : Commander only — every card's colour_identity must be
//                         a subset of the commander's combined identity.
//   - Legality / banlist: card.legalities[format] (Scryfall stores the full
//                         legalities map on every card) — banned / not_legal.
//   - Copy limits       : singleton (Commander) = 1; constructed = 4; basic
//                         lands and "any number" cards are exempt.
//   - Deck size         : Commander = exact target; constructed = minimum.

const BASIC_LAND_NAMES = new Set([
  'Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes',
  'Snow-Covered Plains', 'Snow-Covered Island', 'Snow-Covered Swamp',
  'Snow-Covered Mountain', 'Snow-Covered Forest',
]);

// App formats map 1:1 onto Scryfall legality keys (all lowercase).
const SINGLETON_FORMATS = new Set(['commander', 'brawl', 'oathbreaker', 'paupercommander']);
// Formats where deck size is a hard target rather than a minimum.
const EXACT_SIZE_FORMATS = SINGLETON_FORMATS;

/** A basic land (any number allowed in every format). */
export function isBasicLand(card) {
  if (!card) return false;
  const name = String(card.name || '').split(' //')[0].trim();
  if (BASIC_LAND_NAMES.has(name)) return true;
  return /\bBasic\b/.test(card.type_line || '') && /\bLand\b/.test(card.type_line || '');
}

/** Cards whose oracle text grants "any number" (Relentless Rats, Petitioners…). */
export function isAnyNumberCard(card) {
  return /a deck can have any number of cards named/i.test(card?.oracle_text || '');
}

/**
 * Validate a deck (or resolved import list).
 * @param {Object} opts
 * @param {string} opts.format - e.g. 'commander', 'modern', 'pauper'
 * @param {string[]} opts.commanderColorIdentity - combined commander identity (WUBRG letters)
 * @param {number} opts.deckSize - target size (100 for commander, 60 for constructed)
 * @param {Array<{ card: Object, quantity?: number }>} opts.cards - deck entries (card joined)
 * @returns {{ offColor, illegal, overCopies, total, deckSize, format, warnings: string[], hasIssues: boolean }}
 */
export function validateDeck({ format = 'commander', commanderColorIdentity = [], deckSize = 100, cards = [] } = {}) {
  const fmt = String(format || 'commander').toLowerCase();
  const singleton = SINGLETON_FORMATS.has(fmt);
  const checksColorIdentity = fmt === 'commander' || fmt === 'brawl' || fmt === 'paupercommander' || fmt === 'oathbreaker';
  const ci = new Set(Array.isArray(commanderColorIdentity) ? commanderColorIdentity : []);
  const copyLimit = singleton ? 1 : 4;

  const offColor = [];
  const illegal = [];
  const overCopies = [];
  let total = 0;

  for (const entry of cards || []) {
    const card = entry?.card || entry;
    const qty = entry?.quantity || 1;
    total += qty;
    if (!card) continue;

    const basic = isBasicLand(card);

    // Colour identity (Commander-likes only).
    if (checksColorIdentity && ci.size >= 0 && Array.isArray(card.color_identity)) {
      const out = card.color_identity.filter((c) => !ci.has(c));
      if (out.length) offColor.push({ name: card.name, colors: out });
    }

    // Legality / banlist — Scryfall: 'legal' | 'not_legal' | 'banned' | 'restricted'.
    const status = card.legalities?.[fmt];
    if (status && status !== 'legal' && status !== 'restricted') {
      illegal.push({ name: card.name, status });
    }

    // Copy limits (basics + "any number" cards exempt).
    if (!basic && !isAnyNumberCard(card) && qty > copyLimit) {
      overCopies.push({ name: card.name, qty, limit: copyLimit });
    }
  }

  const warnings = [];
  if (offColor.length) {
    warnings.push(`${offColor.length} card${offColor.length === 1 ? '' : 's'} outside the commander's colour identity`);
  }
  if (illegal.length) {
    const banned = illegal.filter((c) => c.status === 'banned').length;
    warnings.push(banned
      ? `${illegal.length} card${illegal.length === 1 ? '' : 's'} not legal in ${fmt} (${banned} banned)`
      : `${illegal.length} card${illegal.length === 1 ? '' : 's'} not legal in ${fmt}`);
  }
  if (overCopies.length) {
    warnings.push(`${overCopies.length} card${overCopies.length === 1 ? '' : 's'} over the ${copyLimit}-copy limit`);
  }

  // Size: exact target for singleton formats, minimum for constructed.
  if (EXACT_SIZE_FORMATS.has(fmt)) {
    if (total > deckSize) warnings.push(`${total - deckSize} card${total - deckSize === 1 ? '' : 's'} over the ${deckSize}-card limit`);
    else if (total < deckSize) warnings.push(`${deckSize - total} more card${deckSize - total === 1 ? '' : 's'} needed (${total}/${deckSize})`);
  } else if (total < deckSize) {
    warnings.push(`Below the ${deckSize}-card minimum (${total}/${deckSize})`);
  }

  return {
    offColor,
    illegal,
    overCopies,
    total,
    deckSize,
    format: fmt,
    warnings,
    hasIssues: warnings.length > 0,
  };
}
