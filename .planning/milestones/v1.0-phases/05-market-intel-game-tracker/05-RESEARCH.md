# Phase 5: Market Intel + Game Tracker - Research

**Researched:** 2026-04-08
**Domain:** Two independent modules -- Preordain (Market Intel: spoilers, watchlist, market movers, release calendar) and Vandalblast (Game Tracker: life totals, commander damage, game tools, history/stats). Both built on the existing Alpine.js + Dexie.js + Chart.js stack.
**Confidence:** HIGH

## Summary

Phase 5 delivers two independent screens that replace existing empty-state placeholders. Both modules build entirely on the established stack (Alpine.js 3.15, Dexie.js 4, Chart.js 4, Tailwind CSS v4) with zero new npm dependencies. The primary technical challenges are: (1) designing a price history IndexedDB schema that accumulates daily snapshots without unbounded growth, (2) implementing long-press acceleration for life total adjustments, (3) adding Chart.js line chart support (LineController/LineElement/PointElement not yet registered in the project), and (4) building mobile-responsive layout for Vandalblast only.

The Scryfall `/sets` API endpoint is needed for the release calendar but has not been called anywhere in the codebase yet. Card price data (`prices.eur`, `prices.eur_foil`) and `released_at` fields are already available in the IndexedDB `cards` table since the bulk data pipeline stores full Scryfall card objects. Currency conversion to GBP is handled by the existing `currency.js` service.

**Primary recommendation:** Split into two parallel workstreams (Preordain and Vandalblast) that share only the Dexie schema migration. Build the market store and game store as independent Alpine stores following the exact pattern of `collection.js` and `deck.js`. Use SVG polyline for sparklines (no Chart.js overhead for 120x32px inline charts). Use Chart.js LineController for the life total history chart and collection value sparkline only where canvas size justifies it.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Player display uses a 2x2 grid of player cards (flexible for 3-6 players). Each card shows life total, commander name, poison count, commander damage summary, and tax count. Tapping a card expands it for detailed adjustments.
- **D-02:** Life total adjustments use +/- buttons with long-press acceleration: tap for +/-1, hold 1s for +/-5, hold 2s for +/-10. Large readable numbers per GAME-02.
- **D-03:** Commander damage accessed by expanding within the player card -- reveals a row of trackers showing damage received FROM each opponent's commander, with +/- buttons per tracker. Auto-flags at 21+ per GAME-03.
- **D-04:** Game tools (dice roller, coin flip, turn counter) in a persistent floating bottom toolbar. Always accessible without covering player cards. 'More' menu for additional counters (Energy, Monarch, etc. per GAME-06).
- **D-05:** Mobile-responsive: grid stacks to single column on narrow viewports. Floating toolbar persists. Touch targets sized for phone use at the table.
- **D-06:** Price data sourced exclusively from Scryfall bulk data (daily EUR prices, already cached). Price history stored by appending daily snapshots to a new IndexedDB table. Sparklines computed from 7/30/90-day history. Zero extra API calls.
- **D-07:** Price alerts use in-app toast + sidebar badge only. When app loads and checks prices against thresholds, triggered alerts show as toasts. Bell icon in topbar shows alert history. Preordain sidebar icon gets a red dot badge. No browser push notifications.
- **D-08:** Watchlist is a flat list on the Preordain screen. Cards added via context menu (right-click any card tile anywhere -> "Watch price") or card detail flyout "Watch" button, or search+add within Preordain. Reuses existing context menu pattern.
- **D-09:** Alert configuration: per-card threshold set when adding to watchlist or editable inline -- notify on price below/above a GBP value, or percentage change.
- **D-10:** Spoiler browser uses a gallery grid per set, reusing the existing gallery-view.js component pattern. Set selector dropdown at top. Filter by colour, rarity, type. NEW badge on cards with Scryfall released_at within 48 hours.
- **D-11:** Release calendar uses a vertical visual timeline showing upcoming MTG products with dates, set icons, and product types. Data from Scryfall's /sets endpoint (already accessible via ScryfallService).
- **D-12:** Preordain screen layout uses tabbed sections: release calendar as persistent element above tabs, then three tabs -- Spoilers | Watchlist | Market Movers. Active tab highlighted with Izzet glow (consistent with existing view switcher patterns).
- **D-13:** Post-game summary presented as a full-screen overlay: winner, game duration, turn count, elimination order, and a life total line chart (Chart.js, one line per player over turns). "Save & Close" commits to IndexedDB history.
- **D-14:** Vandalblast has two views: "Active Game" and "History". History view shows aggregate stats (win rate, games played, best deck) and a list of past games. Tapping a game reopens its post-game summary.
- **D-15:** Game data persists in IndexedDB (Dexie) linked to deck ID. Stats computed client-side: win rate by deck, win rate by player, average game length, most-played commanders, win streaks per GAME-12.

