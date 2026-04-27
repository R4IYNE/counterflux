---
phase: 08-treasure-cruise-rapid-entry
verified: 2026-04-16T10:40:00Z
status: human_needed
score: 5/5 success criteria + 6/6 requirements verified; visual layout + motion need human QA
re_verification: false
human_verification:
  - test: "Visual layout — LHS panel pushes grid, not overlay"
    expected: "Navigate to Treasure Cruise in `npm run dev`. Collection grid content starts at x=360px (not obscured by a floating overlay). Panel is a permanent left-hand column with border-right; grid fills the remaining width."
    why_human: "UI-SPEC Visual Regression Anchor 1 — requires browser render to confirm the panel is a flex-row sibling of the grid, not a position:fixed overlay."
  - test: "Panel stays open after adding a card"
    expected: "Open Treasure Cruise, type a card name in the LHS panel search, select a result, click ADD CARD. Panel remains visible, search input refocuses, QTY resets to 1, selectedCard clears, toast appears. Panel DOES NOT close. Repeat add 2-3 cards without dismissing the panel."
    why_human: "UI-SPEC Visual Regression Anchor 2 — covers the lived experience; static source inspection confirms `addToCollection` no longer calls `panelOpen = false` and the reset flow is correct, but only a browser run confirms refocus timing and feel."
  - test: "Chevron close + re-open affordance + grid reflow animation"
    expected: "Click the chevron_left close button in the panel header. Panel slides out with ~200ms ease-out transition; grid reflows to full width. A chevron_right button appears at the top-left of the grid. Click that chevron_right button; panel slides back in. Reload the page; panel-open state persists per `localStorage.tc_panel_open`."
    why_human: "Motion timing + re-open affordance position can only be confirmed visually. Source verifies the CSS transitions and x-show bindings exist."
  - test: "Precon browser full-screen drawer + decklist preview + one-click add-all"
    expected: "Click BROWSE PRECONS in the panel header. A full-screen drawer (90vw × 90vh) with dark scrim opens. Tile grid shows commander + duel_deck products, newest-first, each tile ≈240×336 with SET TYPE badge top-left and NAME/CODE/YEAR strip bottom. Click a tile; decklist preview loads (commander row sorted to top with workspace_premium badge). Click ADD ALL {N} CARDS; one toast fires with exact string `Added {N} cards from {Precon Name} to collection.`; drawer closes and panel remains open."
    why_human: "UI-SPEC Visual Regression Anchors 4 + 5 — tile grid layout, scrim backdrop, drawer sizing, and the exact toast copy are all verifiable via source, but visual fidelity (tile proportions, typography, hover states, smooth decklist preview transition) needs browser QA. Automated tests cover the state machine + undo inverse + exact toast string."
  - test: "Printing strip live-swap on click"
    expected: "Select a heavily-reprinted card (e.g. 'Lightning Bolt'). A horizontal strip of keyrune set icons appears below the selected-card preview, wrapping into multiple rows within the 360px panel. Newest printing is leftmost and active (bg-primary + blue glow). Click a different icon: selected-card image, set code, collector number, and GBP price all update in place with no page reload. No mana cost is rendered anywhere in the panel."
    why_human: "UI-SPEC Visual Regression Anchor 3. Active-state glow, wrap behaviour, and the live in-place swap require a running dev server with populated bulk data to exercise."
  - test: "Mass entry X close button visible and wired to discard()"
    expected: "Click MASS ENTRY in the panel. Header 'MASS ENTRY TERMINAL' is visible; a 32×32 X icon is right-aligned in the header. Type some rubbish into the textarea; click the X. The existing `confirm('Discard N unparsed entries?')` browser prompt appears. Click OK; the modal closes without committing to the collection."
    why_human: "Automated tests cover the button markup and @click binding to discard(); the live confirm() dialog is a browser-native prompt that can't be exercised in jsdom unit tests."
---

# Phase 8: Treasure Cruise Rapid Entry — Verification Report

