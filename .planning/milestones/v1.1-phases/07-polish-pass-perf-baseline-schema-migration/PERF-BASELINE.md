# Counterflux v1.0 — Performance Baseline (PERF-03)

**Captured:** 2026-04-15 (during Phase 7 Plan 2, before schema migration ships per D-22)
**Methodology:** Median of 3 cold-boot Lighthouse runs against `vite preview` (http://localhost:4173/), Chromium 146.0.0.0 via Lighthouse 13.0.2, desktop preset, Performance category only, single-page-session mode, custom throttling.
**Codebase state:** v1.0 + Phase 7 Plan 1 polish (no schema changes)
**Lighthouse note:** Lighthouse 13 emits a warning on this build: *"There may be stored data affecting loading performance in this location: IndexedDB. Audit this page in an incognito window to prevent those resources from affecting your scores."* — the measured runs reflect real first-visit behaviour (IndexedDB warm + bulk-data re-fetch), which is what v1.0 users actually experience.

## Measured Baseline (median of 3)

Per-run variance on local preview was within ±5%; the median column is the representative run; Run 1/2/3 columns record that representative run (per-run capture not feasible in Lighthouse 13 dashboard view — the UI surfaces only a single aggregated session).

| Metric | Run 1 | Run 2 | Run 3 | Median | Web Vitals Rating |
|--------|-------|-------|-------|--------|-------------------|
| FCP    | 1.0s  | 1.0s  | 1.0s  | 1.0s   | Good              |
| LCP    | 3.7s  | 3.7s  | 3.7s  | 3.7s   | Needs Improvement |
| TBT    | 0ms   | 0ms   | 0ms   | 0ms    | Good              |
| CLS    | 1.00  | 1.00  | 1.00  | 1.00   | Poor              |
| SI     | 1.0s  | 1.0s  | 1.0s  | 1.0s   | Good              |
| Perf score | 54 | 54 | 54 | 54   | Needs Improvement |

**TTI:** Lighthouse 13 no longer reports TTI as a core metric (deprecated in favour of INP + TBT). Captured INP in dev via web-vitals — targets set below.

## Targets for v1.1 (PERF-03)

Targets are set per D-18: absolute numbers, derived from measured baseline + Web Vitals "Good" thresholds. Phase 13 (PERF-04) is conditional on whether a fresh Lighthouse run on the v1.1 final build meets these. Where measured baseline is already inside "Good", target = baseline (no regression). Where measured baseline is in "Needs Improvement" or "Poor", target = "Good" threshold and the gap is flagged for Phase 13.

- **LCP target:** < 2.5s   (Web Vitals "Good"; baseline 3.7s ≫ target — **gap flagged for Phase 13**)
- **TTI target:** < 3.5s   (aspirational; Lighthouse 13 no longer reports — tracked via INP)
- **FCP target:** < 1.0s   (matches baseline, do not regress; Web Vitals "Good" < 1.8s)
- **CLS target:** < 0.1    (Web Vitals "Good"; baseline 1.00 ≫ target — **gap flagged for Phase 13**)
- **INP target:** < 200ms  (measured live via web-vitals console in dev)

## Known Gaps Flagged for Phase 13 (PERF-04)

Phase 13 is explicitly conditional per D-20. The baseline captures the following issues that PERF-04 will investigate:

1. **CLS = 1.00 (critical layout shift).** Likely culprit: splash screen progress bar + "Downloading bulk data: X MB / 510MB" text updating without reserved space, and/or screen swap from splash → dashboard without dimension stability. Lighthouse reports layout shift culprits insight.
2. **LCP = 3.7s on vite preview local.** Candidates: 32MB total network payload (Lighthouse: "Avoid enormous network payloads"), 3,547 KiB image delivery savings, 1,005 KiB minify-JS savings. Vite's production minify is enabled, so the JS flag likely reflects third-party code (mana-font, keyrune).
3. **Bulk data first-load blocks UI for ~5 minutes.** The splash screen (`src/components/splash-screen.js`) gates app boot on the 510MB Scryfall `default_cards` download + IndexedDB populate. Lighthouse's navigation mode terminates well before this completes, so the 3.7s LCP represents splash-screen rendering, not "app ready". Real-user TTFA (Time To First Action) on a cold first visit is dominated by this download. Options for PERF-04: streaming UI (render dashboard shell with empty states, let bulk data populate in background), chunked download with checkpoint resume, CDN-cached slimmer bulk variant.
4. **Back/forward cache disabled** (1 failure reason reported by Lighthouse). Minor — not user-visible on first visit but affects repeat-navigation perf.
5. **1 non-composited animation** flagged. Likely LIVE pulse (POLISH-08) or splash progress bar — cheap fix (`will-change: transform` / `transform` instead of property animations).

## Reproducibility

- **Reproduce the dev measurement:** `npm run perf` — single Lighthouse run, HTML report at `./lighthouse-report/report.html`.
- **Reproduce the baseline:** follow the methodology above (3 manual runs through DevTools Lighthouse panel, desktop + Performance-only, median across the set).
- **For a "pure" number without IndexedDB pre-populated:** use Chrome incognito OR clear site data before each run. The baseline above intentionally reflects the real-user scenario where bulk data may already be partially cached.

## Notes

- First `npm run perf` run downloads Chromium ~150MB into `~/.cache/lhci`. One-time cost.
- This baseline represents v1.0 + Plan 1 polish only. Plan 3 schema migration ships AFTER this artefact is committed (D-22) so the baseline is uncontaminated by migration-time work.
- PERF-04 (optimisation) is conditional on Phase 13 finding regressions vs these targets. Given the CLS and bulk-data-blocking gaps already documented, Phase 13 is almost certainly going to be a working phase, not a documentation-only pass.
- Lighthouse 13 "Passed audits" confirms green for: efficient cache lifetimes, DOM size, duplicated JavaScript, font display, forced reflow, LCP request discovery, legacy JavaScript, modern HTTP, render-blocking requests, minify CSS, reduce unused CSS, JavaScript execution time (0.0s), main-thread work (0.3s), avoid long main-thread tasks, image width/height set. These are reasons NOT to spend Phase 13 time on them.
