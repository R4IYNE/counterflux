---
phase: 07-polish-pass-perf-baseline-schema-migration
plan: 02
subsystem: Perf baseline tooling + v1.0 baseline numbers
tags: [perf, web-vitals, lighthouse, baseline, tooling, v1.0]
requires:
  - web-vitals@5.2.0 (new — runtime reporter library)
  - "@lhci/cli@0.15.1 (new — Lighthouse CI wrapper)"
  - Vite preview server (existing)
provides:
  - bootPerfMetrics() dev-mode console.table reporter (src/services/perf.js)
  - npm run perf script (single Lighthouse desktop run against vite preview)
  - npm run perf:open script (runs lhci then opens report.html on Windows)
  - lighthouserc.cjs config (desktop preset, single run, no assert block per D-20)
  - PERF-BASELINE.md — honest v1.0 median-of-3 numbers + absolute targets (PERF-03)
  - Phase 13 gap log (5 items flagged: CLS=1.00, LCP 3.7s, bulk-data blocking, bfcache off, non-composited animation)
  - Pitfall E mitigation — perf.js lazy-imported via requestIdleCallback so it never regresses the LCP it measures
affects:
  - package.json (web-vitals dep, @lhci/cli devDep, perf + perf:open scripts)
  - package-lock.json (resolved tree)
  - .gitignore (lighthouse-report/ + .lighthouseci/ ignored)
  - src/main.js (idle-time lazy import of services/perf.js, dev-guarded)
tech-stack:
  added:
    - web-vitals 5.2.0 (production dep, tree-shaken out of prod by import.meta.env.DEV guard)
    - "@lhci/cli 0.15.1 (devDependency; wraps Lighthouse 13.0.2 + Chromium 146.0.0.0)"
  patterns:
    - "Dev-only runtime instrumentation: import.meta.env.DEV guard + requestIdleCallback lazy import to avoid Pitfall E (instrumentation regresses what it measures)"
    - "web-vitals v5 per-metric opts identity: each onX(track, {...}) receives a fresh opts literal because web-vitals uses opts object identity as a WeakMap key in initUnique — sharing one reference collides all Manager instances"
    - "Two-artefact baseline pattern (D-22a): committed stable PERF-BASELINE.md (the source of truth) + reproducible `npm run perf` tool (fast dev iteration) — different jobs, both needed"
    - "No CI assertion gate per D-20 — baseline is measurement-first, gating deferred to Phase 13 once we know which metrics we can actually hold"
key-files:
  created:
    - src/services/perf.js
    - lighthouserc.cjs
    - tests/perf-bootstrap.test.js
    - .planning/phases/07-polish-pass-perf-baseline-schema-migration/PERF-BASELINE.md
  modified:
    - src/main.js
    - package.json
    - package-lock.json
    - .gitignore
decisions:
  - Each web-vitals onX call receives its own `{ reportAllChanges: true }` opts literal. web-vitals v5 stores opts in a WeakMap keyed by object identity inside initUnique — sharing one reference between onLCP/onINP/onCLS/onFCP/onTTFB collides their Manager instances and throws `d.T is not a function` on first interaction. Fresh literal per call is mandatory, not stylistic.
  - Baseline captured against `vite preview` (production bundle) in standard Chrome, desktop preset, Performance-only category, single-page-session mode. IndexedDB was NOT wiped between runs — the measured numbers reflect realistic returning-user behaviour, which is what we're going to be optimising in Phase 13.
  - TTI not reported — Lighthouse 13 deprecated TTI in favour of INP + TBT. PERF-BASELINE.md keeps TTI as a target line ("aspirational < 3.5s") for continuity with the plan's requirements but notes that live measurement happens via web-vitals INP.
  - 5 gaps flagged for Phase 13 (PERF-04) rather than fixed in-scope — Plan 02 is baseline-capture only per D-22 ordering (baseline must ship BEFORE Plan 03 schema migration so Phase 13 has a clean v1.0 reference). The gaps are: CLS=1.00 (critical), LCP 3.7s exceeds 2.5s target, bulk-data blocks UI ~5min on cold first visit, bfcache disabled (1 failure reason), 1 non-composited animation flagged.
  - `npm run perf:open` uses Windows `start` command directly rather than cross-platform wrapper — per CLAUDE.md this is a Windows-primary workspace. Future cross-platform contributors can use `npx open-cli` if needed.
