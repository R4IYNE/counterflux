---
phase: 08-treasure-cruise-rapid-entry
plan: 02
subsystem: ui
tags: [alpine, scryfall, rate-limit, keyrune, printing-picker, localStorage, vitest, tailwind]

requires:
  - phase: 07-polish-perf-schema
    provides: Dexie v8 schema (games/collection clean-named UUID-PK tables), fake-indexeddb Vitest pattern, var(--color-*) @theme tokens, cf-card-img utility, POLISH-11 wishlist wording
  - phase: 08-treasure-cruise-rapid-entry
    provides: "Plan 1 warm-up — dropdown thumbnail, mass-entry X close, mana-cost audit (regression guards shared with Plan 2)"
provides:
  - Rate-limited Scryfall request queue (src/services/scryfall-queue.js) — User-Agent + 100ms spacing + serial promise chain, consumed by sets.js refactor and the new printings flow
  - LHS persistent add-card panel on Treasure Cruise (COLLECT-06) — 360px fixed, flex-row push layout, panelOpen persists to localStorage tc_panel_open with null→true default (Pitfall 6)
  - Paper-printings picker (COLLECT-04) — keyrune set icons below the selected-card preview, click-to-switch swaps image + price + set + collector_number in place via cf:printing-selected CustomEvent
  - collection store extensions — panelOpen, printingsByCardId, activePrintingIdByCard, loadPrintings, selectPrinting, togglePanel
  - .tc-panel-column + .tc-grid-column CSS transitions with prefers-reduced-motion accessibility override
  - 4 new Wave 0 test files (19 test cases): scryfall-queue, printings, printing-picker, add-card-panel.state
affects:
  - Plan 08-03 (precon browser wires the BROWSE PRECONS placeholder button; consumes scryfall-queue.js for /sets + search_uri pagination; adds Dexie v9 precons_cache)
  - Phase 09 (Thousand-Year Storm deckbuilder) — can reuse the scryfall-queue.js primitive for any future card-detail Scryfall calls
  - Phase 11 (cloud sync) — no direct impact; collection store additions are UI-facing, not synced fields

tech-stack:
  added: []
  patterns:
    - "Rate-limited serial fetch queue: module-singleton promise chain with min-spacing enforcement + per-test reset hook (src/services/scryfall-queue.js)"
    - "Store event dispatch for cross-component mutation: selectPrinting dispatches cf:printing-selected CustomEvent instead of direct store.selectedCard mutation — the panel x-data listens and refreshes its view"
    - "localStorage-backed panelOpen with null-first-boot default (Pitfall 6 pattern): IIFE initialiser → null check → explicit 'true' string comparison"
    - "vi.mock('alpinejs') in test files that import store modules — bypasses Alpine's module-load window/MutationObserver touches without requiring jsdom"

key-files:
  created:
    - src/services/scryfall-queue.js
    - tests/scryfall-queue.test.js
    - tests/printings.test.js
    - tests/printing-picker.test.js
    - tests/add-card-panel.state.test.js
    - .planning/phases/08-treasure-cruise-rapid-entry/08-02-SPIKE-NOTES.md
  modified:
    - src/components/add-card-panel.js  # renamed from add-card-modal.js; chrome swapped to LHS column; printing strip embedded
    - src/stores/collection.js  # panelOpen + printing state + loadPrintings/selectPrinting/togglePanel
    - src/screens/treasure-cruise.js  # flex-row mount with panel + re-open affordance; Alpine.initTree on container
    - src/services/sets.js  # bare fetch → queueScryfallRequest
    - src/styles/main.css  # .tc-panel-column/.tc-grid-column transitions + prefers-reduced-motion
    - tests/setup.js  # MutationObserver + CustomEvent globals for node-only Alpine imports
    - tests/add-card-modal.test.js  # import renamed + source-path update
    - tests/add-card-panel.audit.test.js  # import renamed
    - tests/add-card-panel.dropdown.test.js  # import renamed + row-match regex scoped to x-for block

