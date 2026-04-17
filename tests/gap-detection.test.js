import { describe, it, expect } from 'vitest';
import {
  detectGaps,
  DEFAULT_THRESHOLDS,
  detectGapsRAG,
  RAG_THRESHOLDS,
  getCreatureThresholds,
} from '../src/utils/gap-detection.js';

describe('gap detection', () => {
  const healthyAnalytics = {
    tagBreakdown: { Ramp: 12, Draw: 11, Removal: 9, 'Board Wipe': 4 },
    typeBreakdown: { Land: 37, Creature: 30 },
  };

  const gappyAnalytics = {
    tagBreakdown: { Ramp: 3, Draw: 5, Removal: 9, 'Board Wipe': 1 },
    typeBreakdown: { Land: 30, Creature: 40 },
  };

  describe('DEFAULT_THRESHOLDS', () => {
    it('contains exactly 5 entries: Ramp 10, Draw 10, Removal 8, Board Wipe 3, Lands 36', () => {
      expect(Object.keys(DEFAULT_THRESHOLDS)).toHaveLength(5);
      expect(DEFAULT_THRESHOLDS.Ramp).toBe(10);
      expect(DEFAULT_THRESHOLDS.Draw).toBe(10);
      expect(DEFAULT_THRESHOLDS.Removal).toBe(8);
      expect(DEFAULT_THRESHOLDS['Board Wipe']).toBe(3);
      expect(DEFAULT_THRESHOLDS.Lands).toBe(36);
    });
  });

  describe('detectGaps', () => {
    it('returns empty array when all categories meet thresholds', () => {
      const gaps = detectGaps(healthyAnalytics);
      expect(gaps).toEqual([]);
    });

    it('returns warning for Ramp when count is below threshold', () => {
      const analytics = {
        tagBreakdown: { Ramp: 5, Draw: 11, Removal: 9, 'Board Wipe': 4 },
        typeBreakdown: { Land: 37 },
      };
      const gaps = detectGaps(analytics);
      const rampGap = gaps.find((g) => g.category === 'Ramp');
      expect(rampGap).toBeDefined();
      expect(rampGap.count).toBe(5);
      expect(rampGap.threshold).toBe(10);
    });

    it('returns critical severity when count is below 50% of threshold', () => {
      const gaps = detectGaps(gappyAnalytics);
      const rampGap = gaps.find((g) => g.category === 'Ramp');
      expect(rampGap).toBeDefined();
      expect(rampGap.severity).toBe('critical');
      expect(rampGap.count).toBe(3);
    });

    it('returns warning severity when count is 50-99% of threshold', () => {
      const analytics = {
        tagBreakdown: { Ramp: 7, Draw: 11, Removal: 9, 'Board Wipe': 4 },
        typeBreakdown: { Land: 37 },
      };
      const gaps = detectGaps(analytics);
      const rampGap = gaps.find((g) => g.category === 'Ramp');
      expect(rampGap).toBeDefined();
      expect(rampGap.severity).toBe('warning');
    });

    it('uses typeBreakdown.Land for Lands gap, not tagBreakdown', () => {
      const analytics = {
        tagBreakdown: { Ramp: 12, Draw: 11, Removal: 9, 'Board Wipe': 4, Lands: 99 },
        typeBreakdown: { Land: 30 },
      };
      const gaps = detectGaps(analytics);
      const landsGap = gaps.find((g) => g.category === 'Lands');
      expect(landsGap).toBeDefined();
      expect(landsGap.count).toBe(30);
      expect(landsGap.threshold).toBe(36);
    });

    it('scales thresholds for 60-card decks', () => {
      const analytics = {
        tagBreakdown: { Ramp: 5, Draw: 7, Removal: 5, 'Board Wipe': 2 },
        typeBreakdown: { Land: 21 },
      };
      // 60/100 = 0.6 scale: Ramp threshold = round(10*0.6) = 6
      const gaps = detectGaps(analytics, DEFAULT_THRESHOLDS, 60);
      const rampGap = gaps.find((g) => g.category === 'Ramp');
      expect(rampGap).toBeDefined();
      expect(rampGap.threshold).toBe(6);
      expect(rampGap.count).toBe(5);
    });

    it('accepts custom thresholds that override defaults', () => {
      const customThresholds = { Ramp: 15 };
      const analytics = {
        tagBreakdown: { Ramp: 12 },
        typeBreakdown: {},
      };
      const gaps = detectGaps(analytics, customThresholds);
      expect(gaps).toHaveLength(1);
      expect(gaps[0].category).toBe('Ramp');
      expect(gaps[0].threshold).toBe(15);
    });

    it('returns gaps sorted by severity (critical first)', () => {
      const gaps = detectGaps(gappyAnalytics);
      const criticalIdx = gaps.findIndex((g) => g.severity === 'critical');
      const warningIdx = gaps.findIndex((g) => g.severity === 'warning');
      if (criticalIdx !== -1 && warningIdx !== -1) {
        expect(criticalIdx).toBeLessThan(warningIdx);
      }
    });

    it('returns objects with { category, count, threshold, severity } shape', () => {
      const gaps = detectGaps(gappyAnalytics);
      expect(gaps.length).toBeGreaterThan(0);
      for (const gap of gaps) {
        expect(gap).toHaveProperty('category');
        expect(gap).toHaveProperty('count');
        expect(gap).toHaveProperty('threshold');
        expect(gap).toHaveProperty('severity');
        expect(['critical', 'warning']).toContain(gap.severity);
      }
    });
  });
});

