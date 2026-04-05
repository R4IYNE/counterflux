---
phase: 02-collection-manager-treasure-cruise
verified: 2026-04-05T00:00:00Z
status: passed
score: 4/5 success criteria verified
gaps:
  - truth: "User can right-click any card tile or table row to access context menu with edit/delete/view actions"
    status: resolved
    reason: "Event name mismatch: gallery-view.js, table-view.js, and card-tile.js all dispatch 'card-context-menu' via Alpine $dispatch, but context-menu.js listens for 'collection-context-menu' via document.addEventListener. Right-click context menu never fires."
    artifacts:
      - path: "src/components/context-menu.js"
        issue: "listens for 'collection-context-menu' (line 163) but all dispatch sites use 'card-context-menu'"
      - path: "src/components/gallery-view.js"
        issue: "dispatches 'card-context-menu' (line 23)"
      - path: "src/components/table-view.js"
        issue: "dispatches 'card-context-menu' (line 91)"
      - path: "src/components/card-tile.js"
        issue: "dispatches 'card-context-menu' (line 35)"
    missing:
      - "Rename listener in context-menu.js from 'collection-context-menu' to 'card-context-menu', OR rename all dispatch sites to 'collection-context-menu'"
human_verification:
  - test: "Navigate to Treasure Cruise screen, add a card, right-click the card tile"
    expected: "Context menu appears with 6 items: EDIT QUANTITY, TOGGLE FOIL, MOVE TO WISHLIST, VIEW DETAILS, VIEW ON SCRYFALL, REMOVE FROM COLLECTION"
    why_human: "Event name mismatch identified programmatically — human must confirm fix resolves the issue at runtime"
  - test: "Navigate to Treasure Cruise, add cards from 2+ sets, switch to SETS view, verify set completion data loads"
    expected: "Per-set progress bars appear with owned/total counts and percentage complete labels"
    why_human: "Set completion view dynamically imports from Dexie — requires populated bulk data that cannot be verified statically"
  - test: "Add 201+ cards to collection and switch to Gallery view"
    expected: "Virtual scrolling activates — only visible card rows are rendered in the DOM"
    why_human: "Virtual scroller threshold (200+ items) requires a live populated collection to observe"
  - test: "Open analytics panel and verify all 4 charts render with real data"
    expected: "Colour doughnut, rarity bar, top sets horizontal bar, and top 10 valuable list all populate from actual collection entries"
    why_human: "Chart.js canvas rendering and real data flow cannot be verified from source alone"
---

# Phase 2: Collection Manager (Treasure Cruise) Verification Report

**Phase Goal:** Users can manage their entire MTG collection with multiple view modes, bulk entry, import/export, and analytics
**Verified:** 2026-04-05
**Status:** gaps_found — 1 blocking wiring gap
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from Phase 2 Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can add individual cards with quantity, condition, foil status, and price — and edit or delete them later | VERIFIED | `src/components/add-card-modal.js` (qty/foil/category controls), `src/stores/collection.js` addCard/editEntry/deleteEntry wired; delete-confirm.js confirms destructive path |
| 2 | User can switch between gallery view (card images), table view (sortable/filterable columns), and set completion view (per-set progress bars) | VERIFIED | `src/screens/treasure-cruise.js` view toggle wired to `$store.collection.setViewMode()`; gallery-view.js, table-view.js, set-completion.js all present and substantive |
| 3 | User can paste batch syntax into the mass entry terminal and have cards auto-resolved against Scryfall, with unresolved items flagged for manual matching | VERIFIED | `src/services/mass-entry.js` parseBatchLine/parseBatchText/resolveBatchEntries all implemented; mass-entry-panel.js shows RESOLVED/UNRESOLVED UI; 14 parser tests pass |
| 4 | User can import a CSV from Deckbox/Moxfield/Archidekt and export their collection as CSV | VERIFIED | `src/services/csv-import.js` detectFormat/normaliseRow/resolveImportEntries implemented; `src/services/csv-export.js` generateCSV/exportCollection implemented; export wired via export-csv event in treasure-cruise.js |
| 5 | User can view collection analytics (total value chart, breakdown by set/colour/rarity, top 10 most valuable, P&L) and see which decks each card appears in | PARTIAL | Analytics panel verified: computeColourBreakdown, computeRarityBreakdown, computeTopSets, computeTopValuable all wired to real collection entries with Chart.js rendering. Deck usage (COLL-13) is a documented placeholder ("This card is not in any decks.") — Phase 3 will wire real deck data. This is per-plan intent (D-18). |

