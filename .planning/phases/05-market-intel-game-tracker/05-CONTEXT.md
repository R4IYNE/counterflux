# Phase 5: Market Intel + Game Tracker - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver two independent modules: **Preordain** (Market Intel) — spoiler browser with filterable gallery per set, price watchlist with sparkline trends and alerts, market movers, and release calendar timeline; **Vandalblast** (Game Tracker) — Commander game setup, life total tracking with player card grid, commander damage, poison, counters, dice/coin tools, post-game summary with life chart, and game history with win rate stats. Vandalblast is the only mobile-responsive screen. Both modules are fully offline-capable after initial data load.

</domain>

<decisions>
## Implementation Decisions

### Game Tracker Layout (Vandalblast)
- **D-01:** Player display uses a **2x2 grid of player cards** (flexible for 3-6 players). Each card shows life total, commander name, poison count, commander damage summary, and tax count. Tapping a card expands it for detailed adjustments.
- **D-02:** Life total adjustments use **+/- buttons with long-press acceleration**: tap for +/-1, hold 1s for +/-5, hold 2s for +/-10. Large readable numbers per GAME-02.
- **D-03:** Commander damage accessed by **expanding within the player card** — reveals a row of trackers showing damage received FROM each opponent's commander, with +/- buttons per tracker. Auto-flags at 21+ per GAME-03.
- **D-04:** Game tools (dice roller, coin flip, turn counter) in a **persistent floating bottom toolbar**. Always accessible without covering player cards. 'More' menu for additional counters (Energy, Monarch, etc. per GAME-06).
- **D-05:** Mobile-responsive: grid stacks to single column on narrow viewports. Floating toolbar persists. Touch targets sized for phone use at the table.

### Price Watchlist & Alerts (Preordain)
- **D-06:** Price data sourced exclusively from **Scryfall bulk data** (daily EUR prices, already cached). Price history stored by appending daily snapshots to a new IndexedDB table. Sparklines computed from 7/30/90-day history. Zero extra API calls.
- **D-07:** Price alerts use **in-app toast + sidebar badge** only. When app loads and checks prices against thresholds, triggered alerts show as toasts. Bell icon in topbar shows alert history. Preordain sidebar icon gets a red dot badge. No browser push notifications.
- **D-08:** Watchlist is a **flat list** on the Preordain screen. Cards added via context menu (right-click any card tile anywhere -> "Watch price") or card detail flyout "Watch" button, or search+add within Preordain. Reuses existing context menu pattern.
- **D-09:** Alert configuration: per-card threshold set when adding to watchlist or editable inline — notify on price below/above a GBP value, or percentage change.

### Spoiler Browser & Calendar (Preordain)
- **D-10:** Spoiler browser uses a **gallery grid per set**, reusing the existing gallery-view.js component pattern. Set selector dropdown at top. Filter by colour, rarity, type. NEW badge on cards with Scryfall `released_at` within 48 hours.
- **D-11:** Release calendar uses a **vertical visual timeline** showing upcoming MTG products with dates, set icons, and product types. Data from Scryfall's `/sets` endpoint (already accessible via ScryfallService).
- **D-12:** Preordain screen layout uses **tabbed sections**: release calendar as persistent element above tabs, then three tabs — Spoilers | Watchlist | Market Movers. Active tab highlighted with Izzet glow (consistent with existing view switcher patterns).

### Game History & Stats (Vandalblast)
- **D-13:** Post-game summary presented as a **full-screen overlay**: winner, game duration, turn count, elimination order, and a life total line chart (Chart.js, one line per player over turns). "Save & Close" commits to IndexedDB history.
- **D-14:** Vandalblast has **two views: "Active Game" and "History"**. History view shows aggregate stats (win rate, games played, best deck) and a list of past games. Tapping a game reopens its post-game summary.
- **D-15:** Game data persists in IndexedDB (Dexie) linked to deck ID. Stats computed client-side: win rate by deck, win rate by player, average game length, most-played commanders, win streaks per GAME-12.

