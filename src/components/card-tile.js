import { getCardThumbnail, getCardImage, getCardName } from '../db/card-accessor.js';
import { eurToGbp } from '../services/currency.js';

/**
 * Render a single gallery card tile.
 *
 * @param {Object} entry - Collection entry with joined card data
 * @param {number} index - Index in the sorted list
 * @returns {string} HTML string for the card tile
 */
export function renderCardTile(entry, index) {
  const card = entry.card;
  if (!card) return '';

  const imgSrc = getCardThumbnail(card) || getCardImage(card, 0, 'normal') || '';
  const name = getCardName(card) || 'Unknown';
  const eurPrice = entry.foil
    ? card.prices?.eur_foil
    : card.prices?.eur;
  const priceDisplay = eurToGbp(eurPrice);
  const setName = (card.set_name || card.set || '').toUpperCase();

  const qtyBadge = entry.quantity > 1
    ? `<span class="qty-badge">x${entry.quantity}</span>`
    : '';

  const foilBadge = entry.foil
    ? `<span class="foil-badge absolute bottom-0 left-0 mb-[8px] ml-[8px]">FOIL</span>`
    : '';

  // FOLLOWUP-3 (Phase 08.1 Plan 3) — escape the card name for safe inclusion
  // in HTML attribute values (aria-label, title). Without this, a card named
  // O" would break the attribute string.
  const safeName = String(name).replace(/"/g, '&quot;');

  return `
    <div class="card-tile-hover cursor-pointer flex flex-col"
         tabindex="0"
         data-entry-id="${entry.id || ''}"
         style="background: #14161C; border: 1px solid #2A2D3A; position: relative;"
         @click="$store.search.selectResult($store.collection.sorted[${index}]?.card)"
         @contextmenu.prevent="$dispatch('card-context-menu', { entry: $store.collection.sorted[${index}], x: $event.clientX, y: $event.clientY })"
         @keydown.enter.prevent="(() => { const r = $event.currentTarget.getBoundingClientRect(); $dispatch('card-context-menu', { entry: $store.collection.sorted[${index}], x: r.left + r.width/2, y: r.top + r.height/2 }); })()"
         @keydown.space.prevent="(() => { const r = $event.currentTarget.getBoundingClientRect(); $dispatch('card-context-menu', { entry: $store.collection.sorted[${index}], x: r.left + r.width/2, y: r.top + r.height/2 }); })()">
      <!-- Image area -->
      <div class="relative overflow-hidden" style="aspect-ratio: 63/88;">
        <img
          src="${imgSrc}"
          alt="${safeName}"
          class="w-full h-full object-cover opacity-80 transition-all duration-500 cf-card-img"
          loading="lazy"
          onerror="this.style.display='none'"
        >
        <!-- Gradient overlay -->
        <div class="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-[#14161C] to-transparent pointer-events-none"></div>
        <!-- FOLLOWUP-3 hover-revealed quick-actions checkbox -->
        <button
          type="button"
          class="card-quick-actions-checkbox"
          aria-label="Quick actions for ${safeName}"
          title="Quick actions"
          @click.stop="$dispatch('card-context-menu', { entry: $store.collection.sorted[${index}], x: $event.clientX, y: $event.clientY })"
          @keydown.enter.stop.prevent="$dispatch('card-context-menu', { entry: $store.collection.sorted[${index}], x: $event.currentTarget.getBoundingClientRect().left, y: $event.currentTarget.getBoundingClientRect().bottom + 4 })"
          @keydown.space.stop.prevent="$dispatch('card-context-menu', { entry: $store.collection.sorted[${index}], x: $event.currentTarget.getBoundingClientRect().left, y: $event.currentTarget.getBoundingClientRect().bottom + 4 })"
        >
          <span class="material-symbols-outlined">more_vert</span>
        </button>
        ${qtyBadge}
        ${foilBadge}
      </div>
      <!-- Metadata -->
      <div class="p-[8px] flex flex-col gap-[2px]">
        <span class="text-[14px] font-bold leading-[1.3] truncate"
              style="font-family: 'Space Grotesk', sans-serif; color: #EAECEE;">${name}</span>
        <span class="font-mono text-[11px] tracking-[0.15em]"
              style="color: #0D52BD;">${priceDisplay}</span>
        <span class="font-mono text-[11px] tracking-[0.15em]"
              style="color: #4A5064;">${setName}</span>
      </div>
    </div>
  `;
}
