---
phase: 3
slug: deck-builder-thousand-year-storm
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | `vitest.config.js` |
| **Quick run command** | `rtk vitest run --reporter=verbose` |
| **Full suite command** | `rtk vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `rtk vitest run --reporter=verbose`
- **After every plan wave:** Run `rtk vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | DECK-01 | unit | `rtk vitest run` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | DECK-02 | unit | `rtk vitest run` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | DECK-03 | unit | `rtk vitest run` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | DECK-04 | unit | `rtk vitest run` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | DECK-05 | unit | `rtk vitest run` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 2 | DECK-06 | unit | `rtk vitest run` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 2 | DECK-07 | unit | `rtk vitest run` | ❌ W0 | ⬜ pending |
| 03-04-02 | 04 | 2 | DECK-08 | unit | `rtk vitest run` | ❌ W0 | ⬜ pending |
| 03-05-01 | 05 | 3 | DECK-09 | unit | `rtk vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/deck-store.test.js` — stubs for DECK-01, DECK-02, DECK-03
- [ ] `tests/deck-builder-screen.test.js` — stubs for DECK-04, DECK-05, DECK-06
- [ ] `tests/deck-analytics.test.js` — stubs for DECK-07, DECK-08
- [ ] `tests/deck-import-export.test.js` — stubs for DECK-09, DECK-10, DECK-11

*Existing Vitest infrastructure covers framework needs. Test files need creating for deck-specific modules.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-and-drop card reordering | DECK-05 | SortableJS DOM interaction | Drag card between categories, verify order persists |
| Three-panel layout responsiveness | DECK-03 | Visual layout verification | Resize browser, verify panels adjust correctly |
| Card image rendering in grid view | DECK-06 | Visual rendering | Toggle grid/list views, verify images display |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
