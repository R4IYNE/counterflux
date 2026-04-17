/**
 * @vitest-environment jsdom
 *
 * DECK-05: deck-centre-panel renders Commander as its own type category
 * ABOVE the existing TYPE_ORDER iteration. Per 09-CONTEXT D-07 +
 * 09-RESEARCH P-9 (commander_id verification + fallback derivation).
 *
 * The panel reads `window.Alpine` directly (matches deck-analytics-panel
 * pattern from Task 3). SortableJS is module-level imported; we mock it
 * to a no-op so jsdom doesn't choke on its DOM-mutation observers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('sortablejs', () => ({
  default: vi.fn(() => ({ destroy: vi.fn() })),
}));

vi.mock('../src/components/deck-card-tile.js', () => ({
  renderDeckCardTile: vi.fn((entry) => {
    const tile = document.createElement('div');
    tile.dataset.deckCardId = entry.id || '';
    tile.dataset.scryfallId = entry.scryfall_id || entry.card?.id || '';
    tile.textContent = entry.card?.name || 'tile';
    return tile;
  }),
}));

vi.mock('../src/components/deck-import-modal.js', () => ({
  openDeckImportModal: vi.fn(),
}));

vi.mock('../src/components/deck-export-modal.js', () => ({
  openDeckExportModal: vi.fn(),
}));

import { renderDeckCentrePanel } from '../src/components/deck-centre-panel.js';

const KRENKO = {
  id: '9f5ee5cf-3b04-4ce0-8c4d-1d23c5b09b56',
  name: 'Krenko, Mob Boss',
  type_line: 'Legendary Creature \u2014 Goblin Warrior',
  color_identity: ['R'],
  cmc: 4,
  mana_cost: '{2}{R}{R}',
};

function makeOtherCards() {
  return Array.from({ length: 30 }, (_, i) => ({
    id: `c-${i}`,
    name: `Goblin ${i}`,
    type_line: i < 20 ? 'Creature \u2014 Goblin' : (i < 25 ? 'Land' : 'Instant'),
    color_identity: ['R'],
    cmc: i % 7,
    mana_cost: i < 25 ? '{R}' : '',
  }));
}

function makeStore({ commander_id = '9f5ee5cf-3b04-4ce0-8c4d-1d23c5b09b56', includeCommanderCard = true } = {}) {
  const others = makeOtherCards();
  const cards = includeCommanderCard ? [KRENKO, ...others] : others;
  const activeEntries = cards.map((c) => ({
    id: c.id,
    deck_id: 'd1',
    scryfall_id: c.id,
    quantity: 1,
    tags: [],
    sort_order: 0,
    card: c,
    owned: true,
  }));

  // groupedByType: mirrors what src/stores/deck.js computes via classifyType.
  const grouped = {};
  for (const entry of activeEntries) {
    const tl = entry.card.type_line;
    let type = 'Other';
    if (tl.includes('Creature')) type = 'Creature';
    else if (tl.includes('Land')) type = 'Land';
    else if (tl.includes('Instant')) type = 'Instant';
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(entry);
  }

  return {
    activeDeck: { id: 'd1', name: 'Krenko Test', deck_size: 100, commander_id },
    activeCards: activeEntries,
    cardCount: cards.length,
    slotsRemaining: 100 - cards.length,
    viewMode: 'list',
    groupedByType: grouped,
  };
}

describe('deck-centre-panel COMMANDER section (DECK-05)', () => {
  let originalAlpine;

  beforeEach(() => {
    document.body.innerHTML = '<div id="container"></div>';
    originalAlpine = window.Alpine;
  });

  afterEach(() => {
    window.Alpine = originalAlpine;
    document.body.innerHTML = '';
  });

  it('renders COMMANDER section ABOVE Creature section when commander_id matches a card', () => {
    const store = makeStore();
    window.Alpine = {
      store: (name) => (name === 'deck' ? store : null),
      effect: () => () => {},
    };

    const container = document.getElementById('container');
    renderDeckCentrePanel(container);

    const commanderGroup = container.querySelector('[data-type-group="Commander"]');
    const creatureGroup = container.querySelector('[data-type-group="Creature"]');
    expect(commanderGroup).toBeTruthy();
    expect(creatureGroup).toBeTruthy();

    // Commander section comes FIRST in document order.
    const all = container.querySelectorAll('[data-type-group]');
    expect(all[0]).toBe(commanderGroup);
  });

  it('Commander section header text contains "COMMANDER"', () => {
    const store = makeStore();
    window.Alpine = {
      store: (name) => (name === 'deck' ? store : null),
      effect: () => () => {},
    };

    const container = document.getElementById('container');
    renderDeckCentrePanel(container);

    const commanderGroup = container.querySelector('[data-type-group="Commander"]');
    expect(commanderGroup).toBeTruthy();
    expect(commanderGroup.textContent.toUpperCase()).toContain('COMMANDER');
  });

  it('Commander label uses primary blue (#0D52BD) per D-07 typography spec', () => {
    const store = makeStore();
    window.Alpine = {
      store: (name) => (name === 'deck' ? store : null),
      effect: () => () => {},
    };

    const container = document.getElementById('container');
    renderDeckCentrePanel(container);

    const commanderGroup = container.querySelector('[data-type-group="Commander"]');
    const labelEl = commanderGroup.querySelector('span');
    // jsdom normalises hex → rgb. Both are acceptable.
    const colour = labelEl.style.color.toLowerCase();
    expect(colour === '#0d52bd' || colour === 'rgb(13, 82, 189)').toBe(true);
  });

  it('falls back to first Legendary Creature when commander_id is null', () => {
    const store = makeStore({ commander_id: null });
    window.Alpine = {
      store: (name) => (name === 'deck' ? store : null),
      effect: () => () => {},
    };

    const container = document.getElementById('container');
    renderDeckCentrePanel(container);

    // KRENKO is in activeCards as the first Legendary Creature with R color
    // identity matching the deck's union (also R).
    const commanderGroup = container.querySelector('[data-type-group="Commander"]');
    expect(commanderGroup).toBeTruthy();
  });

  it('renders NO Commander section when no candidate exists', () => {
    // Strip Krenko entirely → no Legendary Creature in the deck.
    const store = makeStore({ commander_id: null, includeCommanderCard: false });
    window.Alpine = {
      store: (name) => (name === 'deck' ? store : null),
      effect: () => () => {},
    };

    const container = document.getElementById('container');
    renderDeckCentrePanel(container);

    const commanderGroup = container.querySelector('[data-type-group="Commander"]');
    expect(commanderGroup).toBeNull();
  });
});
