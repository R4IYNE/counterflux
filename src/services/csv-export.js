import Papa from 'papaparse';

/**
 * Generate a CSV string from collection entries.
 * Pure function for testability -- no side effects.
 * @param {Array} entries - Collection entries with joined card data
 * @returns {string} CSV string
 */
const EXPORT_COLUMNS = ['Name', 'Set', 'Set Code', 'Collector Number', 'Quantity', 'Foil', 'Price EUR', 'Category'];

export function generateCSV(entries) {
  const rows = entries.map(e => ({
    Name: e.card?.name || '',
    Set: e.card?.set_name || '',
    'Set Code': e.card?.set || '',
    'Collector Number': e.card?.collector_number || '',
    Quantity: e.quantity,
    Foil: e.foil ? 'foil' : '',
    'Price EUR': e.foil
      ? (e.card?.prices?.eur_foil || '')
      : (e.card?.prices?.eur || ''),
    Category: e.category,
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
