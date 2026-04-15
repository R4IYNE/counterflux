# Phase 8: Treasure Cruise Rapid Entry - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-15
**Phase:** 08-treasure-cruise-rapid-entry
**Areas discussed:** LHS persistent add panel, Precon browser, Printing picker, Thumbnail in search dropdown

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| LHS persistent add panel | COLLECT-06. Panel layout, width, reflow behaviour, interaction with mass-entry/CSV. | ✓ |
| Precon browser | COLLECT-02. Discovery, caching, add-all mechanics, preview. | ✓ |
| Printing picker | COLLECT-04. Paper-printing strip rendering, sort, default pick. | ✓ |
| Thumbnail in search dropdown | COLLECT-03. Size, position, image source. | ✓ |

**User's choice:** All four areas selected.
**Notes:** User wanted the full sweep — no area skipped.

---

## LHS persistent add panel

### Q1: Panel layout
| Option | Description | Selected |
|--------|-------------|----------|
| Pushes grid right (Recommended) | Dedicated-workspace feel; grid reflows into remaining width. | ✓ |
| Overlays grid (glass backdrop) | Floats over grid edge; closer to current modal feel anchored left. | |
| Split-pane resizer | Draggable splitter between panel and grid. | |

**User's choice:** Pushes grid right.

### Q2: Panel width
| Option | Description | Selected |
|--------|-------------|----------|
| 360px fixed (Recommended) | Fits thumbnail + name + price + controls without cramping. | ✓ |
| 320px fixed | Tighter; controls may wrap. | |
| 400–440px fixed | Roomier; eats grid area. | |

**User's choice:** 360px fixed.

### Q3: Open state
| Option | Description | Selected |
|--------|-------------|----------|
| Open by default (Recommended) | Panel is the primary entry point; always visible. | ✓ |
| Closed, click to open | Screen opens to grid; user clicks to open panel. | |
| Remember last state | Persist open/closed preference per user. | |

**User's choice:** Open by default.
**Notes:** Persistence to `localStorage` via `tc_panel_open` is still applied — default first-boot state is "open" but subsequent changes persist (see D-03 in CONTEXT).

### Q4: Mass/CSV flow
| Option | Description | Selected |
|--------|-------------|----------|
| Stay as modals (Recommended) | Only COLLECT-06 explicitly moves. | ✓ |
| All three share the panel | Tabbed LHS panel for add / mass / CSV. | |
| Buttons relocate to panel | Modals stay; launch buttons move into panel header. | |

**User's choice:** Stay as modals.
**Notes:** Panel header still surfaces mass-entry + CSV launch buttons per D-27, but the modals themselves remain modal.

### Checkpoint
**Q:** More questions about the LHS panel, or move on?
**User's choice:** Move to next area.

---

## Precon browser

### Q1: Entry point
| Option | Description | Selected |
|--------|-------------|----------|
| Button in LHS panel header (Recommended) | "Browse precons" button in panel header. | ✓ |
| Top-right screen action button | Sibling to view-toggle tabs. | |
| Sidebar nav item | Permanent link in left sidebar. | |

**User's choice:** Button in LHS panel header.

### Q2: Browser shape
| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen drawer / modal (Recommended) | Opens as large overlay; tile grid + selected decklist. | ✓ |
| Inline panel replacing the grid | Swaps collection grid for browser. | |
| Second LHS panel (nested) | Second 360px column to the right of add panel. | |

**User's choice:** Full-screen drawer / modal.

### Q3: Caching
| Option | Description | Selected |
|--------|-------------|----------|
| New Dexie table + 7-day TTL (Recommended) | `precons_cache` table via v9 bump. | ✓ |
| Meta key/value + 24h TTL | Single blob in existing `meta` table. | |
| Fetch-on-demand, no cache | Scryfall calls every time. | |

**User's choice:** New Dexie table + 7-day TTL.

### Q4: Add-all behaviour
| Option | Description | Selected |
|--------|-------------|----------|
| All as owned, non-foil, merge qty (Recommended) | All cards `category: 'owned'`, `foil: false`, increment existing via `addCard`. | ✓ |
| Preview modal with per-card toggles | Decklist preview with per-card foil/category/qty. | |
| Category picker, then commit | Single radio (Owned/Wishlist), then all land in that category. | |

**User's choice:** All as owned, non-foil, merge qty.

### Q5: Set_type filter
| Option | Description | Selected |
|--------|-------------|----------|
| Commander only (Recommended) | `set_type = 'commander'`. Matches STATE.md call. | |
| Commander + Duel Decks | `set_type = 'commander'` + `set_type = 'duel_deck'`. | ✓ |
| All three (commander + duel_deck + starter) | All three per REQUIREMENTS.md literal. | |

**User's choice:** Commander + Duel Decks.
**Notes:** User explicitly overrode STATE.md's earlier "commander only" scope call from 2026-04-14. D-09 in CONTEXT supersedes.

