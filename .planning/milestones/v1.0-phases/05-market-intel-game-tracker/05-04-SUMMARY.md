---
phase: 05-market-intel-game-tracker
plan: 04
subsystem: ui
tags: [alpine, sparkline, watchlist, price-alerts, context-menu, market-movers]

requires:
  - phase: 05-01
    provides: market store, price-history service, sparkline utility, Dexie v5 schema
provides:
  - Watchlist panel with sparklines, trend indicators, and inline alert editing
  - Market movers panel with gainers/losers two-column layout
  - Watch Price context menu integration on all card tiles
  - Watch Price button in card detail flyout (D-08)
  - Alert badge on topbar bell and sidebar Preordain icon
affects: [05-03, 05-05, 05-07]

tech-stack:
  added: []
  patterns:
    - Alpine.data() registration for complex panel state (watchlistPanelData, watchlistEntry)
    - Inline edit pattern for alert thresholds (click-to-edit with select + input)

key-files:
  created:
    - src/components/watchlist-panel.js
    - src/components/movers-panel.js
  modified:
    - src/components/context-menu.js
    - src/components/topbar.js
    - src/components/sidebar.js
    - index.html

key-decisions:
  - "Watchlist entry uses per-row Alpine.data with async card lookup for isolated state"
  - "Sparkline period toggles are per-entry, not global, for flexible comparison"
  - "Alert badge on sidebar uses small red dot (8px) vs topbar badge with count number"

patterns-established:
  - "Alpine.data watchlistEntry pattern: per-row async init with db.cards lookup"
  - "Inline edit pattern: click label to show input/select, Enter/blur saves, Escape cancels"

requirements-completed: [MRKT-03, MRKT-04, MRKT-05]

duration: 8min
completed: 2026-04-09
---

# Phase 5 Plan 4: Watchlist and Market Movers Summary

**Watchlist panel with sparklines and inline alert editing, market movers two-column layout, Watch Price context menu and flyout button, and alert badge wiring**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-09T07:37:33Z
- **Completed:** 2026-04-09T07:45:58Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Watchlist panel renders card list with sparkline charts (7D/30D/90D), GBP prices, trend indicators, and inline alert threshold editing
- Market movers panel shows TOP GAINERS and TOP LOSERS in two-column grid with period toggles (24H/7D/30D)
- "Watch Price" added to global context menu and card detail flyout (D-08 compliance)
- Alert badges wired on topbar notification bell (count) and sidebar Preordain icon (dot)

## Task Commits

Each task was committed atomically:

1. **Task 1: Watchlist panel with sparklines, alerts, and inline editing** - `eb9ced8` (feat)
2. **Task 2: Movers panel, context menu Watch Price, flyout Watch button, and alert badges** - `9a1955d` (feat)

## Files Created/Modified
- `src/components/watchlist-panel.js` - Watchlist panel with search, sparklines, trend indicators, inline alert config, remove
- `src/components/movers-panel.js` - Market movers two-column layout with period toggles
- `src/components/context-menu.js` - Added "Watch Price" menu item before remove action
- `src/components/topbar.js` - Bell click navigates to Preordain watchlist, alertBadgeCount reference
- `src/components/sidebar.js` - hasAlertBadge helper for Preordain nav item
- `index.html` - WATCH PRICE flyout button, topbar badge with count, sidebar icon badge dot

## Decisions Made
- Watchlist entry uses per-row Alpine.data with async card lookup rather than a global lookup cache, keeping each row isolated and reactive
- Sparkline period toggles are per-entry rather than global, allowing users to compare different timeframes across watched cards
- Alert badge on sidebar uses a small 8px red dot (subtle) while topbar bell shows the actual count number (more prominent)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Watchlist and movers panels ready for integration into Preordain screen layout (05-03 or 05-05)
- Context menu Watch Price and flyout button available globally
- Alert badges reactive to store state changes

## Self-Check: PASSED

- All created files exist on disk
- Both task commits verified (eb9ced8, 9a1955d)
- All acceptance criteria confirmed via grep

---
*Phase: 05-market-intel-game-tracker*
*Completed: 2026-04-09*
