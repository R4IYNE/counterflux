/**
 * @vitest-environment jsdom
 *
 * DECK-03: deck-analytics-panel renders gap warnings as `[RED|AMBER] +N`
 * badges (no category-name duplication, GREEN gaps suppressed). Per
 * 09-CONTEXT D-04 + 09-RESEARCH §"DECK-03 Per-Category Dynamic RAG
 * Thresholds".
 *
 * Mocks Alpine + Chart.js so the panel can mount in jsdom without a full
 * Alpine boot or Chart canvas.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const __stores = {};
vi.mock('alpinejs', () => ({
  default: {
    store: vi.fn((name) => __stores[name] || null),
    effect: vi.fn(() => () => {}),
    data: vi.fn(),
  },
}));

vi.mock('chart.js', () => {
  const ChartCtor = vi.fn(function (canvas, config) {
    // Carry the original config through so the panel's update path
    // (`chart.data.datasets[0].data = ...`) doesn't crash on second render.
    this.canvas = canvas;
    this.data = config?.data ? JSON.parse(JSON.stringify(config.data)) : { labels: [], datasets: [{ data: [] }] };
    this.options = config?.options;
    this.destroy = vi.fn();
    this.update = vi.fn();
  });
  ChartCtor.register = vi.fn();
  return {
    Chart: ChartCtor,
    DoughnutController: {},
    BarController: {},
    ArcElement: {},
    BarElement: {},
    CategoryScale: {},
    LinearScale: {},
    Tooltip: {},
  };
});

vi.mock('../src/db/schema.js', () => ({
  db: {
    cards: {
      where: () => ({ equals: () => ({ toArray: async () => [] }) }),
    },
  },
}));

vi.mock('../src/components/synergy-card.js', () => ({
  renderSynergyCard: vi.fn((c) => {
    const el = document.createElement('div');
    el.className = 'synergy-card';
    el.textContent = c.name || '';
    return el;
  }),
}));

vi.mock('../src/components/salt-gauge.js', () => ({
  renderSaltGauge: vi.fn(),
}));

import { renderDeckAnalyticsPanel } from '../src/components/deck-analytics-panel.js';

function seedStores(intel = {}) {
  __stores.deck = {
    activeDeck: { id: 'd1', name: 'Test Deck', commander_id: null, tags: ['Ramp'] },
    activeCards: [
      { card: { id: 'c1', name: 'Card 1', cmc: 2, type_line: 'Sorcery', mana_cost: '{1}{R}', prices: { eur: '0.10' } }, quantity: 1, tags: ['Ramp'], owned: true },
    ],
    cardCount: 1,
    activeEntries: [],
    // updateAllSections() pulls store.analytics as `analytics`. Provide a
    // minimal but well-shaped object so the gap-warning render path
    // downstream still runs even when the analytics path is mocked.
    analytics: {
      manaCurve: { 0: 0, 1: 0, 2: 1, 3: 0, 4: 0, 5: 0, 6: 0, '7+': 0 },
      colourPie: { W: 0, U: 0, B: 0, R: 1, G: 0, C: 0 },
      typeBreakdown: { Sorcery: 1 },
      tagBreakdown: { Ramp: 1 },
      averageCmc: 2,
      totalPrice: 0.1,
      unownedPrice: 0,
      mostExpensive: { name: 'Card 1', price: 0.1 },
    },
  };
  __stores.intelligence = {
    synergies: [],
    combos: { included: [], almostIncluded: [] },
    comboMap: {},
    saltScore: null,
    saltLabel: '',
    loading: { edhrec: false, spellbook: false },
    error: { edhrec: false, spellbook: false },
    gaps: [],
    ...intel,
  };
}

describe('deck-analytics-panel gap badge (DECK-03)', () => {
  let originalAlpine;

  beforeEach(() => {
    document.body.innerHTML = '<div id="container"></div>';
    Object.keys(__stores).forEach((k) => delete __stores[k]);
    // The panel reads `window.Alpine` directly (not the import). Stub
    // window.Alpine onto the same __stores backing the vi.mock so the
    // panel and vi.mock'd consumers share state.
    originalAlpine = window.Alpine;
    window.Alpine = {
      store: (name) => __stores[name] || null,
      effect: () => () => {},
      data: () => {},
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
    window.Alpine = originalAlpine;
  });

  it('renders +6 badge for red severity gap, no category name in badge body, has red severity class', () => {
    seedStores({
      gaps: [{ category: 'Ramp', count: 4, threshold: 10, severity: 'red', suggestedAdd: 6 }],
    });

    const container = document.getElementById('container');
    renderDeckAnalyticsPanel(container);

    const badge = container.querySelector('.gap-badge-rag');
    expect(badge).toBeTruthy();
    // v1.2 hot-fix #6: word-color redundancy was hurting scan-ability — the
    // badge IS red, so the word "RED" added no info. Severity is now carried
    // by the `gap-badge-{severity}` class + the colour styles, not the text.
    expect(badge.textContent.trim()).toBe('+6');
    expect(badge.classList.contains('gap-badge-red')).toBe(true);
    expect(badge.textContent).not.toMatch(/Ramp/i);
    expect(badge.textContent).not.toMatch(/\[RED\]/);
  });

  it('renders +3 badge for amber severity gap with amber severity class', () => {
    seedStores({
      gaps: [{ category: 'Ramp', count: 7, threshold: 10, severity: 'amber', suggestedAdd: 3 }],
    });

    const container = document.getElementById('container');
    renderDeckAnalyticsPanel(container);

    const badge = container.querySelector('.gap-badge-rag');
    expect(badge).toBeTruthy();
    expect(badge.textContent.trim()).toBe('+3');
    expect(badge.classList.contains('gap-badge-amber')).toBe(true);
    expect(badge.textContent).not.toMatch(/\[AMBER\]/);
  });

  it('does NOT render a badge for green severity gaps', () => {
    seedStores({
      gaps: [{ category: 'Ramp', count: 12, threshold: 10, severity: 'green', suggestedAdd: 0 }],
    });

    const container = document.getElementById('container');
    renderDeckAnalyticsPanel(container);

    const badge = container.querySelector('.gap-badge-rag');
    expect(badge).toBeNull();
  });

  it('does NOT include the legacy "CARDS -- CRITICALLY LOW" / "BELOW" text', () => {
    seedStores({
      gaps: [{ category: 'Ramp', count: 4, threshold: 10, severity: 'red', suggestedAdd: 6 }],
    });

    const container = document.getElementById('container');
    renderDeckAnalyticsPanel(container);

    expect(container.innerHTML).not.toMatch(/CRITICALLY LOW/i);
    expect(container.innerHTML).not.toMatch(/CARDS -- BELOW/i);
  });
});
