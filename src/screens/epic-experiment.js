import Alpine from 'alpinejs';
import { renderSparkline } from '../utils/sparkline.js';
import { parseBatchLine } from '../services/mass-entry.js';
import { generateDailyInsight } from '../utils/insight-engine.js';
import { fetchSets, getCachedSets } from '../services/sets.js';
import { getActivity, logActivity } from '../services/activity.js';
import { renderEmptyState } from '../components/empty-state.js';
import { db } from '../db/schema.js';

/**
 * Epic Experiment -- Dashboard (command centre).
 * 7-panel layout: portfolio, deck grid, activity, Mila insight, alerts, releases.
 *
 * Phase 13 Plan 3 Task 5b (D-04 honest-empty-state patch): every interactive
 * control and CTA on this screen reflects `$store.bulkdata.status`. When the
 * archive is still downloading, Quick Add is disabled with `ARCHIVE LOADING`
 * copy, the two empty-state panels swap their CTAs for honest "tools unlock
 * when archive is ready" messaging, and commander art thumbnails skip the
 * `db.cards.get()` lookup entirely (so undefined `image_uris` never renders
 * as a broken <img>). The gate lives in `_isBulkDataReady()` so every branch
 * reads from a single source of truth; Alpine.effect subscriptions ensure the
 * dashboard re-renders when status flips to 'ready'.
 */

/**
 * Read Alpine.store('bulkdata').status with a safe 'ready' default. Used by
 * every gated branch below so that unit tests (no Alpine) and pre-boot walks
 * degrade to the normal UX instead of locking into the "loading" state.
 * @returns {boolean}
 */
function _isBulkDataReady() {
  try {
    const store = Alpine?.store?.('bulkdata');
    const status = store?.status ?? 'ready';
    return status === 'ready';
  } catch {
    return true;
  }
}

export function mount(container) {
  const cleanups = [];

  // Check if all panels are empty for full welcome state
  const collection = Alpine.store('collection');
  const deck = Alpine.store('deck');
  const market = Alpine.store('market');

  const allEmpty = collection.entries.length === 0
    && deck.decks.length === 0
    && (market?.pendingAlerts?.length || 0) === 0;

  if (allEmpty) {
    _renderFullWelcome(container);
  }

  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-3 gap-md p-md';
  container.appendChild(grid);

  renderPortfolioSummary(grid, cleanups);
  renderDeckLaunchGrid(grid, cleanups);
  renderActivityTimeline(grid, cleanups);
  renderMilaInsight(grid, cleanups);
  renderPriceAlerts(grid, cleanups);
  renderUpcomingReleases(grid, cleanups);

  container._cleanup = () => {
    cleanups.forEach(fn => fn());
  };
}

// ─── Full Welcome State ──────────────────────────────────────────
function _renderFullWelcome(container) {
  const welcome = document.createElement('div');
  welcome.className = 'bg-surface border border-border-ghost p-lg mb-md';
  welcome.innerHTML = `
    <div class="flex items-center gap-md">
      <img src="/assets/assetsmila-izzet.png" alt="Mila" class="w-12 h-12 object-cover">
      <div>
        <h2 class="font-header text-text-primary" style="font-size: 20px; font-weight: 700; line-height: 1.2; letter-spacing: 0.01em;">
          Welcome to Counterflux
        </h2>
        <p class="font-body text-text-muted mt-xs" style="font-size: 14px; line-height: 1.5;">
          Mila here! Your command centre is ready. Start by adding cards to your collection or building your first deck. Each panel will light up as your Archive grows.
        </p>
      </div>
    </div>
  `;
  container.appendChild(welcome);
}

