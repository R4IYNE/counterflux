import { getCardImage, getCardName, getCardManaCost, getCardTypeLine } from '../db/card-accessor.js';
import { classifyType } from '../utils/type-classifier.js';
import { showComboPopover } from './combo-popover.js';

/**
 * Render a deck card tile for either grid or list mode.
 *
 * @param {Object} entry - Deck card: { id, deck_id, scryfall_id, quantity, tags, card, owned }
 * @param {Object} options - { mode: 'grid' | 'list' }
 * @returns {HTMLElement} The tile/row element
 */
export function renderDeckCardTile(entry, options = {}) {
  const mode = options.mode || 'grid';
  const card = entry.card;
  const cardName = card ? getCardName(card) : 'Unknown';
  const typeGroup = card ? classifyType(card.type_line) : 'Other';

  if (mode === 'list') {
    return renderListRow(entry, card, cardName, typeGroup);
  }
  return renderGridTile(entry, card, cardName, typeGroup);
}

function renderGridTile(entry, card, cardName, typeGroup) {
  const tile = document.createElement('div');
  tile.className = 'card-tile-hover cursor-pointer flex flex-col relative';
  tile.style.cssText = 'background: #14161C; border: 1px solid #2A2D3A; overflow: hidden;';
  tile.dataset.deckCardId = String(entry.id);
  tile.dataset.scryfallId = entry.scryfall_id;
  tile.dataset.typeGroup = typeGroup;
  tile.style.cursor = 'grab';

  // Image area
  const imgWrap = document.createElement('div');
  imgWrap.className = 'relative overflow-hidden';
  imgWrap.style.cssText = 'aspect-ratio: 63/88;';

  const imgSrc = card ? (getCardImage(card, 0, 'normal') || getCardImage(card, 0, 'small') || '') : '';
  if (imgSrc) {
    const img = document.createElement('img');
    img.src = imgSrc;
    img.alt = cardName;
    img.className = 'w-full h-full object-cover opacity-80 transition-all duration-500';
    img.loading = 'lazy';
    img.onerror = () => { img.style.display = 'none'; };
    imgWrap.appendChild(img);
  }

  // Gradient overlay
  const gradient = document.createElement('div');
  gradient.className = 'absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-[#14161C] to-transparent pointer-events-none';
  imgWrap.appendChild(gradient);

  // Owned/missing dot
  const dot = document.createElement('div');
  if (entry.owned) {
    dot.className = 'owned-dot';
  } else {
    dot.className = 'missing-dot';
  }
  imgWrap.appendChild(dot);

  // Quantity badge
  if (entry.quantity > 1) {
    const qtyBadge = document.createElement('span');
    qtyBadge.className = 'qty-badge';
    qtyBadge.textContent = `x${entry.quantity}`;
    imgWrap.appendChild(qtyBadge);
  }

  tile.appendChild(imgWrap);

  // Metadata below image
  const meta = document.createElement('div');
  meta.style.cssText = 'padding: 8px; display: flex; flex-direction: column; gap: 2px;';

  const nameEl = document.createElement('span');
  nameEl.textContent = cardName;
  nameEl.style.cssText = `
    font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 700;
    color: #EAECEE; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  `;
  meta.appendChild(nameEl);

  // Mana cost
  const manaCost = card ? getCardManaCost(card) : '';
  if (manaCost && typeof window.renderManaCost === 'function') {
    const manaEl = document.createElement('span');
    manaEl.innerHTML = window.renderManaCost(manaCost);
    manaEl.style.cssText = 'font-size: 12px;';
    meta.appendChild(manaEl);
  }

  // Price for missing cards
  if (!entry.owned && card?.prices?.eur) {
    const priceText = typeof window.__cf_eurToGbp === 'function'
      ? window.__cf_eurToGbp(card.prices.eur)
      : `€${card.prices.eur}`;
    const priceEl = document.createElement('span');
    priceEl.textContent = priceText;
    priceEl.style.cssText = `
      font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
      letter-spacing: 0.15em; font-weight: 700; color: #E23838;
    `;
    meta.appendChild(priceEl);
  }

  // Tag pills
  if (entry.tags && entry.tags.length > 0) {
    const tagWrap = document.createElement('div');
    tagWrap.style.cssText = 'display: flex; flex-wrap: wrap; gap: 2px; margin-top: 4px; overflow: hidden; max-height: 22px;';
    for (const tag of entry.tags) {
      const pill = document.createElement('span');
      pill.className = 'tag-pill';
      pill.style.cssText += ' max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 9px; padding: 1px 4px;';
      pill.textContent = tag;
      tagWrap.appendChild(pill);
    }
    meta.appendChild(tagWrap);
  }

  tile.appendChild(meta);

  // Right-click context menu
  tile.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    document.dispatchEvent(new CustomEvent('deck-context-menu', {
      detail: { entry, x: e.clientX, y: e.clientY },
    }));
  });

  // Click to open card flyout
  tile.addEventListener('click', () => {
    if (card) {
      document.dispatchEvent(new CustomEvent('card-flyout', { detail: { card } }));
      // Also try search store pattern from Phase 1/2
      const Alpine = window.Alpine;
      Alpine?.store('search')?.selectResult(card);
    }
  });

  // Combo badge overlay (Intelligence Layer)
  const Alpine = window.Alpine;
  const intel = Alpine?.store?.('intelligence');
  const comboCount = intel?.getComboCount?.(cardName) || 0;
  if (comboCount > 0) {
    const badge = document.createElement('div');
    badge.className = 'combo-badge';
    badge.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px; color: #EAECEE;">bolt</span>';
    badge.title = `Part of ${comboCount} combo${comboCount > 1 ? 's' : ''}`;
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      const combos = intel.getCombosForCard(cardName);
      showComboPopover(badge, combos);
    });
    tile.appendChild(badge);
  }

  return tile;
}

