/**
 * Mana cost rendering utility.
 * Converts Scryfall mana cost strings like "{2}{U}{R}" into mana-font HTML.
 */

/**
 * Parse a Scryfall mana cost string into mana-font icon HTML.
 * @param {string} manaCostString - e.g. "{2}{U}{R}", "{W/U}", "{X}"
 * @returns {string} HTML string with mana-font <i> elements
 */
export function renderManaCost(manaCostString) {
  if (!manaCostString) return '';
  return manaCostString.replace(/\{([^}]+)\}/g, (match, symbol) => {
    const cls = symbol.toLowerCase().replace('/', '');
    return `<i class="ms ms-${cls} ms-cost" style="border-radius: 0;"></i>`;
  });
}
