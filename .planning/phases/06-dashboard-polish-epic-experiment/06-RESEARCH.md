# Phase 6: Dashboard + Polish (Epic Experiment) - Research

**Researched:** 2026-04-10
**Domain:** Dashboard integration, keyboard shortcuts, undo system, offline/connectivity indicators
**Confidence:** HIGH

## Summary

Phase 6 is a pure integration phase -- it wires existing data stores and services into the final screen (Epic Experiment dashboard), adds cross-cutting UX polish (keyboard shortcuts, undo for destructive actions, shortcut cheat sheet), and hardens offline behavior with a connectivity status chip. Every data source this phase needs already exists in working Alpine stores. The primary technical challenge is the undo system (intercepting deletes, holding state for 10 seconds, then committing), not the dashboard itself.

The codebase is mature with well-established patterns: Alpine.store() for state, imperative DOM for complex components, custom DOM events for cross-component communication, and a screen `mount(container)` pattern. The dashboard screen (`src/screens/epic-experiment.js`) is an empty placeholder ready to build. The activity timeline is the only data structure that does not yet exist -- all other dashboard panels read from existing stores.

**Primary recommendation:** Build the dashboard as a grid of imperative DOM panels that read from existing Alpine stores. Implement the undo system as an in-memory stack in `app.js` with a modified toast that includes countdown + undo button. Wire keyboard shortcuts at the `<body>` level in `index.html` (some already exist -- `/` and Escape are partially wired).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Command centre grid layout -- fixed 2-3 column grid. Portfolio summary spans the top row. Deck launch + activity timeline side-by-side in the middle. Mila insight + price alerts + upcoming releases in a lower row.
- **D-02:** Activity timeline shows all module actions -- cards added/removed, decks created/edited, games played, watchlist changes. Unified feed across all modules.
- **D-03:** Deck quick-launch grid shows 6 decks with commander art thumbnails + "View all" link. Two rows of 3.
- **D-04:** Portfolio summary uses inline SVG sparkline (reusing existing sparkline.js) with GBP value and percentage change badge. Compact, consistent with Market Intel.
- **D-05:** Empty dashboard state uses Mila onboarding flow -- progressive panel unlock as data arrives. Consistent with existing Mila empty states across other screens.
- **D-06:** Quick Add is an inline search bar in the portfolio summary area. Persistent, always visible on dashboard. Supports quantity prefix (4x), set code suffix ([2XM]), autocomplete resolution via existing mass-entry resolver.
- **D-07:** After adding a card: toast notification ("Added 4x Lightning Bolt") plus brief inline flash on the Quick Add bar. Card immediately appears in activity timeline.
- **D-08:** Quick Add includes condition dropdown (NM default) and foil checkbox as small toggle buttons next to the input. Matches Add Card Modal fields.
- **D-09:** Undo scope: card removes from collection, card removes from decks, and deck deletions only. These are the most destructive common actions.
- **D-10:** Undo UX: toast with undo button and 10-second countdown progress bar. Clicking "Undo" or pressing Ctrl+Z within 10s restores the item. After 10s, toast disappears and deletion is permanent. Gmail-style grace period.
- **D-11:** `?` key opens a keyboard shortcut cheat sheet modal (like GitHub). Lists all shortcuts.
- **D-12:** `/` always focuses the global topbar search bar on every screen, including dashboard. Consistent behavior -- Quick Add is separate.
- **D-13:** `Escape` closes modals (already partially implemented in delete-confirm and delete-deck-modal).
- **D-14:** Topbar status chip indicates connectivity state: green "Live" when online and fresh, amber "Prices stale Xh" when data is old, red "Offline" when no connectivity. Positioned next to global search in topbar.
- **D-15:** Prices considered stale after 24 hours -- matches Scryfall's daily update cadence.
- **D-16:** Auto-refresh: when online event fires and prices are stale, trigger silent background bulk data refresh. Status chip updates automatically. No user action needed.

