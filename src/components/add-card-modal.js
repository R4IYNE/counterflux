import { searchCards } from '../db/search.js';
import { getCardThumbnail, getCardImage, getCardName } from '../db/card-accessor.js';

/**
 * Render the Add Card modal HTML.
 * Uses Alpine x-data for local state and x-show bound to $store.collection.addCardOpen.
 * @returns {string} HTML string
 */
export function renderAddCardModal() {
  // Expose searchCards on window so Alpine x-data templates can access it
  // (dynamic import() inside x-data strings has no module context)
  window.__cf_searchCards = searchCards;

  return `
    <div
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
          $store.collection.addCardOpen = false;
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
          $store.collection.addCardOpen = false;
        }
      }"
      x-show="$store.collection.addCardOpen"
      x-cloak
      style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 9999; display: flex; align-items: center; justify-content: center;"
      @keydown.escape.window="$store.collection.addCardOpen && close()"
    >
      <!-- Glass backdrop -->
      <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6);" @click="close()"></div>

      <!-- Modal panel -->
      <div style="position: relative; z-index: 10; width: 100%; max-width: 480px; background: #14161C; border: 1px solid #2A2D3A; padding: 24px; display: flex; flex-direction: column; gap: 16px;"
           @click.stop>
        <!-- Heading -->
        <h2 style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; line-height: 1.2; letter-spacing: 0.01em; color: #EAECEE; margin: 0;">
          ADD TO COLLECTION
        </h2>

        <!-- Search input -->
        <div style="position: relative;">
          <input
            type="text"
            :value="searchQuery"
            @input="doSearch($event.target.value)"
            placeholder="SEARCH CARD NAME..."
            style="width: 100%; box-sizing: border-box; background: #0B0C10; border: 1px solid #2A2D3A; color: #EAECEE; padding: 8px 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; outline: none;"
            onfocus="this.style.borderColor='#0D52BD'"
            onblur="this.style.borderColor='#2A2D3A'"
            autocomplete="off"
          >

          <!-- Search results dropdown -->
          <div x-show="searchResults.length > 0"
               style="position: absolute; top: 100%; left: 0; right: 0; margin-top: 4px; background: #14161C; border: 1px solid #2A2D3A; max-height: 280px; overflow-y: auto; z-index: 10;">
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
              style="width: 64px; height: auto; object-fit: contain; flex-shrink: 0;"
              loading="lazy"
              onerror="this.style.display='none'"
            >
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <span style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 700; color: #EAECEE;" x-text="selectedCard.name"></span>
              <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #0D52BD;"
                    x-text="getPrice()"></span>
            </div>
          </div>
        </template>

        <!-- Quantity -->
        <div style="display: flex; align-items: center; gap: 8px;">
          <label style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #7A8498;">
            QTY
          </label>
          <input
            type="number"
            x-model.number="quantity"
            min="1"
            max="999"
            style="width: 80px; background: #0B0C10; border: 1px solid #2A2D3A; color: #EAECEE; padding: 4px 8px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-align: center; outline: none;"
          >
        </div>

        <!-- Foil toggle -->
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <input type="checkbox" x-model="foil" class="accent-primary" style="width: 16px; height: 16px;">
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #7A8498;">
            FOIL
          </span>
        </label>

        <!-- Category radio -->
        <div style="display: flex; align-items: center; gap: 16px;">
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #7A8498;">
            CATEGORY
          </span>
          <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
            <input type="radio" value="owned" x-model="category" class="accent-primary">
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #EAECEE;">OWNED</span>
          </label>
          <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
            <input type="radio" value="wishlist" x-model="category" class="accent-primary">
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #EAECEE;">WISHLIST</span>
          </label>
        </div>

        <!-- Action buttons -->
        <div style="display: flex; gap: 8px; padding-top: 8px;">
          <button
            @click="addToCollection()"
            :disabled="!selectedCard"
            :style="selectedCard ? 'background: #0D52BD; color: #EAECEE; cursor: pointer;' : 'background: #1C1F28; color: #4A5064; cursor: not-allowed; opacity: 0.5;'"
            style="flex: 1; padding: 8px 16px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; border: none;">
            ADD CARD
          </button>
          <button
            @click="close()"
            style="flex: 1; padding: 8px 16px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; background: #1C1F28; color: #EAECEE; border: 1px solid #2A2D3A; cursor: pointer;">
            CLOSE PANEL
          </button>
        </div>
      </div>
    </div>
  `;
}
