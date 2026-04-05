import {
  Chart,
  DoughnutController,
  BarController,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';

Chart.register(
  DoughnutController, BarController,
  ArcElement, BarElement,
  CategoryScale, LinearScale,
  Tooltip, Legend
);

/**
 * MTG colour identity hex map for chart segments.
 */
const MTG_COLOURS = {
  W: { label: 'White', hex: '#F9FAF4' },
  U: { label: 'Blue', hex: '#0E68AB' },
  B: { label: 'Black', hex: '#150B00' },
  R: { label: 'Red', hex: '#D3202A' },
  G: { label: 'Green', hex: '#00733E' },
  C: { label: 'Colourless', hex: '#CBC2BF' },
  M: { label: 'Multi', hex: '#E3C15A' },
};

/**
 * Rarity colour map for bar chart segments.
 */
const RARITY_COLOURS = {
  common: '#8A8F98',
  uncommon: '#A8B8C8',
  rare: '#E3C15A',
  mythic: '#E23838',
};

/**
 * Chart.js shared options matching Organic Brutalism design system.
 */
const CHART_TOOLTIP = {
  backgroundColor: '#1C1F28',
  borderColor: '#2A2D3A',
  borderWidth: 1,
  titleFont: { family: "'JetBrains Mono'", size: 11 },
  bodyFont: { family: "'JetBrains Mono'", size: 11 },
  bodyColor: '#EAECEE',
  titleColor: '#EAECEE',
};

const CHART_LEGEND = {
  labels: {
    font: { family: "'JetBrains Mono'", size: 11, weight: 400 },
    color: '#7A8498',
  },
};

const CHART_ANIMATION = { duration: 400, easing: 'easeOutQuart' };

// ========== Pure computation functions (exported for testing) ==========

/**
 * Compute colour identity breakdown from collection entries.
 * Each colour in a multi-colour card is counted individually.
 * Cards with empty colour identity count as Colourless.
 * @param {Array} entries - Collection entries with joined card data
 * @returns {{ W: number, U: number, B: number, R: number, G: number, C: number, M: number }}
 */
export function computeColourBreakdown(entries) {
  const counts = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, M: 0 };
  for (const entry of entries) {
    const ci = entry.card?.color_identity || [];
    if (ci.length === 0) {
      counts.C += entry.quantity;
    } else {
      for (const c of ci) {
        if (counts[c] !== undefined) counts[c] += entry.quantity;
      }
    }
  }
  return counts;
}

/**
 * Compute rarity breakdown from collection entries.
 * @param {Array} entries
 * @returns {{ common: number, uncommon: number, rare: number, mythic: number }}
 */
export function computeRarityBreakdown(entries) {
  const counts = { common: 0, uncommon: 0, rare: 0, mythic: 0 };
  for (const entry of entries) {
    const rarity = entry.card?.rarity || 'common';
    if (counts[rarity] !== undefined) counts[rarity] += entry.quantity;
  }
  return counts;
}

/**
 * Compute top sets by card count.
 * @param {Array} entries
 * @param {number} limit
 * @returns {Array<{ name: string, count: number }>}
 */
export function computeTopSets(entries, limit = 10) {
  const setCounts = {};
  for (const entry of entries) {
    const setName = entry.card?.set_name || 'Unknown';
    setCounts[setName] = (setCounts[setName] || 0) + entry.quantity;
  }
  return Object.entries(setCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

/**
 * Compute top N most valuable cards by price (EUR converted to GBP).
 * @param {Array} entries
 * @param {number} limit
 * @returns {Array<{ name: string, price: number, set: string }>}
 */
export function computeTopValuable(entries, limit = 10) {
  const convert = (typeof window !== 'undefined' && window.__cf_eurToGbpValue) || (v => v);
  return [...entries]
    .map(e => ({
      name: e.card?.name || 'Unknown',
      price: convert(parseFloat(e.foil ? e.card?.prices?.eur_foil : e.card?.prices?.eur) || 0),
      set: e.card?.set_name || '',
    }))
    .sort((a, b) => b.price - a.price)
    .slice(0, limit);
}

// ========== Chart rendering ==========

/** Active chart instances for cleanup */
let chartInstances = [];

/**
 * Destroy all active chart instances to prevent memory leaks.
 */
function destroyCharts() {
  for (const chart of chartInstances) {
    chart.destroy();
  }
  chartInstances = [];
}

/**
 * Render the colour breakdown doughnut chart.
 * @param {HTMLCanvasElement} canvas
 * @param {Object} colourCounts
 * @returns {Chart}
 */
function renderColourChart(canvas, colourCounts) {
  const chart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: Object.values(MTG_COLOURS).map(c => c.label),
      datasets: [{
        data: Object.keys(MTG_COLOURS).map(k => colourCounts[k] || 0),
        backgroundColor: Object.values(MTG_COLOURS).map(c => c.hex),
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: CHART_LEGEND,
        tooltip: CHART_TOOLTIP,
      },
      animation: CHART_ANIMATION,
    },
  });
  chartInstances.push(chart);
  return chart;
}

/**
 * Render the rarity breakdown bar chart.
 * @param {HTMLCanvasElement} canvas
 * @param {Object} rarityCounts
 * @returns {Chart}
 */
function renderRarityChart(canvas, rarityCounts) {
  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Common', 'Uncommon', 'Rare', 'Mythic'],
      datasets: [{
        data: [rarityCounts.common, rarityCounts.uncommon, rarityCounts.rare, rarityCounts.mythic],
        backgroundColor: [RARITY_COLOURS.common, RARITY_COLOURS.uncommon, RARITY_COLOURS.rare, RARITY_COLOURS.mythic],
        borderRadius: 0,
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: CHART_TOOLTIP,
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
          },
          grid: { color: 'rgba(42, 45, 58, 0.3)' },
        },
      },
      animation: CHART_ANIMATION,
    },
  });
  chartInstances.push(chart);
  return chart;
}

