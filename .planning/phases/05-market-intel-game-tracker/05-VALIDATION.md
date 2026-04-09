---
phase: 5
slug: market-intel-game-tracker
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (latest, via `vitest/config`) |
| **Config file** | `vitest.config.js` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | MRKT-03 | unit | `npx vitest run tests/market-store.test.js -t "watchlist"` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | MRKT-04 | unit | `npx vitest run tests/price-alerts.test.js` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | MRKT-05 | unit | `npx vitest run tests/price-history.test.js -t "movers"` | ❌ W0 | ⬜ pending |
| 05-01-04 | 01 | 1 | MRKT-06 | unit | `npx vitest run tests/sets-service.test.js` | ❌ W0 | ⬜ pending |
| 05-01-05 | 01 | 1 | MRKT-01 | unit | `npx vitest run tests/spoiler-filter.test.js` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | GAME-01 | unit | `npx vitest run tests/game-store.test.js -t "setup"` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 1 | GAME-02 | unit | `npx vitest run tests/life-adjuster.test.js` | ❌ W0 | ⬜ pending |
| 05-02-03 | 02 | 1 | GAME-03 | unit | `npx vitest run tests/game-store.test.js -t "commander damage"` | ❌ W0 | ⬜ pending |
| 05-02-04 | 02 | 1 | GAME-04 | unit | `npx vitest run tests/game-store.test.js -t "poison"` | ❌ W0 | ⬜ pending |
| 05-02-05 | 02 | 1 | GAME-05 | unit | `npx vitest run tests/game-store.test.js -t "tax"` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 2 | GAME-12 | unit | `npx vitest run tests/game-stats.test.js` | ❌ W0 | ⬜ pending |
| 05-M-01 | - | - | PERF-03 | manual-only | Verify in DevTools offline mode | N/A | ⬜ pending |
| 05-M-02 | - | - | GAME-10 | manual-only | Visual verification | N/A | ⬜ pending |
| 05-M-03 | - | - | GAME-13 | manual-only | Browser responsive mode | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/market-store.test.js` — stubs for MRKT-03, MRKT-04 (watchlist CRUD, alert thresholds)
- [ ] `tests/price-history.test.js` — stubs for MRKT-05 (market movers, snapshot/prune logic)
- [ ] `tests/price-alerts.test.js` — stubs for MRKT-04 (alert threshold checking)
- [ ] `tests/spoiler-filter.test.js` — stubs for MRKT-01 (spoiler gallery filtering)
- [ ] `tests/sets-service.test.js` — stubs for MRKT-06 (sets data caching)
- [ ] `tests/game-store.test.js` — stubs for GAME-01, GAME-03, GAME-04, GAME-05 (setup, cmdr damage, poison, tax)
- [ ] `tests/life-adjuster.test.js` — stubs for GAME-02 (long-press increment logic)
- [ ] `tests/game-stats.test.js` — stubs for GAME-12 (game history stats)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Offline game functionality | PERF-03 | Requires browser DevTools network throttle | Open game, go offline in DevTools, verify all features work |
| Life chart rendering | GAME-10 | Visual verification of Chart.js output | Complete a game, check line chart renders with correct player colours |
| Mobile responsive layout | GAME-13 | Visual verification at multiple breakpoints | Test at 375px, 768px, 1024px widths — player cards stack correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
