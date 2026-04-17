/**
 * @vitest-environment jsdom
 *
 * Phase 09 Plan 2 — player-card render contract (GAME-01..04 + GAME-06).
 *
 * Pattern: Plan 1 established that the renderPlayerGrid HTML is a static
 * string with Alpine bindings inlined as text. We don't boot Alpine here —
 * we assert the bound HTML contains the expected attribute literals + glyph
 * names. Live binding behaviour is covered by the manual UAT walk per the
 * D-00 single HUMAN-UAT contract.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const players2 = [
  { name: 'You', commander: 'Krenko, Mob Boss', color_index: 0, life: 40, poison: 0, tax_count: 0, commander_damage: { 1: 0 }, counters: {} },
  { name: 'Alexander the Great Lifelinker', commander: 'Sigarda, Host of Herons', color_index: 1, life: 25, poison: 0, tax_count: 0, commander_damage: { 0: 0 }, counters: {} },
];
const players3 = [
  ...players2,
  { name: 'Player 3', commander: 'Niv-Mizzet, Parun', color_index: 2, life: 8, poison: 5, tax_count: 2, commander_damage: { 0: 0, 1: 0 }, counters: { energy: 3 } },
];

let mockPlayers = players2;
const adjustCounterMock = vi.fn();
const adjustLifeMock = vi.fn();

vi.mock('alpinejs', () => ({
  default: {
    store: vi.fn((name) => name === 'game' ? {
      players: mockPlayers,
      expandedPlayer: 2, // expand player 3 for in-card counter tests
      activePlayerIndex: undefined, // Plan 3 ships this field
      adjustCounter: adjustCounterMock,
      adjustLife: adjustLifeMock,
      adjustPoison: vi.fn(),
      adjustTax: vi.fn(),
      adjustCommanderDamage: vi.fn(),
      toggleExpanded: vi.fn(),
    } : null),
    effect: vi.fn(),
    data: vi.fn(),
  },
}));

import { renderPlayerGrid } from '../src/components/player-card.js';

function mountGrid() {
  document.body.innerHTML = `<div id="container">${renderPlayerGrid()}</div>`;
  return document.getElementById('container');
}

describe('player-card GAME-01 (clipping fix)', () => {
  beforeEach(() => { mockPlayers = players2; });

  it('long player name renders with text-overflow ellipsis + min-width 0', () => {
    const container = mountGrid();
    const html = container.innerHTML;
    expect(html).toContain('text-overflow: ellipsis');
    expect(html).toContain('white-space: nowrap');
    expect(html).toContain('min-width: 0');
    // Container has bottom padding
    expect(html).toContain('padding-bottom: 16px');
    // Full name binding is preserved (not pre-truncated)
    expect(html).toContain('player.name');
  });

  it('exposes full name via :title attribute for hover tooltip', () => {
    const container = mountGrid();
    const html = container.innerHTML;
    expect(html).toMatch(/:title="player\.name/);
  });
});

describe('player-card GAME-02 (3-player T-shape layout)', () => {
  it('uses cf-player-grid-3 class binding when players.length === 3', () => {
    mockPlayers = players3;
    const container = mountGrid();
    const html = container.innerHTML;
    expect(html).toContain('cf-player-grid-3');
    expect(html).toContain("$store.game.players.length === 3 ? 'cf-player-grid-3");
  });

  it('uses Tailwind 2-col grid for 2 players', () => {
    mockPlayers = players2;
    const container = mountGrid();
    const html = container.innerHTML;
    expect(html).toContain('grid grid-cols-1 md:grid-cols-2');
  });
});

describe('player-card GAME-03 (RAG life colours)', () => {
  it('binds life span :style with #22C55E (green), #F59E0B (amber), #E23838 (red)', () => {
    const container = mountGrid();
    const html = container.innerHTML;
    expect(html).toContain('#22C55E');
    expect(html).toContain('#F59E0B');
    expect(html).toContain('#E23838');
    // Binding references player.life
    expect(html).toMatch(/player\.life[\s\S]{0,200}#22C55E/);
  });
});

describe('player-card GAME-04 (Material Symbols counter glyphs)', () => {
  it('poison row contains material-symbols span with text skull (gap 4a: reversed from vaccines per HUMAN-UAT)', () => {
    const container = mountGrid();
    const html = container.innerHTML;
    expect(html).toMatch(/<span[^>]*material-symbols-outlined[^>]*>skull<\/span>/);
    // Regression: ensure the old vaccines glyph is fully removed
    expect(html).not.toMatch(/>vaccines</);
  });

  it('tax row contains material-symbols span with text paid', () => {
    const container = mountGrid();
    const html = container.innerHTML;
    expect(html).toMatch(/<span[^>]*material-symbols-outlined[^>]*>paid<\/span>/);
  });

  it('commander damage row contains material-symbols span with text shield_with_heart', () => {
    mockPlayers = players3; // ensure expanded section renders
    const container = mountGrid();
    const html = container.innerHTML;
    expect(html).toMatch(/<span[^>]*material-symbols-outlined[^>]*>shield_with_heart<\/span>/);
  });
});

describe('player-card GAME-06 (in-card counter +/- buttons)', () => {
  it('renders +/- buttons in expanded section that call $store.game.adjustCounter', () => {
    mockPlayers = players3;
    const container = mountGrid();
    const html = container.innerHTML;
    // The +/- pattern uses adjustCounter(pIdx, name, ±1)
    expect(html).toContain('$store.game.adjustCounter(pIdx, name, -1)');
    expect(html).toContain('$store.game.adjustCounter(pIdx, name, 1)');
  });
});

describe('player-card cross-plan (Plan 3 active player wiring placeholder)', () => {
  it('outer player div :class binding includes cf-player-active reference', () => {
    const container = mountGrid();
    const html = container.innerHTML;
    expect(html).toContain('cf-player-active');
    // Binding keyed by activePlayerIndex (set by Plan 3) — undefined === number is false, no harm
    expect(html).toContain('$store.game.activePlayerIndex === pIdx');
  });
});
