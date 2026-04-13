---
phase: 02-collection-manager-treasure-cruise
plan: 04
subsystem: collection, analytics, import-export
tags: [papaparse, chart.js, csv, doughnut-chart, bar-chart, alpine.js]

requires:
  - phase: 02-collection-manager-treasure-cruise/02-01
    provides: "Dexie collection table, Alpine collection store, addCard/addBatch methods"
  - phase: 02-collection-manager-treasure-cruise/02-02
    provides: "Gallery/table views, filter bar with action buttons"
  - phase: 02-collection-manager-treasure-cruise/02-03
    provides: "Mass entry panel, context menu, edit/delete modals"
provides:
  - "CSV import with auto-detection for Deckbox, Moxfield, Archidekt, and generic formats"
  - "CSV export with PapaParse generating downloadable file"
  - "Analytics panel with Chart.js colour doughnut, rarity bar, top sets horizontal bar, top 10 valuable list"
  - "Pure computation functions for colour breakdown, rarity breakdown, top sets, top valuable"
affects: [03-deck-builder]

tech-stack:
  added: [papaparse (CSV parsing/generation)]
  patterns: [PapaParse Papa.unparse with explicit fields for empty data, Chart.js tree-shaken import, chart destroy on panel close]

key-files:
  created:
    - src/services/csv-import.js
    - src/services/csv-export.js
    - src/components/csv-import-modal.js
    - src/components/analytics-panel.js
  modified:
    - src/screens/treasure-cruise.js
    - tests/csv-import.test.js
    - tests/csv-export.test.js
    - tests/analytics.test.js

key-decisions:
  - "PapaParse unparse needs explicit fields array for empty data (otherwise no header row)"
  - "Analytics computation functions exported as pure functions separate from Chart.js rendering for testability"
  - "Chart.js tree-shaken: only DoughnutController + BarController registered"

patterns-established:
  - "CSV format auto-detection by column header signature matching (moxfield before deckbox due to superset)"
  - "Chart.js cleanup pattern: store instances in module-level array, destroy() all on panel close"
  - "Export wired via custom DOM event (export-csv) for decoupled cross-component communication"

requirements-completed: [COLL-08, COLL-09, COLL-10]

duration: 7min
completed: 2026-04-04
---

# Phase 02 Plan 04: CSV Import/Export and Collection Analytics Summary

**CSV import auto-detecting Deckbox/Moxfield/Archidekt/generic formats via PapaParse, CSV export with downloadable file, and Chart.js analytics panel with colour/rarity/set/value breakdowns**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-04T22:18:03Z
- **Completed:** 2026-04-04T22:25:26Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- CSV import service with format auto-detection (Deckbox, Moxfield, Archidekt, generic) and DFC name normalisation
- CSV export generating downloadable file with proper quoting for card names containing commas
- Import modal with file picker, auto-detect display, preview table, and column mapping for generic format
- Analytics panel with Chart.js doughnut (colour), bar (rarity), horizontal bar (top sets), and list (top 10 valuable)
- 24 tests passing across 3 test files

## Task Commits

Each task was committed atomically:

1. **Task 1: CSV import/export services + import modal + tests** (TDD)
   - `8cbab34` (test: add failing tests for CSV import/export)
   - `0aa9e8a` (feat: CSV import/export services, import modal, export wiring)
2. **Task 2: Analytics panel with Chart.js charts + tests**
   - `94a1a73` (feat: analytics panel with Chart.js charts and computation functions)

## Files Created/Modified
- `src/services/csv-import.js` - CSV parsing, format detection (detectFormat), row normalisation (normaliseRow), card resolution (resolveImportEntries)
- `src/services/csv-export.js` - CSV generation (generateCSV) and browser download trigger (exportCollection)
- `src/components/csv-import-modal.js` - Import modal with file picker, format detection display, preview table, column mapping
- `src/components/analytics-panel.js` - Chart.js analytics: colour doughnut, rarity bar, top sets horizontal bar, top 10 valuable list; pure computation functions
- `src/screens/treasure-cruise.js` - Wired import modal, analytics panel, export-csv event listener
- `tests/csv-import.test.js` - 7 tests for format detection and row normalisation
- `tests/csv-export.test.js` - 3 tests for CSV generation including comma quoting and empty collection
- `tests/analytics.test.js` - 10 tests for colour breakdown, rarity breakdown, top sets, top valuable

## Decisions Made
- PapaParse `Papa.unparse()` returns empty string for empty arrays; fixed by passing explicit `{ fields, data }` object to ensure header row is always present
- Analytics computation functions are pure (take entries array, return data) and exported separately from Chart.js rendering for unit testability
- Chart.js tree-shaken import: only DoughnutController and BarController registered, saving ~40KB vs full bundle
- Test assertions use `.trim()` and `/\r?\n/` split to handle PapaParse CRLF line endings cross-platform

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PapaParse empty data header handling**
- **Found during:** Task 1 (CSV export tests)
- **Issue:** `Papa.unparse([])` returns empty string with no header row, causing test failure
- **Fix:** Changed to `Papa.unparse({ fields: EXPORT_COLUMNS, data: rows })` to explicitly specify column headers
- **Files modified:** src/services/csv-export.js
- **Verification:** Empty collection test now generates header-only CSV
- **Committed in:** 0aa9e8a (Task 1 commit)

**2. [Rule 1 - Bug] Cross-platform line ending handling in tests**
- **Found during:** Task 1 (CSV export tests)
- **Issue:** PapaParse outputs `\r\n` line endings on Windows, causing `.split('\n')` to leave trailing `\r` in comparisons
- **Fix:** Tests use `.trim()` and `.split(/\r?\n/)` for cross-platform compatibility
- **Files modified:** tests/csv-export.test.js
- **Verification:** All 3 export tests pass on Windows
- **Committed in:** 0aa9e8a (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
- npm dependencies not installed in worktree (papaparse listed in package.json but node_modules missing); resolved with `npm install`

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all data sources are wired to the collection store entries.

## Next Phase Readiness
- CSV import/export and analytics complete; Collection Manager (Treasure Cruise) screen now has full feature set
- Plan 05 (if any remaining) can build on this foundation
- Phase 3 (Deck Builder) can use the same CSV/export patterns

## Self-Check: PASSED

All 7 created files verified present. All 3 commit hashes verified in git log.

---
*Phase: 02-collection-manager-treasure-cruise*
*Completed: 2026-04-04*