// ─── Panel 1: Portfolio Summary (full width) ─────────────────────
function renderPortfolioSummary(grid, cleanups) {
  const panel = document.createElement('div');
  panel.className = 'col-span-3 bg-surface border border-border-ghost p-md';

  const overline = document.createElement('div');
  overline.className = 'font-mono text-primary mb-sm';
  overline.style.cssText = 'font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em;';
  overline.textContent = 'PORTFOLIO SUMMARY // AETHERFLOW';
  panel.appendChild(overline);

  const row = document.createElement('div');
  row.className = 'flex items-start gap-lg flex-wrap';
  panel.appendChild(row);

  // Left: value + counts
  const leftCol = document.createElement('div');
  leftCol.className = 'flex flex-col gap-xs min-w-[200px]';
  row.appendChild(leftCol);

  const totalLabel = document.createElement('div');
  totalLabel.className = 'font-mono text-primary';
  totalLabel.style.cssText = 'font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em;';
  totalLabel.textContent = 'TOTAL VALUE';
  leftCol.appendChild(totalLabel);

  const valueEl = document.createElement('div');
  valueEl.className = 'font-header text-text-primary';
  valueEl.style.cssText = 'font-size: 48px; font-weight: 700; line-height: 1.1; letter-spacing: -0.02em;';
  leftCol.appendChild(valueEl);

  const countsRow = document.createElement('div');
  countsRow.className = 'flex gap-md mt-xs';
  leftCol.appendChild(countsRow);

  const uniqueEl = document.createElement('span');
  uniqueEl.className = 'font-mono text-text-muted';
  uniqueEl.style.cssText = 'font-size: 11px; font-weight: 400; text-transform: uppercase; letter-spacing: 0.15em;';
  countsRow.appendChild(uniqueEl);

  const totalCountEl = document.createElement('span');
  totalCountEl.className = 'font-mono text-text-muted';
  totalCountEl.style.cssText = 'font-size: 11px; font-weight: 400; text-transform: uppercase; letter-spacing: 0.15em;';
  countsRow.appendChild(totalCountEl);

  // Middle: sparkline + change badge
  const midCol = document.createElement('div');
  midCol.className = 'flex flex-col items-center gap-xs flex-1';
  row.appendChild(midCol);

  const sparkContainer = document.createElement('div');
  midCol.appendChild(sparkContainer);

  const changeBadge = document.createElement('div');
  changeBadge.className = 'font-mono';
  changeBadge.style.cssText = 'font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; padding: 2px 8px;';
  midCol.appendChild(changeBadge);

  // Right: Quick Add
  const rightCol = document.createElement('div');
  rightCol.className = 'flex flex-col gap-sm flex-1 min-w-[280px] max-w-md';
  row.appendChild(rightCol);

  _buildQuickAdd(rightCol, cleanups);

  // Empty state overlay
  const emptyOverlay = document.createElement('div');
  emptyOverlay.className = 'mt-sm hidden';
  const emptyCopyReady = 'No Cards Yet &mdash; Add your first card using Quick Add above, or import a collection in Treasure Cruise.';
  const emptyCopyLoading = 'No Cards Yet &mdash; Archive is downloading. Card tools unlock when the archive finishes indexing.';
  emptyOverlay.innerHTML = `
    <p class="font-body text-text-muted" style="font-size: 14px; line-height: 1.5;">
      ${emptyCopyReady}
    </p>
  `;
  panel.appendChild(emptyOverlay);

  grid.appendChild(panel);

  // Task 5b: honest empty-state copy — swap the "Quick Add above" pointer for
  // an archive-loading message whenever bulkdata isn't ready, since Quick Add
  // is disabled in that state.
  function updateEmptyOverlayCopy() {
    const copy = _isBulkDataReady() ? emptyCopyReady : emptyCopyLoading;
    emptyOverlay.innerHTML = `
      <p class="font-body text-text-muted" style="font-size: 14px; line-height: 1.5;">
        ${copy}
      </p>
    `;
  }

  // Reactive updates
  function updatePortfolio() {
    const collection = Alpine.store('collection');
    const stats = collection.stats;
    const entries = collection.entries;

    if (entries.length === 0) {
      updateEmptyOverlayCopy();
      emptyOverlay.classList.remove('hidden');
      valueEl.textContent = '--';
      uniqueEl.textContent = 'UNIQUE 0';
      totalCountEl.textContent = 'TOTAL 0';
      sparkContainer.innerHTML = '';
      changeBadge.textContent = '';
      return;
    }

    emptyOverlay.classList.add('hidden');
    valueEl.textContent = window.__cf_eurToGbp ? window.__cf_eurToGbp(stats.estimatedValue) : `£${(stats.estimatedValue * 0.86).toFixed(2)}`;
    uniqueEl.textContent = `UNIQUE ${stats.uniqueCards}`;
    totalCountEl.textContent = `TOTAL ${stats.totalCards}`;

    // Sparkline from portfolio history
    _updateSparkline(sparkContainer, changeBadge, stats.estimatedValue);
  }

  const stopEffect = Alpine.effect(() => {
    // Touch reactive properties — collection entries drive the main values,
    // bulkdata.status drives the empty-state copy (Task 5b gating).
    const _ = Alpine.store('collection').entries.length;
    const __ = Alpine.store('bulkdata')?.status;
    updatePortfolio();
  });
  cleanups.push(() => { if (typeof stopEffect === 'function') stopEffect(); });

  // Initial portfolio history snapshot
  _snapshotPortfolioHistory();
}