**Phase Goal:** Collectors can add cards faster than they could in v1.0 — whether entering one card, picking a specific printing, or importing a whole Commander precon.

**Verified:** 2026-04-16T10:40:00Z
**Status:** human_needed (all automated checks pass; visual/motion QA required)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Success Criteria (ROADMAP.md §Phase 8)

| # | Success Criterion | Status | Evidence |
| - | ----------------- | ------ | -------- |
| 1 | LHS add panel permanent; adding does NOT dismiss; grid reflows right without reopening a modal | ✓ VERIFIED (source); ? human for visual | `src/components/add-card-panel.js:139-141` `<aside class="tc-panel-column">` with `width: 360px; flex-shrink: 0`. `addToCollection` at lines 90-107 calls `reset()` + `$nextTick` refocus; NO `panelOpen = false` in the method body. `src/screens/treasure-cruise.js:36` parent wrapper `display: flex; flex-direction: row`. `tests/add-card-panel.state.test.js` 6/6 green. `grep 'panelOpen = false' src/components/add-card-panel.js` → 0 matches. |
| 2 | BROWSE PRECONS → pick precon → view decklist → one click adds every card with toast | ✓ VERIFIED (source); ? human for visual | `src/components/add-card-panel.js:162` click handler `$store.collection.preconBrowserOpen = true; $store.collection.loadPrecons()`. `src/components/precon-browser.js:185-212` decklist preview view with ADD ALL N CARDS button. `src/stores/collection.js:389-490` `addAllFromPrecon` uses `db.transaction` + single `loadEntries()` + single `collection_add_batch` undo entry; toast fires exact string `Added N cards from {name} to collection.`. `tests/collection.precon.test.js` 6/6 green covering 99-card insert, merge duplicates, single reload, single undo, inverse correctness, exact toast string. |
| 3 | Dropdown shows thumbnail preview; user clicks paper-printing set icons to switch selected printing; price + identity update live | ✓ VERIFIED (source); ? human for visual | Dropdown thumbnail at `src/components/add-card-panel.js:211-222` — 40px img with `cf-card-img` class, `image_uris?.small`, `onerror` fallback. Printing strip at lines 249-282 with keyrune icons, wrap, newest-first sort, active-state bg-primary + glow-blue, `$store.collection.selectPrinting` dispatches `cf:printing-selected` CustomEvent that the panel listens for (`onPrintingSelected` at line 123) and patches `selectedCard.image_uris/set/collector_number/prices` in place. Live GBP re-render via `window.__cf_eurToGbp`. `tests/printings.test.js` 5/5 + `tests/printing-picker.test.js` 4/4 green. |
| 4 | Mass-entry terminal has visible X close button in header that discards the open session | ✓ VERIFIED (source); ? human for confirm() dialog | `src/components/mass-entry-panel.js:103-109` — 32×32 button, `aria-label="Close mass entry"`, Material Symbols `close` glyph, `@click="discard()"`. `discard()` body at line 80 preserves the existing `confirm('Discard N unparsed entries?')` guard. `tests/mass-entry-panel.test.js` 3/3 green. |
| 5 | Add-card modal results never render mana cost (audit confirms removed) | ✓ VERIFIED | `grep -cE 'mana[_-]?cost\|class="ms ms-\|card\.mana_cost' src/components/add-card-panel.js` returns `0`. `tests/add-card-panel.audit.test.js` 2/2 green — regression guards against both the dropdown template AND the selected-card preview region. |