### Claude's Discretion
- Game setup flow UX (modal wizard vs inline form -- follow ritual modal pattern or keep simpler)
- Market movers section design (top gainers/losers layout, time period toggles)
- Sparkline rendering approach (Chart.js sparkline vs canvas mini-chart vs SVG)
- Dice roller visual design and animation
- Turn timer implementation (stopwatch vs countdown vs chess-clock per GAME-07)
- Life chart axis scaling and colour scheme
- Price history IndexedDB table schema and snapshot strategy
- Tab styling within Preordain to match Organic Brutalism

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MRKT-01 | Spoiler browser with filterable card image gallery | Reuse gallery-view.js pattern; query cards table by set code + released_at; filter by color_identity, rarity, type_line |
| MRKT-02 | NEW badge during spoiler season | Compare card.released_at to Date.now() - 48h; badge-new CSS class from UI-SPEC |
| MRKT-03 | Price watchlist with sparkline, trend, target price | New watchlist Dexie table + price_history table; SVG sparkline; eurToGbp conversion |
| MRKT-04 | Price alert configuration | Alert thresholds stored per-watchlist entry; checked on app load against current price |
| MRKT-05 | Market trends: top movers | Compute from price_history table; sort by absolute/percentage change over period |
| MRKT-06 | Release calendar | Fetch Scryfall /sets endpoint; cache in meta table; render vertical timeline |
| GAME-01 | Game setup: select deck or enter commander, add opponents | Inline form (simpler than ritual modal); deck store integration for deck dropdown; autocomplete for manual commander entry |
| GAME-02 | Life total tracking with large numbers, long-press acceleration | 48px Syne display font; pointerdown/pointerup timer pattern for hold detection; requestAnimationFrame for continuous increment |
| GAME-03 | Commander damage per-player per-commander, auto-flag at 21+ | Nested data structure in game store; lethal-highlight CSS class at >= 21; partner support doubles trackers |
| GAME-04 | Poison counter tracking, auto-KO at 10 | Simple counter per player; toast notification at 10; secondary colour highlight |
| GAME-05 | Commander tax tracking | Cast count per player; computed tax = castCount * 2 |
| GAME-06 | Additional counters (Energy, Experience, Treasure, Monarch, etc.) | Dynamic counter list per player; counter-panel popover from floating toolbar |
| GAME-07 | Turn tracker with timer | Stopwatch mode (simplest per UI-SPEC discretion); setInterval-based MM:SS display; pause/reset controls |
| GAME-08 | Dice roller and coin flip | Math.random() with appropriate range; CSS scale animation for dice; Y-axis rotation for coin |
| GAME-09 | Post-game summary | Full-screen overlay with game data; winner selection; elimination order tracking |
| GAME-10 | Life total chart | Chart.js LineController (new registration needed); one dataset per player with player colours from UI-SPEC |
| GAME-11 | Game saved to history linked to deck | Games Dexie table with deck_id foreign key; graceful handling if deck is later deleted |
| GAME-12 | Game history stats | Client-side computation from games table; win rate, avg length, streaks, most-played |
| GAME-13 | Mobile-responsive layout | CSS Grid with responsive breakpoints; single-column stack < 768px; 48px touch targets; hidden sidebar < 768px |
| PERF-03 | Game Tracker fully functional offline | All game data in IndexedDB; no API calls during gameplay; Scryfall sets data cached for calendar |

</phase_requirements>

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Alpine.js | 3.15.x | Reactivity, stores, component data | Project-wide standard |
| Dexie.js | 4.4.2 | IndexedDB wrapper for all persistence | Project-wide standard |
| Chart.js | 4.5.1 | Life total chart, potential sparklines | Already used for deck/collection analytics |
| Tailwind CSS | 4.x | Styling, responsive breakpoints | Project-wide standard |
| keyrune | latest | Set symbol icons for release calendar | Already installed |
| mana-font | latest | Mana symbols | Already installed |

### No New Dependencies

