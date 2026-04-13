---
plan: 03-06
phase: 03-deck-builder-thousand-year-storm
status: complete
started: 2026-04-05
completed: 2026-04-06
---

## Summary

Final integration plan: unlocked Thousand-Year Storm in sidebar navigation, wired SortableJS drag-to-deck from search results, added COLL-13 deck usage cross-reference in card flyout.

## Verification Fixes Applied

Extensive fixes during human verification (11-point checklist):

### Critical Fixes
- **Routing bug**: `deck-open` handler set `window.location.hash` to unregistered routes, causing Navigo `notFound` redirect — removed hash changes
- **Chart.js blank**: Registered `DoughnutController`, `BarController`, `ArcElement`, `BarElement`, `CategoryScale`, `LinearScale`, `Tooltip` for deck analytics
- **Centre panel not updating**: Replaced 500ms polling with `Alpine.effect()` watching `store.activeCards`
- **COLL-13 flyout broken**: Dynamic `import('./src/db/schema.js')` in inline Alpine expression failed silently — exposed `db` via `window.__cf_db`

### Feature Additions (from verification feedback)
- Auto-add commander (+ partner/companion) to deck on ritual creation
- WUBRG colour filter with mana-font icons (default all ticked, untick to exclude)
- Category filter dropdown in search panel
- Browse cards on mount without typing (paginated scanning up to 5000 cards)
- Filter Alchemy (A-) prefix cards from search/browse
- Renamed "Functional Tags" → "Categories", aligned with Archidekt's 18 auto-categories
- Stripped tag manager to read-only display (removed add/delete/rename/reorder)
- Fixed card tile tag overflow in grid view
- Added `recategorizeAll()` to deck store

## Key Files

### Created
- (none — this plan modified existing files)

### Modified
- `src/screens/thousand-year.js` — removed hash-based routing
- `src/stores/app.js` — unlocked Thousand-Year Storm (`locked: false`)
- `src/components/deck-search-panel.js` — drag-to-deck, colour/category filters, browse on mount
- `src/components/deck-analytics-panel.js` — Chart.js registration, renamed to Categories
- `src/components/deck-centre-panel.js` — Alpine.effect() reactivity
- `src/components/deck-card-tile.js` — overflow fix
- `src/components/deck-editor.js` — removed tag manager section
- `src/components/deck-context-menu.js` — renamed tag header to Category
- `src/components/tag-manager.js` — read-only DEFAULT_TAGS display
- `src/components/ritual-modal.js` — auto-add commander to deck
- `src/db/search.js` — browseCards(), A- filter, category filter in browse loop
- `src/utils/tag-heuristics.js` — expanded to 18 Archidekt-aligned categories
- `src/stores/deck.js` — recategorizeAll() method
- `src/main.js` — expose db globally
- `index.html` — flyout deck usage via window.__cf_db

## Deviations

- **D-01**: Extensive verification fixes beyond original plan scope — routing, reactivity, Chart.js, and UI polish issues discovered during 11-point human UAT
- **D-02**: Categories expanded from 8 to 18 to align with Archidekt conventions (user request during verification)
- **D-03**: Tag manager stripped to read-only (user clarified tags are immutable category labels)

## Self-Check: PASSED
