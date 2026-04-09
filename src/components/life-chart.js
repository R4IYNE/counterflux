/**
 * Life chart component for post-game summary.
 * Chart.js line chart showing life totals per player over turns.
 * Tree-shaken imports following analytics-panel.js pattern.
 */

import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

Chart.register(
  LineController, LineElement, PointElement,
  CategoryScale, LinearScale,
  Tooltip, Legend, Filler
);

/**
 * Player colours indexed by color_index (from UI-SPEC).
 * Player 1: Primary Blue, Player 2: Red, Player 3: Green,
 * Player 4: Amber, Player 5: Purple, Player 6: Cyan.
 */
const PLAYER_COLOURS = [
  '#0D52BD', '#E23838', '#2ECC71',
  '#F39C12', '#A855F7', '#22D3EE',
];

/**
 * Chart.js shared tooltip style matching Neo-Occult Terminal design.
 */
const CHART_TOOLTIP = {
  mode: 'index',
  intersect: false,
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

/** Module-level chart instance for cleanup. */
let chartInstance = null;

/**
 * Render a Chart.js line chart showing life totals per player over turns.
 * @param {string} canvasId - The ID of the canvas element to render into.
 * @param {Array} players - Array of player objects with life_history and color_index.
 */
export function renderLifeChart(canvasId, players) {
  // Destroy existing instance first
  destroyLifeChart();

  const canvas = document.getElementById(canvasId);
  if (!canvas || !players || players.length === 0) return;

  // Determine max turns from longest life_history
  const maxTurns = Math.max(...players.map(p => (p.life_history || []).length));
  const turnLabels = Array.from({ length: maxTurns }, (_, i) => String(i + 1));

  const datasets = players.map(player => ({
    label: player.name || 'Unknown',
    data: player.life_history || [],
    borderColor: PLAYER_COLOURS[player.color_index] || PLAYER_COLOURS[0],
    backgroundColor: 'transparent',
    pointRadius: 3,
    borderWidth: 2,
    fill: false,
    tension: 0.1,
  }));

  chartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: turnLabels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: CHART_LEGEND,
        tooltip: CHART_TOOLTIP,
      },
      scales: {
        x: {
          type: 'category',
          ticks: {
            font: { family: "'JetBrains Mono'", size: 11, weight: 400 },
            color: '#7A8498',
          },
          grid: { color: '#2A2D3A' },
        },
        y: {
          type: 'linear',
          ticks: {
            font: { family: "'JetBrains Mono'", size: 11, weight: 400 },
            color: '#7A8498',
          },
          grid: { color: '#2A2D3A' },
        },
      },
      animation: CHART_ANIMATION,
    },
  });
}

/**
 * Destroy the stored chart instance to prevent memory leaks.
 * MUST be called before creating a new chart or on overlay close.
 */
export function destroyLifeChart() {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}