### Claude's Discretion
- Implementation details of the undo stack (in-memory vs store-based)
- Exact panel sizing ratios in the command centre grid
- Activity timeline data structure and storage approach
- Keyboard shortcut cheat sheet styling and content organization

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | Portfolio summary panel: total value, 7/30/90-day change, unique/total count, sparkline | Collection store `stats` computed property has value/counts. sparkline.js exists. Price history service has historical data. Currency service converts EUR to GBP. |
| DASH-02 | Quick Add input with autocomplete, quantity prefix, set code suffix, condition/foil toggles | mass-entry.js `parseBatchLine()` handles syntax. Search store provides autocomplete. Collection store `addCard()` persists. |
| DASH-03 | Price alerts panel showing threshold-crossing cards | Market store `pendingAlerts` array already populated by `checkAlerts()`. |
| DASH-04 | Mila's Insight panel with rotating daily tip | insight-engine.js `generateDailyInsight()` fully implemented. Returns structured insight object. |
| DASH-05 | Recent activity timeline | New feature -- needs activity log data structure (see Architecture Patterns). |
| DASH-06 | Deck quick-launch grid with commander art + "Initialize Ritual" | Deck store `decks` array available. Card images from Scryfall. |
| DASH-07 | Upcoming releases panel | Sets service `fetchSets()` returns sets with `released_at`. Filter to future dates. |
| UX-01 | Keyboard shortcuts: `/` focus search, Escape closes modals, Enter confirms | `/` and Escape already wired in index.html body. Need `?` for cheat sheet. |
| UX-02 | Right-click context menus on card tiles across all screens | context-menu.js pattern exists for collection. Needs generalization or per-screen instances. |
| UX-03 | Ctrl+Z undo for destructive actions with 10-second grace period | New feature -- undo stack architecture needed (see Architecture Patterns). |
| PERF-02 | Full collection/deck data available offline after initial load | Already true -- Dexie.js persists in IndexedDB. Need connectivity detection + stale indicator. |
| PERF-04 | Deck builder analytics recalculate within 100ms | Already true -- `computeDeckAnalytics()` is synchronous pure function on in-memory data. Verify with timing test. |
| PERF-05 | Stale price data indicator when offline | New topbar chip -- needs `navigator.onLine` + bulk data timestamp check. |
</phase_requirements>

## Standard Stack

### Core (already installed -- no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Alpine.js | 3.15.x | Reactivity, stores, templates | Project standard -- all state management uses Alpine.store() |
| Dexie.js | 4.x | IndexedDB wrapper | Project standard -- all persistence through Dexie |
| Chart.js | 4.x | Sparklines, charts | Already used for analytics; dashboard sparkline uses SVG (sparkline.js) |

### Supporting (already installed -- no new dependencies)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sparkline.js (custom) | n/a | SVG sparkline rendering | Portfolio summary trend line (D-04) |
| mass-entry.js (custom) | n/a | Batch syntax parser | Quick Add input parsing (D-06) |
| insight-engine.js (custom) | n/a | Daily Mila insight | Dashboard insight panel (D-04) |
| currency.js (custom) | n/a | EUR-to-GBP conversion | All price displays (D-01, D-03) |
| sets.js (custom) | n/a | Scryfall sets fetcher | Upcoming releases panel (D-07) |
| price-history.js (custom) | n/a | Price snapshots | Portfolio sparkline data (D-01) |

### New Dependencies
None. This phase uses only existing libraries and custom services.

**Installation:** No new packages required.

## Architecture Patterns

### Dashboard Screen Structure
```
src/screens/epic-experiment.js
  mount(container) builds:
  ├── Portfolio Summary (top row, full width)
  │   ├── Total value (GBP), unique/total counts
  │   ├── 7/30/90-day change badge
  │   ├── SVG sparkline (from sparkline.js)
  │   └── Quick Add bar (inline search + condition/foil toggles)
  ├── Middle Row (2 columns)
  │   ├── Deck Quick-Launch Grid (2x3 grid, commander art thumbnails)
  │   └── Activity Timeline (scrollable feed of recent actions)
  └── Lower Row (3 columns)
      ├── Mila's Daily Insight
      ├── Price Alerts (from market store)
      └── Upcoming Releases (from sets service)
```

### Pattern 1: Dashboard Panel as Imperative DOM
**What:** Each dashboard panel is a self-contained function that creates its DOM, reads from Alpine stores, and sets up Alpine effect watchers for reactivity.
**When to use:** All 7 dashboard panels.
**Example:**
```javascript
// Consistent with existing screen patterns (preordain.js, vandalblast.js)
function renderPortfolioSummary(container) {
  const panel = document.createElement('div');
  panel.className = 'bg-surface border border-border-ghost p-md';
  container.appendChild(panel);

  // Use Alpine.effect() for reactive updates
  Alpine.effect(() => {
    const stats = Alpine.store('collection').stats;
    const gbpValue = window.__cf_eurToGbpValue(stats.estimatedValue);
    panel.querySelector('.total-value').textContent = gbpValue;
  });
}
```

