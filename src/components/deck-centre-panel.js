import { renderDeckCardTile } from './deck-card-tile.js';
import { TYPE_ORDER } from '../utils/type-classifier.js';
import Sortable from 'sortablejs';
import { openDeckImportModal } from './deck-import-modal.js';
import { openDeckExportModal } from './deck-export-modal.js';
import { createFilterDropdown, createColourPips } from './deck-filter-controls.js';
import { EMPTY_DECK_FILTER } from '../utils/deck-filter.js';

/**
 * Resolve the Commander card for the active deck.
 *
 * Per 09-CONTEXT D-07 + 09-RESEARCH P-9:
 * 1. Prefer `activeDeck.commander_id` (Phase 7 v8 row field, written by
 *    `src/stores/deck.js` createDeck()).
 * 2. Fall back to the first Legendary Creature/Planeswalker in
 *    `activeCards` whose `color_identity` is a SUBSET of the deck's
 *    aggregated colour-identity union — handles legacy v1.0 decks
 *    migrated from before the field existed.
 * 3. Return null if no candidate found (deck-centre-panel renders no
 *    Commander section in that case — graceful degradation).
 *
 * Returns the wrapping store entry `{ card, quantity, ... }` (NOT the raw
 * card) so callers can render via the same renderDeckCardTile path the
 * other type sections use.
 *
 * @param {Object} store - Alpine deck store ({ activeDeck, activeCards }).
 * @returns {Object|null} Entry wrapping the commander card, or null.
 */
function resolveCommanderEntry(store) {
  if (!store?.activeDeck || !Array.isArray(store?.activeCards)) return null;
  const entries = store.activeCards;
  if (entries.length === 0) return null;

  const cmdId = store.activeDeck.commander_id;
  if (cmdId) {
    const found = entries.find(
      (e) => e?.card?.id === cmdId || e?.scryfall_id === cmdId,
    );
    if (found) return found;
  }

  // Fallback: first Legendary Creature / Planeswalker matching the deck's
  // aggregated colour identity (per P-9). Allows users opening a legacy
  // pre-D-07 deck row (commander_id never written) to still see the
  // Commander section without re-saving the deck first.
  const deckColours = new Set();
  for (const e of entries) {
    for (const ci of (e?.card?.color_identity || [])) deckColours.add(ci);
  }
  const legendaryEntry = entries.find((e) => {
    const tl = (e?.card?.type_line || '').toLowerCase();
    if (!tl.includes('legendary')) return false;
    if (!tl.includes('creature') && !tl.includes('planeswalker')) return false;
    const cardColours = e?.card?.color_identity || [];
    return cardColours.every((c) => deckColours.has(c));
  });
  if (legendaryEntry) {
    // eslint-disable-next-line no-console
    console.warn(
      '[deck-centre-panel] commander_id missing on deck',
      store.activeDeck?.id,
      '— derived fallback:',
      legendaryEntry.card?.name,
    );
    return legendaryEntry;
  }
  return null;
}

/**
 * @typedef {Object} ActiveDeck
 * @property {string} id           UUID PK (Phase 7 v8 decks table; verified
 *                                 unindexed-but-stored row field).
 * @property {string} name
 * @property {string} format       Always 'commander' for v1.x.
 * @property {string|null} commander_id  Scryfall ID. NOT an indexed column on
 *                                 the v8/v9 decks declaration (see
 *                                 src/db/schema.js:312/395 — `decks: 'id, name,
 *                                 format, user_id, updated_at, synced_at'`),
 *                                 but Dexie accepts arbitrary row fields and
 *                                 src/stores/deck.js createDeck() writes it
 *                                 alongside the indexed columns. Per
 *                                 09-CONTEXT D-07 + 09-RESEARCH P-9, legacy
 *                                 v1.0 decks predating the field carry it as
 *                                 null; downstream consumers (DECK-05 commander
 *                                 section) must fall back to deriving the
 *                                 commander from the deck's first Legendary
 *                                 Creature/Planeswalker matching the deck's
 *                                 colour-identity union.
 * @property {string|null} partner_id
 * @property {string|null} companion_id
 * @property {string[]} color_identity
 * @property {string[]} tags
 * @property {number} deck_size
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * Deck centre panel -- the 99.
 * Shows cards grouped by type with grid/list views and SortableJS drag-and-drop.
 *
 * @param {HTMLElement} container - Mount target (flex-1 area)
 */
