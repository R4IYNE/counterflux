import { searchCards } from '../db/search.js';
import { getCardThumbnail, getCardImage, getCardName } from '../db/card-accessor.js';

/**
 * Render the Add Card LHS panel HTML.
 *
 * Phase 8 Plan 2: renamed from `renderAddCardModal`. The Alpine x-data state
 * machine (searchQuery, searchResults, selectedCard, quantity, foil, category,
 * searching, _debounce, _searchId, doSearch, selectCard, getPrice,
 * addToCollection, reset, close) is PRESERVED verbatim. Only the outer chrome
 * changes: the backdrop + fixed-center modal wrapper is replaced with a
 * 360px LHS column (<aside class="tc-panel-column">).
 *
 * D-01: addToCollection() does NOT close the panel (rapid multi-card entry).
 * D-02: Width is 360px fixed.
 * D-03 / Pitfall 6: panelOpen default state is owned by the collection store
 *   (localStorage tc_panel_open; null → true).
 * D-27: Panel header contains ADD TO COLLECTION title + chevron close +
 *   action row with BROWSE PRECONS (disabled placeholder — Plan 3 wires it)
 *   and MASS ENTRY shortcut.
 * D-28: Chevron close fires togglePanel(), which persists tc_panel_open=false.
 *
 * @returns {string} HTML string
 */