### Pattern 2: Activity Timeline Data Structure
**What:** A lightweight activity log stored in Dexie `meta` table (not a new table) to avoid schema migration. Capped at most recent 50 entries.
**When to use:** Activity timeline panel (DASH-05, D-02).

**Recommended approach:** Store activity entries in the `meta` table under a single key `activity_log` as a JSON array. Each entry has `{ type, message, timestamp, entityId? }`. Write a small `activity.js` service that:
1. Appends entries when stores mutate (collection add/remove, deck create/edit, game end, watchlist change)
2. Caps at 50 entries (FIFO)
3. Reads for the dashboard timeline

**Why meta table, not new table:** Avoids Dexie schema version bump (currently at v5). The activity log is display-only, not queried by index. A single JSON blob in `meta` is simpler and sufficient for 50 entries.

```javascript
// src/services/activity.js
import { db } from '../db/schema.js';

const MAX_ENTRIES = 50;
const ACTIVITY_KEY = 'activity_log';

export async function logActivity(type, message, entityId = null) {
  const meta = await db.meta.get(ACTIVITY_KEY);
  const entries = meta?.entries || [];
  entries.unshift({ type, message, entityId, timestamp: new Date().toISOString() });
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  await db.meta.put({ key: ACTIVITY_KEY, entries });
}

export async function getActivity() {
  const meta = await db.meta.get(ACTIVITY_KEY);
  return meta?.entries || [];
}
```

### Pattern 3: Undo Stack (Grace Period Pattern)
**What:** In-memory array of pending destructive actions. Each entry holds the data needed to restore, a 10-second timer, and a cancel function. The actual deletion is deferred -- the UI shows it as deleted immediately, but the database write happens after 10 seconds.
**When to use:** Card removal from collection (D-09), card removal from deck (D-09), deck deletion (D-09).

**Recommended approach:** Add undo state to the `app` store (or a new `undo` store):

```javascript
// In stores/app.js or new stores/undo.js
Alpine.store('undo', {
  stack: [],  // { id, type, data, timer, message }

  push(type, data, message, executeFn, restoreFn) {
    const id = Date.now();
    // Optimistically hide from UI immediately
    executeFn();

    const timer = setTimeout(async () => {
      // Actually commit the deletion to DB
      await data.commitFn();
      this.stack = this.stack.filter(e => e.id !== id);
    }, 10000);

    this.stack.push({ id, type, data, timer, message, restoreFn });
    // Show undo toast
    Alpine.store('toast').showUndo(message, id);
  },

  undo(id) {
    const entry = this.stack.find(e => e.id === id);
    if (!entry) return;
    clearTimeout(entry.timer);
    entry.restoreFn();
    this.stack = this.stack.filter(e => e.id !== id);
  },

  // Ctrl+Z undoes the most recent
  undoLast() {
    if (this.stack.length === 0) return;
    this.undo(this.stack[this.stack.length - 1].id);
  }
});
```

**Key insight:** The deletion must be deferred, not the undo. The UI removes the item immediately (optimistic update), but the DB delete only fires after the 10-second timer. If the user presses undo, the item is restored to the UI from the in-memory snapshot -- no DB operation needed.

### Pattern 4: Undo Toast with Countdown
**What:** Extended toast type that includes an "UNDO" button and a 10-second shrinking progress bar.
**When to use:** All undo-eligible destructive actions.

**Approach:** Extend the existing toast store with a new `showUndo(message, undoId)` method. The toast template in `index.html` gets a conditional block for undo toasts that renders the countdown bar and undo button. Duration is 10000ms instead of the default 5000ms.

### Pattern 5: Connectivity Status Chip
**What:** Small inline chip in the topbar showing connection state and data freshness.
**When to use:** Always visible in topbar (D-14).

```javascript
// Track in app store or a small connectivity utility
function getConnectivityStatus() {
  if (!navigator.onLine) return { state: 'offline', label: 'OFFLINE', color: 'secondary' };

  const bulkMeta = Alpine.store('bulkdata');
  const updatedAt = bulkMeta?.updatedAt;
  if (updatedAt) {
    const hoursSince = (Date.now() - new Date(updatedAt).getTime()) / 3600000;
    if (hoursSince > 24) {
      return { state: 'stale', label: `PRICES STALE ${Math.floor(hoursSince)}H`, color: 'warning' };
    }
  }
  return { state: 'live', label: 'LIVE', color: 'success' };
}
```