async function _snapshotPortfolioHistory() {
  try {
    const collection = Alpine.store('collection');
    if (collection.entries.length === 0) return;

    const stats = collection.stats;
    const today = new Date().toISOString().slice(0, 10);
    const record = await db.meta.get('portfolio_history');
    const history = record?.data || [];

    // One entry per day
    const existingToday = history.find(h => h.date === today);
    if (!existingToday) {
      history.push({ date: today, value: stats.estimatedValue });
      // Cap at 90 entries
      if (history.length > 90) history.splice(0, history.length - 90);
      await db.meta.put({ key: 'portfolio_history', data: history });
    }
  } catch (e) {
    console.warn('[Dashboard] Portfolio history snapshot failed:', e);
  }
}

async function _updateSparkline(container, badge, currentValue) {
  try {
    const record = await db.meta.get('portfolio_history');
    const history = record?.data || [];

    if (history.length >= 2) {
      const values = history.map(h => h.value);
      const svg = renderSparkline(values, 200, 48);
      container.innerHTML = svg;

      // 7-day change
      const sevenDaysAgo = history.length >= 7 ? history[history.length - 7].value : history[0].value;
      const previous = sevenDaysAgo;
      if (previous > 0) {
        const change = ((currentValue - previous) / previous) * 100;
        const sign = change >= 0 ? '+' : '';
        badge.textContent = `${sign}${change.toFixed(1)}% 7D`;
        if (change > 0) {
          badge.style.background = 'rgba(13, 82, 189, 0.1)';
          badge.style.color = '#0D52BD';
        } else if (change < 0) {
          badge.style.background = 'rgba(226, 56, 56, 0.1)';
          badge.style.color = '#E23838';
        } else {
          badge.style.background = 'transparent';
          badge.style.color = '#7A8498';
        }
      } else {
        badge.textContent = '0.0% 7D';
        badge.style.background = 'transparent';
        badge.style.color = '#7A8498';
      }
    } else {
      container.innerHTML = '';
      badge.textContent = '';
    }
  } catch {
    container.innerHTML = '';
    badge.textContent = '';
  }
}

