---
phase: 02-collection-manager-treasure-cruise
plan: 01
subsystem: database
tags: [dexie, indexeddb, alpine-store, collection, papaparse, chartjs]

requires:
  - phase: 01-foundation-data-layer
    provides: Dexie v1 schema with cards/meta tables, Alpine store pattern, card-accessor utilities
provides:
  - Dexie v2 schema with collection table (++id, scryfall_id, category, foil, compound indexes)
  - Alpine collection store with CRUD, filter, sort, stats
  - PapaParse and Chart.js dependencies installed
  - Phase 2 test scaffolds for all remaining plans
affects: [02-02, 02-03, 02-04, 02-05, treasure-cruise-screen, deck-builder]

tech-stack:
  added: [papaparse, chart.js]
  patterns: [collection-store-as-plain-object-for-tests, foil-as-0/1-number-for-indexeddb, object-freeze-card-metadata]

key-files:
  created: [src/stores/collection.js, tests/collection-store.test.js, tests/mass-entry.test.js, tests/csv-import.test.js, tests/csv-export.test.js, tests/analytics.test.js, tests/set-completion.test.js, tests/virtual-scroller.test.js]
  modified: [src/db/schema.js, src/stores/app.js, package.json]

key-decisions:
  - "Foil stored as 0/1 number (not boolean) because IndexedDB cannot index booleans"
  - "Object.freeze() on card metadata prevents Alpine deep-proxying overhead"
  - "Collection store tested as plain object (no Alpine runtime in tests)"
  - "Colour filter uses every() (card must have ALL selected colours) not some()"

patterns-established:
  - "Collection store pattern: plain object with Dexie queries, getters for filtered/sorted/stats"
  - "TDD for data layer: failing tests first, then implementation"

requirements-completed: [COLL-01, COLL-07, COLL-11, COLL-12]

duration: 4min
completed: 2026-04-04
---

# Phase 2 Plan 1: Collection Data Layer Summary

**Dexie v2 collection table with Alpine store providing CRUD, category/colour filtering, multi-field sorting, and portfolio stats**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-04T21:48:44Z
- **Completed:** 2026-04-04T21:52:44Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Dexie schema v2 with collection table supporting compound indexes for duplicate detection and category queries
- Full collection store: addCard (with duplicate merge), editEntry, deleteEntry, loadEntries with card join, filtered/sorted/stats getters
- 14 passing unit tests covering all CRUD operations, filtering, sorting, and stats computation
- All 6 Phase 2 test scaffold files created with describe blocks and todo stubs
- PapaParse and Chart.js dependencies installed

## Task Commits

Each task was committed atomically:

1. **Task 1: Dexie schema v2 + collection store + tests** - `231388e` (feat) [TDD: red `->` green]
2. **Task 2: Scaffold remaining Phase 2 test files** - `7f1fbcf` (test)

## Files Created/Modified
- `src/db/schema.js` - Added db.version(2) with collection table
- `src/stores/collection.js` - Alpine collection store with CRUD, filter, sort, stats
- `src/stores/app.js` - Unlocked Treasure Cruise screen (locked: false)
- `tests/collection-store.test.js` - 14 unit tests for collection store
- `tests/mass-entry.test.js` - Batch parser test scaffolds
- `tests/csv-import.test.js` - CSV import test scaffolds
- `tests/csv-export.test.js` - CSV export test scaffolds
- `tests/analytics.test.js` - Analytics computation test scaffolds
- `tests/set-completion.test.js` - Set completion test scaffolds
- `tests/virtual-scroller.test.js` - Virtual scroller test scaffolds
- `package.json` - Added papaparse and chart.js dependencies

## Decisions Made
- Foil stored as 0/1 number because IndexedDB cannot index boolean values (Pitfall 1 from research)
- Object.freeze() on joined card metadata to prevent Alpine from creating deep proxies on read-only Scryfall data
- Colour filter requires ALL selected colours (every()) rather than any, matching typical MTG colour identity filtering
- Date-desc sort test uses explicit timestamps to avoid timing-dependent test flakiness

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Date-desc sort test initially flaky due to all entries having identical sub-second timestamps. Fixed by setting explicit added_at values before sorting assertion.

## Known Stubs
None - this plan is a data layer with no UI stubs.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Collection store ready for all Phase 2 UI plans (gallery view, table view, mass entry, CSV import/export, analytics)
- Test scaffolds ready for TDD red phase in subsequent plans
- PapaParse available for CSV import/export plans
- Chart.js available for analytics plan

## Self-Check: PASSED

All 8 created files verified present. All 3 commits (10fcaaf, 231388e, 7f1fbcf) verified in git log. 107 tests pass. Build succeeds.

---
*Phase: 02-collection-manager-treasure-cruise*
*Completed: 2026-04-04*
