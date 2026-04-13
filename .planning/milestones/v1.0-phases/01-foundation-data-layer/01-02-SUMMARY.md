---
phase: 01-foundation-data-layer
plan: 02
subsystem: data-pipeline
tags: [scryfall, web-worker, streaming-json, dexie, indexeddb, alpine, splash-screen]

# Dependency graph
requires:
  - phase: 01-01
    provides: Dexie schema (db.cards, db.meta), Scryfall utils, storage utils, Vite build config
provides:
  - Web Worker bulk data pipeline with streaming JSON parser
  - Alpine.store('bulkdata') for reactive progress tracking
  - Splash screen blocking overlay with progress bar and flavour text
  - Daily refresh check via Scryfall updated_at comparison
  - Main.js Worker orchestration and Alpine initialization
affects: [01-03, 01-04, all-screens]

# Tech tracking
tech-stack:
  added: [@streamparser/json-whatwg]
  patterns: [web-worker-dexie-pattern, streaming-json-pipeline, alpine-store-worker-bridge, tdd-extracted-pipeline-module]

key-files:
  created:
    - src/workers/bulk-data.worker.js
    - src/workers/bulk-data-pipeline.js
    - src/stores/bulkdata.js
    - src/components/splash-screen.js
    - tests/bulk-data.test.js
  modified:
    - src/main.js
    - index.html

key-decisions:
  - "Extracted pipeline core logic into bulk-data-pipeline.js for testability outside Worker context"
  - "Used @streamparser/json-whatwg TransformStream API (pipeThrough) instead of manual onValue callbacks"
  - "Dexie runs inside Worker to avoid 300MB postMessage serialization overhead"

patterns-established:
  - "Worker pipeline extraction: core logic in importable module, Worker file handles messaging shell"
  - "Alpine store as Worker message bridge: worker.onmessage updates Alpine.store() for reactive UI"
  - "Splash screen as Alpine x-data component with $store bindings"

requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-04, MILA-03]

# Metrics
duration: 6min
completed: 2026-04-04
---

# Phase 1 Plan 2: Bulk Data Pipeline Summary

**Scryfall bulk data pipeline with Web Worker stream parsing, Dexie batch storage, Alpine progress store, and blocking splash screen with Mila pulse animation**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-04T08:10:21Z
- **Completed:** 2026-04-04T08:16:34Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Web Worker downloads Scryfall Default Cards bulk file via streaming fetch, parses with @streamparser/json-whatwg, and batch-inserts cards into Dexie IndexedDB inside the Worker (no postMessage card data serialization)
- Alpine.store('bulkdata') provides reactive progress tracking (status, downloaded/total bytes, parsed cards, error state)
- Full-screen blocking splash screen with progress bar, MB counter, rotating MTG flavour text, and Mila image with CSS pulse animation (MILA-03 placeholder)
- Daily refresh check compares cached updated_at against Scryfall API

## Task Commits

Each task was committed atomically:

1. **Task 1: Web Worker bulk data pipeline** - `6568df0` (test: RED), `9c0a463` (feat: GREEN)
2. **Task 2: Alpine bulkdata store, splash screen, main.js** - `a5d11a4` (feat)

_Task 1 followed TDD: RED tests first, then GREEN implementation._

## Files Created/Modified
- `src/workers/bulk-data.worker.js` - Web Worker: fetch, stream-parse, Dexie storage, daily refresh check
- `src/workers/bulk-data-pipeline.js` - Extracted core pipeline logic for testability
- `src/stores/bulkdata.js` - Alpine.store('bulkdata') with status, progress, error state
- `src/components/splash-screen.js` - Alpine component for blocking splash with flavour text rotation
- `src/main.js` - Worker creation, onmessage handler, Alpine store registration, pipeline start
- `index.html` - x-data on body, splash screen markup, progress bar bindings
- `tests/bulk-data.test.js` - 10 tests covering stream parsing, progress messages, error handling, Dexie storage

## Decisions Made
- Extracted pipeline core logic into `bulk-data-pipeline.js` (separate from `bulk-data.worker.js`) to enable unit testing without Worker context. Worker file is a thin messaging shell.
- Used `@streamparser/json-whatwg` TransformStream `pipeThrough` API (not the base `@streamparser/json` write/onValue API) since the whatwg package exports a `TransformStream` subclass.
- Splash screen uses inline x-data component pattern with `Alpine.data('splashScreen', ...)` registration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] npm dependencies not installed in worktree**
- **Found during:** Task 1 (test execution)
- **Issue:** Worktree had package.json but no node_modules
- **Fix:** Ran `npm install`
- **Verification:** All tests and build pass
- **Committed in:** N/A (not a code change)

**2. [Rule 1 - Bug] @streamparser/json-whatwg API mismatch**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** Initial implementation used `onValue` callback pattern from `@streamparser/json`, but `@streamparser/json-whatwg` exports a `TransformStream` subclass requiring `pipeThrough` usage
- **Fix:** Rewrote pipeline to use WhatWG Streams API: `stream.pipeThrough(trackingTransform).pipeThrough(parser)` then read from the readable end
- **Files modified:** `src/workers/bulk-data-pipeline.js`
- **Verification:** All 10 tests pass
- **Committed in:** `9c0a463`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Bulk data pipeline ready for SPA shell (Plan 03) and search/autocomplete (Plan 04)
- Alpine.store('bulkdata') reactive state available for any component
- Worker bundled correctly by Vite 8 as separate chunk

---
## Self-Check: PASSED

All 7 files verified present. All 3 commits verified in git log.

---
*Phase: 01-foundation-data-layer*
*Completed: 2026-04-04*