// ─── Quick Add Bar ───────────────────────────────────────────────
function _buildQuickAdd(parent, cleanups) {
  const qaLabel = document.createElement('div');
  qaLabel.className = 'font-mono text-primary';
  qaLabel.style.cssText = 'font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em;';
  qaLabel.textContent = 'QUICK ADD';
  parent.appendChild(qaLabel);

  const inputRow = document.createElement('div');
  inputRow.className = 'flex gap-sm items-center';
  parent.appendChild(inputRow);

  // Main input
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'flex-1 bg-surface-hover border border-border-ghost font-mono text-text-dim px-sm py-xs min-w-0';
  input.style.cssText = 'font-size: 11px;';
  input.placeholder = '4X LIGHTNING BOLT [2XM]';
  input.addEventListener('keydown', (e) => e.stopPropagation()); // prevent global / shortcut
  inputRow.appendChild(input);

  // Condition dropdown
  const condition = document.createElement('select');
  condition.className = 'bg-surface-hover border border-border-ghost font-mono px-xs py-xs shrink-0';
  condition.style.cssText = 'font-size: 11px; width: 52px;';
  ['NM', 'LP', 'MP', 'HP', 'DMG'].forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    condition.appendChild(opt);
  });
  inputRow.appendChild(condition);

  // Foil toggle
  const foilBtn = document.createElement('button');
  foilBtn.className = 'font-mono bg-surface-hover border border-border-ghost px-xs py-xs shrink-0';
  foilBtn.style.cssText = 'font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;';
  foilBtn.textContent = 'FOIL';
  let foilActive = false;
  foilBtn.addEventListener('click', () => {
    if (foilBtn.disabled) return;
    foilActive = !foilActive;
    foilBtn.style.background = foilActive ? 'rgba(13, 82, 189, 0.2)' : '';
    foilBtn.style.color = foilActive ? '#0D52BD' : '';
  });
  inputRow.appendChild(foilBtn);

  // Task 5b: Archive-loading helper copy — rendered below the input row
  // when bulk data is still downloading. Mirrors the D-05 skeleton tone
  // used in add-card-panel.js + deck-search-panel.js.
  const archiveHint = document.createElement('div');
  archiveHint.className = 'font-mono hidden';
  archiveHint.style.cssText = 'font-size: 11px; font-weight: 400; text-transform: uppercase; letter-spacing: 0.15em; color: #8A8F98;';
  archiveHint.textContent = 'ARCHIVE LOADING — QUICK ADD UNLOCKS AT 100%';
  parent.appendChild(archiveHint);

  // Task 5b: gate Quick Add on bulk-data readiness. When not ready, the
  // input, condition dropdown, and foil toggle are disabled + dimmed, and
  // the placeholder swaps to the archive-loading copy. When the download
  // finishes, the Alpine.effect subscription below flips everything back
  // to the normal UX — no page reload required.
  function updateQuickAddGate() {
    const ready = _isBulkDataReady();
    input.disabled = !ready;
    condition.disabled = !ready;
    foilBtn.disabled = !ready;
    if (ready) {
      input.placeholder = '4X LIGHTNING BOLT [2XM]';
      input.style.opacity = '';
      input.style.cursor = '';
      condition.style.opacity = '';
      condition.style.cursor = '';
      foilBtn.style.opacity = '';
      foilBtn.style.cursor = '';
      archiveHint.classList.add('hidden');
    } else {
      input.placeholder = 'ARCHIVE LOADING — QUICK ADD UNLOCKS AT 100%';
      input.style.opacity = '0.5';
      input.style.cursor = 'not-allowed';
      condition.style.opacity = '0.5';
      condition.style.cursor = 'not-allowed';
      foilBtn.style.opacity = '0.5';
      foilBtn.style.cursor = 'not-allowed';
      archiveHint.classList.remove('hidden');
    }
  }
  updateQuickAddGate();
  const stopGateEffect = Alpine.effect(() => {
    // Touch the reactive property so Alpine re-runs this when status changes.
    const _ = Alpine.store('bulkdata')?.status;
    updateQuickAddGate();
  });
  cleanups.push(() => { if (typeof stopGateEffect === 'function') stopGateEffect(); });

  // Autocomplete dropdown
  const dropdown = document.createElement('div');
  dropdown.className = 'bg-surface border border-border-ghost absolute z-50 hidden max-h-48 overflow-y-auto';
  dropdown.style.cssText = 'min-width: 300px;';
  parent.style.position = 'relative';
  parent.appendChild(dropdown);

  let debounceTimer = null;
  let selectedCard = null;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = input.value.trim();
    if (query.length < 2) {
      dropdown.classList.add('hidden');
      return;
    }
    debounceTimer = setTimeout(async () => {
      try {
        const results = await db.cards.where('name').startsWithIgnoreCase(query).limit(6).toArray();
        if (results.length === 0) {
          dropdown.classList.add('hidden');
          return;
        }
        dropdown.innerHTML = '';
        dropdown.classList.remove('hidden');
        results.forEach(card => {
          const item = document.createElement('div');
          item.className = 'px-sm py-xs hover:bg-surface-hover cursor-pointer flex items-center gap-sm';
          item.innerHTML = `
            <span class="font-body text-text-primary" style="font-size: 14px;">${card.name}</span>
            <span class="font-mono text-text-dim" style="font-size: 11px;">${(card.set || '').toUpperCase()}</span>
            <span class="text-text-muted" style="font-size: 12px;">${window.renderManaCost ? window.renderManaCost(card.mana_cost || '') : ''}</span>
          `;
          item.addEventListener('click', () => {
            selectedCard = card;
            input.value = card.name;
            dropdown.classList.add('hidden');
            _addCardFromQuickAdd(card, condition.value, foilActive, input);
          });
          dropdown.appendChild(item);
        });
      } catch {
        dropdown.classList.add('hidden');
      }
    }, 150);
  });

  // Focus styling
  input.addEventListener('focus', () => {
    input.style.borderColor = '#0D52BD';
    input.style.boxShadow = '0 0 0 1px #0D52BD';
  });
  input.addEventListener('blur', () => {
    input.style.borderColor = '';
    input.style.boxShadow = '';
    setTimeout(() => dropdown.classList.add('hidden'), 200);
  });

  // Enter to submit
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      dropdown.classList.add('hidden');
      if (selectedCard) {
        _addCardFromQuickAdd(selectedCard, condition.value, foilActive, input);
        selectedCard = null;
      } else {
        _parseAndAdd(input.value, condition.value, foilActive, input);
      }
    }
  });

  cleanups.push(() => clearTimeout(debounceTimer));
}

async function _addCardFromQuickAdd(card, condition, foil, input) {
  try {
    const collection = Alpine.store('collection');
    await collection.addCard(card.id, 1, foil, 'owned');

    Alpine.store('toast').success(`Added 1x ${card.name} to collection.`);
    await logActivity('card_added', `Added 1x ${card.name} to collection`, card.id);

    // Flash effect
    input.style.background = 'rgba(13, 82, 189, 0.1)';
    setTimeout(() => { input.style.background = ''; }, 300);

    input.value = '';
  } catch (err) {
    Alpine.store('toast').error(`Could not resolve "${input.value}". Check spelling or add a set code.`);
  }
}