export function renderAddCardPanel() {
  // Expose searchCards on window so Alpine x-data templates can access it
  // (dynamic import() inside x-data strings has no module context)
  window.__cf_searchCards = searchCards;

  return `
    <aside
      x-data="{
        searchQuery: '',
        searchResults: [],
        selectedCard: null,
        quantity: 1,
        foil: false,
        category: 'owned',
        searching: false,
        _debounce: null,
        _searchId: 0,

        async doSearch(q) {
          this.searchQuery = q;
          if (!q || q.length < 2) {
            this.searchResults = [];
            this.searching = false;
            return;
          }
          this.searching = true;
          clearTimeout(this._debounce);
          const thisSearchId = ++this._searchId;
          this._debounce = setTimeout(async () => {
            try {
              const cards = await window.__cf_searchCards(q, 8);
              if (thisSearchId !== this._searchId) return;
              this.searchResults = cards.map(c => ({
                ...c,
                _thumb: null,
                _name: c.name,
              }));
            } catch(e) {
              if (thisSearchId === this._searchId) {
                this.searchResults = [];
              }
            }
            this.searching = false;
          }, 50);
        },

        selectCard(card) {
          this.selectedCard = card;
          this.searchResults = [];
          this.searchQuery = '';
          // Phase 8 Plan 2: fire printings load for the newly-selected card
          if (card && typeof $store.collection.loadPrintings === 'function') {
            $store.collection.loadPrintings(card);
          }
        },

        getPrice() {
          if (!this.selectedCard) return 'N/A';
          const p = this.foil
            ? this.selectedCard.prices?.eur_foil
            : this.selectedCard.prices?.eur;
          if (!p) return 'N/A';
          return window.__cf_eurToGbp ? window.__cf_eurToGbp(p) : p;
        },

        async addToCollection() {
          if (!this.selectedCard) return;
          await $store.collection.addCard(
            this.selectedCard.id,
            this.quantity,
            this.foil,
            this.category
          );
          // POLISH-11: wishlist path uses 'Added to wishlist' wording
          const target = this.category === 'wishlist' ? 'wishlist' : 'collection';
          $store.toast.success(this.selectedCard.name + ' added to ' + target + '.');
          this.reset();
          // D-01: panel stays open. Refocus the search input for rapid entry.
          this.\$nextTick(() => {
            const input = this.\$el.querySelector('input[type=\\'text\\']');
            if (input) input.focus();
          });
        },

        reset() {
          this.searchQuery = '';
          this.searchResults = [];
          this.selectedCard = null;
          this.quantity = 1;
          this.foil = false;
          this.category = 'owned';
        },

        close() {
          this.reset();
          \$store.collection.togglePanel();
        },

        onPrintingSelected(detail) {
          if (!this.selectedCard || this.selectedCard.id !== detail.cardId) return;
          const p = detail.printing;
          // In-place mutation — Alpine reactivity re-renders the preview.
          this.selectedCard = {
            ...this.selectedCard,
            image_uris: p.image_uris,
            set: p.set,
            collector_number: p.collector_number,
            prices: p.prices,
          };
        }
      }"
      x-show="$store.collection.panelOpen"
      x-init="window.addEventListener('cf:printing-selected', (e) => onPrintingSelected(e.detail))"
      x-cloak
      class="tc-panel-column"
      style="width: 360px; flex-shrink: 0; background: var(--color-surface); border-right: 1px solid var(--color-border-ghost); padding: 24px; overflow-y: auto; height: 100%; display: flex; flex-direction: column; gap: 16px; transition: transform 200ms ease-out;"
    >
      <!-- Header row: title + chevron close -->
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <h2 style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; line-height: 1.2; letter-spacing: 0.01em; color: var(--color-text-primary); margin: 0; text-transform: uppercase;">
          ADD TO COLLECTION
        </h2>
        <button
          @click="$store.collection.togglePanel()"
          aria-label="Collapse add panel"
          title="Collapse panel"
          style="width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; background: transparent; border: none; cursor: pointer; color: var(--color-text-muted); transition: all 120ms ease-out;"
          onmouseenter="this.style.color='var(--color-secondary)'; this.style.boxShadow='0 0 8px var(--color-glow-red)'"
          onmouseleave="this.style.color='var(--color-text-muted)'; this.style.boxShadow='none'"
        >
          <span class="material-symbols-outlined" style="font-size: 20px;">chevron_left</span>
        </button>
      </div>

      <!-- Action row: BROWSE PRECONS (disabled placeholder — Plan 3 wires it) + MASS ENTRY -->
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button
          disabled
          title="Available in Plan 3"
          style="flex: 1; min-width: 120px; padding: 8px 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; color: var(--color-text-dim); background: var(--color-surface-hover); border: 1px solid var(--color-border-ghost); cursor: not-allowed; text-transform: uppercase;"
        >BROWSE PRECONS</button>
        <button
          @click="$store.collection.massEntryOpen = true"
          style="flex: 1; min-width: 120px; padding: 8px 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; color: var(--color-text-primary); background: var(--color-surface-hover); border: 1px solid var(--color-border-ghost); cursor: pointer; text-transform: uppercase;"
          onmouseenter="this.style.background='var(--color-background)'"
          onmouseleave="this.style.background='var(--color-surface-hover)'"
        >MASS ENTRY</button>
      </div>

      <!-- Empty state (idle — no query, no selected card) -->
      <template x-if="!searchQuery && !selectedCard">
        <div style="display: flex; flex-direction: column; gap: 4px; padding: 8px 0;">
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; color: var(--color-text-muted); text-transform: uppercase;">
            READY TO ARCHIVE
          </span>
          <span style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 400; line-height: 1.5; color: var(--color-text-muted);">
            Search for a card, or browse a precon to add one hundred at once.
          </span>
        </div>
      </template>

      <!-- Search input -->
      <div style="position: relative;">
        <input
          type="text"
          :value="searchQuery"
          @input="doSearch($event.target.value)"
          placeholder="SEARCH CARD NAME..."
          style="width: 100%; box-sizing: border-box; background: var(--color-background); border: 1px solid var(--color-border-ghost); color: var(--color-text-primary); padding: 8px 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; outline: none;"
          onfocus="this.style.borderColor='var(--color-primary)'"
          onblur="this.style.borderColor='var(--color-border-ghost)'"
          autocomplete="off"
        >

        <!-- Search results dropdown -->
        <div x-show="searchResults.length > 0"
             style="position: absolute; top: 100%; left: 0; right: 0; margin-top: 4px; background: var(--color-surface); border: 1px solid var(--color-border-ghost); max-height: 280px; overflow-y: auto; z-index: 10;">
          <template x-for="(card, idx) in searchResults" :key="card.id">
            <button
              @click="selectCard(card)"
              class="cf-dropdown-row"
              style="width: 100%; display: flex; align-items: center; gap: 16px; padding: 8px 12px; min-height: 56px; text-align: left; cursor: pointer; background: transparent; border: none; color: var(--color-text-primary);"
              onmouseenter="this.style.background='var(--color-surface-hover)'"
              onmouseleave="this.style.background='transparent'"
            >
              <img
                :src="card.image_uris?.small || ''"
                :alt="card.name"
                class="cf-card-img"
                style="height: 40px; width: auto; flex-shrink: 0;"
                loading="lazy"
                onerror="this.style.display='none'"
              >
              <span style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 700; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                    x-text="card.name"></span>
              <i class="ss" :class="'ss-' + card.set"
                 style="font-size: 14px; color: var(--color-text-dim);"></i>
            </button>
          </template>
        </div>
      </div>

      <!-- Selected card preview -->
      <template x-if="selectedCard">
        <div style="display: flex; gap: 16px; align-items: flex-start;">
          <img
            :src="selectedCard.image_uris?.small || ''"
            :alt="selectedCard.name"
            class="cf-card-img"
            style="width: 96px; height: auto; object-fit: contain; flex-shrink: 0;"
            loading="lazy"
            onerror="this.style.display='none'"
          >
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <span style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 700; color: var(--color-text-primary);" x-text="selectedCard.name"></span>
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: var(--color-primary);"
                  x-text="getPrice()"></span>
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: var(--color-text-muted);"
                  x-text="(selectedCard.set || '').toUpperCase() + ' · ' + (selectedCard.collector_number || '')"></span>
          </div>
        </div>
      </template>

      <!-- Printing strip (Plan 2 Task 5 — D-13..D-18) -->
      <template x-if="selectedCard">
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; color: var(--color-text-muted); text-transform: uppercase;">
            PRINTINGS
          </label>
          <!-- Loading skeleton while printings fetch -->
          <template x-if="$store.collection.printingsByCardId[selectedCard.id]?.loading">
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <template x-for="i in 6" :key="i">
                <div class="animate-pulse" style="width: 32px; height: 32px; background: var(--color-surface-hover); border: 1px solid var(--color-border-ghost);"></div>
              </template>
            </div>
          </template>
          <!-- Resolved strip -->
          <template x-if="!$store.collection.printingsByCardId[selectedCard.id]?.loading">
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <template x-for="p in ($store.collection.printingsByCardId[selectedCard.id]?.printings || [])" :key="p.id">
                <button
                  @click="$store.collection.selectPrinting(selectedCard.id, p.id)"
                  :title="p.set_name + ' (' + (p.released_at ? p.released_at.slice(0,4) : '') + ') · ' + (window.__cf_eurToGbp ? window.__cf_eurToGbp(p.prices?.eur) : '--')"
                  :aria-label="p.set_name + ' printing, ' + (p.released_at ? p.released_at.slice(0,4) : '')"
                  :aria-pressed="$store.collection.activePrintingIdByCard[selectedCard.id] === p.id"
                  :style="$store.collection.activePrintingIdByCard[selectedCard.id] === p.id
                    ? 'width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; background: var(--color-primary); color: var(--color-text-primary); border: 1px solid var(--color-primary); cursor: pointer; box-shadow: 0 0 12px var(--color-glow-blue); transition: all 150ms ease-out;'
                    : 'width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; background: var(--color-background); color: var(--color-text-dim); border: 1px solid var(--color-border-ghost); cursor: pointer; transition: all 150ms ease-out;'"
                >
                  <i class="ss" :class="'ss-' + p.set" style="font-size: 16px;"></i>
                </button>
              </template>
            </div>
          </template>
        </div>
      </template>

      <!-- Quantity -->
      <div style="display: flex; align-items: center; gap: 8px;">
        <label style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: var(--color-text-muted);">
          QTY
        </label>
        <input
          type="number"
          x-model.number="quantity"
          min="1"
          max="999"
          style="width: 80px; background: var(--color-background); border: 1px solid var(--color-border-ghost); color: var(--color-text-primary); padding: 4px 8px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-align: center; outline: none;"
        >
      </div>

      <!-- Foil toggle -->
      <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
        <input type="checkbox" x-model="foil" class="accent-primary" style="width: 16px; height: 16px;">
        <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: var(--color-text-muted);">
          FOIL
        </span>
      </label>

      <!-- Category radio -->
      <div style="display: flex; align-items: center; gap: 16px;">
        <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: var(--color-text-muted);">
          CATEGORY
        </span>
        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
          <input type="radio" value="owned" x-model="category" class="accent-primary">
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: var(--color-text-primary);">OWNED</span>
        </label>
        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
          <input type="radio" value="wishlist" x-model="category" class="accent-primary">
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: var(--color-text-primary);">WISHLIST</span>
        </label>
      </div>

      <!-- Action buttons -->
      <div style="display: flex; gap: 8px; padding-top: 8px;">
        <button
          @click="addToCollection()"
          :disabled="!selectedCard"
          :style="selectedCard ? 'background: var(--color-primary); color: var(--color-text-primary); cursor: pointer;' : 'background: var(--color-surface-hover); color: var(--color-text-dim); cursor: not-allowed; opacity: 0.5;'"
          style="flex: 1; padding: 8px 16px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; border: none;">
          ADD CARD
        </button>
        <button
          @click="$store.collection.togglePanel()"
          style="flex: 1; padding: 8px 16px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; background: var(--color-surface-hover); color: var(--color-text-primary); border: 1px solid var(--color-border-ghost); cursor: pointer;">
          CLOSE PANEL
        </button>
      </div>
    </aside>
  `;
}
