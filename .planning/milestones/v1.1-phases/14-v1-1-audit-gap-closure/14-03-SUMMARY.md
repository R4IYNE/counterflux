---
phase: 14-v1-1-audit-gap-closure
plan: 14-03
subsystem: preordain-spoiler
tags: [alpine, honesty-gate, bulkdata, preordain, tdd, issue-d]
provides:
  - "3-branch empty-state rendering on spoiler-gallery gated by $store.bulkdata.status (loading / ready-empty / ready-populated)"
  - "Source-level Vitest regression suite locking the gate (6 assertions, mirrors epic-experiment-bulkdata-gating.test.js static-grep pattern)"
  - "PERF-04 completeness — spoiler-gallery was the last consumer missing the Phase 13 _isBulkDataReady() pattern"
  - "MARKET-01 honesty — users no longer see 'No cards revealed yet' during bulk-data download"
affects: [phase-12-spoiler-refresh, phase-13-performance-optimisation, preordain-screen]
tech-stack:
  added: []
  patterns:
    - "Alpine <template x-if> reactive gating on $store.bulkdata?.status"
    - "Optional chaining defensive read for pre-Alpine.start / test-env degrades (phase-13 convention)"
    - "Source-level static-grep Vitest regression (@vitest-environment node + readFileSync, no jsdom mount needed for HTML-string-returning components)"
key-files:
  created:
    - "tests/spoiler-gallery-bulkdata-gating.test.js"
  modified:
    - "src/components/spoiler-gallery.js"
key-decisions:
  - "No _isBulkDataReady() helper added to spoiler-gallery.js — file returns an HTML string (exported renderSpoilerGallery()), not imperative DOM construction. Alpine templates directly read $store.bulkdata via the x-if predicate. Contract parity (same gate, same copy convention) achieved without code parity. Helper pattern from epic-experiment.js stays imperative-JS-only."
  - "Used optional chaining ($store.bulkdata?.status) in both branch predicates per Phase 13 defensive convention — Alpine templates can evaluate at boot time before the bulkdata store is registered, and ?. prevents 'Cannot read properties of undefined' console errors in the first frame."
  - "Alpine native reactivity handles the 'downloading → ready' transition automatically — no manual Alpine.effect subscription needed. When $store.bulkdata.status changes, the <template x-if> predicates re-evaluate, Branch 1 unmounts, Branch 2 (or the card grid at line 138) mounts."
  - "Mila 'no set selected' empty-state block (lines ~273-286) left untouched — it's set-selection-dependent, not bulk-data-dependent. Keeping the 3 empty states as 3 separate mutually-exclusive <template x-if> siblings is cleaner than nesting."
  - "Test uses @vitest-environment node + readFileSync static-grep (same as tests/epic-experiment-bulkdata-gating.test.js) — jsdom mounting would need the full market + bulkdata + app stores wired up. Static grep is cheaper and more durable against future refactors as long as the copy strings + template structure stay recognisable."
duration: ~2m
completed: 2026-04-22
---

# Phase 14 Plan 03: Spoiler-gallery bulkdata gating (Issue D) Summary

**Applied Phase 13's `_isBulkDataReady()` honesty-gate pattern to Preordain spoiler-gallery — the last consumer missing the gate per the 2026-04-22 milestone audit. Users mid-bulk-data-download no longer see the misleading "No cards revealed yet for this set." copy; they see "Archive is downloading…" until the archive indexes, then the honest empty state appears only if the set really has no spoilers yet.**

## Performance
- **Duration:** ~2 minutes (parallel executor, RED + GREEN TDD pair)
- **Tasks:** 2/2 (RED test + GREEN patch)
- **Files modified:** 1 created + 1 modified

## Accomplishments

- **Closed audit Issue D** — spoiler-gallery now correctly distinguishes "archive still downloading" from "archive ready but no spoilers for this set". The user is no longer misled into thinking a set has no cards when really the bulk-data cache is still being populated.
- **Closed MARKET-01 (spoiler honesty)** — the set filter + empty state together present a truthful picture of what's in the local archive.
- **Closed PERF-04 (honesty-gating pattern completeness)** — spoiler-gallery was the last consumer missing the gate that Phase 13 established for epic-experiment + treasure-cruise. All three major content surfaces now use the same pattern.
- **TDD pair landed cleanly** — RED committed with 5/6 failing (predicted), GREEN committed with 6/6 passing. No iteration needed.
- **Zero regression** — 11/11 existing Phase 12 `tests/spoiler-gallery.test.js` tests still pass, plus `tests/spoiler-set-filter.test.js` clean. All 25 spoiler-surface tests green post-patch.

## Task Commits

