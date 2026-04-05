# Phase 3: Deck Builder (Thousand-Year Storm) - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the Deck Builder screen (Thousand-Year Storm): deck list landing with commander art cards, Initialize Ritual modal wizard for deck creation (Commander-primary with format-aware deck sizes), three-panel editor (search / the 99 / analytics), card type grouping with functional tags and oracle text auto-suggestion, drag-and-drop via SortableJS, live analytics sidebar (mana curve, colour pie, type breakdown, category fill, price summary), collection-aware owned/missing indicators, "In Collection" filter toggle, import from Moxfield/Archidekt/MTGGoldfish/plain text, export as plain text/MTGO/Arena/CSV.

</domain>

<decisions>
## Implementation Decisions

### Initialize Ritual Flow
- **D-01:** Deck creation uses a **modal wizard overlay** with the "Initialize Ritual" theme. Steps: (1) search/select commander with autocomplete filtered to legendary creatures, (2) if commander has Partner/Partner With, a second search field appears for the partner — colour identity auto-merges, (3) companions get a separate optional slot, (4) name your deck (auto-suggested from commander name, editable), (5) confirm colour identity display, (6) "Begin Ritual" button opens three-panel editor.
- **D-02:** **No life total** in the ritual — life totals are a Game Tracker (Vandalblast) concern, not deck builder.
- **D-03:** **Commander-primary, format-aware.** Commander is the default and hero experience (100 cards including commander, colour identity lock, singleton with warning). A format dropdown in the ritual also supports generic deck sizes (60-card Standard/Modern/etc.) without legality checks. Legality checking deferred to Phase 4 Intelligence Layer.

### Category System
- **D-04:** Two-layer organisation: **card types** (auto-classified from Scryfall `type_line`) as the primary grouping axis in the centre panel — Creatures, Instants, Sorceries, Enchantments, Artifacts, Planeswalkers, Lands. These are standardised and automatic.
- **D-05:** **Functional tags** as a secondary layer — Ramp, Card Draw, Removal, Board Wipes, Win Conditions, Protection, etc. A card can have multiple tags. Tags are user-assignable and filterable. Clicking a tag in the filter bar highlights/filters cards with that tag across all type groups.
- **D-06:** **Oracle text heuristics** for auto-suggesting tags in Phase 3 (e.g., "search your library for a land" -> Ramp, "draw a card" -> Card Draw, "destroy target" -> Removal). Phase 4 upgrades this to EDHREC-backed popularity suggestions.
- **D-07:** Users can **create custom tags**, rename tags, and delete tags. Default tag set provided on new deck creation.

### Deck Management
- **D-08:** Thousand-Year Storm screen opens to a **deck list landing** — grid of deck cards showing commander art thumbnail, deck name, card count (e.g., 87/99), format badge, last edited timestamp. Click a deck card to open the three-panel editor.
- **D-09:** **"Initialize Ritual" button** prominently displayed on the deck list landing for creating new decks.
- **D-10:** Deck management actions available via **context menu** (right-click on deck card): Rename (inline edit), Duplicate (clone deck as variant), Delete (confirmation modal, destructive), Change Commander (re-opens ritual modal with current commander pre-filled, updates colour identity).
- **D-11:** **Edit/Open** is the primary click action on any deck card — opens the three-panel editor.

### Collection Awareness
- **D-12:** **Subtle dot indicators** on card tiles in the deck editor: small green dot = owned, small red dot = missing. Not intrusive, always visible. Unowned cards look normal with full opacity but have the red dot + price shown.
- **D-13:** **Summary bar** at top of centre panel: "You own 72/99 — Missing cost: £47.30" (using GBP conversion from EUR via existing `eurToGbp()`).
- **D-14:** **"In Collection" filter toggle** in the search panel: ON = only show cards the user owns, OFF = show all cards (default). When ON, results come from collection entries joined with card data.
- **D-15:** When adding a card already in the deck, **increment quantity** with a toast notification (e.g., "Sol Ring x2"). Commander singleton rule: warn but allow (some cards like Relentless Rats, Shadowborn Apostle are exempt). For 60-card formats, no quantity limit.

