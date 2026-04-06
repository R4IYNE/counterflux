/**
 * Deck analytics sidebar panel.
 * Renders mana curve, colour distribution, type breakdown,
 * categories, price summary, and salt score placeholder.
 * All charts live-update via Alpine.effect() within 100ms.
 */

import {
  Chart,
  DoughnutController,
  BarController,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
} from 'chart.js';
import Alpine from 'alpinejs';
import { db } from '../db/schema.js';
import { TYPE_ORDER } from '../utils/type-classifier.js';
import { renderSaltGauge } from './salt-gauge.js';
import { renderSynergyCard } from './synergy-card.js';
import { DEFAULT_THRESHOLDS } from '../utils/gap-detection.js';

Chart.register(
  DoughnutController, BarController,
  ArcElement, BarElement,
  CategoryScale, LinearScale,
  Tooltip
);
// Prices from deck-analytics.js are already in GBP (via eurToGbpValue).
// We format directly with formatGbp() below.

/**
 * Find the cheapest paper-legal printing of a card by name.
 * Filters out memorabilia (World Championship, gold-bordered) and digital-only.
 * Sorts by USD price ascending, falls back to any legal printing if no price.
 * @param {string} cardName
 * @returns {Promise<object|null>}
 */
async function findCheapestLegalPrinting(cardName) {
  const printings = await db.cards.where('name').equals(cardName).toArray();
  const legal = printings.filter(c =>
    c.games?.includes('paper') &&
    c.set_type !== 'memorabilia' &&
    c.legalities?.commander === 'legal'
  );
  if (legal.length === 0) return null;
  legal.sort((a, b) => {
    const pa = parseFloat(a.prices?.usd || a.prices?.usd_foil) || 999;
    const pb = parseFloat(b.prices?.usd || b.prices?.usd_foil) || 999;
    return pa - pb;
  });
  return legal[0];
}

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
  tagSection.appendChild(createSectionHeader('CATEGORIES'));

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

  // --- Section 6: Salt Score (Intelligence Layer) ---
  const saltSection = document.createElement('div');
  saltSection.style.cssText = 'margin-bottom: 24px;';
  saltSection.appendChild(createSectionHeader('SALT SCORE'));

  const saltContainer = document.createElement('div');
  saltSection.appendChild(saltContainer);

  container.appendChild(saltSection);

  // --- Section 7: Synergy Suggestions (Intelligence Layer) ---
  const synergySection = document.createElement('div');
  synergySection.style.cssText = 'margin-bottom: 24px;';
  synergySection.appendChild(createSectionHeader('SYNERGY SUGGESTIONS'));

  const synergyContainer = document.createElement('div');
  synergyContainer.style.cssText = 'max-height: 400px; overflow-y: auto;';
  synergySection.appendChild(synergyContainer);

  container.appendChild(synergySection);

  // --- Section 8: Near-Miss Combos (Intelligence Layer) ---
  const nearMissSection = document.createElement('div');
  nearMissSection.style.cssText = 'margin-bottom: 24px;';
  nearMissSection.appendChild(createSectionHeader('NEAR-MISS COMBOS'));

  const nearMissContainer = document.createElement('div');
  nearMissSection.appendChild(nearMissContainer);

  container.appendChild(nearMissSection);

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

    // --- Intelligence: Salt gauge ---
    const intel = Alpine.store('intelligence');
    renderSaltGauge(
      saltContainer,
      intel?.saltScore,
      intel?.saltLabel,
      intel?.loading?.edhrec,
      intel?.error?.edhrec
    );

    // --- Intelligence: Synergy suggestions ---
    synergyContainer.innerHTML = '';
    if (intel?.loading?.edhrec) {
      // Show 3 shimmer skeleton rows
      for (let i = 0; i < 3; i++) {
        const skel = document.createElement('div');
        skel.className = 'shimmer';
        skel.style.cssText = 'height: 48px; margin-bottom: 8px;';
        synergyContainer.appendChild(skel);
      }
    } else if (intel?.error?.edhrec) {
      const errEl = document.createElement('div');
      errEl.style.cssText = `${LABEL_400} color: #4A5064;`;
      errEl.textContent = 'Intelligence unavailable -- using local heuristics.';
      synergyContainer.appendChild(errEl);
    } else if (!intel?.synergies || intel.synergies.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.style.cssText = `${LABEL_400} color: #4A5064;`;
      emptyEl.textContent = 'No synergy data available yet. Refresh to fetch from EDHREC.';
      synergyContainer.appendChild(emptyEl);
    } else {
      // Filter out cards already in deck
      const deckCardNames = new Set(
        (store?.activeCards || []).map(c => c.card?.name).filter(Boolean)
      );
      const filtered = intel.synergies.filter(s => !deckCardNames.has(s.name));
      for (const suggestion of filtered) {
        const card = renderSynergyCard(suggestion, async (s) => {
          const match = await findCheapestLegalPrinting(s.name);
          if (match) {
            const result = await Alpine.store('deck')?.addCard(match.id);
            if (result?.warning) {
              Alpine.store('toast')?.warning(result.message);
            } else {
              Alpine.store('toast')?.success(`Added ${s.name} (${match.set.toUpperCase()}) from suggestions.`);
            }
          } else {
            Alpine.store('toast')?.warning(`${s.name} not found in local card database.`);
          }
        });
        synergyContainer.appendChild(card);
      }
    }

    // --- Intelligence: Near-miss combos ---
    nearMissContainer.innerHTML = '';
    if (intel?.loading?.spellbook) {
      const loadEl = document.createElement('div');
      loadEl.style.cssText = `${LABEL_400} color: #7A8498;`;
      loadEl.textContent = 'Checking combos...';
      nearMissContainer.appendChild(loadEl);
    } else if (intel?.error?.spellbook) {
      const errEl = document.createElement('div');
      errEl.style.cssText = `${LABEL_400} color: #4A5064;`;
      errEl.textContent = 'Combo detection unavailable.';
      nearMissContainer.appendChild(errEl);
    } else if (intel?.combos?.almostIncluded?.length > 0) {
      const nearMisses = intel.combos.almostIncluded.slice(0, 5);
      for (const combo of nearMisses) {
        const comboEl = document.createElement('div');
        comboEl.style.cssText = 'margin-bottom: 16px; padding: 8px 0; border-bottom: 1px solid #2A2D3A;';

        // Combo effect title
        const effectEl = document.createElement('div');
        effectEl.style.cssText = `${LABEL_700} color: #EAECEE; margin-bottom: 4px;`;
        const effectText = combo.produces && combo.produces.length > 0
          ? combo.produces[0].toUpperCase()
          : 'COMBO';
        effectEl.textContent = effectText;
        comboEl.appendChild(effectEl);

        // Pieces
        if (combo.pieces) {
          for (const piece of combo.pieces) {
            const pieceEl = document.createElement('div');
            const isMissing = piece.missing || false;
            if (isMissing) {
              pieceEl.style.cssText = `${LABEL_700} color: #E23838; margin-left: 8px; cursor: pointer; text-decoration: underline; text-decoration-style: dotted;`;
              pieceEl.textContent = `+ ${piece.name}`;
              pieceEl.title = `Add ${piece.name} to deck`;
              pieceEl.addEventListener('click', async () => {
                const match = await findCheapestLegalPrinting(piece.name);
                if (match) {
                  const result = await Alpine.store('deck')?.addCard(match.id);
                  if (result?.warning) {
                    Alpine.store('toast')?.warning(result.message);
                  } else {
                    Alpine.store('toast')?.success(`Added ${piece.name} (${match.set.toUpperCase()}) to complete combo.`);
                  }
                } else {
                  Alpine.store('toast')?.warning(`${piece.name} not found in local card database.`);
                }
              });
            } else {
              pieceEl.style.cssText = `${LABEL_400} color: #7A8498; margin-left: 8px;`;
              pieceEl.textContent = piece.name;
            }
            comboEl.appendChild(pieceEl);
          }
        }

        // Missing count label
        const missingCount = combo.pieces?.filter(p => p.missing).length || 0;
        if (missingCount > 0) {
          const countEl = document.createElement('div');
          countEl.style.cssText = `${LABEL_400} color: #E23838; margin-top: 4px;`;
          countEl.textContent = `${missingCount} PIECE${missingCount > 1 ? 'S' : ''} MISSING`;
          comboEl.appendChild(countEl);
        }

        nearMissContainer.appendChild(comboEl);
      }
    } else if (!intel?.loading?.spellbook) {
      const noneEl = document.createElement('div');
      noneEl.style.cssText = `${LABEL_400} color: #4A5064;`;
      noneEl.textContent = 'No known combos detected in the 99.';
      nearMissContainer.appendChild(noneEl);
    }

    // --- Intelligence: Gap warnings inline in tag breakdown ---
    if (intel?.gaps?.length > 0) {
      const tagRows = tagBarsContainer.querySelectorAll(':scope > div');
      for (const gap of intel.gaps) {
        // Find matching tag row by name
        for (const row of tagRows) {
          const nameSpan = row.querySelector('span');
          if (nameSpan && nameSpan.textContent.trim() === gap.category) {
            // Check if warning already exists
            if (row.querySelector('.gap-warning, .gap-critical')) break;
            const warnEl = document.createElement('span');
            warnEl.className = gap.severity === 'critical' ? 'gap-critical' : 'gap-warning';
            warnEl.style.cssText += ` ${LABEL_400} margin-left: 8px; flex-shrink: 0;`;
            const iconEl = document.createElement('span');
            iconEl.className = 'material-symbols-outlined';
            iconEl.style.fontSize = '14px';
            iconEl.textContent = 'warning';
            warnEl.appendChild(iconEl);
            const textNode = document.createTextNode(
              gap.severity === 'critical'
                ? ` ${gap.category}: ${gap.count} CARDS -- CRITICALLY LOW`
                : ` ${gap.category}: ${gap.count} CARDS -- BELOW ${gap.threshold}`
            );
            warnEl.appendChild(textNode);
            row.appendChild(warnEl);
            break;
          }
        }
      }
    }
  }

  // Initial render
  updateAllSections();

  // Reactive updates via Alpine.effect() with requestAnimationFrame batching
  let effectCleanup = null;
  if (Alpine && store) {
    effectCleanup = Alpine.effect(() => {
      // Touch reactive properties to register dependency tracking
      const _cards = store.activeCards;
      const _len = _cards?.length;
      const _deck = store.activeDeck;
      // Touch intelligence store for reactivity
      const _intel = Alpine.store('intelligence');
      const _synergies = _intel?.synergies;
      const _combos = _intel?.combos;
      const _gaps = _intel?.gaps;
      const _salt = _intel?.saltScore;
      const _loading = _intel?.loading;
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
