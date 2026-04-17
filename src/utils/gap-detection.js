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

// ============================================================================
// DECK-03 (Phase 9 Plan 1 Task 3): Three-tier RAG gap detection.
//
// Per-category thresholds derived during 09-RESEARCH §"DECK-03 Per-Category
// Dynamic RAG Thresholds" from:
//   • Lands  — Burgess formula 31 + colours + commander CMC; EDHREC database
//              average is 31 (anaemic per their own analysis); Draftsim
//              baseline is 37–38. We pick green ≥ 36, amber 33–35, red < 33.
//   • Ramp   — Draftsim "How much ramp in a Commander deck" data: low-curve
//              decks ≥ 6, high-curve ≥ 10–12. Green ≥ 10, amber 6–9, red < 6.
//   • Card Draw — Frank Karsten / community baseline. Green ≥ 10, amber 6–9.
//   • Removal — EDHREC default = 8; community floor = 6 (4 single-target +
//              2 mass-removal). Green ≥ 8, amber 6–7, red < 6.
//   • Board Wipe — EDHREC default = 3, floor = 2. Green ≥ 3, amber = 2,
//                  red < 2.
//   • Creatures — archetype-aware (see getCreatureThresholds below).
//
// Sources cited inline. The tier definitions are:
//   count >= green   → severity 'green' (renderer hides this; no badge)
//   amber <= count < green → severity 'amber' (renders `[AMBER] +N`)
//   count < amber    → severity 'red'   (renders `[RED] +N`)
// `suggestedAdd` is always `green - count` (gap to ideal, not to amber).
// ============================================================================

/**
 * Per-category RAG thresholds. Each entry carries `{ green, amber }`.
 * `Draw` is preserved as an alias for `Card Draw` because the deck-analytics
 * `tagBreakdown` may surface either form depending on the suggestTags
 * heuristic version that produced the deck's tags.
 */
export const RAG_THRESHOLDS = {
  Ramp:        { green: 10, amber: 6 },
  'Card Draw': { green: 10, amber: 6 },
  Draw:        { green: 10, amber: 6 },
  Removal:     { green: 8,  amber: 6 },
  'Board Wipe':{ green: 3,  amber: 2 },
  Lands:       { green: 36, amber: 33 },
};

/**
 * Resolve creature-count thresholds from the deck's strategy tags.
 *
 * @param {string[]} deckTags
 * @returns {{green: number, amber: number}}
 */
export function getCreatureThresholds(deckTags = []) {
  const tags = (deckTags || []).map((t) => String(t).toLowerCase());
  if (tags.some((t) => ['tribal', 'creatures', 'aggro'].includes(t))) {
    return { green: 30, amber: 20 };
  }
  if (tags.some((t) => ['spellslinger', 'control', 'combo'].includes(t))) {
    return { green: 12, amber: 8 };
  }
  return { green: 20, amber: 12 };
}

/**
 * Resolve the count value for a given gap category from analytics.
 * Lands read from typeBreakdown.Land; everything else from tagBreakdown[category].
 *
 * @param {string} category
 * @param {Object} analytics
 * @returns {number}
 */
function resolveCount(category, analytics) {
  if (category === 'Lands') return analytics?.typeBreakdown?.Land || 0;
  if (category === 'Creatures') return analytics?.typeBreakdown?.Creature || 0;
  return analytics?.tagBreakdown?.[category] || 0;
}

/**
 * Three-tier RAG gap detection. Emits one entry per category in
 * `ragThresholds` plus a `Creatures` entry derived from `deckTags`.
 *
 * @param {Object} analytics      computeDeckAnalytics output (typeBreakdown +
 *                                tagBreakdown).
 * @param {Object} ragThresholds  Override map; defaults to RAG_THRESHOLDS.
 * @param {string[]} deckTags     Deck strategy tags driving the creature
 *                                threshold pick.
 * @param {number} deckSize       Deck size for proportional scaling
 *                                (default 100 — Commander).
 * @returns {Array<{category: string, count: number, threshold: number,
 *                  severity: 'red'|'amber'|'green', suggestedAdd: number}>}
 */
export function detectGapsRAG(
  analytics,
  ragThresholds = RAG_THRESHOLDS,
  deckTags = [],
  deckSize = 100,
) {
  const scale = deckSize / 100;
  const gaps = [];

  // Standard categories
  for (const [category, { green, amber }] of Object.entries(ragThresholds)) {
    const scaledGreen = Math.round(green * scale);
    const scaledAmber = Math.round(amber * scale);
    const count = resolveCount(category, analytics);

    let severity;
    if (count >= scaledGreen) severity = 'green';
    else if (count >= scaledAmber) severity = 'amber';
    else severity = 'red';

    gaps.push({
      category,
      count,
      threshold: scaledGreen,
      severity,
      suggestedAdd: Math.max(0, scaledGreen - count),
    });
  }

  // Archetype-aware Creatures category (separate from the static map so the
  // override surface is a single function, not a thresholds-clone).
  const cThresh = getCreatureThresholds(deckTags);
  const cGreen = Math.round(cThresh.green * scale);
  const cAmber = Math.round(cThresh.amber * scale);
  const cCount = resolveCount('Creatures', analytics);
  let cSeverity;
  if (cCount >= cGreen) cSeverity = 'green';
  else if (cCount >= cAmber) cSeverity = 'amber';
  else cSeverity = 'red';
  gaps.push({
    category: 'Creatures',
    count: cCount,
    threshold: cGreen,
    severity: cSeverity,
    suggestedAdd: Math.max(0, cGreen - cCount),
  });

  // Sort red → amber → green so the renderer ships the worst first.
  const order = { red: 0, amber: 1, green: 2 };
  gaps.sort((a, b) => order[a.severity] - order[b.severity]);

  return gaps;
}
