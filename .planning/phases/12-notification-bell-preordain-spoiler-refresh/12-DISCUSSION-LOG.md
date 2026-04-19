# Phase 12: Notification Bell + Preordain Spoiler Refresh — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 12 — Notification Bell + Preordain Spoiler Refresh
**Areas discussed:** Bell inbox format, Notification grouping, Spoiler tile redesign, Quick watchlist button

---

## Bell inbox format

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown popover | 320px, anchored to bell, dismisses on click-outside/Escape | ✓ |
| Modal (settings-modal pattern) | Centered modal, heavier | |
| Nav redirect | Navigates to Preordain watchlist tab (current behaviour) | |

**User's choice:** Dropdown popover

---

### Bell: popover size

| Option | Description | Selected |
|--------|-------------|----------|
| 320px, 5 items max | Compact, scrolls internally beyond 5 | ✓ |
| 400px, 8 items max | Wider, more room for sync error text | |

**User's choice:** 320px, 5 items max

---

### Bell: sync error actions location

| Option | Description | Selected |
|--------|-------------|----------|
| Link to sync-errors-modal | Summary in popover + "VIEW SYNC ERRORS →" CTA | ✓ |
| Inline retry/discard per row | Duplicates sync-errors-modal UI, heavier | |

**User's choice:** Link to sync-errors-modal

---

## Notification grouping

| Option | Description | Selected |
|--------|-------------|----------|
| Two sections with headers | SYNC ERRORS on top, PRICE ALERTS below; section hidden when count = 0 | ✓ |
| Unified chronological list | All notifications newest-first with type badges | |

**User's choice:** Two sections with headers

---

### Badge count

| Option | Description | Selected |
|--------|-------------|----------|
| Total (sync errors + price alerts) | Single unified count | ✓ |
| Sync errors only | Badge only for actionable errors | |

**User's choice:** Total unified count

---

## Spoiler tile redesign

### Tile size

| Option | Description | Selected |
|--------|-------------|----------|
| Fewer fixed-size columns | 2–4 cols, max ~280px per tile | ✓ |
| Same columns, taller image area | Keep responsive count, change aspect ratio | |

**User's choice:** Fewer, fixed-size columns (2–4 cols)

---

### Day headers

| Option | Description | Selected |
|--------|-------------|----------|
| Date + count label | `APR 18, 2026 • 12 CARDS` — mono-font, ghost border divider | ✓ |
| Relative date | TODAY / YESTERDAY / APR 18 — friendlier, requires live comparison | |

**User's choice:** Date + count label (absolute date format)

---

### Hover card preview

| Option | Description | Selected |
|--------|-------------|----------|
| Full card image in floating tooltip | image_uris.normal, ~250px wide overlay, dismiss on mouse-leave | ✓ |
| Card detail overlay | Oracle text + stats mini-panel | |

**User's choice:** Full card image in floating tooltip

---

## Quick watchlist button

### Button visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Hover-reveal in tile corner | bookmark_add appears top-left on hover (Phase 8.1 precedent) | ✓ |
| Always-visible in metadata row | Permanent icon in tile footer | |

**User's choice:** Hover-reveal in tile corner

---

### Already-in-watchlist state

| Option | Description | Selected |
|--------|-------------|----------|
| Filled icon + muted state | bookmark (filled) persists; click removes; no toast | ✓ |
| Filled icon + toast on add | Same icon toggle but add fires a toast | |

**User's choice:** Filled icon (toggle, no toast)

---

## Claude's Discretion

- Popover animation style (fade vs slide)
- Viewport-edge flip logic for hover preview positioning
- Empty-state copy in the bell popover
- Whether `sync_conflicts.count()` is polled or reactive to sync store
- Grouped-cards implementation strategy (store getter vs gallery component)

## Deferred Ideas

- Per-notification "mark as read" persistence
- Browser Notification API / push
- Inbox history archive
- "Today / Yesterday" relative date in section headers
- Bell shake animation on new notification
