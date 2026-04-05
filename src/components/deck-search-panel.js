import { searchCards } from '../db/search.js';
import { getCardImage, getCardName, getCardManaCost } from '../db/card-accessor.js';

/**
 * Deck editor search panel.
 * Left panel (280px) with card search, colour identity filtering,
 * In Collection toggle, and ghost border on unowned results (DECK-03).
 *
 * @param {HTMLElement} container - Panel mount target
 */
export function renderDeckSearchPanel(container) {
  const Alpine = window.Alpine;
  const deckStore = Alpine?.store('deck');
  const collectionStore = Alpine?.store('collection');
  const toastStore = Alpine?.store('toast');

  let inCollectionOnly = false;
  let typeFilter = 'All';
  let cmcFilter = 'All';
  let rarityFilter = 'All';
  let searchTimeout = null;
  let results = [];

  // Build Set of owned scryfall_ids for O(1) lookup
  function getOwnedSet() {
    const entries = collectionStore?.entries || [];
    return new Set(entries.map(e => e.scryfall_id));
  }

  container.innerHTML = '';
  container.style.padding = '24px 16px';

  // Overline
  const overline = document.createElement('div');
  overline.textContent = 'CARD RETRIEVAL';
  overline.style.cssText = `
    font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.15em; font-weight: 700; color: #0D52BD; margin-bottom: 16px;
  `;
  container.appendChild(overline);

  // Search input
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'SEARCH CARDS...';
  searchInput.style.cssText = `
    width: 100%; box-sizing: border-box; padding: 8px 12px;
    font-family: 'Space Grotesk', sans-serif; font-size: 14px;
    background: #0B0C10; border: 1px solid #2A2D3A; color: #EAECEE;
    outline: none; margin-bottom: 12px;
  `;
  searchInput.addEventListener('focus', () => { searchInput.style.borderColor = '#0D52BD'; });
  searchInput.addEventListener('blur', () => { searchInput.style.borderColor = '#2A2D3A'; });
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => executeSearch(), 150);
  });
  container.appendChild(searchInput);

  // In Collection Only toggle
  const toggleBtn = document.createElement('button');
  toggleBtn.textContent = 'IN COLLECTION ONLY';
  toggleBtn.style.cssText = `
    width: 100%; box-sizing: border-box; padding: 8px 12px; cursor: pointer;
    font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.15em; font-weight: 700; margin-bottom: 12px;
  `;
  applyToggleStyle(toggleBtn, false);
  toggleBtn.addEventListener('click', () => {
    inCollectionOnly = !inCollectionOnly;
    applyToggleStyle(toggleBtn, inCollectionOnly);
    executeSearch();
  });
  container.appendChild(toggleBtn);

  // Filter controls
  const filterWrap = document.createElement('div');
  filterWrap.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;';

  const typeSelect = createFilterDropdown('TYPE', [
    'All', 'Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land',
  ], (val) => { typeFilter = val; executeSearch(); });

  const cmcSelect = createFilterDropdown('CMC', [
    'All', '0', '1', '2', '3', '4', '5', '6', '7+',
  ], (val) => { cmcFilter = val; executeSearch(); });

  const raritySelect = createFilterDropdown('RARITY', [
    'All', 'common', 'uncommon', 'rare', 'mythic',
  ], (val) => { rarityFilter = val; executeSearch(); });

  filterWrap.appendChild(typeSelect);
  filterWrap.appendChild(cmcSelect);
  filterWrap.appendChild(raritySelect);
  container.appendChild(filterWrap);

  // Results container
  const resultsEl = document.createElement('div');
  resultsEl.style.cssText = 'flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;';
  resultsEl.id = 'deck-search-results';
  container.appendChild(resultsEl);

  // No results message
  const noResults = document.createElement('div');
  noResults.textContent = 'No cards match your search within this colour identity.';
  noResults.style.cssText = `
    font-family: 'Space Grotesk', sans-serif; font-size: 14px; color: #7A8498;
    padding: 16px 0; display: none; text-align: center;
  `;
  container.appendChild(noResults);

  async function executeSearch() {
    const query = searchInput.value.trim();
    if (query.length < 2) {
      results = [];
      renderResults();
      return;
    }

    // Fetch more results to allow post-filtering
    let raw = await searchCards(query, 50);

    // Filter by commander colour identity
    const deckColorIdentity = deckStore?.activeDeck?.color_identity || [];
    if (deckColorIdentity.length > 0) {
      raw = raw.filter(card => {
        const cardCI = card.color_identity || [];
        return cardCI.every(c => deckColorIdentity.includes(c));
      });
    }

    // Type filter
    if (typeFilter !== 'All') {
      raw = raw.filter(card => (card.type_line || '').includes(typeFilter));
    }

    // CMC filter
    if (cmcFilter !== 'All') {
      if (cmcFilter === '7+') {
        raw = raw.filter(card => (card.cmc || 0) >= 7);
      } else {
        const cmcVal = parseInt(cmcFilter, 10);
        raw = raw.filter(card => (card.cmc || 0) === cmcVal);
      }
    }

    // Rarity filter
    if (rarityFilter !== 'All') {
      raw = raw.filter(card => card.rarity === rarityFilter);
    }

    // In Collection Only filter
    if (inCollectionOnly) {
      const ownedSet = getOwnedSet();
      raw = raw.filter(card => ownedSet.has(card.id));
    }

    results = raw.slice(0, 20);
    renderResults();
  }

  function renderResults() {
    resultsEl.innerHTML = '';
    noResults.style.display = results.length === 0 && searchInput.value.trim().length >= 2 ? 'block' : 'none';

    const ownedSet = getOwnedSet();

    for (const card of results) {
      const isOwned = ownedSet.has(card.id);
      const row = document.createElement('div');
      row.style.cssText = `
        display: flex; align-items: center; gap: 8px; padding: 6px 8px;
        cursor: pointer; transition: background 150ms;
      `;
      row.dataset.scryfallId = card.id;

      // DECK-03: Ghost border for unowned cards
      if (!isOwned) {
        row.classList.add('ghost-border-unowned');
      }

      row.addEventListener('mouseenter', () => { row.style.background = '#1C1F28'; });
      row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });

      // Thumbnail (32px)
      const thumb = document.createElement('img');
      const thumbUrl = getCardImage(card, 0, 'small') || '';
      thumb.src = thumbUrl;
      thumb.alt = getCardName(card) || '';
      thumb.style.cssText = 'width: 32px; height: 44px; object-fit: cover; flex-shrink: 0; border-radius: 0;';
      thumb.loading = 'lazy';
      thumb.onerror = () => { thumb.style.display = 'none'; };
      row.appendChild(thumb);

      // Card info
      const info = document.createElement('div');
      info.style.cssText = 'flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;';

      const nameEl = document.createElement('span');
      nameEl.textContent = getCardName(card) || 'Unknown';
      nameEl.style.cssText = `
        font-family: 'Space Grotesk', sans-serif; font-size: 14px; color: #EAECEE;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      `;
      info.appendChild(nameEl);

      // Mana cost
      const manaCost = getCardManaCost(card);
      if (manaCost && typeof window.renderManaCost === 'function') {
        const manaEl = document.createElement('span');
        manaEl.innerHTML = window.renderManaCost(manaCost);
        manaEl.style.cssText = 'font-size: 12px;';
        info.appendChild(manaEl);
      }

      row.appendChild(info);

      // Price in GBP
      const eurPrice = card.prices?.eur;
      const priceText = typeof window.__cf_eurToGbp === 'function'
        ? window.__cf_eurToGbp(eurPrice)
        : (eurPrice ? `€${eurPrice}` : '--');
      const priceEl = document.createElement('span');
      priceEl.textContent = priceText;
      // DECK-03: Prominent price for unowned cards (label 700), normal for owned (label 400)
      if (!isOwned) {
        priceEl.style.cssText = `
          font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
          letter-spacing: 0.15em; font-weight: 700; color: #EAECEE; flex-shrink: 0;
        `;
      } else {
        priceEl.style.cssText = `
          font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
          letter-spacing: 0.15em; font-weight: 400; color: #7A8498; flex-shrink: 0;
        `;
      }
      row.appendChild(priceEl);

      // Click to add
      row.addEventListener('click', async () => {
        if (!deckStore) return;
        const result = await deckStore.addCard(card.id);
        if (result?.warning) {
          toastStore?.warning(result.message);
        } else if (result?.added) {
          toastStore?.success(`${getCardName(card) || 'Card'} added to ${deckStore.activeDeck?.name || 'deck'}.`);
        }
      });

      // Right-click context menu
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('deck-search-context-menu', {
          detail: { card, x: e.clientX, y: e.clientY },
        }));
      });

      resultsEl.appendChild(row);
    }
  }
}