### Q6: Decklist preview
| Option | Description | Selected |
|--------|-------------|----------|
| Yes, always preview first (Recommended) | Full decklist + single "Add all N" button. | ✓ |
| Single click from tile — no preview | Click tile → toast → cards added. | |
| Tooltip preview, click to confirm | Hover for commander + top cards; click to commit. | |

**User's choice:** Yes, always preview first.

### Q7: Refresh cadence
| Option | Description | Selected |
|--------|-------------|----------|
| 7-day TTL, manual refresh button (Recommended) | Weekly auto-refresh + manual "Refresh" link in header. | ✓ |
| 7-day TTL, auto-only | No manual refresh. | |
| 24h TTL, auto-only | Refresh every day. | |

**User's choice:** 7-day TTL, manual refresh button.

### Q8: Product sort
| Option | Description | Selected |
|--------|-------------|----------|
| Newest first (Recommended) | Sort by `released_at` descending. | ✓ |
| Alphabetical by name | Predictable but buries newness. | |
| Grouped by parent set | Group by source release. | |

**User's choice:** Newest first.

### Checkpoint
**Q:** More questions about the precon browser, or move on?
**User's choice:** Move to next area.

---

## Printing picker

### Q1: Layout
| Option | Description | Selected |
|--------|-------------|----------|
| Horizontal icon strip under preview (Recommended) | Row of keyrune icons below selected-card preview. | ✓ |
| Expandable drawer toggle | Preview shows current set icon; click to expand full list. | |
| Dropdown menu | Native-like select. | |

**User's choice:** Horizontal icon strip under preview.

### Q2: Default pick
| Option | Description | Selected |
|--------|-------------|----------|
| Most recent paper printing (Recommended) | Highest `released_at` with `games: paper`. | ✓ |
| Cheapest paper printing | Lowest EUR price across paper printings. | |
| Scryfall default (whatever search returned) | Keep current behaviour. | |

**User's choice:** Most recent paper printing.

### Q3: Icon cap
| Option | Description | Selected |
|--------|-------------|----------|
| Show all, wrap to multiple rows (Recommended) | All printings wrap within 360px panel; no truncation. | ✓ |
| Cap at 8, "More..." link | 8 icons + overflow link. | |
| Cap at 12, horizontal scroll | 12 icons + horizontal scroll. | |

**User's choice:** Show all, wrap to multiple rows.

### Q4: Sort order
| Option | Description | Selected |
|--------|-------------|----------|
| Newest first (Recommended) | Match default-pick logic; newest leftmost. | ✓ |
| Oldest first (chronological) | First printing leftmost. | |
| Grouped by set-type | Masters / Commander / core grouped. | |

**User's choice:** Newest first.

### Checkpoint
**Q:** More questions about the printing picker, or move to the last area?
**User's choice:** Move to next area.

---

## Thumbnail in search dropdown

### Q1: Thumbnail size
| Option | Description | Selected |
|--------|-------------|----------|
| 40px tall (Recommended) | Row height ~56px; ~5 rows visible. | ✓ |
| 32px tall | Row height ~44px; art barely recognisable. | |
| 64px tall | Row height ~80px; 3–4 rows before scroll. | |

**User's choice:** 40px tall.

### Q2: Thumb position
| Option | Description | Selected |
|--------|-------------|----------|
| Left of name, set icon far right (Recommended) | thumb → name → spacer → set icon. | ✓ |
| Right of name (after set icon) | name → set icon → thumb. | |

**User's choice:** Left of name, set icon far right.

### Q3: Image source
| Option | Description | Selected |
|--------|-------------|----------|
| image_uris.small (Recommended) | Small PNG (146×204). | ✓ |
| image_uris.art_crop | Just the art. | |
| Full-size card hover-preview | Thumb triggers large floating preview on hover. | |

**User's choice:** image_uris.small.

---

## Final checkpoint

**Q:** We've discussed LHS panel, Precons, Printing picker, and Thumbnail dropdown. Which gray areas remain unclear?
**User's choice:** I'm ready for context.

---

## Claude's Discretion

Decisions left open for planner/researcher:
- Keyboard shortcut for toggling the LHS panel (suggestion: none)
- Empty-state copy when panel is open but no card selected
- Loading skeleton for thumbnail during search debounce
- Foil-toggle placement inside the panel
- Hover tooltip wording on printing-strip set icons
- Decklist-preview layout inside the precon browser (list vs grid)
- Precon product tile design (box art source)
- Precon browser close interaction (X + backdrop + Escape all acceptable)
- Panel open/close transition timing
- Re-open affordance when panel is collapsed

## Deferred Ideas

- Split-pane resizable LHS panel
- Overlay-style LHS panel with glass backdrop
- Tabbed LHS panel with mass-entry + CSV nested
- Per-card foil/category toggles during precon add-all
- Fetch-on-demand precon data (no cache)
- Full-size card hover-preview on dropdown thumbs
- Starter-deck precons
- MTGO/Arena printings in the picker
- Grouped-by-parent-set precon layout
- Commander-identity extraction from precon decklist for auto-build