key-decisions:
  - "Spike outcome A confirmed: bulk-data-pipeline.js stores raw Scryfall card objects (no field projection), so prints_search_uri is retained — loadPrintings uses the fast path. Fallback oracleid URL kept as defensive coverage."
  - "CustomEvent dispatch (not direct store mutation) for printing selection — keeps the panel's x-data in control of selectedCard shape while the store owns the active-printing map. Lets multiple listeners react without coupling the store to any specific panel instance."
  - "vi.mock('alpinejs') over vi.spyOn — the spyOn approach failed because Alpine's module init runs before the mock patch applies; vi.mock is hoisted so the stub is present at import time."
  - "tests/setup.js adds MutationObserver + CustomEvent globals — cheaper than switching the test environment to jsdom for every Phase 8 test (most tests are string-level HTML assertions)."
  - "Alpine.initTree(container) added to treasure-cruise.js mount — the panel is now inline in the screen (not inside #tc-modals), so the existing initTree(modalContainer) wouldn't reach it. Calling initTree on the outer container binds both the inline panel and any other x-data descendants."

patterns-established:
  - "Pattern: Rate-limited Scryfall queue — any new Scryfall fetch added in Phase 8+ must route through queueScryfallRequest (scryfall-queue.js). sets.js was retroactively refactored as a reference."
  - "Pattern: Printing-selection event flow — store method mutates activePrintingIdByCard + dispatches cf:printing-selected; panel x-data listens and patches its local selectedCard view. Decouples store from panel instance count."
  - "Pattern: localStorage-backed boolean UI prefs with IIFE init — null-first-boot default inside the store definition (Pitfall 6); togglePanel method writes String(bool) back. Reusable template for any future persistent UI toggle."

requirements-completed: [COLLECT-04, COLLECT-06]

duration: 14m 54s
completed: 2026-04-16
---

# Phase 8 Plan 2: LHS Add Panel + Printing Picker Summary

**Treasure Cruise's add-card flow converted from centred modal to a persistent 360px LHS workbench panel, with a live paper-printings picker underneath the selected card and a rate-limited Scryfall request queue powering every new Scryfall call — the biggest user-facing change in Phase 8.**

## Performance

- **Duration:** 14m 54s (894 seconds wall-clock)
- **Started:** 2026-04-16T08:54:11Z
- **Completed:** 2026-04-16T09:09:05Z
- **Tasks:** 6 (1 Wave 0 scaffold + 1 queue foundation + 1 spike + 2 chrome/logic + 1 screen wiring)
- **Files modified:** 10 (4 new services/components, 6 edited including the screen mount and store)
- **New tests added:** 19 cases across 4 files

## Accomplishments

