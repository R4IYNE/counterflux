# Phase 15 Deferred Items

Out-of-scope discoveries logged during plan 15-03 execution. Per GSD scope boundary, these were NOT fixed because they are unrelated to the current plan's changes.

## 8 pre-existing test failures in `tests/perf/remeasure-contract.test.js`

**Discovered:** 2026-04-28 during plan 15-03 Task 2 (`npm test` run).

**Symptom:** All 8 tests in `tests/perf/remeasure-contract.test.js > "13-REMEASURE.md contract (Phase 13 Plan 1)"` fail. Tests check for the existence and content of a `13-REMEASURE.md` artifact (FCP/LCP/CLS/INP/Lighthouse-version medians, methodology cross-reference, Branch decision block).

**Root-cause hypothesis:** the artifact lives at `.planning/milestones/v1.1-phases/13-performance-optimisation-conditional/13-REMEASURE.md` after the v1.1 milestone archive shuffle, but the test's path resolution still expects it at `.planning/phases/13-performance-optimisation-conditional/13-REMEASURE.md`. v1.1 was archived during milestone close (`dfad4e7 chore: complete v1.1 Second Sunrise milestone`), but this test was authored at `314f096 test(13-01): add static-grep contract for 13-REMEASURE.md` against the unarchived path.

**Verified pre-existing:** Reverting Task 1's two-file comment swap to the pre-15-03 state produces an identical 8/1069-tests-failing result. Phase 15 plan 15-03 changes (TODO comment retirement) cannot affect a Phase 13 path-resolution test.

**Why deferred:** Outside the scope of plan 15-03 (PROXY-02 + PROXY-04 closure, both of which only touch comments in `src/services/*.js`). Fixing the path resolver would require:
- Updating `tests/perf/remeasure-contract.test.js` to look up the archived path under `.planning/milestones/v1.1-phases/`, OR
- Restoring a symlink/copy at the original path.

Either is real work (test rewrite + verification across CI + ensuring the v1.1 perf artifact is discoverable for future Lighthouse runs in Phase 16) and should be scoped as its own debug task or rolled into Phase 16's UAT verification.

**Tracking:** Open as a v1.2 follow-up bug — recommend `gsd:debug` invocation post-Phase-15 to triage. Phase 16 (Live UAT) will need the perf-baseline numbers in this artifact anyway, so the test should be fixed before Phase 16 runs.

**Impact on plan 15-03 success:** Zero. Plan 15-03's success criteria are:
- The two stale TODO comments are gone (verified).
- `EDHREC_BASE` and `SPELLBOOK_BASE` constants byte-identical (verified).
- `npm run build:check` exits 0 with main bundle ≤ 300 KB gz (next).
- 4 targeted vitest files pass (verified — 44/44).

`npm test` exit code is NOT in the plan 15-03 acceptance criteria (the plan's `<verify>` block specifies `npx vitest run tests/edhrec-service.test.js tests/spellbook-service.test.js tests/api-edhrec-proxy.test.js tests/api-spellbook-proxy.test.js`, all of which pass).