**Integration point:** Add the chip element in `index.html` topbar, next to global search. Use Alpine reactive expression bound to `navigator.onLine` and `$store.bulkdata.updatedAt`.

### Pattern 6: Progressive Empty State (Mila Onboarding)
**What:** When the dashboard has no data, show Mila with contextual messages. As data arrives (first card added, first deck created, first game played), panels unlock progressively.
**When to use:** Dashboard empty state (D-05).

```javascript
function hasData(store) {
  return {
    collection: Alpine.store('collection').entries.length > 0,
    decks: Alpine.store('deck').decks.length > 0,
    games: Alpine.store('game').games.length > 0,
    watchlist: Alpine.store('market').watchlist.length > 0,
  };
}
```

Each panel renders its Mila empty state (using existing `renderEmptyState` pattern) if its data source is empty, and renders the real content when data exists.

### Anti-Patterns to Avoid
- **Separate route for each dashboard panel:** Keep it as one screen, one mount function. Panels are DOM sections, not routes.
- **Alpine x-for in outer grid:** The grid is static (always 7 panels). Use imperative DOM, not Alpine loops.
- **New Dexie schema version for activity log:** Use the existing `meta` table with a JSON blob -- avoids migration complexity for a display-only feature.
- **Polling for connectivity changes:** Use `online`/`offline` events on `window`, not polling.
- **Storing undo data in IndexedDB:** Undo is transient (10 seconds max). Keep it in memory only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sparkline charts | Custom SVG generator | Existing `sparkline.js` | Already built, tested, styled consistently |
| Card autocomplete | New search implementation | Existing search store + `$store.search.search()` | 200ms debounce, Scryfall-backed, battle-tested |
| Batch syntax parsing | New regex parser | Existing `parseBatchLine()` from mass-entry.js | Handles qty, set code, foil flags |
| Price formatting | Manual EUR-to-GBP | `window.__cf_eurToGbp()` / `window.__cf_eurToGbpValue()` | Cached exchange rate, consistent formatting |
| Toast notifications | Custom notification system | Existing toast store | Extend with undo type, don't replace |
| Context menus | New menu system | Existing context-menu.js pattern | Custom DOM events, positioning logic already solved |

**Key insight:** Phase 6 is almost entirely wiring existing systems together. The only genuinely new code is the undo stack, the activity logger, the connectivity chip, and the keyboard cheat sheet modal.

## Common Pitfalls

### Pitfall 1: Undo Race Condition
**What goes wrong:** User deletes card A, then card B, then undoes B. If the undo system uses a simple "last action" pointer, it might restore A instead.
**Why it happens:** Stack ordering confusion when multiple undo-eligible actions are pending.
**How to avoid:** Each undo entry gets a unique ID. The undo toast's button is bound to that specific ID, not "undo last." Ctrl+Z always undoes the most recent entry in the stack.
**Warning signs:** Clicking undo restores the wrong item.

### Pitfall 2: Stale Alpine Store Reads in Imperative DOM
**What goes wrong:** Dashboard panels read store values once at mount time but don't update when stores change.
**Why it happens:** Imperative DOM (`document.createElement`) doesn't auto-bind to Alpine reactivity.
**How to avoid:** Wrap store reads in `Alpine.effect(() => { ... })` which re-runs whenever dependencies change. This is the established pattern in the codebase (preordain.js, vandalblast.js).
**Warning signs:** Dashboard shows stale data until page refresh.

### Pitfall 3: Quick Add Conflicts with Global Search
**What goes wrong:** Typing in the Quick Add bar triggers the global search autocomplete, or pressing `/` focuses the wrong input.
**Why it happens:** The body-level `@keydown.slash` handler focuses the topbar search. Quick Add is a separate input on the dashboard.
**How to avoid:** Quick Add input needs `@keydown.slash.stop` to prevent propagation. The global `/` handler already skips when `target.tagName` is INPUT. Quick Add uses its own autocomplete dropdown, separate from the topbar's.
**Warning signs:** Focus jumps to topbar when typing in Quick Add.

