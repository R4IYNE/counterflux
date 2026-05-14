---
phase: quick-260514-uqc
plan: 01
subsystem: search + bulk-data pipeline
tags: [load-perf, scryfall, dexie, ux-affordance]
type: quick-task
date: 2026-05-14
duration: ~10m
commits:
  - 7f04efb test(260514-uqc): RED — Scryfall API fallback + new placeholder copy contract
  - 4ddf3a1 feat(260514-uqc): GREEN — Layer 1 Scryfall API search fallback
  - b676a12 feat(260514-uqc): Layer 2 — oracle-cards bulk feed + consumer affordance copy
requirements:
  - QUICK-260514-UQC-L1
  - QUICK-260514-UQC-L2
key-files:
  modified:
    - src/db/search.js
    - src/utils/scryfall.js
    - src/workers/bulk-data.worker.js
    - src/components/add-card-panel.js
    - src/components/deck-search-panel.js
    - tests/search.test.js
    - tests/card-search-placeholder.test.js
    - tests/scryfall.test.js
decisions:
  - Inline affordance over blocking placeholder (10px JetBrains Mono, cloud_sync icon, surface-hover background) — preserves Neo-Occult Terminal density without screaming "broken"
  - filters.tag stays client-side in browseCardsViaApi (oracle-text heuristic; deck-search-panel.js applies post-fetch) — preserves Dexie-path parity
  - isBulkDataReady() returns true when Alpine store is absent (test/pre-mount) — keeps existing fixture tests green without per-test stubbing
  - Comment-only references to default-cards retained for documentation of the swap (the live const references both point to oracle-cards)
metrics:
  tests_added: 3   # 3 new API-fallback tests in tests/search.test.js
  tests_updated: 6 # 5 in card-search-placeholder.test.js + 1 in scryfall.test.js
  tests_total_pre: 1097
  tests_total_post: 1100
  full_suite: "120 files / 1100 passed / 2 skipped / 10 todo / 0 failed"
---

# Quick Task 260514-uqc — Defer Catalog Readiness Via Scryfall API Search Fallback

## One-liner

Search and browse on Treasure Cruise + Thousand-Year Storm route through `queueScryfallRequest()` while bulk data is still streaming; boot bulk feed switched from default-cards (~500MB) to oracle-cards (~100MB) — collapses the 3-5 min "broken" window to ~30-60s on broadband.

## What changed

### Layer 1 — Scryfall REST API search fallback (commits `7f04efb` + `4ddf3a1`)

`src/db/search.js` no longer hard-returns an empty-with-flag result when `window.Alpine.store('bulkdata').status !== 'ready'`. Instead, `searchCards()` and `browseCards()` both fall through to `queueScryfallRequest()` from `src/services/scryfall-queue.js` (User-Agent injection + 100ms spacing per Scryfall ToS preserved).

