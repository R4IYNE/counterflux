import { parseCSV, resolveImportEntries } from '../services/csv-import.js';

/**
 * Render the CSV Import modal HTML.
 * Uses Alpine.js x-data for local state management.
 * @returns {string} HTML string
 */
export function renderCSVImportModal() {
  return `
    <div
      x-show="$store.collection.importOpen"
      x-cloak
      class="fixed inset-0 z-50 flex items-center justify-center"
      @keydown.escape.window="$store.collection.importOpen = false"
    >
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-background/80 backdrop-blur-sm" @click="$store.collection.importOpen = false"></div>

      <!-- Modal -->
      <div
        class="relative bg-surface border border-border-ghost w-full max-w-xl mx-md p-lg flex flex-col gap-md z-10"
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
              const result = await parseCSV(f);
              this.format = result.format;
              this.entries = result.entries;
              this.headers = result.headers || [];
              this.errors = result.errors || [];
              this.preview = result.entries.slice(0, 10);
              // Auto-set column mapping for generic
              if (this.format === 'generic' && this.headers.length) {
                this.columnMap.name = this.headers.find(h => /name/i.test(h)) || this.headers[0];
                this.columnMap.quantity = this.headers.find(h => /quantity|count|qty/i.test(h)) || '';
              }
            } catch (err) {
              Alpine.store('toast').show('Could not parse this CSV file. Check the format and try again. Supported formats: Deckbox, Moxfield, Archidekt, or generic CSV with Name and Quantity columns.', 'error');
              this.entries = [];
              this.format = null;
            }
          },

          async doImport() {
            this.importing = true;
            try {
              const resolved = await resolveImportEntries(this.entries);
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
      >
        <!-- Heading -->
        <h2 class="text-[20px] font-bold text-text-primary tracking-[0.01em]"
            style="font-family: 'Syne', sans-serif;">
          IMPORT COLLECTION
        </h2>

        <!-- File picker -->
        <label class="flex items-center gap-sm cursor-pointer px-md py-sm bg-surface-hover border border-border-ghost hover:bg-border-ghost transition-colors">
          <span class="material-symbols-outlined text-text-muted" style="font-size: 20px;">upload_file</span>
          <span class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-text-primary"
                style="font-family: 'JetBrains Mono', monospace;">
            SELECT CSV FILE
          </span>
          <input type="file" accept=".csv" class="hidden" @change="handleFile($event)">
        </label>

        <!-- Detected format -->
        <template x-if="format">
          <div class="flex items-center gap-sm">
            <span class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-text-muted"
                  style="font-family: 'JetBrains Mono', monospace;">
              DETECTED FORMAT:
            </span>
            <span class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-primary"
                  style="font-family: 'JetBrains Mono', monospace;"
                  x-text="format === 'generic' ? 'GENERIC CSV' : format.toUpperCase()">
            </span>
          </div>
        </template>

        <!-- Column mapping for generic format -->
        <template x-if="format === 'generic' && headers.length > 0">
          <div class="flex flex-col gap-sm p-md bg-surface-hover border border-border-ghost">
            <span class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-text-muted"
                  style="font-family: 'JetBrains Mono', monospace;">
              COLUMN MAPPING
            </span>
            <div class="flex gap-md">
              <div class="flex flex-col gap-xs">
                <label class="font-mono text-[11px] uppercase tracking-[0.15em] text-text-muted"
                       style="font-family: 'JetBrains Mono', monospace;">Name (required)</label>
                <select x-model="columnMap.name"
                        class="bg-background border border-border-ghost text-text-primary px-sm py-xs font-mono text-[11px]"
                        style="font-family: 'JetBrains Mono', monospace;">
                  <template x-for="h in headers" :key="h">
                    <option :value="h" x-text="h"></option>
                  </template>
                </select>
              </div>
              <div class="flex flex-col gap-xs">
                <label class="font-mono text-[11px] uppercase tracking-[0.15em] text-text-muted"
                       style="font-family: 'JetBrains Mono', monospace;">Quantity (required)</label>
                <select x-model="columnMap.quantity"
                        class="bg-background border border-border-ghost text-text-primary px-sm py-xs font-mono text-[11px]"
                        style="font-family: 'JetBrains Mono', monospace;">
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
          <div class="flex flex-col gap-sm">
            <span class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-text-muted"
                  style="font-family: 'JetBrains Mono', monospace;">
              IMPORT PREVIEW
            </span>
            <div class="overflow-x-auto max-h-48 overflow-y-auto border border-border-ghost">
              <table class="w-full text-left">
                <thead>
                  <tr class="border-b border-border-ghost">
                    <th class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-text-muted px-sm py-xs"
                        style="font-family: 'JetBrains Mono', monospace;">Name</th>
                    <th class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-text-muted px-sm py-xs"
                        style="font-family: 'JetBrains Mono', monospace;">Qty</th>
                    <th class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-text-muted px-sm py-xs"
                        style="font-family: 'JetBrains Mono', monospace;">Foil</th>
                  </tr>
                </thead>
                <tbody>
                  <template x-for="(row, i) in preview" :key="i">
                    <tr class="border-b border-border-ghost/50">
                      <td class="font-mono text-[11px] text-text-primary px-sm py-xs"
                          style="font-family: 'JetBrains Mono', monospace;"
                          x-text="row.name || '—'"></td>
                      <td class="font-mono text-[11px] text-text-primary px-sm py-xs"
                          style="font-family: 'JetBrains Mono', monospace;"
                          x-text="row.quantity"></td>
                      <td class="font-mono text-[11px] text-text-primary px-sm py-xs"
                          style="font-family: 'JetBrains Mono', monospace;"
                          x-text="row.foil ? 'FOIL' : ''"></td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
            <span class="font-mono text-[11px] text-text-muted" style="font-family: 'JetBrains Mono', monospace;"
                  x-text="entries.length + ' total rows'"></span>
          </div>
        </template>

        <!-- Import result -->
        <template x-if="imported">
          <div class="p-md bg-surface-hover border border-border-ghost">
            <span class="font-mono text-[11px] text-success" style="font-family: 'JetBrains Mono', monospace;"
                  x-text="importCount + ' cards imported.'"></span>
            <template x-if="unresolvedCount > 0">
              <span class="font-mono text-[11px] text-warning ml-sm" style="font-family: 'JetBrains Mono', monospace;"
                    x-text="unresolvedCount + ' unresolved.'"></span>
            </template>
          </div>
        </template>

        <!-- Actions -->
        <div class="flex justify-end gap-sm mt-sm">
          <button
            @click="close()"
            class="px-md py-sm font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-text-muted bg-surface-hover border border-border-ghost cursor-pointer hover:text-text-primary transition-colors"
            style="font-family: 'JetBrains Mono', monospace;">
            CLOSE IMPORT
          </button>
          <button
            x-show="entries.length > 0 && !imported"
            :disabled="importing"
            @click="doImport()"
            class="px-md py-sm font-mono text-[11px] uppercase tracking-[0.15em] font-bold bg-primary text-text-primary cursor-pointer hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style="font-family: 'JetBrains Mono', monospace;"
            x-text="importing ? 'IMPORTING...' : ('IMPORT ' + entries.length + ' CARDS')">
          </button>
        </div>
      </div>
    </div>
  `;
}