### Pitfall 4: Epic Experiment Locked in App Store
**What goes wrong:** Dashboard screen is marked `locked: true` in the app store's screens array, preventing navigation.
**Why it happens:** Placeholder from Phase 1 -- the screen was locked because it wasn't built yet.
**How to avoid:** Set `locked: false` for `epic-experiment` in `src/stores/app.js` as the first task.
**Warning signs:** Clicking the sidebar link does nothing.

### Pitfall 5: Portfolio Sparkline Needs Price History Data
**What goes wrong:** Sparkline shows nothing because price history only exists for watchlist cards, not the entire collection.
**Why it happens:** The price-history service (`snapshotWatchlistPrices`) only snapshots watchlist items. Portfolio sparkline needs aggregate collection value over time.
**How to avoid:** Create a separate "portfolio value snapshot" that runs daily alongside the watchlist snapshot. Store in `meta` table as `portfolio_history` -- a simple array of `{ date, totalEur }` entries.
**Warning signs:** Sparkline renders empty string on dashboard.

### Pitfall 6: Escape Key Conflicts
**What goes wrong:** Pressing Escape closes the wrong thing (e.g., closes context menu when user wanted to close the cheat sheet modal).
**Why it happens:** Multiple Escape handlers compete: body-level handler, context-menu listener, potential cheat sheet modal.
**How to avoid:** Implement priority-based Escape handling: modals first (highest z-index), then flyouts, then menus, then search clear. Check visibility state before acting.
**Warning signs:** Escape closes two things at once, or the wrong thing.

## Code Examples

### Dashboard Panel Grid Layout (Tailwind v4)
```css
/* 3-column command centre grid */
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.dashboard-grid .panel-portfolio {
  grid-column: 1 / -1; /* full width top row */
}
.dashboard-grid .panel-decks,
.dashboard-grid .panel-activity {
  grid-column: span 1; /* or span 2 / span 1 for asymmetric */
}
```

### Quick Add Bar with Existing Parser
```javascript
import { parseBatchLine } from '../services/mass-entry.js';

function handleQuickAdd(inputValue) {
  const parsed = parseBatchLine(inputValue);
  if (!parsed || !parsed.parsed) {
    // Fall back to treating entire input as card name, qty=1
    return { quantity: 1, name: inputValue.trim(), setCode: null, foil: false };
  }
  return parsed;
}
```

### Connectivity Chip in Topbar (index.html inline Alpine)
```html
<!-- Inside topbar, next to search -->
<div
  x-data="{ status: 'live' }"
  x-init="
    const update = () => {
      if (!navigator.onLine) { status = 'offline'; return; }
      const meta = $store.bulkdata?.updatedAt;
      if (meta && (Date.now() - new Date(meta).getTime()) > 86400000) {
        status = 'stale'; return;
      }
      status = 'live';
    };
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    setInterval(update, 60000);
  "
  class="flex items-center gap-xs px-sm py-xs"
>
  <span
    class="w-2 h-2 rounded-full"
    :class="{
      'bg-success': status === 'live',
      'bg-warning': status === 'stale',
      'bg-secondary': status === 'offline'
    }"
  ></span>
  <span
    class="font-mono text-[11px] uppercase tracking-[0.15em]"
    :class="{
      'text-success': status === 'live',
      'text-warning': status === 'stale',
      'text-secondary': status === 'offline'
    }"
    x-text="status === 'live' ? 'LIVE' : status === 'offline' ? 'OFFLINE' : 'STALE'"
  ></span>
</div>
```

### Keyboard Shortcut Cheat Sheet Modal
```javascript
// Triggered by '?' key at body level
const SHORTCUTS = [
  { key: '/', description: 'Focus global search' },
  { key: 'Escape', description: 'Close modal / clear search' },
  { key: 'Ctrl+Z', description: 'Undo last destructive action' },
  { key: '?', description: 'Show this cheat sheet' },
  { key: 'Enter', description: 'Confirm selection' },
];
```

