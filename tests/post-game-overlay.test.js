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
