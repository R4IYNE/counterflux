---
phase: 04-intelligence-layer
plan: 02
subsystem: api
tags: [commander-spellbook, gap-detection, combo-detection, tdd]

# Dependency graph
requires:
  - phase: 03-deck-builder-thousand-year-storm
    provides: computeDeckAnalytics with tagBreakdown/typeBreakdown, tag-heuristics DEFAULT_TAGS
provides:
  - Commander Spellbook API client (findDeckCombos)
  - Gap detection utility (detectGaps, DEFAULT_THRESHOLDS)
  - Spellbook API test fixture
affects: [04-03 intelligence store orchestration, 04-04 analytics panel UI wiring]

# Tech tracking
tech-stack:
  added: []
  patterns: [pure service with graceful degradation, threshold-based gap analysis with proportional scaling]

key-files:
  created:
    - src/services/spellbook.js
    - src/utils/gap-detection.js
    - tests/fixtures/spellbook-combos.json
    - tests/spellbook-service.test.js
    - tests/gap-detection.test.js
  modified: []

key-decisions:
  - "Spellbook mapCombo includes zoneLocations for future UI display of combo zone requirements"
  - "Gap detection sorts results critical-first for UI priority rendering"

patterns-established:
  - "External API services return safe fallback objects on failure ({ included: [], error: true })"
  - "Gap thresholds use proportional scaling (deckSize/100) for format-agnostic analysis"

requirements-completed: [INTEL-02, INTEL-03, INTEL-04]

# Metrics
duration: 3min
completed: 2026-04-06
---

# Phase 4 Plan 02: Spellbook Combo Detection and Gap Analysis Summary

**Commander Spellbook combo/near-miss detection service and 5-category gap threshold utility with TDD coverage**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-06T19:03:02Z
- **Completed:** 2026-04-06T19:06:30Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Spellbook service fetches and maps combo data with { card: name } wrapping (Pitfall 2 avoided)
- Near-miss combos (almostIncluded) identified separately from full combos
- Gap detection covers Ramp/Draw/Removal/Board Wipe/Lands with proportional scaling for 60-card formats
- 16 passing tests across both services

## Task Commits

Each task was committed atomically:

1. **Task 1: Commander Spellbook service with combo mapping** - `1fe9c93` (feat)
2. **Task 2: Gap detection utility with configurable thresholds** - `d011052` (feat)

## Files Created/Modified
- `src/services/spellbook.js` - Commander Spellbook API client with findDeckCombos and mapCombo
- `src/utils/gap-detection.js` - Gap detection pure function with DEFAULT_THRESHOLDS and detectGaps
- `tests/fixtures/spellbook-combos.json` - Verified Spellbook API response fixture with included/almostIncluded
- `tests/spellbook-service.test.js` - 6 tests: request format, combo mapping, near-miss, error handling
- `tests/gap-detection.test.js` - 10 tests: thresholds, severity, scaling, Lands via typeBreakdown

## Decisions Made
- Spellbook mapCombo includes zoneLocations field (not in research code example) for future combo zone display
- Gap detection sorts results critical-first for priority rendering in analytics panel

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Spellbook service ready for intelligence store orchestration (Plan 03)
- Gap detection ready for analytics panel integration (Plan 04)
- Both services degrade gracefully on failure, won't block deck builder

## Self-Check: PASSED

- All 5 created files verified on disk
- Commit 1fe9c93 (Task 1) verified in git log
- Commit d011052 (Task 2) verified in git log
- 16/16 tests passing

---
*Phase: 04-intelligence-layer*
*Completed: 2026-04-06*
