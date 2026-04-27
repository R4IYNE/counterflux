---
phase: 12-notification-bell-preordain-spoiler-refresh
plan: 01
subsystem: ui
tags: [alpine, dexie, market-store, polling, tdd]

# Dependency graph
requires:
  - phase: 11-cloud-sync-engine
    provides: db.sync_conflicts table (Dexie v10) + Alpine auth store
provides:
  - market.unifiedBadgeCount getter (syncErrorCount + alertBadgeCount)
  - market.groupedSpoilerCards getter (date-grouped, descending, 'unknown' last)
  - market.syncErrorCount field + _pollSyncErrors / _stopSyncErrorPoll (2s interval)
  - __tickSyncErrorPoll test helper (single-tick assertion without setInterval wait)
affects: [12-02, 12-03, 12-04, notification-bell-popover, spoiler-gallery, spoiler-set-filter]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "setInterval-based 2s polling (mirrors src/stores/sync.js:106-119)"
    - "Auth-gated polling with immediate reset on sign-out (Pitfall 5 mitigation)"
    - "vi.doMock('alpinejs') + module re-import + re-imported db spy target for store unit tests"
    - "@vitest-environment jsdom per-file directive for window.Alpine-dependent tests"

key-files:
  created: []
  modified:
    - src/stores/market.js
    - tests/market-store.test.js

key-decisions:
  - "syncErrorCount polling lives on market store (not sync store) — bell is a market-adjacent surface per CONTEXT D-02, and unifiedBadgeCount = syncErrorCount + alertBadgeCount keeps both inputs on one getter."
  - "Tests use @vitest-environment jsdom rather than polyfilling window in node — matches Phase 09 deck-analytics-panel precedent."
  - "vi.spyOn(moduleDb.sync_conflicts, 'count') (re-imported db) rather than top-level db — vi.resetModules creates a fresh schema.js instance the test must target."

patterns-established:
  - "Phase 12 additions scaffolding — test file captures store definition via doMock-replaced Alpine.store callback, then registers window.Alpine stub for downstream auth reads"
  - "__tickSyncErrorPoll test helper pattern — exported from the store module, mirrors the interval body verbatim, keeps async-poll tests deterministic"

requirements-completed:
  - SYNC-08
  - MARKET-02

# Metrics
duration: ~4 min
completed: 2026-04-19
---

# Phase 12 Plan 01: Market Store Additions (Phase 12 Wave 1 Foundation)

**Extended `src/stores/market.js` with `unifiedBadgeCount` + `groupedSpoilerCards` getters and a 2s `sync_conflicts` polling loop so Plans 12-03 (bell popover) and 12-04 (spoiler gallery) can render against reactive store state.**

## Performance

- **Duration:** ~4 min (231s start-to-commit)
- **Started:** 2026-04-19T08:30:10Z
- **Completed:** 2026-04-19T08:34:01Z
- **Tasks:** 2 (1 RED test commit + 1 GREEN implementation commit, TDD pair)
- **Files modified:** 2

## Accomplishments

- Three reactive primitives shipped on `Alpine.store('market')`:
  - `unifiedBadgeCount` getter (SYNC-08 D-02) — bell badge source of truth
  - `groupedSpoilerCards` getter (MARKET-02 D-07) — spoiler gallery data source
  - `syncErrorCount` + `_pollSyncErrors` + `_stopSyncErrorPoll` — 2s `db.sync_conflicts.count()` poll, auth-gated
- 8 new unit tests in `tests/market-store.test.js` (all 15 assertions green — 7 existing watchlist + 8 phase-12 additions)
- `__tickSyncErrorPoll` test helper exported — lets Vitest run the poll body synchronously without waiting 2s real-time
- Zero regression: full suite 890 pass / 2 skipped / 10 todo (only pre-existing Alpine template errors in `tests/router.test.js`, unchanged from before this plan)

## Task Commits

1. **Task 1: RED — failing tests for unifiedBadgeCount, groupedSpoilerCards, syncErrorCount polling** — `027294b` (test)
2. **Task 2: GREEN — implement unifiedBadgeCount, groupedSpoilerCards, syncErrorCount polling** — `8cbd7fa` (feat)

## Files Created/Modified

- `src/stores/market.js` — added `syncErrorCount` field, `unifiedBadgeCount` getter, `groupedSpoilerCards` getter, `_pollSyncErrors` + `_stopSyncErrorPoll` methods, `this._pollSyncErrors()` kick-off call at end of `init()` try block, and `__tickSyncErrorPoll` test-only export at module bottom.
- `tests/market-store.test.js` — added `@vitest-environment jsdom` per-file directive and a new `describe('phase 12 additions', ...)` block with 8 tests covering all new surface area. Pre-existing watchlist describe-block untouched.

## Decisions Made

