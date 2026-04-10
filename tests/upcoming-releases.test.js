import { describe, it, expect } from 'vitest';

/**
 * Upcoming releases filter tests.
 * Tests pure data logic for the dashboard upcoming releases panel.
 */

// Helper: filter and sort upcoming sets (same logic used in dashboard)
function getUpcomingReleases(sets, today) {
  return sets
    .filter(s => s.released_at > today)
    .sort((a, b) => a.released_at.localeCompare(b.released_at))
    .slice(0, 3);
}

describe('Upcoming Releases', () => {
  const today = '2026-04-10';

  describe('filter to future dates only', () => {
    it('excludes past and today released_at dates', () => {
      const sets = [
        { name: 'Past Set', released_at: '2026-01-15' },
        { name: 'Today Set', released_at: '2026-04-10' },
        { name: 'Future Set A', released_at: '2026-06-01' },
        { name: 'Future Set B', released_at: '2026-08-15' },
      ];

      const upcoming = getUpcomingReleases(sets, today);
      expect(upcoming).toHaveLength(2);
      expect(upcoming.every(s => s.released_at > today)).toBe(true);
    });

    it("today's date is strictly excluded", () => {
      const sets = [
        { name: 'Releasing Today', released_at: '2026-04-10' },
      ];

      const upcoming = getUpcomingReleases(sets, today);
      expect(upcoming).toHaveLength(0);
    });
  });

  describe('sort ascending by released_at', () => {
    it('sorts multiple future sets by nearest first', () => {
      const sets = [
        { name: 'Far Set', released_at: '2026-12-01' },
        { name: 'Near Set', released_at: '2026-05-01' },
        { name: 'Mid Set', released_at: '2026-07-15' },
      ];

      const upcoming = getUpcomingReleases(sets, today);
      expect(upcoming[0].name).toBe('Near Set');
      expect(upcoming[1].name).toBe('Mid Set');
      expect(upcoming[2].name).toBe('Far Set');
    });
  });

  describe('limit to 3 results', () => {
    it('returns only first 3 even if more future sets exist', () => {
      const sets = [
        { name: 'Set A', released_at: '2026-05-01' },
        { name: 'Set B', released_at: '2026-06-01' },
        { name: 'Set C', released_at: '2026-07-01' },
        { name: 'Set D', released_at: '2026-08-01' },
        { name: 'Set E', released_at: '2026-09-01' },
      ];

      const upcoming = getUpcomingReleases(sets, today);
      expect(upcoming).toHaveLength(3);
      expect(upcoming[2].name).toBe('Set C');
    });

    it('returns fewer than 3 if less exist', () => {
      const sets = [
        { name: 'Only Set', released_at: '2026-11-01' },
      ];

      const upcoming = getUpcomingReleases(sets, today);
      expect(upcoming).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('returns empty array when no sets', () => {
      const upcoming = getUpcomingReleases([], today);
      expect(upcoming).toHaveLength(0);
    });

    it('returns empty when all sets are past', () => {
      const sets = [
        { name: 'Old A', released_at: '2025-01-01' },
        { name: 'Old B', released_at: '2025-06-01' },
      ];

      const upcoming = getUpcomingReleases(sets, today);
      expect(upcoming).toHaveLength(0);
    });
  });
});
