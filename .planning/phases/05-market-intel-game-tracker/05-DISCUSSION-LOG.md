# Phase 5: Market Intel + Game Tracker - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-08
**Phase:** 05-market-intel-game-tracker
**Areas discussed:** Game Tracker layout, Price watchlist & alerts, Spoiler browser & calendar, Game history & stats

---

## Game Tracker Layout

### Player Display

| Option | Description | Selected |
|--------|-------------|----------|
| Grid of player cards | 2x2 grid (flexible for 3-6 players). Each player gets a large card showing life total, commander damage, poison, counters. Tapping expands for adjustments. | ✓ |
| Vertical list | Stacked rows, one per player. Expandable details. Scrollable for 5-6 players. | |
| Hybrid | Desktop grid, mobile vertical list. More implementation work. | |

**User's choice:** Grid of player cards
**Notes:** None — clean pick.

### Life Total Adjustments

| Option | Description | Selected |
|--------|-------------|----------|
| +/- buttons with long-press | Tap for ±1, hold 1s for ±5, hold 2s for ±10. Simple and universal. | ✓ |
| Swipe gestures | Swipe up/down on life number. Fluid but accessibility concerns. | |
| Number pad popup | Tap number to open numpad. Precise but extra tap for small changes. | |

**User's choice:** +/- buttons with long-press
**Notes:** None.

### Commander Damage Access

| Option | Description | Selected |
|--------|-------------|----------|
| Expand within player card | Tap player card to expand, revealing commander damage trackers per opponent. | ✓ |
| Dedicated damage matrix | Separate NxN matrix view. Complete overview but navigates away. | |
| Opponent icons on card | Small icons along bottom of each card. Compact but crowded with 5+ players. | |

**User's choice:** Expand within player card
**Notes:** None.

### Game Tools Access

| Option | Description | Selected |
|--------|-------------|----------|
| Floating toolbar | Persistent bottom toolbar with dice, coin, turn counter, more menu. | ✓ |
| Side drawer | Swipe-in drawer from right. Clean main view but hidden. | |
| Inline per-player | Each player card has its own tools. Contextual but duplicated. | |

**User's choice:** Floating toolbar
**Notes:** None.

---

## Price Watchlist & Alerts

### Price Data Source

| Option | Description | Selected |
|--------|-------------|----------|
| Scryfall bulk data only | Use existing daily EUR prices. Store daily snapshots for sparklines. Zero API cost, offline. | ✓ |
| Scryfall API for watchlist | Bulk data general + API for watchlist items. Fresher but more API calls. | |
| External price API | Dedicated price API (MTGStocks, TCGPlayer). Most accurate but adds dependency. | |

**User's choice:** Scryfall bulk data only
**Notes:** None.

### Alert Notifications

| Option | Description | Selected |
|--------|-------------|----------|
| In-app toast + badge | Toasts on app load + bell badge + sidebar red dot. Fully offline. | ✓ |
| Browser notifications | System-level Notifications API. Requires permission, tab must be active. | |
| Both | In-app default + opt-in browser notifications. | |

**User's choice:** In-app toast + badge
**Notes:** None.

### Watchlist Organisation

| Option | Description | Selected |
|--------|-------------|----------|
| Simple list with add from anywhere | Flat list on Preordain. Add via context menu or flyout. Reuses existing patterns. | ✓ |
| Categorised watchlist | Folders/tags for grouping. More organisation, more complexity. | |
| Auto-watch collection | Automatically watch all owned cards + deck cards. No curation, potentially noisy. | |

**User's choice:** Simple list with add from anywhere
**Notes:** None.

---

## Spoiler Browser & Calendar

### Spoiler Display

| Option | Description | Selected |
|--------|-------------|----------|
| Gallery grid per set | Set selector dropdown, filterable gallery (reusing gallery-view.js). NEW badges. | ✓ |
| Timeline feed | Chronological feed, newest first. News feed style. | |
| Set completion tracker | Spoiler progress view (revealed/total). Overlaps collection pattern. | |

**User's choice:** Gallery grid per set
**Notes:** None.

### Release Calendar

| Option | Description | Selected |
|--------|-------------|----------|
| Visual timeline | Vertical timeline with dates, set icons, product types. Compact and scannable. | ✓ |
| Calendar grid | Traditional month-view calendar. Familiar but verbose. | |
| Simple list | Sorted list of products with dates. Minimal. | |

**User's choice:** Visual timeline
**Notes:** None.

### Preordain Screen Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Tabbed sections | Calendar persistent above tabs: Spoilers, Watchlist, Movers. Clean separation. | ✓ |
| Single scrollable page | All sections stacked vertically. Everything visible by scrolling. | |
| Two-column layout | Spoilers main + watchlist/movers sidebar. Desktop-optimised. | |

**User's choice:** Tabbed sections
**Notes:** None.

---

## Game History & Stats

### Post-Game Summary

| Option | Description | Selected |
|--------|-------------|----------|
| Summary card with chart | Full-screen overlay: winner, duration, turns, elimination order, life chart. Save & Close. | ✓ |
| Minimal summary toast | Just a toast with winner/duration. Auto-saves. Quick. | |
| Detailed breakdown page | Full stats page with multiple sections. Heavier. | |

**User's choice:** Summary card with chart
**Notes:** None.

### History Access

| Option | Description | Selected |
|--------|-------------|----------|
| History tab within Vandalblast | Two views: Active Game and History. Stats + game list in History tab. | ✓ |
| Separate stats screen | Third tab/section alongside setup and active game. | |
| Dashboard only | Stats on Epic Experiment dashboard (Phase 6). Vandalblast = gameplay only. | |

**User's choice:** History tab within Vandalblast
**Notes:** None.

---

## Claude's Discretion

- Game setup flow UX
- Market movers section design
- Sparkline rendering approach
- Dice roller visual design and animation
- Turn timer implementation
- Life chart styling
- Price history schema
- Tab styling within Preordain

## Deferred Ideas

None — discussion stayed within phase scope.
