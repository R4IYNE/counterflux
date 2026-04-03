# Phase 1: Foundation + Data Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 01-foundation-data-layer
**Areas discussed:** Bulk Data Strategy, Card Search UX, Navigation Shell, Izzet Visual Identity

---

## Bulk Data Strategy

### Q1: Which Scryfall bulk data file?

| Option | Description | Selected |
|--------|-------------|----------|
| Oracle Cards (~80MB) (Recommended) | One entry per unique card name. Smallest, fastest. Missing per-printing data | |
| Default Cards (~300MB) | One entry per printing. Full price data, all artwork, collector numbers | ✓ |
| Oracle now, Default later | Two-tier cache, Oracle for Phase 1, Default added in Phase 2 | |

**User's choice:** Default Cards (~300MB)
**Notes:** User wants full per-printing data from the start — no two-tier migration later.

### Q2: First-load experience?

| Option | Description | Selected |
|--------|-------------|----------|
| Full blocking splash (Recommended) | Dedicated splash with Mila, progress bar, flavour text | ✓ |
| Progressive shell | Show nav shell immediately, search disabled until data ready | |
| You decide | Claude picks | |

**User's choice:** Full blocking splash
**Notes:** None

### Q3: Web Worker parse strategy?

| Option | Description | Selected |
|--------|-------------|----------|
| Streaming JSON parse (Recommended) | ReadableStream + incremental parser, lower peak memory | ✓ |
| Download then parse | Full download then JSON.parse, simpler but ~600MB peak memory | |
| You decide | Claude picks | |

**User's choice:** Streaming JSON parse
**Notes:** None

### Q4: Daily refresh strategy?

| Option | Description | Selected |
|--------|-------------|----------|
| Full re-download (Recommended) | Check updated_at, re-download if newer, background Worker | ✓ |
| Incremental via API | Query recently updated cards, patch local DB | |
| You decide | Claude picks | |

**User's choice:** Full re-download
**Notes:** None

---

## Card Search UX

### Q1: Autocomplete dropdown appearance?

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown with card images (Recommended) | Card name + thumbnail + set icon + mana cost | ✓ |
| Text-only dropdown | Plain text list, card details on selection | |
| Dropdown + hover preview | Text list with floating card image preview on hover | |

**User's choice:** Dropdown with card images
**Notes:** None

### Q2: Card selection action?

| Option | Description | Selected |
|--------|-------------|----------|
| Card detail flyout (Recommended) | Slide-in panel with full image, Oracle text, actions | ✓ |
| Inline expand | Dropdown expands in-place for detail | |
| Navigate to screen | Selection navigates to relevant screen | |

**User's choice:** Card detail flyout
**Notes:** None

### Q3: Search syntax scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Name match only (Recommended) | Card name matching only in Phase 1, full syntax in Phase 2+ | |
| Full syntax from day one | Implement Scryfall search syntax parsing from the start | |
| You decide | Claude determines based on complexity | ✓ |

**User's choice:** You decide
**Notes:** Claude has discretion on search scope for Phase 1.

---

## Navigation Shell

### Q1: Sidebar style?

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed rail with labels (Recommended) | ~240px expanded, ~64px collapsed, always visible | ✓ |
| Collapsible drawer | Hidden by default, hamburger toggle | |
| Top navigation | Horizontal tab bar instead of sidebar | |

**User's choice:** Fixed rail with labels
**Notes:** None

### Q2: Placeholder screens?

| Option | Description | Selected |
|--------|-------------|----------|
| Mila empty state (Recommended) | Full-page Mila illustration with flavour message | |
| Minimal text | Just screen title centred on blank page | |
| Locked/greyed | Sidebar items greyed out and non-clickable until built | ✓ |

**User's choice:** Locked/greyed
**Notes:** Future screens not navigable in Phase 1. Only Epic Experiment landing and global search active.

### Q3: Landing screen content?

| Option | Description | Selected |
|--------|-------------|----------|
| Welcome/search landing (Recommended) | Logo, Mila greeting, prominent search bar | ✓ |
| Empty dashboard shell | Dashboard layout with greyed placeholder widgets | |
| You decide | Claude picks | |

**User's choice:** Welcome/search landing
**Notes:** Card search is the hero of Phase 1.

### Q4: Screen transitions?

| Option | Description | Selected |
|--------|-------------|----------|
| Instant swap (Recommended) | No animation, content swaps immediately | ✓ |
| Fade transition | 150-200ms opacity fade | |
| Slide transition | Content slides left/right | |

**User's choice:** Instant swap
**Notes:** None

---

## Izzet Visual Identity

### Q1: Visual effects intensity?

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle and functional (Recommended) | Low-opacity effects, readability first | |
| Bold and immersive | Pronounced effects, atmosphere-first, magical artifact feel | ✓ |
| You decide | Claude calibrates | |

**User's choice:** Bold and immersive
**Notes:** None

### Q2: Mila sidebar appearance?

| Option | Description | Selected |
|--------|-------------|----------|
| Small avatar at bottom (Recommended) | ~40px circular avatar, subtle idle animation | |
| Mascot panel | Larger ~100px illustration with speech bubble | |
| You decide | Claude picks | |

**User's choice:** "avatar - will provide"
**Notes:** User will provide the Mila avatar asset. Small avatar at sidebar bottom.

### Q3: Loading animation?

| Option | Description | Selected |
|--------|-------------|----------|
| Mila icon pulse (Recommended) | Avatar pulses with Izzet glow, CSS-only | |
| Animated Mila sprite | Multi-frame sprite animation, requires artwork | ✓ |
| You decide | Claude picks | |

**User's choice:** Animated Mila sprite
**Notes:** Requires sprite sheet artwork from user.

### Q4: Typography hosting?

| Option | Description | Selected |
|--------|-------------|----------|
| Self-hosted (Recommended) | Bundle .woff2 files, zero external requests, offline-ready | ✓ |
| Google Fonts | CDN-loaded, smaller bundle, requires internet | |
| You decide | Claude picks | |

**User's choice:** Self-hosted
**Notes:** Consistent with local-first philosophy.

---

## Claude's Discretion

- Search syntax scope in Phase 1 (name-only vs basic Scryfall syntax)

## Deferred Ideas

None — discussion stayed within phase scope.

## Additional Context

User provided Stitch design export zip containing:
- DESIGN.md (complete design system document)
- counterflux_prd.md (full PRD)
- Screen mockups + HTML code for Dashboard, Collection, Deck Builder, Game Tracker
- Mila corgi illustration
- Izzet guild logo
