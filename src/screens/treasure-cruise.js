import { renderEmptyState } from '../components/empty-state.js';
import { renderStatsHeader } from '../components/stats-header.js';
import { renderFilterBar } from '../components/filter-bar.js';
import { renderGalleryView } from '../components/gallery-view.js';
import { renderTableView } from '../components/table-view.js';
import { renderSetCompletionView } from '../components/set-completion.js';
import { renderAddCardPanel } from '../components/add-card-panel.js';
import { renderMassEntryPanel } from '../components/mass-entry-panel.js';
import { renderCSVImportModal } from '../components/csv-import-modal.js';
import { renderPreconBrowser } from '../components/precon-browser.js';
import { renderEditInline } from '../components/edit-card-inline.js';
import { renderDeleteConfirm } from '../components/delete-confirm.js';
import { renderAnalyticsPanel, analyticsPanel } from '../components/analytics-panel.js';
import { initContextMenu } from '../components/context-menu.js';
import { exportCollection } from '../services/csv-export.js';

/**
 * Treasure Cruise -- Collection Manager.
 * Mounts the collection screen with gallery/table/sets views,
 * filter bar, context menu, and modal overlays.
 */
export function mount(container) {
  const Alpine = window.Alpine;
  const store = Alpine?.store('collection');

  // Initialize collection store if not loaded yet
  if (store && typeof store.loadEntries === 'function') {
    store.loadEntries();
  }

  // Build screen HTML — Phase 8 Plan 2: LHS panel pushes the grid
  // (flex row: [<aside tc-panel-column 360px> | <section tc-grid-column flex:1>]).
  // The #tc-modals container continues to host the remaining modal surfaces
  // (mass-entry, csv-import, edit-inline, delete-confirm).
  container.innerHTML = `
    <div x-data class="treasure-cruise-screen" style="display: flex; flex-direction: row; height: 100%; width: 100%; position: relative;">

      <!-- LHS panel column (persistent add surface per COLLECT-06 / D-01, D-02) -->
      ${renderAddCardPanel()}

      <!-- Re-open affordance: visible only when the panel is closed (D-28 + FOLLOWUP-2).
           Replaces the original 32×32 ghost chevron — now 48px tall, primary accent,
           paired with OPEN PANEL label per Phase 08.1 follow-up #2.
           All visual styling lives in .cf-panel-reopen (main.css). -->
      <button
        x-show="!$store.collection.panelOpen"
        @click="$store.collection.togglePanel()"
        aria-label="Open add panel"
        title="Open add panel"
        class="cf-panel-reopen"
      >
        <span class="material-symbols-outlined">chevron_right</span>
        <span>OPEN PANEL</span>
      </button>

      <!-- Grid column: flex-1, reflows to fill remaining width after panel push -->
      <section class="tc-grid-column" style="flex: 1; min-width: 0; padding: 24px; overflow-y: auto; transition: margin-left 200ms ease-out;">
        <div class="flex flex-col gap-[24px]">

      <!-- Screen header -->
      <div>
        <h2 class="syne-header text-[20px] font-bold leading-[1.2] tracking-[0.01em]"
            style="color: #EAECEE;">Archive Manifest</h2>
        <span class="font-mono uppercase text-[11px] tracking-[0.15em] font-bold"
              style="color: #7A8498;">MASTER REPOSITORY SUMMARY</span>
      </div>

      <!-- Empty state (shown when no entries) -->
      <template x-if="$store.collection.entries.length === 0 && !$store.collection.loading">
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: 24px; text-align: center;">
          <img
            src="/assets/assetsmila-izzet.png"
            alt="Mila -- Izzet Familiar"
            style="width: 96px; height: 96px; object-fit: cover; filter: grayscale(1) opacity(0.5);"
          >
          <h2 class="syne-header" style="font-size: 20px; font-weight: 700; line-height: 1.2; letter-spacing: 0.01em; color: #EAECEE; margin: 0;">No Treasures Catalogued</h2>
          <p style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; line-height: 1.5; color: #7A8498; max-width: 28rem; width: 100%; margin: 0;">
            Mila here! Your collection is empty. Add cards one at a time, paste a batch into the Mass Entry Terminal, or import a CSV from Deckbox, Moxfield, or Archidekt.
          </p>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button
              @click="$store.collection.panelOpen = true"
              style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; cursor: pointer; padding: 8px 16px; background: #0D52BD; color: #EAECEE; border: none;">ADD CARD</button>
            <button
              @click="$store.collection.massEntryOpen = true"
              style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; cursor: pointer; padding: 8px 16px; background: #1C1F28; color: #EAECEE; border: 1px solid #2A2D3A;">MASS ENTRY</button>
            <button
              @click="$store.collection.importOpen = true"
              style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; cursor: pointer; padding: 8px 16px; background: #1C1F28; color: #EAECEE; border: 1px solid #2A2D3A;">IMPORT CSV</button>
          </div>
        </div>
      </template>

      <!-- Collection content (shown when entries exist) -->
      <template x-if="$store.collection.entries.length > 0">
        <div class="flex flex-col gap-[24px]">

          <!-- Stats header -->
          ${renderStatsHeader()}

          <!-- Analytics panel (toggleable) -->
          ${renderAnalyticsPanel()}

          <!-- View toggle + filter bar -->
          <div class="flex flex-col gap-0">

            <!-- View toggle tabs -->
            <div class="flex items-center gap-0 border-b border-[#2A2D3A]">
              <button
                @click="$store.collection.setViewMode('gallery')"
                :class="$store.collection.viewMode === 'gallery'
                  ? 'text-[#0D52BD] border-b-2 border-[#0D52BD]'
                  : 'text-[#7A8498] hover:text-[#EAECEE] border-b-2 border-transparent'"
                :style="$store.collection.viewMode === 'gallery' ? 'background: rgba(13,82,189,0.1);' : ''"
                class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold cursor-pointer px-[16px] py-[8px] bg-transparent"
                style="border-top: none; border-left: none; border-right: none;"
              >GALLERY</button>
              <button
                @click="$store.collection.setViewMode('table')"
                :class="$store.collection.viewMode === 'table'
                  ? 'text-[#0D52BD] border-b-2 border-[#0D52BD]'
                  : 'text-[#7A8498] hover:text-[#EAECEE] border-b-2 border-transparent'"
                :style="$store.collection.viewMode === 'table' ? 'background: rgba(13,82,189,0.1);' : ''"
                class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold cursor-pointer px-[16px] py-[8px] bg-transparent"
                style="border-top: none; border-left: none; border-right: none;"
              >TABLE</button>
              <button
                @click="$store.collection.setViewMode('sets')"
                :class="$store.collection.viewMode === 'sets'
                  ? 'text-[#0D52BD] border-b-2 border-[#0D52BD]'
                  : 'text-[#7A8498] hover:text-[#EAECEE] border-b-2 border-transparent'"
                :style="$store.collection.viewMode === 'sets' ? 'background: rgba(13,82,189,0.1);' : ''"
                class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold cursor-pointer px-[16px] py-[8px] bg-transparent"
                style="border-top: none; border-left: none; border-right: none;"
              >SETS</button>
            </div>

            <!-- Filter bar -->
            ${renderFilterBar()}

          </div>

          <!-- View content area -->
          <div class="min-h-[400px]">

            <!-- Gallery view -->
            <template x-if="$store.collection.viewMode === 'gallery'">
              ${renderGalleryView()}
            </template>

            <!-- Table view -->
            <template x-if="$store.collection.viewMode === 'table'">
              ${renderTableView()}
            </template>

            <!-- Sets view -->
            <template x-if="$store.collection.viewMode === 'sets'">
              ${renderSetCompletionView()}
            </template>

            <!-- No results message -->
            <template x-if="$store.collection.sorted.length === 0 && $store.collection.entries.length > 0 && $store.collection.viewMode !== 'sets'">
              <div class="flex flex-col items-center justify-center py-[64px] gap-[16px] text-center">
                <img
                  src="/assets/assetsmila-izzet.png"
                  alt="Mila -- Izzet Familiar"
                  class="w-16 h-16 object-cover"
                  style="filter: grayscale(1) opacity(0.5);"
                >
                <p class="font-mono uppercase text-[11px] tracking-[0.15em] font-bold"
                   style="color: #7A8498;">No cards match your filters</p>
              </div>
            </template>

          </div>

        </div>
      </template>

        </div>
      </section>

    </div>
  `;

  // Append modals to document.body so fixed positioning works correctly.
  // Remove previous modal container if it exists (e.g., from previous mount).
  // Phase 8 Plan 2: renderAddCardPanel no longer lives here — it's inline in
  // the LHS column above. The remaining surfaces (mass-entry, csv-import,
  // edit-inline, delete-confirm) stay modal per D-04.
  document.getElementById('tc-modals')?.remove();
  const modalContainer = document.createElement('div');
  modalContainer.id = 'tc-modals';
  modalContainer.innerHTML = `
    ${renderMassEntryPanel()}
    ${renderCSVImportModal()}
    ${renderEditInline()}
    ${renderDeleteConfirm()}
    ${renderPreconBrowser()}
  `;
  document.body.appendChild(modalContainer);

  // Initialize Alpine on the inline panel too (it's now part of the screen
  // container, not #tc-modals). Without this, the <aside x-data=...> doesn't
  // bind and the panel never renders.
  if (Alpine?.initTree) {
    Alpine.initTree(container);
  }

  // Initialize Alpine on the newly appended modal elements
  if (Alpine?.initTree) {
    Alpine.initTree(modalContainer);
  }

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

  // Cleanup on unmount
  const prevCleanup = container._cleanup;
  container._cleanup = () => {
    document.removeEventListener('export-csv', handleExportCSV);
    const modals = document.getElementById('tc-modals');
    if (modals) modals.remove();
    if (prevCleanup) prevCleanup();
  };
}