export function renderDeckCentrePanel(container) {
  const Alpine = window.Alpine;
  const store = Alpine?.store('deck');

  // Reset the in-deck filter so each deck opens unfiltered.
  if (store) store.deckFilter = { ...EMPTY_DECK_FILTER, colours: null };

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

  // Import/Export buttons
  const importBtn = createActionBtn('Import Decklist');
  importBtn.addEventListener('click', () => {
    if (store?.activeDeck?.id) openDeckImportModal(store.activeDeck.id);
  });
  const exportBtn = createActionBtn('Export Decklist');
  exportBtn.addEventListener('click', () => {
    openDeckExportModal();
  });
  controls.appendChild(importBtn);
  controls.appendChild(exportBtn);

  // Phase 18 — "Brew with AI" button. Visible only when the deck has a
  // commander set; clicking opens the Brew modal which calls the
  // /api/deckgen endpoint via $store.deckgen.startBrew(). Spacer pushes the
  // brew buttons to the right of the GRID/LIST/IMPORT/EXPORT controls.
  const brewSpacer = document.createElement('div');
  brewSpacer.style.cssText = 'flex: 1;';
  controls.appendChild(brewSpacer);

  const brewBtn = document.createElement('button');
  brewBtn.style.cssText = `
    font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.15em; font-weight: 700; cursor: pointer; padding: 8px 16px;
    background: rgba(13,82,189,0.12); color: #0D52BD; border: 1px solid rgba(13,82,189,0.6);
    display: inline-flex; align-items: center; gap: 8px;
    transition: background 120ms ease-out, border-color 120ms ease-out;
  `;
  // 260607-sec: build the icon + label via createElement instead of
  // innerHTML — consistent with the 260530-sec audit cleanup that
  // refactored similar inline icon+text patterns to safe DOM methods.
  const brewBtnIcon = document.createElement('span');
  brewBtnIcon.className = 'material-symbols-outlined';
  brewBtnIcon.style.fontSize = '16px';
  brewBtnIcon.textContent = 'auto_awesome';
  brewBtn.appendChild(brewBtnIcon);
  brewBtn.appendChild(document.createTextNode('BREW WITH AI'));
  brewBtn.onmouseenter = () => {
    brewBtn.style.background = 'rgba(13,82,189,0.25)';
    brewBtn.style.borderColor = '#0D52BD';
  };
  brewBtn.onmouseleave = () => {
    brewBtn.style.background = 'rgba(13,82,189,0.12)';
    brewBtn.style.borderColor = 'rgba(13,82,189,0.6)';
  };
  function updateBrewVisibility() {
    const hasCommander = !!(Alpine?.store('deck')?.activeDeck?.commander_id);
    brewBtn.style.display = hasCommander ? 'inline-flex' : 'none';
    // Phase 20 — retune button shares the same gate. We also require
    // the deck to have at least 10 cards beyond the commander, since
    // there's nothing to retune in an empty/near-empty deck.
    const cardCount = (Alpine?.store('deck')?.activeCards || []).length;
    const hasEnoughForRetune = hasCommander && cardCount > 10;
    if (typeof retuneBtn !== 'undefined') {
      retuneBtn.style.display = hasEnoughForRetune ? 'inline-flex' : 'none';
    }
    // v1.3.x — CHAT WITH MILA shares the commander gate (chat can brew from
    // a near-empty deck, so it only needs a commander, like the brew button).
    if (typeof chatBtn !== 'undefined') {
      chatBtn.style.display = hasCommander ? 'inline-flex' : 'none';
    }
  }
  brewBtn.addEventListener('click', () => {
    if (!Alpine?.store('deck')?.activeDeck?.commander_id) return;
    Alpine.store('deckgen')?.openBrewModal('build');
  });
  controls.appendChild(brewBtn);

  // Phase 20 — "RETUNE" button. Same visibility gate as the BREW
  // button (commander required) but opens the modal pre-set to
  // retune mode so the user gets surgical swap recommendations
  // toward a target power level rather than a fresh brew.
  const retuneBtn = document.createElement('button');
  retuneBtn.style.cssText = `
    font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.15em; font-weight: 700; cursor: pointer; padding: 8px 16px;
    background: transparent; color: #7A8498; border: 1px solid #2A2D3A;
    display: inline-flex; align-items: center; gap: 8px; margin-left: 8px;
    transition: color 120ms ease-out, border-color 120ms ease-out;
  `;
  const retuneBtnIcon = document.createElement('span');
  retuneBtnIcon.className = 'material-symbols-outlined';
  retuneBtnIcon.style.fontSize = '16px';
  retuneBtnIcon.textContent = 'tune';
  retuneBtn.appendChild(retuneBtnIcon);
  retuneBtn.appendChild(document.createTextNode('RETUNE'));
  retuneBtn.onmouseenter = () => {
    retuneBtn.style.color = '#EAECEE';
    retuneBtn.style.borderColor = '#0D52BD';
  };
  retuneBtn.onmouseleave = () => {
    retuneBtn.style.color = '#7A8498';
    retuneBtn.style.borderColor = '#2A2D3A';
  };
  retuneBtn.addEventListener('click', () => {
    if (!Alpine?.store('deck')?.activeDeck?.commander_id) return;
    Alpine.store('deckgen')?.openBrewModal('retune');
  });
  controls.appendChild(retuneBtn);

  // v1.3.x — "CHAT WITH MILA" button. Opens the conversational brew drawer.
  // Same commander gate as BREW; gated behind sign-in at click time because
  // the /api/deckgen-chat endpoint requires a Supabase JWT.
  const chatBtn = document.createElement('button');
  chatBtn.style.cssText = `
    font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.15em; font-weight: 700; cursor: pointer; padding: 8px 16px;
    background: transparent; color: #7A8498; border: 1px solid #2A2D3A;
    display: inline-flex; align-items: center; gap: 8px; margin-left: 8px;
    transition: color 120ms ease-out, border-color 120ms ease-out;
  `;
  const chatBtnIcon = document.createElement('span');
  chatBtnIcon.className = 'material-symbols-outlined';
  chatBtnIcon.style.fontSize = '16px';
  chatBtnIcon.textContent = 'forum';
  chatBtn.appendChild(chatBtnIcon);
  chatBtn.appendChild(document.createTextNode('BREW CHAT'));
  chatBtn.onmouseenter = () => {
    chatBtn.style.color = '#EAECEE';
    chatBtn.style.borderColor = '#0D52BD';
  };
  chatBtn.onmouseleave = () => {
    chatBtn.style.color = '#7A8498';
    chatBtn.style.borderColor = '#2A2D3A';
  };
  chatBtn.addEventListener('click', () => {
    const deck = Alpine?.store('deck')?.activeDeck;
    if (!deck?.commander_id) return;
    if (!Alpine?.store('auth')?.session) {
      Alpine?.store('toast')?.error?.('Sign in to use Brew Chat.');
      return;
    }
    const power = typeof deck.power_level === 'number' ? deck.power_level : 5;
    Alpine.store('deckgenChat')?.openChat({
      deckId: deck.id,
      commanderId: deck.commander_id,
      powerLevel: power,
    });
  });
  controls.appendChild(chatBtn);
  // Re-evaluate visibility whenever the deck loads / changes.
  let brewVisibilityEffect = null;
  if (Alpine && typeof Alpine.effect === 'function') {
    brewVisibilityEffect = Alpine.effect(() => {
      // Touch the reactive properties so the effect retriggers on change.
      // eslint-disable-next-line no-unused-vars
      const _deck = Alpine.store('deck')?.activeDeck;
      // eslint-disable-next-line no-unused-vars
      const _cmdr = Alpine.store('deck')?.activeDeck?.commander_id;
      updateBrewVisibility();
    });
  } else {
    updateBrewVisibility();
  }

  header.appendChild(controls);

  // Commander section — pinned above the filter row. The commander is
  // fixed once chosen, so it sits prominently at the top of the header
  // rather than inside the scrollable groups area. Re-rendered each
  // refresh() by renderGroups(); empty when there's no commander.
  const commanderHeaderEl = document.createElement('div');
  header.appendChild(commanderHeaderEl);

  // Filter row: Type / Mana / Owned / Colour — mirrors the add panel's style.
  // Wires each control to the store's deckFilter then refreshes; the
  // groupedByType getter (part A) applies the matcher.
  const filterRow = document.createElement('div');
  filterRow.style.cssText = 'display: flex; align-items: flex-end; gap: 8px; flex-wrap: wrap; flex-shrink: 0;';

  let colourSet = new Set();
  const typeSel = createFilterDropdown('TYPE', ['All','Creature','Instant','Sorcery','Enchantment','Artifact','Planeswalker','Land'], (v) => { store?.setDeckFilter({ type: v }); refresh(); });
  const cmcSel  = createFilterDropdown('MANA', ['All','0','1','2','3','4','5','6','7+'], (v) => { store?.setDeckFilter({ cmc: v }); refresh(); });
  const ownSel  = createFilterDropdown('OWNED', ['All','Owned','Missing'], (v) => { store?.setDeckFilter({ owned: v }); refresh(); });
  const colourPips = createColourPips(() => colourSet, (next) => { colourSet = next; store?.setDeckFilter({ colours: next.size ? next : null }); refresh(); });

  filterRow.appendChild(typeSel);
  filterRow.appendChild(cmcSel);
  filterRow.appendChild(ownSel);
  const pipWrap = document.createElement('div');
  pipWrap.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
  const pipLabel = document.createElement('span');
  pipLabel.textContent = 'COLOUR';
  pipLabel.style.cssText = "font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #7A8498;";
  pipWrap.appendChild(pipLabel);
  pipWrap.appendChild(colourPips);
  filterRow.appendChild(pipWrap);
  header.appendChild(filterRow);

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
    commanderHeaderEl.innerHTML = '';

    if (!store) return;
    const grouped = store.groupedByType;
    const viewMode = store.viewMode || 'grid';

    // === DECK-05: Commander as own type category (per 09-CONTEXT D-07) ===
    // Render the COMMANDER section into the pinned commanderHeaderEl (above
    // the filter row) rather than the scrollable groups area. The commander
    // entry is also suppressed from the regular Creature group below to
    // avoid double rendering — `commanderEntryId` is the lookup key.
    const commanderEntry = resolveCommanderEntry(store);
    const commanderEntryId = commanderEntry?.id ?? null;
    if (commanderEntry) {
      const cmdGroup = document.createElement('div');
      cmdGroup.dataset.typeGroup = 'Commander';
      cmdGroup.dataset.commanderSection = 'true';

      const cmdHeader = document.createElement('div');
      cmdHeader.style.cssText = `
        display: flex; align-items: center; gap: 8px;
        padding: 8px 0; user-select: none;
      `;

      const cmdLabel = document.createElement('span');
      cmdLabel.style.cssText = `
        font-family: 'JetBrains Mono', monospace; font-size: 11px;
        text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700;
        color: #0D52BD;
      `;
      cmdLabel.textContent = `COMMANDER (1)`;
      cmdHeader.appendChild(cmdLabel);
      cmdGroup.appendChild(cmdHeader);

      const cmdBody = document.createElement('div');
      cmdBody.dataset.commanderBody = 'true';
      // Commander tile uses the same render path as other groups so the
      // hover affordances + context menu wiring stay consistent. The
      // commander tile is intentionally NOT registered with SortableJS
      // (commanders aren't draggable into other type sections — moving a
      // commander card around is meaningless).
      // v1.2 hot-fix: pass `_compact: true` so the commander tile caps at
      // 180px instead of stretching to the grid track. The commander is a
      // single card; making it the same size as the 99 wastes vertical
      // real-estate above the rest of the deck.
      const cmdTile = renderDeckCardTile({ ...commanderEntry, _compact: true }, { mode: viewMode });
      if (cmdTile) cmdBody.appendChild(cmdTile);
      cmdGroup.appendChild(cmdBody);

      commanderHeaderEl.appendChild(cmdGroup);
    }

    for (const type of TYPE_ORDER) {
      const groupCards = grouped[type];
      if (!groupCards || groupCards.length === 0) continue;
      // Filter out the commander so it doesn't double-render in the
      // Creature (or Planeswalker) group below.
      const cards = commanderEntryId
        ? groupCards.filter((e) => e?.id !== commanderEntryId)
        : groupCards;
      if (cards.length === 0) continue;

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
      // v1.2 hot-fix: count by quantity, not unique cards. 28 Mountains
      // should display as LANDS (28), not LANDS (1). The analytics layer
      // already aggregates by quantity (deck-analytics.js multiplies by
      // qty everywhere); this header was the last surface using `.length`.
      const countByQty = cards.reduce((sum, c) => sum + (c.quantity || 1), 0);
      headerLabel.textContent = `${type.toUpperCase()}S (${countByQty})`;
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
        // v1.2 hot-fix: drag-and-drop reordering removed per user request.
        // SortableJS init was causing intermittent TypeError null-options
        // crashes (see git history) and reordering wasn't a load-bearing
        // feature — the deck displays cards grouped by type, not by sort
        // order. If reordering returns later, also revisit search-panel DnD.
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

  // Reactive re-render via Alpine.effect() — triggers when activeCards changes
  let effectCleanup = null;
  if (Alpine && store) {
    let lastCardCount = -1;
    effectCleanup = Alpine.effect(() => {
      // Touch reactive properties to register dependency tracking
      const cards = store.activeCards;
      const len = cards?.length ?? 0;
      const deck = store.activeDeck;
      const vm = store.viewMode;
      // Skip the initial run (already rendered above)
      if (lastCardCount === -1) {
        lastCardCount = len;
        return;
      }
      // Re-render on any change
      lastCardCount = len;
      requestAnimationFrame(() => {
        refresh();
        setTimeout(setupSearchDragSource, 50);
      });
    });
  }

  // Cleanup
  const prevCleanup = container._centreCleanup;
  container._centreCleanup = () => {
    destroySortables();
    observer.disconnect();
    if (effectCleanup && typeof effectCleanup === 'function') effectCleanup();
    // Phase 18 — tear down the Brew-button visibility effect so we don't
    // leak a reactive subscription after route navigation.
    if (brewVisibilityEffect && typeof Alpine?.release === 'function') {
      try { Alpine.release(brewVisibilityEffect); } catch {}
    }
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

function createActionBtn(label) {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.style.cssText = `
    padding: 6px 12px; cursor: pointer;
    font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.15em; font-weight: 700; background: transparent;
    color: var(--color-text-muted, #7A8498); border: 1px solid var(--color-border-ghost, #2A2D3A);
  `;
  return btn;
}