**Score:** 5/5 success criteria satisfied at source level; visual + motion fidelity awaits human QA.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/components/add-card-panel.js` | Renamed from add-card-modal.js; LHS chrome; printing strip | ✓ VERIFIED | Exists (339 lines); `renderAddCardPanel` export; `<aside class="tc-panel-column">`; `width: 360px`; chevron_left close; `ADD TO COLLECTION` heading; `READY TO ARCHIVE` empty state; `BROWSE PRECONS` wired; `CLOSE PANEL` CTA; printing strip; no `renderAddCardModal` export. |
| `src/components/add-card-modal.js` | Must NOT exist (renamed) | ✓ VERIFIED | File absent — `ls` confirms. |
| `src/components/mass-entry-panel.js` | Visible X close button wired to discard() | ✓ VERIFIED | Header row wrapped in flex justify-between; X button with `aria-label="Close mass entry"`, `@click="discard()"`, 32×32, Material Symbols `close`. |
| `src/components/precon-browser.js` | Full-screen drawer with tile grid + decklist preview | ✓ VERIFIED | Exists; `renderPreconBrowser` export; 90vw × 90vh drawer; `BROWSE PRECONS` header; REFRESH + close buttons; tile grid view (`card-tile-hover`); decklist preview view with `workspace_premium` commander badge; `← BACK TO PRECONS`; ADD ALL {N} CARDS button; Escape key closes. |
| `src/services/scryfall-queue.js` | Rate-limited queue with User-Agent + 100ms spacing | ✓ VERIFIED | Module singleton promise chain; `const USER_AGENT = 'Counterflux/1.1 (MTG collection manager)'`; `MIN_DELAY_MS = 100`; throws on non-2xx; `__resetQueueForTests` test helper. |
| `src/services/precons.js` | fetchPrecons + fetchPreconDecklist + invalidatePreconsCache | ✓ VERIFIED | `PRECON_SET_TYPES = ['commander', 'duel_deck']` (D-09: starter excluded). 7-day TTL. Stale-cache fallback on fetch error. Type-line `is_commander` heuristic. ALL calls route through `queueScryfallRequest` — `grep -c "fetch(" src/services/precons.js` returns 0. |
| `src/stores/collection.js` | panelOpen, printingsByCardId, loadPrintings, selectPrinting, togglePanel, loadPrecons, selectPrecon, addAllFromPrecon | ✓ VERIFIED | All 8 new fields/methods present at the expected lines (64, 77, 78, 81, 82, 237, 260, 318, 336, 355, 389, 492, 501). `addAllFromPrecon` uses `db.transaction('rw', db.collection, async () => {...})` + one `loadEntries()` call + one `collection_add_batch` undo entry whose inverse has `{added, updated}` structured payload (Pitfall 7). |
| `src/screens/treasure-cruise.js` | Flex row [panel \| grid]; re-open affordance when panel closed | ✓ VERIFIED | Line 36: outer `display: flex; flex-direction: row`. Line 39: inline `${renderAddCardPanel()}`. Lines 42-52: re-open chevron_right button with `aria-label="Open add panel"` + `x-show="!$store.collection.panelOpen"`. Line 55: `<section class="tc-grid-column" style="flex: 1; min-width: 0; ...">`. Line 197: `${renderPreconBrowser()}` in `#tc-modals` container. No `addCardOpen` references remain — fully migrated to `panelOpen`. |
| `src/db/schema.js` | Dexie v9 declaration with precons_cache | ✓ VERIFIED | Line 392: `db.version(9).stores({ ... precons_cache: 'code, set_type, released_at, updated_at' })`. v1-v8 preserved above. No `.upgrade()` callback (additive-only per D-24). `UUID_TABLES` array at line 427 intentionally excludes `precons_cache` (string PK). |
| `src/workers/bulk-data.worker.js` | Mirror v9 declaration (PITFALLS §1) | ✓ VERIFIED | Line 147: `db.version(9).stores({...})` with `precons_cache: 'code, set_type, released_at, updated_at'` at line 162. Worker only touches cards+meta but schema-match is mandatory. |
| `src/styles/main.css` | .tc-panel-column transition + prefers-reduced-motion + .ss-fallback rule | ✓ VERIFIED | Lines 140-142: `.tc-panel-column { transition: transform 200ms ease-out, width 200ms ease-out }`. Lines 149-153: `@media (prefers-reduced-motion: reduce)` overrides. Lines 164-166: `.ss.ss-fallback::before { content: '?' }` — defence-in-depth (Pitfall 4). |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `add-card-panel.js addToCollection` | `$store.collection.addCard` | direct call; does NOT close panel | ✓ WIRED | Line 92-97: `await $store.collection.addCard(...)`; grep for `panelOpen = false` in file → 0 matches. D-01 honoured. |
| `add-card-panel.js loadPrintings path` | `scryfall-queue.queueScryfallRequest` | store.loadPrintings → queueScryfallRequest | ✓ WIRED | `src/stores/collection.js` line 260 `loadPrintings` imports + calls `queueScryfallRequest` (line 28 import). |
| `treasure-cruise.js mount()` | `renderAddCardPanel()` | render inline as left column | ✓ WIRED | Line 7 import + line 39 inline render. |
| `localStorage.tc_panel_open` | `$store.collection.panelOpen` | IIFE with null→true default | ✓ WIRED | `src/stores/collection.js:64-72` — exact Pitfall 6 pattern. |
| `add-card-panel.js BROWSE PRECONS` | `$store.collection.preconBrowserOpen = true + loadPrecons()` | @click handler | ✓ WIRED | Line 162 `@click="$store.collection.preconBrowserOpen = true; $store.collection.loadPrecons()"`. No `disabled` attribute, no "Available in Plan 3" tooltip. |
| `precons.js fetchPrecons` + `fetchPreconDecklist` | `scryfall-queue.queueScryfallRequest` | import + call | ✓ WIRED | Line 18 import; all fetches route through queue. |
| `stores/collection.js addAllFromPrecon` | `db.collection` + `db.precons_cache` | `db.transaction('rw', db.collection, ...)` + `bulkDelete` in inverse | ✓ WIRED | Line 404 transaction opens; inserts/merges inside; single `loadEntries()` at end; `collection_add_batch` undo entry with inverse at line 449-462 uses `bulkDelete(added)` + per-row restore of `prevQuantity`. |
| `schema.js v9 declaration` | `bulk-data.worker.js v9 mirror` | identical stores object | ✓ WIRED | Both declare `precons_cache: 'code, set_type, released_at, updated_at'`; schema-match confirmed. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `add-card-panel.js` search dropdown | `searchResults` | `window.__cf_searchCards(q, 8)` at line 55 → `src/db/search.js` `searchCards` (Dexie query on `db.cards`) | Yes — returns real rows from bulk-data cache with `image_uris.small`, `prices.eur`, `games`, `prints_search_uri` | ✓ FLOWING |
| `add-card-panel.js` selected-card preview | `selectedCard` | `selectCard(card)` mutation from dropdown click (line 71) + `cf:printing-selected` event listener (line 137) patching image/set/collector/prices in place | Yes — card is a real Scryfall object from `searchCards`; printing patches come from `loadPrintings` fetch against prints_search_uri | ✓ FLOWING |
| `add-card-panel.js` printings strip | `$store.collection.printingsByCardId[selectedCard.id].printings` | `loadPrintings` in collection store (line 260) — fetches `card.prints_search_uri` via scryfall-queue, filters `games.includes('paper')`, sorts DESC | Yes — fixture `tests/printings.test.js` confirms paper filter + DESC sort + pagination | ✓ FLOWING |
| `precon-browser.js` tile grid | `$store.collection.precons` | `loadPrecons` calls `fetchPrecons` in precons.js → cached in Dexie `precons_cache` with 7-day TTL → filters commander + duel_deck, sorts DESC | Yes — `tests/precons.test.js` 6/6 green covering fetch, filter, sort, TTL, stale fallback | ✓ FLOWING |
| `precon-browser.js` decklist preview | `precon.decklist` | `fetchPreconDecklist` paginates `precon.search_uri`, filters paper, infers `is_commander` via type_line heuristic | Yes — `tests/precons.test.js` Test 5 covers pagination + is_commander detection | ✓ FLOWING |
| `treasure-cruise.js` grid column | `$store.collection.entries` | `loadEntries()` call in collection store — reads `db.collection.toArray()` (Phase 7 schema) | Yes (Phase 7 verified) — `addAllFromPrecon` fires one `loadEntries()` at end of transaction | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full test suite status | `npx vitest run` | 568 passing + 10 todo + 1 failing (pre-existing `router.test.js > vandalblast`); 67 test files | ✓ PASS (only deferred failure remains) |
| Phase 8 test subset | `npx vitest run tests/{schema-v9,precons,collection.precon,add-card-panel.state,add-card-panel.dropdown,add-card-panel.audit,mass-entry-panel,printings,printing-picker,scryfall-queue}.test.js` | 45 passed / 45 total | ✓ PASS |
| Mana-cost audit on panel | `grep -cE 'mana[_-]?cost\|class="ms ms-\|card\.mana_cost' src/components/add-card-panel.js` | 0 | ✓ PASS |
| No orphaned `addCardOpen` | `grep -c addCardOpen src/screens/treasure-cruise.js` | 0 | ✓ PASS |
| No bare Scryfall fetch in precons service | `grep -c "fetch(" src/services/precons.js` | 0 | ✓ PASS |
| Dexie v9 landed on both threads | `grep -c "db.version(9)" src/db/schema.js src/workers/bulk-data.worker.js` | 1/1 | ✓ PASS |
| precons_cache excluded from UUID_TABLES | `grep UUID_TABLES src/db/schema.js` → `['collection', 'decks', 'deck_cards', 'games', 'watchlist', 'profile']` | No precons_cache | ✓ PASS |
| add-card-modal.js gone | `ls src/components/add-card-modal.js` | No such file | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| COLLECT-01 | 08-01-PLAN | Mana cost never renders in add-card modal results (audit) | ✓ SATISFIED | Mana-cost grep returns 0 on `src/components/add-card-panel.js`. `tests/add-card-panel.audit.test.js` 2/2 green. |
| COLLECT-02 | 08-03-PLAN | Browse Scryfall precon products (`commander`, `duel_deck`, ~~`starter`~~), view decklist, one-click add-all | ✓ SATISFIED (with documented scope deviation) | `src/services/precons.js` + `src/components/precon-browser.js` + `src/stores/collection.js addAllFromPrecon`. Toast fires exact string per UI-SPEC. `tests/collection.precon.test.js` 6/6 green. **Note:** REQUIREMENTS.md line 41 lists `starter` as valid; D-09 in 08-CONTEXT.md explicitly excludes starter products (pre-1999 fixed products have inconsistent Scryfall decklist data — deferred to v1.2+). This is a documented and deliberate scope tightening. |
| COLLECT-03 | 08-01-PLAN | Thumbnail preview in entry dropdown (before selection) | ✓ SATISFIED | `src/components/add-card-panel.js:211-218` 40px `cf-card-img` img with `image_uris?.small` + `onerror` fallback. `tests/add-card-panel.dropdown.test.js` 5/5 green. |
| COLLECT-04 | 08-02-PLAN | Paper printings clickable set icons; price + identity update | ✓ SATISFIED | `src/components/add-card-panel.js:249-282` printing strip; `src/stores/collection.js:260-331` loadPrintings + selectPrinting. `tests/printings.test.js` 5/5 + `tests/printing-picker.test.js` 4/4 green. |
| COLLECT-05 | 08-01-PLAN | Mass entry terminal visible X close wired to `discard()` | ✓ SATISFIED | `src/components/mass-entry-panel.js:103-109`. `tests/mass-entry-panel.test.js` 3/3 green. |
| COLLECT-06 | 08-02-PLAN | Add-to-collection converts to permanent LHS pop-out; grid reflows; user adds multiple cards without dismissing | ✓ SATISFIED | `src/components/add-card-panel.js` (renamed from modal); `src/screens/treasure-cruise.js:36-55` flex row layout; `src/stores/collection.js:64-72 + 237-244` panelOpen + togglePanel. `tests/add-card-panel.state.test.js` 6/6 green. |

