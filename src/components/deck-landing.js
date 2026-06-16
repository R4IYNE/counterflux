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

      <!-- Deck grid — 260606-dst2: refined from the precon-tile copy. We're
           in the Deck Archive — every tile is a Commander deck, so the
           literal 'COMMANDER' badge was redundant noise that collided with
           the top-right count badge anyway. Now: deck name in the top-left
           position, mana glyphs underneath, count + last-edited in the
           bottom gradient. Commander name only appears at the bottom when
           it differs from the deck name (no echo when they're identical).  -->
      <template x-if="$store.deck.decks.length > 0">
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[16px]">
          <template x-for="deck in $store.deck.decks" :key="deck.id">
            <button
              class="card-tile-hover"
              style="width: 100%; aspect-ratio: 240 / 336; padding: 0; background: #14161C; border: 1px solid #2A2D3A; cursor: pointer; position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; text-align: left;"
              @click="openDeck(deck.id)"
              @contextmenu.prevent="showContextMenu($event, deck)"
            >
              <!-- Background: commander art_crop, or color-identity gradient
                   fallback when no commander art has been resolved yet. -->
              <template x-if="deck._commanderCard && getArtCrop(deck._commanderCard)">
                <img
                  :src="getArtCrop(deck._commanderCard)"
                  :alt="deck._commanderCard?.name || 'Commander'"
                  style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.85;"
                  loading="lazy"
                  onerror="this.style.display='none'"
                >
              </template>
              <template x-if="!deck._commanderCard || !getArtCrop(deck._commanderCard)">
                <div :style="colorIdentityGradient(deck.color_identity) + 'position: absolute; top: 0; left: 0; width: 100%; height: 100%;'"></div>
              </template>

              <!-- Overflow menu — visible, touch-friendly affordance for deck
                   actions (open / rename / duplicate / change commander /
                   delete). Mirrors the right-click context menu, which is
                   invisible on touch. .stop so opening the menu never also
                   opens the deck. A span (not a button) avoids nesting an
                   interactive element inside the tile button. -->
              <span
                role="button"
                tabindex="0"
                aria-label="Deck actions"
                title="Deck actions"
                @click.stop.prevent="showContextMenu($event, deck)"
                style="position: absolute; top: 8px; right: 8px; z-index: 3; display: inline-flex; align-items: center; justify-content: center; padding: 2px; background: rgba(20,22,28,0.85); color: var(--color-text-muted, #7A8498); cursor: pointer;"
                onmouseenter="this.style.color='#EAECEE'"
                onmouseleave="this.style.color='#7A8498'"
              >
                <span class="material-symbols-outlined" style="font-size: 18px;">more_vert</span>
              </span>

              <!-- Top-left: format badge + deck name + color-identity mana
                   glyphs. 260606-fmt: format badge restored so non-Commander
                   decks (Modern, Standard, etc.) are still distinguishable
                   at a glance. Deck name lives directly underneath the
                   format chip so the visual hierarchy still reads
                   format → name → identity. -->
              <div style="position: absolute; top: 8px; left: 8px; right: 44px; display: inline-flex; flex-direction: column; gap: 4px; align-items: flex-start; max-width: calc(100% - 52px);">
                <span
                  style="padding: 2px 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; color: var(--color-text-muted); background: rgba(20,22,28,0.85); text-transform: uppercase;"
                  x-text="deck.format?.toUpperCase() || 'COMMANDER'"
                ></span>
                <span
                  style="padding: 4px 8px; font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.01em; color: var(--color-text-primary); background: rgba(20,22,28,0.85); text-transform: uppercase; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                  x-text="deck.name"
                ></span>
                <template x-if="Array.isArray(deck.color_identity)">
                  <span style="display: inline-flex; gap: 3px; align-items: center; padding: 4px 6px; background: rgba(20,22,28,0.85);"
                    :aria-label="'Color identity: ' + ((deck.color_identity || []).join('') || 'C')"
                  >
                    <template x-if="(deck.color_identity || []).length === 0">
                      <i class="ms ms-c ms-cost" style="font-size: 14px;"></i>
                    </template>
                    <template x-for="ci in (deck.color_identity || [])" :key="ci">
                      <i class="ms ms-cost" :class="'ms-' + ci.toLowerCase()" style="font-size: 14px;"></i>
                    </template>
                  </span>
                </template>
              </div>

              <!-- Bottom: gradient fade with commander name (only when it
                   differs from the deck name) + count + last-edited stamp. -->
              <div style="position: relative; z-index: 2; padding: 12px 16px 16px; background: linear-gradient(to top, #0B0C10 30%, transparent);">
                <template x-if="deck._commanderCard?.name && deck._commanderCard.name.toLowerCase() !== (deck.name || '').toLowerCase()">
                  <div
                    style="font-family: 'Space Grotesk', sans-serif; font-size: 12px; font-weight: 400; color: #EAECEE; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                    x-text="deck._commanderCard.name"
                  ></div>
                </template>
                <div
                  style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; color: #7A8498; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                  x-text="(deck._cardCount || 0) + '/' + (deck.deck_size || 100) + ' · ' + relativeTime(deck.updated_at)"
                ></div>
              </div>
            </button>
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
        // Hoisted — one dynamic import per call, not 2 × N where N = deck count.
        const { db } = await import('../db/schema.js');
        for (const deck of store.decks) {
          // Commander art — re-fetch on every watcher fire (the
          // `!deck._commanderCard` guard used to be here; it short-circuited
          // re-enrichment when a deck had its commander_id set after initial load).
          if (deck.commander_id) {
            try {
              let card = await db.cards.get(deck.commander_id);
              // 260608-art: lazy-hydrate the commander printing if it's
              // not in db.cards yet — typical when the user assigned a
              // commander they don't own (e.g. Frodo, Sauron's Bane on a
              // Ring deck without owning Frodo). Fetch from Scryfall and
              // persist so subsequent renders hit cache.
              if (!card) {
                try {
                  const res = await fetch(`https://api.scryfall.com/cards/${encodeURIComponent(deck.commander_id)}`);
                  if (res.ok) {
                    card = await res.json();
                    try { await db.cards.put(card); } catch {}
                  }
                } catch { /* fall through */ }
              }
              deck._commanderCard = card || null;
            } catch {
              deck._commanderCard = null;
            }
          }
          // Card count — recompute on every watcher fire. The `=== undefined`
          // guard used to be here, but it skipped re-enrichment when loadDecks'
          // pre-init left _cardCount at the seed value (0) before Dexie data
          // was ready. Pair this with the pre-init in src/stores/deck.js
          // loadDecks (Alpine reactivity gotcha — see comment there).
          try {
            const cards = await db.deck_cards.where('deck_id').equals(deck.id).toArray();
            deck._cardCount = cards.reduce((sum, c) => sum + c.quantity, 0);
          } catch {
            deck._cardCount = 0;
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
