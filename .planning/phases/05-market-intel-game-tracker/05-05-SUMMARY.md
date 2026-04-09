---
phase: 05-market-intel-game-tracker
plan: 05
subsystem: game-tracker
tags: [alpine, game-tracking, commander, life-totals, long-press, mobile-responsive]

requires:
  - phase: 05-market-intel-game-tracker
    provides: "Game store with setup/active/summary lifecycle, game-stats utility"
  - phase: 01-foundation-data-layer
    provides: "Navigation shell, Alpine stores, Dexie schema, CSS utilities"
provides:
  - "Vandalblast screen replacing empty state with game setup + active game views"
  - "Game setup form with deck selector, starting life, opponents management"
  - "Player card grid (2x2 desktop, single column mobile) with life/poison/tax/commander damage"
  - "Long-press acceleration for life adjustments (1/5/10 tiers)"
  - "Phase 5 CSS utilities (tab-active, player-border, lethal-highlight, badge-new, badge-alert)"
affects: [05-market-intel-game-tracker]

tech-stack:
  added: []
  patterns: ["Long-press via pointerdown/pointerup with 400ms initial delay then 200ms repeat", "Player grid uses x-for with imperative wireLifeButtons via x-init/$nextTick", "renderPlayerGrid exposed as global window.wireLifeButtons for Alpine template access"]

key-files:
  created:
    - src/components/game-setup.js
    - src/components/player-card.js
    - src/components/life-adjuster.js
    - src/components/commander-damage-tracker.js
  modified:
    - src/screens/vandalblast.js
    - src/styles/utilities.css
    - tests/router.test.js

key-decisions:
  - "Player grid uses x-for with dynamic wireLifeButtons rather than static per-player card rendering"
  - "Commander damage tracker inlined in player-card.js x-for expansion rather than separate component call per index"
  - "Tax displays cast count and computed cost (count * 2) inline"

patterns-established:
  - "Long-press pattern: setupLongPress(button, callback) returns cleanup function; 400ms initial then 200ms repeat with getIncrement acceleration"
  - "Player card expand/collapse via $store.game.expandedPlayer reactive binding"

requirements-completed: [GAME-01, GAME-02, GAME-03, GAME-04, GAME-05, GAME-13]

duration: 8min
completed: 2026-04-09
---

# Phase 5 Plan 05: Vandalblast Game Tracker Core UI Summary

**Vandalblast screen with game setup form, 2x2 player card grid, life/poison/tax tracking with long-press acceleration, and commander damage expand panel**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-09T07:42:06Z
- **Completed:** 2026-04-09T07:50:34Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

### Task 1: Vandalblast screen layout, game setup form, and view switching
- Replaced empty state with full Vandalblast screen
- Added ACTIVE GAME / HISTORY view toggle with tab-active/tab-inactive CSS
- Created game-setup.js with deck selector dropdown, manual commander input, starting life, opponent management, and Start Game CTA
- Mobile responsive: back button and hidden overline at < 768px
- **Commit:** d192c70

### Task 2: Player card grid with life adjuster, commander damage, poison, and tax
- Created life-adjuster.js with setupLongPress using pointerdown/pointerup events and getIncrement acceleration
- Created commander-damage-tracker.js with lethal highlight at 21+ damage
- Created player-card.js with renderPlayerCard and renderPlayerGrid
- Player grid: 2x2 desktop (md:grid-cols-2), single column mobile, 80px bottom padding for floating toolbar
- Life total display at 48px with scale animation on change
- Poison highlights at >= 10, commander damage highlights at >= 21
- Tax shows cast count and computed cost (count * 2)
- Additional counters section in expanded state
- TAP FOR DETAILS mobile hint
- **Commit:** 9554e35

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated router test for new vandalblast screen**
- **Found during:** Task 1
- **Issue:** Existing test expected "Game Tracker Coming Soon" text from the old empty state
- **Fix:** Updated test to check for new screen content (VANDALBLAST // GAME TRACKER, ACTIVE GAME, HISTORY, NEW GAME, Start Game) using innerHTML instead of textContent (Alpine template elements don't expose content via textContent in jsdom)
- **Files modified:** tests/router.test.js
- **Commit:** d192c70

## Verification

- All 350 tests pass (30 test files, 2 skipped, 10 todo)
- Vandalblast screen contains VANDALBLAST // GAME TRACKER and does NOT contain Coming Soon
- Game setup form exports renderGameSetup with all required labels and bindings
- Player card exports renderPlayerCard and renderPlayerGrid with all required features
- Life adjuster exports setupLongPress with getIncrement import and pointer events
- Commander damage tracker exports renderCommanderDamageTracker with lethal highlight

## Known Stubs

None -- all data flows are wired to the game store. Post-game summary and history views have placeholder UI clearly marked for Plan 07.

## Self-Check: PASSED
