---
phase: 13-performance-optimisation-conditional
plan: 06
subsystem: perf
tags: [perf-signoff, soft-gate, lighthouserc, lhci, github-actions, warn-not-block, d-11, ci, phase-closer]
status: complete
branch: B
completed: 2026-04-22
tasks: 7/7

# Dependency graph
requires:
  - phase: 13-01
    provides: Branch B verdict establishing which plans Phase 13 ran; feeds Optimisations Shipped section of PERF-SIGNOFF.md
  - phase: 13-02
    provides: bfcache + shimmer fixes recorded as Plan 2 Optimisations Shipped row
  - phase: 13-03
    provides: streaming UI refactor recorded as Plan 3 Optimisations Shipped row (2 inline regression rounds noted in post-mortem)
  - phase: 13-04
    provides: CLS skip audit trail referenced in PERF-SIGNOFF.md §Skipped plans
  - phase: 13-05
    provides: Bundle split + structural h1 LCP fix; final LCP 2.49s reported as PERF-04 closure metric; Task 5 → Task 6 hypothesis correction featured in honest post-mortem
  - phase: 07-03
    provides: PERF-BASELINE.md — source of v1.0 baseline numbers + Phase 7 target thresholds (frozen per D-14)
provides:
  - lighthouserc.cjs warn-level `ci.assert.assertions` (LCP ≤ 2500, CLS ≤ 0.1, FCP ≤ 1000, INP ≤ 200) — CI soft-gate config
  - .github/workflows/perf-soft-gate.yml — PR workflow running `@lhci/cli autorun` with `continue-on-error: true`, warning not blocking
  - scripts/lhci-warn-summary.cjs — parses `.lighthouseci/assertion-results.json` → markdown table → $GITHUB_STEP_SUMMARY (always exits 0)
  - .planning/phases/13-performance-optimisation-conditional/13-PERF-SIGNOFF.md — phase-closer human-readable report formally closing PERF-04
  - .planning/phases/13-performance-optimisation-conditional/13-SOFT-GATE-DRYRUN.md — local dry-run evidence that workflow exits 0 on simulated regression
affects:
  - REQUIREMENTS.md (PERF-04 formally closed)
  - PROJECT.md (Phase 13 validated; v1.1 meets perf budget)
  - CI pipeline (new workflow activates automatically on next PR touching watched paths)
  - v1.2 roadmap (soft-gate established; can be promoted to hard-gate in v1.2 if team wants blocking behaviour)

# Tech tracking
tech-stack:
  added:
    - "@lhci/cli@0.15.1 (already a transitive dep via lighthouse; now explicitly invoked in CI)"
  patterns:
    - "Warn-not-block CI gate pattern — `continue-on-error: true` + `if: always()` summary step keeps PRs mergeable while still surfacing regressions visibly to reviewers"
    - "Single-source assertion config — lighthouserc.cjs thresholds match PERF-BASELINE.md §Targets verbatim so local `npm run perf` and CI soft-gate report identical pass/fail on identical runs"
    - "GITHUB_STEP_SUMMARY markdown emission — scripts/lhci-warn-summary.cjs writes a formatted table to the env-var-provided file, PR Checks UI renders it inline in the workflow run summary without requiring a PR comment"
    - "Local dry-run before ship pattern — 13-SOFT-GATE-DRYRUN.md captures the exact npx command + simulated regression + verification that workflow exits 0; acts as the integration-test-by-evidence for a CI workflow that only runs on GitHub actions"

key-files:
  created:
    - lighthouserc.cjs
    - .github/workflows/perf-soft-gate.yml
    - scripts/lhci-warn-summary.cjs
    - tests/soft-gate-config.test.js
    - .planning/phases/13-performance-optimisation-conditional/13-PERF-SIGNOFF.md
    - .planning/phases/13-performance-optimisation-conditional/13-SOFT-GATE-DRYRUN.md
  modified: []
  skipped: []

commits:
  - 84d87bc  test(13-06): Task 1 — Wave 0 RED for @lhci/cli soft-gate config
  - c1a32bf  feat(13-06): Task 2 — warn-level assert block in lighthouserc.cjs (D-11)
  - 43fde84  feat(13-06): Task 3 — lhci-warn-summary.cjs GITHUB_STEP_SUMMARY helper
  - e72de75  ci(13-06): Task 4 — PR soft-gate workflow (D-11)
  - f50fe97  docs(13-06): Task 5 — soft-gate local dry-run verification
  - c973792  docs(13-06): Task 6b — finalise PERF-SIGNOFF.md (Branch B)
