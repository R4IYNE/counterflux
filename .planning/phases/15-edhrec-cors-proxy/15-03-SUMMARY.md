---
phase: 15-edhrec-cors-proxy
plan: 15-03
subsystem: docs
tags: [vercel, vercel-functions, cleanup, comments, bundle-budget, edhrec, spellbook]

# Dependency graph
requires:
  - phase: 15-edhrec-cors-proxy
    provides: "Plan 15-01 EDHREC Function + Plan 15-02 Spellbook Function — both shipped to api/*, making the TODO comments at src/services/edhrec.js:4 and src/services/spellbook.js:8 stale and incorrect"
provides:
  - "Stale serverless-proxy TODO comments retired in src/services/edhrec.js (line 3-4) and src/services/spellbook.js (line 7-8); replaced with informative dual-environment URL-alignment documentation"
  - "End-to-end verification that npm run build:check exits 0 post-Phase-15 (PROXY-04 closure via the existing tests/bundle-budget.test.js + scripts/assert-bundle-budget.js gate)"
  - "Confirmation that EDHREC_BASE = '/api/edhrec' and SPELLBOOK_BASE = '/api/spellbook' are byte-identical to their pre-Phase-15 state — full PROXY-02 closure (zero-diff client services)"
  - "Confirmation that dist/api does not exist (Vercel server-side bundling boundary preserved — Functions never enter the client bundle)"
  - "Phase 15 closure: PROXY-01..05 all checked, Phase 16 (Live UAT) unblocked"
