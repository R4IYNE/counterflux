---
phase: 1
slug: foundation-data-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (to be installed in Wave 0) |
| **Config file** | None — Wave 0 must create vitest.config.js |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-xx | 01 | 1 | DATA-01 | integration | `npx vitest run tests/bulk-data.test.js -t "downloads and stores"` | No — W0 | ⬜ pending |
| 01-01-xx | 01 | 1 | DATA-02 | unit | `npx vitest run tests/bulk-data.test.js -t "refresh logic"` | No — W0 | ⬜ pending |
| 01-xx-xx | xx | x | DATA-03 | unit | `npx vitest run tests/search.test.js` | No — W0 | ⬜ pending |
| 01-xx-xx | xx | x | DATA-04 | unit | `npx vitest run tests/search.test.js -t "performance"` | No — W0 | ⬜ pending |
| 01-xx-xx | xx | x | DATA-05 | unit | `npx vitest run tests/card-accessor.test.js` | No — W0 | ⬜ pending |
| 01-xx-xx | xx | x | DATA-06 | unit | `npx vitest run tests/scryfall.test.js` | No — W0 | ⬜ pending |
| 01-xx-xx | xx | x | DATA-07 | unit | `npx vitest run tests/schema.test.js` | No — W0 | ⬜ pending |
| 01-xx-xx | xx | x | DATA-08 | unit | `npx vitest run tests/storage.test.js` | No — W0 | ⬜ pending |
| 01-xx-xx | xx | x | SHELL-04 | integration | `npx vitest run tests/router.test.js` | No — W0 | ⬜ pending |
| 01-xx-xx | xx | x | SHELL-07 | unit | `npx vitest run tests/toast.test.js` | No — W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm install -D vitest fake-indexeddb` — test framework + IndexedDB mock
- [ ] `vitest.config.js` — Vite-native test config
- [ ] `tests/fixtures/sample-cards.json` — sample Scryfall data covering all layout types
- [ ] `tests/card-accessor.test.js` — covers DATA-05
- [ ] `tests/search.test.js` — covers DATA-03, DATA-04
- [ ] `tests/bulk-data.test.js` — covers DATA-01, DATA-02
- [ ] `tests/scryfall.test.js` — covers DATA-06
- [ ] `tests/schema.test.js` — covers DATA-07
- [ ] `tests/storage.test.js` — covers DATA-08
- [ ] `tests/toast.test.js` — covers SHELL-07
- [ ] `tests/router.test.js` — covers SHELL-04

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Initial load under 3s | PERF-01 | Requires real browser Lighthouse audit | Run Lighthouse in Chrome DevTools on built production bundle |
| Visual shell renders correctly | SHELL-01, SHELL-02, SHELL-03, SHELL-05, SHELL-06 | Visual design fidelity | Compare rendered app against Stitch mockup screenshots |
| Mila displays in sidebar and states | MILA-01, MILA-02, MILA-03 | Visual inspection of avatar/animation | Check sidebar bottom for Mila avatar, trigger empty states and loading states |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
