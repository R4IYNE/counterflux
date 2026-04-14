import { renderEmptyState } from './empty-state.js';
import { getCardImage } from '../db/card-accessor.js';

/**
 * Render the deck list landing page.
 * Shows a grid of deck cards with commander art thumbnails,
 * or an empty state with Mila if no decks exist.
 *
 * @param {HTMLElement} container - Element to render into
 */
export function renderDeckLanding(container) {
  container.innerHTML = `
    <div x-data="deckLandingData()" x-init="init()" class="flex flex-col gap-[24px]">

      <!-- Screen header -->
      <div class="flex items-center justify-between">
        <div>
          <span class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold"
                style="color: #7A8498;">DECK ARCHIVE</span>
          <h2 style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; line-height: 1.2; letter-spacing: 0.01em; color: #EAECEE; margin: 0;">
            THOUSAND-YEAR STORM
          </h2>
        </div>
        <button
          @click="openRitual()"
          style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; cursor: pointer; padding: 8px 16px; background: #0D52BD; color: #EAECEE; border: none;"
        >Brew a new storm</button>
      </div>

      <!-- Empty state -->
      <template x-if="$store.deck.decks.length === 0 && !$store.deck.loading">
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: 24px; text-align: center;">
          <img
            src="/assets/assetsmila-izzet.png"
            alt="Mila -- Izzet Familiar"
            style="width: 96px; height: 96px; object-fit: cover; filter: grayscale(1) opacity(0.5);"
          >
          <h2 style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; line-height: 1.2; letter-spacing: 0.01em; color: #EAECEE; margin: 0;">
            No Decks in the Archive
          </h2>
          <p style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; line-height: 1.5; color: #7A8498; max-width: 28rem; width: 100%; margin: 0;">
            The storm hasn't gathered yet. Click "Brew a new storm" to create your first Commander deck and begin brewing.
          </p>
          <button
            @click="openRitual()"
            style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; cursor: pointer; padding: 8px 16px; background: #0D52BD; color: #EAECEE; border: none;"
          >Brew a new storm</button>
        </div>
      </template>

      <!-- Deck grid -->
      <template x-if="$store.deck.decks.length > 0">
        <div class="grid grid-cols-2 xl:grid-cols-3 gap-[16px]">
          <template x-for="deck in $store.deck.decks" :key="deck.id">
            <div
              class="cursor-pointer transition-colors"
              style="background: #14161C; border: 1px solid #2A2D3A;"
              @mouseenter="$el.style.background='#1C1F28'"
              @mouseleave="$el.style.background='#14161C'"
              @click="openDeck(deck.id)"
              @contextmenu.prevent="showContextMenu($event, deck)"
            >
              <!-- Commander art thumbnail -->
              <div style="aspect-ratio: 16/9; overflow: hidden; position: relative;">
                <template x-if="deck._commanderCard && getArtCrop(deck._commanderCard)">
                  <img
                    :src="getArtCrop(deck._commanderCard)"
                    :alt="deck._commanderCard?.name || 'Commander'"
                    style="width: 100%; height: 100%; object-fit: cover;"
                  >
                </template>
                <template x-if="!deck._commanderCard || !getArtCrop(deck._commanderCard)">
                  <div :style="colorIdentityGradient(deck.color_identity)" style="width: 100%; height: 100%;"></div>
                </template>
              </div>

              <!-- Deck info -->
              <div style="padding: 8px 16px 16px;">
                <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #EAECEE; margin-bottom: 4px;"
                     x-text="deck.name"></div>
                <div class="flex items-center gap-[8px]" style="margin-bottom: 4px;">
                  <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.15em; color: #7A8498;"
                        x-text="(deck._cardCount || 0) + '/' + deck.deck_size"></span>
                  <span class="tag-pill" x-text="deck.format?.toUpperCase() || 'COMMANDER'"></span>
                </div>
                <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #7A8498;"
                     x-text="'LAST EDITED ' + relativeTime(deck.updated_at)"></div>
              </div>
            </div>
          </template>
        </div>
      </template>
    </div>
  `;

  // Register Alpine data component
  const Alpine = window.Alpine;
  if (Alpine && typeof Alpine.data === 'function') {
    Alpine.data('deckLandingData', () => ({
      async init() {
        // Enrich decks with commander card data and card counts
        await this.enrichDecks();

        // Watch for deck list changes
        this.$watch('$store.deck.decks', () => this.enrichDecks());
      },

      async enrichDecks() {
        const store = Alpine.store('deck');
        for (const deck of store.decks) {
          // Load commander card data for art thumbnail
          if (deck.commander_id && !deck._commanderCard) {
            try {
              const { db } = await import('../db/schema.js');
              const card = await db.cards.get(deck.commander_id);
              deck._commanderCard = card || null;
            } catch {
              deck._commanderCard = null;
            }
          }

          // Load card count for deck
          if (deck._cardCount === undefined) {
            try {
              const { db } = await import('../db/schema.js');
              const cards = await db.deck_cards.where('deck_id').equals(deck.id).toArray();
              deck._cardCount = cards.reduce((sum, c) => sum + c.quantity, 0);
            } catch {
              deck._cardCount = 0;
            }
          }
        }
      },

      getArtCrop(card) {
        if (!card) return null;
        return getCardImage(card, 0, 'art_crop');
      },

      colorIdentityGradient(colors) {
        const mtgColors = {
          W: '#F9FAF4', U: '#0D52BD', B: '#2B2B2B',
          R: '#E23838', G: '#2ECC71',
        };
        if (!colors || colors.length === 0) {
          return 'background: linear-gradient(135deg, #2A2D3A, #14161C);';
        }
        if (colors.length === 1) {
          return `background: ${mtgColors[colors[0]] || '#2A2D3A'};`;
        }
        const stops = colors.map((c, i) => {
          const pct = (i / (colors.length - 1)) * 100;
          return `${mtgColors[c] || '#2A2D3A'} ${pct}%`;
        });
        return `background: linear-gradient(135deg, ${stops.join(', ')});`;
      },

      relativeTime(isoString) {
        if (!isoString) return 'UNKNOWN';
        const now = Date.now();
        const then = new Date(isoString).getTime();
        const diffMs = now - then;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'JUST NOW';
        if (diffMins < 60) return `${diffMins}M AGO`;
        if (diffHours < 24) return `${diffHours}H AGO`;
        if (diffDays === 1) return 'YESTERDAY';
        if (diffDays < 30) return `${diffDays}D AGO`;
        return `${Math.floor(diffDays / 30)}MO AGO`;
      },

      openDeck(deckId) {
        document.dispatchEvent(
          new CustomEvent('deck-open', { detail: { deckId } })
        );
      },

      showContextMenu(event, deck) {
        document.dispatchEvent(
          new CustomEvent('deck-landing-context-menu', {
            detail: { deck, x: event.clientX, y: event.clientY },
          })
        );
      },

      async openRitual() {
        const { openRitualModal } = await import('./ritual-modal.js');
        openRitualModal();
      },
    }));
  }
}