Phase 5 requires zero new npm packages. All functionality builds on the existing stack:
- Sparklines: SVG polyline (no library needed for 120x32px inline charts)
- Dice/coin animations: CSS transforms
- Long-press detection: native pointer events
- Timer: setInterval/requestAnimationFrame
- Release calendar: Scryfall REST API + existing fetch patterns

### Chart.js Line Chart Registration

The project currently registers only DoughnutController, BarController, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, and Legend (in `analytics-panel.js`). Phase 5 needs to additionally register:

```javascript
import {
  LineController,
  LineElement,
  PointElement,
  Filler,
} from 'chart.js';

Chart.register(LineController, LineElement, PointElement, Filler);
```

This should be done in the life-chart component, following the same tree-shaken import pattern as `analytics-panel.js`.

## Architecture Patterns

### Recommended New Files

```
src/
├── stores/
│   ├── market.js          # Alpine.store('market') -- watchlist, price history, alerts, sets
│   └── game.js            # Alpine.store('game') -- active game, history, stats
├── services/
│   ├── price-history.js   # Daily snapshot logic, trend computation, movers calculation
│   └── sets.js            # Scryfall /sets endpoint fetch + cache
├── screens/
│   ├── preordain.js       # Replace empty state -- full market intel screen
│   └── vandalblast.js     # Replace empty state -- full game tracker screen
├── components/
│   ├── preordain-tabs.js        # Tab bar component
│   ├── spoiler-gallery.js       # Spoiler browser (reuses gallery-view pattern)
│   ├── watchlist-panel.js       # Watchlist flat list with sparklines
│   ├── sparkline.js             # SVG sparkline renderer
│   ├── movers-panel.js          # Top gainers/losers
│   ├── release-calendar.js      # Vertical timeline
│   ├── player-card.js           # Game player card with expand/collapse
│   ├── life-adjuster.js         # +/- buttons with long-press
│   ├── commander-damage-tracker.js  # Per-commander damage rows
│   ├── floating-toolbar.js      # Game tools bar
│   ├── dice-roller.js           # Dice popover
│   ├── coin-flipper.js          # Coin popover
│   ├── turn-timer.js            # Stopwatch timer
│   ├── counter-panel.js         # Additional counters popover
│   ├── post-game-overlay.js     # Full-screen summary with life chart
│   ├── life-chart.js            # Chart.js line chart
│   └── game-history-view.js     # History list + stats
└── utils/
    └── game-stats.js            # Pure stat computation functions (testable)
```

### Pattern 1: Dexie Schema Migration (Version 5)

**What:** Add three new tables for Phase 5 data.
**When to use:** First task of the phase -- all other work depends on this schema.

```javascript
// In db/schema.js -- add version 5
db.version(5).stores({
  // ... all existing tables unchanged ...
  watchlist: '++id, scryfall_id, &scryfall_id',
  price_history: '++id, scryfall_id, date, [scryfall_id+date]',
  games: '++id, deck_id, started_at, ended_at',
});
```

**CRITICAL:** The worker file `src/workers/bulk-data.worker.js` has its own copy of the Dexie schema (lines 24-42). It currently only goes up to version 3 and does NOT include the version 4 tables (edhrec_cache, combo_cache, card_salt_cache). This is a known pattern in the project -- the worker only needs access to `cards` and `meta` tables. However, the version number MUST still be kept in sync. When adding version 5, the worker's schema declaration must also be updated to version 5 (even if it does not use the new tables), otherwise Dexie will throw a VersionError when both the main thread and worker try to open the same database at different version numbers.

**Key fields for each table:**

```javascript
// watchlist entry
{
  id: auto,
  scryfall_id: 'card-uuid',
  added_at: '2026-04-08T...',
  alert_type: 'below' | 'above' | 'change_pct',
  alert_threshold: 5.00,  // GBP value or percentage
  last_alerted_at: null,  // prevent re-alerting same condition
}

// price_history snapshot
{
  id: auto,
  scryfall_id: 'card-uuid',
  date: '2026-04-08',  // ISO date string (one per day)
  eur: 12.50,
  eur_foil: 25.00,
}

// game record
{
  id: auto,
  deck_id: 3,           // nullable (deck may be deleted later)
  commander_name: 'Niv-Mizzet, Parun',
  started_at: '2026-04-08T19:30:00Z',
  ended_at: '2026-04-08T21:15:00Z',
  turn_count: 14,
  starting_life: 40,
  winner_index: 0,       // index into players array (0 = you)
  elimination_order: [3, 2, 1],  // player indices in elimination order
  players: [
    {
      name: 'You',
      commander: 'Niv-Mizzet, Parun',
      partner: null,
      color_index: 0,
      life_history: [40, 40, 37, 35, ...],  // per-turn snapshots
      final_life: 12,
      poison: 0,
      commander_damage: { 1: 5, 2: 0, 3: 21 },  // keyed by player index
      tax_count: 2,
      counters: { energy: 0, experience: 3 },
    },
    // ... opponents
  ],
}
```