- **syncErrorCount lives on `market`, not `sync`.** The research doc flagged this as an open question. Went with market because (a) CONTEXT D-02 explicitly defines `unifiedBadgeCount = syncErrorCount + alertBadgeCount`, and keeping both summands on the same store is cleaner than cross-store arithmetic in the bell template; (b) Plan 03 (bell) treats the bell as a market-adjacent UI surface.
- **Mirror-only, not import, for `__tickSyncErrorPoll`.** Rather than factoring the interval body into a shared helper, ship the helper as a separate exported async function with the same body. Keeps `_pollSyncErrors` signature unchanged (no async function decl churn) and avoids an extra abstraction layer for a single test hook. Comment in the helper warns "when the interval body changes, update both together."
- **@vitest-environment jsdom over node + manual window polyfill.** The existing `tests/market-store.test.js` ran fine under node for the watchlist tests (no DOM/window access), but the new tests need `window.Alpine`. Rather than stub `globalThis.window = {}` per-test, set the directive at the file level. Pre-existing tests are environment-agnostic and pass unchanged under jsdom.
- **Spy on re-imported `db.sync_conflicts`.** `vi.resetModules()` + `await import('../src/stores/market.js')` creates a fresh module graph including a new `db` instance from schema.js. Top-level `db` import in the test file is a DIFFERENT reference — spying on it would not patch what `__tickSyncErrorPoll` actually calls. Fix: re-import schema.js inside `beforeEach` and capture `moduleDb` for `vi.spyOn`.

## Deviations from Plan

None — plan executed exactly as written.

The only in-task adjustments were mechanical (not deviations):
- First RED run failed with `ReferenceError: window is not defined` because tests run in node by default. Added `@vitest-environment jsdom` directive per-file — the plan spec referenced `window.Alpine` patterns from Phase 09 which also use jsdom, so this matches the documented convention.
- First GREEN run had 2/8 failures because `vi.spyOn(db.sync_conflicts, 'count')` was patching the test-file's top-level `db` import while `__tickSyncErrorPoll` was using the re-imported module's `db` (different reference after `vi.resetModules`). Captured the re-imported db as `moduleDb` inside `beforeEach` and re-pointed the spy — this is standard vitest doMock hygiene, not a plan deviation.

## Issues Encountered

- **Pre-existing uncaught exceptions in `tests/router.test.js`** (4 errors on `$store.collection.precons.length`). Confirmed pre-existing via `git stash && npm test -- router` — present before this plan. Out of scope per SCOPE BOUNDARY rule. Not blocking (test file still reports 17/17 pass; errors are during async Alpine reactive-template teardown, not test failures). Logged for future phase attention but not fixed here.

## User Setup Required

None — no external service configuration required. This plan is purely internal store-layer work; nothing cached outside source files.

## Next Phase Readiness

**Plan 12-02 (MARKET-01 custom set-filter dropdown) and Plan 12-03 (SYNC-08 bell popover) can start immediately.** Their store dependencies are now live and test-verified:

- `$store.market.unifiedBadgeCount` — bell badge binding (Plan 03 consumes via index.html topbar)
- `$store.market.syncErrorCount` — bell popover SYNC ERRORS section count (Plan 03)
- `$store.market.groupedSpoilerCards` — spoiler gallery section loop (Plan 04)

Plan 12-03's test file can stub `$store.market` with the new fields populated; no further store edits needed.

The `_syncErrorInterval` is kicked off from `init()` and the poll is auth-gated + self-resetting — Plan 10's sign-out flow continues to work unchanged, and the bell badge will zero out the moment `auth.status` flips away from `'authed'`.

## Self-Check

- `src/stores/market.js` exists: FOUND
- `tests/market-store.test.js` exists: FOUND
- Commit `027294b`: FOUND
- Commit `8cbd7fa`: FOUND
- All 8 new test identifiers present (grep-verified — see acceptance criteria below)

### Acceptance-criteria grep gates

| Check | Location | Result |
|-------|----------|--------|
| `get unifiedBadgeCount() {` | src/stores/market.js | 1 match |
| `get groupedSpoilerCards() {` | src/stores/market.js | 1 match |
| `syncErrorCount: 0,` | src/stores/market.js | 1 match |
| `_pollSyncErrors() {` | src/stores/market.js | 1 match |
| `_stopSyncErrorPoll() {` | src/stores/market.js | 1 match |
| `export async function __tickSyncErrorPoll` | src/stores/market.js | 1 match |
| `this._pollSyncErrors()` (inside init()) | src/stores/market.js | 1 match |
| `describe('phase 12 additions'` | tests/market-store.test.js | 1 match |
| Commit `test(12-01): RED` | git log | present |
| Commit `feat(12-01): GREEN` | git log | present |

## Self-Check: PASSED

---
*Phase: 12-notification-bell-preordain-spoiler-refresh*
*Plan: 01*
*Completed: 2026-04-19*
