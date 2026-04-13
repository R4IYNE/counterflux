---
phase: 05-market-intel-game-tracker
plan: 01
subsystem: database, services, stores
tags: [dexie, indexeddb, scryfall, alpine-store, sparkline, price-tracking, watchlist]

requires:
  - phase: 04-intelligence-layer
    provides: "Dexie v4 schema with edhrec_cache, combo_cache, card_salt_cache"
  - phase: 01-foundation-data-layer
    provides: "Dexie setup, Alpine store pattern, Scryfall service, currency conversion"
provides:
  - "Dexie v5 schema with watchlist, price_history, games tables"
  - "Market Alpine store with watchlist CRUD, alert checking, movers"
  - "Price history service with daily snapshots, 90-day pruning, trend computation"
  - "Sets service with 24h cached Scryfall /sets data"
  - "SVG sparkline renderer for price trend visualization"
affects: [05-02, 05-03, 05-04, 05-05, 05-06, 05-07, 05-08]

tech-stack:
  added: []
  patterns: ["price snapshot dedup via compound [scryfall_id+date] index", "watchlist unique constraint via &scryfall_id", "in-memory cache + IndexedDB cache for sets data"]

key-files:
  created:
    - src/stores/market.js
    - src/services/price-history.js
    - src/services/sets.js
    - src/utils/sparkline.js
    - tests/market-store.test.js
    - tests/price-history.test.js
    - tests/price-alerts.test.js
    - tests/spoiler-filter.test.js
    - tests/sets-service.test.js
  modified:
    - src/db/schema.js
    - src/workers/bulk-data.worker.js
    - src/main.js

key-decisions:
  - "Price history uses daily snapshots (YYYY-MM-DD string dates) with 90-day retention"
  - "Watchlist enforces unique scryfall_id via Dexie & prefix on index"
  - "Sets service uses dual-layer cache: in-memory for synchronous access, IndexedDB with 24h TTL"
  - "Worker schema synced to v5 with all tables to prevent VersionError"

patterns-established:
  - "Market store follows existing Alpine.store() init pattern (initMarketStore)"
  - "Price snapshots deduplicated via compound [scryfall_id+date] index lookup"
  - "Alert checking converts EUR to GBP via eurToGbpValue before threshold comparison"

requirements-completed: [MRKT-03, MRKT-04, MRKT-05, MRKT-06]

duration: 9min
completed: 2026-04-09
---

# Phase 5 Plan 1: Market Data Layer Summary

**Dexie v5 schema with watchlist/price-history/games tables, market Alpine store, price-history service with daily snapshots and 90-day pruning, sets service with 24h Scryfall cache, and SVG sparkline renderer**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-09T07:15:34Z
- **Completed:** 2026-04-09T07:24:44Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Dexie schema upgraded to v5 with watchlist (unique scryfall_id), price_history (compound date index), and games tables
- Worker schema synced from v3 to v5 (added v4 and v5 declarations) to prevent VersionError
- Market Alpine store with full watchlist CRUD, alert checking (below/above/change_pct), movers computation, and spoiler filtering
- Price history service with daily snapshot dedup, 90-day pruning, trend computation, and market movers calculation
- Sets service with dual-layer caching (memory + IndexedDB 24h TTL) filtering to relevant set types
- SVG sparkline renderer with positive/negative colour coding and gradient fill
- All 5 test files (27 tests) passing, full suite (338 tests) green

## Task Commits

Each task was committed atomically:

1. **Task 1: Dexie v5 schema, market store, price-history, sets service, sparkline** - `e6ec8bd` (feat)
2. **Task 2: Market data layer tests and main.js wiring** - `fd6803b` (test)

## Files Created/Modified
- `src/db/schema.js` - Added Dexie v5 with watchlist, price_history, games tables
- `src/workers/bulk-data.worker.js` - Synced to v4 and v5 schema declarations
- `src/stores/market.js` - Alpine market store with watchlist, alerts, movers, spoilers
- `src/services/price-history.js` - Daily snapshots, pruning, trend, movers computation
- `src/services/sets.js` - Scryfall /sets fetch with 24h IndexedDB + memory cache
- `src/utils/sparkline.js` - SVG sparkline renderer with trend colouring
- `src/main.js` - Wired initMarketStore() after intelligence store
- `tests/market-store.test.js` - 7 tests for watchlist CRUD, alerts, constraints
- `tests/price-history.test.js` - 6 tests for snapshots, dedup, pruning, trend, movers
- `tests/price-alerts.test.js` - 5 tests for below/above/change_pct/skip conditions
- `tests/spoiler-filter.test.js` - 5 tests for colour, rarity, type, combined, NEW badge
- `tests/sets-service.test.js` - 4 tests for fetch, filter, cache, parent exclusion

## Decisions Made
- Price history uses YYYY-MM-DD string dates for deduplication via compound index
- Watchlist unique constraint via Dexie `&scryfall_id` index prefix
- Sets service dual-layer cache: synchronous memory cache for getCachedSets, IndexedDB for persistence across sessions
- Worker schema declarations include all tables even though worker only uses cards/meta

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Data layer complete for Preordain screen (05-02 onwards)
- Market store ready for UI wiring
- Games table ready for Vandalblast (game tracker) plans

---
*Phase: 05-market-intel-game-tracker*
*Completed: 2026-04-09*

## Self-Check: PASSED
