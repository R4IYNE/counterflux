---
phase: 09
slug: deck-accuracy-vandalblast-pod-experience
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `09-RESEARCH.md` §Validation Architecture (Nyquist Dimension 8).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.js` (existing, root) — uses `tests/setup.js` for global stubs |
| **Quick run command** | `npx vitest run tests/{file}.test.js -x` (single file, fast-fail) |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~120 seconds full suite (per Phase 8.1 history) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/{touched-file}.test.js -x` (Nyquist quick-run, sub-30s)
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd:verify-work`:** Full suite must be green + manual UAT walkthrough of all 15 requirements
- **Max feedback latency:** ~30 seconds per task

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| DECK-01 | Back button dispatches `deck-back-to-landing` event | unit | `npx vitest run tests/deck-editor.test.js -x` | ❌ Wave 0 | pending |
| DECK-02 | Krenko fixture mana_curve matches expected exactly | unit | `npx vitest run tests/deck-analytics-fixtures.test.js -x` | ❌ Wave 0 | pending |
| DECK-02 | Niv-Mizzet fixture colour_distribution within 0.01 tolerance | unit | (same file) | ❌ Wave 0 | pending |
| DECK-02 | Ur-Dragon fixture all 6 colour buckets non-zero | unit | (same file) | ❌ Wave 0 | pending |
| DECK-03 | `detectGaps` returns three-tier severity (`red`/`amber`/`green`) | unit | `npx vitest run tests/gap-detection.test.js -x` | ✅ extend existing | pending |
| DECK-03 | Badge format `[RED] +5` rendered, no category-name duplication | integration (jsdom) | `npx vitest run tests/deck-analytics-panel.test.js -x` | ❌ Wave 0 | pending |
| DECK-04 | `fetchTopSaltMap` parses `cardlists[0].cardviews[].label` correctly | unit | `npx vitest run tests/edhrec-service.test.js -x` | ✅ extend existing | pending |
| DECK-04 | Salt-aggregate non-zero for deck containing Stasis (top-1 salt) | unit | (same file) | ✅ extend existing | pending |
| DECK-04 | Salt cache hit avoids second fetch within 7d TTL | unit | (same file) | ✅ extend existing | pending |
| DECK-05 | Commander section rendered ABOVE Creature section | integration (jsdom) | `npx vitest run tests/deck-centre-panel.test.js -x` | ❌ Wave 0 | pending |
| GAME-01 | Player name "Alexander the Great Lifelinker" doesn't overflow | integration (jsdom) | `npx vitest run tests/player-card.test.js -x` | ❌ Wave 0 | pending |
| GAME-02 | 3-player layout uses `.cf-player-grid-3` class | integration (jsdom) | (same file) | ❌ Wave 0 | pending |
| GAME-03 | Life > 20 → green; ≤ 20 → amber; ≤ 10 → red dynamic class | integration (jsdom) | (same file) | ❌ Wave 0 | pending |
| GAME-04 | Poison icon span text content === `vaccines` | integration (jsdom) | (same file) | ❌ Wave 0 | pending |
| GAME-05 | Toggle calls `requestFullscreen` synchronously from click handler | integration (jsdom) | `npx vitest run tests/floating-toolbar.test.js -x` | ❌ Wave 0 | pending |
| GAME-05 | Game state survives `fullscreenchange` event (no re-mount) | integration (jsdom) | (same file) | ❌ Wave 0 | pending |
| GAME-06 | In-card +/- on counter calls `adjustCounter(playerIdx, name, ±1)` | integration (jsdom) | `npx vitest run tests/player-card.test.js -x` | ❌ Wave 0 | pending |
| GAME-07 | Spinner returns winnerIndex; reduced-motion skips animation | unit | `npx vitest run tests/first-player-spinner.test.js -x` | ❌ Wave 0 | pending |
| GAME-07 | `is_first: true` set on chosen player; persists in saveGame | unit | `npx vitest run tests/game-store.test.js -x` (extend) | ✅ extend existing | pending |
| GAME-08 | `activePlayerIndex` advances on `nextTurn()`; CSS class `cf-player-active` applied | integration (jsdom) | `npx vitest run tests/player-card.test.js -x` | ❌ Wave 0 | pending |
| GAME-09 | `nextTurn()` pushes `Date.now() - turnStartedAt` onto `turn_laps` | unit | `npx vitest run tests/game-store.test.js -x` (extend) | ✅ extend existing | pending |
| GAME-09 | `saveGame()` persists `turn_laps` via `db.games.add` | unit | (same file) | ✅ extend existing | pending |
| GAME-09 | Post-game overlay renders `LONGEST TURN`, `AVG TURN`, `PER-PLAYER AVG` from `turn_laps` | integration (jsdom) | `npx vitest run tests/post-game-overlay.test.js -x` | ❌ Wave 0 | pending |
| GAME-10 | Lap correct after `vi.setSystemTime` jumps 30min mid-turn | unit | `npx vitest run tests/game-store.test.js -x` (extend with fake timers) | ✅ extend existing | pending |
| Pre-existing | `tests/router.test.js > vandalblast` no longer fails | regression | `npx vitest run tests/router.test.js -x` | ✅ existing — fix in Plan 2 | pending |

---

## Wave 0 Gaps

**New test files Plans must create:**

- [ ] `tests/deck-analytics-fixtures.test.js` — DECK-02 fixture-driven validation (Plan 1)
- [ ] `tests/fixtures/decks/krenko-mob-boss.cards.json` — 99-card Krenko EDHREC top deck snapshot (Plan 1)
- [ ] `tests/fixtures/decks/krenko-mob-boss.expected.json` — hand-derived expected analytics (Plan 1)
- [ ] `tests/fixtures/decks/niv-mizzet-parun.cards.json` (Plan 1)
- [ ] `tests/fixtures/decks/niv-mizzet-parun.expected.json` (Plan 1)
- [ ] `tests/fixtures/decks/the-ur-dragon.cards.json` (Plan 1)
- [ ] `tests/fixtures/decks/the-ur-dragon.expected.json` (Plan 1)
- [ ] `tests/deck-editor.test.js` — DECK-01 back button + Plan 1 deck-editor regressions
- [ ] `tests/deck-analytics-panel.test.js` — DECK-03 RAG badge UI rendering (Plan 1)
- [ ] `tests/deck-centre-panel.test.js` — DECK-05 Commander section placement (Plan 1)
- [ ] `tests/player-card.test.js` — GAME-01..04, GAME-06, GAME-08 (Plan 2)
- [ ] `tests/floating-toolbar.test.js` — GAME-05 fullscreen wiring (Plan 2)
- [ ] `tests/first-player-spinner.test.js` — GAME-07 standalone unit test (Plan 3)
- [ ] `tests/post-game-overlay.test.js` — GAME-09 stats section (Plan 3)
- [ ] `tests/fixtures/edhrec-top-salt.json` — captured EDHREC salt response (Plan 1)
- [ ] `tests/fixtures/screenshots/game-04-icons.png` — visual UAT artefact for glyph rendering (Plan 2)

**Existing infrastructure to extend:**

- [ ] `tests/setup.js` — append `requestAnimationFrame`, `cancelAnimationFrame`, `matchMedia` stubs (Plan 3)
- [ ] `tests/edhrec-service.test.js` — extend with `fetchTopSaltMap` test cases (Plan 1)
- [ ] `tests/gap-detection.test.js` — extend for three-tier RAG (Plan 1)
- [ ] `tests/game-store.test.js` — extend for `nextTurn` lap push, `saveGame` lap persistence, fullscreen state, `is_first` (Plan 3)

**Framework install:** none needed — vitest + jsdom + fake-indexeddb already in devDependencies.

---

## Mocking Strategy

- **EDHREC API:** mock `fetch` via `vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => fixtureJson })` in `tests/edhrec-service.test.js`. Fixture JSON: `tests/fixtures/edhrec-top-salt.json` (real captured response).
- **Date / time:** `vi.useFakeTimers()` + `vi.setSystemTime(...)` for GAME-09 / GAME-10 tests. Reset in `afterEach(() => vi.useRealTimers())`.
- **requestAnimationFrame:** `tests/setup.js` shim falls through to `setTimeout(cb, 16)`. For deterministic frame counting in spinner tests, override per-test: `vi.spyOn(global, 'requestAnimationFrame').mockImplementation(cb => { cb(performance.now()); return 1; })`.
- **Fullscreen API:** stub `document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined)` and `document.exitFullscreen = vi.fn().mockResolvedValue(undefined)`. Listen for `fullscreenchange` via `dispatchEvent(new Event('fullscreenchange'))`.
- **Alpine:** existing pattern from STATE.md ("vi.mock('alpinejs') over vi.spyOn — Alpine module init runs at import"). Phase 8 `add-card-panel.state.test.js` is a working reference.
- **Chart.js:** mock at module level: `vi.mock('chart.js', () => ({ Chart: vi.fn(() => ({ destroy: vi.fn(), update: vi.fn() })), DoughnutController: {}, ... }))`.

---

## Regression Watch

These existing tests MUST stay green throughout Phase 9:

- `tests/deck-analytics.test.js` (existing — math primitives unchanged)
- `tests/salt-score.test.js` (existing — `normalizeSalt` / `aggregateDeckSalt` unchanged)
- `tests/edhrec-service.test.js` (existing — extend, not break)
- `tests/gap-detection.test.js` (existing — extend RAG tier; old two-tier API stays as a back-compat alias if needed)
- `tests/game-store.test.js` (existing — extend with new fields/methods)
- `tests/router.test.js > vandalblast` (currently FAILING — Plan 2 must FIX, not regress further)
- `tests/migration-v5-to-v7.test.js` (Phase 7 hard gate — must remain green; Phase 9 doesn't touch schema)
