/**
 * @vitest-environment jsdom
 *
 * Phase 9 Plan 3 Task 4 — GAME-09 post-game TURN PACING section.
 * Tests computePacingStats helper + renderPostGameOverlay HTML contract +
 * postGameOverlay component _computePacing wiring.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('alpinejs', () => ({
  default: {
    store: vi.fn((name) =>
      name === 'game'
        ? {
            view: 'summary',
            players: [{ name: 'Alice', is_first: true }, { name: 'Bob' }],
            turn_laps: [60000, 30000, 90000, 45000],
            currentTurn: 5,
            gameStartedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          }
        : null
    ),
    effect: vi.fn(),
    data: vi.fn(),
  },
}));

vi.mock('chart.js', () => {
  const ChartCtor = vi.fn(() => ({ destroy: vi.fn(), update: vi.fn() }));
  ChartCtor.register = vi.fn();
  return {
    Chart: ChartCtor,
    registerables: [],
    LineController: {},
    LineElement: {},
    PointElement: {},
    CategoryScale: {},
    LinearScale: {},
    Tooltip: {},
    Legend: {},
    Filler: {},
  };
});

import {
  computePacingStats,
  postGameOverlay,
  renderPostGameOverlay,
} from '../src/components/post-game-overlay.js';

describe('computePacingStats (GAME-09)', () => {
  const players = [{ name: 'Alice' }, { name: 'Bob' }];

  it('longestTurn = 90000 for laps [60000, 30000, 90000, 45000]', () => {
    const s = computePacingStats([60000, 30000, 90000, 45000], players);
    expect(s.longestTurn).toBe(90000);
    expect(s.longestPlayerName).toBe('Alice'); // index 2 % 2 = 0
  });

  it('avgTurn = 56250 (mean of 4 laps)', () => {
    const s = computePacingStats([60000, 30000, 90000, 45000], players);
    expect(s.avgTurn).toBe(56250);
  });

  it('perPlayerAvg groups by index modulo player count, sorted slowest first', () => {
    const s = computePacingStats([60000, 30000, 90000, 45000], players);
    // Alice gets laps 0+2 = [60000, 90000] avg 75000
    // Bob gets laps 1+3 = [30000, 45000] avg 37500
    expect(s.perPlayerAvg[0].name).toBe('Alice');
    expect(s.perPlayerAvg[0].avgMs).toBe(75000);
    expect(s.perPlayerAvg[1].name).toBe('Bob');
    expect(s.perPlayerAvg[1].avgMs).toBe(37500);
  });

  it('empty turn_laps returns zero stats', () => {
    const s = computePacingStats([], players);
    expect(s.longestTurn).toBe(0);
    expect(s.avgTurn).toBe(0);
    expect(s.perPlayerAvg).toEqual([]);
  });
});

describe('renderPostGameOverlay TURN PACING section', () => {
  it('contains TURN PACING / LONGEST TURN / AVG TURN / PER-PLAYER AVG section labels', () => {
    const html = renderPostGameOverlay();
    expect(html).toContain('TURN PACING');
    expect(html).toContain('LONGEST TURN');
    expect(html).toContain('AVG TURN');
    expect(html).toContain('PER-PLAYER AVG');
  });

  it('binds tile values to pacing computed property', () => {
    const html = renderPostGameOverlay();
    expect(html).toContain('pacing.longestTurnDisplay');
    expect(html).toContain('pacing.avgTurnDisplay');
    expect(html).toContain('pacing.perPlayerAvg');
  });

  it('uses brand primary blue #0D52BD for value text', () => {
    const html = renderPostGameOverlay();
    expect(html).toMatch(/font-size: 32px[^"]*color: #0D52BD/);
  });
});

describe('postGameOverlay component _computePacing', () => {
  it('populates pacing.longestTurnDisplay as mm:ss formatted string', () => {
    // Build a minimal Alpine-like context for the component instance
    const ctx = postGameOverlay();
    ctx.$store = {
      game: {
        players: [{ name: 'Alice' }, { name: 'Bob' }],
        turn_laps: [60000, 90000],
        gameStartedAt: new Date().toISOString(),
      },
    };
    ctx.$nextTick = (cb) => cb();
    ctx._computePacing();
    expect(ctx.pacing.longestTurnDisplay).toBe('1:30');
    expect(ctx.pacing.avgTurnDisplay).toBe('1:15');
    expect(ctx.pacing.perPlayerAvg.length).toBe(2);
  });
});

// ============================================================
// Phase 9 Plan 06 — Gap 7 (TURN PACING end-to-end render)
//
// HUMAN-UAT reported the TURN PACING section never rendered post-game. Gap 7
// may cascade from Gap 6 (if the visible timer froze at 00:00, users stopped
// pressing NEXT TURN, so turn_laps stayed empty and the x-show guard hid the
// section) OR it may be an independent render-path bug in post-game-overlay.js.
//
// These tests exercise both the pure computation path (computePacingStats with
// realistic lap data) and the component wiring path (postGameOverlay's
// _computePacing populates display strings). If the browser walkthrough
// post-Task-1 STILL shows TURN PACING missing despite turn_laps.length >= 3,
// Gap 7 is an independent render-path bug and the plan calls for escalation.
//
// IMPORTANT positional contract of computePacingStats:
//   longestPlayerName = players[longestLapIdx % players.length].name
// This assumes lap[0] maps to players[0] — equivalent to activePlayerIndex === 0
// at game start. In the live app, the spinner randomises the starting index,
// so `longestPlayerName` relative to the spinner winner is non-deterministic
// against this helper. We pin `activePlayerIndex: 0` in the component-level
// test to match the helper's positional contract.
// ============================================================

describe('gap 7 (TURN PACING end-to-end with realistic lap data)', () => {
  it('computePacingStats on [60s, 90s, 45s] with 3 players produces expected pacing output', () => {
    // NOTE: computePacingStats derives longestPlayerName as
    //   players[longestLapIdx % players.length].name
    // This assumes lap[0] maps to players[0] — equivalent to
    // activePlayerIndex === 0 at game start. In the live app the spinner
    // randomises the starting index, so this test aligns with the helper's
    // positional contract (lap[0] → players[0], lap[1] → players[1], ...).
    const turn_laps = [60_000, 90_000, 45_000];
    const players = [
      { name: 'You' }, // index 0 — lap[0] owner
      { name: 'Op1' }, // index 1 — lap[1] owner (longest)
      { name: 'Op2' }, // index 2 — lap[2] owner
    ];
    const stats = computePacingStats(turn_laps, players);
    // Longest turn = 90s, at lap-index 1, 1 % 3 === 1 → players[1] → 'Op1'
    expect(stats.longestTurn).toBe(90_000);
    expect(stats.longestPlayerName).toBe('Op1');
    // Avg = (60 + 90 + 45) / 3 = 65s
    expect(stats.avgTurn).toBe(65_000);
    // Per-player avg: You → [60000], Op1 → [90000], Op2 → [45000]
    expect(stats.perPlayerAvg.length).toBe(3);
    // Sorted slowest first: Op1 (90000) → You (60000) → Op2 (45000)
    expect(stats.perPlayerAvg[0].name).toBe('Op1');
    expect(stats.perPlayerAvg[0].avgMs).toBe(90_000);
    expect(stats.perPlayerAvg[1].name).toBe('You');
    expect(stats.perPlayerAvg[1].avgMs).toBe(60_000);
    expect(stats.perPlayerAvg[2].name).toBe('Op2');
    expect(stats.perPlayerAvg[2].avgMs).toBe(45_000);
  });

  it('postGameOverlay._computePacing populates display strings from turn_laps (mm:ss)', () => {
    // CRITICAL: seed activePlayerIndex = 0 so the implicit positional
    // assumption of computePacingStats holds — otherwise longestPlayerName
    // would be non-deterministic relative to the spinner.
    const component = postGameOverlay();
    component.$store = {
      game: {
        turn_laps: [60_000, 90_000, 45_000],
        players: [{ name: 'You' }, { name: 'Op1' }, { name: 'Op2' }],
        activePlayerIndex: 0, // pin starting player for positional lap→player mapping
        gameStartedAt: new Date(Date.now() - 195_000).toISOString(),
        currentTurn: 3,
      },
    };
    component._computePacing();
    expect(component.pacing.longestTurnDisplay).toBe('1:30');
    expect(component.pacing.avgTurnDisplay).toBe('1:05');
    // perPlayerAvg sorted slowest first: Op1 (90s) → You (60s) → Op2 (45s)
    expect(component.pacing.perPlayerAvg[0].name).toBe('Op1');
    expect(component.pacing.perPlayerAvg[0].avgDisplay).toBe('1:30');
    expect(component.pacing.perPlayerAvg[1].name).toBe('You');
    expect(component.pacing.perPlayerAvg[1].avgDisplay).toBe('1:00');
    expect(component.pacing.perPlayerAvg[2].name).toBe('Op2');
    expect(component.pacing.perPlayerAvg[2].avgDisplay).toBe('0:45');
  });

  it('TURN PACING section HTML contains x-show guard that evaluates truthy with realistic turn_laps', () => {
    // Render the overlay HTML as a string; confirm the guard is present and
    // the markers for the three tiles are in the markup.
    const html = renderPostGameOverlay();
    // Guard present: turn_laps && turn_laps.length > 0 (with .length check)
    expect(html).toMatch(/x-show=["']\$store\.game\.turn_laps[\s\S]*?length[\s\S]*?>\s*0/);
    // Three tile labels present
    expect(html).toContain('LONGEST TURN');
    expect(html).toContain('AVG TURN');
    expect(html).toContain('PER-PLAYER AVG');
    // Bindings reference the pacing computed state (not turn_laps directly)
    expect(html).toContain('pacing.longestTurnDisplay');
    expect(html).toContain('pacing.avgTurnDisplay');
    expect(html).toContain('pacing.perPlayerAvg');
  });

  it('empty turn_laps: guard uses length > 0 (section hidden for v1.0 saved games)', () => {
    // Regression: x-show="turn_laps && turn_laps.length > 0" must be the guard
    // so legacy games without turn_laps hide the section entirely — NOT
    // length >= 0 which would always be truthy.
    const html = renderPostGameOverlay();
    // The guard literally contains turn_laps && ... turn_laps.length > 0
    expect(html).toMatch(/turn_laps[\s\S]{0,80}?&&[\s\S]{0,80}?turn_laps[\s\S]{0,80}?length/);
    // And it's strictly > 0, not >= 0
    expect(html).toMatch(/turn_laps\.length\s*>\s*0/);
  });
});
