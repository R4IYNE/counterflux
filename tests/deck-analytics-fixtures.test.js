/**
 * DECK-02 (Phase 9 Plan 1 Task 1)
 *
 * Validate `computeDeckAnalytics` end-to-end against three hand-derived
 * reference fixtures. Locks mana-curve / colour-distribution / type-breakdown
 * regressions per 09-CONTEXT D-01..D-02 + 09-RESEARCH §"DECK-02 Reference
 * Deck Selection".
 *
 * Fixtures live in `tests/fixtures/decks/{slug}.cards.json` and
 * `tests/fixtures/decks/{slug}.expected.json`.  The .cards.json files use
 * the canonical Alpine deck-store shape `{ card, quantity, tags, owned }`
 * (matches `src/utils/deck-analytics.js` consumption — see existing
 * `tests/deck-analytics.test.js`).
 *
 * Per RESEARCH §1 step 3: "computeDeckAnalytics returns colourPie as raw
 * counts, NOT percentages.  The fixture comparison computes percentages in
 * the test, NOT in production code."
 */
import { describe, it, expect } from 'vitest';
import { computeDeckAnalytics } from '../src/utils/deck-analytics.js';

import krenkoCards from './fixtures/decks/krenko-mob-boss.cards.json' with { type: 'json' };
import krenkoExpected from './fixtures/decks/krenko-mob-boss.expected.json' with { type: 'json' };
import nivMizzetCards from './fixtures/decks/niv-mizzet-parun.cards.json' with { type: 'json' };
import nivMizzetExpected from './fixtures/decks/niv-mizzet-parun.expected.json' with { type: 'json' };
import urDragonCards from './fixtures/decks/the-ur-dragon.cards.json' with { type: 'json' };
import urDragonExpected from './fixtures/decks/the-ur-dragon.expected.json' with { type: 'json' };

/**
 * Convert raw colourPie counts to percentages (per-test math, NOT in prod).
 * @param {{W:number,U:number,B:number,R:number,G:number,C:number}} colourPie
 * @returns {{W:number,U:number,B:number,R:number,G:number,C:number}}
 */
function colourDistFromPie(colourPie) {
  const total = Object.values(colourPie).reduce((a, b) => a + b, 0);
  if (total === 0) return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  const out = {};
  for (const [k, v] of Object.entries(colourPie)) out[k] = v / total;
  return out;
}

describe('DECK-02 fixture: Krenko, Mob Boss (mono-R)', () => {
  const result = computeDeckAnalytics(krenkoCards);

  it('mana curve matches expected exactly', () => {
    expect(result.manaCurve).toEqual(krenkoExpected.mana_curve);
  });

  it('colour distribution matches within 0.01 per bucket (mono-R: R=1.0, others=0)', () => {
    const dist = colourDistFromPie(result.colourPie);
    for (const c of ['W', 'U', 'B', 'R', 'G', 'C']) {
      expect(dist[c]).toBeCloseTo(krenkoExpected.colour_distribution[c], 2);
    }
  });

  it('land count matches', () => {
    expect(result.typeBreakdown.Land).toBe(krenkoExpected.land_count);
  });

  it('total cards == 100 (commander + 99)', () => {
    const totalQty = krenkoCards.reduce((s, e) => s + (e.quantity || 1), 0);
    expect(totalQty).toBe(krenkoExpected.total_cards);
  });
});

describe('DECK-02 fixture: Niv-Mizzet, Parun (UR midrange)', () => {
  const result = computeDeckAnalytics(nivMizzetCards);

  it('mana curve matches expected exactly', () => {
    expect(result.manaCurve).toEqual(nivMizzetExpected.mana_curve);
  });

  it('U:R ratio is balanced (both colours non-trivially represented)', () => {
    const dist = colourDistFromPie(result.colourPie);
    expect(dist.U).toBeGreaterThan(0.2);
    expect(dist.R).toBeGreaterThan(0.2);
    // Off-colour pips should be effectively zero (deck is clean UR)
    expect(dist.W + dist.B + dist.G).toBeLessThan(0.05);
  });

  it('colour distribution matches expected within 0.01 per bucket', () => {
    const dist = colourDistFromPie(result.colourPie);
    for (const c of ['W', 'U', 'B', 'R', 'G', 'C']) {
      expect(dist[c]).toBeCloseTo(nivMizzetExpected.colour_distribution[c], 2);
    }
  });
});

describe('DECK-02 fixture: The Ur-Dragon (5C goodstuff)', () => {
  const result = computeDeckAnalytics(urDragonCards);

  it('mana curve matches expected exactly', () => {
    expect(result.manaCurve).toEqual(urDragonExpected.mana_curve);
  });

  it('all 6 colour buckets non-zero in colour distribution', () => {
    const dist = colourDistFromPie(result.colourPie);
    for (const c of ['W', 'U', 'B', 'R', 'G', 'C']) {
      expect(dist[c]).toBeGreaterThan(0);
    }
  });

  it('average CMC within 0.1 of expected', () => {
    expect(result.averageCmc).toBeCloseTo(urDragonExpected.average_cmc, 1);
  });
});