metrics:
  duration: 3min (active Claude work; real-time bracket 13+ hours due to human-action + human-verify checkpoints)
  completed: 2026-04-15
---

# Phase 07 Plan 02: Perf Baseline Summary

Installed web-vitals + @lhci/cli, wired a dev-only `console.table` reporter (lazy-loaded via `requestIdleCallback` per Pitfall E), added a `lighthouserc.cjs` + `npm run perf` script for reproducible Lighthouse runs, and captured honest median-of-3 Lighthouse numbers in `PERF-BASELINE.md` against the v1.0 + Plan 1 codebase — flagging 5 gaps for Phase 13. All 4 perf-bootstrap tests green (4/4); full suite stable at pre-plan baseline (same 1 pre-existing router.test.js failure logged in deferred-items.md).

## What Shipped

### Task 1 — Install web-vitals + @lhci/cli, add npm scripts, update .gitignore (PERF-02)
- `web-vitals` 5.2.0 added as production dependency (tree-shaken out of prod builds by the `import.meta.env.DEV` guard).
- `@lhci/cli` 0.15.1 added as devDependency (wraps Lighthouse 13.0.2 + Chromium 146).
- Scripts added: `perf` (`lhci collect --config=lighthouserc.cjs`) and `perf:open` (runs lhci then `start ./lighthouse-report/report.html` on Windows).
- `.gitignore` appended with `lighthouse-report/` (per-run HTML output) and `.lighthouseci/` (@lhci/cli internal cache).
- **Files:** `package.json`, `package-lock.json`, `.gitignore`
- **Commit:** `fed306c`

### Task 2 RED — Failing test for perf bootstrap wiring (PERF-01 TDD)
- `tests/perf-bootstrap.test.js` created with 4 tests: imports audit, `console.table` reporter check, `import.meta.env.DEV` guard check, `requestIdleCallback` lazy-load audit in main.js.
- Tests failed as expected (no perf.js yet, no main.js changes yet).
- **Files:** `tests/perf-bootstrap.test.js`
- **Commit:** `864cff0`

### Task 2 GREEN — Dev-only web-vitals console reporter (PERF-01 + Pitfall E)
- `src/services/perf.js` exports `bootPerfMetrics()` — registers `onLCP` / `onINP` / `onCLS` / `onFCP` / `onTTFB` (NO `onFID` — deprecated in web-vitals 5.x), each wired to a shared `track()` that rounds values, captures rating/delta/id, and `console.table`s the running metrics object on every update.
- `src/main.js` lazy-imports `perf.js` inside `requestIdleCallback` (with `setTimeout(1)` fallback for Safari/Firefox), gated on `import.meta.env.DEV` — production builds skip the import entirely (Pitfall E — instrumentation must never regress the LCP it measures).
- All 4 tests green after this commit.
- **Files:** `src/services/perf.js`, `src/main.js`
- **Commit:** `8f4a4f3`

### Task 3 — Lighthouse CI config (PERF-02)
- `lighthouserc.cjs` at project root — desktop preset, single `numberOfRuns: 1` per D-19, against `vite preview` on http://localhost:4173, writes HTML report to `./lighthouse-report/report.html`. No `assert` block per D-20 (CI gating deferred to Phase 13).
- `startServerReadyPattern: 'Local:.*http://localhost:4173'` + `startServerReadyTimeout: 15000` so lhci waits for Vite to print its ready line.
- **Files:** `lighthouserc.cjs`
- **Commit:** `e256a75`

