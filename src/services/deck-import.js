/**
 * Deck import service -- parse decklists from multiple platforms.
 *
 * Supported formats:
 * - Moxfield: section headers (// Commander, // The 99, etc.)
 * - Archidekt: category headers (Creatures (23), Instants (8), etc.)
 * - Arena: {qty} {name} ({set}) {num}
 * - Plain text: {qty}[x] {name}
 */

const CARD_LINE = /^(\d+)x?\s+(.+)$/;
const ARENA_LINE = /^(\d+)x?\s+(.+?)\s+\(([A-Z0-9]+)\)\s+(\S+)$/;
const SECTION_HEADER = /^\/\/\s*(Commander|Companion|The 99|Sideboard|Maybeboard)/i;
const CATEGORY_HEADER = /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*\(\d+\)$/;

/**
 * Auto-detect decklist format from text content.
 * @param {string} text - Raw decklist text
 * @returns {'moxfield'|'archidekt'|'arena'|'plaintext'}
 */
export function detectFormat(text) {
  const lines = text.trim().split('\n');
  if (lines.some(l => SECTION_HEADER.test(l.trim()))) return 'moxfield';
  if (lines.some(l => CATEGORY_HEADER.test(l.trim()))) return 'archidekt';
  if (lines.some(l => ARENA_LINE.test(l.trim()))) return 'arena';
  return 'plaintext';
}

/**
 * Parse a single card line: "{qty}[x] {name}"
 * @param {string} line
 * @returns {{ qty: number, name: string }|null}
 */
function parseCardLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('//')) return null;
  const match = trimmed.match(CARD_LINE);
  if (!match) return null;
  return { qty: parseInt(match[1], 10), name: match[2].trim() };
}

/**
 * Parse Moxfield-format decklist with section headers.
 * @param {string} text
 * @returns {{ commander: Array, companion: Array, main: Array, sideboard: Array }}
 */
export function parseMoxfield(text) {
  const result = { commander: [], companion: [], main: [], sideboard: [] };
  let currentSection = 'main';

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    const headerMatch = trimmed.match(SECTION_HEADER);
    if (headerMatch) {
      const section = headerMatch[1].toLowerCase();
      if (section === 'commander') currentSection = 'commander';
      else if (section === 'companion') currentSection = 'companion';
      else if (section === 'the 99') currentSection = 'main';
      else if (section === 'sideboard') currentSection = 'sideboard';
      else if (section === 'maybeboard') currentSection = 'maybeboard';
      continue;
    }

    const card = parseCardLine(trimmed);
    if (card) {
      if (currentSection === 'maybeboard') continue; // skip maybeboard
      (result[currentSection] || result.main).push(card);
    }
  }

  return result;
}

/**
 * Parse Archidekt-format decklist with category headers.
 * @param {string} text
 * @returns {{ main: Array }}
 */
export function parseArchidekt(text) {
  const main = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || CATEGORY_HEADER.test(trimmed)) continue;
    const card = parseCardLine(trimmed);
    if (card) main.push(card);
  }
  return { main };
}

/**
 * Parse Arena-format decklist: "{qty} {name} ({set}) {num}"
 * @param {string} text
 * @returns {{ main: Array<{ qty: number, name: string, set: string, num: string }> }}
 */
export function parseArena(text) {
  const main = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(ARENA_LINE);
    if (match) {
      main.push({
        qty: parseInt(match[1], 10),
        name: match[2].trim(),
        set: match[3],
        num: match[4],
      });
    } else {
      // Fallback: try simple card line (Arena sometimes has non-set lines)
      const card = parseCardLine(trimmed);
      if (card) main.push(card);
    }
  }
  return { main };
}

/**
 * Parse plain text decklist: "{qty}[x] {name}"
 * @param {string} text
 * @returns {{ main: Array }}
 */
export function parsePlaintext(text) {
  const main = [];
  for (const line of text.split('\n')) {
    const card = parseCardLine(line);
    if (card) main.push(card);
  }
  return { main };
}

/**
 * Auto-detect format and parse decklist.
 * @param {string} text
 * @returns {object} Parsed decklist structure
 */
export function parseDecklist(text) {
  const format = detectFormat(text);
  switch (format) {
    case 'moxfield': return parseMoxfield(text);
    case 'archidekt': return parseArchidekt(text);
    case 'arena': return parseArena(text);
    default: return parsePlaintext(text);
  }
}

/**
 * Resolve parsed decklist entries against a card search function.
 * @param {object} parsed - Output from parseDecklist
 * @param {Function} searchFn - (name, limit?) => Promise<Card[]>
 * @returns {Promise<{ resolved: Array, unresolved: Array }>}
 */
export async function resolveDecklist(parsed, searchFn) {
  const resolved = [];
  const unresolved = [];

  async function resolveEntries(entries, flags = {}) {
    for (const entry of entries) {
      const cards = await searchFn(entry.name, 5);
      let match = null;

      // Arena format: try exact set+num match first
      if (entry.set) {
        match = cards.find(c => c.set === entry.set.toLowerCase() && c.collector_number === entry.num);
      }
      if (!match && cards.length > 0) {
        match = cards[0]; // First result (best match)
      }

      if (match) {
        resolved.push({
          qty: entry.qty,
          name: entry.name,
          scryfallId: match.id,
          card: match,
          ...flags,
        });
      } else {
        unresolved.push({
          qty: entry.qty,
          name: entry.name,
          reason: 'No matching card found',
        });
      }
    }
  }

  if (parsed.commander?.length) {
    await resolveEntries(parsed.commander, { isCommander: true });
  }
  if (parsed.companion?.length) {
    await resolveEntries(parsed.companion, { isCompanion: true });
  }
  await resolveEntries(parsed.main || []);
  if (parsed.sideboard?.length) {
    await resolveEntries(parsed.sideboard, { isSideboard: true });
  }

  return { resolved, unresolved };
}
