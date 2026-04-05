import { renderDeckCardTile } from './deck-card-tile.js';
import { TYPE_ORDER } from '../utils/type-classifier.js';
import Sortable from 'sortablejs';

/**
 * Deck centre panel -- the 99.
 * Shows cards grouped by type with grid/list views and SortableJS drag-and-drop.
 *
 * @param {HTMLElement} container - Mount target (flex-1 area)
 */
export function renderDeckCentrePanel(container) {
  const Alpine = window.Alpine;
  const store = Alpine?.store('deck');

  let sortableInstances = [];
  let collapsedGroups = {};

  container.innerHTML = '';
  container.style.padding = '24px';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '16px';

  // Header section
  const header = document.createElement('div');
  header.style.cssText = 'display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;';

  // Deck name (heading)
  const deckName = document.createElement('h2');
  deckName.style.cssText = `
    font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700;
    color: #EAECEE; margin: 0;
  `;
  container.appendChild(header);

  // Card count display (D-18)
  const countRow = document.createElement('div');
  countRow.style.cssText = 'display: flex; align-items: baseline; gap: 16px;';

  const countDisplay = document.createElement('span');
  countDisplay.style.cssText = `
    font-family: 'Syne', sans-serif; font-size: 48px; font-weight: 700;
    color: #EAECEE; line-height: 1.1; letter-spacing: -0.02em;
  `;

  const slotsLabel = document.createElement('span');
  slotsLabel.style.cssText = `
    font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.15em; font-weight: 400; color: #7A8498;
  `;

  countRow.appendChild(countDisplay);
  countRow.appendChild(slotsLabel);
  header.appendChild(deckName);
  header.appendChild(countRow);

  // Owned summary bar (D-13)
  const ownedBar = document.createElement('div');
  ownedBar.style.cssText = `
    font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.15em; font-weight: 400; color: #7A8498;
  `;
  header.appendChild(ownedBar);

  // Controls row: view toggle + import/export
  const controls = document.createElement('div');
  controls.style.cssText = 'display: flex; align-items: center; gap: 8px; flex-wrap: wrap;';

  const gridBtn = createToggleBtn('GRID');
  const listBtn = createToggleBtn('LIST');

  gridBtn.addEventListener('click', () => {
    if (store) store.viewMode = 'grid';
    refresh();
  });
  listBtn.addEventListener('click', () => {
    if (store) store.viewMode = 'list';
    refresh();
  });

  controls.appendChild(gridBtn);
  controls.appendChild(listBtn);

  // Import/Export buttons (disabled, coming in Plan 05)
  const importBtn = createDisabledBtn('Import Decklist');
  const exportBtn = createDisabledBtn('Export Decklist');
  controls.appendChild(importBtn);
  controls.appendChild(exportBtn);

  header.appendChild(controls);

  // Card groups area
  const groupsArea = document.createElement('div');
  groupsArea.style.cssText = 'flex: 1; display: flex; flex-direction: column; gap: 16px;';
  container.appendChild(groupsArea);

  function refresh() {
    updateHeader();
    renderGroups();
  }

  function updateHeader() {
    if (!store) return;
    const deck = store.activeDeck;
    deckName.textContent = deck?.name || 'UNTITLED DECK';

    const cardCount = store.cardCount;
    const deckSize = deck?.deck_size || 100;
    const remaining = store.slotsRemaining;
    countDisplay.textContent = `${cardCount}/${deckSize}`;
    slotsLabel.textContent = `${remaining} SLOTS REMAINING`;

    // Owned summary
    const activeCards = store.activeCards || [];
    const ownedCount = activeCards.filter(c => c.owned).length;
    const totalCount = activeCards.length;
    const missingCards = activeCards.filter(c => !c.owned);
    let missingCost = 0;
    for (const c of missingCards) {
      const eur = parseFloat(c.card?.prices?.eur || '0');
      missingCost += eur;
    }
    const missingPriceText = typeof window.__cf_eurToGbp === 'function'
      ? window.__cf_eurToGbp(missingCost || null)
      : (missingCost > 0 ? `€${missingCost.toFixed(2)}` : '--');
    ownedBar.textContent = `YOU OWN ${ownedCount}/${totalCount} -- MISSING COST: ${missingPriceText}`;

    // View toggle styling
    const viewMode = store.viewMode || 'grid';
    applyToggleActive(gridBtn, viewMode === 'grid');
    applyToggleActive(listBtn, viewMode === 'list');
  }

  function destroySortables() {
    for (const s of sortableInstances) {
      try { s.destroy(); } catch { /* ignore */ }
    }
    sortableInstances = [];
  }

  function renderGroups() {
    destroySortables();
    groupsArea.innerHTML = '';

    if (!store) return;
    const grouped = store.groupedByType;
    const viewMode = store.viewMode || 'grid';

    for (const type of TYPE_ORDER) {
      const cards = grouped[type];
      if (!cards || cards.length === 0) continue;

      const group = document.createElement('div');
      group.dataset.typeGroup = type;

      // Collapsible header
      const groupHeader = document.createElement('div');
      groupHeader.style.cssText = `
        display: flex; align-items: center; gap: 8px; cursor: pointer;
        padding: 8px 0; user-select: none;
      `;

      const chevron = document.createElement('span');
      chevron.className = 'material-symbols-outlined';
      chevron.style.cssText = 'font-size: 16px; color: #7A8498; transition: transform 150ms;';
      chevron.textContent = collapsedGroups[type] ? 'expand_more' : 'expand_less';

      const headerLabel = document.createElement('span');
      headerLabel.style.cssText = `
        font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
        letter-spacing: 0.15em; font-weight: 700; color: #7A8498;
      `;
      headerLabel.textContent = `${type.toUpperCase()}S (${cards.length})`;
      // Fix pluralization for special cases
      if (type === 'Sorcery') headerLabel.textContent = `SORCERIES (${cards.length})`;
      else if (type === 'Other') headerLabel.textContent = `OTHER (${cards.length})`;

      groupHeader.appendChild(chevron);
      groupHeader.appendChild(headerLabel);

      groupHeader.addEventListener('click', () => {
        collapsedGroups[type] = !collapsedGroups[type];
        chevron.textContent = collapsedGroups[type] ? 'expand_more' : 'expand_less';
        contentEl.style.display = collapsedGroups[type] ? 'none' : '';
      });

      group.appendChild(groupHeader);

      // Content area
      const contentEl = document.createElement('div');
      contentEl.style.display = collapsedGroups[type] ? 'none' : '';
      contentEl.dataset.typeGroup = type;

      if (viewMode === 'grid') {
        contentEl.className = 'grid grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2';
        for (const entry of cards) {
          const tile = renderDeckCardTile(entry, { mode: 'grid' });
          contentEl.appendChild(tile);
        }

        // SortableJS for grid
        const sortable = new Sortable(contentEl, {
          group: 'deck-cards',
          animation: 150,
          ghostClass: 'drag-ghost',
          fallbackOnBody: true,
          onEnd(evt) {
            const deckCardId = evt.item?.dataset?.deckCardId;
            if (deckCardId && store) {
              // If dropped from search panel (has scryfallId, no deckCardId on clone)
              const scryfallId = evt.item?.dataset?.scryfallId;
              if (evt.from !== evt.to) {
                evt.item.remove(); // Prevent duplicate; store re-render handles it
              }
              store.reorderCard(parseInt(deckCardId, 10), evt.newIndex || 0).then(() => refresh());
            }
          },
        });
        sortableInstances.push(sortable);
      } else {
        // List view
        const table = document.createElement('table');
        table.style.cssText = 'width: 100%; border-collapse: collapse;';

        const thead = document.createElement('thead');
        thead.innerHTML = `
          <tr style="border-bottom: 1px solid #2A2D3A;">
            <th style="text-align: left; padding: 8px 16px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #7A8498;">NAME</th>
            <th style="text-align: left; padding: 8px 16px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #7A8498;">TYPE</th>
            <th style="text-align: left; padding: 8px 16px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #7A8498;">MANA</th>
            <th style="text-align: left; padding: 8px 16px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #7A8498;">PRICE (GBP)</th>
            <th style="text-align: left; padding: 8px 16px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #7A8498;">TAGS</th>
          </tr>
        `;
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        for (const entry of cards) {
          const row = renderDeckCardTile(entry, { mode: 'list' });
          tbody.appendChild(row);
        }
        table.appendChild(tbody);
        contentEl.appendChild(table);
      }

      group.appendChild(contentEl);
      groupsArea.appendChild(group);
    }
  }

  // Set up SortableJS on search results list for drag-to-deck
  function setupSearchDragSource() {
    const searchResultsEl = document.getElementById('deck-search-results');
    if (searchResultsEl && !searchResultsEl._sortableInit) {
      const searchSortable = new Sortable(searchResultsEl, {
        group: { name: 'deck-cards', pull: 'clone', put: false },
        sort: false,
        animation: 150,
        ghostClass: 'drag-ghost',
        onEnd(evt) {
          const scryfallId = evt.item?.dataset?.scryfallId;
          if (scryfallId && evt.from !== evt.to && store) {
            evt.clone?.remove();
            evt.item?.remove();
            store.addCard(scryfallId).then(() => refresh());
          }
        },
      });
      searchResultsEl._sortableInit = true;
      sortableInstances.push(searchSortable);
    }
  }

  // Observe for search results becoming available
  const observer = new MutationObserver(() => {
    setupSearchDragSource();
  });
  observer.observe(container.parentElement || container, { childList: true, subtree: true });

  // Initial render
  refresh();
  setTimeout(setupSearchDragSource, 100);

  // Re-render when store updates (poll-based since we're imperative, not Alpine template)
  let refreshInterval = setInterval(() => {
    if (!store) return;
    updateHeader();
  }, 500);

  // Listen for card additions to re-render groups
  const handleStoreChange = () => {
    setTimeout(refresh, 50);
  };
  document.addEventListener('deck-cards-changed', handleStoreChange);

  // Cleanup
  const prevCleanup = container._centreCleanup;
  container._centreCleanup = () => {
    destroySortables();
    observer.disconnect();
    clearInterval(refreshInterval);
    document.removeEventListener('deck-cards-changed', handleStoreChange);
    if (prevCleanup) prevCleanup();
  };
}

function createToggleBtn(label) {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.style.cssText = `
    padding: 6px 12px; cursor: pointer;
    font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.15em; font-weight: 700;
  `;
  return btn;
}

function applyToggleActive(btn, active) {
  if (active) {
    btn.className = 'view-toggle-active';
    btn.style.background = 'var(--color-primary, #0D52BD)';
    btn.style.color = 'var(--color-text-primary, #EAECEE)';
    btn.style.border = 'none';
  } else {
    btn.className = 'view-toggle-inactive';
    btn.style.background = 'transparent';
    btn.style.color = 'var(--color-text-muted, #7A8498)';
    btn.style.border = '1px solid var(--color-border-ghost, #2A2D3A)';
  }
}

function createDisabledBtn(label) {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.disabled = true;
  btn.title = 'Coming soon';
  btn.style.cssText = `
    padding: 6px 12px; cursor: not-allowed; opacity: 0.4;
    font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.15em; font-weight: 700; background: transparent;
    color: var(--color-text-muted, #7A8498); border: 1px solid var(--color-border-ghost, #2A2D3A);
  `;
  return btn;
}
