/**
 * Gap detection utility for deck category analysis.
 * Compares tag/type breakdowns against configurable thresholds.
 * Pure function — no side effects, no Alpine dependency.
 */

/**
 * Default gap thresholds for 100-card Commander decks.
 * Community-standard minimums for functional categories.
 */
export const DEFAULT_THRESHOLDS = {
  Ramp: 10,
  Draw: 10,
  Removal: 8,
  'Board Wipe': 3,
  Lands: 36,
};

/**
 * Detect categories where the deck falls below recommended thresholds.
 * @param {Object} analytics - Output from computeDeckAnalytics (needs tagBreakdown, typeBreakdown)
 * @param {Object} thresholds - Category-to-minimum-count map (defaults to DEFAULT_THRESHOLDS)
 * @param {number} deckSize - Total deck size for proportional scaling (default 100)
 * @returns {Array<{category: string, count: number, threshold: number, severity: 'critical'|'warning'}>}
 */
export function detectGaps(analytics, thresholds = DEFAULT_THRESHOLDS, deckSize = 100) {
  const scale = deckSize / 100;
  const gaps = [];

  for (const [category, threshold] of Object.entries(thresholds)) {
    const scaledThreshold = Math.round(threshold * scale);
    let count;

    if (category === 'Lands') {
      count = analytics.typeBreakdown?.Land || 0;
    } else {
      count = analytics.tagBreakdown?.[category] || 0;
    }

    if (count < scaledThreshold) {
      gaps.push({
        category,
        count,
        threshold: scaledThreshold,
        severity: count < scaledThreshold * 0.5 ? 'critical' : 'warning',
      });
    }
  }

  // Sort critical first, then warning
  gaps.sort((a, b) => {
    if (a.severity === b.severity) return 0;
    return a.severity === 'critical' ? -1 : 1;
  });

  return gaps;
}
