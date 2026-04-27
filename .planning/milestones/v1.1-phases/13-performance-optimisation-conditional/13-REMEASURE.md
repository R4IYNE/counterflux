# Counterflux v1.1 — Performance Re-Measurement (PERF-04)

**Captured:** 2026-04-20 (Phase 13 Plan 1, against final v1.1 build post-Phase-12)

**Methodology — pragmatic fallback (NOT median-of-3 per Phase 7 D-22a):**
Single automated Lighthouse run via the `lighthouse` CLI against `vite preview` (http://localhost:4173/), Chromium headless (HeadlessChrome/147.0.0.0), desktop preset, Performance category only. The Phase 7 median-of-3 DevTools protocol was skipped at the user's election (2026-04-20) to avoid the manual-click overhead; a single-run signal is sufficient to establish the v1.1 Branch A / Branch B verdict because Phase 7's baseline recorded ±5% per-run variance and the measured LCP gap here is 2.4× the target, well outside any reasonable variance envelope.

**Codebase state:** v1.1 final build post-Phase-12 at commit `314f0963cc5791ec9ca03a8770c127f90cf91d95` (short: `314f096`).

## Version Capture (Pitfall 1 — Lighthouse version drift)

| Tool       | Phase 7 Baseline (2026-04-15) | Phase 13 Re-Measurement (2026-04-20) | Drift?  |
| ---------- | ----------------------------- | ------------------------------------- | ------- |
| Lighthouse | 13.0.2                        | 12.6.1                                | **MAJOR (version down)** |
| @lhci/cli  | 0.15.1                        | 0.15.1                                | SAME    |
| Chrome     | 146.0.0.0 (DevTools GUI)      | 147.0.0.0 HeadlessChrome              | MINOR   |

**Drift impact:** The pinned `@lhci/cli@0.15.1` transitively resolves Lighthouse 12.6.1 locally on this machine (not 13.0.2 as used at Phase 7 baseline capture). Lighthouse 12 vs 13 have different audit sets and CLS scoring tweaks. Numbers below are labelled `cross-version` in the Delta column. The headless vs DevTools GUI environment drift adds a second axis of incomparability, but the LCP gap (2.4× target) is far outside any version-delta envelope — the Branch B verdict stands regardless.

## Measured Numbers (single Lighthouse run — see Methodology)

| Metric     | Measured | Phase 7 Baseline | Delta                     | Target  | Pass/Fail |
| ---------- | -------- | ---------------- | ------------------------- | ------- | --------- |
| FCP        | 0.4s     | 1.0s             | −0.6s (cross-version)      | < 1.0s  | ✓ pass    |
| LCP        | 6.1s     | 3.7s             | +2.4s worse (cross-version) | < 2.5s  | ✗ **fail** |
| CLS        | 0.023    | 1.00             | −0.977 (cross-version)     | < 0.1   | ✓ pass    |
| TBT        | 0ms      | 0ms              | 0                         | —       | —         |
| SI         | 0.4s     | 1.0s             | −0.6s (cross-version)      | —       | —         |
| Perf score | 76       | 54               | +22 (cross-version)        | —       | —         |
| INP        | not captured in lab (Lighthouse 12/13 emits INP only as a field metric) | — | — | < 200ms | n/a — field-only |

## Lighthouse Insights Captured

- [x] "IndexedDB pre-populated" warning: **n/a** (headless Chromium starts with clean storage each run — warning suppressed by the fresh environment)
- [x] Non-composited animations: **1 found** — flagged selector `div.fixed > div.flex > div.w-full > div.h-full` (the splash progress bar, animating `width` — exactly as Phase 7 predicted; Plan 3 D-04 deletes this element entirely, so Plan 2's animation fix is likely a no-op on this specific selector)
- [x] bfcache failure reasons: **1 failure** — reason: `"The page was evicted from the cache because an active network connection received too much data. Chrome limits the amount of data that a page may receive while cached."` type `Not actionable`. **IMPORTANT DEVIATION FROM RESEARCH:** this is NOT the Dexie IndexedDB blocker that Plan 2 research predicted. The root cause is the 510MB Scryfall bulk-data download still in flight when the page goes into bfcache. This reframes the bfcache fix: not `db.close()` on `pagehide`, but `abortBulkDataFetch()` on `pagehide` (see Gap summary below).
- [x] Top layout shifts (CLS total 0.023 — already under target, but listed for Plan 3 impact awareness): `body > div.fixed > div.flex` (splash container, 0.023) + two negligible children (0.000659, 0.000014). All three live inside the splash overlay which Plan 3 D-04 removes, so post-Plan-3 CLS should still be ≤ 0.023 (likely improves further).
- [x] LCP element: **`body > div#cf-auth-wall > h1`** ("COUNTERFLUX" — Syne 48px/700). The Phase 10 auth-wall is now the LCP element. Its 6.1s render time is almost certainly gated on the Syne font load (the h1 is the first Syne-using element on the page, and the Syne bundle ships as a regular CSS-imported font). This identifies the Plan 3 + Plan 5 attack surface.

## Branch decision

Per D-02, Phase 13 takes exactly ONE branch:

- [ ] **Branch A — All targets met** (LCP < 2.5s AND CLS < 0.1 AND FCP < 1.0s AND INP < 200ms)
- [x] **Branch B — Gap identified** (LCP missed: 6.1s vs target 2.5s)
  - Plan 2 (freebies D-08 + D-09) activates per D-03 — **but with a revised bfcache scope** (see Gap summary)
  - Plan 3 (streaming UI D-04/05/06) activates — LCP > 2.5s, and the LCP element identity points at auth-wall / font-load, which Plan 3's boot-order changes may help
  - Plan 4 (CLS targeted fixes) **NOT triggered** — CLS is already 0.023 (< 0.1 target). Mark Plan 4 as `skipped — CLS already under target at re-measurement`.
  - Plan 5 (bundle splitting D-10) activates IF LCP still > 2.5s after Plan 3 — strong likelihood given LCP element is font-blocked (Syne)
  - Plan 6 (soft-gate) ships as closer, writes final 13-PERF-SIGNOFF.md

**Gap summary (Branch B):**

| Target      | Measured | Gap    | Triggers                                                                                                                                                                  |
| ----------- | -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LCP < 2.5s  | 6.1s     | +3.6s  | **Plan 3** (streaming UI may decouple LCP from bulk-data network contention) + **Plan 5** likely (Syne font-blocking is the probable root cause; bundle split / font-display: swap) |
| CLS < 0.1   | 0.023    | —      | Plan 4 NOT triggered — already under target                                                                                                                                |
| FCP < 1.0s  | 0.4s     | —      | Already under target                                                                                                                                                       |
| INP < 200ms | not measured | n/a | Lighthouse lab-run doesn't emit INP; defer to field / dev samples if Plan 3 ships and users report interaction lag                                                       |

**Plan 2 revised scope (bfcache fix):**
Research predicted the bfcache blocker was the Dexie IndexedDB connection — standard fix pattern via `db.close()` on `pagehide`. The actual Lighthouse 12.6.1 insight reports a DIFFERENT root cause: the in-flight Scryfall bulk-data download is what's disqualifying bfcache (Chrome limits data received while cached). Plan 2 must pivot — the fix is aborting / pausing the bulk-data fetch on `pagehide` and resuming on `pageshow`, NOT closing the Dexie connection. Update Plan 2 scope during execution to reflect this finding; reconsider whether `db.close()` on `pagehide` is even needed.

## Reproducibility

- **Reproduce this single-run result:** `npm run preview` (separate terminal) + `npx lighthouse http://localhost:4173/ --preset=desktop --only-categories=performance --output=json --output-path=./lighthouse-report/report.json --quiet --chrome-flags="--headless=new --no-sandbox --disable-gpu"`
- **Reproduce the Phase 7 baseline methodology:** 3 manual runs through DevTools Lighthouse panel, desktop + Performance-only, median across the set (frozen per D-14)
- **Commit sha at measurement:** `314f0963cc5791ec9ca03a8770c127f90cf91d95`
- **@lhci/cli version at measurement:** 0.15.1 (transitively resolved Lighthouse 12.6.1)
- **JSON report artefact:** `./lighthouse-report/report.json` (gitignored; re-run the command above to regenerate)

**Known Windows gotcha:** The `npm run perf` path (via `lhci collect`) crashes during Chrome teardown on Windows with `EPERM: rmSync` of the Chrome Launcher temp dir — but the audit completes and the JSON is written before the crash. The direct `npx lighthouse ...` invocation above has the same teardown noise but reliably writes the JSON output first.

## Cross-References

- [Phase 7 PERF-BASELINE.md](../07-polish-pass-perf-baseline-schema-migration/PERF-BASELINE.md) — frozen baseline, do not mutate per D-14
- [13-CONTEXT.md](./13-CONTEXT.md) — decision log D-01..D-14
- [13-RESEARCH.md](./13-RESEARCH.md) §Pattern 1 + §Pitfall 1