### Task 4 — PERF-BASELINE.md captured (human-action checkpoint — PERF-03)
- 3 cold-boot Lighthouse runs against `npm run preview`, desktop preset, Performance-only category. Numbers tightly clustered (±5% variance across the set).
- **Headline baseline (median):** FCP 1.0s / LCP 3.7s / TBT 0ms / CLS 1.00 / SI 1.0s / Perf score 54.
- **Targets documented** per D-18 (absolute numbers): LCP < 2.5s, TTI < 3.5s (aspirational; deprecated in LH13), FCP < 1.0s (no-regression), CLS < 0.1, INP < 200ms (measured live via web-vitals).
- **5 gaps explicitly flagged for Phase 13 (PERF-04):**
  1. **CLS = 1.00** (critical, "Poor" rating) — likely splash progress bar + screen swap without reserved dimensions.
  2. **LCP 3.7s > 2.5s** — 32MB total payload, 3.5MB image-delivery savings, 1MB JS minify savings flagged by Lighthouse.
  3. **Bulk-data first-load blocks UI ~5 minutes** on cold visit (splash gates boot on 510MB Scryfall download + IndexedDB populate). Lighthouse terminates before this completes, so the 3.7s LCP is splash-rendering time, not "app ready" time. Phase 13 options: streaming UI, chunked resume, CDN-cached slimmer bulk variant.
  4. **Back/forward cache disabled** (1 failure reason reported). Minor.
  5. **1 non-composited animation** flagged — likely LIVE pulse (POLISH-08) or splash progress bar. Cheap fix (`will-change: transform`).
- **Commit:** `5daa2cc`

### Task 5 — Dev-mode smoke verify + mid-checkpoint correctness fix (human-verify)
- User ran `npm run dev`, opened http://localhost:5173 in Chrome DevTools. After the mid-checkpoint fix landed, console.table renders live rows on every interaction.
- **Measured dev values (all "good"):** LCP 148ms, FCP 100ms, TTFB 7.9ms, CLS 0.01, INP 8ms. Values unsurprisingly better than preview-build Lighthouse because dev has no CLS-causing splash gate and no bulk-data blocking.
- User response: APPROVED.
- **Mid-checkpoint fix — web-vitals v5 opts identity gotcha:** First pass at Task 2 used a single shared opts reference (`const OPTS = { reportAllChanges: true }` then passed to all 5 onX calls). web-vitals v5 stores opts in a WeakMap keyed by **object identity** inside its `initUnique` helper — sharing one reference made onINP/onCLS collide with the already-registered onLCP Manager instance, crashing with `d.T is not a function` on first interaction. Fix: each `onX(track, { reportAllChanges: true })` call now gets its own fresh object literal. See "Lessons Learned" below.
- **Commit:** `452eb2f`

## Library Versions (locked)

| Package | Declared | Resolved | Role |
|---------|----------|----------|------|
| `web-vitals` | `^5.2.0` | `5.2.0` | Production dep — dev-only via DEV guard + requestIdleCallback lazy import |
| `@lhci/cli` | `^0.15.1` | `0.15.1` | Dev dep — wraps Lighthouse 13.0.2, bundles Chromium 146.0.0.0 |

**First-run Chromium cost:** ~150MB downloaded into `~/.cache/lhci/chrome/` on first `npm run perf` invocation. One-time per machine. Surfaced here so future maintainers aren't surprised by the first-run delay.

## Baseline Headline (from PERF-BASELINE.md)

| Metric | Median | Rating |
|--------|--------|--------|
| FCP | 1.0s | Good |
| LCP | 3.7s | **Needs Improvement** (target < 2.5s) |
| TBT | 0ms | Good |
| CLS | 1.00 | **Poor** (target < 0.1) |
| SI | 1.0s | Good |
| Perf score | 54 | Needs Improvement |

Full measurement methodology, per-run numbers, targets, and Phase 13 gap analysis live in `.planning/phases/07-polish-pass-perf-baseline-schema-migration/PERF-BASELINE.md`.

## Lessons Learned

### web-vitals v5 `initUnique` — opts identity is load-bearing

Looks right, crashes live. The v5 library uses the opts object's **identity** (not shape) as a WeakMap key inside `initUnique` to deduplicate per-metric Manager instances. This means:

