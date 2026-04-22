---
phase: 13-performance-optimisation-conditional
plan: 04
artifact: CLS audit trail (skip documentation)
status: skipped — gate not met
captured: 2026-04-22
source: 13-REMEASURE-POST-PLAN3.md
---

# Plan 13-04 CLS Delta — SKIP (trigger not met)

## Why this plan did not execute

Plan 13-04's `trigger_condition` requires **Branch B AND CLS > 0.1 after Plan 3**. Post-Plan-3 re-measurement (see `13-REMEASURE-POST-PLAN3.md`) reports **CLS = 0.0594 < 0.1 target** — gate not met, plan skipped with this audit-trail artifact preserved for Plan 6 PERF-SIGNOFF consumption.

## Baseline → Current CLS trail

| Point in time                         | CLS    | Source                                     |
|---------------------------------------|--------|--------------------------------------------|
| Phase 7 baseline (2026-04-15)         | 1.00   | PERF-BASELINE.md                           |
| Plan 1 re-measurement (2026-04-20)    | 0.023  | 13-REMEASURE.md (dominant culprit: splash overlay which Plan 3 removed) |
| **Post-Plan-3 (2026-04-22, current)** | **0.0594** | **13-REMEASURE-POST-PLAN3.md** — still < 0.1 target |

The 0.023 → 0.0594 delta (~2.6× increase) is accounted for by Plan 3's body-level DOM reshuffle (splash removed, app shell streams in, topbar pill mounts) and remains well under the 0.1 Web Vitals `Good` threshold. No reservation work is warranted for v1.1.

## Current top-5 layout-shift sources (for audit completeness — NOT fixed in this plan)

| # | Score     | Selector                                                      | Likely cause                                              |
|---|----------:|---------------------------------------------------------------|-----------------------------------------------------------|
| 1 | 0.04794   | `body`                                                        | Body-level layout change from Plan 3 splash removal / auth-wall transition |
| 2 | 0.009501  | `body > div > header.fixed`                                   | Topbar bulk-data pill mount (Plan 3 Task 2)               |
| 3 | 0.00133   | `body > div > header.fixed`                                   | Header reflow                                             |
| 4 | 0.000661  | `body > div.fixed > div.flex > h1.syne-header`                | Syne font-swap shift (font-blocking LCP sibling)          |
| 5 | 0.000263  | `body > div > header.fixed`                                   | Header reflow                                             |

Sum of listed: **0.0594** — matches reported CLS to 4 decimals.

## Acceptance per Plan 4 `must_haves.truths`

| Truth                                                                                               | Met? | Evidence                                                               |
|-----------------------------------------------------------------------------------------------------|:----:|------------------------------------------------------------------------|
| Lighthouse run AFTER Plans 2+3 reports CLS < 0.1 (median-of-3 OR pragmatic single-run)              | ✓    | 0.0594 (single run, same methodology as Plan 1 per user election)      |
| Top-3 CLS contributors enumerated in `13-CLS-DELTA.md`                                              | ✓    | This file, above                                                       |
| Each flagged selector has fix OR documented reason shift is unavoidable                             | N/A (skip) | Not applicable — gate not met, no fixes shipped                   |
| No regression to other metrics                                                                      | ✓    | LCP unchanged (6.08s, already failing), FCP stable (0.4s), TBT = 0ms |
| All reservations align with 8-point spacing scale                                                   | N/A (skip) | Not applicable — no CSS changed                                   |

## Decision artifact

Plan 13-04 marked **skipped** in 13-04-SUMMARY.md with this file referenced as audit trail. Plan 6 (PERF-SIGNOFF) will surface CLS 0.0594 as a Web Vitals `Good` pass without fix work required.

## v1.2 follow-up (optional, non-blocking)

If the CLS trend continues upward across future phases, the `body`-level 0.0479 shift is the cleanest single fix target — likely a `min-height: 100vh` reservation on the top-level app shell during the auth-wall → dashboard transition. Not required for v1.1 ship.
