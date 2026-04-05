/**
 * Deck analytics sidebar panel.
 * Renders mana curve, colour distribution, type breakdown,
 * functional tags, price summary, and salt score placeholder.
 * All charts live-update via Alpine.effect() within 100ms.
 */

import { Chart } from 'chart.js';
import { TYPE_ORDER } from '../utils/type-classifier.js';
// Prices from deck-analytics.js are already in GBP (via eurToGbpValue).
// We format directly with formatGbp() below.

// MTG colour hex map (matches analytics-panel.js convention + colourless)
const MTG_COLOURS = {
  W: { label: 'White', hex: '#F9FAF4', icon: 'ms ms-w' },
  U: { label: 'Blue', hex: '#0E68AB', icon: 'ms ms-u' },
  B: { label: 'Black', hex: '#150B00', icon: 'ms ms-b' },
  R: { label: 'Red', hex: '#D3202A', icon: 'ms ms-r' },
  G: { label: 'Green', hex: '#00733E', icon: 'ms ms-g' },
  C: { label: 'Colourless', hex: '#98989D', icon: 'ms ms-c' },
};

// Chart.js shared options (Organic Brutalism design system)
const CHART_TOOLTIP = {
  backgroundColor: '#1C1F28',
  borderColor: '#2A2D3A',
  borderWidth: 1,
  titleFont: { family: "'JetBrains Mono'", size: 11 },
  bodyFont: { family: "'JetBrains Mono'", size: 11 },
  bodyColor: '#EAECEE',
  titleColor: '#EAECEE',
};

const CHART_ANIMATION = { duration: 300, easing: 'easeOutQuart' };

// Style constants
const LABEL_STYLE = "font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em;";
const LABEL_700 = `${LABEL_STYLE} font-weight: 700;`;
const LABEL_400 = `${LABEL_STYLE} font-weight: 400;`;

// Chart instances for lifecycle management
let manaCurveChart = null;
let colourPieChart = null;
let updateFrameId = null;

/**
 * Create a section header element.
 * @param {string} text
 * @returns {HTMLElement}
 */
function createSectionHeader(text) {
  const el = document.createElement('div');
  el.style.cssText = `${LABEL_700} color: #EAECEE; margin-bottom: 12px;`;
  el.textContent = text;
  return el;
}

/**
 * Create a canvas element for Chart.js.
 * @returns {HTMLCanvasElement}
 */
function createCanvas() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width: 100%; max-height: 180px;';
  return canvas;
}

/**
 * Create or update the mana curve bar chart.
 * @param {HTMLCanvasElement} canvas
 * @param {Object} manaCurve - { 0:n, 1:n, ..., '7+':n }
 * @param {number} averageCmc
 */
function renderManaCurveChart(canvas, manaCurve, averageCmc) {
  const labels = ['0', '1', '2', '3', '4', '5', '6', '7+'];
  const data = labels.map(l => manaCurve[l] || 0);

  if (manaCurveChart) {
    manaCurveChart.data.datasets[0].data = data;
    manaCurveChart.update('none');
    return;
  }

  manaCurveChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: '#0D52BD',
        borderRadius: 0,
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...CHART_TOOLTIP,
          callbacks: {
            title: (items) => `CMC ${items[0].label}`,
            label: (item) => `${item.raw} cards`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            font: { family: "'JetBrains Mono'", size: 11, weight: 400 },
            color: '#7A8498',
          },
          grid: { color: 'rgba(42, 45, 58, 0.3)' },
        },
        y: {
          ticks: {
            font: { family: "'JetBrains Mono'", size: 11, weight: 400 },
            color: '#7A8498',
            stepSize: 1,
          },
          grid: { color: 'rgba(42, 45, 58, 0.3)' },
        },
      },
      animation: CHART_ANIMATION,
    },
  });
}

/**
 * Create or update the colour distribution doughnut chart.
 * @param {HTMLCanvasElement} canvas
 * @param {Object} colourPie - { W:n, U:n, B:n, R:n, G:n, C:n }
 */
function renderColourPieChart(canvas, colourPie) {
  // Only show colours with count > 0
  const activeColours = Object.entries(MTG_COLOURS).filter(([k]) => (colourPie[k] || 0) > 0);
  const labels = activeColours.map(([, v]) => v.label);
  const data = activeColours.map(([k]) => colourPie[k] || 0);
  const bgColors = activeColours.map(([, v]) => v.hex);
  const total = data.reduce((s, v) => s + v, 0);

  if (colourPieChart) {
    colourPieChart.data.labels = labels;
    colourPieChart.data.datasets[0].data = data;
    colourPieChart.data.datasets[0].backgroundColor = bgColors;
    colourPieChart.update('none');
    return;
  }

  // If no data, skip creation
  if (total === 0) return;

  colourPieChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: bgColors,
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...CHART_TOOLTIP,
          callbacks: {
            label: (item) => {
              const pct = total > 0 ? ((item.raw / total) * 100).toFixed(1) : 0;
              return `${item.label}: ${item.raw} (${pct}%)`;
            },
          },
        },
      },
      animation: CHART_ANIMATION,
    },
  });
}

