# Phase 6: Dashboard + Polish (Epic Experiment) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 06-dashboard-polish-epic-experiment
**Areas discussed:** Dashboard layout, Quick Add UX, Keyboard & undo, Offline indicators

---

## Dashboard Layout

### Panel arrangement

| Option | Description | Selected |
|--------|-------------|----------|
| Command centre grid | Fixed 2-3 col grid, portfolio spanning top, deck+activity mid, Mila+alerts+releases bottom | ✓ |
| Single-column feed | Stacked vertical panels, full-width, requires scrolling | |
| Bento grid | Asymmetric panel sizes, more visual but harder to predict | |

**User's choice:** Command centre grid
**Notes:** None

### Activity timeline content

| Option | Description | Selected |
|--------|-------------|----------|
| All module actions | Cards, decks, games, watchlist — unified feed | ✓ |
| Collection changes only | Just card add/remove/edit events | |
| You decide | Claude picks | |

**User's choice:** All module actions
**Notes:** None

### Deck quick-launch count

| Option | Description | Selected |
|--------|-------------|----------|
| 6 decks with 'View all' link | Two rows of 3, commander art thumbnails | ✓ |
| All decks, scrollable | Horizontal scroll row, no truncation | |
| 4 most recent | Single row of 4 recent decks | |

**User's choice:** 6 decks with 'View all' link
**Notes:** None

### Portfolio price trends

| Option | Description | Selected |
|--------|-------------|----------|
| Sparkline + percentage | Inline SVG sparkline with GBP value and % change badge | ✓ |
| Mini Chart.js line chart | Larger interactive chart with hover tooltips | |
| Numbers only | Just total and change text | |

**User's choice:** Sparkline + percentage
**Notes:** None

### Empty dashboard state

| Option | Description | Selected |
|--------|-------------|----------|
| Mila onboarding flow | Progressive panels unlock as data arrives | ✓ |
| Static placeholder cards | All panels visible with skeleton content | |
| You decide | Claude picks | |

**User's choice:** Mila onboarding flow
**Notes:** None

---

## Quick Add UX

### Quick Add presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Inline search bar | Persistent input in portfolio area, type to add | ✓ |
| Floating action button + modal | '+' button opens existing Add Card Modal | |
| Topbar integration | Extend global search to support Quick Add syntax | |

**User's choice:** Inline search bar
**Notes:** None

### Post-add feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Toast + inline confirmation | Toast notification plus brief inline flash | ✓ |
| Toast only | Standard toast notification | |
| Inline mini-card preview | Small card image flash next to input | |

**User's choice:** Toast + inline confirmation
**Notes:** None

### Condition/foil toggles

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, small toggle buttons | Condition dropdown + foil checkbox next to input | ✓ |
| No, always NM non-foil | Defaults, user edits later | |
| You decide | Claude picks | |

**User's choice:** Yes, small toggle buttons
**Notes:** None

---

## Keyboard & Undo

### Undo scope

| Option | Description | Selected |
|--------|-------------|----------|
| Card & deck deletes only | Collection removes, deck card removes, deck deletions | ✓ |
| All destructive actions | Also games, watchlist, alerts | |
| You decide | Claude picks | |

**User's choice:** Card & deck deletes only
**Notes:** None

### Undo UX

| Option | Description | Selected |
|--------|-------------|----------|
| Toast with undo button | 10s countdown, click Undo or Ctrl+Z to restore | ✓ |
| Soft delete + permanent after 10s | DB flag approach, background cleanup | |
| Simple Ctrl+Z stack | Standard undo stack, no timer | |

**User's choice:** Toast with undo button
**Notes:** None

### Shortcut discoverability

| Option | Description | Selected |
|--------|-------------|----------|
| ? key opens cheat sheet | Modal listing all shortcuts, like GitHub | ✓ |
| No overlay needed | Documentation only | |
| Tooltip hints on hover | Shortcut in button tooltips | |

**User's choice:** ? key opens cheat sheet
**Notes:** None

### / key target

| Option | Description | Selected |
|--------|-------------|----------|
| Global search always | / focuses topbar search on every screen | ✓ |
| Context-dependent | Dashboard: Quick Add, others: global search | |

**User's choice:** Global search always
**Notes:** None

---

## Offline Indicators

### Offline/stale indication

| Option | Description | Selected |
|--------|-------------|----------|
| Topbar status chip | Small chip next to search: green/amber/red | ✓ |
| Banner below topbar | Dismissible warning banner | |
| Inline badges on prices | Small 'stale' badge on each price display | |

**User's choice:** Topbar status chip
**Notes:** None

### Stale threshold

| Option | Description | Selected |
|--------|-------------|----------|
| After 4 hours | Balances freshness with reality | |
| After 24 hours | Matches Scryfall daily update cadence | ✓ |
| You decide | Claude picks | |

**User's choice:** After 24 hours
**Notes:** None

### Auto-refresh on reconnect

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, silent background refresh | Trigger bulk data refresh when online and stale | ✓ |
| Manual refresh only | Show 'Refresh' button, user controls timing | |
| You decide | Claude picks | |

**User's choice:** Yes, silent background refresh
**Notes:** None

---

## Claude's Discretion

- Undo stack implementation details (in-memory vs store-based)
- Exact panel sizing ratios in command centre grid
- Activity timeline data structure and storage
- Keyboard shortcut cheat sheet styling

## Deferred Ideas

None — discussion stayed within phase scope
