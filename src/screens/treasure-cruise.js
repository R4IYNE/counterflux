import { renderEmptyState } from '../components/empty-state.js';
import { renderAddCardModal } from '../components/add-card-modal.js';
import { renderMassEntryPanel } from '../components/mass-entry-panel.js';
import { renderEditInline } from '../components/edit-card-inline.js';
import { renderDeleteConfirm } from '../components/delete-confirm.js';
import { renderCSVImportModal } from '../components/csv-import-modal.js';
import { renderAnalyticsPanel, analyticsPanel } from '../components/analytics-panel.js';
import { initContextMenu } from '../components/context-menu.js';
import { exportCollection } from '../services/csv-export.js';

/**
 * Treasure Cruise -- Collection Manager.
 * Mounts the collection screen with gallery/table views,
 * filter bar, context menu, and modal overlays.
 */
export function mount(container) {
  const Alpine = window.Alpine;
  const store = Alpine?.store('collection');

  // Initialize collection store if not loaded yet
  if (store && typeof store.loadEntries === 'function') {
    store.loadEntries();
  }

  // Build screen HTML
  container.innerHTML = `
    <div x-data>
      <!-- Screen header -->
      <div class="flex items-center justify-between mb-lg">
        <div>
          <h1 class="font-header text-[20px] font-bold leading-[1.2] tracking-[0.01em] text-text-primary"
              style="font-family: 'Syne', sans-serif;">
            Archive Manifest
          </h1>
          <span class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-text-muted"
                style="font-family: 'JetBrains Mono', monospace;">
            MASTER REPOSITORY SUMMARY
          </span>
        </div>

        <!-- Action buttons -->
        <div class="flex gap-sm">
          <button
            @click="$store.collection.addCardOpen = true"
            class="px-md py-sm font-mono text-[11px] uppercase tracking-[0.15em] font-bold bg-primary text-text-primary cursor-pointer hover:bg-primary/80 transition-colors"
            style="font-family: 'JetBrains Mono', monospace;">
            ADD CARD
          </button>
          <button
            @click="$store.collection.massEntryOpen = true"
            class="px-md py-sm font-mono text-[11px] uppercase tracking-[0.15em] font-bold bg-surface-hover text-text-primary cursor-pointer hover:bg-border-ghost transition-colors"
            style="font-family: 'JetBrains Mono', monospace;">
            MASS ENTRY
          </button>
          <button
            @click="$store.collection.importOpen = true"
            class="px-md py-sm font-mono text-[11px] uppercase tracking-[0.15em] font-bold bg-surface-hover text-text-primary cursor-pointer hover:bg-border-ghost transition-colors"
            style="font-family: 'JetBrains Mono', monospace;">
            IMPORT CSV
          </button>
          <button
            @click="document.dispatchEvent(new CustomEvent('export-csv'))"
            class="px-md py-sm font-mono text-[11px] uppercase tracking-[0.15em] font-bold bg-surface-hover text-text-primary cursor-pointer hover:bg-border-ghost transition-colors"
            style="font-family: 'JetBrains Mono', monospace;">
            EXPORT CSV
          </button>
        </div>
      </div>

      <!-- Stats header -->
      <div class="flex gap-xl mb-lg p-md bg-surface-hover border-l-4 border-primary">
        <div class="flex flex-col">
          <span class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-text-muted"
                style="font-family: 'JetBrains Mono', monospace;">TOTAL CARDS</span>
          <span class="font-header text-[28px] font-bold text-primary"
                x-text="$store.collection.stats.totalCards"></span>
        </div>
        <div class="flex flex-col">
          <span class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-text-muted"
                style="font-family: 'JetBrains Mono', monospace;">UNIQUE CARDS</span>
          <span class="font-header text-[28px] font-bold text-text-primary"
                x-text="$store.collection.stats.uniqueCards"></span>
        </div>
        <div class="flex flex-col">
          <span class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-text-muted"
                style="font-family: 'JetBrains Mono', monospace;">ESTIMATED VALUE</span>
          <span class="font-header text-[28px] font-bold text-primary"
                x-text="'EUR ' + $store.collection.stats.estimatedValue.toFixed(2)"></span>
        </div>
        <div class="flex flex-col">
          <span class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-text-muted"
                style="font-family: 'JetBrains Mono', monospace;">WISHLIST</span>
          <span class="font-header text-[28px] font-bold text-text-primary"
                x-text="$store.collection.stats.wishlistCount"></span>
        </div>
      </div>

      <!-- Analytics panel -->
      ${renderAnalyticsPanel()}

      <!-- Empty state -->
      <template x-if="$store.collection.entries.length === 0 && !$store.collection.loading">
        <div class="flex flex-col items-center justify-center py-3xl gap-md">
          <img src="/assets/assetsmila-izzet.png" alt="Mila" class="w-24 h-24 object-contain opacity-60">
          <h2 class="font-header text-[20px] font-bold text-text-primary" style="font-family: 'Syne', sans-serif;">
            No Treasures Catalogued
          </h2>
          <p class="text-[14px] leading-[1.5] text-text-muted max-w-md text-center"
             style="font-family: 'Space Grotesk', sans-serif;">
            Mila here! Your collection is empty. Add cards one at a time, paste a batch into the Mass Entry Terminal, or import a CSV from Deckbox, Moxfield, or Archidekt.
          </p>
        </div>
      </template>

      <!-- Collection grid (gallery view placeholder) -->
      <template x-if="$store.collection.entries.length > 0">
        <div>
          <!-- Card grid -->
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-lg">
            <template x-for="entry in $store.collection.sorted" :key="entry.id">
              <div
                class="bg-surface border border-border-ghost cursor-pointer card-tile-hover relative"
                @click="$store.search.selectResult(entry.card)"
                @contextmenu.prevent="document.dispatchEvent(new CustomEvent('collection-context-menu', { detail: { entry, x: $event.clientX, y: $event.clientY } }))"
              >
                <!-- Card image -->
                <div class="relative overflow-hidden" style="aspect-ratio: 63/88;">
                  <img
                    :src="entry.card?.image_uris?.normal || entry.card?.image_uris?.small || ''"
                    :alt="entry.card?.name || ''"
                    class="w-full h-full object-cover opacity-80 transition-all duration-500"
                    loading="lazy"
                    onerror="this.style.display='none'"
                  >
                  <!-- Qty badge -->
                  <template x-if="entry.quantity > 1">
                    <span class="qty-badge" x-text="'x' + entry.quantity"></span>
                  </template>
                  <!-- Foil badge -->
                  <template x-if="entry.foil">
                    <span class="foil-badge absolute bottom-sm left-sm">FOIL</span>
                  </template>
                </div>
                <!-- Card info -->
                <div class="p-sm flex flex-col gap-xs">
                  <span class="text-[14px] font-bold text-text-primary truncate"
                        style="font-family: 'Space Grotesk', sans-serif;"
                        x-text="entry.card?.name || 'Unknown'"></span>
                  <span class="font-mono text-[11px] uppercase tracking-[0.15em] font-normal text-primary"
                        style="font-family: 'JetBrains Mono', monospace;"
                        x-text="'EUR ' + (entry.foil ? (entry.card?.prices?.eur_foil || '0.00') : (entry.card?.prices?.eur || '0.00'))"></span>
                  <span class="font-mono text-[11px] uppercase tracking-[0.15em] font-normal text-text-dim"
                        style="font-family: 'JetBrains Mono', monospace;"
                        x-text="entry.card?.set_name || entry.card?.set?.toUpperCase() || ''"></span>
                </div>
              </div>
            </template>
          </div>
        </div>
      </template>
    </div>

    <!-- Modals (rendered outside main flow for z-index) -->
    ${renderAddCardModal()}
    ${renderMassEntryPanel()}
    ${renderCSVImportModal()}
    ${renderEditInline()}
    ${renderDeleteConfirm()}
  `;

  // Register Alpine component for analytics panel
  if (Alpine && typeof Alpine.data === 'function') {
    Alpine.data('analyticsPanel', analyticsPanel);
  }

  // Initialize context menu (imperative, attaches to DOM)
  initContextMenu(container);

  // Wire export-csv event
  const handleExportCSV = () => {
    const entries = Alpine.store('collection')?.entries || [];
    exportCollection(entries);
    const count = entries.reduce((sum, e) => sum + e.quantity, 0);
    Alpine.store('toast')?.show(`Collection exported as CSV (${count} cards).`, 'success');
  };
  document.addEventListener('export-csv', handleExportCSV);

  // Cleanup on unmount (Navigo calls mount again on re-navigation)
  container._cleanupExportCSV = () => document.removeEventListener('export-csv', handleExportCSV);
}
