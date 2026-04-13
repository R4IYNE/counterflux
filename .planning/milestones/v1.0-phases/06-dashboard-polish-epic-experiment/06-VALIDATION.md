---
phase: 6
slug: dashboard-polish-epic-experiment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.js (vitest configured inline) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | DASH-01 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | DASH-06 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 1 | DASH-02 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 2 | UX-01 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 06-03-02 | 03 | 2 | UX-03 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 06-04-01 | 04 | 2 | PERF-02 | unit | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for dashboard panel rendering (DASH-01, DASH-04, DASH-05, DASH-06, DASH-07)
- [ ] Test stubs for Quick Add card resolution (DASH-02)
- [ ] Test stubs for undo system (UX-03)
- [ ] Test stubs for keyboard shortcut handler (UX-01)
- [ ] Test stubs for offline status detection (PERF-02)

*Existing vitest infrastructure covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dashboard visual layout (command centre grid) | DASH-01 | Visual layout verification | Open dashboard, verify portfolio top, decks+activity mid, Mila+alerts+releases bottom |
| Sparkline rendering | DASH-01 | SVG visual output | Verify sparkline renders with price trend data |
| Keyboard shortcut cheat sheet | UX-01 | Modal visual/interaction | Press ?, verify modal opens with shortcut list |
| Toast undo countdown animation | UX-03 | Timer visual feedback | Delete card, verify toast shows countdown progress |
| Topbar status chip color states | PERF-02 | Visual state indicator | Test online/stale/offline chip colors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
