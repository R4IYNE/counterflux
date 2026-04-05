/**
 * Deck export service -- generate decklists in multiple formats.
 *
 * Supported formats: Plain Text, MTGO, Arena, CSV
 */

import Papa from 'papaparse';

/**
 * Format a single card line: "{qty} {name}"
 */
function cardLine(qty, name) {
  return `${qty} ${name}`;
}

/**
 * Export deck as plain text with commander section header.
 * @param {Array} activeCards - Deck cards with card data
 * @param {object} activeDeck - Deck metadata
 * @param {object|null} commanderCard - Commander card data (from cards table)
 * @returns {string}
 */
export function exportPlaintext(activeCards, activeDeck, commanderCard) {
  const lines = [];

  if (commanderCard && activeDeck?.commander_id) {
    lines.push('// Commander');
    lines.push(cardLine(1, commanderCard.name));
    lines.push('');
    lines.push('// The 99');
  }

  // Filter out commander from main cards, sort alphabetically
  const mainCards = activeCards
    .filter(c => c.scryfall_id !== activeDeck?.commander_id && c.scryfall_id !== activeDeck?.partner_id)
    .sort((a, b) => (a.card?.name || '').localeCompare(b.card?.name || ''));

  for (const entry of mainCards) {
    if (entry.card?.name) {
      lines.push(cardLine(entry.quantity, entry.card.name));
    }
  }

  return lines.join('\n');
}

/**
 * Export deck as MTGO format.
 * For Commander: same as plaintext. For 60-card: no section headers.
 * @param {Array} activeCards
 * @param {object} activeDeck
 * @param {object|null} commanderCard
 * @returns {string}
 */
export function exportMTGO(activeCards, activeDeck, commanderCard) {
  if (activeDeck?.format === 'commander' || activeDeck?.commander_id) {
    return exportPlaintext(activeCards, activeDeck, commanderCard);
  }

  // 60-card format: no section headers
  const sorted = [...activeCards].sort((a, b) => (a.card?.name || '').localeCompare(b.card?.name || ''));
  return sorted
    .filter(c => c.card?.name)
    .map(c => cardLine(c.quantity, c.card.name))
    .join('\n');
}

/**
 * Export deck as Arena format: "{qty} {name} ({SET}) {num}"
 * @param {Array} activeCards
 * @param {object} activeDeck
 * @param {object|null} commanderCard
 * @returns {string}
 */
export function exportArena(activeCards, activeDeck, commanderCard) {
  const lines = [];

  if (commanderCard && activeDeck?.commander_id) {
    const set = (commanderCard.set || '').toUpperCase();
    const num = commanderCard.collector_number || '0';
    lines.push(`1 ${commanderCard.name} (${set}) ${num}`);
  }

  const mainCards = activeCards
    .filter(c => c.scryfall_id !== activeDeck?.commander_id && c.scryfall_id !== activeDeck?.partner_id)
    .sort((a, b) => (a.card?.name || '').localeCompare(b.card?.name || ''));

  for (const entry of mainCards) {
    if (entry.card?.name) {
      const set = (entry.card.set || '').toUpperCase();
      const num = entry.card.collector_number || '0';
      lines.push(`${entry.quantity} ${entry.card.name} (${set}) ${num}`);
    }
  }

  return lines.join('\n');
}

/**
 * Export deck as CSV using PapaParse.
 * @param {Array} activeCards
 * @param {object} activeDeck
 * @param {object|null} commanderCard
 * @returns {string}
 */
export function exportCSV(activeCards, activeDeck, commanderCard) {
  const rows = [];

  if (commanderCard && activeDeck?.commander_id) {
    rows.push({
      Name: commanderCard.name,
      Quantity: 1,
      Set: (commanderCard.set || '').toUpperCase(),
      'Collector Number': commanderCard.collector_number || '',
      'Mana Cost': commanderCard.mana_cost || '',
      Type: commanderCard.type_line || '',
    });
  }

  const mainCards = activeCards
    .filter(c => c.scryfall_id !== activeDeck?.commander_id && c.scryfall_id !== activeDeck?.partner_id);

  for (const entry of mainCards) {
    if (entry.card?.name) {
      rows.push({
        Name: entry.card.name,
        Quantity: entry.quantity,
        Set: (entry.card.set || '').toUpperCase(),
        'Collector Number': entry.card.collector_number || '',
        'Mana Cost': entry.card.mana_cost || '',
        Type: entry.card.type_line || '',
      });
    }
  }

  const fields = ['Name', 'Quantity', 'Set', 'Collector Number', 'Mana Cost', 'Type'];

  if (rows.length === 0) {
    return fields.join(',');
  }

  return Papa.unparse(rows, { fields });
}