```js
// WRONG — silently works for LCP, crashes on INP/CLS with "d.T is not a function":
const OPTS = { reportAllChanges: true };
onLCP(track, OPTS);
onINP(track, OPTS); // collision — reuses LCP's Manager
onCLS(track, OPTS); // collision — reuses LCP's Manager
```

```js
// RIGHT — each call gets a fresh object literal:
onLCP(track, { reportAllChanges: true });
onINP(track, { reportAllChanges: true });
onCLS(track, { reportAllChanges: true });
```

Phase 13 (PERF-04) should avoid repeating this when adding more instrumentation. The gotcha is not documented in web-vitals README — it's purely an implementation detail of `initUnique`'s WeakMap caching.

### Baseline ordering (D-22) held

Plan 02 shipped BEFORE Plan 03's schema migration. The `PERF-BASELINE.md` numbers therefore represent pure v1.0 + Plan 1 polish — no migration work, no sync tables, no schema churn. Phase 13 can compare against this knowing the comparison is fair.

## Deviations from Plan

### Auto-fixed / mid-checkpoint

**1. [Rule 1 — Bug] web-vitals v5 opts identity crash**
- **Found during:** Task 5 human-verify (mid-checkpoint)
- **Issue:** Initial Task 2 implementation shared a single `OPTS` object across all 5 `onX` calls. Registered fine for LCP, but onINP/onCLS threw `d.T is not a function` on first real interaction because web-vitals v5's `initUnique` uses opts object identity as a WeakMap key — shared reference = collided Manager instances.
- **Fix:** Each `onX(track, { reportAllChanges: true })` call now receives its own fresh object literal. Added inline comment documenting why the duplication is load-bearing.
- **Files modified:** `src/services/perf.js`
- **Commit:** `452eb2f`

### None of the following required checkpoints or architectural decisions

- Lighthouse 13 TTI deprecation — noted in PERF-BASELINE.md, INP used as live surrogate, no scope change.
- Baseline IndexedDB state — intentionally NOT wiped between runs; the numbers reflect realistic returning-user scenario. Phase 13 can capture a second "pure cold cache" baseline if needed.

## Deferred Issues

- **router.test.js Vandalblast failures** (pre-existing): `TypeError: Cannot read properties of undefined (reading 'data')` at `src/screens/vandalblast.js:17`. Present at pre-Plan-02 baseline; logged in `.planning/phases/07-polish-pass-perf-baseline-schema-migration/deferred-items.md` already (committed with Plan 01). Out of scope per SCOPE BOUNDARY rule.
- **5 Phase 13 gap items** documented in PERF-BASELINE.md — these are the known regressions from targets, not fixes deferred from Plan 02. Phase 13 (PERF-04) is the designated owner.

## Test Counts

| Metric                | Count |
| --------------------- | ----- |
| New test files        | 1     |
| New tests added       | 4     |
| Tests passing (scope) | 4/4   |
| Files modified        | 4     |
| Files created         | 4     |
| Commits (per-task)    | 6 (Task 1, Task 2 RED, Task 2 GREEN, Task 3, Task 4, Task 5 fix) |

## Self-Check

- [x] `src/services/perf.js` exists: FOUND
- [x] `lighthouserc.cjs` exists: FOUND
- [x] `tests/perf-bootstrap.test.js` exists: FOUND
- [x] `PERF-BASELINE.md` exists, no `[x]` placeholders, contains target lines: FOUND (automated gate returned OK)
- [x] Commits `fed306c`, `864cff0`, `8f4a4f3`, `e256a75`, `5daa2cc`, `452eb2f` all present in git log: FOUND
- [x] `npx vitest run tests/perf-bootstrap.test.js` exits 0: PASS (4/4)
- [x] PERF-BASELINE.md automated gate: OK
- [x] D-22 ordering held — Plan 02 shipped before Plan 03 begins: CONFIRMED (Plan 03 not started per orchestrator)

## Self-Check: PASSED
