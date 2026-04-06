import { describe, it, expect } from 'vitest';
import { detectGaps, DEFAULT_THRESHOLDS } from '../src/utils/gap-detection.js';

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