/**
 * Render type breakdown as CSS horizontal bars.
 * @param {HTMLElement} container
 * @param {Object} typeBreakdown - { Creature:n, Instant:n, ... }
 */
function renderTypeBreakdown(container, typeBreakdown) {
  container.innerHTML = '';
  const maxCount = Math.max(1, ...Object.values(typeBreakdown));

  for (const type of TYPE_ORDER) {
    const count = typeBreakdown[type] || 0;
    if (count === 0) continue;

    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 6px;';

    const nameEl = document.createElement('span');
    nameEl.style.cssText = `${LABEL_700} color: #EAECEE; width: 100px; flex-shrink: 0;`;
    nameEl.textContent = type;

    const countEl = document.createElement('span');
    countEl.style.cssText = `${LABEL_400} color: #7A8498; width: 24px; text-align: right; flex-shrink: 0;`;
    countEl.textContent = count;

    const barBg = document.createElement('div');
    barBg.style.cssText = 'flex: 1; height: 8px; background: rgba(42, 45, 58, 0.3);';

    const barFill = document.createElement('div');
    const pct = (count / maxCount) * 100;
    barFill.style.cssText = `width: ${pct}%; height: 100%; background: rgba(13, 82, 189, 0.3); transition: width 200ms ease;`;
    barBg.appendChild(barFill);

    row.appendChild(nameEl);
    row.appendChild(countEl);
    row.appendChild(barBg);
    container.appendChild(row);
  }
}

/**
 * Render functional tag breakdown as CSS bars.
 * @param {HTMLElement} container
 * @param {Object} tagBreakdown - { Ramp:n, 'Card Draw':n, ... }
 * @param {Array} deckTags - ordered tag list from activeDeck.tags
 * @param {number} totalCards - total cards in deck
 */
function renderTagBreakdown(container, tagBreakdown, deckTags, totalCards) {
  container.innerHTML = '';
  const tags = deckTags && deckTags.length > 0 ? deckTags : Object.keys(tagBreakdown);
  const maxCount = Math.max(1, totalCards || 1);

  for (const tag of tags) {
    const count = tagBreakdown[tag] || 0;

    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 6px;';

    const nameEl = document.createElement('span');
    nameEl.style.cssText = `${LABEL_400} color: #EAECEE; width: 100px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
    nameEl.textContent = tag;

    const countEl = document.createElement('span');
    countEl.style.cssText = `${LABEL_400} color: #7A8498; width: 24px; text-align: right; flex-shrink: 0;`;
    countEl.textContent = count;

    const barBg = document.createElement('div');
    barBg.style.cssText = 'flex: 1; height: 8px; background: rgba(42, 45, 58, 0.3);';

    const barFill = document.createElement('div');
    const pct = (count / maxCount) * 100;
    barFill.style.cssText = `width: ${pct}%; height: 100%; background: rgba(13, 82, 189, 0.2); transition: width 200ms ease;`;
    barBg.appendChild(barFill);

    row.appendChild(nameEl);
    row.appendChild(countEl);
    row.appendChild(barBg);
    container.appendChild(row);
  }
}

/**
 * Format a GBP value directly (prices from analytics are already GBP).
 * @param {number} gbpValue
 * @returns {string}
 */
function formatGbp(gbpValue) {
  if (!gbpValue || isNaN(gbpValue) || gbpValue === 0) return '--';
  return '\u00A3' + gbpValue.toFixed(2);
}

/**
 * Render the full analytics sidebar into a container element.
 * Sets up Alpine.effect() for reactive updates.
 *
 * @param {HTMLElement} container - The right panel element
 */