**Orphaned requirements:** None — all 6 COLLECT requirements from REQUIREMENTS.md §Treasure Cruise are claimed by Plan 1/2/3 and satisfied in the codebase. REQUIREMENTS.md mapping table (line 141-146) maps COLLECT-01..06 → Phase 8; every ID is accounted for.

**Minor scope deviation:** REQUIREMENTS.md COLLECT-02 lists `starter` as a valid set_type. Plan 3 (via 08-CONTEXT.md D-09) deliberately excludes `starter` because pre-1999 fixed products have inconsistent decklist data on Scryfall. This is documented and tracked; exclude-list enforced in `src/services/precons.js:23` and asserted by `tests/fixtures/scryfall-precons.js` (`w17 Welcome Deck 2017` set_type:starter is included in the fixture to verify it's filtered out).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| _none material to Phase 8_ | — | — | — | Phase 8 source files have no TODO/FIXME/placeholder comments, no empty `=>` functions, no console-log-only implementations, no `return null` stubs. |
| `src/screens/treasure-cruise.js` (pre-existing) | multiple | Hard-coded hex colours (`#EAECEE`, `#7A8498`, `#1C1F28`) alongside `var(--color-*)` tokens in the grid-column markup below line 57 | ℹ️ Info | Inherited from Phase 6/7; NOT in Phase 8 scope (CONTEXT Plan 2 step 1 explicitly said "existing header, grid, empty state markup stays here"). Phase 8 only added token-based styles to the new LHS panel surface. |
| `tests/router.test.js > vandalblast` | Alpine | `Alpine.data` undefined in test harness | ⚠️ Warning (pre-existing) | Documented in `deferred-items.md`; reproduced on a stash; NOT caused by Phase 8. Treasure Cruise surfaces unaffected. Unhandled Promise rejections from precon-browser templates touching `$store.collection.precons.length` before the store is initialised are surfaced as console noise during that same test — symptom of the same Alpine-less-test-env root cause. |

### Human Verification Required

Six items need browser QA — see frontmatter `human_verification` block. These are visual fidelity and motion-timing checks that jsdom cannot exercise:

1. **LHS panel pushes grid (not overlay)** — UI-SPEC Visual Regression Anchor 1.
2. **Panel stays open across adds** — UI-SPEC Anchor 2 (adds 2-3 cards without dismissing).
3. **Close/re-open chevron animation + localStorage persistence through reload** — UI-SPEC Anchor 1 + 2 motion.
4. **Precon browser full-screen drawer + toast copy verbatim** — UI-SPEC Anchors 4 + 5.
5. **Printing strip wrap + active-state glow + live swap** — UI-SPEC Anchor 3.
6. **Mass-entry confirm() dialog flow** — browser-native prompt jsdom cannot exercise.

### Gaps Summary

No gaps. Phase 8 is feature-complete at the source level:
- All 6 COLLECT requirement IDs are implemented with passing tests.
- All 5 ROADMAP success criteria are satisfied at source level; browser-level verification is the remaining gate.
- Dexie v9 lands additively; Phase 7 v5-to-v8 migration chain preserved (`tests/migration-v5-to-v7.test.js` 12/12 + `tests/schema-rename-spike.test.js` 3/3 still green).
- Scryfall compliance: User-Agent `Counterflux/1.1 (MTG collection manager)` + 100ms minimum spacing enforced in `src/services/scryfall-queue.js`; consumed by `sets.js`, `precons.js`, and the printings flow. `precons.js` has zero bare fetch calls.
- Only remaining test failure is the pre-existing, fully-documented `tests/router.test.js > vandalblast` (captured in `deferred-items.md`).

The phase graduates to `human_needed` status rather than `passed` only because visual layout and motion fidelity (UI-SPEC Visual Regression Anchors 1-5) cannot be programmatically confirmed. If manual QA confirms the six items above, Phase 8 is fully complete.

---

_Verified: 2026-04-16T10:40:00Z_
_Verifier: Claude (gsd-verifier)_
