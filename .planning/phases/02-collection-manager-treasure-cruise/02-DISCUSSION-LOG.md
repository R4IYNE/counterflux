# Phase 2: Collection Manager (Treasure Cruise) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 02-collection-manager-treasure-cruise
**Areas discussed:** Collection data model, View modes & gallery layout, Mass entry terminal, Import/export & analytics

---

## Collection Data Model

### Card-to-Collection Relationship

| Option | Description | Selected |
|--------|-------------|----------|
| Reference by Scryfall ID | Collection stores scryfall_id FK to cards table. Lightweight, fresh metadata. | ✓ |
| Embedded card snapshot | Copy card fields into collection entry. Works offline if cards empty. | |

**User's choice:** Reference by Scryfall ID
**Notes:** One collection entry = one printing.

### Inventory Categories

| Option | Description | Selected |
|--------|-------------|----------|
| Category field (enum) | collection/trade/wishlist/lent with borrower field for lent | |
| Tags-based system | Multiple tags per card, more flexible | |

**User's choice:** Custom — Owned (with quantity) + Wishlist only. No Trade Binder, no Lent Out. Simplified from requirements.
**Notes:** "tags but no 'lent' - simple owned (with number), in deck (must be owned), and wishlist"

### Owned + Wishlist Overlap

| Option | Description | Selected |
|--------|-------------|----------|
| Mutually exclusive | Card is either Owned or Wishlist, not both | |
| Can be both | Independent flags — own 1 copy, wishlist for foil/different printing | ✓ |

**User's choice:** Can be both
**Notes:** User wants flexibility for wanting different printings of cards they already own.

### Pricing Model

| Option | Description | Selected |
|--------|-------------|----------|
| Optional cost basis | User enters what they paid, P&L calculated | |
| Required cost basis | Every entry must have price | |
| No cost basis | Market value only from Scryfall | |

**User's choice:** Custom — No user-entered cost basis. Prices should be UK/EU costs from Cardmarket averages. Collection value is for sell/trade assessment, not P&L tracking.
**Notes:** "costs should be UK costs i.e. magiccardmarketeu averages - no need to say how much the user paid"

### Price Source

| Option | Description | Selected |
|--------|-------------|----------|
| Scryfall EUR prices | Use prices.eur from bulk data (Cardmarket sourced) | |
| Direct Cardmarket API | Fetch directly for more accuracy | |

**User's choice:** You decide (Claude's discretion)
**Notes:** Claude chose Scryfall EUR prices — already cached, zero extra API calls, works offline.

### Condition Tracking

| Option | Description | Selected |
|--------|-------------|----------|
| Keep condition tracking | NM/LP/MP/HP/DMG field on entries | |
| Skip condition in v1 | Drop for simplicity, add later | ✓ |

**User's choice:** Skip condition in v1

---

## View Modes & Gallery Layout

### Mockup Fidelity

| Option | Description | Selected |
|--------|-------------|----------|
| Follow mockup closely | Replicate Archive Manifest header, colour pills, CRITICAL_ASSETS panel | |
| Simplify from mockup | Use as inspiration, skip high-value panel, simpler header | ✓ |

**User's choice:** Simplify from mockup

### View Switching

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle buttons in toolbar | Icon buttons for grid/list/bar-chart | |
| Tabs below header | Named tabs (Gallery, Table, Sets) | |

**User's choice:** You decide (Claude's discretion)

### Gallery Card Tiles

| Option | Description | Selected |
|--------|-------------|----------|
| Name + price + set | Card name, EUR price, set name, foil badge | ✓ |
| Name + set only | Cleaner, price on hover | |
| Name + price + quantity | Emphasise collection tracking | |

**User's choice:** Name + price + set

### Table View Columns

| Option | Description | Selected |
|--------|-------------|----------|
| Name, Set, Qty, Foil, Price, Category | Core columns matching simplified model | ✓ |
| Maximalist | All available fields including collector #, mana cost, type, rarity | |

**User's choice:** Name, Set, Qty, Foil, Price, Category

### Virtual Scrolling

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse Phase 1 pattern | ~150-line vanilla JS virtual scroller | ✓ |

**User's choice:** Reuse Phase 1 pattern

---

## Mass Entry Terminal

### Input UX

| Option | Description | Selected |
|--------|-------------|----------|
| Textarea with live parsing | Multi-line, real-time green/red indicators | |
| Single-line sequential | One at a time, guided flow | |

**User's choice:** You decide (Claude's discretion)

### Ambiguity Resolution

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-pick newest, flag alternatives | Auto-resolve newest printing, dropdown for ambiguous | ✓ |
| Always ask on ambiguity | Pause on every ambiguous line | |

**User's choice:** Auto-pick newest, flag alternatives

---

## Import/Export & Analytics

### CSV Import Formats

| Option | Description | Selected |
|--------|-------------|----------|
| All three + generic | Deckbox, Moxfield, Archidekt with auto-detect + generic mapping | ✓ |
| Generic only | Manual column mapping for any format | |

**User's choice:** All three + generic

### Analytics Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Core analytics | Total value, colour/set/rarity breakdowns, top 10. No price history. | ✓ |
| Full analytics | Everything including gainers/losers and historical charts | |

**User's choice:** Core analytics

### Analytics Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Inline on collection screen | Stats summary at top, breakdowns in collapsible panel | ✓ |
| Separate analytics tab | Fourth view mode alongside Gallery/Table/Sets | |

**User's choice:** Inline on collection screen

### Deck Cross-Reference

| Option | Description | Selected |
|--------|-------------|----------|
| Build hook, wire in Phase 3 | Add "Used in decks" UI now with placeholder | ✓ |
| Defer to Phase 3 | No deck reference UI until Phase 3 | |

**User's choice:** Build hook, wire in Phase 3

---

## Claude's Discretion

- Price source: Scryfall `prices.eur` / `prices.eur_foil` (Cardmarket averages from bulk data)
- View mode switching UX (toggle buttons vs tabs)
- Mass entry terminal input UX (textarea vs sequential)
- Stats header layout within inline analytics

## Deferred Ideas

- Price gainers/losers tracking (needs historical snapshots)
- Condition tracking (NM/LP/MP/HP/DMG)
- Trade Binder / Lent Out categories
- Cost basis / acquired price / P&L
- CRITICAL_ASSETS_DETECTED high-value panel from mockup