function renderListRow(entry, card, cardName, typeGroup) {
  const row = document.createElement('tr');
  row.style.cssText = 'border-bottom: 1px solid #2A2D3A; cursor: pointer; transition: background 150ms;';
  row.dataset.deckCardId = String(entry.id);
  row.dataset.scryfallId = entry.scryfall_id;
  row.dataset.typeGroup = typeGroup;

  row.addEventListener('mouseenter', () => { row.style.background = '#1C1F28'; });
  row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });

  // Name cell with owned/missing indicator
  const nameCell = document.createElement('td');
  nameCell.style.cssText = `
    padding: 8px 16px; font-family: 'Space Grotesk', sans-serif; font-size: 14px; color: #EAECEE;
  `;
  const indicator = entry.owned ? '●' : '●';
  const indicatorColor = entry.owned ? '#2ECC71' : '#E23838';
  nameCell.innerHTML = `<span style="color: ${indicatorColor}; margin-right: 6px; font-size: 8px;">${indicator}</span>${cardName}`;
  row.appendChild(nameCell);

  // Type cell
  const typeCell = document.createElement('td');
  typeCell.textContent = card ? getCardTypeLine(card) : '';
  typeCell.style.cssText = `
    padding: 8px 16px; font-family: 'JetBrains Mono', monospace; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.15em; color: #7A8498;
  `;
  row.appendChild(typeCell);

  // Mana cost cell
  const manaCell = document.createElement('td');
  manaCell.style.cssText = 'padding: 8px 16px;';
  const manaCost = card ? getCardManaCost(card) : '';
  if (manaCost && typeof window.renderManaCost === 'function') {
    manaCell.innerHTML = window.renderManaCost(manaCost);
  }
  row.appendChild(manaCell);

  // Price cell (GBP)
  const priceCell = document.createElement('td');
  const eurPrice = card?.prices?.eur;
  const priceText = typeof window.__cf_eurToGbp === 'function'
    ? window.__cf_eurToGbp(eurPrice)
    : (eurPrice ? `€${eurPrice}` : '--');
  priceCell.textContent = priceText;
  priceCell.style.cssText = `
    padding: 8px 16px; font-family: 'JetBrains Mono', monospace; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.15em; color: #0D52BD;
  `;
  row.appendChild(priceCell);

  // Tags cell
  const tagCell = document.createElement('td');
  tagCell.style.cssText = 'padding: 8px 16px;';
  if (entry.tags && entry.tags.length > 0) {
    for (const tag of entry.tags) {
      const pill = document.createElement('span');
      pill.className = 'tag-pill';
      pill.textContent = tag;
      pill.style.marginRight = '4px';
      tagCell.appendChild(pill);
    }
  }
  row.appendChild(tagCell);

  // Right-click context menu
  row.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    document.dispatchEvent(new CustomEvent('deck-context-menu', {
      detail: { entry, x: e.clientX, y: e.clientY },
    }));
  });

  // Click to open card flyout
  row.addEventListener('click', () => {
    if (card) {
      const Alpine = window.Alpine;
      Alpine?.store('search')?.selectResult(card);
    }
  });

  return row;
}
