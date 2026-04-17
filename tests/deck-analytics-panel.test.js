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
  const ChartCtor = vi.fn(function () {
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
    activeDeck: { id: 'd1', name: 'Test Deck', commander_id: null },
    activeCards: [
      { card: { id: 'c1', name: 'Card 1', cmc: 2, type_line: 'Sorcery', mana_cost: '{1}{R}', prices: { eur: '0.10' } }, quantity: 1, tags: ['Ramp'], owned: true },
    ],
    cardCount: 1,
    activeEntries: [],
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
  beforeEach(() => {
    document.body.innerHTML = '<div id="container"></div>';
    Object.keys(__stores).forEach((k) => delete __stores[k]);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders [RED] +6 badge for red severity gap, no category name in badge body', () => {
    seedStores({
      gaps: [{ category: 'Ramp', count: 4, threshold: 10, severity: 'red', suggestedAdd: 6 }],
    });

    const container = document.getElementById('container');
    renderDeckAnalyticsPanel(container);

    // The badge is class 'gap-badge-rag' per the new render contract.
    const badge = container.querySelector('.gap-badge-rag');
    expect(badge).toBeTruthy();
    // Per D-04 the badge text is `[RED] +6` — NO "Ramp" duplicated in the
    // body (the Ramp label is already on the parent tag-row).
    expect(badge.textContent).toMatch(/\[RED\]\s*\+6/);
    expect(badge.textContent).not.toMatch(/Ramp/i);
  });

  it('renders [AMBER] +3 badge for amber severity gap', () => {
    seedStores({
      gaps: [{ category: 'Ramp', count: 7, threshold: 10, severity: 'amber', suggestedAdd: 3 }],
    });

    const container = document.getElementById('container');
    renderDeckAnalyticsPanel(container);

    const badge = container.querySelector('.gap-badge-rag');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toMatch(/\[AMBER\]\s*\+3/);
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
