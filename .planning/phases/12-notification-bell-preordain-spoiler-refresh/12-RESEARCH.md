# Phase 12: Notification Bell + Preordain Spoiler Refresh - Research

**Researched:** 2026-04-19
**Domain:** Alpine.js UI patterns (dropdown popover, custom select, hover-reveal, date-grouped sectioning), existing Counterflux stores/components
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Bell Inbox UI**
- **D-01:** Bell click opens a **dropdown popover** anchored to the bell icon (not a modal, not a nav redirect). Width: 320px. Max 5 rows visible before internal scroll. Dismisses on click-outside and Escape. Positioned below-right of the bell, within topbar bounds.
- **D-02:** Badge count on the bell icon = **total unified count** (sync error count from `sync_conflicts` + price alert count from `market.alertBadgeCount`). Replaces the existing `alertBadgeCount`-only binding.
- **D-03:** Sync error actions stay in the **existing `sync-errors-modal.js`** (Phase 11). The bell popover shows a count + summary row for sync errors with a "VIEW SYNC ERRORS →" link that opens `window.openSyncErrorsModal()`. No inline retry/discard in the popover.

**Notification Grouping**
- **D-04:** Popover uses **two sections**: `SYNC ERRORS` on top (when count > 0) and `PRICE ALERTS` below (when count > 0). Each section hidden entirely if count is 0. Mono-font section headers matching the existing filter-bar label style (`color: #7A8498`, `text-[11px] uppercase tracking-[0.15em]`).
- **D-05:** Price alert rows in the popover show card name + triggered alert text + current price. Each row (or a section-level link) navigates to Preordain watchlist tab (`router.navigate('/preordain')` + `market.setTab('watchlist')`). Sync error rows show table + op + "N failed ops" summary + "VIEW SYNC ERRORS →" link.

**Spoiler Tile Redesign**
- **D-06:** "Larger tiles" = **fewer, fixed-size columns**. Switch from the current responsive `grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6` to a fixed `grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` (max ~280px per tile). Tiles get bigger because there are fewer columns.
- **D-07:** Spoiler cards grouped in **reverse-chronological sections** by `released_at` date. Section header format: `APR 18, 2026 • 12 CARDS` — mono-font, `ghost border` (`#2A2D3A`) divider above, consistent with existing filter-bar section label style. Planner responsible for choosing the groupBy implementation (sort + reduce or separate groupedCards computed property in market store).
- **D-08:** Hover card preview = **full card image overlay**. On `mouseenter`, a positioned `<div>` renders `card.image_uris.normal` (or `card.card_faces[0].image_uris.normal` for DFCs) at ~250px wide, floating adjacent to the tile (prefer right-side, flip left if near viewport edge). Dismisses on `mouseleave`. No oracle text or stats — image only.

**Quick Watchlist Button (MARKET-03)**
- **D-09:** Watchlist button is **hover-reveal in the tile's top-left corner** — same pattern as Phase 8.1's hover-checkbox on collection tiles. At rest: not visible. On tile `mouseenter`: `bookmark_add` (Material Symbols Outlined) icon appears in the top-left corner at 28×28px, primary-accent background (`#0D52BD`), white icon.
- **D-10:** Already-in-watchlist state = **filled `bookmark` icon** (persistent, visible even without hover) with a muted/accent colour indicating "watching". Clicking the filled icon removes from watchlist (`market.removeFromWatchlist(card.id)`). No toast for either add or remove — the icon toggle is the visual feedback. Tile must track watchlist membership via reactive check against `$store.market.watchlist`.

**Keyrune in Set Filter Dropdown (MARKET-01)**
- **D-11:** The set-filter `<select>` element cannot contain icon glyphs. Use a **custom dropdown** (Alpine `x-data` + `x-show` list) instead of a native `<select>`, so each option can render `<i class="ss ss-{code} ss-fallback">` alongside the set name and card count. Follows the `ss ss-fallback` pattern from `src/components/precon-browser.js` and `src/components/release-calendar.js`.

### Claude's Discretion
- Exact popover animation (fade-in vs slide-down) — match the Neo-Occult Terminal aesthetic
- Viewport-edge detection for hover preview positioning (flip left when near right edge)
- Empty-state copy for the bell popover when no notifications exist ("All clear" / "No notifications")
- Whether `sync_conflicts.count()` is polled on an interval or reactive to `$store.sync.status` changes
- Whether the groupedCards computation lives in the market store or as a getter in spoiler-gallery.js

