# Phase 12: Notification Bell + Preordain Spoiler Refresh - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Two parallel workstreams shipped in a single phase:

1. **Notification bell → unified inbox** (SYNC-08): The topbar bell button currently shows only `market.alertBadgeCount` (price alerts) and has no `@click` handler. Phase 12 wires it to a 320px dropdown popover that surfaces both sync errors (`sync_conflicts`) and price alerts (`market.pendingAlerts`) in a single inbox. Badge count unifies across both sources.

2. **Preordain spoiler browser upgrade** (MARKET-01..03): Set-filter dropdown gets Keyrune set icons; the flat spoiler card grid becomes a reverse-chronological section layout with larger tiles, day headers, hover card preview, and a hover-reveal quick-add-to-watchlist button on each tile.

**In-scope:**
- Notification bell dropdown popover component (new)
- Bell badge count = `sync_conflicts.count() + market.alertBadgeCount`
- Keyrune set icon in the spoiler set-filter `<select>` options (MARKET-01)
- Spoiler grid → 2–4 column fixed-width layout with section headers by date (MARKET-02)
- Hover full-card-image overlay on spoiler tiles (MARKET-02)
- Hover-reveal bookmark button on spoiler tiles; toggle filled/unfilled state (MARKET-03)

**Out of scope:**
- Per-notification "mark as read" / persistence of notification state across sessions
- Inline retry/discard inside the bell popover (sync errors handled by existing sync-errors-modal)
- Realtime push notifications or browser Notification API
- Notification history / inbox archive
- Spoiler filter bar changes beyond keyrune in set dropdown

</domain>

<decisions>
## Implementation Decisions

### Bell Inbox UI

- **D-01:** Bell click opens a **dropdown popover** anchored to the bell icon (not a modal, not a nav redirect). Width: 320px. Max 5 rows visible before internal scroll. Dismisses on click-outside and Escape. Positioned below-right of the bell, within topbar bounds.

- **D-02:** Badge count on the bell icon = **total unified count** (sync error count from `sync_conflicts` + price alert count from `market.alertBadgeCount`). Replaces the existing `alertBadgeCount`-only binding.

- **D-03:** Sync error actions stay in the **existing `sync-errors-modal.js`** (Phase 11). The bell popover shows a count + summary row for sync errors with a "VIEW SYNC ERRORS →" link that opens `window.openSyncErrorsModal()`. No inline retry/discard in the popover.

### Notification Grouping

- **D-04:** Popover uses **two sections**: `SYNC ERRORS` on top (when count > 0) and `PRICE ALERTS` below (when count > 0). Each section hidden entirely if count is 0. Mono-font section headers matching the existing filter-bar label style (`color: #7A8498`, `text-[11px] uppercase tracking-[0.15em]`).

- **D-05:** Price alert rows in the popover show card name + triggered alert text + current price. Each row (or a section-level link) navigates to Preordain watchlist tab (`router.navigate('/preordain')` + `market.setTab('watchlist')`). Sync error rows show table + op + "N failed ops" summary + "VIEW SYNC ERRORS →" link.

### Spoiler Tile Redesign

- **D-06:** "Larger tiles" = **fewer, fixed-size columns**. Switch from the current responsive `grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6` to a fixed `grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` (max ~280px per tile). Tiles get bigger because there are fewer columns.

- **D-07:** Spoiler cards grouped in **reverse-chronological sections** by `released_at` date. Section header format: `APR 18, 2026 • 12 CARDS` — mono-font, `ghost border` (`#2A2D3A`) divider above, consistent with existing filter-bar section label style. Planner responsible for choosing the groupBy implementation (sort + reduce or separate groupedCards computed property in market store).

- **D-08:** Hover card preview = **full card image overlay**. On `mouseenter`, a positioned `<div>` renders `card.image_uris.normal` (or `card.card_faces[0].image_uris.normal` for DFCs) at ~250px wide, floating adjacent to the tile (prefer right-side, flip left if near viewport edge). Dismisses on `mouseleave`. No oracle text or stats — image only.

### Quick Watchlist Button (MARKET-03)

- **D-09:** Watchlist button is **hover-reveal in the tile's top-left corner** — same pattern as Phase 8.1's hover-checkbox on collection tiles. At rest: not visible. On tile `mouseenter`: `bookmark_add` (Material Symbols Outlined) icon appears in the top-left corner at 28×28px, primary-accent background (`#0D52BD`), white icon.

- **D-10:** Already-in-watchlist state = **filled `bookmark` icon** (persistent, visible even without hover) with a muted/accent colour indicating "watching". Clicking the filled icon removes from watchlist (`market.removeFromWatchlist(card.id)`). No toast for either add or remove — the icon toggle is the visual feedback. Tile must track watchlist membership via reactive check against `$store.market.watchlist`.

### Keyrune in Set Filter Dropdown (MARKET-01)

- **D-11:** The set-filter `<select>` element cannot contain icon glyphs. Use a **custom dropdown** (Alpine `x-data` + `x-show` list) instead of a native `<select>`, so each option can render `<i class="ss ss-{code} ss-fallback">` alongside the set name and card count. Follows the `ss ss-fallback` pattern from `src/components/precon-browser.js` and `src/components/release-calendar.js`.

### Claude's Discretion

