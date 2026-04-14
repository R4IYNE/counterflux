---
phase: 7
slug: polish-pass-perf-baseline-schema-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `07-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 + fake-indexeddb 6.2.5 |
| **Config file** | `vitest.config.js` (root) + `tests/setup.js` imports `fake-indexeddb/auto` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` (same — no split) |
| **Estimated runtime** | ~5-15s (migration tests add ~2s) |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test` (same — suite is fast)
- **Before `/gsd:verify-work`:** `npm test` green AND `npm run perf` produces report AND manual QA checklist signed off
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| POLISH-01 | Splash quote + attribution typography | component | `npx vitest run tests/splash-screen.test.js` | ❌ W0 |
| POLISH-02 | Red accents across D-30…D-33 surfaces | manual visual QA | — | manual |
| POLISH-03 | Favicon link present + file reachable | integration | `npx vitest run tests/favicon.test.js` | ❌ W0 |
| POLISH-04 | Card image rounded corners, no triangles | manual visual QA | — | manual |
| POLISH-05 | Toast icons render at full opacity | component | `npx vitest run tests/toast.test.js` | ✓ (extend) |
| POLISH-06 | Ritual modal "Brew a new storm" / "Abandon storm" | component | `npx vitest run tests/ritual-modal.test.js` | ❌ W0 |
| POLISH-07 | Counter-panel trigger uses `add` glyph | component | `npx vitest run tests/counter-panel.test.js` | ❌ W0 |
| POLISH-08 | LIVE chip has pulsing dot element | component | `npx vitest run tests/connectivity-status.test.js` | ✓ (extend) |
| POLISH-09 | Sidebar collapse toggle persists to localStorage | integration | `npx vitest run tests/sidebar-collapse.test.js` | ❌ W0 |
| POLISH-10 | Top losers panel never shows raw `scryfall_id` | component | `npx vitest run tests/movers-panel.test.js` | ❌ W0 |
| POLISH-11 | All wishlist add paths show "Added to wishlist" | integration | `npx vitest run tests/add-card-modal.test.js` | ❌ W0 |
| PERF-01 | web-vitals logs console.table in dev; no overlay | smoke | `npm run dev` → DevTools → confirm output | manual |
| PERF-02 | `npm run perf` produces `./lighthouse-report/report.html` | smoke | `npm run perf && test -f ./lighthouse-report/report.html` | ❌ W0 (shell) |
| PERF-03 | Baseline report committed with concrete TTI/LCP targets | artefact review | `grep -E 'TTI:\|LCP:' .planning/phases/07-*/PERF-BASELINE.md` | ❌ W0 |
| SCHEMA-01 | v5→v6→v7 adds fields + tables + correct indexes | integration | `npx vitest run tests/migration-v5-to-v7.test.js` | ❌ W0 |
| SCHEMA-02 | Migration preserves rows & FK integrity across v1-v5 fixtures | integration | `npx vitest run tests/migration-v5-to-v7.test.js` (full suite) | ❌ W0 |
| SCHEMA-03 | Pre-migration backup writes + round-trip validates + sweeps old backups | integration | `npx vitest run tests/migration-backup.test.js` | ❌ W0 |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

**Test files to create:**
- [ ] `tests/migration-v5-to-v7.test.js` — covers SCHEMA-01, SCHEMA-02 (largest gap; high-risk)
- [ ] `tests/migration-backup.test.js` — covers SCHEMA-03 (round-trip validation per D-17b)
- [ ] `tests/fixtures/v5-snapshots.js` — shared fixture generators for v5-shape data (empty / 500-card collection / 10 decks with deck_cards / active game with turn history)
- [ ] `tests/splash-screen.test.js` — covers POLISH-01 + D-17a progress-event rendering
- [ ] `tests/favicon.test.js` — asserts `<link rel="icon">` present in built `index.html`
- [ ] `tests/ritual-modal.test.js` — covers POLISH-06
- [ ] `tests/counter-panel.test.js` — covers POLISH-07
- [ ] `tests/sidebar-collapse.test.js` — covers POLISH-09 (toggle + localStorage persistence)
- [ ] `tests/movers-panel.test.js` — covers POLISH-10 (fallback rendering for missing names)
- [ ] `tests/add-card-modal.test.js` — covers POLISH-11 (extend existing coverage or create)

**Existing tests to extend:**
- [ ] `tests/toast.test.js` — add POLISH-05 opacity assertion
- [ ] `tests/connectivity-status.test.js` — add POLISH-08 pulsing-dot element presence

**Framework install:** None — Vitest + fake-indexeddb already present.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Red coverage at ~15% of surfaces | POLISH-02 | Subjective visual judgment; no practical automated assertion | Boot app → walk through every screen → audit that card hover, destructive CTAs, RAG-red states, active tab + bell all render red per D-30…D-33 |
| Card image rounded corners, no white triangles | POLISH-04 | Visual absence check; screenshot diff is overkill | Open card detail flyout on a card with a Scryfall border → confirm corners rounded, no `#14161C` surface visible through triangular gaps |
| web-vitals console.table output live in dev | PERF-01 | Requires DevTools open, human-in-loop | `npm run dev` → open DevTools console → navigate between screens → confirm `console.table` rows for LCP/INP/CLS/FCP/TTFB appear |
| Baseline report numbers committed | PERF-03 | Human medians-of-3 runs; Lighthouse variance makes this non-deterministic | Run Lighthouse against `vite preview` 3 times → take median → commit to `.planning/phases/07-.../PERF-BASELINE.md` with TTI + LCP targets |
| Favicon visible in browser tab | POLISH-03 | Browser rendering check | Load app in Chrome/Firefox → confirm `niv-mila.png` renders in tab |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies declared
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (10 new test files + 2 extensions)
- [ ] No watch-mode flags in automated commands (all use `vitest run`)
- [ ] Feedback latency < 15s (`npm test` runs entire suite)
- [ ] `nyquist_compliant: true` set in frontmatter after Wave 0 complete

**Approval:** pending
