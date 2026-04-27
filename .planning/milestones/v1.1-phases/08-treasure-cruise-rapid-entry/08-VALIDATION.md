---
phase: 8
slug: treasure-cruise-rapid-entry
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 + jsdom 29.0.1 + fake-indexeddb 6.2.5 |
| **Config file** | `vitest.config.js` (exists — Phase 7 baseline: `tests/migration-v5-to-v7.test.js`, `tests/schema-rename-spike.test.js`) |
| **Quick run command** | `npx vitest run <targeted-file>` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15s targeted / ~45s full suite |

---

## Sampling Rate

- **After every task commit:** Run the targeted `npx vitest run tests/<file>.test.js` for the files the task touched
- **After every plan wave:** Run `npm test` (full suite, includes Phase 7 migration regression)
- **Before `/gsd:verify-work`:** Full suite green + manual QA of the 6 UI-SPEC Visual Regression Anchors
- **Max feedback latency:** ~45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-T1 | 01 | 1 | COLLECT-01 | unit (regex audit) | `npx vitest run tests/add-card-panel.audit.test.js` | ❌ W0 | ⬜ pending |
| 08-01-T2 | 01 | 1 | COLLECT-03 | component DOM | `npx vitest run tests/add-card-panel.dropdown.test.js` | ❌ W0 | ⬜ pending |
| 08-01-T3 | 01 | 1 | COLLECT-05 | component | `npx vitest run tests/mass-entry-panel.test.js` | ❌ W0 | ⬜ pending |
| 08-02-T1 | 02 | 2 | COLLECT-06 | unit (localStorage) | `npx vitest run tests/add-card-panel.state.test.js -t "localStorage persistence"` | ❌ W0 | ⬜ pending |
| 08-02-T2 | 02 | 2 | COLLECT-06 | integration (stays open) | `npx vitest run tests/add-card-panel.state.test.js -t "stays open"` | ❌ W0 | ⬜ pending |
| 08-02-T3 | 02 | 2 | COLLECT-06 | visual (manual) | UI-SPEC Anchor 1 manual QA | manual | ⬜ pending |
| 08-02-T4 | 02 | 2 | COLLECT-04 | unit | `npx vitest run tests/printings.test.js` | ❌ W0 | ⬜ pending |
| 08-02-T5 | 02 | 2 | COLLECT-04 | component (live price) | `npx vitest run tests/printing-picker.test.js -t "selectPrinting"` | ❌ W0 | ⬜ pending |
| 08-02-T6 | 02 | 2 | regression | unit (timing spy) | `npx vitest run tests/scryfall-queue.test.js` | ❌ W0 | ⬜ pending |
| 08-03-T1 | 03 | 3 | COLLECT-02 | integration (additive) | `npx vitest run tests/schema-v9.test.js` | ❌ W0 | ⬜ pending |
| 08-03-T2 | 03 | 3 | COLLECT-02 | unit (fetchPrecons) | `npx vitest run tests/precons.test.js -t "fetchPrecons"` | ❌ W0 | ⬜ pending |
| 08-03-T3 | 03 | 3 | COLLECT-02 | unit (fetchPreconDecklist) | `npx vitest run tests/precons.test.js -t "fetchPreconDecklist"` | ❌ W0 | ⬜ pending |
| 08-03-T4 | 03 | 3 | COLLECT-02 | integration (addAllFromPrecon) | `npx vitest run tests/collection.precon.test.js -t "addAllFromPrecon"` | ❌ W0 | ⬜ pending |
| 08-03-T5 | 03 | 3 | COLLECT-02 | integration (undo inverse) | `npx vitest run tests/collection.precon.test.js -t "undo inverse"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Wave numbering: W0 = pre-execution scaffolding tests must exist before the plan's tasks start; ❌ W0 = test file still needs creation.*

---

## Wave 0 Requirements

- [ ] `tests/add-card-panel.audit.test.js` — COLLECT-01 regex audit for mana-cost absence in search results + selected-card preview
- [ ] `tests/add-card-panel.dropdown.test.js` — COLLECT-03 thumbnail DOM shape (`<img class="cf-card-img">`, graceful name-only fallback)
- [ ] `tests/add-card-panel.state.test.js` — COLLECT-06 localStorage persistence + stays-open-after-add semantics
- [ ] `tests/mass-entry-panel.test.js` — COLLECT-05 X-close button wired to existing `discard()` + confirm-on-parsed-entries path
- [ ] `tests/printings.test.js` — COLLECT-04 `loadPrintings(card)` paper filter + `released_at` DESC sort
- [ ] `tests/printing-picker.test.js` — COLLECT-04 `selectPrinting` component live-price-update via `eurToGbp`
- [ ] `tests/precons.test.js` — `fetchPrecons()` + `fetchPreconDecklist()` service unit tests with mocked Scryfall
- [ ] `tests/collection.precon.test.js` — `addAllFromPrecon` integration: single `loadEntries()`, batch undo inverse
- [ ] `tests/schema-v9.test.js` — v8→v9 additive upgrade, `precons_cache` queryable post-upgrade, no data loss
- [ ] `tests/scryfall-queue.test.js` — rate-limiting timing spy confirms ≥100ms spacing, no parallel fires
- [ ] `tests/fixtures/scryfall-precons.js` — shared fixture: mock `/sets?type=commander` list + mock `search_uri` decklist for sample set `cmm` (100 cards)

*(Framework install: none needed — Vitest + fake-indexeddb + jsdom all installed in Phase 7.)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| LHS panel pushes grid (no overlay) | COLLECT-06 | CSS layout — visual regression only detectable visually | Open Treasure Cruise with panel open; confirm grid starts to right of 360px panel, no content is hidden behind panel. Close panel; confirm grid expands to 100% width with 200ms ease-out. |
| Precon browser full-screen drawer | COLLECT-02 | Full-screen modal layout + scrim | Open precon browser from panel header; confirm drawer covers full viewport with `rgba(0,0,0,0.6)` backdrop; close via X, backdrop click, and Escape all work. |
| Decklist preview layout | COLLECT-02 | Visual hierarchy of commander + sorted cards | Click a Commander precon tile; confirm decklist shows commander first with COMMANDER badge, remaining cards sorted by type (creature / spell / land) then name. |
| Printing strip wrap + icon feedback | COLLECT-04 | Keyrune icon visual fidelity at 32px + wrap behaviour | Search "Lightning Bolt", select a result; confirm printing strip shows all paper printings as keyrune icons (32px), wraps to multiple rows within 360px panel, newest printing on left, click-to-switch updates price/image inline. |
| Thumbnail in dropdown rows | COLLECT-03 | 40px aspect ratio + cf-card-img rounded corners | Type "lightning" in panel search; confirm dropdown rows each show 40px-tall thumbnail left of name, set icon at right, rounded corners via `cf-card-img`. |
| Toast wording for precon add-all | COLLECT-02 | Exact string match | After adding a precon, confirm toast reads `Added {N} cards from {Precon Name} to collection.` with `UNDO` action button. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (11 test files scaffolded)
- [ ] No watch-mode flags (all commands use `vitest run`, not `vitest`)
- [ ] Feedback latency < 45s (full suite target)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