### The 99 Display
- **D-16:** Centre panel toggles between **visual grid** (card images with drag-and-drop) and **compact list view** (table rows). Default is visual grid.
- **D-17:** Cards grouped by card type as primary axis, with type headers showing count (e.g., "CREATURES (23)"). Drag-and-drop reordering within and between groups via SortableJS.
- **D-18:** **Persistent card count tracker** in the centre panel header: "67/99 — 32 slots remaining" (adjusts to format deck size).

### Analytics Sidebar
- **D-19:** Live-updating analytics in the right panel, all recalculating within 100ms on card add/remove:
  - Mana curve bar chart (CMC 0-7+, colour-coded by mana identity)
  - Colour pie doughnut chart (mana symbol distribution)
  - Type breakdown (creatures/instants/sorceries/enchantments/artifacts/planeswalkers/lands)
  - Category/tag breakdown with card counts
  - Price summary (total deck cost, cost of unowned cards, most expensive card)

### Import/Export
- **D-20:** Import decklists from Moxfield, Archidekt, MTGGoldfish, and plain text formats. Auto-detect format from paste/file content. Unresolved cards flagged for manual matching (reuse mass entry resolution pattern from Phase 2).
- **D-21:** Export as plain text, MTGO format, Arena format, and CSV.

### Context Menu & Flyout
- **D-22:** Right-click context menu on cards in the deck editor: Remove from Deck, Change Quantity, Add Tag, Add to Collection, Add to Wishlist, View Details, View on Scryfall. Reuses Phase 2 context menu pattern (custom DOM events).
- **D-23:** Card detail flyout reuses Phase 1/2 pattern — full image, Oracle text, type line, mana cost, price, legalities, collection status, deck usage.

### Claude's Discretion
- Drag-and-drop interaction details (handle placement, drop zone highlighting, animation)
- Analytics chart styling within Organic Brutalism constraints
- Search panel filter control placement and layout
- Tag colour coding scheme (if any)
- Default tag set for new decks
- Format dropdown options and labels
- Deck list landing grid layout and responsive breakpoints

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System
- `assets/stitch/stitch_izzet_arcana_app_corgi_izzet_companion_mtg_izzet_forge_darkmode_izzet_hub/aetheric_terminal_v3/DESIGN.md` — Organic Brutalism philosophy, colour tokens, surface hierarchy, typography triad, component specs
- `.planning/phases/01-foundation-data-layer/01-CONTEXT.md` — Phase 1 decisions: visual identity, typography, colour palette, no-line rule, ghost borders, Mila integration

### Screen Mockup
- `assets/stitch/stitch_izzet_arcana_app_corgi_izzet_companion_mtg_izzet_forge_darkmode_izzet_hub/thousand_year_storm_deck_builder_v3_updated_nav/screen.png` — Deck Builder mockup: three-panel layout, category numbering, 67/99 counter, analytics sidebar with mana curve + colour pie + salt score
- `assets/stitch/stitch_izzet_arcana_app_corgi_izzet_companion_mtg_izzet_forge_darkmode_izzet_hub/thousand_year_storm_deck_builder_v3_updated_nav/code.html` — Reference HTML implementation

### PRD & Requirements
- `assets/stitch/stitch_izzet_arcana_app_corgi_izzet_companion_mtg_izzet_forge_darkmode_izzet_hub/counterflux_prd.md` — Full PRD with data architecture, deck builder specifications
- `.planning/REQUIREMENTS.md` — v1 requirements DECK-01 through DECK-19

### Prior Phase Context
- `.planning/phases/02-collection-manager-treasure-cruise/02-CONTEXT.md` — Phase 2 decisions: collection data model (Dexie schema v2), categories (Owned + Wishlist), pricing (EUR via Scryfall with GBP conversion), context menu pattern