### Pattern 2: Alpine Store (market.js)

**What:** Follow the exact pattern of collection.js and intelligence.js for the market store.

```javascript
import Alpine from 'alpinejs';
import { db } from '../db/schema.js';

export function initMarketStore() {
  Alpine.store('market', {
    // Watchlist
    watchlist: [],
    // Spoiler browser
    activeSet: null,
    spoilerCards: [],
    spoilerFilters: { colours: [], rarity: 'all', type: 'all' },
    // Market movers
    moversPeriod: '7d',
    gainers: [],
    losers: [],
    // Release calendar
    sets: [],
    // Alerts
    pendingAlerts: [],
    alertBadgeCount: 0,
    // Tab state
    activeTab: 'spoilers',
    loading: false,

    async init() {
      this.watchlist = await db.watchlist.toArray();
      await this.loadSets();
      await this.checkAlerts();
    },

    // ... methods
  });
}
```

### Pattern 3: SVG Sparkline (Recommended over Chart.js for inline use)

**What:** Lightweight SVG polyline for 120x32px inline sparklines in watchlist rows.
**Why not Chart.js:** Chart.js requires a canvas element, controller registration, and instance lifecycle management. For a 120x32 inline chart with no axes, labels, or interactivity, an SVG polyline is dramatically simpler and lighter.

