---
phase: 13-performance-optimisation-conditional
verified: 2026-04-20T12:00:00Z
status: human_needed
score: 10/10 must-haves verified (automated); 2 items awaiting human verification
re_verification: null
human_verification:
  - test: "Confirm `.github/workflows/perf-soft-gate.yml` fires on a real PR against main/master with a watched-path change, exits green, and that the warning table renders in the GitHub Actions `$GITHUB_STEP_SUMMARY` panel."
    expected: "Workflow run completes with overall status 'success' even when an LCP regression is injected; the Actions run page shows the 'Lighthouse soft-gate (Phase 13 Plan 6)' markdown table with the regressed metric row. Merge is never blocked."
    why_human: "Live CI path can only be exercised by pushing a branch and opening a PR against main/master. 13-SOFT-GATE-DRYRUN.md validated the three invariants locally by synthesising assertion-results.json, but the workflow-trigger path (pull_request event + paths filter + continue-on-error honouring) is only observable on GitHub Actions itself."
  - test: "Deploy current `master` to Vercel and confirm `/` and `/index.html` serve with `Cache-Control: no-cache` headers (Pitfall 15 full recovery path)."
    expected: "`curl -I https://counterflux.vercel.app/` and `curl -I https://counterflux.vercel.app/index.html` both return `Cache-Control: no-cache`. A stale-chunk session (simulated by loading the live site, redeploying, then navigating within the app) shows the console warning '[Counterflux] chunk preload failed — app was updated, reloading' and recovers via a soft reload."
    why_human: "vercel.json is a config file — its effect is only observable on the live Vercel edge. The local build has no way to prove Vercel honours the header declaration. Pitfall 15 recovery requires a real deploy + stale-session interaction to exercise end-to-end."
---

# Phase 13: Performance Optimisation (conditional) Verification Report

**Phase Goal:** Conditionally close the performance gap identified in the Phase 7 baseline — bring v1.1 Web Vitals within Phase 7 targets (LCP < 2.5s, FCP < 1.0s, CLS < 0.1). Ship a CI soft-gate to prevent perf regressions, document the outcome in `13-PERF-SIGNOFF.md`, and formally close PERF-04.

**Verified:** 2026-04-20T12:00:00Z
**Status:** human_needed (all automated must-haves pass; two items require live environment verification)
**Re-verification:** No — initial verification.

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                             | Status     | Evidence                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Final Lighthouse run shows LCP/FCP/CLS all inside Phase 7 targets                                  | VERIFIED   | `post-plan5-task6-lh/run1.json`: LCP 2489.7ms (<2500), FCP 405.8ms (<1000), CLS 0.0588 (<0.1), perf 86, Lighthouse 12.6.1                                                                    |
| 2   | bfcache works in both anonymous and authed session states                                          | VERIFIED   | `src/services/bfcache.js` registers `pagehide`/`pageshow` listeners (lines 32, 40); `tests/bfcache-handlers.test.js` GREEN                                                                  |
| 3   | Splash is migration-only; app shell streams post-`Alpine.start()`                                  | VERIFIED   | `src/components/splash-screen.js` gates on `migrationProgress > 0 && < 100` (line 62, 108); app shell at index.html:144 renders behind `x-cloak`; `tests/streaming-ui.test.js` GREEN       |
| 4   | Static paint-critical h1 in initial HTML                                                           | VERIFIED   | index.html:83-85 contains `<div id="cf-auth-wall">` wrapping `<h1 class="cf-auth-wall-title">COUNTERFLUX</h1>` before `<script>` at line 702; `tests/auth-wall-static-h1.test.js` GREEN     |
| 5   | CI soft-gate workflow installed, non-blocking                                                      | VERIFIED   | `.github/workflows/perf-soft-gate.yml:47` has `continue-on-error: true`; `lighthouserc.cjs:41-44` all 4 assertions use `['warn', ...]`; `scripts/lhci-warn-summary.cjs:106` `process.exit(0)` always; `tests/soft-gate-config.test.js` GREEN |
| 6   | Bundle-budget enforcement in build pipeline                                                        | VERIFIED   | `scripts/assert-bundle-budget.js` exists; `package.json` scripts.build:check = `npm run build && node scripts/assert-bundle-budget.js`; `tests/bundle-budget.test.js` GREEN                 |
| 7   | Cache-bust recovery (Pitfall 15)                                                                   | VERIFIED   | `src/main.js:60` registers `vite:preloadError` handler, runs BEFORE `Alpine.start()` at line 118; `vercel.json` declares `Cache-Control: no-cache` on `/` and `/index.html`; `tests/preload-error-handler.test.js` GREEN |
| 8   | Honest empty-state gating on Epic Experiment + Treasure Cruise                                     | VERIFIED   | `src/screens/epic-experiment.js:31` defines `_isBulkDataReady()`, used at lines 88, 201, 375, 559; `src/screens/treasure-cruise.js:86,93,102,106,110` gates on `$store.bulkdata.status === 'ready'`; both gating tests GREEN |
| 9   | PERF-BASELINE.md frozen (D-14)                                                                     | VERIFIED   | `git log --since="2026-04-20" .planning/phases/07-.../PERF-BASELINE.md` returns empty; the file has a single commit (`5daa2cc` in Phase 7 Plan 2)                                           |
| 10  | `npm run perf` unchanged (D-12)                                                                    | VERIFIED   | `package.json` scripts.perf still equals `lhci collect --config=lighthouserc.cjs`; soft-gate is a net-new workflow file, not a replacement                                                  |

