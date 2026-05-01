import { searchCards, browseCards } from '../db/search.js';
import { getCardImage, getCardName, getCardManaCost } from '../db/card-accessor.js';
import Sortable from 'sortablejs';
import { DEFAULT_TAGS, suggestTags } from '../utils/tag-heuristics.js';

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
  let colourFilter = new Set(); // active WUBRG colour filters
  let tagFilter = 'All';
  let searchTimeout = null;
  let results = [];
  let searchSortable = null;

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

  // Colour identity filter (WUBRG mana icons)
  const colourLabel = document.createElement('span');
  colourLabel.textContent = 'COLOUR';
  colourLabel.style.cssText = `
    font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.15em; font-weight: 700; color: #7A8498; display: block; margin-bottom: 4px;
  `;
  container.appendChild(colourLabel);

  const colourRow = document.createElement('div');
  colourRow.style.cssText = 'display: flex; gap: 4px; margin-bottom: 16px;';

  const WUBRG = [
    { key: 'W', icon: 'ms ms-w ms-cost', label: 'White' },
    { key: 'U', icon: 'ms ms-u ms-cost', label: 'Blue' },
    { key: 'B', icon: 'ms ms-b ms-cost', label: 'Black' },
    { key: 'R', icon: 'ms ms-r ms-cost', label: 'Red' },
    { key: 'G', icon: 'ms ms-g ms-cost', label: 'Green' },
    { key: 'C', icon: 'ms ms-c ms-cost', label: 'Colourless' },
  ];

  // Only show colours within the deck's colour identity (+ colourless always)
  const deckCI = deckStore?.activeDeck?.color_identity || [];

  // Start with all deck-legal colours + colourless active
  for (const c of deckCI) colourFilter.add(c);
  colourFilter.add('C');

  for (const colour of WUBRG) {
    // Skip colours outside deck's identity (except colourless)
    if (colour.key !== 'C' && deckCI.length > 0 && !deckCI.includes(colour.key)) continue;

    const btn = document.createElement('button');
    btn.title = colour.label;
    btn.style.cssText = `
      width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
      cursor: pointer; border: 2px solid transparent; background: transparent;
      border-radius: 50%; transition: border-color 150ms, opacity 150ms;
      opacity: 1; border-color: #0D52BD;
    `;
    btn.innerHTML = `<i class="${colour.icon}" style="font-size: 20px;"></i>`;

    btn.addEventListener('click', () => {
      if (colourFilter.has(colour.key)) {
        colourFilter.delete(colour.key);
        btn.style.opacity = '0.4';
        btn.style.borderColor = 'transparent';
      } else {
        colourFilter.add(colour.key);
        btn.style.opacity = '1';
        btn.style.borderColor = '#0D52BD';
      }
      executeSearch();
    });

    colourRow.appendChild(btn);
  }
  container.appendChild(colourRow);

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

  const tagSelect = createFilterDropdown('CATEGORY', [
    'All', ...DEFAULT_TAGS,
  ], (val) => { tagFilter = val; executeSearch(); });

  filterWrap.appendChild(typeSelect);
  filterWrap.appendChild(cmcSelect);
  filterWrap.appendChild(raritySelect);
  filterWrap.appendChild(tagSelect);
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

  // Phase 13 Plan 3 — D-05: Bulk data loading placeholder (Thousand-Year Storm
  // card-search). Rendered when browseCards() / searchCards() returns an
  // empty array flagged with `bulkDataNotReady: true`. Mirrors the add-card
  // panel's placeholder visual density.
  const bulkLoadingPlaceholder = document.createElement('div');
  bulkLoadingPlaceholder.id = 'deck-search-bulk-loading';
  bulkLoadingPlaceholder.style.cssText = `
    display: none; align-items: center; gap: 8px; padding: 12px;
    background: #1C1F28; border: 1px solid #2A2D3A; color: #7A8498;
    margin-top: 8px;
  `;
  bulkLoadingPlaceholder.innerHTML = `
    <span class="material-symbols-outlined" style="font-size: 16px;">hourglass_empty</span>
    <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;">
      Bulk data loading &mdash; card search available when archive is indexed
    </span>
  `;
  container.appendChild(bulkLoadingPlaceholder);

  async function executeSearch() {
    const query = searchInput.value.trim();
    const deckColorIdentity = deckStore?.activeDeck?.color_identity || [];

    let raw;

    if (query.length < 2) {
      // Browse mode: show cards matching colour identity and filters
      raw = await browseCards(deckColorIdentity, {
        type: typeFilter,
        cmc: cmcFilter,
        rarity: rarityFilter,
        tag: tagFilter,
      }, 50);
    } else {
      // Search mode: text search
      raw = await searchCards(query, 50);

      // Filter by commander colour identity
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
    }

    // In Collection Only filter
    if (inCollectionOnly) {
      const ownedSet = getOwnedSet();
      raw = raw.filter(card => ownedSet.has(card.id));
    }

    // Colour filter (WUBRG toggles) — exclude cards with unticked colours
    const allColoursActive = deckCI.every(c => colourFilter.has(c)) && colourFilter.has('C');
    if (!allColoursActive) {
      raw = raw.filter(card => {
        const cardCI = card.color_identity || [];
        // Colourless cards: only show if C is ticked
        if (cardCI.length === 0) return colourFilter.has('C');
        // Every colour in the card must be ticked
        return cardCI.every(c => colourFilter.has(c));
      });
    }

    // Functional tag filter — match via oracle text heuristics
    if (tagFilter !== 'All') {
      raw = raw.filter(card => {
        const cardTags = suggestTags(card?.oracle_text);
        return cardTags.includes(tagFilter);
      });
    }

    // Phase 13 Plan 3 — D-05: propagate bulkDataNotReady flag so renderResults
    // can swap the normal "no results" copy for the bulk-data skeleton.
    const bulkDataNotReady = !!raw?.bulkDataNotReady;
    results = raw.slice(0, 20);
    results.bulkDataNotReady = bulkDataNotReady;
    renderResults();
  }

  function renderResults() {
    resultsEl.innerHTML = '';
    const bulkDataNotReady = !!results.bulkDataNotReady;
    // Phase 13 Plan 3 — D-05: show the bulk-data skeleton instead of the
    // normal "no results" copy when the archive isn't indexed yet.
    bulkLoadingPlaceholder.style.display = bulkDataNotReady ? 'flex' : 'none';
    noResults.style.display = (!bulkDataNotReady && results.length === 0) ? 'block' : 'none';

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

      // v1.2 hot-fix: quantity input next to the add button so users can
      // specify N copies in one click instead of clicking `+` N times. Most
      // useful for basic lands (Commander rules exempt them from singleton)
      // — defaulted to 1 so non-basics still work as before. Setting >1 on
      // a non-basic in commander format will silently fall through to the
      // singleton-warning path on the second add; that's acceptable
      // degradation (rare path).
      const isBasicLand = card?.type_line && /Basic\s+Land/i.test(card.type_line);
      const qtyInput = document.createElement('input');
      qtyInput.type = 'number';
      qtyInput.min = '1';
      qtyInput.max = '99';
      qtyInput.value = '1';
      qtyInput.title = isBasicLand
        ? `Quantity (basic land — unlimited copies allowed)`
        : `Quantity`;
      qtyInput.style.cssText = `
        width: 36px; height: 28px; flex-shrink: 0; padding: 0 4px; text-align: center;
        background: transparent; border: 1px solid #2A2D3A; color: #EAECEE;
        font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700;
      `;
      qtyInput.addEventListener('click', (e) => e.stopPropagation());
      qtyInput.addEventListener('keydown', (e) => e.stopPropagation());
      row.appendChild(qtyInput);

      // Add button (explicit)
      const addBtn = document.createElement('button');
      addBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px;">add</span>';
      addBtn.title = `Add ${getCardName(card) || 'card'} to deck`;
      addBtn.style.cssText = `
        width: 28px; height: 28px; flex-shrink: 0; display: flex; align-items: center;
        justify-content: center; background: transparent; border: 1px solid #2A2D3A;
        color: #7A8498; cursor: pointer; transition: all 150ms; padding: 0;
      `;
      addBtn.addEventListener('mouseenter', () => { addBtn.style.borderColor = '#0D52BD'; addBtn.style.color = '#0D52BD'; });
      addBtn.addEventListener('mouseleave', () => { addBtn.style.borderColor = '#2A2D3A'; addBtn.style.color = '#7A8498'; });
      addBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!deckStore) return;
        const qty = Math.max(1, Math.min(99, parseInt(qtyInput.value, 10) || 1));
        // Add the first copy through the normal path (which handles
        // initial tagging + duplicate detection). For qty > 1, follow up
        // with addCard calls — the basic-land + "any number of" exemptions
        // bump quantity, others return a singleton warning we log once.
        let succeeded = 0;
        let lastWarning = null;
        for (let i = 0; i < qty; i++) {
          const result = await deckStore.addCard(card.id);
          if (result?.added) succeeded++;
          else if (result?.warning) { lastWarning = result.message; break; }
        }
        if (succeeded > 0) {
          const cardName = getCardName(card) || 'Card';
          const suffix = succeeded > 1 ? ` x${succeeded}` : '';
          toastStore?.success(`${cardName}${suffix} added to ${deckStore.activeDeck?.name || 'deck'}.`);
        }
        if (lastWarning && succeeded === 0) {
          toastStore?.warning(lastWarning);
        }
      });
      row.appendChild(addBtn);

      // Click row to preview card (flyout)
      row.addEventListener('click', () => {
        const Alpine = window.Alpine;
        Alpine?.store('search')?.selectResult(card);
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

    // v1.2 hot-fix: drag-to-deck SortableJS removed per user request — the
    // explicit `+` add button + the new quantity stepper are the only entry
    // points now. This eliminates the TypeError null-options crashes that
    // were firing when Sortable's global drag handlers fired on stale
    // instances after rapid refreshes.
  }

  // Show browse results on initial load
  executeSearch();
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