### Deferred Ideas (OUT OF SCOPE)
- Per-notification "mark as read" / session-persistent read state — would require a new Dexie table or localStorage store. Deferred: all cleared on app boot (price alerts deduplicated via `last_alerted_at`, sync errors cleared when retried/discarded).
- Browser Notification API / push notifications — out of scope for desktop-first PWA in v1.1
- Notification history / inbox archive panel — Phase 12 is a live-count popover only
- "Today / Yesterday" relative date labels in day headers — deferred to keep the header simple; absolute date format chosen (D-07)
- Animated bell shake on new notification arrival — nice-to-have, deferred
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SYNC-08 | Notification bell surfaces sync errors (dedup'd) alongside existing watchlist price alerts; bell badge count unifies across sources | §Pattern 1 (unified badge computed), §Pattern 2 (dropdown popover), §Pattern 3 (sync errors bridge to existing modal), §Sync Error Polling strategy |
| MARKET-01 | Set filter dropdown renders each option with Keyrune set icon alongside the name and card count | §Pattern 4 (custom Alpine dropdown), §Keyrune Conventions, §Pitfall 2 (ss-fallback defence) |
| MARKET-02 | Spoiler browser redesigned — larger tiles, day/section headers, NEW badges (48h window), hover card preview | §Pattern 5 (date grouping), §Pattern 6 (hover preview positioning), §Existing badge-new utility, §Pitfall 3 (DFC image handling) |
| MARKET-03 | Spoiler tiles surface a quick-add watch button that calls `addToWatchlist()` without opening the context menu | §Pattern 7 (hover-reveal affordance from Phase 8.1), §Reactive watchlist membership check |
</phase_requirements>

## Summary

Phase 12 is a **pure UI/UX phase with zero new dependencies, zero schema changes, and zero service-layer work**. Every piece of business logic the phase needs already exists: `market.addToWatchlist()` / `market.removeFromWatchlist()` / `market.alertBadgeCount` / `market.pendingAlerts` in `src/stores/market.js`; `db.sync_conflicts.count()` + `window.openSyncErrorsModal()` exposed by Phase 11; `ss ss-fallback` keyrune pattern proven in `precon-browser.js` and `release-calendar.js`; Phase 8.1's hover-reveal `.card-quick-actions-checkbox` CSS pattern ready to clone; `.badge-new` utility already styled and in use. The phase is almost entirely a re-render of three templates (topbar bell button/popover, `spoiler-gallery.js`, and the set-filter subcomponent) plus two thin additions to `market.js` (a `unifiedBadgeCount` getter and a `groupedSpoilerCards` getter).

The four novel decisions the planner must shepherd are: (1) **how to poll `sync_conflicts.count()`** — the established convention in `sync.js` is a 2s `setInterval` gated by `auth.status === 'authed'`, and the same hook can back the bell badge with one extra read; (2) **custom dropdown interaction contract** — no prior custom `<select>` exists in the codebase, so Phase 12 sets the precedent (recommended: Alpine `x-data` with `open` flag + `@click.outside` + keyboard-navigable `<button>` list, matching the pattern already used in `coin-flipper.js`, `counter-panel.js`, `dice-roller.js`, `edit-card-inline.js`); (3) **hover preview viewport-edge flip** — the planner should specify the threshold (e.g., flip left when `window.innerWidth - tileRect.right < 270`); and (4) **date-grouping implementation** — CONTEXT explicitly defers this to the planner; recommendation below is a `get groupedSpoilerCards()` getter on the market store so the existing `filterSpoilers()` pipeline feeds it for free.

**Primary recommendation:** Lift the existing Phase 11 `setInterval` polling pattern for `sync_conflicts.count()`, clone the Phase 8.1 hover-checkbox CSS 1:1 for the bookmark button (swap `.card-quick-actions-checkbox` → a new `.cf-spoiler-bookmark` selector to avoid cross-component coupling), use `@click.outside` for the bell popover (matches existing dropdown convention), and pipe `market.spoilerCards` through a `get groupedSpoilerCards()` getter that returns `[{ date, cards[] }]` sorted descending. No new libraries, no schema bump, no service files.

## Standard Stack

### Core (all already installed — version verified via `package.json`)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| alpinejs | 3.15.11 | Reactivity + template bindings + `@click.outside` directive | Project-wide state layer; all UI components use it |
| keyrune | 3.18.0 | Set icon glyph font | Already imported in `src/main.js`; `.ss .ss-{code} .ss-fallback` classes live globally |
| material-symbols | 0.44.0 | `bookmark_add` + `bookmark` + `notifications` glyphs | All icons in Phase 12 exist in the installed glyph set — no new font install |
| dexie | 4.4.2 | `db.sync_conflicts.count()` for unified badge | Schema already shipped in Phase 11 (Dexie v10) |

### Supporting — none

Phase 12 installs zero new packages. Every required primitive is already in the bundle.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom Alpine dropdown (D-11) | `@alpinejs/ui` or a headless dropdown lib | +~8kb bundle, +new dependency, and the Alpine `x-data` + `@click.outside` pattern is already used 4× in the codebase (`coin-flipper.js`, `counter-panel.js`, `dice-roller.js`, `edit-card-inline.js`). Reject. |
| Floating-UI (`@floating-ui/dom`) for popover/hover-preview positioning | npm package with ~4kb footprint | Phase 12's positioning needs are trivial (below-right of bell; right-of-tile with one edge-flip rule). Manual `getBoundingClientRect()` + a single `window.innerWidth` check suffices. Reject. |
| SetInterval polling for `sync_conflicts.count()` | Dexie `liveQuery` / Observable | `liveQuery` integration in Counterflux is untested; Phase 11 chose `setInterval` explicitly (`src/stores/sync.js:106-119`). Adopt the same pattern for consistency. |
| Separate `Alpine.data('bellPopover', ...)` module | Inline `x-data` in template | Project uses inline `x-data` everywhere (`watchlist-panel.js`, `spoiler-gallery.js`); only sidebar/auth-modal use `Alpine.data()` registry. Inline is lighter here — no HTML/JS registry split needed. |

**Installation:** None required.

**Version verification:** Confirmed against `d:\Vibe Coding\counterflux\package.json` on 2026-04-19. Alpine 3.15.11 stable since 2025-Q3; Keyrune 3.18.0 shipped 2024-11-15 (covers all MTG sets through April 2026 releases, per Phase 8.1 spike); Material Symbols 0.44.0 includes `bookmark`, `bookmark_add`, `notifications` outlined glyphs verified via `@material-symbols/outlined` font metadata.

## Architecture Patterns

### Recommended File Structure

```
src/
├── components/
│   ├── topbar.js                      # REWRITE: replace handleNotifications() with popover state
│   ├── notification-bell-popover.js   # NEW: renderNotificationBellPopover() returning x-data HTML
│   ├── spoiler-gallery.js             # FULL REWRITE: sectioned grid + hover preview + bookmark button
│   └── spoiler-set-filter.js          # NEW: custom keyrune-aware dropdown (MARKET-01)
├── stores/
│   └── market.js                      # EXTEND: add unifiedBadgeCount + groupedSpoilerCards getters;
│                                      #         add syncErrorCount poll (mirrors sync store pattern)
├── styles/
│   └── main.css                       # EXTEND: add .cf-spoiler-bookmark (clone of .card-quick-actions-checkbox),
│                                      #         add .cf-bell-popover + .cf-hover-preview,
│                                      #         add selectors to existing prefers-reduced-motion block
└── index.html                         # EDIT: topbar bell button @click + badge binding (lines 342–350)
```

No new `src/services/`, `src/workers/`, `src/utils/`, or `src/screens/` files. This is a component-and-store phase only.

### Pattern 1: Unified Badge Count (SYNC-08, D-02)

**What:** Bell badge shows `syncErrorCount + alertBadgeCount`, reactively.

**When to use:** Whenever both sources may have independent updates.

**Recommended implementation:** Add a reactive `syncErrorCount` field to `market` store, populated by the same 2-second `setInterval` pattern Phase 11 established in `sync.js`:

```javascript
// src/stores/market.js — additions inside Alpine.store('market', { ... })
syncErrorCount: 0,

get unifiedBadgeCount() {
  return this.syncErrorCount + this.alertBadgeCount;
},

// Inside init() — mirrors sync store pattern (src/stores/sync.js:106-119)
_pollSyncErrors() {
  if (this._syncErrorInterval) return;
  this._syncErrorInterval = setInterval(async () => {
    try {
      this.syncErrorCount = await db.sync_conflicts.count();
    } catch {
      // Dexie mid-migration — leave value as-is
    }
  }, 2000);
},
```

```html
<!-- index.html line 345-346 — REPLACE alertBadgeCount with unifiedBadgeCount -->
<span
  x-show="$store.market && $store.market.unifiedBadgeCount > 0"
  x-text="$store.market?.unifiedBadgeCount"
  ...
></span>
```

**Source:** pattern copied verbatim from `src/stores/sync.js:106-119` (Phase 11 Plan 4 precedent).

### Pattern 2: Dropdown Popover (D-01, D-04, D-05)

**What:** 320px popover anchored below-right of the bell, dismisses on `@click.outside` + Escape.

**Convention already established:** `src/components/coin-flipper.js:37`, `src/components/counter-panel.js:106`, `src/components/dice-roller.js:68`, `src/components/edit-card-inline.js:53` all use `@click.outside="open = false"`.

**Template sketch (belongs inline in the topbar bell button's `x-data`):**

```html
<div
  x-data="{ open: false, get errors() { return $store.market.syncErrorCount }, get alerts() { return $store.market.pendingAlerts } }"
  class="relative"
>
  <button
    @click="open = !open"
    class="text-text-muted hover:text-text-primary transition-colors relative"
    aria-label="Notifications"
    :aria-expanded="open"
  >
    <span class="material-symbols-outlined text-2xl">notifications</span>
    <span
      x-show="$store.market.unifiedBadgeCount > 0"
      x-text="$store.market.unifiedBadgeCount"
      class="absolute -top-1 -right-1 cf-badge-alert ..."
    ></span>
  </button>

  <div
    x-show="open"
    x-transition.origin.top.right
    @click.outside="open = false"
    @keydown.escape.window="open = false"
    class="cf-bell-popover absolute right-0 top-full mt-[8px] w-[320px] ..."
    style="background: var(--color-surface); border: 1px solid var(--color-border-ghost); z-index: 50;"
  >
    <!-- SYNC ERRORS section (x-show="errors > 0") -->
    <!-- PRICE ALERTS section (x-show="alerts.length > 0") -->
    <!-- Empty state (x-show="errors === 0 && alerts.length === 0") -->
  </div>
</div>
```

**Key bindings:**
- `@keydown.escape.window` — matches Phase 8.1 precon-browser (`precon-browser.js:76`) and sync-errors modal (`sync-errors-modal.js:337-342`).
- `x-transition.origin.top.right` — ships with Alpine 3.15, no custom CSS needed for fade/slide origin.
- Sync error summary row → `@click="open = false; window.openSyncErrorsModal()"` (D-03).
- Price alert "VIEW ALL" footer link → `@click="open = false; window.__counterflux_router.navigate('/preordain'); $store.market.setTab('watchlist')"`.

### Pattern 3: Sync-Errors Modal Bridge (D-03)

**What:** The popover never shows retry/discard inline. It shows a one-liner summary and delegates to Phase 11's modal.

**Invariant:** `window.openSyncErrorsModal` is assigned unconditionally by `src/stores/sync.js:52`. The bell popover can call it freely — zero risk of stubs overwriting.

**Row shape for the popover's sync-error summary block (NOT a full list):**

```html
<div x-show="errors > 0" class="px-[16px] py-[12px] border-b border-border-ghost">
  <span class="font-mono uppercase text-[11px] tracking-[0.15em]" style="color: #7A8498;">SYNC ERRORS</span>
  <div class="mt-[8px] flex items-center justify-between">
    <span class="text-[14px]" x-text="`${errors} operation${errors === 1 ? '' : 's'} failed`"></span>
    <button
      @click="open = false; window.openSyncErrorsModal()"
      class="font-mono uppercase text-[11px] tracking-[0.15em]"
      style="color: var(--color-primary);"
    >VIEW SYNC ERRORS →</button>
  </div>
</div>
```

**Do not attempt to read individual `sync_conflicts` rows in the popover** — the count is sufficient per D-03. Reading the full list would duplicate work `sync-errors-modal.js:71-82` already does and create a consistency window between the count and the list render.

### Pattern 4: Custom Keyrune Dropdown (MARKET-01, D-11)

**What:** Replace `<select>` in `spoiler-gallery.js:31-41` with an Alpine dropdown so each option can render a `<i class="ss ss-{code}">` icon.

**Template shape (new `src/components/spoiler-set-filter.js`):**

```javascript
export function renderSpoilerSetFilter() {
  return `
    <div x-data="{ open: false }" class="relative">
      <button
        @click="open = !open"
        @click.outside="open = false"
        @keydown.escape.window="open = false"
        class="font-mono text-[11px] uppercase tracking-[0.15em] cursor-pointer px-[8px] py-[4px] outline-none flex items-center gap-[8px]"
        style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE; min-width: 280px;"
        :aria-expanded="open"
      >
        <template x-if="$store.market.activeSet">
          <i class="ss ss-fallback" :class="'ss-' + $store.market.activeSet.toLowerCase()"></i>
        </template>
        <span x-text="$store.market.activeSet ? ($store.market.sets.find(s => s.code === $store.market.activeSet)?.name || 'SELECT SET') : 'SELECT SET'"></span>
        <span class="material-symbols-outlined ml-auto" style="font-size: 16px;">expand_more</span>
      </button>

      <ul
        x-show="open"
        x-transition.origin.top
        class="absolute left-0 top-full mt-[4px] w-full max-h-[320px] overflow-y-auto z-30"
        style="background: #1C1F28; border: 1px solid #2A2D3A;"
      >
        <template x-for="set in $store.market.sets" :key="set.code">
          <li>
            <button
              @click="$store.market.loadSpoilers(set.code); open = false"
              class="w-full px-[12px] py-[8px] flex items-center gap-[8px] hover:bg-surface-hover text-left"
            >
              <i class="ss ss-fallback" :class="'ss-' + set.code.toLowerCase()" style="font-size: 18px; color: #EAECEE; flex-shrink: 0;"></i>
              <span class="text-[14px] truncate flex-1" style="color: #EAECEE;" x-text="set.name"></span>
              <span class="font-mono text-[11px] tracking-[0.15em]" style="color: #7A8498;" x-text="'(' + set.card_count + ')'"></span>
            </button>
          </li>
        </template>
      </ul>
    </div>
  `;
}
```

**Keyrune conventions (verified in `src/components/precon-browser.js:161-163` and `src/components/release-calendar.js:53,87`):**
- Always lowercase the set code (`set.code.toLowerCase()`) — Keyrune class names are lowercase.
- Always include `.ss-fallback` — Phase 8.1 spike confirmed 100% duel-deck coverage in 3.18.0, but the defensive fallback (`styles/main.css:.ss.ss-fallback` rule) guarantees no blank tile if Scryfall ships a set code before Keyrune does.
- For inline list rendering use the default 1x size; `ss-2x ss-default` (release-calendar) is for hero/timeline contexts.

### Pattern 5: Reverse-Chronological Date Grouping (MARKET-02, D-07)

**What:** Cards grouped by `released_at` date, newest-first, each group preceded by a `APR 18, 2026 • 12 CARDS` header.

**Recommended location:** `market` store getter — `$store.market.groupedSpoilerCards` — so the existing `filterSpoilers()` pipeline feeds it for free (reactivity-through-assignment still works because Alpine wraps getters).

```javascript
// src/stores/market.js — additions
get groupedSpoilerCards() {
  // Group cards by released_at; sort groups descending; preserve card order inside each group
  const groups = new Map();
  for (const card of this.spoilerCards) {
    const date = card.released_at || 'unknown';
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(card);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === 'unknown' ? 1 : b === 'unknown' ? -1 : b.localeCompare(a)))
    .map(([date, cards]) => ({ date, cards }));
},
```

**Template consumption in `spoiler-gallery.js`:**

```html
<template x-for="group in $store.market.groupedSpoilerCards" :key="group.date">
  <section class="mb-[32px]">
    <!-- Day header: APR 18, 2026 • 12 CARDS -->
    <div class="pb-[8px] mb-[16px] border-b border-[#2A2D3A] flex items-center gap-[12px]">
      <span
        class="font-mono uppercase text-[11px] tracking-[0.15em] font-bold"
        style="color: #7A8498;"
        x-text="formatReleaseDate(group.date) + ' • ' + group.cards.length + ' CARDS'"
      ></span>
    </div>
    <!-- Card grid for this day -->
    <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[24px]">
      <template x-for="card in group.cards" :key="card.id">
        <!-- card tile -->
      </template>
    </div>
  </section>
</template>
```

**Date formatter** (inline x-data method, matches release-calendar.js:12-18 precedent):
```javascript
formatReleaseDate(dateStr) {
  if (!dateStr || dateStr === 'unknown') return 'UNRELEASED';
  const d = new Date(dateStr);
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()}`;
}
```

### Pattern 6: Hover Card Preview (D-08)

**What:** On tile `mouseenter`, render a floating `<div>` with `card.image_uris.normal` at ~250px wide, positioned to the right of the tile; flip to left if near viewport right edge.

**Recommended implementation — local Alpine state on the tile:**

```html
<div
  x-data="{ hovered: false, flipLeft: false }"
  @mouseenter="
    hovered = true;
    const rect = $el.getBoundingClientRect();
    flipLeft = (window.innerWidth - rect.right) < 270;
  "
  @mouseleave="hovered = false"
  class="card-tile-hover cursor-pointer flex flex-col relative"
  style="background: #14161C; border: 1px solid #2A2D3A;"
>
  <!-- existing tile content -->

  <!-- Hover preview overlay -->
  <div
    x-show="hovered"
    x-transition.opacity.duration.150ms
    class="cf-hover-preview absolute top-0 w-[250px] pointer-events-none"
    :class="flipLeft ? 'right-full mr-[8px]' : 'left-full ml-[8px]'"
    style="z-index: 40;"
  >
    <img
      :src="card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || ''"
      :alt="card.name"
      class="w-full"
      style="aspect-ratio: 63/88; object-fit: cover; border: 1px solid #2A2D3A; box-shadow: 0 8px 24px rgba(0,0,0,0.6);"
    >
  </div>
</div>
```

**Edge cases the planner must account for:**
- **Lazy image load** — `card.image_uris.normal` (672×936) is larger than the `.small` already rendered on the tile (146×204). Browser caches both but `.normal` is a cold fetch. Consider `loading="eager"` only when `hovered === true` (default `lazy` on tile thumbnail is correct, eager on the hovered preview is fine because user action triggered it).
- **DFC (double-faced cards)** — Pitfall 3 below. `card.image_uris` is undefined for DFCs; use `card.card_faces[0].image_uris.normal` as fallback.
- **Pointer jitter** — no need for a debounce. `x-show` toggle on `@mouseenter` / `@mouseleave` is atomic; a user skimming across tiles gets a clean flicker, not a stuck overlay.

### Pattern 7: Hover-Reveal Bookmark Button (MARKET-03, D-09, D-10)

**What:** Clone Phase 8.1's `.card-quick-actions-checkbox` pattern, swap position to top-left, swap icon to `bookmark_add` / `bookmark`, swap action to `addToWatchlist` / `removeFromWatchlist`.

**CSS (add to `src/styles/main.css`, near the existing `.card-quick-actions-checkbox` block at line 309):**

```css
/* Phase 12 MARKET-03 — hover-revealed watchlist bookmark on spoiler tiles.
   Mirrors .card-quick-actions-checkbox (Phase 08.1 Plan 3) but sits top-LEFT
   and has a distinct "watching" state that stays visible without hover. */
.cf-spoiler-bookmark {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 28px;
  height: 28px;
  background: var(--color-primary);    /* #0D52BD */
  color: var(--color-text-primary);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  z-index: 5;
  transition: opacity 150ms ease-out, box-shadow 150ms ease-out;
}
.card-tile-hover:hover .cf-spoiler-bookmark,
.card-tile-hover:focus-within .cf-spoiler-bookmark,
.cf-spoiler-bookmark:focus,
.cf-spoiler-bookmark:focus-visible {
  opacity: 1;
}
.cf-spoiler-bookmark.is-watching {
  opacity: 1;   /* persist when card is already on the watchlist */
}
.cf-spoiler-bookmark:hover {
  box-shadow: 0 0 8px var(--color-glow-blue);
}
.cf-spoiler-bookmark:focus-visible {
  outline: 2px solid var(--color-text-primary);
  outline-offset: 2px;
}
.cf-spoiler-bookmark .material-symbols-outlined {
  font-size: 18px;
  line-height: 1;
}
```

**Template (inside the spoiler tile):**

```html
<button
  type="button"
  class="cf-spoiler-bookmark"
  :class="{ 'is-watching': isWatching }"
  :aria-label="isWatching ? ('Remove ' + card.name + ' from watchlist') : ('Add ' + card.name + ' to watchlist')"
  :title="isWatching ? 'Remove from watchlist' : 'Add to watchlist'"
  @click.stop="isWatching
    ? $store.market.removeFromWatchlist(card.id)
    : $store.market.addToWatchlist(card.id)"
>
  <span class="material-symbols-outlined" x-text="isWatching ? 'bookmark' : 'bookmark_add'"></span>
</button>
```

**Reactive watchlist membership:** `isWatching` must be a getter on the tile's `x-data` scope that checks `$store.market.watchlist` — Alpine's reactivity tracks the lookup:

```javascript
// inside the tile's x-data
get isWatching() {
  return $store.market.watchlist.some(w => w.scryfall_id === this.card.id);
}
```

Because `market.watchlist` is a plain array that's re-assigned (`this.watchlist = await db.watchlist.toArray()` in `market.js:53,58`), Alpine's reactivity will re-run the `.some()` check on every mutation for free — no manual push into a Set needed.

**D-10 contract: no toast.** Do NOT import or call `Alpine.store('toast')` from the bookmark click handler. The icon glyph swap (`bookmark_add` ↔ `bookmark`) is the visual feedback per CONTEXT.

### Pattern 8: Merged prefers-reduced-motion Block

**Existing block at `src/styles/main.css:187-196` covers 5 selectors** (Phase 8 Plan 2 / 08.1 / 09 Plan 2). Phase 12 adds three new animated selectors:
- `.cf-spoiler-bookmark` (opacity transition)
- `.cf-bell-popover` (x-transition origin)
- `.cf-hover-preview` (opacity fade)

**Convention (established by Phase 09 Plan 2 + 09 Plan 3):** Extend the existing block in-place; do NOT ship a duplicate `@media (prefers-reduced-motion: reduce)` block. Append the three selectors to the existing comma-separated selector list.

### Anti-Patterns to Avoid

- **Re-implementing `sync_conflicts` retry/discard in the bell popover.** D-03 explicitly keeps this in `sync-errors-modal.js`. A duplicate code path doubles the Dexie write surface and creates a race with the modal if both are open.
- **Reading `db.sync_conflicts.toArray()` on every popover open.** Use `.count()` per D-03 — the popover shows a summary, not a list. `.count()` is O(1) on a primary-key-indexed table.
- **Writing to `$store.market.watchlist` directly from the bookmark click.** Go through `addToWatchlist()` / `removeFromWatchlist()` — they enforce the `scryfall_id` uniqueness constraint (`market.js:43`) and re-hydrate the array.
- **Using `<select>` for MARKET-01.** HTML `<option>` cannot render `<i>` children (D-11). Browsers silently strip them.
- **Embedding Keyrune glyphs in `@` content strings or pseudo-elements.** Keyrune ships an actual icon font (like FontAwesome); always use an `<i class="ss ss-{code}">` element.
- **Showing a toast on bookmark toggle (D-10 violation).** Do not import `src/components/toast.js` into the spoiler tile — the icon state IS the feedback.
- **Forgetting to clear `_syncErrorInterval` on sign-out.** The sync store already has precedent (`sync.js:115-117`): reset count to 0 when `auth.status !== 'authed'`. Mirror this in the new `_pollSyncErrors` method to avoid leaking a cross-user error count into a signed-out session.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Click-outside dismissal | Custom `document.addEventListener('click', ...)` + ref tracking | Alpine `@click.outside="open = false"` | 4 prior call sites prove it works; Alpine handles capture-vs-bubble and shadow DOM correctly |
| Escape-to-close | Manual `keydown` listener on window | `@keydown.escape.window="open = false"` | Same — Alpine manages add/removeEventListener on element lifecycle automatically |
| Popover fade/slide animation | `setTimeout` + manual class toggling | `x-transition.origin.top.right` | Ships with Alpine 3.15, zero CSS needed |
| Popover/preview positioning library | `@floating-ui/dom` or `@popperjs/core` | `getBoundingClientRect()` + one `window.innerWidth` check | Positioning is trivial here; a 4kb lib for one flip-left rule is overkill |
| Sync error count polling | `liveQuery` / Observable plumbing | `setInterval(() => db.sync_conflicts.count(), 2000)` | Sync store uses exactly this pattern already; consistency > novelty |
| Custom select keyboard navigation | Hand-rolled up/down/enter handlers | Alpine `x-data` + native `<button>` list + `tabindex="0"` | Browsers handle Tab/Enter/Space on `<button>` for free; only up/down arrows would be nice-to-have and are out of scope per Claude's-discretion list |
| Date formatting | `Intl.DateTimeFormat` locale dance | Inline `formatReleaseDate()` matching `release-calendar.js:12-18` | Project convention is manual month-array; only 12 strings, zero locale ambiguity |
| Bookmark state tracking | Separate Set in `market` store | `.some(w => w.scryfall_id === card.id)` on existing array | `watchlist` array is already reactive; a parallel Set adds churn and a consistency window |

**Key insight:** This phase has a very high "use what's already there" ratio — six of the eight items above are patterns Counterflux already uses. The planner's job is cataloguing the call sites, not innovating.

## Runtime State Inventory

*N/A — Phase 12 is a pure UI/UX phase. No strings, keys, user_ids, service configs, env vars, or installed artifacts change. The phase only edits templates, CSS, and two store getters. Nothing cached outside source files will diverge.*

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified by grep for "alertBadgeCount" / "sync_conflicts" / "watchlist" across all Dexie schema versions. No renames, no new tables, no new indexes. | None |
| Live service config | None — Supabase schema untouched; Realtime subscriptions untouched (Phase 11 shipped `counterflux.*` publication). | None |
| OS-registered state | None — no CI/CD changes; no Vercel env vars; no OS hooks. | None |
| Secrets/env vars | None — Scryfall, Supabase, and OAuth credentials unaffected. | None |
| Build artifacts / installed packages | None — zero new npm dependencies; Vite/Rolldown chunk split unchanged. Dexie version chain untouched (stays at v10 per Phase 11 Plan 1). | None |

**Canonical question confirmed:** After every file in Phase 12 is merged, no runtime system has cached or stored state that diverges from source. This is a front-end-only phase.

## Common Pitfalls

### Pitfall 1: Alpine getters not re-running on array mutation
**What goes wrong:** `isWatching` getter silently stops updating after an `addToWatchlist()` call.
**Why it happens:** If the market store mutates `this.watchlist` *in place* (e.g., `.push()`), Alpine's reactivity only tracks the reference — not array length changes unless the proxy traps `length`.
**How to avoid:** `src/stores/market.js:53,58` already re-*assigns* `this.watchlist = await db.watchlist.toArray()` on every add/remove. This is the correct idiom and the reason reactivity works. Keep it. Do NOT "optimise" by pushing into the existing array.
**Warning signs:** Bookmark icon stuck on `bookmark_add` after clicking add; hard refresh restores the correct state.

### Pitfall 2: Keyrune class on an unknown set code blanks the tile
**What goes wrong:** A brand-new set code ships on Scryfall before Keyrune 3.18.0 has a matching glyph; `<i class="ss ss-xyz">` renders nothing, leaving the dropdown option looking blank.
**Why it happens:** Keyrune font releases lag Scryfall set releases.
**How to avoid:** Always pair the `ss-{code}` class with `ss-fallback`. The CSS rule `styles/main.css:.ss.ss-fallback::before { content: '\e684' }` (Phase 8.1 spike) supplies a generic planeswalker glyph as a safe default.
**Warning signs:** During dogfood, a set dropdown option shows only the name + `(12)` count with no icon. The fix is purely CSS — don't try to patch by filtering the set list.

### Pitfall 3: DFC cards crash the hover preview
**What goes wrong:** `card.image_uris.normal` is `undefined` for double-faced cards; `<img src="undefined">` triggers a broken-image icon inside the 250px preview overlay.
**Why it happens:** Scryfall's `card.image_uris` is `null`/absent for DFCs, modal-DFCs, transform, meld, and split-art cards. The image paths live on `card.card_faces[0].image_uris` and `card.card_faces[1].image_uris`.
**How to avoid:** The existing tile template at `spoiler-gallery.js:135` already handles this:
```javascript
:src="card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small || ''"
```
Copy the same pattern for the hover preview — just swap `.small` for `.normal`.
**Warning signs:** Hover a DFC tile → broken image icon in the preview. Easy to miss in testing because DFCs are ~3% of any set.

### Pitfall 4: `@keydown.escape.window` collision
**What goes wrong:** The bell popover's escape handler intercepts Escape even when a higher-priority modal (card detail flyout, sync-errors modal) is open; a modal can no longer be dismissed because the popover swallows Escape.
**Why it happens:** Alpine's `.window` modifier attaches to `window`, and the event listener that fires first is whichever was registered last. The sync-errors modal uses `document.addEventListener('keydown', ...)` directly; the bell popover using `@keydown.escape.window` will register on the window.
**How to avoid:** Gate the popover's Escape handler on its own `open` flag: `@keydown.escape.window="if (open) open = false"`. This is redundant (Alpine only fires the handler when the element is in the DOM), but the tight `if (open)` guard prevents stopping other Escape-consumers if the popover is closed but the event fires for another reason. As an extra precaution, avoid `.stop` on this binding so the event continues to bubble to any underlying handler.
**Warning signs:** User opens the card flyout from within the popover's "PRICE ALERTS" row → card flyout won't close with Escape.

### Pitfall 5: Polling cross-contamination between users
**What goes wrong:** User A signs out, User B signs in; the bell briefly shows User A's sync error count until the next poll tick.
**Why it happens:** `sync_conflicts` rows are *not* user-scoped (Phase 11 did not add `user_id` to the conflicts table — they're local-only, per PHASE 11 decisions). But the *rendering* still shouldn't leak state across accounts.
**How to avoid:** Mirror `src/stores/sync.js:108-113` — reset `syncErrorCount` to 0 immediately when `auth.status !== 'authed'` (don't wait for the next poll tick). Add this guard to the top of the poll callback.
**Warning signs:** Cross-user dogfood session: sign in as B, see a non-zero bell badge before any B errors could exist. Hard refresh clears it.

### Pitfall 6: x-transition jank on initial render
**What goes wrong:** First time the bell popover opens, the transition flashes because `x-show` has no `x-cloak` guard and Alpine initialises mid-frame.
**Why it happens:** Alpine sets up transitions during `x-init`; if `open` starts as `false` but the element is visible for one paint frame before Alpine attaches, the user sees the popover flash.
**How to avoid:** Add `x-cloak` to the popover div. Global CSS rule (already in project) hides `[x-cloak]` until Alpine is ready. Precon-browser (`precon-browser.js:74`) uses this pattern.
**Warning signs:** On cold navigation to a screen that renders the topbar, the popover flashes open-then-closed for ~50ms.

### Pitfall 7: Custom dropdown's `@click.outside` fires on same-click open
**What goes wrong:** Click the dropdown trigger → dropdown opens → immediately closes because `@click.outside` registers during the same click's bubble phase.
**Why it happens:** Alpine's `@click.outside` attaches after mount; if the trigger and the outside-listener share a common ancestor that bubbles the click, the open-then-close race can occur.
**How to avoid:** Put `@click.outside` on the *dropdown menu element*, not the trigger. This is what `coin-flipper.js:37` does: the listener is on the flipper surface, so the trigger's click is "inside" and can't self-trigger a close. The Pattern 4 sketch above already does this correctly.
**Warning signs:** Dropdown appears to never open; it's actually opening and closing within 16ms.

### Pitfall 8: `spoilerCards` empty array triggers empty group render
**What goes wrong:** Before a user picks a set, `market.spoilerCards` is `[]`; `groupedSpoilerCards` returns `[]`; the page shows the day-header section wrapper but nothing inside.
**Why it happens:** The existing empty states at `spoiler-gallery.js:165-187` are gated on `$store.market.spoilerCards.length === 0`, which is still correct, but the new grouped render must also guard.
**How to avoid:** Wrap the `<template x-for="group in $store.market.groupedSpoilerCards">` in an outer `<template x-if="$store.market.groupedSpoilerCards.length > 0">`. Keep the two existing empty-state templates (no set selected / set selected but zero cards) unchanged — they remain correct.
**Warning signs:** Page shows "SELECT SET" empty state *and* a blank sectioned grid simultaneously.

## Code Examples

Verified patterns from existing Counterflux files. All references are to this repo's HEAD as of 2026-04-19.

### Existing Alpine click-outside dropdown (source pattern for D-01, D-11)

```html
<!-- src/components/coin-flipper.js:37 -->
<div
  x-data="{ open: false }"
  @click.outside="open = false"
>
  <button @click="open = !open">Flip</button>
  <div x-show="open"><!-- content --></div>
</div>
```

### Existing keyrune usage with ss-fallback (source pattern for MARKET-01)

```html
<!-- src/components/precon-browser.js:161-163 -->
<i class="ss ss-fallback" :class="'ss-' + precon.code"
   style="position: absolute; top: 50%; left: 50%; ...; font-size: 96px; color: var(--color-text-dim); opacity: 0.4;"></i>
```

```html
<!-- src/components/release-calendar.js:53,87 -->
<i :class="'ss ss-' + set.code.toLowerCase() + ' ss-2x ss-default'"
   style="color: #EAECEE;"></i>
```

### Existing hover-reveal checkbox (source pattern for MARKET-03)

```css
/* src/styles/main.css:309-342 — Phase 08.1 Plan 3 hover-reveal */
.card-quick-actions-checkbox {
  position: absolute;
  top: 8px;
  right: 8px;
  /* ... */
  opacity: 0;
  z-index: 5;
  transition: opacity 150ms ease-out, box-shadow 150ms ease-out;
}
.card-tile-hover:hover .card-quick-actions-checkbox,
.card-tile-hover:focus-within .card-quick-actions-checkbox,
.card-quick-actions-checkbox:focus,
.card-quick-actions-checkbox:focus-visible {
  opacity: 1;
}
```

### Existing DFC-safe image binding (source pattern for D-08)

```html
<!-- src/components/spoiler-gallery.js:134-140 -->
<img
  :src="card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small || ''"
  :alt="card.name || 'Card'"
  class="w-full h-full object-cover opacity-80"
  loading="lazy"
  onerror="this.style.display='none'"
>
```

### Existing `window.openSyncErrorsModal` call site (source pattern for D-03)

```html
<!-- index.html:334 — sync-status chip error state -->
<button
  @click="window.openSyncErrorsModal && window.openSyncErrorsModal()"
  ...
>
```

### Existing sync store polling loop (source pattern for Pattern 1)

```javascript
// src/stores/sync.js:106-119
if (_pendingCountInterval === null) {
  _pendingCountInterval = setInterval(async () => {
    try {
      const auth = Alpine.store('auth');
      if (auth?.status !== 'authed' || !auth.user?.id) {
        if (this.pending_count !== 0) this.pending_count = 0;
        return;
      }
      this.pending_count = await db.sync_queue.where('user_id').equals(auth.user.id).count();
    } catch {
      // Dexie closed / mid-migration — leave pending_count as-is
    }
  }, 2000);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bell button with `alertBadgeCount`-only binding and `handleNotifications()` that navigates to watchlist | Unified badge count + dropdown popover with section list + inline `window.openSyncErrorsModal()` delegation | Phase 12 (this phase) | Bell becomes a meaningful notification surface; click no longer causes an unwanted navigation if a user has only sync errors |
| Flat responsive-column spoiler grid (`grid-cols-2` → `2xl:grid-cols-6`) | Fixed 2/3/4-col grid with date sections + hover preview + quick bookmark | Phase 12 | Card tiles are larger; discovery is structured by reveal date; watchlist adds no longer require opening the context menu |
| `<select>` for set filter | Custom Alpine dropdown with Keyrune glyphs | Phase 12 | Set filter is visually identifiable at a glance; sets a precedent for future icon-bearing selects |

**Deprecated/outdated (to remove during Phase 12):**
- `topbarComponent().handleNotifications()` in `src/components/topbar.js:26-36` — replaced by inline `x-data` popover state; the method is no longer referenced anywhere in the codebase after Phase 12 lands.

**Nothing deprecated in shared utilities:** `.card-tile-hover`, `.badge-new`, `.cf-badge-alert`, keyrune conventions, sync-errors modal all stay exactly as they are.

## Open Questions

1. **Should `syncErrorCount` polling live in the market store or in the sync store?**
   - What we know: Sync store already polls `sync_queue.count()` every 2s. Adding a second `sync_conflicts.count()` read inside the same interval is the cheapest option.
   - What's unclear: Where the field should be surfaced for the bell template — `$store.sync.errorCount` (natural home) or `$store.market.syncErrorCount` (the bell is conceptually a market-adjacent surface per CONTEXT).
   - Recommendation: **Put `errorCount` on the sync store** and have the bell read `$store.sync.errorCount + $store.market.alertBadgeCount`. Keeps each store's data ownership clean. Add a `unifiedBadgeCount` getter to either store — bell template can reference it from whichever is convenient.

2. **Hover preview `loading` attribute strategy**
   - What we know: `image_uris.normal` is ~672×936 px and not pre-fetched. Default `loading="lazy"` works but introduces a ~200ms flash when the user first hovers.
   - What's unclear: Whether to pre-warm these images on set-load or accept the first-hover delay.
   - Recommendation: Accept the first-hover delay. Pre-warming 100+ cards × ~100kb = ~10MB on set-load is wasteful for users who only scroll. Browser cache handles repeat hovers.

3. **Is a popover footer "VIEW WATCHLIST" link redundant with per-row navigation?**
   - What we know: D-05 says price alert rows OR a section-level link can navigate. Not both.
   - What's unclear: Which is the cleaner UX — row click navigates? Section footer has a CTA? Row has a "→" chevron at the right?
   - Recommendation: **Section footer only**. Rows are informational (name + alert text + price); the CTA belongs at the section bottom (`[ GO TO WATCHLIST → ]` per CONTEXT §Specifics). This matches the sync-errors row treatment (summary + section CTA) and keeps both sections visually consistent.

## Environment Availability

*Skipped — Phase 12 has no external dependencies. All required tools (npm, Vite, Alpine, Keyrune, Material Symbols, Dexie) are already installed and verified by 11 preceding phases shipping successfully on this stack.*

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 + jsdom 29.0.1 (per `package.json`) |
| Config file | `vitest.config.js` (existing) + `tests/setup.js` globally stubs `MutationObserver` + `CustomEvent` for Alpine-dependent modules |
| Quick run command | `npm test -- <pattern>` (e.g., `npm test -- notification-bell`) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SYNC-08 | `market.unifiedBadgeCount` getter sums `syncErrorCount + alertBadgeCount` correctly; returns 0 when both are 0 | unit | `npm test -- market-store` (extend existing `tests/market-store.test.js`) | ✅ existing (extend) |
| SYNC-08 | Sync-error count polling resets to 0 on sign-out | unit | `npm test -- notification-bell-popover` | ❌ Wave 0 |
| SYNC-08 | Bell popover click routes to `window.openSyncErrorsModal()` when sync errors > 0 | unit | `npm test -- notification-bell-popover` | ❌ Wave 0 |
| SYNC-08 | Bell popover "VIEW WATCHLIST" CTA navigates to `/preordain` + sets tab to `watchlist` | unit | `npm test -- notification-bell-popover` | ❌ Wave 0 |
| SYNC-08 | Bell popover shows empty state when `unifiedBadgeCount === 0` (popover opens on click but shows "All clear") | unit | `npm test -- notification-bell-popover` | ❌ Wave 0 |
| SYNC-08 | Escape key closes the popover | unit | `npm test -- notification-bell-popover` | ❌ Wave 0 |
| SYNC-08 | `@click.outside` closes the popover | unit (jsdom) | `npm test -- notification-bell-popover` | ❌ Wave 0 |
| MARKET-01 | Custom set-filter dropdown renders `<i class="ss ss-{code} ss-fallback">` for each set option | unit | `npm test -- spoiler-set-filter` | ❌ Wave 0 |
| MARKET-01 | Selecting a set calls `$store.market.loadSpoilers(code)` and closes the dropdown | unit | `npm test -- spoiler-set-filter` | ❌ Wave 0 |
| MARKET-01 | Dropdown displays set name + card count per option | unit | `npm test -- spoiler-set-filter` | ❌ Wave 0 |
| MARKET-02 | `market.groupedSpoilerCards` getter groups cards by `released_at` in descending order | unit | `npm test -- market-store` (extend) | ✅ existing (extend) |
| MARKET-02 | `groupedSpoilerCards` handles `released_at: null/undefined` by bucketing as "unknown" at the bottom | unit | `npm test -- market-store` (extend) | ✅ existing (extend) |
| MARKET-02 | Day header renders `MMM DD, YYYY • N CARDS` format | unit | `npm test -- spoiler-gallery` (extend) | ✅ existing (extend) |
| MARKET-02 | NEW badge renders when `released_at < 48h ago` (existing behaviour preserved) | unit | `npm test -- spoiler-gallery` (extend) | ✅ existing (extend) |
| MARKET-02 | Hover preview uses `card.image_uris.normal` for single-faced and `card.card_faces[0].image_uris.normal` for DFCs | unit | `npm test -- spoiler-gallery` (extend) | ✅ existing (extend) |
| MARKET-02 | Hover preview `flipLeft` flag sets true when `window.innerWidth - rect.right < 270` | unit | `npm test -- spoiler-gallery` (extend) | ✅ existing (extend) |
| MARKET-03 | Clicking unwatched bookmark calls `market.addToWatchlist(card.id)` | unit | `npm test -- spoiler-gallery` (extend) | ✅ existing (extend) |
| MARKET-03 | Clicking watched bookmark calls `market.removeFromWatchlist(card.id)` | unit | `npm test -- spoiler-gallery` (extend) | ✅ existing (extend) |
| MARKET-03 | Bookmark icon reads `bookmark_add` when not in watchlist; `bookmark` (filled) when in watchlist | unit | `npm test -- spoiler-gallery` (extend) | ✅ existing (extend) |
| MARKET-03 | `.cf-spoiler-bookmark.is-watching` class toggles with watchlist membership | unit | `npm test -- spoiler-gallery` (extend) | ✅ existing (extend) |
| MARKET-03 | No toast is dispatched on bookmark click (D-10) | unit — static grep gate | `npm test -- spoiler-gallery` (extend) — assert `Alpine.store('toast')` absent from component source | ✅ existing (extend) |

### Sampling Rate

- **Per task commit:** `npm test -- <pattern>` (matches the file(s) changed)
- **Per wave merge:** `npm test` (full Vitest run — suite runtime ~15–30s locally)
- **Phase gate:** Full suite green before `/gsd:verify-phase`; visual UAT per screen (bell popover + Preordain spoiler tab) captured in Phase 12's `12-VERIFICATION.md`

### Wave 0 Gaps

- [ ] `tests/notification-bell-popover.test.js` — covers SYNC-08 popover behaviour (7 cases)
- [ ] `tests/spoiler-set-filter.test.js` — covers MARKET-01 custom dropdown (3 cases)
- [ ] Extend `tests/market-store.test.js` — add `unifiedBadgeCount` + `groupedSpoilerCards` + `syncErrorCount` polling cases
- [ ] Extend `tests/spoiler-gallery.test.js` (if exists under a different name — check `tests/spoiler-filter.test.js`) — add day-header rendering, hover-preview image binding, bookmark toggle (8 cases)

## Project Constraints (from CLAUDE.md)

Per root `./CLAUDE.md`:
- **GSD Workflow Enforcement:** Work only through GSD commands; do not bypass `/gsd:execute-phase` for file-changing tools.
- **Tech stack is locked:** Alpine 3.15.x, Tailwind 4.x, Dexie 4.x, Vite (Rolldown) 8.x. Phase 12 adds zero dependencies — constraint trivially satisfied.
- **Performance Targets:**
  - Initial page load < 3s — unaffected (pure UI add).
  - Search autocomplete < 200ms — unaffected.
  - Collection scroll virtualised at 1000+ cards — Preordain spoiler grid is NOT virtualised today; at ~300 cards per set this is fine. A planner should flag any concerns if a grouped-section render at 500+ cards per day shows jank (unlikely — Scryfall rarely ships >250 cards/day).
  - Deck analytics recalc < 100ms — unaffected.
- **Scryfall API compliance:** No new Scryfall calls in Phase 12; constraint trivially satisfied.
- **Desktop-first:** Bell popover and spoiler redesign are desktop viewports; no mobile-responsive layout mandated (Vandalblast only exception).
- **Neo-Occult Terminal tokens (from `./CLAUDE.md` §Visual Identity):** Use `#0B0C10` / `#14161C` / `#1C1F28` / `#2A2D3A` / `#E8E6E3` / `#8A8F98` / `#0D52BD` / `#E23838` — CONTEXT decisions already reference these correctly.
- **8-point spacing scale:** 4/8/16/24/32/48/64. CONTEXT's 8/16/24/32 px values comply; preview width of 250px is outside the scale but is a content dimension, not spacing.
- **Typography 4-tier:** Syne 48px display / Space Grotesk 20px heading / Space Grotesk 14px body / JetBrains Mono 11px label. Bell popover and day headers use 14/11 per CONTEXT — compliant.

Per `d:\Vibe Coding\CLAUDE.md` (workspace-level): no Phase 12-specific directives.

Per `d:\Vibe Coding\counterflux\CLAUDE.md` (project-level): project reads Alpine stores with `window.Alpine.store()` in tests (see `tests/setup.js`); Phase 12 tests must follow the `vi.mock('alpinejs')` convention established in Phase 9 Plan 1 (STATE §Accumulated Context entry "deck-analytics-panel + deck-centre-panel read window.Alpine directly").

## Sources

### Primary (HIGH confidence)
- `d:\Vibe Coding\counterflux\CLAUDE.md` — project tech stack, visual identity, performance targets
- `d:\Vibe Coding\counterflux\package.json` — installed versions (alpinejs 3.15.11, keyrune 3.18.0, material-symbols 0.44.0, dexie 4.4.2, vitest 4.1.2, jsdom 29.0.1)
- `d:\Vibe Coding\counterflux\src\stores\market.js` — full market store shape (watchlist, alertBadgeCount, pendingAlerts, spoilerCards, loadSpoilers, filterSpoilers, add/removeFromWatchlist)
- `d:\Vibe Coding\counterflux\src\stores\sync.js:1-200` — polling convention (`setInterval` 2s, auth-gated), `window.openSyncErrorsModal` assignment, state machine for reference
- `d:\Vibe Coding\counterflux\src\components\sync-errors-modal.js` — modal API (`openSyncErrorsModal` / `closeSyncErrorsModal`), copywriting contract, close-paths
- `d:\Vibe Coding\counterflux\src\components\spoiler-gallery.js` — existing spoiler template to rewrite; NEW badge logic, filter bar, DFC image binding
- `d:\Vibe Coding\counterflux\src\components\topbar.js` — existing `handleNotifications` to replace
- `d:\Vibe Coding\counterflux\src\components\precon-browser.js:161-163` — Keyrune `ss-fallback` reference pattern
- `d:\Vibe Coding\counterflux\src\components\release-calendar.js:53,87` — Keyrune `ss-2x ss-default` reference pattern
- `d:\Vibe Coding\counterflux\src\styles\main.css:91-97,187-196,309-342` — `.card-tile-hover`, `prefers-reduced-motion` block, `.card-quick-actions-checkbox` hover-reveal
- `d:\Vibe Coding\counterflux\src\styles\utilities.css:146-152` — `.badge-new` existing style
- `d:\Vibe Coding\counterflux\index.html:330-350` — topbar bell button and badge binding call sites
- `d:\Vibe Coding\counterflux\.planning\REQUIREMENTS.md` — MARKET-01/02/03 + SYNC-08 acceptance text
- `d:\Vibe Coding\counterflux\.planning\STATE.md` — Phase 8.1 / 9 / 11 pattern precedents (click-outside convention, hover-checkbox genesis, polling design)
- `d:\Vibe Coding\counterflux\.planning\phases\12-notification-bell-preordain-spoiler-refresh\12-CONTEXT.md` — all D-01..D-11 locked decisions, in-scope/out-of-scope boundary, canonical refs

### Secondary (MEDIUM confidence)
- Existing Alpine `@click.outside` call sites (`src/components/coin-flipper.js:37`, `src/components/counter-panel.js:106`, `src/components/dice-roller.js:68`, `src/components/edit-card-inline.js:53`, `src/screens/welcome.js:43`) — cross-verified convention; 5 precedents agree

### Tertiary (LOW confidence)
- None. Phase 12 has zero external-documentation dependencies; every claim in this file cites a grep-verifiable repo artifact.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every dependency verified in `package.json`, zero additions needed
- Architecture: HIGH — every proposed pattern has ≥1 existing implementation in the codebase
- Pitfalls: HIGH — 7 of 8 pitfalls derive from failure modes already documented in STATE.md or shipped PITFALLS.md; only Pitfall 4 (escape collision) is a theoretical extrapolation
- Test scope: HIGH — existing `tests/market-store.test.js`, `tests/spoiler-filter.test.js`, `tests/sync-errors-modal.test.js` establish patterns; Wave 0 gaps are additive

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (30 days; Alpine + Keyrune release cadence is stable, project stack locked by CLAUDE.md)