/**
 * Render the top sets horizontal bar chart.
 * @param {HTMLCanvasElement} canvas
 * @param {Array<{ name: string, count: number }>} topSets
 * @returns {Chart}
 */
function renderTopSetsChart(canvas, topSets) {
  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: topSets.map(s => s.name),
      datasets: [{
        data: topSets.map(s => s.count),
        backgroundColor: '#0D52BD',
        borderRadius: 0,
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: CHART_TOOLTIP,
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
          },
          grid: { display: false },
        },
      },
      animation: CHART_ANIMATION,
    },
  });
  chartInstances.push(chart);
  return chart;
}

/**
 * Render the analytics panel HTML.
 * Includes toggle button, chart canvases, and top 10 list.
 * Charts are rendered/destroyed based on panel open/close state.
 * @returns {string} HTML string
 */
export function renderAnalyticsPanel() {
  return `
    <div x-data="analyticsPanel()" class="mb-lg">
      <!-- Toggle button -->
      <button
        @click="toggle()"
        class="px-md py-sm font-mono text-[11px] uppercase tracking-[0.15em] font-bold bg-surface-hover text-text-primary border border-border-ghost cursor-pointer hover:bg-border-ghost transition-colors mb-md"
        style="font-family: 'JetBrains Mono', monospace;"
        x-text="$store.collection.analyticsOpen ? 'HIDE ANALYTICS' : 'SHOW ANALYTICS'">
      </button>

      <!-- Panel -->
      <div
        x-show="$store.collection.analyticsOpen"
        x-cloak
        class="bg-surface border border-border-ghost p-lg"
      >
        <h2 class="text-[20px] font-bold text-text-primary tracking-[0.01em] mb-lg"
            style="font-family: 'Syne', sans-serif;">
          COLLECTION ANALYTICS
        </h2>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-lg">
          <!-- Colour breakdown (doughnut) -->
          <div class="flex flex-col gap-sm">
            <span class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-text-muted"
                  style="font-family: 'JetBrains Mono', monospace;">
              BY COLOUR
            </span>
            <canvas x-ref="colourChart" class="max-h-64"></canvas>
          </div>

          <!-- Rarity breakdown (bar) -->
          <div class="flex flex-col gap-sm">
            <span class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-text-muted"
                  style="font-family: 'JetBrains Mono', monospace;">
              BY RARITY
            </span>
            <canvas x-ref="rarityChart" class="max-h-64"></canvas>
          </div>

          <!-- Top sets (horizontal bar) -->
          <div class="flex flex-col gap-sm">
            <span class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-text-muted"
                  style="font-family: 'JetBrains Mono', monospace;">
              TOP SETS
            </span>
            <canvas x-ref="setsChart" class="max-h-80"></canvas>
          </div>

          <!-- Top 10 most valuable (list) -->
          <div class="flex flex-col gap-sm">
            <span class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-text-muted"
                  style="font-family: 'JetBrains Mono', monospace;">
              TOP 10 MOST VALUABLE
            </span>
            <div class="flex flex-col">
              <template x-for="(card, i) in topValuable" :key="i">
                <div class="flex items-center gap-sm py-xs border-b border-border-ghost/50">
                  <span class="font-mono text-[11px] font-bold text-text-muted w-6 text-right"
                        style="font-family: 'JetBrains Mono', monospace;"
                        x-text="i + 1"></span>
                  <span class="text-[14px] text-text-primary flex-1 truncate"
                        style="font-family: 'Space Grotesk', sans-serif;"
                        x-text="card.name"></span>
                  <span class="font-mono text-[11px] text-text-dim"
                        style="font-family: 'JetBrains Mono', monospace;"
                        x-text="card.set"></span>
                  <span class="font-mono text-[11px] font-bold text-primary"
                        style="font-family: 'JetBrains Mono', monospace;"
                        x-text="'£' + card.price.toFixed(2)"></span>
                </div>
              </template>
              <template x-if="topValuable.length === 0">
                <span class="font-mono text-[11px] text-text-muted" style="font-family: 'JetBrains Mono', monospace;">
                  No cards in collection.
                </span>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Alpine component function for analytics panel.
 * Manages chart lifecycle and data computation.
 */
export function analyticsPanel() {
  return {
    topValuable: [],

    toggle() {
      const store = this.$store.collection;
      store.analyticsOpen = !store.analyticsOpen;
      if (store.analyticsOpen) {
        this.$nextTick(() => this.renderCharts());
      } else {
        destroyCharts();
        this.topValuable = [];
      }
    },

    renderCharts() {
      const entries = this.$store.collection.entries;
      destroyCharts();

      // Colour doughnut
      const colourCanvas = this.$refs.colourChart;
      if (colourCanvas) {
        const colourData = computeColourBreakdown(entries);
        renderColourChart(colourCanvas, colourData);
      }

      // Rarity bar
      const rarityCanvas = this.$refs.rarityChart;
      if (rarityCanvas) {
        const rarityData = computeRarityBreakdown(entries);
        renderRarityChart(rarityCanvas, rarityData);
      }

      // Top sets horizontal bar
      const setsCanvas = this.$refs.setsChart;
      if (setsCanvas) {
        const setsData = computeTopSets(entries);
        renderTopSetsChart(setsCanvas, setsData);
      }

      // Top 10 valuable (list, not chart)
      this.topValuable = computeTopValuable(entries);
    },

    destroy() {
      destroyCharts();
    },
  };
}