### Claude's Discretion
- Game setup flow UX (modal wizard vs inline form — follow ritual modal pattern or keep simpler)
- Market movers section design (top gainers/losers layout, time period toggles)
- Sparkline rendering approach (Chart.js sparkline vs canvas mini-chart vs SVG)
- Dice roller visual design and animation
- Turn timer implementation (stopwatch vs countdown vs chess-clock per GAME-07)
- Life chart axis scaling and colour scheme
- Price history IndexedDB table schema and snapshot strategy
- Tab styling within Preordain to match Organic Brutalism

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — MRKT-01 through MRKT-06 (Market Intel), GAME-01 through GAME-13 (Game Tracker), PERF-03 (offline game tracker)

### Prior Phase Context
- `.planning/phases/01-foundation-data-layer/01-CONTEXT.md` — Bulk data pipeline, card search, navigation shell, visual identity decisions
- `.planning/phases/02-collection-manager-treasure-cruise/02-CONTEXT.md` — Gallery view, virtual scroller, context menu, analytics panel patterns
- `.planning/phases/03-deck-builder-thousand-year-storm/03-CONTEXT.md` — Three-panel editor, SortableJS, Chart.js analytics, deck store schema
- `.planning/phases/04-intelligence-layer/04-CONTEXT.md` — EDHREC/Spellbook services, intelligence store, Vite dev proxy for CORS

### Design
- `.planning/phases/01-foundation-data-layer/01-UI-SPEC.md` — Full Izzet / Neo-Occult Terminal design system (colours, typography, spacing, components)

### Existing Code
- `src/components/gallery-view.js` — Reusable gallery grid (spoiler browser will follow this pattern)
- `src/components/context-menu.js` — Context menu system (watchlist add via right-click)
- `src/components/card-tile.js` — Card tile component (reusable across spoiler/watchlist views)
- `src/components/virtual-scroller.js` — Virtual scrolling for large card lists
- `src/services/currency.js` — EUR-to-GBP conversion (watchlist prices displayed in GBP)
- `src/stores/collection.js` — Collection store pattern (model for watchlist/game stores)
- `src/utils/scryfall.js` — Scryfall API wrapper (sets endpoint needed for calendar/spoilers)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `gallery-view.js`: Filterable card image grid — direct reuse for spoiler browser
- `card-tile.js`: Card tile component with context menu integration — reusable for watchlist and spoiler display
- `virtual-scroller.js`: Custom ~150-line vanilla JS virtualiser — needed if watchlist or game history grows large
- `context-menu.js`: DOM event-based context menu — add "Watch price" option for any card tile
- `analytics-panel.js` / `deck-analytics-panel.js`: Chart.js integration patterns — reusable for life chart and sparklines
- `salt-gauge.js`: Visual gauge component — potential pattern reference for game stat displays
- `toast.js` / toast store: Toast notification system — used for price alerts
- `empty-state.js` + `mila.js`: Empty state with Mila — needed for first-time game tracker and empty watchlist

### Established Patterns
- Alpine.store() for each domain (collection, deck, intelligence) — game and market stores follow same pattern
- Imperative DOM for complex interactive UIs (ritual modal, centre panel) — game tracker will likely use this for the player card grid
- Chart.js tree-shaken imports with destroy() cleanup — follow for life chart and sparklines
- Screen module exports `mount(container)` function — Preordain and Vandalblast already have placeholder screens
- Context menu uses custom DOM events for cross-component communication

### Integration Points
- `src/screens/preordain.js` — Replace empty state with full Market Intel module
- `src/screens/vandalblast.js` — Replace empty state with full Game Tracker module
- `src/stores/` — New `market.js` and `game.js` Alpine stores
- `src/services/` — Likely new `price-history.js` service for snapshot storage
- Sidebar nav — Unlock Preordain and Vandalblast icons (currently greyed out)
- Topbar bell — Wire alert badge count from market store

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for visual design within the established Izzet / Neo-Occult Terminal identity.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-market-intel-game-tracker*
*Context gathered: 2026-04-08*
