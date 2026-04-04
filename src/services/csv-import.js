import Papa from 'papaparse';
import { searchCards } from '../db/search.js';
import { db } from '../db/schema.js';

/**
 * Known CSV column header signatures for auto-detection.
 * Order matters: moxfield is checked before deckbox because
 * Moxfield headers are a superset of Deckbox headers.
 */
const FORMAT_SIGNATURES = {
  deckbox: ['Count', 'Tradelist Count', 'Name', 'Edition', 'Condition', 'Language', 'Foil'],
  moxfield: ['Count', 'Tradelist Count', 'Name', 'Edition', 'Condition', 'Language', 'Foil', 'Tags', 'Last Modified', 'Collector Number'],
  archidekt: ['export_type', 'scryfall_uuid', 'set_code', 'quantity', 'foil_quantity', 'card_name'],
};

/**
 * Detect which MTG platform exported a CSV based on column headers.
 * @param {string[]} headers - Column header names
 * @returns {'deckbox'|'moxfield'|'archidekt'|'generic'}
 */
export function detectFormat(headers) {
  const normalised = headers.map(h => h.trim());
  // Check moxfield BEFORE deckbox (moxfield is a superset of deckbox headers)
  if (FORMAT_SIGNATURES.moxfield.every(col => normalised.includes(col))) return 'moxfield';
  if (FORMAT_SIGNATURES.deckbox.every(col => normalised.includes(col))) return 'deckbox';
  if (FORMAT_SIGNATURES.archidekt.every(col => normalised.includes(col))) return 'archidekt';
  return 'generic';
}

/**
 * Normalise a CSV row from any format to a common internal shape.
 * @param {Object} row - Raw CSV row object
 * @param {'deckbox'|'moxfield'|'archidekt'|'generic'} format
 * @returns {{ name: string, quantity: number, foil: boolean, setName?: string, setCode?: string, collectorNumber?: string, scryfallId?: string }}
 */
export function normaliseRow(row, format) {
  switch (format) {
    case 'deckbox':
      return {
        name: row['Name'],
        quantity: parseInt(row['Count'], 10) || 1,
        setName: row['Edition'] || null,
        foil: (row['Foil'] || '').toLowerCase() === 'foil',
      };
    case 'moxfield':
      return {
        name: row['Name'],
        quantity: parseInt(row['Count'], 10) || 1,
        setCode: row['Edition'] || null,
        collectorNumber: row['Collector Number'] || null,
        foil: ['foil', 'etched'].includes((row['Foil'] || '').toLowerCase()),
      };
    case 'archidekt':
      return {
        name: row['card_name'] || row['english_card_name'],
        quantity: parseInt(row['quantity'], 10) || 1,
        setCode: row['set_code'] || null,
        scryfallId: row['scryfall_uuid'] || null,
        foil: parseInt(row['foil_quantity'], 10) > 0,
      };
    default:
      return {
        name: row['Name'] || row['name'] || row['Card Name'] || row['card_name'] || '',
        quantity: parseInt(row['Quantity'] || row['Count'] || row['qty'] || '1', 10) || 1,
        foil: false,
      };
  }
}

/**
 * Parse a CSV file and return normalised entries with detected format.
 * @param {File} file - CSV file from file input
 * @returns {Promise<{ format: string, entries: Array, errors: Array, headers: string[] }>}
 */
export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete(results) {
        const format = detectFormat(results.meta.fields || []);
        const entries = results.data.map(row => normaliseRow(row, format));
        resolve({ format, entries, errors: results.errors, headers: results.meta.fields });
      },
      error(err) { reject(err); },
    });
  });
}

/**
 * Resolve import entries against the local card database.
 * Attempts Scryfall UUID lookup first, then name search with
 * DFC normalisation (split on " // ", use front face).
 * @param {Array} entries - Normalised import entries
 * @returns {Promise<Array>} Entries with resolved card data
 */
export async function resolveImportEntries(entries) {
  const results = [];
  for (const entry of entries) {
    if (!entry.name) {
      results.push({ ...entry, resolved: false });
      continue;
    }

    // If archidekt provides scryfall_uuid, try direct lookup
    if (entry.scryfallId) {
      const card = await db.cards.get(entry.scryfallId);
      if (card) {
        results.push({ ...entry, resolved: true, card });
        continue;
      }
    }

    // Search by name, normalise for DFC matching (split on " // ", use front face)
    const searchName = entry.name.split(' // ')[0].trim();
    const cards = await searchCards(searchName, 5);

    let match = null;
    // Try exact set + collector number match first
    if (entry.collectorNumber && entry.setCode && cards.length) {
      match = cards.find(c => c.set === entry.setCode.toLowerCase() && c.collector_number === entry.collectorNumber);
    }
    // Then try set code match
    if (!match && entry.setCode && cards.length) {
      match = cards.find(c => c.set === entry.setCode.toLowerCase());
    }
    // Then try set name match (deckbox uses Edition names)
    if (!match && entry.setName && cards.length) {
      match = cards.find(c => c.set_name?.toLowerCase() === entry.setName.toLowerCase());
    }
    // Fallback to first result
    if (!match && cards.length) match = cards[0];

    results.push({ ...entry, resolved: !!match, card: match || null });
  }
  return results;
}