### Project Planning
- `.planning/ROADMAP.md` — Phase definitions, success criteria, dependency chain
- `.planning/PROJECT.md` — Product definition, constraints, target users

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Card search** (`src/db/search.js`): `searchCards()` with startsWith + includes fallback — reusable for commander search in ritual and deck card search panel
- **Card accessor** (`src/db/card-accessor.js`): Unified field accessor for all Scryfall layouts — handles transform, split, modal DFC, etc.
- **Card tile** (`src/components/card-tile.js`): `renderCardTile()` with image, name, price, foil badge — adaptable for deck builder card tiles with owned/missing indicators
- **Context menu** (`src/components/context-menu.js`): Custom DOM event pattern (`collection-context-menu`) — reusable pattern for deck context menu (`deck-context-menu`)
- **Virtual scroller** (`src/components/virtual-scroller.js`): ~150-line vanilla JS virtual scroll — reusable for large card lists in search results
- **Empty state** (`src/components/empty-state.js`): Mila-powered empty states — use for empty deck list and empty categories
- **Toast notifications** (`src/stores/app.js`): Toast store for feedback on add/remove/import actions
- **Collection store** (`src/stores/collection.js`): Collection Alpine store with entries, filters, sorting — data source for "In Collection" toggle and owned/missing indicators
- **Filter bar** (`src/components/filter-bar.js`): Existing filter bar component — pattern reference for deck search filters
- **Gallery view** (`src/components/gallery-view.js`): Card grid rendering — adaptable for deck visual grid view
- **Chart.js analytics** (`src/components/analytics-panel.js`): Chart.js integration with tree-shaking, destroy() cleanup — reusable for deck analytics (mana curve, colour pie)
- **Currency conversion** (`src/services/currency.js`): `eurToGbp()` function for price display
- **Mana parser** (`src/utils/mana.js`): `renderManaCost()` for mana symbol rendering in deck cards and analytics

### Established Patterns
- Alpine.store() for state management — deck store follows same pattern
- Screen modules export `mount(container)` function, loaded by Navigo router
- Organic Brutalism visual system: 0px border-radius, tonal shifting, ghost borders for data grids, JetBrains Mono uppercase for metadata
- Context menu uses custom DOM events for decoupled communication
- Chart.js instances need destroy() on panel close to prevent memory leaks

### Integration Points
- `src/db/schema.js` — Add `decks` and `deck_cards` tables via Dexie schema version 3
- `src/stores/` — Add new `deck.js` Alpine store
- `src/screens/thousand-year.js` — Replace placeholder with full deck builder
- `src/stores/app.js` — Unlock thousand-year screen in sidebar (set `locked: false`)
- `src/stores/collection.js` — Cross-reference: query collection for owned/missing checks
- COLL-13 wiring: Collection card detail view shows "Used in decks" — wire to deck data

</code_context>

<specifics>
## Specific Ideas

- Mockup shows numbered categories (01 // RAMP, 02 // WIN COND, 03 // REMOVAL) — this informed the original category approach, but user decided on type-based grouping with functional tags instead
- Mockup shows "ARCHIVE ANALYTICS" header in right panel with mana curve, colour pie, and salt score (7/10 CRITICAL) — salt score is Phase 4 (EDHREC data), build the panel structure now with a placeholder
- "Initialize Ritual" naming carries through the whole deck creation flow — maintain the thematic language (Begin Ritual, Ritual Complete, etc.)
- Pricing in GBP via `eurToGbp()` — consistent with Phase 2 collection pricing
- Partner commander support (Krark + Sakashima shown in ritual preview) is a core Commander requirement — not an edge case
- Oracle text heuristic tagging is a Phase 3 placeholder that Phase 4 replaces with EDHREC-backed suggestions — design the tag API to be source-agnostic

</specifics>

<deferred>
## Deferred Ideas

- **EDHREC-backed tag auto-suggestions** — Phase 4 Intelligence Layer. Phase 3 ships with oracle text heuristics as placeholder.
- **Card legality checking per format** — Phase 4 Intelligence Layer. Phase 3 allows any card regardless of format legality.
- **Salt score display** — Phase 4 (EDHREC data required). Build analytics panel structure now with placeholder.
- **Sideboard support** — Not in v1 scope. Commander doesn't use sideboards (companions are handled separately).

</deferred>

---

*Phase: 03-deck-builder-thousand-year-storm*
*Context gathered: 2026-04-05*