### Auto-Refresh on Reconnect (D-16)
```javascript
window.addEventListener('online', async () => {
  const bulkMeta = await getBulkMeta();
  if (!bulkMeta?.downloadedAt) return;
  const hoursSince = (Date.now() - new Date(bulkMeta.downloadedAt).getTime()) / 3600000;
  if (hoursSince > 24) {
    // Trigger silent background refresh
    startBulkDataPipeline().catch(console.error);
  }
});
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via vitest.config.js) |
| Config file | `vitest.config.js` |
| Quick run command | `rtk vitest run --reporter=verbose` |
| Full suite command | `rtk vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | Portfolio summary computes total value, counts, change | unit | `rtk vitest run tests/dashboard-portfolio.test.js -x` | Wave 0 |
| DASH-02 | Quick Add parses batch syntax and adds card | unit | `rtk vitest run tests/quick-add.test.js -x` | Wave 0 |
| DASH-03 | Price alerts panel reads from market store | unit | Covered by existing `tests/price-alerts.test.js` | Existing |
| DASH-04 | Mila insight generated and rendered | unit | Covered by existing `tests/insight-engine.test.js` | Existing |
| DASH-05 | Activity logger writes/reads entries | unit | `rtk vitest run tests/activity-log.test.js -x` | Wave 0 |
| DASH-06 | Deck quick-launch reads deck list with images | unit | `rtk vitest run tests/dashboard-decks.test.js -x` | Wave 0 |
| DASH-07 | Upcoming releases filters future sets | unit | `rtk vitest run tests/upcoming-releases.test.js -x` | Wave 0 |
| UX-01 | Keyboard shortcuts dispatch correct actions | unit | `rtk vitest run tests/keyboard-shortcuts.test.js -x` | Wave 0 |
| UX-02 | Context menu generalised for all screens | unit | Covered by existing context-menu pattern | Existing |
| UX-03 | Undo stack push/undo/timeout behavior | unit | `rtk vitest run tests/undo-stack.test.js -x` | Wave 0 |
| PERF-02 | Offline data availability | manual-only | Verify in DevTools: disable network, reload, check data | n/a |
| PERF-04 | Deck analytics < 100ms | unit | `rtk vitest run tests/deck-analytics.test.js -x` | Existing |
| PERF-05 | Stale price indicator logic | unit | `rtk vitest run tests/connectivity-status.test.js -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `rtk vitest run --reporter=verbose`
- **Per wave merge:** `rtk vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/undo-stack.test.js` -- covers UX-03: push, undo by ID, undo last, timeout expiry
- [ ] `tests/activity-log.test.js` -- covers DASH-05: log entry, cap at 50, read order
- [ ] `tests/dashboard-portfolio.test.js` -- covers DASH-01: value computation, sparkline data, change calculation
- [ ] `tests/quick-add.test.js` -- covers DASH-02: syntax parsing integration, condition/foil defaults
- [ ] `tests/connectivity-status.test.js` -- covers PERF-05: online/offline/stale state logic
- [ ] `tests/keyboard-shortcuts.test.js` -- covers UX-01: `/`, Escape priority, `?`, Ctrl+Z dispatch
- [ ] `tests/upcoming-releases.test.js` -- covers DASH-07: filter sets to future dates
- [ ] `tests/dashboard-decks.test.js` -- covers DASH-06: top 6 decks, commander art URLs

## Sources

### Primary (HIGH confidence)
- Codebase analysis: All existing stores, services, and component patterns examined directly
- `src/stores/app.js` -- Toast store API, screen locked status
- `src/stores/collection.js` -- Stats computed property, addCard/deleteEntry methods
- `src/stores/deck.js` -- deleteDeck, removeCard methods (undo targets)
- `src/stores/market.js` -- pendingAlerts, watchlist
- `src/utils/sparkline.js` -- SVG sparkline API
- `src/utils/insight-engine.js` -- generateDailyInsight() API
- `src/services/mass-entry.js` -- parseBatchLine() syntax
- `src/services/price-history.js` -- Snapshot and history service
- `src/services/sets.js` -- fetchSets() for upcoming releases
- `src/db/schema.js` -- Current schema v5, meta table available
- `src/components/context-menu.js` -- Custom DOM event pattern
- `index.html` -- Existing keyboard handlers, topbar structure, toast template

### Secondary (MEDIUM confidence)
- Alpine.js `Alpine.effect()` for imperative DOM reactivity -- used in existing codebase but not formally documented; consistent with Alpine 3.x behavior
- `navigator.onLine` API and `online`/`offline` events -- standard Web API, well-supported

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing code examined
- Architecture: HIGH -- patterns established in 5 prior phases, direct code inspection
- Pitfalls: HIGH -- identified from actual code analysis (locked screen, sparkline data gap, escape conflicts)
- Undo system: MEDIUM -- design is sound but implementation is new territory for this codebase; needs careful testing
- Activity timeline: MEDIUM -- data structure is simple but integration points (hooking into every store mutation) need thoroughness

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable -- no external dependency changes expected)