- **COLLECT-06 delivered** — The add-card surface is now a persistent 360px LHS column (<aside class="tc-panel-column">). Panel stays open across adds per D-01, first-boot defaults to open per D-03 / Pitfall 6, togglePanel persists state to localStorage `tc_panel_open`, re-open affordance (chevron_right button) appears top-left when the panel is closed. Grid reflows with 200ms ease-out transition; prefers-reduced-motion block honours accessibility.
- **COLLECT-04 delivered** — Paper-printings picker renders inline below the selected-card preview. Keyrune icons, 32×32, wraps to multiple rows within 360px, newest-first per D-16, active icon shows `bg-primary` + `glow-blue` per D-17. Clicking any icon fires `$store.collection.selectPrinting` which dispatches `cf:printing-selected`; the panel's x-data listener patches `selectedCard.image_uris / set / collector_number / prices` in place. GBP price lookup routes through the existing `window.__cf_eurToGbp`.
- **Scryfall rate-limited queue shipped** — `src/services/scryfall-queue.js` closes Pitfall 1 (CONTEXT + STACK referenced a queue that didn't exist). Serial promise chain with 100ms spacing and `Counterflux/1.1 (MTG collection manager)` User-Agent. Refactored `src/services/sets.js` to consume it; Plan 3 precon service will inherit this foundation.
- **Spike outcome documented** — Branch A: bulk-data-pipeline.js stores raw Scryfall card objects with no field projection, so `prints_search_uri`, `oracle_id`, and `games[]` are all retained. loadPrintings uses the fast path (direct `card.prints_search_uri`) with oracleid fallback for test fixtures.
- **19 new tests, all green** — 4 queue timing/header/error + 5 printings filter/sort/pagination + 4 picker state/event/price + 6 panel-state localStorage persistence & reset-semantics. Baseline 533 passing → now 552 passing (exactly +19 from Wave 0).
- **Vite production build verified** — `dist/assets/treasure-cruise-*.js` 88KB (17KB gz) with the new panel + printing strip.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 test scaffolds** — `1902e29` (test) — 4 files, 19 test cases, all failing RED as specified
2. **Task 2: Scryfall queue + sets.js refactor** — `6705378` (feat) — queue module shipped, 4/4 queue tests GREEN
3. **Task 3: prints_search_uri spike** — `9ecfc9b` (docs) — Conclusion A (pipeline retains all fields); no source edits
4. **Task 4: Rename add-card-modal → add-card-panel + swap chrome** — `d4287e6` (feat) — LHS column chrome + printing strip markup + state machine preserved + Plan 1 test imports updated + MutationObserver shim in setup.js
5. **Task 5: Store extensions for panelOpen + printings** — `eaee97f` (feat) — loadPrintings, selectPrinting, togglePanel landed; 19/19 tests GREEN
6. **Task 6: Screen wiring + re-open affordance + motion CSS** — `1200fb0` (feat) — flex-row mount, chevron_right affordance, .tc-panel-column transitions, Alpine.initTree on container

**Plan metadata commit:** pending (created by execute-plan finaliser with this SUMMARY + STATE + ROADMAP updates)

## Files Created/Modified

**Created:**
- `src/services/scryfall-queue.js` — Module-singleton promise-chain queue with 100ms spacing + User-Agent injection + non-2xx throw + `__resetQueueForTests` export for isolation.
- `tests/scryfall-queue.test.js` — 4 cases (User-Agent header, spacing, error, serial ordering).
- `tests/printings.test.js` — 5 cases (paper filter, DESC sort, field shape, oracleid fallback, pagination).
- `tests/printing-picker.test.js` — 4 cases (activePrintingIdByCard mutation, CustomEvent dispatch, GBP rounding, strip template binding).
- `tests/add-card-panel.state.test.js` — 6 cases (localStorage null/true/false init, D-01 stays-open, reset() shape, togglePanel persist).
- `.planning/phases/08-treasure-cruise-rapid-entry/08-02-SPIKE-NOTES.md` — Conclusion A documented with citations.

**Modified:**
- `src/components/add-card-panel.js` (renamed from add-card-modal.js via `git mv`; renderAddCardModal → renderAddCardPanel; outer chrome swapped from fixed-center backdrop+modal to 360px `<aside class="tc-panel-column">` with header row [title + chevron close] + action row [BROWSE PRECONS disabled placeholder + MASS ENTRY shortcut] + empty-state heading `READY TO ARCHIVE` + printing strip markup wired to store + `addToCollection` no longer closes panel per D-01 + `close()` rewired to `togglePanel()` + all hard-coded hex replaced with `var(--color-*)` tokens; selected-card image upgraded from 64px to 96px tall per UI-SPEC Anatomy 1; third meta line showing SET · collector_number added).
- `src/stores/collection.js` (new fields: `panelOpen` with null-first-boot IIFE, `printingsByCardId`, `activePrintingIdByCard`; new methods: `togglePanel`, `loadPrintings`, `selectPrinting`; import added for `queueScryfallRequest`).
- `src/screens/treasure-cruise.js` (mount template wrapped in `<div class="treasure-cruise-screen" style="display: flex; flex-direction: row; ...">`; `renderAddCardPanel()` rendered inline; re-open chevron_right button added; `<section class="tc-grid-column">` wraps original grid content; `renderAddCardModal()` removed from `#tc-modals` container; empty-state "ADD CARD" button rewired to `panelOpen = true`; `Alpine.initTree(container)` added so the inline panel's x-data binds).
- `src/services/sets.js` (bare `fetch('https://api.scryfall.com/sets', { headers: ... })` replaced with `queueScryfallRequest('https://api.scryfall.com/sets')`; stale-cache fallback path retargeted from `!response.ok` to queue error catch).
- `src/styles/main.css` (added `.tc-panel-column` transform+width transitions, `.tc-grid-column` margin-left transition, `@media (prefers-reduced-motion: reduce)` override).
- `tests/setup.js` (added global `MutationObserver` and `CustomEvent` stubs so tests importing alpinejs via the store don't crash at module load).
- `tests/add-card-modal.test.js`, `tests/add-card-panel.audit.test.js`, `tests/add-card-panel.dropdown.test.js` (import paths updated to add-card-panel.js; `renderAddCardModal` kept as a const alias of `renderAddCardPanel` so test bodies remain intact; dropdown test's row-match regex scoped to `x-for="(card, idx) in searchResults"` so the new empty-state `<template>` in the same file doesn't short-circuit the non-greedy match).

## Decisions Made

- **Branch A fast path for loadPrintings** — The spike confirmed `bulk-data-pipeline.js:54` calls `db.cards.bulkPut(toInsert)` with raw stream-parser values (no projection step). Every top-level Scryfall field survives ingestion, so `card.prints_search_uri` is directly usable. Kept the oracleid fallback for test fixtures or any future trim pass.
- **CustomEvent dispatch for printing selection** — Instead of having `selectPrinting` directly mutate the panel's `selectedCard` (which would require the store to hold a reference to the panel's x-data), the store dispatches `cf:printing-selected` with `{ cardId, printing }`. The panel's `x-init` listens and patches its own `selectedCard`. Decouples the store from the panel and lets any future consumer react.
- **vi.mock('alpinejs') in tests over vi.spyOn** — spyOn can't bypass Alpine's import-time window/MutationObserver touches because the module executes before the spy is installed. vi.mock is hoisted to the top of the module, so the stub is in place when the store module imports alpinejs.
- **tests/setup.js shim over jsdom environment** — Most Phase 8 tests assert on rendered HTML strings (no DOM). Switching to jsdom for all tests would slow the full suite significantly; stubbing MutationObserver + CustomEvent globally is a ~20-line fix that unblocks the 3 tests that import store modules without penalising the rest.
- **Alpine.initTree on the screen container (not just #tc-modals)** — With the panel now inline in the screen DOM (not in the modal container appended to `document.body`), the existing `Alpine.initTree(modalContainer)` couldn't bind its x-data. Calling `initTree(container)` covers both the inline panel and any other x-data descendants without needing a second init call.
- **Row-match regex scoped in dropdown.test.js** — The prior regex `searchResults[\s\S]*?</template>` matched from the state field `searchResults: []` to the first `</template>` in the file. With the new empty-state template inserted between the state field and the dropdown's x-for block, the regex would short-circuit and report imgIdx=-1. Scoping to `x-for="(card, idx) in searchResults"` pins the match to the dropdown row unambiguously.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tests/setup.js needed MutationObserver + CustomEvent globals**
- **Found during:** Task 4 (running the Wave 0 tests after the rename)
- **Issue:** `alpinejs`' `module.cjs.js` touches `MutationObserver` and `window` at module-load (line 1585 / 2594). Node-only test environment has neither, causing every test that imports a store module (via `tests/add-card-panel.state.test.js`, `tests/printings.test.js`, `tests/printing-picker.test.js`) to crash before any `it()` ran.
- **Fix:** Added global `MutationObserver` (no-op class) and `CustomEvent` (minimal polyfill) to `tests/setup.js`. These stubs are install-gated on `typeof === 'undefined'` so if vitest is ever switched to jsdom the real implementations win.
- **Files modified:** `tests/setup.js`
- **Verification:** All 19 new tests + all 3 Plan 1 tests + the router test-file now exit green. Full suite: 552 passing + 10 todo + 1 pre-existing failure.
- **Committed in:** d4287e6 (Task 4 commit)

**2. [Rule 1 - Bug] Dropdown test row-match regex short-circuited by new empty-state template**
- **Found during:** Task 4 (re-running Plan 1 regression tests after the rename)
- **Issue:** `tests/add-card-panel.dropdown.test.js` used `html.match(/searchResults[\s\S]*?<\/template>/)` to locate the dropdown row. The new panel has an empty-state `<template x-if="!searchQuery && !selectedCard">` BEFORE the dropdown's x-for block, so the non-greedy match now captures the wrong region (starting at the state field `searchResults: []` and ending at the empty-state `</template>`). Result: `imgIdx` became -1.
- **Fix:** Scoped the regex to `x-for="(card, idx) in searchResults"[\s\S]*?</template>` — pins the match to the dropdown row unambiguously.
- **Files modified:** `tests/add-card-panel.dropdown.test.js`
- **Verification:** `npx vitest run tests/add-card-panel.dropdown.test.js` — 5/5 green.
- **Committed in:** d4287e6 (Task 4 commit)

**3. [Rule 2 - Missing Critical] vi.mock pattern rewrite for 3 Wave 0 test files**
- **Found during:** Task 5 (running printings/picker/state tests against the extended store)
- **Issue:** The Task 1 scaffolds used `vi.spyOn(AlpineMod.default, 'store', ...)`. This failed because Alpine's module initialisation (reading `window`, instantiating `MutationObserver`) runs at `import 'alpinejs'` — BEFORE the spy is installed. The stub couldn't intercept the store registration.
- **Fix:** Switched all 3 test files to `vi.mock('alpinejs', () => ({ default: { store(...) } }))`. vi.mock is hoisted to the top of the test file so the stub is present when the store module's `import Alpine from 'alpinejs'` resolves. Added a top-level `__alpineStores` map that the store retrieval pattern reads.
- **Files modified:** `tests/printings.test.js`, `tests/printing-picker.test.js`, `tests/add-card-panel.state.test.js`
- **Verification:** 15/15 of these tests now pass.
- **Committed in:** eaee97f (Task 5 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking test infra, 1 bug in prior test, 1 missing critical — test isolation pattern)
**Impact on plan:** All three are test-infrastructure fixes caused by Phase 8 being the first plan where multiple tests import alpinejs-dependent modules in pure-node vitest. No production-code scope creep; no additional requirements introduced. Every auto-fix preserved the spec-level test intent — only the plumbing changed.

## Issues Encountered

- **Pre-existing `tests/router.test.js > vandalblast` failure** — documented in `deferred-items.md` from Plan 1. The Vandalblast route mount calls `Alpine.data('postGameOverlay', ...)` when `Alpine` is undefined in the test harness. Not caused by Plan 2; not fixed by Plan 2. Full suite at `552 passing + 10 todo + 1 pre-existing failure`.
- **`npm test` surfaces Alpine internal cleanup error after router.test.js treasure-cruise assertions** — the cleanup is a vitest teardown artefact from jsdom interacting with Alpine's MutationObserver cleanup (`module.cjs.js:2120`). The tests themselves pass; the error is non-blocking post-hook noise. Consolidate in a future Phase 7+ test-infra pass if the signal becomes disruptive.

## User Setup Required

None — no external service configuration. No new npm dependencies. No schema migration (Dexie v9 is Plan 3's work).

## Known Stubs

- **BROWSE PRECONS button** (src/components/add-card-panel.js:160-166) — Intentionally disabled with `title="Available in Plan 3"` and `cursor: not-allowed`. Plan 3 wires this button to `$store.collection.preconBrowserOpen = true` when the precon browser lands. Documented in the Plan 2 plan.md (§interfaces).

## Next Phase Readiness

**Ready for Plan 3 (precon browser + Dexie v9):**
- `src/services/scryfall-queue.js` is the foundation for Plan 3's `src/services/precons.js`. Serial queue with 100ms spacing is enough headroom for paginating 100-card commander decklists without 429 risk.
- `BROWSE PRECONS` button is a visible disabled placeholder in the panel header — Plan 3 flips `disabled` off and wires `@click="$store.collection.preconBrowserOpen = true"`.
- `loadPrintings` + `selectPrinting` pattern establishes the rate-limited + in-memory-cached fetch convention. Plan 3's `fetchPrecons` / `fetchPreconDecklist` can mirror the same shape (queue fetch → filter → cache in Dexie).
- `$store.collection.addBatch` is ALREADY the target for precon add-all — but the current loop-over-addCard triggers N+1 reloads (Pitfall 2 from research). Plan 3 must convert `addAllFromPrecon` to the bulkAdd path with a single `loadEntries()` at the end.

**Visual regression anchors covered after Plan 2:**
- ✅ Anchor 1 (push not overlay) — grid starts at x=360px in dev mode; verified via build.
- ✅ Anchor 2 (panel stays open across adds) — addToCollection no longer sets addCardOpen=false; reset() clears fields; test coverage in add-card-panel.state.test.js.
- ✅ Anchor 3 (printing strip wraps) — keyrune icons 32×32 with `flex-wrap: wrap` inside 360px panel; active icon shows glow-blue + bg-primary.
- ✅ Anchor 6 (dropdown row thumbnail) — inherited from Plan 1; still green (cf-card-img + image_uris.small).
- ⏳ Anchors 4-5 remain on Plan 3 (precon browser full-screen + single toast for add-all).

**Performance outlook:** Scryfall queue's 100ms spacing means worst case ~2 seconds to paginate a 20-page prints_search_uri result. For a typical card (3-10 printings = 1 page) latency is a single queue slot. No performance regressions observed in the full suite (suite duration ~2.7s, unchanged from Plan 1 baseline).

## Self-Check: PASSED

Verified all claimed artefacts exist on disk and all commit hashes resolve:

- FOUND: src/services/scryfall-queue.js
- FOUND: src/components/add-card-panel.js (renamed from add-card-modal.js which is now gone)
- FOUND: src/stores/collection.js (modified — new fields + methods)
- FOUND: src/screens/treasure-cruise.js (modified — flex row + re-open affordance)
- FOUND: src/styles/main.css (modified — transitions + prefers-reduced-motion)
- FOUND: src/services/sets.js (modified — queue-routed)
- FOUND: tests/scryfall-queue.test.js
- FOUND: tests/printings.test.js
- FOUND: tests/printing-picker.test.js
- FOUND: tests/add-card-panel.state.test.js
- FOUND: tests/setup.js (modified — MutationObserver/CustomEvent shims)
- FOUND: .planning/phases/08-treasure-cruise-rapid-entry/08-02-SPIKE-NOTES.md
- FOUND: commit 1902e29 (Task 1 — Wave 0 test scaffolds)
- FOUND: commit 6705378 (Task 2 — queue + sets.js refactor)
- FOUND: commit 9ecfc9b (Task 3 — spike note)
- FOUND: commit d4287e6 (Task 4 — panel rename + chrome swap)
- FOUND: commit eaee97f (Task 5 — store extensions)
- FOUND: commit 1200fb0 (Task 6 — screen wiring + CSS motion)

---
*Phase: 08-treasure-cruise-rapid-entry*
*Completed: 2026-04-16*