affects: [phase-16-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Comment hygiene at the dev/prod boundary: when a TODO references infrastructure that has since shipped, the replacement comment should explicitly map both environments (dev → Vite proxy, prod → Vercel Function) so future readers don't re-discover the catch-all path-alignment from scratch"

key-files:
  created:
    - ".planning/phases/15-edhrec-cors-proxy/deferred-items.md — logs 8 pre-existing test failures in tests/perf/remeasure-contract.test.js (Phase 13 path-resolution drift after v1.1 milestone archive) for v1.2 follow-up"
  modified:
    - "src/services/edhrec.js — comment lines 3-4 swapped (4 lines added, 4 deleted via the replace-pair); EDHREC_BASE constant unchanged"
    - "src/services/spellbook.js — comment lines 7-8 swapped (4 lines added, 4 deleted); SPELLBOOK_BASE constant unchanged"

key-decisions:
  - "Replacement comments include the explicit Vite-config + Vercel-Function path references so the catch-all dual-environment alignment is documented inline rather than buried in CONTEXT.md (D-01, D-02)"
  - "Pre-existing failures in tests/perf/remeasure-contract.test.js logged to deferred-items.md and explicitly NOT fixed — out of plan 15-03 scope per GSD scope boundary; failures unchanged whether plan 15-03 commits land or not (verified by reverting Task 1 files to HEAD~1 and running tests, identical 8/1069 result)"
  - "Empty marker commit used for Task 2 build:check verification (no files touched in Task 2 itself, but recording an explicit verification commit makes Phase 15 closure auditable from git log alone)"

patterns-established:
  - "Bundle-budget gate (npm run build:check → main ≤ 300 KB gz) confirmed as the load-bearing PROXY-04 verification — no new bundle-inspection test added, the existing gate is sufficient when the new code lives in api/ (server-side) rather than src/ (client-side)"

requirements-completed: [PROXY-02, PROXY-04]

# Metrics
duration: 12min
completed: 2026-04-28
---

# Phase 15 Plan 03: Phase 15 Closure & Bundle-Budget Verification Summary

**Two-line comment swap retiring the stale "wire to a serverless proxy" TODOs in src/services/edhrec.js + src/services/spellbook.js, plus end-to-end `npm run build:check` confirming the post-Phase-15 main bundle stays at 36.0 KB gz (well within the 300 KB budget) — closes PROXY-02 + PROXY-04 and ships Phase 15 in full**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-28T10:25:00Z (approx, post Plan 15-02 completion)
- **Completed:** 2026-04-28T10:37:00Z
- **Tasks:** 2
- **Files modified:** 2 (src/services/edhrec.js, src/services/spellbook.js)
- **Files created:** 1 (.planning/phases/15-edhrec-cors-proxy/deferred-items.md, plus this SUMMARY)

## Accomplishments

- Stale TODO comments at `src/services/edhrec.js:4` and `src/services/spellbook.js:8` ("In production, wire /api/{service} to a serverless proxy or edge function") removed — they were pointing to work that Plans 15-01 and 15-02 had just shipped
- Replacement comments document the dual-environment URL alignment inline: each constant (`EDHREC_BASE` / `SPELLBOOK_BASE`) now has a two-line comment naming both the dev (Vite proxy at specific `vite.config.js` line range) and prod (Vercel Function at exact path) consumers
- `git diff --stat src/services/edhrec.js src/services/spellbook.js` shows exactly 4 insertions + 4 deletions (2-for-2 per file) — comment-only change, zero behavioral diff
- `EDHREC_BASE = '/api/edhrec';` (line 5) and `SPELLBOOK_BASE = '/api/spellbook';` (line 9) are byte-identical to their pre-Phase-15 state — completes the PROXY-02 contract that Plans 15-01 and 15-02 each individually satisfied via zero-line client diffs
- `npm run build:check` exits 0; main bundle = **36.0 KB gz** (`index-C_rvNwqN.js`, budget 300 KB); all 34 chunks within their respective budgets (largest is `precon-deck-memberships-CXtpFkNw.js` at 415.5 KB / 500 KB default budget — pre-existing precon data file, unchanged by Phase 15)
- `dist/api` does not exist after `vite build` — confirms Vercel Functions in `api/*` are correctly treated as server-side-only and don't enter the client bundle
- 4 targeted vitest files pass 44/44 tests: `tests/edhrec-service.test.js`, `tests/spellbook-service.test.js`, `tests/api-edhrec-proxy.test.js`, `tests/api-spellbook-proxy.test.js`
- 0 `src/*` files import from `api/*` (verified via `grep -r "from ['\"]\\.\\./\\.\\./api" src/` returning nothing) — D-08 server/client separation invariant holds

## Task Commits

Each task was committed atomically:

1. **Task 1: Retire stale serverless-proxy TODO comments** — `760611b` (chore)
2. **Task 2: Verify npm run build:check post-Phase-15** — `6b2948f` (chore, empty marker commit recording verification results in body)

**Plan metadata:** _(this commit — combines SUMMARY + STATE/ROADMAP/REQUIREMENTS updates + deferred-items.md)_

## Files Created/Modified

- **`src/services/edhrec.js`** (modified, 4 lines insert / 4 delete) — comment lines 3-4 swapped from "Proxy through Vite dev server… In production, wire /api/edhrec to a serverless proxy or edge function" to "EDHREC_BASE serves /api/edhrec/* in both environments: dev → Vite proxy (vite.config.js:7-12); prod → Vercel Function (api/edhrec/[...path].js)". Constant on line 5 untouched. All 162 other lines (rate-limited fetch, getCommanderSynergies, fetchTopSaltMap, normalizeSalt, aggregateDeckSalt) byte-identical
- **`src/services/spellbook.js`** (modified, 4 lines insert / 4 delete) — comment lines 7-8 swapped to "SPELLBOOK_BASE serves /api/spellbook/* in both environments: dev → Vite proxy (vite.config.js:13-17); prod → Vercel Function (api/spellbook/[...path].js)". Constant on line 9 untouched. JSDoc block (lines 1-5), `mapCombo`, and `findDeckCombos` all byte-identical
- **`.planning/phases/15-edhrec-cors-proxy/deferred-items.md`** (created) — logs 8 pre-existing test failures discovered during `npm test` run; root-cause is `tests/perf/remeasure-contract.test.js` looking for `13-REMEASURE.md` at the pre-archive path. Verified pre-existing (failures identical when Task 1 reverted), out of plan 15-03 scope. v1.2 follow-up

## Decisions Made

- **Replacement comments use literal `vite.config.js:7-12` / `vite.config.js:13-17` line references** — these will drift slightly if vite.config.js is re-laid-out, but they're more useful than vague "dev proxy" labels and the planner's specific guidance was to "explain the dual-environment URL alignment" (D-01, D-02). The catch-all alignment is non-obvious enough that future readers benefit from the precise pointer
- **Used `git commit --allow-empty` for Task 2 marker** — the plan's Step 5 explicitly allows this when no files are touched in a verification-only task. The commit body captures the build:check exit code, main bundle size, and all sanity-check results so the verification is auditable from `git log -1 6b2948f` alone, not just from this SUMMARY
- **Did NOT add a "no `api/*` imported from `src/*`" guard test** — D-08 explicitly rejected this as belt-and-suspenders. The bundle-budget gate plus the absence of `dist/api` post-build is sufficient evidence; adding a guard test would be scope creep against an architectural invariant Vercel enforces structurally

## Deviations from Plan

None — plan 15-03 executed exactly as written. The two comment edits landed cleanly in a single Edit tool call each, the targeted vitest run passed first try (44/44), and `npm run build:check` exited 0 first try.

The `deferred-items.md` write-up is NOT a deviation — pre-existing failures in unrelated test files are explicitly within GSD's scope-boundary handling (log + continue, do NOT fix). Plan 15-03's `<verify>` block specifies the 4 targeted vitest files (which all pass), not the full `npm test` suite. The full `npm test` was run during Step 1 of Task 2 as a sanity check; the 8 failures it surfaced are Phase 13 path-resolution issues post-v1.1-archive, not Phase 15 regressions.

## Issues Encountered

- **Pre-existing test failures discovered via `npm test`**: 8 failures in `tests/perf/remeasure-contract.test.js`. Investigation: reverted Task 1's two-file comment swap to HEAD~1 (commit `cc9a5a4`), ran `npm test` again, observed identical 8-failures-1049-passes result. Conclusion: failures are pre-existing, attributable to v1.1 milestone archive moving `13-REMEASURE.md` from `.planning/phases/13-*/` to `.planning/milestones/v1.1-phases/13-*/` without updating the test's path resolver. Restored Task 1 changes (`git checkout HEAD -- src/services/edhrec.js src/services/spellbook.js`), confirmed clean working tree, logged to `deferred-items.md`, continued. Phase 16 will need to fix this since Phase 16 UAT-02 (Production Lighthouse run) explicitly references `PERF-BASELINE.md` cross-referenced from `13-REMEASURE.md`

## Self-Check: PASSED

- `src/services/edhrec.js` exists and contains `const EDHREC_BASE = '/api/edhrec';` ✓
- `src/services/spellbook.js` exists and contains `const SPELLBOOK_BASE = '/api/spellbook';` ✓
- `grep -c "wire /api/edhrec to a serverless proxy" src/services/edhrec.js` returns 0 ✓
- `grep -c "wire /api/spellbook to a serverless proxy" src/services/spellbook.js` returns 0 ✓
- `grep -c "Vercel Function" src/services/edhrec.js` returns 1 ✓
- `grep -c "Vercel Function" src/services/spellbook.js` returns 1 ✓
- `grep -c "import.meta.env" src/services/edhrec.js` returns 0 ✓
- `grep -c "import.meta.env" src/services/spellbook.js` returns 0 ✓
- Commit `760611b` (Task 1 chore) found in `git log` ✓
- Commit `6b2948f` (Task 2 chore — empty marker) found in `git log` ✓
- `npm run build:check` exit code 0 ✓ (main bundle 36.0 KB gz, budget 300 KB)
- `test -f "api/edhrec/[...path].js"` exits 0 ✓
- `test -f "api/spellbook/[...path].js"` exits 0 ✓
- `ls dist/api 2>/dev/null` returns nothing ✓
- 4 targeted vitest files pass 44/44 ✓
- `git diff --stat src/services/edhrec.js src/services/spellbook.js` shows 4 insertions / 4 deletions ✓
- `.planning/phases/15-edhrec-cors-proxy/deferred-items.md` exists ✓

## User Setup Required

None — Vercel Functions auto-deploy on `master` push (DEPLOY-03 validated inline 2026-04-28). No env vars, no dashboard config, no manual promotion. Live verification of the EDHREC + Spellbook proxies happens in Phase 16 UAT against the real Preview URL.

## Next Phase Readiness

- **Phase 15 closure complete.** All five PROXY requirements (PROXY-01..05) closed across Plans 15-01 (EDHREC Function + tests), 15-02 (Spellbook Function + tests), 15-03 (TODO cleanup + bundle-budget verification)
- **Phase 16 (Live-Environment UAT Pass) unblocked.** Should explicitly include in its UAT script:
  - EDHREC commander synergy lookup against the live Preview URL (proves Plan 15-01 Function works in production)
  - Spellbook combo lookup via deck-builder flow (proves Plan 15-02 Function works in production)
  - Verification that the v1.0-since-launch CORS-preflight failure no longer reproduces
  - Fix for the 8 pre-existing test failures in `tests/perf/remeasure-contract.test.js` (path-resolution drift after v1.1 archive — needed before Phase 16 can run a Production Lighthouse re-baseline)
- **No blockers for Phase 16** beyond the deferred test-fix above

---
*Phase: 15-edhrec-cors-proxy*
*Plan: 15-03*
*Completed: 2026-04-28*
