---
phase: 03-deck-builder-thousand-year-storm
plan: 01
subsystem: database
tags: [dexie, indexeddb, alpine-store, commander, deck-builder, analytics]

requires:
  - phase: 02-collection-manager-treasure-cruise
    provides: Dexie schema v2 with collection table, collection store pattern, currency service
provides:
  - Dexie schema v3 with decks and deck_cards tables
  - Alpine deck store with full CRUD (create, load, add/remove cards, delete, duplicate, rename)
  - computeDeckAnalytics pure function (mana curve, colour pie, type/tag breakdown, GBP pricing)
  - Type classifier utility (classifyType, TYPE_ORDER)
  - Tag heuristics utility (suggestTags, DEFAULT_TAGS, TAG_HEURISTICS)
  - Commander detection utility (isLegendary, hasPartner, hasPartnerWith, choosesBackground, isBackground, isCompanion, hasFriendsForever, mergeColorIdentity)
affects: [03-02, 03-03, 03-04, 03-05, 03-06, 04-intelligence]

tech-stack:
  added: []
  patterns: [pure-function-analytics, extracted-utility-modules, tdd-red-green]

key-files:
  created:
    - src/stores/deck.js
    - src/utils/deck-analytics.js
    - src/utils/type-classifier.js
    - src/utils/tag-heuristics.js
    - src/utils/commander-detection.js
    - tests/deck-store.test.js
    - tests/deck-analytics.test.js
    - tests/type-classifier.test.js
    - tests/commander-detection.test.js
    - tests/tag-manager.test.js
    - tests/deck-builder-screen.test.js
  modified:
    - src/db/schema.js
    - src/workers/bulk-data.worker.js
    - src/main.js

key-decisions:
  - "Extracted computeDeckAnalytics to src/utils/deck-analytics.js for Alpine-free testability"
  - "Removed duplicate scryfall_id index from deck_cards schema (was listed twice causing ConstraintError)"

patterns-established:
  - "Analytics as pure functions: extract compute functions to utils/ for testability without Alpine DOM dependencies"
  - "Commander singleton rule: check format + oracle_text 'any number of cards named' exemption"

requirements-completed: [DECK-05, DECK-07, DECK-08, DECK-14, DECK-15]

duration: 9min
completed: 2026-04-05
---

# Phase 3 Plan 1: Deck Data Layer Summary

**Dexie schema v3 with deck tables, Alpine deck store with full CRUD and singleton enforcement, type/tag/commander utility modules with 71 passing tests**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-05T18:10:04Z
- **Completed:** 2026-04-05T18:18:34Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Dexie schema v3 with decks and deck_cards tables declared in both main thread and worker
- Alpine deck store with 11 async CRUD methods, computed getters (cardCount, slotsRemaining, groupedByType, analytics)
- Single-pass analytics computation: mana curve, colour pie, type/tag breakdown, GBP pricing via eurToGbpValue
- Type classifier, tag heuristics (8 regex-pattern tag categories), and commander detection (partner/background/companion) utilities
- Commander singleton rule with "any number of cards named" exemption for cards like Rat Colony
- 71 tests passing, 5 screen test todos skipping cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: Dexie schema v3, utility modules, and test scaffolds** - `703c59c` (feat)
2. **Task 2: Alpine deck store with CRUD, analytics computation, and tests** - `3c51bf2` (feat)

## Files Created/Modified
- `src/db/schema.js` - Added version(3) with decks + deck_cards tables
- `src/workers/bulk-data.worker.js` - Added version(2) and version(3) declarations
- `src/main.js` - Added initDeckStore() import and call
- `src/stores/deck.js` - Alpine deck store with full CRUD and analytics getter
- `src/utils/deck-analytics.js` - Pure computeDeckAnalytics function (extracted for testability)
- `src/utils/type-classifier.js` - classifyType with priority-ordered detection, TYPE_ORDER array
- `src/utils/tag-heuristics.js` - suggestTags with 8 regex-pattern tag categories
- `src/utils/commander-detection.js` - Partner, Background, Companion, Friends Forever detection
- `tests/deck-store.test.js` - 14 tests for deck CRUD operations
- `tests/deck-analytics.test.js` - 13 tests for analytics computation
- `tests/type-classifier.test.js` - 13 tests for type classification
- `tests/commander-detection.test.js` - 14 tests for commander keyword detection
- `tests/tag-manager.test.js` - 10 tests for tag heuristics
- `tests/deck-builder-screen.test.js` - 5 todo stubs for screen-level tests

## Decisions Made
- Extracted computeDeckAnalytics to src/utils/deck-analytics.js to avoid Alpine's MutationObserver dependency in test environment (Alpine import triggers DOM globals)
- Removed duplicate scryfall_id standalone index from deck_cards schema -- the field was already indexed before the compound index, having it again at the end caused ConstraintError in fake-indexeddb

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed duplicate scryfall_id index in deck_cards schema**
- **Found during:** Task 2 (deck store tests)
- **Issue:** Schema `deck_cards: '++id, deck_id, scryfall_id, [deck_id+scryfall_id], scryfall_id'` listed scryfall_id twice, causing ConstraintError when Dexie tried to create duplicate index
- **Fix:** Removed trailing duplicate `scryfall_id` from schema string in both schema.js and worker
- **Files modified:** src/db/schema.js, src/workers/bulk-data.worker.js
- **Verification:** All deck store tests pass, build succeeds
- **Committed in:** 3c51bf2

**2. [Rule 3 - Blocking] Extracted computeDeckAnalytics to standalone module**
- **Found during:** Task 2 (deck analytics tests)
- **Issue:** Importing from src/stores/deck.js triggered Alpine.js module load which requires MutationObserver (unavailable in Node test environment)
- **Fix:** Created src/utils/deck-analytics.js as Alpine-free pure function, re-exported from deck.js for backward compatibility
- **Files modified:** src/utils/deck-analytics.js, src/stores/deck.js
- **Verification:** Analytics tests pass without DOM dependencies
- **Committed in:** 3c51bf2

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep. The analytics extraction actually improves architecture.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all modules are fully implemented with real logic, no placeholder data.

## Next Phase Readiness
- Deck data layer complete and tested, ready for Plan 02 (deck landing page UI)
- All subsequent plans (02-06) can import from deck store, type classifier, tag heuristics, commander detection
- Screen test stub file ready for Plans 02-04 to fill in

## Self-Check: PASSED

All 14 files verified present. Both commit hashes (703c59c, 3c51bf2) confirmed in git log.

---
*Phase: 03-deck-builder-thousand-year-storm*
*Completed: 2026-04-05*