- Exact popover animation (fade-in vs slide-down) — match the Neo-Occult Terminal aesthetic
- Viewport-edge detection for hover preview positioning (flip left when near right edge)
- Empty-state copy for the bell popover when no notifications exist ("All clear" / "No notifications")
- Whether `sync_conflicts.count()` is polled on an interval or reactive to `$store.sync.status` changes
- Whether the groupedCards computation lives in the market store or as a getter in spoiler-gallery.js

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 12 requirements
- `.planning/REQUIREMENTS.md` §SYNC-08, §MARKET-01, §MARKET-02, §MARKET-03 — acceptance criteria for all 4 requirements

### Existing components to extend or wire
- `src/components/topbar.js` — bell `handleNotifications()` must be replaced with popover open/close logic; `@click` not yet wired in `index.html`
- `src/components/spoiler-gallery.js` — full rewrite of the card grid into a sectioned layout; set-filter `<select>` → custom dropdown
- `src/stores/market.js` — `alertBadgeCount` must be extended; new computed property for grouped-by-date spoiler cards
- `src/components/sync-errors-modal.js` — Phase 11 modal; bell popover must call `window.openSyncErrorsModal()` to open it

### Patterns to follow
- `src/components/precon-browser.js` — `ss ss-fallback` keyrune pattern (lines 161–162)
- `src/components/release-calendar.js` — keyrune icon sizing: `ss-2x ss-default` (lines 53, 87)
- `src/components/sync-errors-modal.js` — dismissible modal pattern (Escape + X + backdrop)
- `src/components/first-sign-in-prompt.js` — capture-phase Escape lockdown (contrast: bell popover is dismissible)
- Phase 8.1 hover-checkbox on collection tiles — hover-reveal interaction model for the watchlist button

### Design system
- `.planning/phases/01-foundation-data-layer/01-UI-SPEC.md` — Neo-Occult Terminal tokens (background `#0B0C10`, surface `#14161C`, ghost border `#2A2D3A`, primary accent `#0D52BD`, text-secondary `#7A8498`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/stores/market.js` — `addToWatchlist(scryfallId)` / `removeFromWatchlist(scryfallId)` / `watchlist[]` / `pendingAlerts[]` / `alertBadgeCount` already exist. Phase 12 extends `alertBadgeCount` and adds grouped-cards getter.
- `src/components/sync-errors-modal.js` — Phase 11 modal with `window.openSyncErrorsModal()` global. Bell popover links to it directly.
- Keyrune CSS: `import 'keyrune/css/keyrune.min.css'` in `src/main.js`. Classes `ss ss-{code} ss-fallback` work everywhere. `ss-2x ss-default` for larger icons.
- Material Symbols: `bookmark_add` / `bookmark` glyphs available (same font used for `notifications` bell, `cloud_sync`, etc.)
- `src/components/toast.js` — toast system available but NOT used for watchlist toggle per D-10.

### Established Patterns
- Dropdown popover: no existing example in the codebase — this is a new pattern. Phase 12 owns the implementation. Suggest Alpine `x-data` with `open` flag + `@click.away` to dismiss.
- Section headers in grid: the existing filter-bar uses `color: #7A8498; font-mono; uppercase; tracking-[0.15em]` — day headers should match this.
- Hover interactions: Phase 8.1 established hover-reveal on card tiles using CSS `:hover` + opacity/visibility transition. Same approach for watchlist button.
- Custom dropdown replacing `<select>`: no prior example in the codebase — Phase 12 sets this precedent. Keep Alpine lightweight, avoid a library.

### Integration Points
- `index.html` topbar bell button (line ~342): add `@click="topbarComponent().openNotifications()"` or wire via `x-data` on the topbar element.
- `index.html` badge binding (line ~345): extend from `market.alertBadgeCount` to unified count.
- `src/screens/preordain.js` or `src/components/spoiler-gallery.js`: spoiler grid overhaul.
- `src/stores/market.js`: new `unifiedBadgeCount` computed, `groupedSpoilerCards` getter.

</code_context>

<specifics>
## Specific Ideas

- Bell popover uses mono-font section labels: `SYNC ERRORS (N)` / `PRICE ALERTS (N)` with ghost border separators — matches the filter-bar label aesthetic of the rest of the app.
- Sync error summary row in the popover: `"N operations failed"` as the description, with `[ VIEW SYNC ERRORS → ]` as the CTA.
- Price alert row: `card_name` (Space Grotesk 14px) + alert condition text (mono 11px, e.g. `"dropped to £12.50 — below £15"`) + `[ GO TO WATCHLIST → ]` at section footer.
- Hover card preview: should respect DFCs (`card.card_faces[0].image_uris.normal`) — the existing tile already handles this for `image_uris.small`.
- Watchlist button icon: `bookmark_add` (outlined, accent colour) when not watching; `bookmark` (filled, accent colour, solid) when watching. The Material Symbols Outlined font already has both.

</specifics>

<deferred>
## Deferred Ideas

- Per-notification "mark as read" / session-persistent read state — would require a new Dexie table or localStorage store. Deferred: all cleared on app boot (price alerts deduplicated via `last_alerted_at`, sync errors cleared when retried/discarded).
- Browser Notification API / push notifications — out of scope for desktop-first PWA in v1.1
- Notification history / inbox archive panel — Phase 12 is a live-count popover only
- "Today / Yesterday" relative date labels in day headers — deferred to keep the header simple; absolute date format chosen (D-07)
- Animated bell shake on new notification arrival — nice-to-have, deferred

</deferred>

---

*Phase: 12-notification-bell-preordain-spoiler-refresh*
*Context gathered: 2026-04-18*