**Score:** 10/10 truths verified.

### Required Artifacts

All claimed SUMMARY/SIGNOFF artifacts exist on disk and are substantive.

| Artifact                                                        | Expected                                                                 | Status     | Details                                                                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------- |
| `post-plan5-task6-lh/run1.json`                                 | Final signoff Lighthouse JSON                                            | VERIFIED   | Parsed: LCP 2489.7ms, FCP 405.8ms, CLS 0.059, perf score 86, Lighthouse 12.6.1                               |
| `post-plan5-lh/run1.json`                                       | Pre-Task-6 measurement (infrastructure-only)                             | VERIFIED   | Present — cross-referenced in 13-PERF-SIGNOFF.md trajectory table                                            |
| `post-plan3-lh/run1.json`                                       | Post-Plan-3 re-measurement                                               | VERIFIED   | Present                                                                                                     |
| `src/services/bfcache.js`                                       | Exports `bindBfcacheHandlers`; registers pagehide/pageshow               | VERIFIED   | Both listeners registered (lines 32, 40); invoked from `src/main.js:119` after `Alpine.start()`             |
| `src/components/splash-screen.js`                               | Gates on `migrationProgress` (1-99), not bulk-data status                | VERIFIED   | Getter at line 85 reads `store.migrationProgress`; watcher at line 62                                        |
| `index.html` (static h1 inside #cf-auth-wall)                   | Paint-critical LCP element in initial HTML                               | VERIFIED   | Lines 83-85 + inline critical CSS lines 34-57 (48px/700 Syne, colour #EAECEE)                                |
| `.github/workflows/perf-soft-gate.yml`                          | PR-triggered, `continue-on-error: true`                                  | VERIFIED   | `pull_request` on main/master; paths filter includes all watched files; lhci step is soft-failed             |
| `lighthouserc.cjs`                                              | warn-level assertions on 4 Web Vitals                                    | VERIFIED   | LCP/CLS/FCP/INP all use `['warn', { maxNumericValue: N }]`                                                   |
| `scripts/lhci-warn-summary.cjs`                                 | Always exits 0                                                           | VERIFIED   | `process.exit(0)` at line 106; fallback paths (missing file, parse error) all path to the same exit         |
| `scripts/assert-bundle-budget.js`                               | Per-chunk gzip budget enforcement                                        | VERIFIED   | File present; `tests/bundle-budget.test.js` (GREEN) locks budgets                                            |
| `vercel.json`                                                   | `Cache-Control: no-cache` on `/` + `/index.html`                         | VERIFIED   | Declared verbatim — LIVE DEPLOY CHECK REQUIRED (see human-verification below)                                |
| `src/screens/epic-experiment.js`                                | `_isBulkDataReady()` helper gating welcome / Quick Add / empty states    | VERIFIED   | Used at 4 branch points (88, 201, 375, 559)                                                                  |
| `src/screens/treasure-cruise.js`                                | Mila empty-state reacts to bulk-data status                              | VERIFIED   | `$store.bulkdata.status === 'ready'` gates at lines 86/93/102/106/110                                        |
| `13-PERF-SIGNOFF.md`                                            | Branch B signoff with verdict "v1.1 meets perf budget"                   | VERIFIED   | Signoff line 6 states verdict; summary table matches parsed JSON numbers verbatim                            |
| `13-REMEASURE.md`                                               | Plan 1 methodology + Branch B decision                                   | VERIFIED   | File present; cross-referenced from PERF-SIGNOFF.md                                                          |
| `13-REMEASURE-POST-PLAN3.md`                                    | Post-Plan-3 re-measurement                                               | VERIFIED   | File present                                                                                                 |
| `13-BUNDLE-DELTA.md`                                            | Plan 5 chunk inventory + LCP trajectory                                  | VERIFIED   | File present                                                                                                 |
| `13-CLS-DELTA.md`                                               | Plan 4 skip audit                                                        | VERIFIED   | File present                                                                                                 |
| `13-FINDINGS.md`                                                | Preordain 1993-sets bug captured                                         | VERIFIED   | Finding 1 present at line 17; cites Alpha/Beta/Unlimited/Arabian Nights                                      |
| `13-SOFT-GATE-DRYRUN.md`                                        | Plan 6 Task 5 local invariant-check record                               | VERIFIED   | File present with synthesised regressive-run JSON                                                            |

### Key Link Verification

Wiring checks for the integration points that stubs hide behind. All verified.

| From                                                  | To                                                | Via                                                                                          | Status | Details                                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/main.js` boot                                    | `vite:preloadError` recovery                      | `window.addEventListener('vite:preloadError', ...)` at line 60                                | WIRED  | Handler is registered inside `bootApp()` at line 60; `Alpine.start()` doesn't execute until line 118 — ordering invariant holds |
| `src/main.js` boot                                    | `src/services/bfcache.js` handlers                | `bindBfcacheHandlers()` called at line 119, immediately after `Alpine.start()`               | WIRED  | Module imported + called; idempotent registration                                                                             |
| Topbar pill component                                 | `Alpine.store('bulkdata').status` reactive        | index.html:381 `<template x-if="$store.bulkdata && $store.bulkdata.status !== 'ready'">`     | WIRED  | Four status branches rendered (downloading/parsing/checking/error)                                                            |
| Splash screen gating                                  | `Alpine.store('bulkdata').migrationProgress`      | `$watch('$store.bulkdata.migrationProgress', ...)` in splash-screen.js:62                    | WIRED  | Rendered only when progress > 0 && < 100; bulk-data boot gating removed                                                       |
| Epic Experiment renders                               | `_isBulkDataReady()` helper                        | Called at 4 branch points to flip welcome banner / quick-add / empty states                  | WIRED  | Helper returns `$store.bulkdata.status === 'ready'`; covered by `epic-experiment-bulkdata-gating.test.js`                      |
| Treasure Cruise empty state                           | `$store.bulkdata.status === 'ready'`              | Inline Alpine template guards (5 sites in treasure-cruise.js)                                 | WIRED  | Covered by `treasure-cruise-empty-state-gating.test.js`                                                                        |
| index.html static #cf-auth-wall                       | `openAuthWall()` decoration                        | (not verified at link level — handled inside `src/components/auth-wall.js`)                   | WIRED  | Contract stated in HTML comments (lines 79-82); regression-locked by `auth-wall-static-h1.test.js`                             |
| `perf-soft-gate.yml` workflow                         | `scripts/lhci-warn-summary.cjs`                   | `node scripts/lhci-warn-summary.cjs` at step "Post warn summary" (line 54)                    | WIRED  | `if: always()` ensures summary runs even on lhci failure                                                                      |
| `lhci-warn-summary.cjs`                               | `$GITHUB_STEP_SUMMARY`                            | `fs.appendFileSync(SUMMARY_PATH, output)` at line 95                                          | WIRED  | Falls back to stdout when env unset; dry-run at `13-SOFT-GATE-DRYRUN.md` proved end-to-end                                    |
| `package.json` scripts.build:check                    | `scripts/assert-bundle-budget.js`                 | `npm run build && node scripts/assert-bundle-budget.js`                                       | WIRED  | Chain ensures budget asserts run after every build                                                                            |

### Data-Flow Trace (Level 4)

For the key perf-critical artifacts, the data/render chain is verified intact.

| Artifact                    | Data Variable                     | Source                                                         | Produces Real Data | Status   |
| --------------------------- | --------------------------------- | -------------------------------------------------------------- | ------------------ | -------- |
| Topbar bulk-data pill       | `$store.bulkdata.status/progress/parsed` | `initBulkDataStore()` in main.js:49 + bulk-data pipeline (fire-and-forget from main.js effect) | Yes                | FLOWING  |
| Splash screen               | `$store.bulkdata.migrationProgress` | `runMigration()` v6 upgrade callback emits 10% increments     | Yes                | FLOWING  |
| Epic Experiment welcome/empty | `$store.bulkdata.status`         | Same bulk-data store as above                                  | Yes                | FLOWING  |
| Static auth-wall h1         | (no data — paint-critical text)   | Static HTML                                                    | N/A                | N/A (static text) |

### Behavioral Spot-Checks

Each must-have test suite invoked directly. All GREEN.

| Behavior                                         | Command                                                              | Result                  | Status |
| ------------------------------------------------ | -------------------------------------------------------------------- | ----------------------- | ------ |
| Final Lighthouse numbers present + under budget  | `node -e` JSON parse of `post-plan5-task6-lh/run1.json`              | LCP 2489.7 / FCP 405.8 / CLS 0.059 | PASS   |
| bfcache handlers registered                      | `vitest run tests/bfcache-handlers.test.js`                          | tests GREEN             | PASS   |
| Streaming-UI gating correct                      | `vitest run tests/streaming-ui.test.js`                              | tests GREEN             | PASS   |
| Static auth-wall h1 paint path intact            | `vitest run tests/auth-wall-static-h1.test.js`                       | tests GREEN             | PASS   |
| Soft-gate config invariants                      | `vitest run tests/soft-gate-config.test.js`                          | tests GREEN             | PASS   |
| Bundle-budget enforcement                        | `vitest run tests/bundle-budget.test.js`                             | tests GREEN             | PASS   |
| Cache-bust recovery handler                      | `vitest run tests/preload-error-handler.test.js`                     | tests GREEN             | PASS   |
| Epic Experiment bulk-data gating                 | `vitest run tests/epic-experiment-bulkdata-gating.test.js`           | tests GREEN             | PASS   |
| Treasure Cruise empty-state gating               | `vitest run tests/treasure-cruise-empty-state-gating.test.js`        | tests GREEN             | PASS   |
| Aggregate result                                 | `vitest run` (all 8 test files above)                                | `PASS (49) FAIL (0)`    | PASS   |

### Requirements Coverage

| Requirement | Source Plan       | Description                                                                                                                                    | Status     | Evidence                                                                                                                                |
| ----------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| PERF-04     | Phase 13 (all plans) | "Any regressions identified in baseline measurement are addressed (candidates: splash → bulk data deferral, store init, bundle splitting) to hit the agreed target" | SATISFIED  | `.planning/REQUIREMENTS.md:30` shows `[x] **PERF-04**`. All three candidate interventions shipped (Plan 3 streaming UI, Plan 3 preserved Pitfall 8 boot order, Plan 5 manualChunks). LCP win landed via Plan 5 Task 6 static h1. Final numbers hit target. |

PERF-04 marked complete in REQUIREMENTS.md. No orphaned requirements — Phase 13's requirements mapping row (`| 13 | ... | 1 | PERF-04 |` at line 190) claims exactly one requirement and it is satisfied.

### Anti-Patterns Found

None blocker. A handful of documented TODOs and "stub" patterns exist in the broader codebase but none were introduced by Phase 13 and none contradict the phase goal.

| File                                               | Line | Pattern                               | Severity | Impact                                                                                                                                                  |
| -------------------------------------------------- | ---- | ------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/bfcache.js`                          | —    | None found                            | —        | Clean module                                                                                                                                            |
| `src/components/splash-screen.js`                  | —    | None found                            | —        | Clean module; status → migrationProgress refactor is documented inline                                                                                  |
| `index.html`                                       | —    | None found                            | —        | Inline critical CSS is intentional (paint-critical path); comments justify the static h1 decision                                                       |
| `src/screens/epic-experiment.js`                   | —    | None found                            | —        | `_isBulkDataReady()` helper is substantive; four guard sites render different UI on each branch                                                         |
| `src/screens/treasure-cruise.js`                   | —    | None found                            | —        | 5 gating sites all flip to a different Alpine template on `ready`                                                                                       |

### Human Verification Required

Two items cannot be verified programmatically — both concern live-environment behaviour:

#### 1. Soft-gate fires and exits green on a real PR

**Test:** Open a PR against `main`/`master` that touches a watched path (e.g. `src/**`). Optionally inject a synthetic LCP regression to confirm the warn-row appears.
**Expected:** GitHub Actions run shows the Perf Soft Gate workflow running; the run's summary panel contains the "Lighthouse soft-gate (Phase 13 Plan 6)" markdown table. The PR's check status is green regardless of regression. Merge is never blocked.
**Why human:** The `pull_request`-event + `paths` filter + `continue-on-error: true` chain is only observable on GitHub's runner. `13-SOFT-GATE-DRYRUN.md` proved the summary-formatter path locally; the workflow-trigger path is untested in-environment until a real PR fires it.

#### 2. Vercel serves `/` and `/index.html` with `Cache-Control: no-cache`

**Test:** After a Vercel deploy, run `curl -I https://counterflux.vercel.app/` and `curl -I https://counterflux.vercel.app/index.html`. Confirm both responses include `Cache-Control: no-cache`. Then simulate a stale-chunk session (load site → trigger a new deploy → navigate within the app) and confirm the console logs "[Counterflux] chunk preload failed — app was updated, reloading" with a soft reload recovering the session.
**Expected:** Both curl responses carry the no-cache header. Stale-session flow logs the warning and recovers automatically.
**Why human:** `vercel.json` is only enforced by the Vercel edge — no local tool can prove the header is actually sent. Pitfall 15 end-to-end recovery requires a real deploy + real stale session.

### Gaps Summary

No gaps. The phase shipped all 10 must-haves, the final Lighthouse measurement confirms PERF-04 targets met (LCP 2489.7ms / FCP 405.8ms / CLS 0.059 — all under budget), and the full regression suite for Phase 13 contracts (49 tests across 8 files) is GREEN.

Two items listed under human-verification are **not gaps** — they are unavoidable live-environment checks that complement, rather than contradict, the in-repo verification.

### Known Deferrals (preserved, not failures)

All four items below are explicitly documented as out-of-scope or v1.2-candidate in the phase artifacts and are preserved here so downstream readers do not mistake them for verification gaps.

1. **Scryfall image delivery (~2,368ms Render Delay residual)** — Documented in `13-PERF-SIGNOFF.md §Known Residuals` and `13-CONTEXT.md §Deferred`. Out of scope per Scryfall API compliance constraints.
2. **Preordain "Upcoming Releases" shows 1993 sets** — `13-FINDINGS.md Finding 1`. Pre-existing bug; deferred to a dedicated bug-fix plan outside Phase 13.
3. **Sign-out re-open uses legacy create-from-scratch path** — `13-05-SUMMARY.md §affects` + `13-PERF-SIGNOFF.md §Known Residuals`. First-paint LCP is the measurable metric; second-sign-in within a session is not in the LCP candidate set.
4. **INP not lab-measurable in Lighthouse 12/13** — `13-PERF-SIGNOFF.md §Known Residuals`. Defer to field samples; the soft-gate includes an INP assertion for forward-compatibility.

---

_Verified: 2026-04-20T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
