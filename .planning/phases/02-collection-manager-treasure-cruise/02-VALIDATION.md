---
phase: 2
slug: collection-manager-treasure-cruise
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-04
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `vitest.config.js` |
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
| 02-01-01 | 01 | 1 | COLL-01 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | COLL-12 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | COLL-02 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | COLL-03 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 1 | COLL-04 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 02-02-04 | 02 | 1 | COLL-11 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | COLL-05 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | COLL-06 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 02-03-03 | 03 | 2 | COLL-09 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 02-03-04 | 03 | 2 | COLL-10 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 3 | COLL-08 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 02-04-02 | 04 | 3 | COLL-07 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 02-04-03 | 04 | 3 | COLL-13 | unit | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/collection-store.test.js` — stubs for COLL-01, COLL-07, COLL-12
- [ ] `src/__tests__/collection-views.test.js` — stubs for COLL-02, COLL-03, COLL-04, COLL-11
- [ ] `src/__tests__/mass-entry.test.js` — stubs for COLL-05, COLL-06
- [ ] `src/__tests__/csv-import-export.test.js` — stubs for COLL-09, COLL-10
- [ ] `src/__tests__/collection-analytics.test.js` — stubs for COLL-08, COLL-13

*Existing infrastructure (vitest) covers framework needs. Only test file stubs needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Virtual scroll smooth at 1000+ cards | COLL-11 | Visual performance check | Load 1000+ cards in gallery, scroll rapidly, verify no jank |
| Chart.js renders correctly | COLL-08 | Canvas rendering | Open analytics panel, verify colour pie and mana curve render |
| Card image loading in gallery | COLL-02 | Network-dependent | Add 20+ cards, switch to gallery view, verify images load |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
