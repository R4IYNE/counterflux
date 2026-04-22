---
phase: 13-performance-optimisation-conditional
artifact: post-plan-3 re-measurement
source: orchestrator (/gsd:execute-phase 13 — pre-Wave-3 gate)
captured: 2026-04-22
tools:
  - lighthouse: 12.6.1
  - chrome: HeadlessChrome (npx lighthouse --chrome-flags="--headless=new --no-sandbox")
  - preset: desktop
  - runs: 1 (matches 13-REMEASURE.md pragmatic-fallback methodology — user elected single-run at 2026-04-20)
target_url: http://localhost:4173/
preview_branch_commit_at_measurement: 8f23b1b (docs(13-03): complete plan — streaming UI + two inline regression rounds + asset-path fix)
raw_report: .planning/phases/13-performance-optimisation-conditional/post-plan3-lh/run1.json
---

# Counterflux v1.1 — Post-Plan-3 Re-Measurement (PERF-04, Wave 3 entry gate)

**Purpose:** Produce the fresh LCP + CLS numbers Plans 4 and 5 require per their `trigger_condition` frontmatter. Plans 4 and 5 are both explicitly gated on post-Plan-3 measurements; this file supplies that ground truth.

## Methodology

Same pragmatic-fallback methodology as 13-REMEASURE.md (Plan 1): single automated Lighthouse run via `npx lighthouse` against `vite preview` (http://localhost:4173/), Chromium headless, desktop preset, Performance category only. Median-of-3 was skipped at the user's election on 2026-04-20 and that election is preserved here — single-run signal remains sufficient because the LCP gap is still 2.4× the target, well outside any ±5% per-run variance envelope.

**Codebase state at measurement:** Plan 13-01 + 13-02 + 13-03 all shipped (Waves 1 + 2 complete). HEAD at measurement: commit `8f23b1b` (Plan 13-03 finalization).

## Measured Numbers — Post-Plan-3 vs Baseline

| Metric     | Phase 7 Baseline | Plan 1 (pre-Plan-3) | **Post-Plan-3** | Target  | Pass/Fail  |
| ---------- | ---------------- | ------------------- | --------------- | ------- | ---------- |
| FCP        | 1.0s             | 0.4s                | **0.4s**        | < 1.0s  | ✓ pass     |
| LCP        | 3.7s             | 6.1s                | **6.08s**       | < 2.5s  | ✗ **fail** (essentially unchanged by Plan 3) |
| CLS        | 1.00             | 0.023               | **0.0594**      | < 0.1   | ✓ pass (worsened but still under) |
| TBT        | 0ms              | 0ms                 | **0ms**         | —       | —          |
| SI         | 1.0s             | 0.4s                | **0.4s**        | —       | —          |
| Perf score | 54               | 76                  | **76**          | —       | —          |

## LCP Element + Phase Breakdown

**LCP element:** `body > div#cf-auth-wall > h1` ("COUNTERFLUX", Syne 48px/700) — same element as Plan 1 re-measurement.

| Phase          | Timing      | % of LCP |
| -------------- | ----------- | -------- |
| TTFB           | 121.3ms     | 2%       |
| Load Delay     | 0ms         | 0%       |
| Load Time      | 0ms         | 0%       |
| **Render Delay** | **5,962.5ms** | **98%**  |

**Interpretation:** 98% of LCP is Render Delay — the browser has the auth-wall `<h1>` element in the DOM within 121ms (TTFB) but can't paint it for another ~6 seconds. Network is not the bottleneck (Load Time = 0ms). **Font-blocking is the confirmed root cause** — the h1 uses `font-family: Syne, sans-serif; font-weight: 700;` and the browser is waiting for the Syne font file before it paints. This matches Plan 1 REMEASURE.md's prediction: "LCP element is font-blocked (Syne)".

## Top Layout Shifts (CLS 0.0594)

| # | Score     | Selector                                                      | Likely cause                                                  |
|---|----------:|---------------------------------------------------------------|---------------------------------------------------------------|
| 1 | 0.04794   | `body`                                                        | Body-level layout change — likely auth-wall / topbar transition after Plan 3's splash removal |
| 2 | 0.009501  | `body > div > header.fixed`                                   | Topbar bulk-data pill mount (Plan 3 Task 2)                   |
| 3 | 0.00133   | `body > div > header.fixed`                                   | Header reflow                                                 |
| 4 | 0.000661  | `body > div.fixed > div.flex > h1.syne-header`                | Syne font-swap shift (consistent with font-blocking LCP)      |
| 5 | 0.000263  | `body > div > header.fixed`                                   | Header reflow                                                 |

**Delta vs Plan 1:** CLS increased from 0.023 → 0.0594 (2.6×), primarily from the new `body`-level shift. Still well under the 0.1 target, so Plan 4 does not trigger. The increase is likely traceable to Plan 3's splash removal changing the body render sequence; the topbar pill mount contributes ~0.011 cumulative.

## Wave 3 Gate Decisions (per plan `trigger_condition`)

### Plan 13-04 (CLS targeted fixes) — NOT TRIGGERED

**`trigger_condition`:** `Plan 1 verdict = Branch B AND CLS > 0.1 AFTER Plan 3 streaming-UI lands`

**Evaluation:** Branch B ✓, but post-Plan-3 CLS = **0.0594 < 0.1**. Second half of the AND is false → plan does not execute.

**Decision:** Mark Plan 13-04 `skipped — CLS already under target at post-Plan-3 re-measurement`. Record this decision in `13-04-SUMMARY.md` and produce a stub `13-CLS-DELTA.md` documenting the skip + the five shift sources above (for the audit trail Plan 6 PERF-SIGNOFF will consume).

### Plan 13-05 (bundle split + font-display:swap) — TRIGGERED

**`trigger_condition`:** `Plan 1 verdict = Branch B AND LCP still > 2.5s AFTER Plan 3 streaming-UI has landed`

**Evaluation:** Branch B ✓, post-Plan-3 LCP = **6.08s > 2.5s** → plan executes.

**Sharpened focus from 98% Render Delay finding:** The biggest single win is almost certainly `font-display: swap` on the Syne `@font-face` declaration (and/or a `<link rel="preload" as="font" crossorigin>` for the Syne 48px weight). Bundle-splitting mana-font / keyrune / Chart.js is secondary because Load Time is already 0ms — the critical-path CSS is already fast; it's the font file that's blocking render.

The plan ships both — font-display swap addresses the LCP root cause, bundle-split addresses the regression-prevention size budgets. Plan 5 executor should prioritise font-display swap as Task 1 (largest LCP win) and budget enforcement as later tasks.

## Branch Re-Affirmation

Per D-02, Phase 13 takes exactly ONE branch. The original Plan 1 verdict of Branch B stands:

- [x] Branch B — Gap identified (LCP missed: 6.08s vs target 2.5s)
  - Plan 2 shipped (see 13-02-SUMMARY.md) — bfcache both states pass, composability locked
  - Plan 3 shipped (see 13-03-SUMMARY.md) — splash removed, streaming UI, honest empty-states
  - **Plan 4 SKIPPED** — CLS already under target per above
  - **Plan 5 TRIGGERED** — LCP gap remains; font-blocking root cause identified
  - Plan 6 ships as closer, writes final 13-PERF-SIGNOFF.md

## Re-measurement cadence

Plan 5 must re-measure after its implementation lands (checkpoint:human-verify Task to capture post-Plan-5 Lighthouse). If post-Plan-5 LCP < 2.5s → PERF-04 satisfied. If still > 2.5s → document gap, recommend v1.2 or acknowledge a pragmatic miss (all other Web Vitals already pass).