/**
 * Apply filter toggle styling.
 */
function applyToggleStyle(btn, active) {
  if (active) {
    btn.className = 'filter-toggle-on';
    btn.style.background = 'var(--color-primary, #0D52BD)';
    btn.style.color = 'var(--color-text-primary, #EAECEE)';
    btn.style.border = 'none';
  } else {
    btn.className = 'filter-toggle-off';
    btn.style.background = 'transparent';
    btn.style.color = 'var(--color-text-muted, #7A8498)';
    btn.style.border = '1px solid var(--color-border-ghost, #2A2D3A)';
  }
}

/**
 * Create a labelled filter dropdown.
 */
function createFilterDropdown(label, options, onChange) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

  const labelEl = document.createElement('span');
  labelEl.textContent = label;
  labelEl.style.cssText = `
    font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.15em; font-weight: 700; color: #7A8498;
  `;
  wrap.appendChild(labelEl);

  const select = document.createElement('select');
  select.style.cssText = `
    padding: 6px 8px; font-family: 'JetBrains Mono', monospace; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.15em; background: #0B0C10;
    border: 1px solid #2A2D3A; color: #EAECEE; cursor: pointer;
  `;
  for (const opt of options) {
    const optEl = document.createElement('option');
    optEl.value = opt;
    optEl.textContent = opt.toUpperCase();
    select.appendChild(optEl);
  }
  select.addEventListener('change', () => onChange(select.value));
  wrap.appendChild(select);

  return wrap;
}
