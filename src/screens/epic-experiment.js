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
 */
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
          Welcome to Epic Experiment
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
  row.className = 'flex items-start gap-lg';
  panel.appendChild(row);

  // Left: value + counts
  const leftCol = document.createElement('div');
  leftCol.className = 'flex flex-col gap-xs';
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
  rightCol.className = 'flex flex-col gap-sm flex-1 max-w-md';
  row.appendChild(rightCol);

  _buildQuickAdd(rightCol, cleanups);

  // Empty state overlay
  const emptyOverlay = document.createElement('div');
  emptyOverlay.className = 'mt-sm hidden';
  emptyOverlay.innerHTML = `
    <p class="font-body text-text-muted" style="font-size: 14px; line-height: 1.5;">
      No Cards Yet &mdash; Add your first card using Quick Add above, or import a collection in Treasure Cruise.
    </p>
  `;
  panel.appendChild(emptyOverlay);

  grid.appendChild(panel);

  // Reactive updates
  function updatePortfolio() {
    const collection = Alpine.store('collection');
    const stats = collection.stats;
    const entries = collection.entries;

    if (entries.length === 0) {
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
    // Touch reactive properties
    const _ = Alpine.store('collection').entries.length;
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
  input.className = 'flex-1 bg-surface-hover border border-border-ghost font-mono text-text-dim px-sm py-xs';
  input.style.cssText = 'font-size: 11px;';
  input.placeholder = 'QUICK ADD \u2014 4X LIGHTNING BOLT [2XM]';
  input.addEventListener('keydown', (e) => e.stopPropagation()); // prevent global / shortcut
  inputRow.appendChild(input);

  // Condition dropdown
  const condition = document.createElement('select');
  condition.className = 'bg-surface-hover border border-border-ghost font-mono px-sm py-xs';
  condition.style.cssText = 'font-size: 11px;';
  ['NM', 'LP', 'MP', 'HP', 'DMG'].forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    condition.appendChild(opt);
  });
  inputRow.appendChild(condition);

  // Foil toggle
  const foilBtn = document.createElement('button');
  foilBtn.className = 'font-mono bg-surface-hover border border-border-ghost px-sm py-xs';
  foilBtn.style.cssText = 'font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em;';
  foilBtn.textContent = 'FOIL';
  let foilActive = false;
  foilBtn.addEventListener('click', () => {
    foilActive = !foilActive;
    foilBtn.style.background = foilActive ? 'rgba(13, 82, 189, 0.2)' : '';
    foilBtn.style.color = foilActive ? '#0D52BD' : '';
  });
  inputRow.appendChild(foilBtn);

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

// ─── Panel 2: Deck Quick-Launch Grid (stub) ──────────────────────
function renderDeckLaunchGrid(grid, cleanups) {
  const panel = document.createElement('div');
  panel.className = 'col-span-2 bg-surface border border-border-ghost p-md';

  const overline = document.createElement('div');
  overline.className = 'font-mono text-primary mb-sm';
  overline.style.cssText = 'font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em;';
  overline.textContent = 'COMMAND ZONE // DECKS';
  panel.appendChild(overline);

  const content = document.createElement('div');
  content.id = 'deck-launch-content';
  panel.appendChild(content);

  // Stub: empty state
  const decks = Alpine.store('deck').decks;
  if (decks.length === 0) {
    renderEmptyState(content, {
      heading: 'No Decks Yet',
      body: 'Head to Thousand-Year Storm and initialize your first ritual.',
    });
  }

  grid.appendChild(panel);
}

// ─── Panel 3: Activity Timeline (stub) ───────────────────────────
function renderActivityTimeline(grid, cleanups) {
  const panel = document.createElement('div');
  panel.className = 'bg-surface border border-border-ghost p-md';

  const overline = document.createElement('div');
  overline.className = 'font-mono text-primary mb-sm';
  overline.style.cssText = 'font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em;';
  overline.textContent = 'ACTIVITY LOG // RECENT';
  panel.appendChild(overline);

  const content = document.createElement('div');
  content.id = 'activity-content';
  renderEmptyState(content, {
    heading: 'No Activity Yet',
    body: 'Your recent actions will appear here as you use the Archive.',
  });
  panel.appendChild(content);

  grid.appendChild(panel);
}

// ─── Panel 4: Mila's Daily Insight (stub) ────────────────────────
function renderMilaInsight(grid, cleanups) {
  const panel = document.createElement('div');
  panel.className = 'bg-surface border border-border-ghost p-md';

  const overline = document.createElement('div');
  overline.className = 'font-mono text-primary mb-sm';
  overline.style.cssText = 'font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em;';
  overline.textContent = "MILA'S INSIGHT // DAILY";
  panel.appendChild(overline);

  const content = document.createElement('div');
  content.id = 'mila-insight-content';
  content.innerHTML = `
    <p class="font-body text-text-muted" style="font-size: 14px; line-height: 1.5;">
      Mila is still gathering data. Add some cards or build a deck to unlock daily insights.
    </p>
  `;
  panel.appendChild(content);

  grid.appendChild(panel);
}

// ─── Panel 5: Price Alerts (stub) ────────────────────────────────
function renderPriceAlerts(grid, cleanups) {
  const panel = document.createElement('div');
  panel.className = 'bg-surface border border-border-ghost p-md';

  const overline = document.createElement('div');
  overline.className = 'font-mono text-primary mb-sm';
  overline.style.cssText = 'font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em;';
  overline.textContent = 'PRICE ALERTS // WATCHLIST';
  panel.appendChild(overline);

  const content = document.createElement('div');
  content.id = 'price-alerts-content';
  content.innerHTML = `
    <p class="font-body text-text-muted" style="font-size: 14px; line-height: 1.5;">
      No triggered alerts. Set price targets in Preordain.
    </p>
  `;
  panel.appendChild(content);

  grid.appendChild(panel);
}

// ─── Panel 6: Upcoming Releases (stub) ───────────────────────────
function renderUpcomingReleases(grid, cleanups) {
  const panel = document.createElement('div');
  panel.className = 'bg-surface border border-border-ghost p-md';

  const overline = document.createElement('div');
  overline.className = 'font-mono text-primary mb-sm';
  overline.style.cssText = 'font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em;';
  overline.textContent = 'UPCOMING SETS // CALENDAR';
  panel.appendChild(overline);

  const content = document.createElement('div');
  content.id = 'releases-content';
  content.innerHTML = `
    <p class="font-body text-text-muted" style="font-size: 14px; line-height: 1.5;">
      No upcoming releases found.
    </p>
  `;
  panel.appendChild(content);

  grid.appendChild(panel);
}
