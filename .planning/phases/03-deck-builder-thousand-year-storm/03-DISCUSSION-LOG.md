# Phase 3: Deck Builder (Thousand-Year Storm) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 03-deck-builder-thousand-year-storm
**Areas discussed:** Initialize Ritual flow, Category system, Deck management, Collection awareness

---

## Initialize Ritual Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Modal wizard | Focused modal overlay: search commander, name deck, confirm colour identity | ✓ |
| Inline on-screen | No modal — ritual flow on the screen itself when no deck active | |
| Sidebar trigger | Button in sidebar opens minimal popover | |

**User's choice:** Modal wizard
**Notes:** Matches the "ritual" theme with a guided, ceremonial feel.

### Partner/Companion Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Second search field | After selecting commander with Partner, second field appears for partner. Companions get separate slot. | ✓ |
| Single field + detection | User adds commanders one at a time, app detects Partner keyword | |
| You decide | Claude picks | |

**User's choice:** Second search field
**Notes:** Colour identity auto-merges from both commanders.

### Life Total in Ritual

| Option | Description | Selected |
|--------|-------------|----------|
| Default 40, editable | Standard Commander life pre-filled but editable | |
| Always 40 | Hardcode 40, no option | |
| You decide | Claude picks | |

**User's choice:** "Do we even need to specify life here? This should be a tool to select cards for different deck formats (primarily commander)"
**Notes:** Life totals are a Game Tracker concern, not deck builder. Led to format-awareness discussion.

### Format Support

| Option | Description | Selected |
|--------|-------------|----------|
| Commander primary, format-aware | Commander default with colour identity lock. Format dropdown supports 60-card formats. No legality checks. | ✓ |
| Commander only | Hardcode 100-card singleton | |
| Multi-format from day one | Full format selector with legality and sideboard rules | |

**User's choice:** Commander primary, format-aware
**Notes:** Commander is the hero path, but support generic deck sizes via format dropdown.

---

## Category System

### Default Categories

| Option | Description | Selected |
|--------|-------------|----------|
| Core 8 | Ramp, Card Draw, Removal, Board Wipes, Lands, Creatures, Protection, Win Conditions | |
| Minimal 4 | Lands, Creatures, Spells, Other | |
| Uncategorized only | One bucket, users build from scratch | |
| You decide | Claude picks | |

**User's choice:** "Card types (standardised) and tags for things like ramp/draw/board wipes etc. with filters by colour/CMC etc. Standard deck builder functionality with suggestions like EDH REC"
**Notes:** Two-layer approach — auto card types as primary grouping + functional tags as secondary. More like Moxfield's approach.

### Grouping Axis

| Option | Description | Selected |
|--------|-------------|----------|
| Type groups + tag filters | Cards grouped by card type, tags as filter/overlay | ✓ |
| Switchable group-by | User toggles grouping: By Type, By Tag, By CMC, By Colour | |
| Custom categories only | No auto-grouping, manual buckets | |

**User's choice:** Type groups + tag filters
**Notes:** Clean separation between type grouping and tag filtering.

### Tag Assignment

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-suggest + manual | Oracle text heuristics for auto-suggesting tags | |
| Manual only | Users tag cards themselves | |
| You decide | Claude picks | |

**User's choice:** "Auto suggest based on popularity a la EDH REC"
**Notes:** EDHREC-backed suggestions are Phase 4. For Phase 3, oracle text heuristics as placeholder.

### Phase 3 Tag Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Oracle text heuristics | Basic auto-suggest from card text patterns, Phase 4 upgrades to EDHREC | ✓ |
| Manual tagging only | Users assign tags, Phase 4 adds auto-suggestions | |
| You decide | Claude picks | |

**User's choice:** Oracle text heuristics
**Notes:** Placeholder until Phase 4 EDHREC integration.

---

## Deck Management

### Deck Access/Switching

| Option | Description | Selected |
|--------|-------------|----------|
| Deck list landing | Grid of deck cards with commander art, name, count, last edited. Click to open editor. | ✓ |
| Dropdown switcher | Three-panel always visible, dropdown to switch decks | |
| Sidebar deck list | Decks listed in sidebar, editor always open | |

**User's choice:** Deck list landing
**Notes:** Clean separation between browsing and editing.

### Deck Management Actions

| Option | Description | Selected |
|--------|-------------|----------|
| Rename | Inline or via context menu | ✓ |
| Duplicate | Clone deck as variant | ✓ |
| Delete with confirmation | Confirmation modal, destructive | ✓ |
| Change commander | Swap commander, updates colour identity | ✓ |

**User's choice:** All four selected, plus user noted "why not edit?"
**Notes:** Edit/Open is the primary click action on deck cards. The four options above are secondary actions available via context menu.

---

## Collection Awareness

### Owned/Missing Visual

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle indicators | Small green/red dots on tiles, summary bar at top | ✓ |
| Ghost border on missing | Faded border + reduced opacity on missing cards | |
| Highlight missing only | No indicator on owned, red accent on missing | |

**User's choice:** Subtle indicators
**Notes:** Not intrusive, always visible. Summary bar shows owned count and missing cost.

### In Collection Toggle

| Option | Description | Selected |
|--------|-------------|----------|
| Filter toggle | Toggle in search panel: ON = owned only, OFF = all cards (default) | ✓ |
| Sort owned-first | No toggle, owned cards sort to top | |
| You decide | Claude picks | |

**User's choice:** Filter toggle
**Notes:** Default OFF. When ON, results filtered to collection entries.

### Duplicate Card Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Increment quantity | Add again = increment qty, singleton warning for Commander | ✓ |
| Block with warning | Prevent duplicates in Commander mode | |
| You decide | Claude picks | |

**User's choice:** Increment quantity
**Notes:** Commander singleton rule: warn but allow (Relentless Rats, Shadowborn Apostle exempt). No limit for 60-card formats.

---

## Claude's Discretion

- Drag-and-drop interaction details (handle placement, drop zones, animation)
- Analytics chart styling within Organic Brutalism
- Search panel filter control placement
- Tag colour coding scheme
- Default tag set for new decks
- Format dropdown options and labels
- Deck list landing grid layout

## Deferred Ideas

- EDHREC-backed tag auto-suggestions (Phase 4)
- Card legality checking per format (Phase 4)
- Salt score display (Phase 4)
- Sideboard support (not in v1)
