import { parseCSV, resolveImportEntries } from '../services/csv-import.js';

/**
 * Render the CSV Import modal HTML.
 * Uses Alpine.js x-data for local state management.
 * @returns {string} HTML string
 */
export function renderCSVImportModal() {
  // Expose functions on window so Alpine x-data templates can access them
  window.__cf_parseCSV = parseCSV;
  window.__cf_resolveImportEntries = resolveImportEntries;

  return `
    <div
      x-show="$store.collection.importOpen"
      x-cloak
      style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 9999; display: flex; align-items: center; justify-content: center;"
      @keydown.escape.window="$store.collection.importOpen && close()"
    >
      <!-- Backdrop -->
      <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6);" @click="$store.collection.importOpen = false"></div>

      <!-- Modal -->
      <div
        style="position: relative; z-index: 10; width: 100%; max-width: 580px; background: #14161C; border: 1px solid #2A2D3A; padding: 24px; display: flex; flex-direction: column; gap: 16px;"
        x-data="{
          file: null,
          format: null,
          entries: [],
          headers: [],
          preview: [],
          errors: [],
          importing: false,
          imported: false,
          importCount: 0,
          unresolvedCount: 0,
          columnMap: { name: '', quantity: '' },

          async handleFile(event) {
            const f = event.target.files?.[0];
            if (!f) return;
            this.file = f;
            this.imported = false;
            try {
              const result = await window.__cf_parseCSV(f);
              this.format = result.format;
              this.entries = result.entries;
              this.headers = result.headers || [];
              this.errors = result.errors || [];
              this.preview = result.entries.slice(0, 10);
              if (this.format === 'generic' && this.headers.length) {
                this.columnMap.name = this.headers.find(h => /name/i.test(h)) || this.headers[0];
                this.columnMap.quantity = this.headers.find(h => /quantity|count|qty/i.test(h)) || '';
              }
            } catch (err) {
              Alpine.store('toast').show('Could not parse this CSV file.', 'error');
              this.entries = [];
              this.format = null;
            }
          },

          async doImport() {
            this.importing = true;
            try {
              const resolved = await window.__cf_resolveImportEntries(this.entries);
              const toImport = resolved.filter(e => e.resolved && e.card);
              const unresolved = resolved.filter(e => !e.resolved);

              const store = Alpine.store('collection');
              for (const entry of toImport) {
                await store.addCard(
                  entry.card.id,
                  entry.quantity || 1,
                  entry.foil || false,
                  'owned'
                );
              }

              this.importCount = toImport.length;
              this.unresolvedCount = unresolved.length;
              this.imported = true;

              const formatLabel = (this.format || 'CSV').toUpperCase();
              Alpine.store('toast').show(this.importCount + ' cards imported from ' + formatLabel + '.', 'success');

              if (this.unresolvedCount > 0) {
                Alpine.store('toast').show(this.unresolvedCount + ' cards could not be resolved.', 'warning');
              }
            } catch (err) {
              Alpine.store('toast').show('Import failed. ' + (err.message || ''), 'error');
            } finally {
              this.importing = false;
            }
          },

          close() {
            $store.collection.importOpen = false;
            this.file = null;
            this.format = null;
            this.entries = [];
            this.headers = [];
            this.preview = [];
            this.errors = [];
            this.imported = false;
            this.importCount = 0;
            this.unresolvedCount = 0;
          }
        }"
        @click.stop
      >
        <!-- Heading -->
        <h2 style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; line-height: 1.2; letter-spacing: 0.01em; color: #EAECEE; margin: 0;">
          IMPORT COLLECTION
        </h2>

        <!-- File picker -->
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px 16px; background: #1C1F28; border: 1px solid #2A2D3A;">
          <span class="material-symbols-outlined" style="font-size: 20px; color: #7A8498;">upload_file</span>
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #EAECEE;">
            SELECT CSV FILE
          </span>
          <input type="file" accept=".csv" style="display: none;" @change="handleFile($event)">
        </label>

        <!-- Detected format -->
        <template x-if="format">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #7A8498;">
              DETECTED FORMAT:
            </span>
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #0D52BD;"
                  x-text="format === 'generic' ? 'GENERIC CSV' : format.toUpperCase()">
            </span>
          </div>
        </template>

        <!-- Column mapping for generic format -->
        <template x-if="format === 'generic' && headers.length > 0">
          <div style="display: flex; flex-direction: column; gap: 8px; padding: 16px; background: #1C1F28; border: 1px solid #2A2D3A;">
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #7A8498;">
              COLUMN MAPPING
            </span>
            <div style="display: flex; gap: 16px;">
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <label style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #7A8498;">Name (required)</label>
                <select x-model="columnMap.name"
                        style="background: #0B0C10; border: 1px solid #2A2D3A; color: #EAECEE; padding: 4px 8px; font-family: 'JetBrains Mono', monospace; font-size: 11px;">
                  <template x-for="h in headers" :key="h">
                    <option :value="h" x-text="h"></option>
                  </template>
                </select>
              </div>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <label style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #7A8498;">Quantity (required)</label>
                <select x-model="columnMap.quantity"
                        style="background: #0B0C10; border: 1px solid #2A2D3A; color: #EAECEE; padding: 4px 8px; font-family: 'JetBrains Mono', monospace; font-size: 11px;">
                  <template x-for="h in headers" :key="h">
                    <option :value="h" x-text="h"></option>
                  </template>
                </select>
              </div>
            </div>
          </div>
        </template>

        <!-- Preview table -->
        <template x-if="preview.length > 0">
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #7A8498;">
              IMPORT PREVIEW
            </span>
            <div style="overflow-x: auto; max-height: 192px; overflow-y: auto; border: 1px solid #2A2D3A;">
              <table style="width: 100%; text-align: left; border-collapse: collapse;">
                <thead>
                  <tr style="border-bottom: 1px solid #2A2D3A;">
                    <th style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #7A8498; padding: 4px 8px;">Name</th>
                    <th style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #7A8498; padding: 4px 8px;">Qty</th>
                    <th style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #7A8498; padding: 4px 8px;">Foil</th>
                  </tr>
                </thead>
                <tbody>
                  <template x-for="(row, i) in preview" :key="i">
                    <tr style="border-bottom: 1px solid rgba(42,45,58,0.5);">
                      <td style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #EAECEE; padding: 4px 8px;"
                          x-text="row.name || '—'"></td>
                      <td style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #EAECEE; padding: 4px 8px;"
                          x-text="row.quantity"></td>
                      <td style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #EAECEE; padding: 4px 8px;"
                          x-text="row.foil ? 'FOIL' : ''"></td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #7A8498;"
                  x-text="entries.length + ' total rows'"></span>
          </div>
        </template>

        <!-- Import result -->
        <template x-if="imported">
          <div style="padding: 16px; background: #1C1F28; border: 1px solid #2A2D3A;">
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #2ECC71;"
                  x-text="importCount + ' cards imported.'"></span>
            <template x-if="unresolvedCount > 0">
              <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #F39C12; margin-left: 8px;"
                    x-text="unresolvedCount + ' unresolved.'"></span>
            </template>
          </div>
        </template>

        <!-- Actions -->
        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
          <button
            @click="close()"
            style="padding: 8px 16px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #7A8498; background: #1C1F28; border: 1px solid #2A2D3A; cursor: pointer;">
            CLOSE IMPORT
          </button>
          <button
            x-show="entries.length > 0 && !imported"
            :disabled="importing"
            @click="doImport()"
            :style="importing ? 'opacity: 0.5; cursor: not-allowed;' : 'cursor: pointer;'"
            style="padding: 8px 16px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; background: #0D52BD; color: #EAECEE; border: none;"
            x-text="importing ? 'IMPORTING...' : ('IMPORT ' + entries.length + ' CARDS')">
          </button>
        </div>
      </div>
    </div>
  `;
}
