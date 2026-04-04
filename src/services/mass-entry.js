/**
 * Mass entry batch syntax parser and card resolver.
 *
 * Syntax: {qty}x {card name} [{set code}] {foil?}
 * Examples:
 *   4x Lightning Bolt [2XM] foil
 *   2x Sol Ring
 *   1x Counterspell [MH2]
 */

const BATCH_LINE_REGEX = /^(\d+)x?\s+(.+?)(?:\s+\[(\w+)\])?(\s+foil)?$/i;

/**
 * Parse a single batch line into structured data.
 * @param {string} line - Raw input line
 * @returns {object|null} Parsed entry or null for empty input
 */
export function parseBatchLine(line) {
  const trimmed = (line || '').trim();
  if (!trimmed) return null;

  const match = trimmed.match(BATCH_LINE_REGEX);
  if (!match) return { raw: trimmed, parsed: false };

  return {
    raw: trimmed,
    parsed: true,
    quantity: parseInt(match[1], 10),
    name: match[2].trim(),
    setCode: match[3] || null,
    foil: !!match[4],
  };
}

/**
 * Parse multiline batch text into an array of entries.
 * Empty lines are filtered out.
 * @param {string} text - Multiline input
 * @returns {Array} Array of parsed entries
 */
export function parseBatchText(text) {
  return text
    .split('\n')
    .map(parseBatchLine)
    .filter(Boolean);
}

/**
 * Resolve parsed entries against the card database.
 * @param {Array} parsed - Array of parsed batch entries
 * @param {Function} searchFn - Search function (query, limit) => Promise<Card[]>
 * @returns {Promise<Array>} Entries with resolution status and matched card data
 */
export async function resolveBatchEntries(parsed, searchFn) {
  const results = [];

  for (const entry of parsed) {
    if (!entry.parsed) {
      results.push({ ...entry, resolved: false, candidates: [] });
      continue;
    }

    const cards = await searchFn(entry.name, 5);
    let match = null;

    if (entry.setCode) {
      match = cards.find((c) => c.set === entry.setCode.toLowerCase());
    }
    if (!match && cards.length > 0) {
      // Auto-resolve to first match (newest printing) per D-13
      match = cards[0];
    }

    results.push({
      ...entry,
      resolved: !!match,
      card: match || null,
      candidates: cards,
    });
  }

  return results;
}
