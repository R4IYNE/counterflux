import { searchCards } from '../db/search.js';
import { getCardThumbnail, getCardImage, getCardName } from '../db/card-accessor.js';

/**
 * Render the Add Card modal HTML.
 * Uses Alpine x-data for local state and x-show bound to $store.collection.addCardOpen.
 * @returns {string} HTML string
 */
export function renderAddCardModal() {
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

        async doSearch(q) {
          this.searchQuery = q;
          if (!q || q.length < 2) {
            this.searchResults = [];
            this.searching = false;
            return;
          }
          this.searching = true;
          clearTimeout(this._debounce);
          this._debounce = setTimeout(async () => {
            try {
              const cards = await (await import('../db/search.js')).searchCards(q, 8);
              this.searchResults = cards.map(c => ({
                ...c,
                _thumb: null,
                _name: c.name,
              }));
            } catch(e) {
              this.searchResults = [];
            }
            this.searching = false;
          }, 150);
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
          return p ? 'EUR ' + p : 'N/A';
        },

        async addToCollection() {
          if (!this.selectedCard) return;
          await $store.collection.addCard(
            this.selectedCard.id,
            this.quantity,
            this.foil,
            this.category
          );
          $store.toast.success(this.selectedCard.name + ' added to collection.');
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
      class="fixed inset-0 z-50 flex items-center justify-center"
      @keydown.escape.window="$store.collection.addCardOpen && close()"
    >
      <!-- Glass backdrop -->
      <div class="absolute inset-0 bg-black/60" @click="close()"></div>

      <!-- Modal panel -->
      <div class="relative z-10 w-full max-w-md bg-surface border border-border-ghost p-lg flex flex-col gap-md"
           @click.stop>
        <!-- Heading -->
        <h2 class="font-header text-[20px] font-bold leading-[1.2] tracking-[0.01em] text-text-primary"
            style="font-family: 'Syne', sans-serif;">
          ADD TO COLLECTION
        </h2>

        <!-- Search input -->
        <div class="relative">
          <input
            type="text"
            :value="searchQuery"
            @input="doSearch($event.target.value)"
            placeholder="SEARCH CARD NAME..."
            class="w-full bg-background border border-border-ghost text-text-primary px-md py-sm font-mono text-[11px] uppercase tracking-[0.15em] outline-none focus:border-primary"
            style="font-family: 'JetBrains Mono', monospace;"
            autocomplete="off"
          >

          <!-- Search results dropdown -->
          <div x-show="searchResults.length > 0"
               class="absolute top-full left-0 right-0 mt-xs bg-surface border border-border-ghost max-h-[280px] overflow-y-auto z-10">
            <template x-for="(card, idx) in searchResults" :key="card.id">
              <button
                @click="selectCard(card)"
                class="w-full flex items-center gap-sm px-md py-sm text-left cursor-pointer hover:bg-surface-hover transition-colors"
              >
                <span class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-text-primary flex-1 truncate"
                      style="font-family: 'JetBrains Mono', monospace;"
                      x-text="card._name"></span>
                <i class="ss" :class="'ss-' + card.set" style="font-size: 14px; color: var(--color-text-dim);"></i>
              </button>
            </template>
          </div>
        </div>

        <!-- Selected card preview -->
        <template x-if="selectedCard">
          <div class="flex gap-md items-start">
            <img
              :src="selectedCard.image_uris?.small || ''"
              :alt="selectedCard.name"
              class="w-16 h-auto object-contain flex-shrink-0"
              loading="lazy"
              onerror="this.style.display='none'"
            >
            <div class="flex flex-col gap-xs">
              <span class="font-body text-[14px] font-bold text-text-primary" x-text="selectedCard.name"
                    style="font-family: 'Space Grotesk', sans-serif;"></span>
              <span class="font-mono text-[11px] uppercase tracking-[0.15em] font-normal text-primary"
                    style="font-family: 'JetBrains Mono', monospace;"
                    x-text="getPrice()"></span>
            </div>
          </div>
        </template>

        <!-- Quantity -->
        <div class="flex items-center gap-sm">
          <label class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-text-muted"
                 style="font-family: 'JetBrains Mono', monospace;">
            QTY
          </label>
          <input
            type="number"
            x-model.number="quantity"
            min="1"
            max="999"
            class="w-20 bg-background border border-border-ghost text-text-primary px-sm py-xs font-mono text-[11px] uppercase tracking-[0.15em] outline-none focus:border-primary text-center"
            style="font-family: 'JetBrains Mono', monospace;"
          >
        </div>

        <!-- Foil toggle -->
        <label class="flex items-center gap-sm cursor-pointer">
          <input type="checkbox" x-model="foil" class="accent-primary w-4 h-4">
          <span class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-text-muted"
                style="font-family: 'JetBrains Mono', monospace;">
            FOIL
          </span>
        </label>

        <!-- Category radio -->
        <div class="flex items-center gap-md">
          <span class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-text-muted"
                style="font-family: 'JetBrains Mono', monospace;">
            CATEGORY
          </span>
          <label class="flex items-center gap-xs cursor-pointer">
            <input type="radio" value="owned" x-model="category" class="accent-primary">
            <span class="font-mono text-[11px] uppercase tracking-[0.15em] text-text-primary"
                  style="font-family: 'JetBrains Mono', monospace;">OWNED</span>
          </label>
          <label class="flex items-center gap-xs cursor-pointer">
            <input type="radio" value="wishlist" x-model="category" class="accent-primary">
            <span class="font-mono text-[11px] uppercase tracking-[0.15em] text-text-primary"
                  style="font-family: 'JetBrains Mono', monospace;">WISHLIST</span>
          </label>
        </div>

        <!-- Action buttons -->
        <div class="flex gap-sm pt-sm">
          <button
            @click="addToCollection()"
            :disabled="!selectedCard"
            :class="selectedCard ? 'bg-primary text-text-primary cursor-pointer hover:bg-primary/80' : 'bg-surface-hover text-text-dim cursor-not-allowed opacity-50'"
            class="flex-1 px-md py-sm font-mono text-[11px] uppercase tracking-[0.15em] font-bold transition-colors"
            style="font-family: 'JetBrains Mono', monospace;">
            ADD CARD
          </button>
          <button
            @click="close()"
            class="flex-1 px-md py-sm font-mono text-[11px] uppercase tracking-[0.15em] font-bold bg-surface-hover text-text-primary cursor-pointer hover:bg-border-ghost transition-colors"
            style="font-family: 'JetBrains Mono', monospace;">
            CLOSE PANEL
          </button>
        </div>
      </div>
    </div>
  `;
}
