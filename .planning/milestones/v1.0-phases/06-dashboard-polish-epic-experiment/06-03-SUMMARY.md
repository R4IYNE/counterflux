---
phase: 06-dashboard-polish-epic-experiment
plan: 03
subsystem: ui
tags: [alpine.js, dashboard, sparkline, quick-add, dexie, currency]

requires:
  - phase: 06-01
    provides: activity logger, connectivity utility, undo store
  - phase: 06-02
    provides: keyboard shortcut modal, Ctrl+Z handler
  - phase: 05
    provides: market store, sets service, price history, game store

provides:
  - Full Epic Experiment dashboard screen with 7 panels
  - Portfolio summary with GBP value, sparkline, change badge
  - Quick Add bar with autocomplete, condition/foil controls
  - Deck quick-launch grid with commander art thumbnails
  - Activity timeline with day grouping and relative timestamps
  - Mila daily insight panel from EDHREC synergy data
  - Price alerts panel from market store pending alerts
  - Upcoming releases panel from Scryfall sets service
  - Dashboard as default landing page (/ route)

affects: [06-04-final-polish]

tech-stack:
  added: []
  patterns: [dashboard-imperative-dom, portfolio-history-snapshot, reactive-panel-updates]

key-files:
  created:
    - src/screens/epic-experiment.js
    - tests/dashboard-portfolio.test.js
    - tests/quick-add.test.js
    - tests/dashboard-decks.test.js
    - tests/upcoming-releases.test.js
  modified:
    - src/stores/app.js
    - src/router.js
    - src/main.js
    - tests/router.test.js

key-decisions:
  - "Portfolio history stored in db.meta with daily snapshots, 90-day cap, keyed by YYYY-MM-DD"
  - "Activity timeline refreshes every 30 seconds via setInterval"
  - "Deck grid loads commander art directly from IndexedDB card data"
  - "Quick Add uses 150ms debounce with Dexie startsWithIgnoreCase for autocomplete"
  - "Router / route changed from welcome to epic-experiment as default landing page"

patterns-established:
  - "Dashboard panels use imperative DOM with Alpine.effect() for reactive updates"
  - "Panel cleanup functions collected in array and called on screen unmount"

requirements-completed: [DASH-01, DASH-02, DASH-03, DASH-04, DASH-06, DASH-07]

duration: 7min
completed: 2026-04-10
---

# Phase 6 Plan 3: Epic Experiment Dashboard Summary

**Full 7-panel dashboard command centre with portfolio summary, Quick Add, deck grid, activity timeline, Mila insights, price alerts, and upcoming releases -- wired to all existing stores and services**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-10T08:06:30Z
- **Completed:** 2026-04-10T08:13:10Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Dashboard renders as the default landing page with full 3-column grid layout
- Portfolio summary shows total GBP value (Syne 48px display), SVG sparkline, 7-day change badge, unique/total counts, and inline Quick Add bar with autocomplete
- All 7 panels populated from live store data with empty states following UI-SPEC copywriting contract

## Task Commits

Each task was committed atomically:

1. **Task 1: Dashboard data tests** - `79b5ac4` (test)
2. **Task 2: Dashboard screen, portfolio, Quick Add, routing** - `484cffd` (feat)
3. **Task 3: Lower panels -- deck grid, activity, Mila, alerts, releases** - `4582f18` (feat)

## Files Created/Modified
- `src/screens/epic-experiment.js` - Full dashboard screen with 7 panels, ~540 lines
- `src/stores/app.js` - Unlocked Epic Experiment (locked: false)
- `src/router.js` - Default route / maps to epic-experiment
- `src/main.js` - Added initUndoStore() to init sequence
- `tests/dashboard-portfolio.test.js` - Portfolio stats, sparkline, change computation tests
- `tests/quick-add.test.js` - parseBatchLine syntax parsing tests
- `tests/dashboard-decks.test.js` - Deck sorting, art_crop extraction, count format tests
- `tests/upcoming-releases.test.js` - Future date filter, sort, limit tests
- `tests/router.test.js` - Updated for new ROUTE_MAP and dashboard content

## Decisions Made
- Portfolio history stored as daily snapshots in db.meta (90-day cap) for sparkline data
- Activity timeline uses 30-second polling interval for updates
- Quick Add autocomplete queries Dexie directly (db.cards.where('name').startsWithIgnoreCase) rather than using the search store, for speed and simplicity
- Changed default landing from welcome screen to dashboard

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed router.test.js expectations for new routing**
- **Found during:** Task 2 (routing changes)
- **Issue:** Existing router tests expected '/' to map to 'welcome' and epic-experiment content to show "Dashboard Coming Soon"
- **Fix:** Updated test assertions to match new ROUTE_MAP and dashboard content, added Alpine store mocks for jsdom test environment
- **Files modified:** tests/router.test.js
- **Verification:** All router tests pass
- **Committed in:** 484cffd (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary to keep existing test suite passing after routing changes. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all panels are fully implemented with live data wiring and empty states.

## Next Phase Readiness
- Dashboard fully functional, ready for Plan 04 (final polish, status chip, keyboard shortcuts integration)
- All stores and services wired and reactive

---
*Phase: 06-dashboard-polish-epic-experiment*
*Completed: 2026-04-10*