---

## What shipped

Plan 6 is the Phase 13 closer — it delivers two artifacts that jointly close PERF-04:

### 1. CI soft-gate infrastructure (Tasks 1-5)

A warn-not-block CI gate that runs `@lhci/cli autorun` on PRs touching perf-critical paths and surfaces regressions via `$GITHUB_STEP_SUMMARY` without blocking the merge queue.

**Why warn-not-block (D-11):** Phase 7 shipped `npm run perf` as a dev-local command with explicit caveats about variance and version drift. Promoting it to a hard CI gate would force every PR author to debug perf noise that has nothing to do with their change. The soft-gate surfaces regressions to reviewers but keeps PR velocity — consistent with the project's solo-dev + trunk-based discipline.

**How it works:**
- `lighthouserc.cjs` adds `ci.assert.assertions` for the four gateable Web Vitals with thresholds pulled verbatim from `PERF-BASELINE.md §Targets` (LCP ≤ 2500ms, CLS ≤ 0.1, FCP ≤ 1000ms, INP ≤ 200ms). Single source of truth so local `npm run perf` and CI produce identical pass/fail.
- `.github/workflows/perf-soft-gate.yml` triggers on PRs to main/master when any file in `src/**`, `vite.config.js`, `vercel.json`, `index.html`, `lighthouserc.cjs`, `scripts/assert-bundle-budget.js`, or `.github/workflows/perf-soft-gate.yml` itself changes. Runs `npm run build` → `npx @lhci/cli@0.15.1 autorun` with `continue-on-error: true`. A following step (`if: always()`) runs `scripts/lhci-warn-summary.cjs` which reads `.lighthouseci/assertion-results.json`, formats any warn-level failures into a markdown table, writes to `$GITHUB_STEP_SUMMARY`, and exits 0 unconditionally.
- `tests/soft-gate-config.test.js` asserts three invariants via static-grep: thresholds match PERF-BASELINE.md exactly, workflow uses `continue-on-error: true`, summary script exits 0. 3/3 GREEN.

**Local dry-run evidence:** `13-SOFT-GATE-DRYRUN.md` captures the exact `npx @lhci/cli@0.15.1 autorun` invocation against a simulated regression (LCP 2849ms > 2500ms threshold). Confirmed workflow-equivalent behaviour: exit code 0, assertion-results.json contains the warn-level failure, summary file rendered the expected markdown table. Counts as integration-test-by-evidence for a CI workflow that only runs on GitHub runners.

### 2. 13-PERF-SIGNOFF.md (Task 6b) — the phase closer

An 18 KB human-readable report published to `.planning/phases/13-performance-optimisation-conditional/13-PERF-SIGNOFF.md`. Structure:

- **Executive summary** — `v1.1 meets perf budget`, final numbers, PERF-04 formally MET
- **Measurement trajectory** — 5-point Lighthouse table spanning Phase 7 baseline → Plan 1 → Post-Plan-3 → Post-Plan-5 Task 5 → Post-Plan-5 Task 6
- **Optimisations Shipped** — plan-by-plan contribution with cross-references to each plan SUMMARY
- **Plan 4 skip evidence** — CLS under target (0.0594 < 0.1) at the post-Plan-3 gate; D-07 audit-driven skip path success
- **Known residuals** — Scryfall image delivery (out-of-scope), Preordain Upcoming Releases bug (13-FINDINGS.md, deferred), sign-out re-open legacy auth-wall path (v1.2 candidate), CLS trajectory upward (still under target), INP lab-only (defer to field)
- **Honest post-mortem** — Plan 5 Task 5 → Task 6 hypothesis correction is preserved (not glossed). Pre-execution hypothesis was font-blocking / bundle-size LCP; measurement after Task 5 falsified it; investigation revealed the JS-mount root cause; Option A structural fix landed as Task 6
- **Methodology reproducibility** — Lighthouse CLI v12.6.1, desktop preset, single run, headless Chromium; cross-version drift from baseline (13.0.2) documented per Pitfall 1
- **Formal PERF-04 closure** — requirement ID marked complete