```javascript
export function renderSparkline(prices, width = 120, height = 32) {
  if (!prices.length) return '';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const step = width / (prices.length - 1 || 1);

  const points = prices.map((p, i) =>
    `${i * step},${height - ((p - min) / range) * height}`
  ).join(' ');

  const trend = prices[prices.length - 1] >= prices[0] ? 'positive' : 'negative';
  const stroke = trend === 'positive' ? '#2ECC71' : '#E23838';

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="spark-fill-${trend}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${stroke}" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="${stroke}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <polyline fill="none" stroke="${stroke}" stroke-width="1.5"
                points="${points}"/>
      <polygon fill="url(#spark-fill-${trend})"
               points="0,${height} ${points} ${width},${height}"/>
    </svg>
  `;
}
```

### Pattern 4: Long-Press Acceleration

**What:** Pointer event pattern for +/- buttons that accelerate from 1 to 5 to 10 increments.

```javascript
function setupLongPress(button, callback) {
  let timer = null;
  let startTime = 0;
  let intervalId = null;

  function getIncrement() {
    const held = Date.now() - startTime;
    if (held >= 2000) return 10;
    if (held >= 1000) return 5;
    return 1;
  }

  button.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    startTime = Date.now();
    callback(1); // immediate single increment

    timer = setTimeout(() => {
      // Start repeating at 200ms intervals
      intervalId = setInterval(() => {
        callback(getIncrement());
      }, 200);
    }, 400); // initial delay before repeat starts
  });

  function stop() {
    clearTimeout(timer);
    clearInterval(intervalId);
    timer = null;
    intervalId = null;
  }

  button.addEventListener('pointerup', stop);
  button.addEventListener('pointerleave', stop);
  button.addEventListener('pointercancel', stop);
}
```

### Pattern 5: Price History Snapshot Strategy

**What:** Daily snapshot appended to price_history table when app loads.
**Strategy:** On app startup (or when market store initializes), for each watched card:
1. Check if a snapshot exists for today's date (`[scryfall_id+date]` compound index)
2. If not, read current price from `cards` table, append snapshot
3. Prune snapshots older than 90 days to prevent unbounded growth

```javascript
async function snapshotWatchlistPrices() {
  const today = new Date().toISOString().slice(0, 10);
  const watchlist = await db.watchlist.toArray();

  for (const entry of watchlist) {
    const exists = await db.price_history
      .where('[scryfall_id+date]')
      .equals([entry.scryfall_id, today])
      .first();

    if (!exists) {
      const card = await db.cards.get(entry.scryfall_id);
      if (card?.prices) {
        await db.price_history.add({
          scryfall_id: entry.scryfall_id,
          date: today,
          eur: parseFloat(card.prices.eur) || 0,
          eur_foil: parseFloat(card.prices.eur_foil) || 0,
        });
      }
    }
  }

  // Prune old snapshots (> 90 days)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  await db.price_history.where('date').below(cutoffStr).delete();
}
```

### Anti-Patterns to Avoid

- **Registering Chart.js globally:** Each component should import and register only the controllers/elements it needs. The life chart needs LineController; sparklines should use SVG instead.
- **Storing game state only in Alpine store without periodic IndexedDB writes:** A browser crash mid-game would lose all data. Debounce-write game state to IndexedDB on every life change (or every 5 seconds).
- **Using setInterval for the timer without cleanup:** The stopwatch timer must clear its interval when the component unmounts or game ends. Store the interval ID in the game store for cleanup.
- **Fetching Scryfall /sets on every Preordain mount:** Cache sets data in IndexedDB meta table with 24h TTL, same pattern as bulk data metadata.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB access | Raw IndexedDB API | Dexie.js (already installed) | Transaction management, versioning, compound indexes |
| Line charts | Canvas 2D API drawing | Chart.js LineController (already installed) | Axis scaling, tooltips, responsive resize, dataset management |
| Inline sparklines | Chart.js (overkill) | SVG polyline (hand-built, ~30 lines) | No axes/labels needed; Chart.js lifecycle overhead not justified for 120x32px |
| Currency conversion | Manual EUR/GBP math | currency.js eurToGbp/eurToGbpValue (already built) | Rate caching, fallback, formatting |
| Card image display | Custom image handling | card-tile.js (already built) | Handles DFC, layouts, foil badges, context menu dispatch |
| Autocomplete | Custom search UI | searchCards() from db/search.js + existing autocomplete pattern | Debounced, indexed search across 80k+ cards |
| Toast notifications | Custom notification UI | Alpine.store('toast').show() (already built) | Consistent styling, auto-dismiss, max 3 visible |

## Common Pitfalls

### Pitfall 1: Dexie Schema Version Mismatch Between Main Thread and Worker

**What goes wrong:** The bulk-data worker has its own Dexie instance with a separate schema declaration. If the main thread schema is version 5 but the worker still declares version 3, Dexie throws VersionError.
**Why it happens:** The worker schema in `bulk-data.worker.js` is a manual copy that was last updated at version 3, already behind the main thread's version 4.
**How to avoid:** Every schema version bump in `db/schema.js` MUST be mirrored in `bulk-data.worker.js`. The worker does not need to use the new tables, but it must declare them.
**Warning signs:** "VersionError" or "DatabaseClosedError" in the console after schema changes.

### Pitfall 2: Chart.js Instance Memory Leaks

**What goes wrong:** Creating Chart.js instances without destroying previous ones leaks memory and causes rendering glitches.
**Why it happens:** Navigating between views or reopening post-game summaries creates new Chart instances on the same canvas.
**How to avoid:** Follow the established pattern from analytics-panel.js: store chart instance reference, call `chart.destroy()` before creating a new one or when component unmounts.
**Warning signs:** Multiple overlapping chart renders, increasing memory usage over time.

### Pitfall 3: Price History Growing Unbounded

**What goes wrong:** Without pruning, price_history table grows by (watchlist_size * 1 record/day) indefinitely.
**Why it happens:** Daily snapshots accumulate if no cleanup runs.
**How to avoid:** Prune records older than 90 days on each snapshot run. The 90-day window covers all sparkline periods (7/30/90D).
**Warning signs:** Sluggish IndexedDB queries on price_history, increasing storage usage.

### Pitfall 4: Long-Press Not Working on Touch Devices

**What goes wrong:** Touch events can conflict with pointer events, causing long-press to fire on scroll or fail entirely.
**Why it happens:** Mobile browsers may fire touchmove/touchcancel during press-and-hold.
**How to avoid:** Use pointer events (pointerdown/pointerup/pointerleave/pointercancel) which unify mouse and touch. Add `touch-action: none` CSS on the +/- buttons to prevent browser scroll handling.
**Warning signs:** Life total buttons not responding to long-press on mobile; accidental scrolls when trying to adjust life.

### Pitfall 5: Scryfall /sets Endpoint Rate Limiting

**What goes wrong:** Fetching /sets on every app load or tab switch triggers unnecessary API calls.
**Why it happens:** The calendar needs set data but shouldn't call the API frequently.
**How to avoid:** Cache the /sets response in IndexedDB `meta` table with a 24h TTL key. Only fetch when cache is stale. The sets list changes infrequently (new sets announced weeks ahead).
**Warning signs:** 429 responses from Scryfall, slow calendar load times.

### Pitfall 6: Game State Lost on Browser Crash

**What goes wrong:** If game state lives only in Alpine store memory, a crash or accidental tab close loses an entire game session.
**Why it happens:** Alpine stores are in-memory; IndexedDB writes may only happen on "End Game".
**How to avoid:** Debounce-write the active game state to a `active_game` key in the `meta` table on every significant state change (life change, turn advance). On app load, check for an active game and offer to resume.
**Warning signs:** Users losing 2+ hour game sessions to accidental tab closes.

## Code Examples

### Scryfall /sets Endpoint Response Shape

```javascript
// GET https://api.scryfall.com/sets
// Response: { data: [...], has_more: false }
// Each set object:
{
  id: 'uuid',
  code: 'mkm',
  name: 'Murders at Karlov Manor',
  set_type: 'expansion',  // expansion, commander, masters, core, draft_innovation, etc.
  released_at: '2024-02-09',
  icon_svg_uri: 'https://svgs.scryfall.io/sets/mkm.svg',
  card_count: 286,
  parent_set_code: null,   // non-null for commander decks etc.
}
```

Set types relevant for the calendar: `expansion`, `commander`, `masters`, `core`, `draft_innovation`, `funny`, `masterpiece`. Filter out `token`, `memorabilia`, `promo`, `alchemy`, etc.

### Keyrune Set Icons

```html
<!-- Set icon using keyrune font (already installed) -->
<i class="ss ss-mkm ss-2x"></i>
<!-- For unknown/new sets, fall back to generic icon -->
<i class="ss ss-default ss-2x"></i>
```

Keyrune uses set codes as CSS class names (lowercase). Recent sets may not have icons yet -- use `ss-default` as fallback.

### Game Store Pattern

```javascript
export function initGameStore() {
  Alpine.store('game', {
    // View state
    view: 'setup',  // 'setup' | 'active' | 'summary'
    historyView: false,

    // Setup
    selectedDeckId: null,
    manualCommander: '',
    startingLife: 40,
    opponents: [],

    // Active game
    players: [],
    currentTurn: 0,
    timerSeconds: 0,
    timerRunning: false,
    _timerInterval: null,

    // History
    games: [],

    // Computed stats
    get stats() {
      return computeGameStats(this.games);
    },
  });
}
```

### Market Movers Computation

```javascript
function computeMovers(priceHistory, period, limit = 10) {
  const cutoffDate = getCutoffDate(period); // '7d' -> 7 days ago
  // Group by scryfall_id, get earliest and latest price in period
  // Compute absolute and percentage change
  // Sort by absolute change descending for gainers, ascending for losers
  // Return top N of each
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Chart.js 3.x sparklines via chartjs-chart-sparkline | Chart.js 4.x has no official sparkline plugin | Chart.js 4.0 (2023) | Use SVG polyline for inline sparklines; Chart.js only for full charts |
| Dexie.js 3.x compound where clauses | Dexie 4.x compound indexes with `[field1+field2]` syntax | Dexie 4.0 (2024) | price_history uses `[scryfall_id+date]` compound index for efficient lookups |
| pointer events incomplete on mobile | pointer events well-supported across all modern browsers | ~2022 | Safe to use pointerdown/pointerup for long-press without touch event fallback |

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (latest, via `vitest/config`) |
| Config file | `vitest.config.js` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MRKT-03 | Watchlist CRUD operations | unit | `npx vitest run tests/market-store.test.js -t "watchlist"` | Wave 0 |
| MRKT-04 | Alert threshold checking | unit | `npx vitest run tests/price-alerts.test.js` | Wave 0 |
| MRKT-05 | Market movers computation | unit | `npx vitest run tests/price-history.test.js -t "movers"` | Wave 0 |
| GAME-01 | Game setup validation | unit | `npx vitest run tests/game-store.test.js -t "setup"` | Wave 0 |
| GAME-02 | Long-press increment logic | unit | `npx vitest run tests/life-adjuster.test.js` | Wave 0 |
| GAME-03 | Commander damage tracking + lethal flag | unit | `npx vitest run tests/game-store.test.js -t "commander damage"` | Wave 0 |
| GAME-04 | Poison counter + auto-KO at 10 | unit | `npx vitest run tests/game-store.test.js -t "poison"` | Wave 0 |
| GAME-05 | Commander tax computation | unit | `npx vitest run tests/game-store.test.js -t "tax"` | Wave 0 |
| GAME-12 | Game history stats computation | unit | `npx vitest run tests/game-stats.test.js` | Wave 0 |
| MRKT-01 | Spoiler gallery filtering | unit | `npx vitest run tests/spoiler-filter.test.js` | Wave 0 |
| MRKT-06 | Sets data caching | unit | `npx vitest run tests/sets-service.test.js` | Wave 0 |
| PERF-03 | Offline game functionality | manual-only | Verify in DevTools offline mode | N/A |
| GAME-10 | Life chart rendering | manual-only | Visual verification | N/A |
| GAME-13 | Mobile responsive layout | manual-only | Browser responsive mode | N/A |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/market-store.test.js` -- covers MRKT-03, MRKT-04
- [ ] `tests/price-history.test.js` -- covers MRKT-05, snapshot/prune logic
- [ ] `tests/price-alerts.test.js` -- covers MRKT-04 alert checking
- [ ] `tests/game-store.test.js` -- covers GAME-01, GAME-03, GAME-04, GAME-05
- [ ] `tests/game-stats.test.js` -- covers GAME-12
- [ ] `tests/life-adjuster.test.js` -- covers GAME-02 increment logic
- [ ] `tests/spoiler-filter.test.js` -- covers MRKT-01
- [ ] `tests/sets-service.test.js` -- covers MRKT-06

## Discretion Recommendations

### Game Setup: Inline Form (not ritual modal)

The UI-SPEC already recommends inline form. Rationale: game setup has only 3-5 fields (deck, starting life, opponents), far simpler than the ritual modal's multi-step commander/partner/companion flow. An inline form on the Vandalblast screen surface card is faster to use and easier to implement.

### Sparklines: SVG Polyline

Use hand-built SVG polyline (not Chart.js). Rationale: sparklines are 120x32px, no interactivity, no axes, no tooltips. Chart.js would require canvas element lifecycle management per-row in a scrollable list. SVG polyline is ~30 lines of code, renders inline in the DOM, and is trivially re-rendered when period changes.

### Turn Timer: Stopwatch

The UI-SPEC already recommends stopwatch as simplest. Use `setInterval` with 1-second ticks. Store elapsed seconds in game store. Display as MM:SS. Controls: play/pause toggle + reset. Timer auto-pauses on "Next Turn" and resets for the new turn. Total game time computed from `started_at` to `ended_at` timestamps, not accumulated timer values.

### Market Movers Design

Two-column layout (Gainers left, Losers right) matching the UI-SPEC copywriting contract. Period toggle (24H/7D/30D) at top. Each entry: rank #, card name (truncated), current price in GBP, change amount with +/- sign, change percentage. Top 10 per column. Empty state for first few days until price history accumulates.

### Price History Schema

One row per card per day. Compound index `[scryfall_id+date]` for efficient lookup. Snapshot runs on market store init (app load). 90-day retention with auto-prune. This keeps the table bounded: 100 watched cards * 90 days = 9,000 rows max.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: `db/schema.js`, `stores/collection.js`, `stores/deck.js`, `stores/intelligence.js`, `components/analytics-panel.js`, `components/gallery-view.js`, `services/currency.js`, `workers/bulk-data.worker.js`
- UI-SPEC: `.planning/phases/05-market-intel-game-tracker/05-UI-SPEC.md`
- CONTEXT.md: `.planning/phases/05-market-intel-game-tracker/05-CONTEXT.md`

### Secondary (MEDIUM confidence)
- Scryfall /sets API structure: Based on Scryfall REST API documentation (well-documented, stable)
- Chart.js 4.x tree-shaken imports: Verified against existing project usage in analytics-panel.js
- Dexie compound index syntax: Verified against existing schema.js patterns

### Tertiary (LOW confidence)
- None -- all findings verified against existing codebase or established API documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all from existing project
- Architecture: HIGH -- follows established patterns from 4 completed phases
- Pitfalls: HIGH -- most identified from actual codebase analysis (e.g., worker schema mismatch is observable in current code)

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable stack, no fast-moving dependencies)
