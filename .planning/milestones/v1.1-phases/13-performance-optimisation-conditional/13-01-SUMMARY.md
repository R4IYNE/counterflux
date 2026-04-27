---
phase: 13
plan: 01
status: complete
branch: B
completed: 2026-04-20
---

# Plan 13-01 — Re-measurement

**Verdict:** Branch B (LCP gap). Plans 2, 3, 5 activate; Plan 4 skipped (CLS already under target); Plan 6 closes.

## Measured (v1.1 final build, commit `314f096`)

| Metric | v1.0 baseline | v1.1 measured | Target | Status |
|--------|---------------|---------------|--------|--------|
| FCP    | 1.0s          | 0.4s          | < 1.0s | ✓ pass |
| LCP    | 3.7s          | **6.1s**      | < 2.5s | ✗ fail |
| CLS    | 1.00          | **0.023**     | < 0.1  | ✓ pass |
| Perf   | 54            | 76            | —      | +22    |

## Methodology — user-elected fallback

Single automated Lighthouse run via `npx lighthouse` CLI, headless Chromium, desktop preset. Phase 7's median-of-3 DevTools protocol skipped at user request (2026-04-20) to avoid manual-click overhead. LCP gap (2.4× target) exceeds any reasonable variance envelope, so Branch verdict is robust to the simplification.

**Drift labels:**
- Lighthouse 12.6.1 (vs Phase 7's 13.0.2) — MAJOR
- Headless Chromium 147 (vs Phase 7's DevTools GUI Chrome 146) — MINOR
- Single run (vs median-of-3) — methodology

All three are documented in 13-REMEASURE.md `cross-version` labels.

## Key findings

### LCP root cause identified
**LCP element:** `body > div#cf-auth-wall > h1` ("COUNTERFLUX" — Syne 48px/700). The Phase 10 auth-wall is now the LCP element. Its 6.1s render time is almost certainly **Syne font-load-blocked**. Attack surface: Plan 3 (streaming UI / boot-order) + Plan 5 (bundle split / `font-display: swap`).

### CLS self-healed
CLS dropped from 1.00 (Poor) to 0.023 (Good) without any explicit fix. Top contributor is `body > div.fixed > div.flex` (splash container, score 0.023) — which Plan 3 D-04 removes entirely. Post-Plan-3 CLS should stay ≤ 0.023, likely better. **Plan 4 not triggered.**

### Non-composited animation confirmed
`div.fixed > div.flex > div.w-full > div.h-full` animating `width` — the splash progress bar. Plan 3 D-04 deletes this element, so Plan 2's D-08 fix on THIS selector is likely a no-op. Plan 2 audit will check whether any OTHER animation surfaces once the splash is gone.

### bfcache blocker reframed (research deviation)
Research predicted the blocker was the Dexie IndexedDB connection; actual Lighthouse insight reports the in-flight Scryfall bulk-data fetch ("active network connection received too much data"). **Plan 2 must pivot:** abort/pause bulk-data fetch on `pagehide`, resume on `pageshow` — NOT `db.close()`. Reconsider whether any Dexie close is needed.

## Files

**Created:**
- `tests/perf/remeasure-contract.test.js` — static-grep contract guard on 13-REMEASURE.md structure (9/9 pass)
- `.planning/phases/13-performance-optimisation-conditional/13-REMEASURE.md` — single-run numbers + Branch B verdict + Lighthouse insights
- `.planning/phases/13-performance-optimisation-conditional/13-PERF-SIGNOFF.md` — Branch B stub (Plan 6 Task 6b finalises)

**Commits (this plan):**
- `314f096` — test(13-01): Wave 0 — remeasure-contract test stub
- `c3ed6da` — feat(13-01): Task 2 — re-measurement (Branch B)
- `0da942c` — docs(13-01): Task 3 — Branch B signoff stub

**Invariants preserved:**
- `PERF-BASELINE.md` untouched (D-14 ✓ — `git diff .planning/phases/07-.../PERF-BASELINE.md` empty)
- Zero diffs under `src/` (Pitfall 3/11 ✓ — no parallel web-vitals instrumentation added)

## Next

Activate Plans 2 + 3 (Wave 2). Plan 5 gated on post-Plan-3 re-measurement. Plan 4 skipped. Plan 6 closes Wave 4.

- `/gsd:execute-phase 13 --wave 2` — freebies + streaming UI
- Or per-plan: `/gsd:execute-plan 13-02` / `/gsd:execute-plan 13-03`