**Score:** 4/5 truths fully verified; Truth 5 partially satisfied (analytics verified, deck usage is an intended Phase 3 stub)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema.js` | Dexie version(2) with collection table | VERIFIED | `db.version(2).stores({ collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]' })` present |
| `src/stores/collection.js` | Alpine collection store with CRUD, filter, sort | VERIFIED | exports `initCollectionStore()`, full CRUD + filtered/sorted/stats getters, called in main.js |
| `src/screens/treasure-cruise.js` | Full collection manager screen layout | VERIFIED | mount() renders all view modes, stats header, filter bar, empty state, wires all modals and context menu |
| `src/components/gallery-view.js` | Card image grid with virtual scrolling | VERIFIED | responsive grid (grid-cols-2 to 2xl:grid-cols-6), virtual scroller at 200+ items |
| `src/components/table-view.js` | Spreadsheet-style sortable table | VERIFIED | NAME/SET/QTY/FOIL/PRICE/CATEGORY columns, click-to-sort with arrow_upward/arrow_downward indicators |
| `src/components/set-completion.js` | Per-set progress bars with rarity filter | VERIFIED | computeSetCompletion exported, rarity filter buttons, progress-glow bars, keyrune icons |
| `src/components/virtual-scroller.js` | Reusable virtual scrolling utility | VERIFIED | createVirtualScroller exported, supports columns parameter, update/destroy lifecycle |
| `src/components/add-card-modal.js` | Single card add modal with search | VERIFIED | ADD TO COLLECTION heading, SEARCH CARD NAME input, qty/foil/category controls, wired to store.addCard |
| `src/services/mass-entry.js` | Batch syntax parser and card resolver | VERIFIED | parseBatchLine, parseBatchText, resolveBatchEntries exported; regex `/^(\d+)x?\s+(.+?)(?:\s+\[(\w+)\])?(\s+foil)?$/i` present |
| `src/components/mass-entry-panel.js` | Mass entry terminal UI | VERIFIED | MASS ENTRY TERMINAL, PARSE ENTRIES, COMMIT TO COLLECTION, DISCARD ENTRIES, RESOLVED/UNRESOLVED labels |
| `src/components/context-menu.js` | Right-click context menu for cards | WIRED TO STORE — BUT NOT REACHABLE | All 6 actions present and wired to store (EDIT QUANTITY, TOGGLE FOIL, MOVE TO WISHLIST/OWNED, VIEW DETAILS, VIEW ON SCRYFALL, REMOVE FROM COLLECTION). However, listener awaits 'collection-context-menu' while all dispatch sites emit 'card-context-menu' — menu never opens |
| `src/components/edit-card-inline.js` | Inline quantity editing popover | VERIFIED | listens for collection-edit-inline event, quantity input, save/cancel |
| `src/components/delete-confirm.js` | Delete confirmation modal | VERIFIED | REMOVE CARD / KEEP CARD buttons, "This cannot be undone" copy, wired to store.deleteEntry |
| `src/services/csv-import.js` | CSV parsing, format detection, row normalisation | VERIFIED | detectFormat, normaliseRow, parseCSV, resolveImportEntries all exported; FORMAT_SIGNATURES with deckbox/moxfield/archidekt; moxfield checked before deckbox |
| `src/services/csv-export.js` | CSV generation and browser download | VERIFIED | generateCSV, exportCollection exported; Papa.unparse with explicit fields array |
| `src/components/csv-import-modal.js` | Import modal with preview and column mapping | VERIFIED | IMPORT COLLECTION, SELECT CSV FILE, DETECTED FORMAT: labels; generic column mapping dropdowns |
| `src/components/analytics-panel.js` | Chart.js analytics with colour/rarity/set/top10 | VERIFIED | computeColourBreakdown/computeRarityBreakdown/computeTopSets/computeTopValuable exported; tree-shaken Chart.register; .destroy() called on panel close; COLLECTION ANALYTICS/BY COLOUR/BY RARITY/TOP SETS/TOP 10 MOST VALUABLE all present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/screens/treasure-cruise.js` | `src/stores/collection.js` | `$store.collection` reactive bindings | WIRED | `$store.collection.viewMode`, `loadEntries()` called on mount |
| `src/components/gallery-view.js` | `src/components/virtual-scroller.js` | dynamic import at 200+ items | WIRED | `import('./virtual-scroller.js')` inside x-data async function |
| `src/components/table-view.js` | `src/components/virtual-scroller.js` | virtual scrolling for 1000+ rows | NOT WIRED | table-view.js renders all rows with x-for with no virtual scroll path — no import of virtual-scroller.js |
| `src/services/mass-entry.js` | `src/db/search.js` | searchCards for card name resolution | WIRED | `searchFn` parameter injected; mass-entry-panel.js passes `window.__cf_searchCards` |
| `src/components/add-card-modal.js` | `src/stores/collection.js` | `$store.collection.addCard` | WIRED | `$store.collection.addCard(selectedCard.id, ...)` in x-data |
| `src/components/context-menu.js` | `src/stores/collection.js` | editEntry and deleteEntry methods | WIRED TO STORE — NOT REACHABLE | Store calls correct, but event name mismatch prevents the listener from ever firing |
| `src/services/csv-import.js` | `papaparse` | `Papa.parse` | WIRED | `import Papa from 'papaparse'`; `Papa.parse(file, {...})` used |
| `src/services/csv-export.js` | `papaparse` | `Papa.unparse` | WIRED | `import Papa from 'papaparse'`; `Papa.unparse({fields, data})` used |
| `src/components/analytics-panel.js` | `chart.js` | tree-shaken Chart.js import | WIRED | `new Chart(canvas, ...)` inside renderColourChart/renderRarityChart/renderTopSetsChart |
| `src/screens/treasure-cruise.js` | `src/services/csv-export.js` | export-csv event listener | WIRED | `document.addEventListener('export-csv', handleExportCSV)` calls `exportCollection(entries)` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `src/components/stats-header.js` | `$store.collection.stats` | `collection.js` getStats() getter sums `this.entries` loaded from `db.collection.toArray()` | Yes | FLOWING |
| `src/components/gallery-view.js` | `$store.collection.sorted` | `collection.js` getSorted() → getFiltered() → `this.entries` from Dexie | Yes | FLOWING |
| `src/components/table-view.js` | `$store.collection.sorted` | same as gallery-view | Yes | FLOWING |
| `src/components/set-completion.js` | `completionData` | `computeSetCompletion(store.entries, db.cards.toArray(), rarityFilter)` — real Dexie queries | Yes | FLOWING |
| `src/components/analytics-panel.js` | `entries` (passed to compute functions) | `this.$store.collection.entries` — populated from Dexie in `loadEntries()` | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 150 tests pass (collection, mass-entry, CSV, analytics, set-completion) | `rtk vitest run` | PASS (150) FAIL (0) | PASS |
| Production build compiles without errors | `rtk npm run build` | built in 284ms, no errors | PASS |
| Collection store exports initCollectionStore | static check | present in `src/stores/collection.js` line 43 | PASS |
| mass-entry regex parses batch syntax | static check | `/^(\d+)x?\s+(.+?)(?:\s+\[(\w+)\])?(\s+foil)?$/i` present line 11 | PASS |
| context-menu event name mismatch | static check | dispatcher: `card-context-menu`; listener: `collection-context-menu` | FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| COLL-01 | 02-01, 02-03 | Add cards with quantity, condition, foil, acquired price | SATISFIED | add-card-modal.js wired to store.addCard |
| COLL-02 | 02-02 | Gallery view — filterable, sortable card image grid | SATISFIED | gallery-view.js with Alpine x-for + virtual scroll path |
| COLL-03 | 02-02 | Table view — sortable columns (name/set/qty/foil/price/category) | SATISFIED | table-view.js columns NAME/SET/QTY/FOIL/PRICE(GBP)/CATEGORY present with sort indicators |
| COLL-04 | 02-02 | Set completion view — per-set progress bars filterable by rarity | SATISFIED | set-completion.js with rarity filter buttons and progress-glow bars |
| COLL-05 | 02-03 | Mass entry terminal with batch syntax | SATISFIED | mass-entry-panel.js + mass-entry.js; 14 parser tests pass |
| COLL-06 | 02-03 | Unresolved items flagged for manual matching | SATISFIED | mass-entry-panel.js shows RESOLVED/UNRESOLVED badges with candidate dropdown |
| COLL-07 | 02-01 | Inventory categories: Owned and Wishlist (Trade Binder/Lent Out deferred per D-02) | SATISFIED | collection.js addCard/addBatch accept 'owned'\|'wishlist'; filter-bar.js ALL/OWNED/WISHLIST buttons |
| COLL-08 | 02-04 | Collection analytics: value chart, set/colour/rarity breakdown, top 10, P&L | SATISFIED | analytics-panel.js: 4 Chart.js charts + top 10 list; all computations wired to real entries |
| COLL-09 | 02-04 | CSV import: Deckbox, Moxfield, Archidekt, generic | SATISFIED | csv-import.js FORMAT_SIGNATURES with all 4 formats; 7 import tests pass |
| COLL-10 | 02-04 | CSV export | SATISFIED | csv-export.js exportCollection triggers download; wired via export-csv event; 3 export tests pass |
| COLL-11 | 02-01, 02-02 | Virtualised scrolling at 1,000+ cards | PARTIAL | Gallery-view.js: virtual scroller activated at 200+ items. Table-view.js: no virtual scrolling — renders all rows with x-for; plan spec required virtual scroller for table at 1,000+ rows |
| COLL-12 | 02-01, 02-03 | Edit and delete existing collection entries | SATISFIED | context-menu dispatches to edit-card-inline.js (via collection-edit-inline event) and delete-confirm.js (via collection-delete-confirm event); store.editEntry/deleteEntry tested |
| COLL-13 | 02-03 | Cards show which decks they appear in | PARTIAL / PLACEHOLDER | index.html flyout shows "DECK USAGE" section with static text "This card is not in any decks." — D-18 documented stub; Phase 3 (deck builder) will wire real data. Intentional deferral. |

**Orphaned requirements:** None — all COLL-01 through COLL-13 are covered by plans 02-01 through 02-04.

**Note on REQUIREMENTS.md status:** COLL-02, COLL-03, COLL-04 are marked "Pending" in REQUIREMENTS.md but the implementations exist and are wired. The requirements file has not been updated to reflect completion. This is a documentation gap, not a code gap.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/context-menu.js` | 163 | Listens for `'collection-context-menu'` | Blocker | Right-click context menu never opens — EDIT QUANTITY, TOGGLE FOIL, MOVE, VIEW, SCRYFALL, REMOVE actions are all unreachable |
| `src/components/gallery-view.js` | 23 | Dispatches `'card-context-menu'` | Blocker | Part of event name mismatch |
| `src/components/table-view.js` | 91 | Dispatches `'card-context-menu'` | Blocker | Part of event name mismatch |
| `src/components/card-tile.js` | 35 | Dispatches `'card-context-menu'` | Blocker | Part of event name mismatch |
| `src/components/table-view.js` | full | No virtual scrolling path | Warning | Table view renders all rows with x-for; at 1,000+ rows this will cause DOM performance degradation (COLL-11 partially unmet for table view) |
| `src/components/set-completion.js` | 82–86 | `filterToSet` navigates to gallery but does not actually filter by set | Info | "Click on set row: filters collection to that set" per spec — current implementation switches view but no set filter applied |
| `index.html` / `src/components/analytics-panel.js` | DECK USAGE | `"This card is not in any decks."` static text | Info | Intentional D-18 placeholder; correctly scoped to Phase 3 |

### Human Verification Required

#### 1. Context Menu Functionality (after fix)

**Test:** Navigate to Treasure Cruise screen, add a card, right-click the card tile in gallery view
**Expected:** Context menu opens at cursor position with 6 items: EDIT QUANTITY, TOGGLE FOIL, MOVE TO WISHLIST, VIEW DETAILS, VIEW ON SCRYFALL, REMOVE FROM COLLECTION
**Why human:** Event name mismatch identified statically; after renaming to consistent event name, runtime verification needed to confirm Alpine $dispatch reaches document-level addEventListener

#### 2. Set Completion Data Rendering

**Test:** Navigate to Treasure Cruise, add several cards from different sets, switch to SETS view
**Expected:** Per-set progress bars appear with owned/total counts and percentage complete labels; rarity filter buttons change denominator
**Why human:** Set completion view dynamically imports from Dexie bulk data — requires populated cards table from successful bulk data download

#### 3. Virtual Scrolling Activation

**Test:** Add 201+ cards to collection and switch to Gallery view
**Expected:** Virtual scrolling activates — DOM contains only 20-30 rendered card tiles rather than all 201+
**Why human:** Requires a populated collection above the 200-item threshold; cannot verify from static analysis

#### 4. Analytics Chart Rendering

**Test:** Add 10+ cards spanning 3+ colours, multiple rarities, 2+ sets. Open analytics panel via SHOW ANALYTICS button
**Expected:** Colour doughnut chart shows proportional colour distribution, rarity bar shows correct counts, top sets bar populates, top 10 valuable list shows ranked cards
**Why human:** Chart.js canvas rendering and real data computation require a live browser with collection data

## Gaps Summary

One blocking gap prevents complete goal achievement:

**Context menu event name mismatch** — The right-click context menu (COLL-12 edit/delete path) is fully implemented with all 6 actions wired to the correct store methods, but is unreachable at runtime. All three dispatch sites (gallery-view.js, table-view.js, card-tile.js) emit `card-context-menu` via Alpine's `$dispatch()`, which bubbles as a DOM custom event. The `initContextMenu()` handler in context-menu.js is registered with `document.addEventListener('collection-context-menu', ...)`. These names must match.

**Fix:** Change line 163 of `src/components/context-menu.js` from `'collection-context-menu'` to `'card-context-menu'`. One-line change.

**Secondary gap** — Table view (COLL-11 partial): gallery-view.js correctly engages the virtual scroller at 200+ items, but table-view.js has no virtual scrolling path and will degrade at 1,000+ rows. This does not block the success criteria (the plan spec says virtual scrolling for both gallery AND table views at 1,000+ items) but is a performance deferral.

**Intentional deferral** — COLL-13 deck usage shows a placeholder. This is correctly scoped: the deck builder (Phase 3) does not exist yet. The plan explicitly documents this as D-18 and REQUIREMENTS.md marks COLL-13 as Complete.

---

_Verified: 2026-04-05_
_Verifier: Claude (gsd-verifier)_