async function _parseAndAdd(rawInput, condition, foil, input) {
  const parsed = parseBatchLine(rawInput);
  if (!parsed || !parsed.parsed) {
    Alpine.store('toast').error(`Could not resolve "${rawInput}". Check spelling or add a set code.`);
    return;
  }

  try {
    // Search for card by name
    const results = await db.cards.where('name').equalsIgnoreCase(parsed.name).limit(5).toArray();
    let card = null;

    if (parsed.setCode) {
      card = results.find(c => c.set === parsed.setCode.toLowerCase());
    }
    if (!card && results.length > 0) {
      card = results[0];
    }

    if (!card) {
      Alpine.store('toast').error(`Could not resolve "${rawInput}". Check spelling or add a set code.`);
      return;
    }

    const collection = Alpine.store('collection');
    await collection.addCard(card.id, parsed.quantity, foil || parsed.foil, 'owned');

    Alpine.store('toast').success(`Added ${parsed.quantity}x ${card.name} to collection.`);
    await logActivity('card_added', `Added ${parsed.quantity}x ${card.name} to collection`, card.id);

    input.style.background = 'rgba(13, 82, 189, 0.1)';
    setTimeout(() => { input.style.background = ''; }, 300);

    input.value = '';
  } catch (err) {
    Alpine.store('toast').error(`Could not resolve "${rawInput}". Check spelling or add a set code.`);
  }
}

