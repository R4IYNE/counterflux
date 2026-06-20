import Papa from 'papaparse';

/**
 * Generate a CSV string from collection entries.
 * Pure function for testability -- no side effects.
 * @param {Array} entries - Collection entries with joined card data
 * @returns {string} CSV string
 */
const EXPORT_COLUMNS = ['Name', 'Set', 'Set Code', 'Collector Number', 'Quantity', 'Foil', 'Condition', 'Language', 'Price EUR', 'Category'];

// L23 — neutralise spreadsheet formula injection: a cell beginning with one of
// = + - @ TAB CR is treated as a formula by Excel/Sheets, so prefix it with a
// single quote. Applied to the card/user-derived string columns.
function _csvSafe(v) {
  const s = v == null ? '' : String(v);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

export function generateCSV(entries) {
  const rows = entries.map(e => ({
    Name: _csvSafe(e.card?.name || ''),
    Set: _csvSafe(e.card?.set_name || ''),
    'Set Code': _csvSafe(e.card?.set || ''),
    'Collector Number': _csvSafe(e.card?.collector_number || ''),
    Quantity: e.quantity,
    Foil: e.foil ? 'foil' : '',
    Condition: e.condition || 'NM',
    Language: e.language || 'en',
    'Price EUR': e.foil
      ? (e.card?.prices?.eur_foil || '')
      : (e.card?.prices?.eur || ''),
    Category: _csvSafe(e.category),
  }));
  // Explicitly specify fields to ensure headers are present even for empty data
  return Papa.unparse({ fields: EXPORT_COLUMNS, data: rows });
}

/**
 * Export the collection as a CSV file download.
 * Triggers a browser download of the generated CSV.
 * @param {Array} entries - Collection entries with joined card data
 */
export function exportCollection(entries) {
  const csv = generateCSV(entries);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `counterflux-collection-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