## Invariants preserved

- `PERF-BASELINE.md` untouched (D-14 frozen — `git diff .planning/phases/07-.../PERF-BASELINE.md` returns 0 lines)
- `npm run perf` (D-12 manual dev-local path) unchanged — soft-gate is a net-new CI pipeline, not a replacement

## Phase 13 outcome

| Plan | Status | Contribution |
|------|--------|--------------|
| 13-01 | ✅ complete | Branch B verdict (LCP gap) + methodology v2026-04-20 |
| 13-02 | ✅ complete | bfcache both session states + shimmer composability (D-08, D-09) |
| 13-03 | ✅ complete | Streaming UI refactor (D-04, D-05, D-06) + 2 inline regression patches + asset path fix |
| 13-04 | ⏭ skipped | CLS already under target (0.0594 < 0.1) — D-07 audit-driven skip success |
| 13-05 | ✅ complete | Infrastructure (Tasks 1-5) + structural h1 LCP fix (Task 6); LCP 6.13s → 2.49s (−59%) |
| 13-06 | ✅ complete | **this plan** — CI soft-gate + PERF-SIGNOFF.md + formal PERF-04 closure |

## Acceptance per Plan 6 must_haves

| Truth                                                                                            | Met? | Evidence                                                                 |
|--------------------------------------------------------------------------------------------------|:----:|--------------------------------------------------------------------------|
| `lighthouserc.cjs` declares warn-level assertions matching PERF-BASELINE §Targets                |  ✓   | Task 2 `c1a32bf`; `tests/soft-gate-config.test.js` Test 1 GREEN          |
| `.github/workflows/perf-soft-gate.yml` exists and uses `continue-on-error: true`                 |  ✓   | Task 4 `e72de75`; Test 2 GREEN                                           |
| `scripts/lhci-warn-summary.cjs` writes to $GITHUB_STEP_SUMMARY and always exits 0                |  ✓   | Task 3 `43fde84`; Test 3 GREEN; dry-run log confirms exit code = 0       |
| `13-PERF-SIGNOFF.md` written with verdict, trajectory, optimisations, residuals, post-mortem     |  ✓   | Task 6b `c973792`; 18 KB file at expected path                           |
| Local dry-run proves workflow exits 0 on regression                                              |  ✓   | Task 5 `f50fe97`; `13-SOFT-GATE-DRYRUN.md` captures exact npx invocation |
| `PERF-BASELINE.md` unchanged (D-14 frozen)                                                       |  ✓   | `git diff` against HEAD returns 0 lines for that file                    |
| `npm run perf` behaviour unchanged (D-12 manual path preserved)                                  |  ✓   | package.json scripts.perf not touched by this plan                       |

## Files touched (Plan 6 aggregate)

- **Created (6):** lighthouserc.cjs, .github/workflows/perf-soft-gate.yml, scripts/lhci-warn-summary.cjs, tests/soft-gate-config.test.js, 13-PERF-SIGNOFF.md, 13-SOFT-GATE-DRYRUN.md
- **Modified:** 0 (Plan 6 is strictly additive — no touching of existing baseline artifacts or scripts)
- **Commits:** 6 atomic commits, all with `--no-verify` per Phase 13 convention

## Self-Check

- [x] All 6 commits verified in git log (`84d87bc` → `c973792`)
- [x] `tests/soft-gate-config.test.js` 3/3 GREEN (all three invariants asserted)
- [x] `13-PERF-SIGNOFF.md` reviewed and approved by user (`perf-signoff-approved`)
- [x] Local dry-run behaviour matches CI workflow expectations (exit 0, summary rendered)
- [x] D-14 and D-12 invariants preserved
- [x] All `must_haves.truths` satisfied
- [x] Cross-plan impacts documented in PERF-SIGNOFF.md §Optimisations Shipped

## Phase 13 closure

With Plan 6 shipped, all plans in Phase 13 have either landed (1, 2, 3, 5, 6) or documented a measurement-driven skip (4). PERF-04 is formally closed in `13-PERF-SIGNOFF.md` and will be marked complete in `REQUIREMENTS.md` as part of this commit. ROADMAP.md advances Phase 13 → Complete. PROJECT.md evolves its Validated Requirements section to reflect v1.1 meeting its perf budget.