// ============================================================================
// DECK-03: Three-tier RAG gap detection (Phase 9 Plan 1 Task 3)
// Per 09-CONTEXT D-03 + 09-RESEARCH §"DECK-03 Per-Category Dynamic RAG
// Thresholds" — derived from EDHREC + Draftsim + Burgess formula + Frank
// Karsten ramp/draw baselines.
// ============================================================================

describe('RAG_THRESHOLDS export (DECK-03)', () => {
  it('contains Ramp / Card Draw / Draw / Removal / Board Wipe / Lands keys with { green, amber } shape', () => {
    expect(RAG_THRESHOLDS.Ramp).toEqual({ green: 10, amber: 6 });
    expect(RAG_THRESHOLDS['Card Draw']).toEqual({ green: 10, amber: 6 });
    expect(RAG_THRESHOLDS.Draw).toEqual({ green: 10, amber: 6 });
    expect(RAG_THRESHOLDS.Removal).toEqual({ green: 8, amber: 6 });
    expect(RAG_THRESHOLDS['Board Wipe']).toEqual({ green: 3, amber: 2 });
    expect(RAG_THRESHOLDS.Lands).toEqual({ green: 36, amber: 33 });
  });
});

describe('detectGapsRAG severity tiers (DECK-03)', () => {
  it('Ramp count 4 → red severity, suggestedAdd 6 (10 green - 4 count)', () => {
    const gaps = detectGapsRAG({ tagBreakdown: { Ramp: 4 }, typeBreakdown: {} });
    const ramp = gaps.find((g) => g.category === 'Ramp');
    expect(ramp).toBeDefined();
    expect(ramp.severity).toBe('red');
    expect(ramp.suggestedAdd).toBe(6);
  });

  it('Ramp count 7 → amber severity, suggestedAdd 3 (10 green - 7 count)', () => {
    const gaps = detectGapsRAG({ tagBreakdown: { Ramp: 7 }, typeBreakdown: {} });
    const ramp = gaps.find((g) => g.category === 'Ramp');
    expect(ramp).toBeDefined();
    expect(ramp.severity).toBe('amber');
    expect(ramp.suggestedAdd).toBe(3);
  });

  it('Ramp count 12 → green severity, suggestedAdd 0', () => {
    const gaps = detectGapsRAG({ tagBreakdown: { Ramp: 12 }, typeBreakdown: {} });
    const ramp = gaps.find((g) => g.category === 'Ramp');
    expect(ramp).toBeDefined();
    expect(ramp.severity).toBe('green');
    expect(ramp.suggestedAdd).toBe(0);
  });

  it('Lands count 30 → red, threshold 36 (uses typeBreakdown.Land, not tagBreakdown)', () => {
    const gaps = detectGapsRAG({ tagBreakdown: {}, typeBreakdown: { Land: 30 } });
    const lands = gaps.find((g) => g.category === 'Lands');
    expect(lands).toBeDefined();
    expect(lands.severity).toBe('red');
    expect(lands.suggestedAdd).toBe(6);
    expect(lands.threshold).toBe(36);
  });

  it('Removal count 7 → amber (6 ≤ count < 8 = green)', () => {
    const gaps = detectGapsRAG({ tagBreakdown: { Removal: 7 }, typeBreakdown: {} });
    const removal = gaps.find((g) => g.category === 'Removal');
    expect(removal.severity).toBe('amber');
    expect(removal.suggestedAdd).toBe(1);
  });

  it('returns gaps sorted red → amber → green', () => {
    const gaps = detectGapsRAG({
      tagBreakdown: { Ramp: 4, 'Card Draw': 12, Removal: 7 },
      typeBreakdown: { Land: 36 },
    });
    const order = { red: 0, amber: 1, green: 2 };
    for (let i = 0; i < gaps.length - 1; i++) {
      expect(order[gaps[i].severity]).toBeLessThanOrEqual(order[gaps[i + 1].severity]);
    }
  });

  it('scales thresholds for 60-card decks', () => {
    const gaps = detectGapsRAG(
      { tagBreakdown: { Ramp: 5 }, typeBreakdown: {} },
      RAG_THRESHOLDS,
      [],
      60,
    );
    const ramp = gaps.find((g) => g.category === 'Ramp');
    // 60/100 scale: green = round(10*0.6) = 6, amber = round(6*0.6) = 4.
    // count 5 falls in [4,6) → amber severity, suggestedAdd 6 - 5 = 1.
    expect(ramp.threshold).toBe(6);
    expect(ramp.severity).toBe('amber');
    expect(ramp.suggestedAdd).toBe(1);
  });

  it('emits objects with { category, count, threshold, severity, suggestedAdd } shape', () => {
    const gaps = detectGapsRAG({
      tagBreakdown: { Ramp: 4 },
      typeBreakdown: { Land: 36 },
    });
    expect(gaps.length).toBeGreaterThan(0);
    for (const gap of gaps) {
      expect(gap).toHaveProperty('category');
      expect(gap).toHaveProperty('count');
      expect(gap).toHaveProperty('threshold');
      expect(gap).toHaveProperty('severity');
      expect(gap).toHaveProperty('suggestedAdd');
      expect(['red', 'amber', 'green']).toContain(gap.severity);
      expect(typeof gap.suggestedAdd).toBe('number');
    }
  });
});

