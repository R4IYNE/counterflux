---
phase: 13-performance-optimisation-conditional
plan: 04
subsystem: perf
tags: [cls, layout-shifts, d-07, audit-driven, skipped]
status: skipped
branch: B
completed: 2026-04-22
tasks: 0/3 (plan gate not met — no tasks executed)

# Dependency graph
requires:
  - phase: 13-01
    provides: Branch B verdict + initial CLS measurement (0.023)
  - phase: 13-03
    provides: Streaming UI refactor that re-shuffled DOM layout — post-Plan-3 CLS is the ground truth this plan was gated on
provides:
  - .planning/phases/13-performance-optimisation-conditional/13-CLS-DELTA.md — audit trail documenting the skip decision + current top-5 layout-shift sources
affects:
  - 13-06-PERF-SIGNOFF.md (Plan 6 consumes "CLS 0.0594 — PASS" as a Web Vitals row)
  - v1.2 roadmap (optional body-level min-height reservation if CLS trend worsens)

# Tech tracking
tech-stack:
  added: []
  patterns: []
  decisions:
    - "D-07 / Research Pattern 5 audit-driven fix model correctly gated this plan to `skip` — the post-measurement data supplied by 13-REMEASURE-POST-PLAN3.md made speculation-based fixes unnecessary. The plan was AUTHORED as a shell precisely to enable this skip path."

key-files:
  created:
    - .planning/phases/13-performance-optimisation-conditional/13-CLS-DELTA.md
    - .planning/phases/13-performance-optimisation-conditional/13-REMEASURE-POST-PLAN3.md (shared artifact — also consumed by Plan 5)
  modified: []
  skipped:
    - src/styles/main.css (would have received layout reservations IF CLS > 0.1)
    - src/styles/utilities.css (would have received skeleton classes IF CLS > 0.1)
    - index.html (would have received skeleton HTML IF CLS > 0.1)
    - tests/cls-reserved-space.test.js (would have locked fixes in IF CLS > 0.1)

commits:
  - (this summary commit — plan skip recorded alongside 13-REMEASURE-POST-PLAN3.md + 13-CLS-DELTA.md)
---

## Why this plan was skipped

Plan 13-04's `trigger_condition` requires **Branch B AND CLS > 0.1 after Plan 3**. The orchestrator ran a fresh Lighthouse against the Plan-3-post build on 2026-04-22 and measured:

- **CLS = 0.0594** (well under the 0.1 Web Vitals `Good` threshold)
- Same methodology as Plan 1 (`13-REMEASURE.md`) — single `npx lighthouse` run, desktop preset, headless Chrome, pragmatic-fallback per user election on 2026-04-20

The second half of the `AND` gate is false → plan skipped with audit-trail artifact (`13-CLS-DELTA.md`) preserved for Plan 6 PERF-SIGNOFF consumption.

## CLS trajectory across Phase 13

| Point                               | CLS    | Notes                                                            |
|-------------------------------------|-------:|------------------------------------------------------------------|
| Phase 7 baseline (2026-04-15)       | 1.00   | Splash overlay → dashboard swap was the 1.00 dominant culprit     |
| Plan 1 re-measurement (2026-04-20)  | 0.023  | Splash still present but already improved vs baseline (cross-version LH drift) |
| **Post-Plan-3 (2026-04-22)**        | **0.0594** | Plan 3 removed splash — body-level shift emerged but still under 0.1 |

The 0.023 → 0.0594 delta is tractable: the splash removal exposed a new body-level layout transition (0.0479) plus the topbar-pill mount (~0.011 cumulative). All five contributors are enumerated in `13-CLS-DELTA.md` with likely causes.

## D-07 (audit-driven fix model) outcome

Plan 13-04 was deliberately AUTHORED as a "shell" plan per D-07 and Research §Pattern 5 — the specific fix list was intentionally left unknown at plan-authoring time because Plan 3 was expected to re-shuffle the layout. This skip path is the **success case** of the audit-driven model: by measuring AFTER Plan 3 landed, we saved a round of speculative CSS reservations that would have targeted the wrong selectors (the original top-3 contributors were all inside the splash overlay which Plan 3 removed; speculating reservations on those would have been dead code).

## Plan 6 PERF-SIGNOFF input

Plan 6 will surface this as a Web Vitals `Good` pass:
- **CLS: 0.0594 — PASS** (target < 0.1)
- No fix work required; cumulative Phase 13 CLS improvement vs Phase 7 baseline: 1.00 → 0.0594 (16.8× improvement)

## v1.2 follow-up (optional, non-blocking)

Documented in `13-CLS-DELTA.md` §"v1.2 follow-up": if CLS trends upward across future phases, a `min-height: 100vh` reservation on the top-level app shell during the auth-wall → dashboard transition is the cleanest single fix target. Not required for v1.1 ship.

## Self-Check

- [x] Artifact `13-CLS-DELTA.md` exists with enumerated top-5 contributors
- [x] Artifact `13-REMEASURE-POST-PLAN3.md` exists with fresh Lighthouse numbers
- [x] CLS figure (0.0594) verified against raw Lighthouse report at `post-plan3-lh/run1.json`
- [x] `must_haves.truths` from 13-04-PLAN.md all satisfied OR marked N/A-via-skip
- [x] No source files modified — plan-modified list intentionally empty