export function renderDeckAnalyticsPanel(container) {
  const Alpine = window.Alpine;
  const store = Alpine?.store('deck');

  // --- Section 1: Mana Curve ---
  const curveSection = document.createElement('div');
  curveSection.style.cssText = 'margin-bottom: 24px;';
  curveSection.appendChild(createSectionHeader('MANA CURVE'));

  const curveCanvas = createCanvas();
  curveSection.appendChild(curveCanvas);

  const avgCmcEl = document.createElement('div');
  avgCmcEl.style.cssText = `${LABEL_400} color: #7A8498; margin-top: 8px;`;
  avgCmcEl.textContent = 'AVG CMC: 0.00';
  curveSection.appendChild(avgCmcEl);

  container.appendChild(curveSection);

  // --- Section 2: Colour Distribution ---
  const colourSection = document.createElement('div');
  colourSection.style.cssText = 'margin-bottom: 24px;';
  colourSection.appendChild(createSectionHeader('COLOUR DISTRIBUTION'));

  const colourCanvas = createCanvas();
  colourSection.appendChild(colourCanvas);

  const manaIconRow = document.createElement('div');
  manaIconRow.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;';
  colourSection.appendChild(manaIconRow);

  container.appendChild(colourSection);

  // --- Section 3: Type Breakdown ---
  const typeSection = document.createElement('div');
  typeSection.style.cssText = 'margin-bottom: 24px;';
  typeSection.appendChild(createSectionHeader('TYPE BREAKDOWN'));

  const typeBarsContainer = document.createElement('div');
  typeSection.appendChild(typeBarsContainer);

  container.appendChild(typeSection);

  // --- Section 4: Functional Tags ---
  const tagSection = document.createElement('div');
  tagSection.style.cssText = 'margin-bottom: 24px;';
  tagSection.appendChild(createSectionHeader('FUNCTIONAL TAGS'));

  const tagBarsContainer = document.createElement('div');
  tagSection.appendChild(tagBarsContainer);

  container.appendChild(tagSection);

  // --- Section 5: Price Summary ---
  const priceSection = document.createElement('div');
  priceSection.style.cssText = 'margin-bottom: 24px;';
  priceSection.appendChild(createSectionHeader('PRICE SUMMARY'));

  const priceContainer = document.createElement('div');
  priceSection.appendChild(priceContainer);

  container.appendChild(priceSection);

  // --- Section 6: Salt Score Placeholder ---
  const saltSection = document.createElement('div');
  saltSection.style.cssText = 'margin-bottom: 24px;';
  saltSection.appendChild(createSectionHeader('SALT SCORE'));

  const saltPlaceholder = document.createElement('div');
  saltPlaceholder.style.cssText = `${LABEL_400} color: #4A5064;`;
  saltPlaceholder.textContent = 'COMING IN PHASE 4';
  saltSection.appendChild(saltPlaceholder);

  container.appendChild(saltSection);

  // --- Reactive update function ---
  function updateAllSections() {
    const analytics = store?.analytics;
    if (!analytics) return;

    // Mana curve
    renderManaCurveChart(curveCanvas, analytics.manaCurve, analytics.averageCmc);
    avgCmcEl.textContent = `AVG CMC: ${(analytics.averageCmc || 0).toFixed(2)}`;

    // Colour pie
    renderColourPieChart(colourCanvas, analytics.colourPie);

    // Mana icon row below colour pie
    manaIconRow.innerHTML = '';
    for (const [key, meta] of Object.entries(MTG_COLOURS)) {
      const count = analytics.colourPie[key] || 0;
      if (count === 0) continue;
      const iconSpan = document.createElement('span');
      iconSpan.style.cssText = `${LABEL_400} color: #7A8498; display: inline-flex; align-items: center; gap: 4px;`;
      iconSpan.innerHTML = `<i class="${meta.icon}" style="font-size: 14px;"></i> ${count}`;
      manaIconRow.appendChild(iconSpan);
    }

    // Type breakdown
    renderTypeBreakdown(typeBarsContainer, analytics.typeBreakdown);

    // Tag breakdown
    const deckTags = store?.activeDeck?.tags || [];
    const totalCards = store?.activeCards?.length || 0;
    renderTagBreakdown(tagBarsContainer, analytics.tagBreakdown, deckTags, totalCards);

    // Price summary (values are already in GBP from deck-analytics.js)
    priceContainer.innerHTML = '';

    const totalEl = document.createElement('div');
    totalEl.style.cssText = `${LABEL_700} color: #EAECEE; margin-bottom: 8px;`;
    totalEl.textContent = `TOTAL COST: ${formatGbp(analytics.totalPrice)}`;
    priceContainer.appendChild(totalEl);

    if (analytics.unownedPrice > 0) {
      const unownedEl = document.createElement('div');
      unownedEl.style.cssText = `${LABEL_400} color: #7A8498; margin-bottom: 8px;`;
      unownedEl.textContent = `UNOWNED COST: ${formatGbp(analytics.unownedPrice)}`;
      priceContainer.appendChild(unownedEl);
    }

    if (analytics.mostExpensive && analytics.mostExpensive.price > 0) {
      const highEl = document.createElement('div');
      highEl.style.cssText = `${LABEL_400} color: #7A8498;`;
      highEl.textContent = `HIGHEST: ${analytics.mostExpensive.name} (${formatGbp(analytics.mostExpensive.price)})`;
      priceContainer.appendChild(highEl);
    }
  }

  // Initial render
  updateAllSections();

  // Reactive updates via Alpine.effect() with requestAnimationFrame batching
  let effectCleanup = null;
  if (Alpine && store) {
    effectCleanup = Alpine.effect(() => {
      // Touch the analytics getter to register reactivity
      const _analytics = store.analytics;
      // Batch updates via requestAnimationFrame
      if (updateFrameId) cancelAnimationFrame(updateFrameId);
      updateFrameId = requestAnimationFrame(() => {
        updateAllSections();
        updateFrameId = null;
      });
    });
  }

  // Store cleanup reference on container
  container._analyticsCleanup = () => {
    if (effectCleanup && typeof effectCleanup === 'function') {
      effectCleanup();
    }
    if (updateFrameId) {
      cancelAnimationFrame(updateFrameId);
      updateFrameId = null;
    }
    destroyDeckCharts();
  };
}

/**
 * Destroy all deck analytics chart instances.
 * Call on editor unmount to prevent memory leaks.
 */
export function destroyDeckCharts() {
  if (manaCurveChart) {
    manaCurveChart.destroy();
    manaCurveChart = null;
  }
  if (colourPieChart) {
    colourPieChart.destroy();
    colourPieChart = null;
  }
}