describe('getCreatureThresholds archetype switch (DECK-03)', () => {
  it('Tribal tag → green 30 / amber 20', () => {
    expect(getCreatureThresholds(['Tribal'])).toEqual({ green: 30, amber: 20 });
  });

  it('Aggro tag → green 30 / amber 20', () => {
    expect(getCreatureThresholds(['Aggro'])).toEqual({ green: 30, amber: 20 });
  });

  it('Spellslinger tag → green 12 / amber 8', () => {
    expect(getCreatureThresholds(['Spellslinger'])).toEqual({ green: 12, amber: 8 });
  });

  it('Control tag → green 12 / amber 8', () => {
    expect(getCreatureThresholds(['Control'])).toEqual({ green: 12, amber: 8 });
  });

  it('default (no recognised tags) → green 20 / amber 12', () => {
    expect(getCreatureThresholds([])).toEqual({ green: 20, amber: 12 });
    expect(getCreatureThresholds(['SomethingRandom'])).toEqual({ green: 20, amber: 12 });
  });

  it('case-insensitive matching', () => {
    expect(getCreatureThresholds(['tribal'])).toEqual({ green: 30, amber: 20 });
    expect(getCreatureThresholds(['SPELLSLINGER'])).toEqual({ green: 12, amber: 8 });
  });
});

describe('detectGapsRAG creature category (DECK-03)', () => {
  it('Tribal deck with 25 creatures → amber (≥ 20 amber, < 30 green)', () => {
    const gaps = detectGapsRAG(
      { tagBreakdown: {}, typeBreakdown: { Creature: 25 } },
      RAG_THRESHOLDS,
      ['Tribal'],
    );
    const creature = gaps.find((g) => g.category === 'Creatures');
    expect(creature).toBeDefined();
    expect(creature.severity).toBe('amber');
    expect(creature.suggestedAdd).toBe(5);
  });

  it('Spellslinger deck with 10 creatures → amber (8 amber, < 12 green)', () => {
    const gaps = detectGapsRAG(
      { tagBreakdown: {}, typeBreakdown: { Creature: 10 } },
      RAG_THRESHOLDS,
      ['Spellslinger'],
    );
    const creature = gaps.find((g) => g.category === 'Creatures');
    expect(creature).toBeDefined();
    expect(creature.severity).toBe('amber');
    expect(creature.suggestedAdd).toBe(2);
  });

  it('default-archetype deck with 8 creatures → red (< 12 amber)', () => {
    const gaps = detectGapsRAG(
      { tagBreakdown: {}, typeBreakdown: { Creature: 8 } },
      RAG_THRESHOLDS,
      [],
    );
    const creature = gaps.find((g) => g.category === 'Creatures');
    expect(creature.severity).toBe('red');
    expect(creature.suggestedAdd).toBe(12);
  });
});