- **`isBulkDataReady()` helper** — returns true when no Alpine store exists (test env / pre-mount) OR when `store.status === 'ready'`. Replaces the legacy `bulkDataGate()` helper.
- **`searchCardsViaApi(query, limit)`** — hits `/cards/search?q={enc(query)}&unique=cards&order=name&include_extras=false`, filters to paper-legal + non-Alchemy (matches the Dexie path's rules), slices to `limit`. On any API error (404 no-match / transient) returns `[]` — consumers render the standard no-results path.
- **`browseCardsViaApi(colorIdentity, filters, limit)`** — composes a Scryfall query string from the deck's colour identity (`identity<=ABC`) + filters (`type:foo`, `cmc=N`/`cmc>=7`, `rarity:foo`) + always `game:paper`. `filters.tag` is intentionally not translated (client-side oracle-text heuristic; consumer applies post-fetch).
- **TDD discipline** — RED commit `7f04efb` adds 3 new failing API-fallback contract tests in `tests/search.test.js` + reshapes 4 of 5 placeholder tests in `tests/card-search-placeholder.test.js`. GREEN commit `4ddf3a1` lands the implementation; all 10 search.test.js tests pass.

### Layer 2 — Boot bulk feed swap + consumer affordance copy (commit `b676a12`)

- **`src/utils/scryfall.js`** + **`src/workers/bulk-data.worker.js`** — `SCRYFALL_BULK_API` switched from `default-cards` (~500MB raw, ~500k printings) to `oracle-cards` (~100MB raw, ~30k cards). Pipeline shape unchanged — oracle-cards rows carry the same `{id, oracle_id, name, set, collector_number, ...}` fields the `processStream + db.cards.bulkPut` path already consumes. Dexie schema chain untouched.
- **`src/components/add-card-panel.js`** — removed the top-of-panel blocking `<template x-if="...status !== 'ready'">` placeholder template. Added a small inline banner inside the `<div x-show="searchResults.length > 0">` results dropdown — 10px JetBrains Mono, 6px padding, surface-hover background, cloud_sync icon, "Using Scryfall search — local catalog warming up" copy. Dropped the bulkdata gate from the empty-state template (search works regardless now).
- **`src/components/deck-search-panel.js`** — repurposed `bulkLoadingPlaceholder` from a blocking no-results substitute into an inline affordance hint inserted ABOVE `resultsEl` (matches the add-card panel visual density: 10px font, 6px padding, 0.1em letter-spacing, cloud_sync icon). `executeSearch()` no longer propagates `bulkDataNotReady` (flag no longer exists on the search.js return). `renderResults()` reads `window.Alpine?.store?.('bulkdata')?.status` directly; affordance shown when streaming AND `results.length > 0`. No-results state is reachable again (was masked by the flag).
- **`tests/scryfall.test.js`** — constant assertion updated from default-cards to oracle-cards.

## Verification

```
$ npm test -- --run tests/search.test.js tests/card-search-placeholder.test.js tests/scryfall.test.js
Test Files  3 passed (3) | Tests 22 passed (22)

$ npm test -- --run     # full suite
Test Files  120 passed | 2 skipped (122)
Tests       1100 passed | 2 skipped | 10 todo (1112)
```

Grep checks from PLAN <verification>:
- `grep oracle-cards src/utils/scryfall.js src/workers/bulk-data.worker.js` → 2 active const matches (plus comments)
- `grep queueScryfallRequest src/db/search.js` → 4 matches (import + 2 invocations + 1 doc-comment)
- `grep "Using Scryfall search" src/components/` → 2 matches (add-card-panel + deck-search-panel)
- `grep bulkDataNotReady src/` → 1 match (comment-only; flag fully removed from active code paths)
- `grep default-cards src/` → 2 matches (both in explanatory comments documenting the swap)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Update `tests/scryfall.test.js` constants assertion**
- **Found during:** Task 2 full-suite verification
- **Issue:** `tests/scryfall.test.js:55-57` hard-asserted `SCRYFALL_BULK_API === 'https://api.scryfall.com/bulk-data/default-cards'` — directly contradicts the Layer 2 swap. PLAN's `<files>` list didn't include this file but the test gates the Layer 2 constant.
- **Fix:** Updated assertion to oracle-cards endpoint + added explanatory comment naming the quick task and rationale.
- **Files modified:** `tests/scryfall.test.js`
- **Commit:** Folded into Task 2 commit `b676a12`

**2. [Rule 3 — Blocking] Use `globalThis.window` polyfill in node test env**
- **Found during:** Task 1 RED commit (first run)
- **Issue:** New tests stubbed `window.Alpine` directly; vitest config uses `environment: 'node'` so `window` is undefined → ReferenceError. The plan's pseudo-code assumed jsdom semantics.
- **Fix:** Tests now assign `globalThis.window = globalThis` if missing, then attach `Alpine` to `globalThis.window`. `src/db/search.js`'s gate already resolves `window` via `typeof window !== 'undefined'`, so the polyfill matches the production access pattern.
- **Files modified:** `tests/search.test.js`
- **Commit:** Folded into RED commit `7f04efb`

### Deferred / Out-of-scope items

- **Pre-existing Alpine cleanup errors in `tests/router.test.js`** (4 unhandled `removeEventListener is not a function` exceptions) — confirmed pre-existing via `git stash` baseline run; the 17/17 router tests themselves still pass. Out-of-scope per the plan's bfcache + DB-schema "don't touch" list. Candidate for a future quick task if it becomes a CI blocker.
- **Test-isolation flake in `tests/sync-reconciliation.test.js`** — `populated-empty does NOT invoke reconciliation modal` test passes in isolation (16/16) but flaked once during the full-suite run. Confirmed not caused by Layer 1/2 (passes on baseline + post-change in isolation). Likely shared-state ordering between Alpine-stubbing test files. Out-of-scope.

## Self-Check: PASSED

**Created files:**
- FOUND: `.planning/quick/260514-uqc-defer-catalog-readiness-scryfall-api-sea/260514-uqc-SUMMARY.md`

**Commits exist on master:**
- FOUND: `7f04efb` test(260514-uqc): RED — Scryfall API fallback + new placeholder copy contract
- FOUND: `4ddf3a1` feat(260514-uqc): GREEN — Layer 1 Scryfall API search fallback
- FOUND: `b676a12` feat(260514-uqc): Layer 2 — oracle-cards bulk feed + consumer affordance copy

## v1.3 SEED candidates surfaced

- **SEED-008** — Printing-specific fallback via `/cards/{set}/{collector_number}` when oracle-cards-only Dexie row is selected for collection-add and the user needs a non-default printing. Today's printing strip in add-card-panel.js relies on `card.prints_search_uri` which oracle-cards rows still carry, so the printing-strip flow remains functional — but if production traffic shows oracle-cards' lack of per-printing prices is biting market-intel features, promote this seed.
- **Validation note** — Production telemetry on the Scryfall API fallback path (call count + p95 latency during the 30-60s bulk-streaming window) would confirm whether the 75-100ms queue spacing creates user-visible queueing for autocomplete-fast typers. The existing request-cancellation pattern in `deck-search-panel.js` (input-value identity check) already handles stale results, but a queue-depth metric would close the loop.
