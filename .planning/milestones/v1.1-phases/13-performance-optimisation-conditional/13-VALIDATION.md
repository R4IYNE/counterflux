---
phase: 13
slug: performance-optimisation-conditional
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-20
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated from 13-RESEARCH.md §Validation Architecture — planner refines as plans materialise.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x (unit/integration) + @lhci/cli 0.15.1 (Lighthouse) + manual DevTools (bfcache, runtime audits) |
| **Config file** | `vitest.config.js` (existing); `lighthouserc.cjs` (existing from Phase 7 Plan 2) |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run && npm run perf` |
| **Estimated runtime** | ~90 seconds (Vitest ~60s + single Lighthouse run ~30s) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run` (filtered to the files that changed where possible)
- **After every plan wave:** Run `npm test -- --run` full suite
- **Before `/gsd:verify-work`:** Full suite + one fresh `npm run perf` run (for any plan that ships code)
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

*Planner fills this table as plans are authored. Placeholders below reflect the plan shape anticipated by research (13-01..13-06 + signoff).*

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-* | 01 re-measurement | 1 | PERF-04 | manual Lighthouse + grep-assert on committed artefact | `test -f .planning/phases/13-.../13-REMEASURE.md && grep -q "LCP" .planning/phases/13-.../13-REMEASURE.md` | ❌ W0 | ⬜ pending |
| 13-02-* | 02 freebies (D-08 + D-09) | 2 | PERF-04 | grep-assert + manual DevTools bfcache check | `grep -q "will-change" src/styles/main.css && grep -q "pagehide" src/main.js` | ❌ W0 | ⬜ pending |
| 13-03-* | 03 streaming UI (D-04..D-06) | 2 | PERF-04 | Vitest unit + integration on boot order | `npm test -- --run src/main.test.js src/components/topbar.test.js src/components/splash-screen.test.js` | ❌ W0 | ⬜ pending |
| 13-04-* | 04 CLS targeted fixes | 3 | PERF-04 | manual Lighthouse re-run + commit delta | `npm run perf && grep -q "CLS.*0\\.[01]" .planning/phases/13-.../13-CLS-DELTA.md` | ❌ W0 | ⬜ pending |
| 13-05-* | 05 bundle splitting (conditional) | 3 | PERF-04 | Vitest + build-output size-gate | `npm run build && node scripts/assert-bundle-budget.js` | ❌ W0 | ⬜ pending |
| 13-06-* | 06 soft-gate @lhci/cli | 4 | PERF-04 | grep-assert on lighthouserc.cjs | `grep -q "minScore.*warn\\|level.*warn" lighthouserc.cjs` | ✅ | ⬜ pending |
| 13-signoff | signoff | 4 | PERF-04 | grep-assert on PERF-SIGNOFF.md | `grep -q "v1.1 meets perf budget" .planning/phases/13-.../13-PERF-SIGNOFF.md` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Conditional-plan verification note:** Plans 03, 04, 05 only materialise if Plan 1 re-measurement shows the relevant target missed. If they don't ship, their rows in this table are replaced with `— not triggered —` entries in 13-PERF-SIGNOFF.md and removed from the final Nyquist count.

---

## Wave 0 Requirements

Test infrastructure Plan 1 and conditional Plans 3-5 need:

- [ ] `tests/perf/remeasure-contract.test.js` — stubs asserting Plan 1's PERF-REMEASURE.md artefact contains required fields (median, min, max, Lighthouse version, methodology echo)
- [ ] `tests/main-boot-order.test.js` — stubs asserting streaming UI boot order (D-04): migration gate precedes store init; auth-wall renders before anonymous bulk-data fetch
- [ ] `tests/components/splash-screen-removal.test.js` — stubs asserting splash overlay is not rendered once D-04 lands (component may be deleted or repurposed)
- [ ] `tests/components/topbar-pill.test.js` — stubs asserting D-06 topbar pill renders while `$store.bulkdata.status !== 'ready'` and dismisses on `ready`
- [ ] `tests/components/card-search-placeholder.test.js` — stubs asserting D-05 dependent-screen placeholder on Treasure Cruise + Thousand-Year Storm when bulkdata not ready
- [ ] `scripts/assert-bundle-budget.js` — optional helper for Plan 5 bundle-splitting size-gate (only required if D-10 triggers)
- [ ] `tests/setup.js` — extend if needed for `pagehide`/`pageshow` event simulation (Plan 2 bfcache fix)

**Existing infrastructure covered:**
- `vitest.config.js` + `tests/setup.js` (fake-indexeddb, Alpine mocks)
- `lighthouserc.cjs` + `npm run perf` (Phase 7 Plan 2)
- `src/services/perf.js` web-vitals lazy-loader (Phase 7 Plan 2; do NOT duplicate)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Lighthouse median-of-3 re-measurement | PERF-04 | Lighthouse runs are not deterministic under 100% CI automation; Phase 7 precedent (D-22a) is manual DevTools Performance-only preset | Open Chrome DevTools → Lighthouse tab → desktop preset → Performance only → single-page-session → run 3 times, record median. Capture methodology echo in 13-REMEASURE.md so it's comparable to PERF-BASELINE.md |
| bfcache confirmation | PERF-04 | Chrome DevTools "Application → Back-forward cache" tab is the only reliable UI; page must be served over http(s) with a back-navigation to inspect | Load app → navigate away → navigate back using browser back button → DevTools Application → Back-forward cache → confirm "Restored from back/forward cache" OR document the blocker reason if still failing. Test in both anonymous and authed states (Research Open Question 3) |
| Runtime non-composited animation flag | PERF-04 | Lighthouse insight is the ground truth; grep can't confirm which animation the browser actually non-composites at runtime | Run Lighthouse on the v1.1 build, inspect "Avoid non-composited animations" insight, cross-reference the flagged selector against main.css / utilities.css keyframes |
| CLS top-3 audit (post-streaming-UI) | PERF-04 | The streaming-UI change re-shuffles which DOM operations cause shift; Lighthouse CLS insight is the only reliable source | Run Lighthouse on the updated v1.1 build post-Plan-3, capture top-3 CLS contributors from the insight, feed into Plan 4 scope |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (manual Lighthouse steps sit beside file-grep automated asserts, so the sampling gap is ≤1 task)
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`npm test -- --run` enforces single-pass)
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