// ─── Panel 2: Deck Quick-Launch Grid ─────────────────────────────
function renderDeckLaunchGrid(grid, cleanups) {
  const panel = document.createElement('div');
  panel.className = 'col-span-2 bg-surface border border-border-ghost p-md';

  const overline = document.createElement('div');
  overline.className = 'font-mono text-primary mb-sm';
  overline.style.cssText = 'font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em;';
  overline.textContent = 'COMMAND ZONE // DECKS';
  panel.appendChild(overline);

  const content = document.createElement('div');
  panel.appendChild(content);

  async function updateDeckGrid() {
    const deckStore = Alpine.store('deck');
    const allDecks = deckStore.decks;
    // Task 5b: read bulkdata status ONCE per update — drives both the empty
    // state copy and the commander-art thumbnail branch below.
    const bulkReady = _isBulkDataReady();

    if (allDecks.length === 0) {
      content.innerHTML = '';
      // No Decks Yet — swap body copy when bulk data not ready, since the
      // "Head to Thousand-Year Storm" CTA sends users to a screen that will
      // then show its own D-05 "Bulk data loading" placeholder (dead-end
      // loop per user smoke test).
      const noDecksBody = bulkReady
        ? 'Head to Thousand-Year Storm and initialize your first ritual.'
        : 'Archive is downloading. Deck tools unlock when the archive is ready.';
      renderEmptyState(content, {
        heading: 'No Decks Yet',
        body: noDecksBody,
      });
      return;
    }

    const topDecks = [...allDecks]
      .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
      .slice(0, 6);

    content.innerHTML = '';
    const deckGrid = document.createElement('div');
    deckGrid.className = 'grid grid-cols-3 gap-sm';
    content.appendChild(deckGrid);

    for (const deck of topDecks) {
      const tile = document.createElement('div');
      tile.className = 'bg-surface-hover border border-border-ghost p-sm cursor-pointer';
      tile.style.cssText = 'transition: border-color 0.15s, box-shadow 0.15s;';
      tile.addEventListener('mouseenter', () => {
        tile.style.borderColor = '#0D52BD';
        tile.style.boxShadow = '0 0 12px rgba(13, 82, 189, 0.3)';
      });
      tile.addEventListener('mouseleave', () => {
        tile.style.borderColor = '';
        tile.style.boxShadow = '';
      });

      // Commander art thumbnail
      const artContainer = document.createElement('div');
      artContainer.className = 'w-full overflow-hidden mb-xs';
      artContainer.style.height = '80px';

      // Task 5b: when bulkdata is still downloading, db.cards.get() returns
      // undefined → artUrl is undefined → <img src="undefined"> renders as
      // a broken image box (user smoke test). Skip the lookup entirely and
      // fall through to the surface-hover gradient placeholder. The effect
      // subscription at the bottom of this function re-runs updateDeckGrid
      // once bulkdata flips to 'ready', so real art appears after download.
      if (deck.commander_id && bulkReady) {
        try {
          const card = await db.cards.get(deck.commander_id);
          const artUrl = card?.image_uris?.art_crop || card?.card_faces?.[0]?.image_uris?.art_crop;
          if (artUrl) {
            const img = document.createElement('img');
            img.src = artUrl;
            img.alt = card.name || '';
            img.className = 'w-full h-full object-cover';
            img.style.transition = 'filter 0.15s';
            tile.addEventListener('mouseenter', () => { img.style.filter = 'brightness(1.1)'; });
            tile.addEventListener('mouseleave', () => { img.style.filter = ''; });
            artContainer.appendChild(img);
          } else {
            artContainer.style.background = 'linear-gradient(135deg, #14161C, #1C1F28)';
          }
        } catch {
          artContainer.style.background = 'linear-gradient(135deg, #14161C, #1C1F28)';
        }
      } else {
        // No commander_id OR bulkdata still loading — show the gradient
        // placeholder. Keeps the tile shape + spacing identical so there's
        // no layout shift when art lands.
        artContainer.style.background = 'linear-gradient(135deg, #14161C, #1C1F28)';
      }
      tile.appendChild(artContainer);

      // Deck name
      const nameEl = document.createElement('div');
      nameEl.className = 'font-mono text-text-primary overflow-hidden text-ellipsis whitespace-nowrap';
      nameEl.style.cssText = 'font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; max-width: 100%;';
      nameEl.textContent = deck.name?.slice(0, 24) || 'Untitled';
      tile.appendChild(nameEl);

      // Card count
      const countEl = document.createElement('div');
      countEl.className = 'font-mono text-text-muted';
      countEl.style.cssText = 'font-size: 11px; font-weight: 400; letter-spacing: 0.15em;';
      try {
        const deckCards = await db.deck_cards.where('deck_id').equals(deck.id).toArray();
        const cardCount = deckCards.reduce((sum, c) => sum + (c.quantity || 1), 0);
        const deckSize = deck.deck_size || 99;
        countEl.textContent = `${cardCount}/${deckSize}`;
      } catch {
        countEl.textContent = `0/${deck.deck_size || 99}`;
      }
      tile.appendChild(countEl);

      // Click to navigate
      tile.addEventListener('click', () => {
        if (window.__counterflux_router) {
          window.__counterflux_router.navigate('/thousand-year-storm');
        }
      });

      deckGrid.appendChild(tile);
    }

    // View all link
    const viewAll = document.createElement('a');
    viewAll.className = 'font-mono text-primary cursor-pointer mt-sm inline-block';
    viewAll.style.cssText = 'font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em;';
    viewAll.textContent = 'VIEW ALL DECKS';
    viewAll.addEventListener('click', () => {
      if (window.__counterflux_router) {
        window.__counterflux_router.navigate('/thousand-year-storm');
      }
    });
    content.appendChild(viewAll);
  }

  updateDeckGrid();

  const stopEffect = Alpine.effect(() => {
    // Task 5b: also touch bulkdata.status so the grid re-renders when the
    // archive finishes downloading (swaps skeleton placeholders for real
    // commander art + swaps the "No Decks Yet" body copy back to the
    // actionable CTA).
    const _ = Alpine.store('deck').decks.length;
    const __ = Alpine.store('bulkdata')?.status;
    updateDeckGrid();
  });
  cleanups.push(() => { if (typeof stopEffect === 'function') stopEffect(); });

  grid.appendChild(panel);
}