1. **Task 1: RED — source-level gating test** - `e8f211d`
   - Created `tests/spoiler-gallery-bulkdata-gating.test.js` with 6 static-grep assertions
   - Mirrors `tests/epic-experiment-bulkdata-gating.test.js` pattern (@vitest-environment node + readFileSync)
   - Pre-GREEN state: 5 failing / 1 passing (Test 3 "existing copy preserved" already green)

2. **Task 2: GREEN — 3-branch bulkdata gate on spoiler-gallery** - `c27c5bb`
   - Replaced single `<template x-if="...spoilerCards.length === 0 && activeSet">` block with two bulk-data-gated branches
   - Branch 1 (loading): `$store.bulkdata?.status !== 'ready' && !$store.market.loading && $store.market.activeSet` → "Archive is downloading…"
   - Branch 2 (ready-empty): `$store.bulkdata?.status === 'ready' && !$store.market.loading && $store.market.spoilerCards.length === 0 && $store.market.activeSet` → "No cards revealed yet for this set." (preserved verbatim)
   - Mila "no set selected" block (lines ~273-286) untouched
   - Post-patch: 6/6 new tests passing, 11/11 Phase 12 tests passing

## Files Created/Modified

- `tests/spoiler-gallery-bulkdata-gating.test.js` (created) — 6 source-level regression tests locking the 3-branch contract. Mirrors `tests/epic-experiment-bulkdata-gating.test.js` `@vitest-environment node` + `readFileSync` + static-grep pattern. Each test asserts one aspect of the gate: store reference present, loading copy present, ready-empty copy preserved, x-if predicate references bulkdata, 'ready' literal present, ready-empty copy structurally co-located with a bulkdata reference (proximity-within-800-chars proof that the gate wraps the copy, not just a file-level mention).
- `src/components/spoiler-gallery.js` (modified lines 241-267) — replaced single "No cards for set" `<template x-if>` block (~7 lines) with two bulk-data-gated `<template x-if>` branches (~24 lines including explanatory comment). Added doc block explaining the 3-branch structure (Branch 1 loading, Branch 2 ready-empty, Branch 3 untouched Mila "no set selected"). The existing Mila "Select a set above" block below remains unchanged.

## Decisions & Deviations

**Decisions:** see frontmatter `key-decisions` — 5 recorded, most material being (1) no helper function (file exports HTML string, not imperative mount — Alpine x-if reads `$store.bulkdata` directly) and (2) no Alpine.effect needed (Alpine native x-if reactivity handles the downloading→ready transition automatically).

**Deviations:** None. Plan executed exactly as written. RED reproduced the expected 5-fail / 1-pass state; GREEN patch matched the plan's verbatim replacement block (including `&hellip;` HTML entity + "Archive is downloading…" copy verbatim for Test 2's regex); all acceptance criteria satisfied on first attempt.

**Auth gates:** None.

**Auto-fixes (Rules 1-3):** None needed — plan was surgical and self-contained.

## Next Phase Readiness

- **Phase 14 Plans 14-01 / 14-02 / 14-04** continue in parallel — no shared files, no coordination needed. 14-01 (Issue A cloud-sync user_id stamping) RED landed between 14-03's RED and GREEN commits, confirming parallel safety.
- **Phase 14 orchestrator** can roll up Issue D as closed. MARKET-01 + PERF-04 requirement rows now fully shipped with regression coverage.
- **v1.1 milestone close** — this plan removes the Issue D blocker from the minor-gaps list. Remaining gap items are Issue A (critical, Plan 14-01), Issue B (design decision, deferrable), Issue C (documentation, Plan 14-02).

## Self-Check: PASSED

- Created files exist:
  - `tests/spoiler-gallery-bulkdata-gating.test.js` → FOUND
- Modified files exist:
  - `src/components/spoiler-gallery.js` → FOUND (modified)
- Commits exist in git log:
  - `e8f211d` (RED) → FOUND
  - `c27c5bb` (GREEN) → FOUND
- Source-level contracts:
  - `grep "Archive is downloading" src/components/spoiler-gallery.js` → MATCH
  - `grep "No cards revealed yet for this set\." src/components/spoiler-gallery.js` → MATCH
  - `grep -cE "'ready'" src/components/spoiler-gallery.js` → 2 matches
  - `grep -nE '\$store\.bulkdata' src/components/spoiler-gallery.js` → 2 matches
- Test results:
  - `tests/spoiler-gallery-bulkdata-gating.test.js` → 6/6 passing
  - `tests/spoiler-gallery.test.js` (Phase 12 regression) → 11/11 passing
  - `tests/spoiler-set-filter.test.js` (sibling suite) → passing
