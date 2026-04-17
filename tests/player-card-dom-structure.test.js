/**
 * @vitest-environment jsdom
 *
 * Phase 09 Plan 04 — DOM-structure regression tests for the player grid.
 *
 * These tests DIFFER from `tests/player-card.test.js` by booting the REAL
 * Alpine runtime (no `vi.mock('alpinejs', ...)`) so `<template x-for>`
 * actually materialises into real DOM children. The string-assertion tests
 * in player-card.test.js cannot verify DOM structure because Alpine is
 * stubbed there.
 *
 * Why a separate file: Vitest evaluates `vi.mock` at module-load time with
 * hoisting semantics. `vi.doUnmock` inside a describe block doesn't
 * reliably bypass the hoisted mock for already-resolved imports in the
 * same file. A clean file with no top-level `vi.mock` is the simplest
 * isolation boundary.
 *
 * Motivation: Plan 09-03's GAME-02 tautological regex
 *   /cf-player-grid-3[^>]*?>\\s*<template[^>]*x-for/s
 * would match the shipped (broken) source — the `<template x-for>` sits as
 * the IMMEDIATE child of the grid wrapper, so when the browser counts
 * children for `:nth-child` grid-area assignment, the <template> is child
 * #1 and the three player cards are children #2, #3, #4. The top player
 * therefore never got `grid-area: p1` applied.
 *
 * Plan 09-04 fix: grid-area is now set via inline `:style` keyed on pIdx
 * so sibling position is irrelevant. These tests lock that in.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Alpine from 'alpinejs';
import { renderPlayerGrid } from '../src/components/player-card.js';
import { renderCommanderDamageTracker } from '../src/components/commander-damage-tracker.js';

const players3 = [
  {
    name: 'You',
    commander: 'Krenko, Mob Boss',
    color_index: 0,
    life: 40,
    poison: 0,
    tax_count: 0,
    commander_damage: { 1: 0, 2: 0 },
    counters: {},
    eliminated: false,
  },
  {
    name: 'Alexander the Great Lifelinker',
    commander: 'Sigarda, Host of Herons',
    color_index: 1,
    life: 25,
    poison: 0,
    tax_count: 0,
    commander_damage: { 0: 0, 2: 0 },
    counters: {},
    eliminated: false,
  },
  {
    name: 'Player 3',
    commander: 'Niv-Mizzet, Parun',
    color_index: 2,
    life: 8,
    poison: 5,
    tax_count: 2,
    commander_damage: { 0: 0, 1: 0 },
    counters: { energy: 3 },
    eliminated: false,
  },
];

const players2 = [players3[0], players3[1]];

/**
 * Boot Alpine against a freshly-mounted container. Alpine.start() is idempotent
 * per the 3.x docs but we register a store per-test so the template's
 * `$store.game` reference resolves.
 */
function bootAlpine(container, players) {
  // Stub wireLifeButtons globally so the x-init call doesn't throw.
  if (typeof window.wireLifeButtons !== 'function') {
    window.wireLifeButtons = () => {};
  }
  Alpine.store('game', {
    players,
    expandedPlayer: null,
    activePlayerIndex: 0,
    adjustCounter: vi.fn(),
    adjustLife: vi.fn(),
    adjustPoison: vi.fn(),
    adjustTax: vi.fn(),
    adjustCommanderDamage: vi.fn(),
    toggleExpanded: vi.fn(),
  });
  if (!window.__alpineStarted) {
    Alpine.start();
    window.__alpineStarted = true;
  } else {
    Alpine.initTree(container);
  }
}

describe('player-card Plan 09-04 Gap 2 — 3-player grid DOM structure', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    // Reset the Alpine-started flag between tests so initTree doesn't double-bind
    delete window.__alpineStarted;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('real Alpine is available (sanity — doUnmock or separate-file isolation worked)', () => {
    expect(typeof Alpine.start).toBe('function');
    expect(typeof Alpine.store).toBe('function');
  });

  it('when players.length === 3, .cf-player-grid-3 wrapper contains exactly 3 ghost-border player-card children (Alpine x-for materialised)', () => {
    document.body.innerHTML = `<div id="container">${renderPlayerGrid()}</div>`;
    const container = document.getElementById('container');
    bootAlpine(container, players3);

    const wrapper = container.querySelector('.cf-player-grid-3');
    expect(wrapper).toBeTruthy();

    // Alpine 3.x leaves the <template x-for> element as a child of the
    // wrapper (template tags don't render visually but ARE counted by
    // :nth-child). Filter to ghost-border children specifically — those
    // are the actual player cards. There must be exactly 3.
    const cardChildren = Array.from(wrapper.children).filter((n) =>
      n.classList && n.classList.contains('ghost-border'),
    );
    expect(cardChildren.length).toBe(3);

    // The presence of the <template> as a sibling is precisely WHY the
    // original :nth-child(N) grid-area assignments broke — :nth-child(1)
    // matched the <template>, not the first player card. The fix moves
    // grid-area to inline :style on each card, sidestepping the issue.
    // Document this constraint in the assertion so a future "remove the
    // template wrapper" refactor doesn't accidentally re-introduce the
    // broken :nth-child reliance.
    const allChildren = Array.from(wrapper.children);
    const templateSibling = allChildren.find((n) => n.tagName === 'TEMPLATE');
    if (templateSibling) {
      // Template present — confirms why we use inline grid-area instead of nth-child.
      expect(allChildren.length).toBeGreaterThan(cardChildren.length);
    }
  });

  it('each player card carries an inline grid-area style matching its pIdx (p1/p2/p3)', () => {
    document.body.innerHTML = `<div id="container">${renderPlayerGrid()}</div>`;
    const container = document.getElementById('container');
    bootAlpine(container, players3);

    const wrapper = container.querySelector('.cf-player-grid-3');
    const cards = Array.from(wrapper.children).filter((n) =>
      n.classList.contains('ghost-border'),
    );
    expect(cards.length).toBe(3);

    // The fix assigns grid-area via :style keyed on pIdx so it works even if
    // Alpine leaves a stray <template> sibling inside the wrapper (and
    // `> :nth-child(N)` therefore skips the first player card).
    expect(cards[0].style.gridArea).toBe('p1');
    expect(cards[1].style.gridArea).toBe('p2');
    expect(cards[2].style.gridArea).toBe('p3');
  });

  it('2-player grid does NOT apply cf-player-grid-3 (branch guard)', () => {
    document.body.innerHTML = `<div id="container">${renderPlayerGrid()}</div>`;
    const container = document.getElementById('container');
    bootAlpine(container, players2);

    const wrapperThree = container.querySelector('.cf-player-grid-3');
    expect(wrapperThree).toBeFalsy();
  });
});

describe('player-card Plan 09-04 Gap 2 — defensive CSS contract', () => {
  it('.cf-player-grid-3 block in main.css declares width: 100% and min-width: 0 defensive rules', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const cssPath = path.resolve(__dirname, '../src/styles/main.css');
    const css = await fs.readFile(cssPath, 'utf8');
    const blockMatch = css.match(/\.cf-player-grid-3\s*\{([^}]+)\}/);
    expect(blockMatch).toBeTruthy();
    const blockBody = blockMatch[1];
    expect(blockBody).toContain('width: 100%');
    expect(blockBody).toContain('min-width: 0');
  });
});

// Silence "unused" warning for renderCommanderDamageTracker import — it's
// pulled in so the player-card module graph resolves cleanly when booting
// Alpine (the tracker's exports are consumed by renderPlayerGrid at render).
void renderCommanderDamageTracker;