// ─── Panel 3: Activity Timeline ──────────────────────────────────
function renderActivityTimeline(grid, cleanups) {
  const panel = document.createElement('div');
  panel.className = 'bg-surface border border-border-ghost p-md';

  const overline = document.createElement('div');
  overline.className = 'font-mono text-primary mb-sm';
  overline.style.cssText = 'font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em;';
  overline.textContent = 'ACTIVITY LOG // RECENT';
  panel.appendChild(overline);

  const content = document.createElement('div');
  content.style.cssText = 'max-height: 320px; overflow-y: auto;';
  panel.appendChild(content);

  const ICON_MAP = {
    card_added: 'add_circle',
    card_removed: 'remove_circle',
    deck_created: 'auto_fix_high',
    deck_edited: 'edit',
    game_played: 'local_fire_department',
    watchlist_add: 'bookmark_add',
  };

  function formatRelativeTime(timestamp) {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function getDayLabel(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'TODAY';
    if (date.toDateString() === yesterday.toDateString()) return 'YESTERDAY';
    return date.toISOString().slice(0, 10);
  }

  async function updateTimeline() {
    try {
      const entries = await getActivity();

      if (entries.length === 0) {
        content.innerHTML = '';
        renderEmptyState(content, {
          heading: 'No Activity Yet',
          body: 'Your recent actions will appear here as you use the Archive.',
        });
        return;
      }

      content.innerHTML = '';
      const display = entries.slice(0, 20);
      let lastDay = '';

      display.forEach(entry => {
        const dayLabel = getDayLabel(entry.timestamp);
        if (dayLabel !== lastDay) {
          lastDay = dayLabel;
          const separator = document.createElement('div');
          separator.className = 'font-mono text-text-muted mt-sm mb-xs';
          separator.style.cssText = 'font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em;';
          separator.textContent = dayLabel;
          content.appendChild(separator);
        }

        const row = document.createElement('div');
        row.className = 'flex items-start gap-sm py-xs';

        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined text-text-muted';
        icon.style.cssText = 'font-size: 16px;';
        icon.textContent = ICON_MAP[entry.type] || 'info';
        row.appendChild(icon);

        const msgCol = document.createElement('div');
        msgCol.className = 'flex-1 min-w-0';
        const msg = document.createElement('div');
        msg.className = 'font-body text-text-primary truncate';
        msg.style.cssText = 'font-size: 14px; line-height: 1.5;';
        msg.textContent = entry.message;
        msgCol.appendChild(msg);
        row.appendChild(msgCol);

        const time = document.createElement('span');
        time.className = 'font-mono text-text-dim whitespace-nowrap';
        time.style.cssText = 'font-size: 11px; font-weight: 400; letter-spacing: 0.15em;';
        time.textContent = formatRelativeTime(entry.timestamp);
        row.appendChild(time);

        content.appendChild(row);
      });
    } catch {
      content.innerHTML = `<p class="font-body text-text-muted" style="font-size: 14px;">Could not load recent activity.</p>`;
    }
  }

  updateTimeline();
  // Refresh every 30 seconds
  const interval = setInterval(updateTimeline, 30000);
  cleanups.push(() => clearInterval(interval));

  grid.appendChild(panel);
}

// ─── Panel 4: Mila's Daily Insight ──────────────────────────────
function renderMilaInsight(grid, cleanups) {
  const panel = document.createElement('div');
  panel.className = 'bg-surface border border-border-ghost p-md';

  const overline = document.createElement('div');
  overline.className = 'font-mono text-primary mb-sm';
  overline.style.cssText = 'font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em;';
  overline.textContent = "MILA'S INSIGHT // DAILY";
  panel.appendChild(overline);

  const content = document.createElement('div');
  panel.appendChild(content);

  const CATEGORY_MAP = {
    synergy: 'UPGRADE',
    price: 'PRICE',
    collection: 'COLLECTION',
    deck: 'DECK',
  };

  async function loadInsight() {
    try {
      const insight = await generateDailyInsight();
      if (!insight) {
        content.innerHTML = `
          <p class="font-body text-text-muted" style="font-size: 14px; line-height: 1.5;">
            Mila is still gathering data. Add some cards or build a deck to unlock daily insights.
          </p>
        `;
        return;
      }

      const categoryLabel = CATEGORY_MAP[insight.category] || 'UPGRADE';

      content.innerHTML = `
        <div class="flex items-start gap-sm">
          <img src="/assets/assetsmila-izzet.png" alt="Mila" class="object-cover" style="width: 32px; height: 32px;">
          <div class="flex-1">
            <span class="font-mono inline-block mb-xs" style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; background: rgba(13, 82, 189, 0.1); color: #0D52BD; padding: 2px 8px;">
              ${categoryLabel}
            </span>
            <p class="font-body text-text-primary" style="font-size: 14px; line-height: 1.5;">
              ${insight.message}
            </p>
          </div>
        </div>
      `;
    } catch {
      content.innerHTML = `
        <p class="font-body text-text-muted" style="font-size: 14px; line-height: 1.5;">
          Mila is still gathering data. Add some cards or build a deck to unlock daily insights.
        </p>
      `;
    }
  }

  loadInsight();

  grid.appendChild(panel);
}

// ─── Panel 5: Price Alerts ───────────────────────────────────────
function renderPriceAlerts(grid, cleanups) {
  const panel = document.createElement('div');
  panel.className = 'bg-surface border border-border-ghost p-md';

  const overline = document.createElement('div');
  overline.className = 'font-mono text-primary mb-sm';
  overline.style.cssText = 'font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em;';
  overline.textContent = 'PRICE ALERTS // WATCHLIST';
  panel.appendChild(overline);

  const content = document.createElement('div');
  content.style.cssText = 'max-height: 280px; overflow-y: auto;';
  panel.appendChild(content);

  function updateAlerts() {
    const market = Alpine.store('market');
    const alerts = market?.pendingAlerts || [];

    if (alerts.length === 0) {
      content.innerHTML = `
        <p class="font-body text-text-muted" style="font-size: 14px; line-height: 1.5;">
          No triggered alerts. Set price targets in Preordain.
        </p>
      `;
      return;
    }

    content.innerHTML = '';
    alerts.forEach(alert => {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-sm py-xs';

      const nameEl = document.createElement('span');
      nameEl.className = 'font-body text-text-primary flex-1';
      nameEl.style.cssText = 'font-size: 14px;';
      nameEl.textContent = alert.card_name;
      row.appendChild(nameEl);

      const arrow = document.createElement('span');
      arrow.className = 'material-symbols-outlined';
      arrow.style.cssText = 'font-size: 16px;';
      if (alert.alert_type === 'above') {
        arrow.textContent = 'arrow_upward';
        arrow.style.color = '#2ECC71';
      } else {
        arrow.textContent = 'arrow_downward';
        arrow.style.color = '#E23838';
      }
      row.appendChild(arrow);

      const priceEl = document.createElement('span');
      priceEl.className = 'font-mono text-text-primary';
      priceEl.style.cssText = 'font-size: 11px; font-weight: 400; letter-spacing: 0.15em;';
      const gbpStr = window.__cf_eurToGbp ? `£${alert.current_price_gbp.toFixed(2)}` : `£${(alert.current_price_gbp || 0).toFixed(2)}`;
      priceEl.textContent = gbpStr;
      row.appendChild(priceEl);

      const threshEl = document.createElement('span');
      threshEl.className = 'font-mono text-text-dim';
      threshEl.style.cssText = 'font-size: 11px; font-weight: 400; letter-spacing: 0.15em;';
      threshEl.textContent = `(£${alert.alert_threshold?.toFixed(2) || '0.00'})`;
      row.appendChild(threshEl);

      content.appendChild(row);
    });
  }

  updateAlerts();

  const stopEffect = Alpine.effect(() => {
    const _ = Alpine.store('market')?.pendingAlerts?.length;
    updateAlerts();
  });
  cleanups.push(() => { if (typeof stopEffect === 'function') stopEffect(); });

  grid.appendChild(panel);
}

// ─── Panel 6: Upcoming Releases ──────────────────────────────────
function renderUpcomingReleases(grid, cleanups) {
  const panel = document.createElement('div');
  panel.className = 'bg-surface border border-border-ghost p-md';

  const overline = document.createElement('div');
  overline.className = 'font-mono text-primary mb-sm';
  overline.style.cssText = 'font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em;';
  overline.textContent = 'UPCOMING SETS // CALENDAR';
  panel.appendChild(overline);

  const content = document.createElement('div');
  panel.appendChild(content);

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  async function loadReleases() {
    try {
      let sets = getCachedSets();
      if (sets.length === 0) {
        sets = await fetchSets();
      }

      const today = new Date().toISOString().slice(0, 10);
      const upcoming = sets
        .filter(s => s.released_at > today)
        .sort((a, b) => a.released_at.localeCompare(b.released_at))
        .slice(0, 3);

      if (upcoming.length === 0) {
        content.innerHTML = `
          <p class="font-body text-text-muted" style="font-size: 14px; line-height: 1.5;">
            No upcoming releases found.
          </p>
        `;
        return;
      }

      content.innerHTML = '';
      upcoming.forEach(set => {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-sm py-xs';

        // Keyrune icon
        const icon = document.createElement('i');
        icon.className = `ss ss-${set.code.toLowerCase()} ss-fw`;
        icon.style.cssText = 'font-size: 20px; color: #7A8498;';
        row.appendChild(icon);

        const info = document.createElement('div');
        info.className = 'flex-1';

        const nameEl = document.createElement('div');
        nameEl.className = 'font-body text-text-primary';
        nameEl.style.cssText = 'font-size: 14px; font-weight: 700;';
        nameEl.textContent = set.name;
        info.appendChild(nameEl);

        const dateEl = document.createElement('div');
        dateEl.className = 'font-mono text-text-muted';
        dateEl.style.cssText = 'font-size: 11px; font-weight: 400; letter-spacing: 0.15em;';
        dateEl.textContent = formatDate(set.released_at);
        info.appendChild(dateEl);

        row.appendChild(info);
        content.appendChild(row);
      });
    } catch {
      content.innerHTML = `
        <p class="font-body text-text-muted" style="font-size: 14px; line-height: 1.5;">
          Unable to load upcoming releases. Check your connection.
        </p>
      `;
    }
  }

  loadReleases();

  grid.appendChild(panel);
}
