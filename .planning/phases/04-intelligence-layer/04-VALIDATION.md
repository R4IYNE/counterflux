---
phase: 4
slug: intelligence-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x |
| **Config file** | vitest.config implied in package.json |
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
| 04-01-01 | 01 | 1 | INTEL-01 | unit | `npx vitest run tests/edhrec-service.test.js -t "synergy"` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | INTEL-05 | unit | `npx vitest run tests/salt-score.test.js` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | INTEL-03 | unit | `npx vitest run tests/spellbook-service.test.js -t "included"` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 1 | INTEL-04 | unit | `npx vitest run tests/spellbook-service.test.js -t "almostIncluded"` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | INTEL-02 | unit | `npx vitest run tests/gap-detection.test.js` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | INTEL-06 | unit | `npx vitest run tests/insight-engine.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/edhrec-service.test.js` — covers INTEL-01, INTEL-05 (mock fetch, verify cache, parse synergy)
- [ ] `tests/spellbook-service.test.js` — covers INTEL-03, INTEL-04 (mock fetch, verify combo mapping)
- [ ] `tests/gap-detection.test.js` — covers INTEL-02 (pure function, threshold comparison)
- [ ] `tests/salt-score.test.js` — covers INTEL-05 (aggregation, normalization, edge cases)
- [ ] `tests/insight-engine.test.js` — covers INTEL-06 (ranking algorithm, daily rotation)
- [ ] `tests/fixtures/edhrec-prossh.json` — sample EDHREC response fixture
- [ ] `tests/fixtures/spellbook-combos.json` — sample Spellbook response fixture

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Synergy suggestions render in analytics sidebar | INTEL-01 | DOM rendering in imperative panel | Open deck editor with a commander, verify synergy section appears below charts |
| Combo badges visible on card tiles | INTEL-03 | Visual overlay positioning | Add combo pieces to deck, verify badge icon appears on tiles |
| Salt gauge colour-coded correctly | INTEL-05 | Visual design verification | Load deck with known salt, verify gauge matches green/yellow/red thresholds |
| Gap warnings inline in tag breakdown | INTEL-02 | DOM integration with existing panel | Create deck with <8 removal cards, verify amber warning appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
