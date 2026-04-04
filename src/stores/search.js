import Alpine from 'alpinejs';
import { searchCards } from '../db/search.js';
import {
  getCardImage,
  getCardManaCost,
  getCardThumbnail,
  getCardName,
  getCardOracleText,
  getCardTypeLine,
} from '../db/card-accessor.js';

export function initSearchStore() {
  Alpine.store('search', {
    query: '',
    results: [],
    selectedIndex: -1,
    selectedCard: null,
    flyoutOpen: false,
    loading: false,
    _debounceTimer: null,

    async search(query) {
      this.query = query;
      this.selectedIndex = -1;

      if (!query || query.length < 2) {
        this.results = [];
        this.loading = false;
        return;
      }

      this.loading = true;
      clearTimeout(this._debounceTimer);

      this._debounceTimer = setTimeout(async () => {
        try {
          const cards = await searchCards(query, 8);
          this.results = cards.map((card) => ({
            ...card,
            _thumbnail: getCardThumbnail(card),
            _manaCost: getCardManaCost(card),
            _name: getCardName(card),
          }));
        } catch (e) {
          console.error('[Counterflux] Search error:', e);
          this.results = [];
        }
        this.loading = false;
      }, 150);
    },

    selectResult(card) {
      this.selectedCard = {
        ...card,
        _image: getCardImage(card, 0, 'normal'),
        _manaCost: getCardManaCost(card),
        _name: getCardName(card),
        _oracleText: getCardOracleText(card),
        _typeLine: getCardTypeLine(card),
      };
      this.flyoutOpen = true;
      this.results = [];
      this.query = '';
    },

    closeFlyout() {
      this.flyoutOpen = false;
      this.selectedCard = null;
    },

    moveSelection(direction) {
      if (this.results.length === 0) return;
      this.selectedIndex = Math.max(
        -1,
        Math.min(this.results.length - 1, this.selectedIndex + direction),
      );
    },

    confirmSelection() {
      if (this.selectedIndex >= 0 && this.selectedIndex < this.results.length) {
        this.selectResult(this.results[this.selectedIndex]);
      }
    },

    clear() {
      this.query = '';
      this.results = [];
      this.selectedIndex = -1;
      this.loading = false;
    },
  });
}
