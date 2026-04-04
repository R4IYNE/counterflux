# Phase 2: Collection Manager (Treasure Cruise) - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the full Collection Manager screen (Treasure Cruise): adding/editing/deleting cards with quantity and foil status, three view modes (gallery, table, set completion), mass entry terminal with batch syntax parsing, CSV import from Deckbox/Moxfield/Archidekt/generic formats, CSV export, inline collection analytics (total value, breakdowns by colour/set/rarity, top 10 most valuable), virtualised scrolling at 1,000+ cards, and a "used in decks" UI hook for Phase 3 wiring.

</domain>

<decisions>
## Implementation Decisions

### Collection Data Model
- **D-01:** Collection entries stored in a new Dexie table with `scryfall_id` as foreign key to the existing `cards` table. One collection entry = one printing. Card metadata (name, image, type, price) always resolved from the cards table — no embedded snapshots.
- **D-02:** Categories simplified from requirements: **Owned** (with quantity) and **Wishlist** only. No Trade Binder, no Lent Out, no borrower tracking. A card CAN be both Owned and on the Wishlist simultaneously (e.g., own 1 copy, want a foil or different printing).
- **D-03:** **No condition tracking** in v1 (NM/LP/MP/HP/DMG dropped). Can be added later.
- **D-04:** **No user-entered cost basis / acquired price.** Pricing is purely market-driven from Scryfall's `prices.eur` and `prices.eur_foil` fields (Cardmarket EU averages). Already cached in IndexedDB from bulk data, updates daily. Zero extra API calls.
- **D-05:** Foil status tracked as a boolean field on each collection entry.

### View Modes & Gallery Layout
- **D-06:** Simplified from the Stitch mockup — use it as inspiration but skip the high-value side panel. Focus on core grid + filters + stats header.
- **D-07:** Gallery card tiles show: card image, name (truncated), EUR market price, set name/code, foil badge if applicable.
- **D-08:** Table view columns: Name, Set, Qty, Foil, Price (EUR), Category. All sortable and filterable.
- **D-09:** Set completion view shows per-set progress bars (owned/total), filterable by rarity tier per COLL-04.
- **D-10:** Virtualised scrolling reuses the Phase 1 custom ~150-line vanilla JS virtual scroller pattern for consistency. No new dependencies.

### Claude's Discretion
- View mode switching UX (toggle buttons vs tabs — Claude picks what fits Organic Brutalism)
- Mass entry terminal input UX (textarea with live parsing vs sequential — Claude picks for power users)
- Stats header layout and content within the inline analytics area
- Specific filter/sort controls and their placement

### View Switching
- **D-11:** Claude's discretion on toggle buttons vs tabs — pick whichever fits the Organic Brutalism design language. Active view highlighted with Izzet glow.

### Mass Entry Terminal
- **D-12:** Batch syntax simplified to: `{qty}x {name} [{set}] {foil?}` — no condition, no price.
- **D-13:** Auto-resolve to newest printing by default. Ambiguous/unresolved items flagged with dropdown to pick correct printing. User confirms full batch before committing to collection.

### Import/Export
- **D-14:** CSV import supports all four formats: Deckbox, Moxfield, Archidekt, and generic with manual column mapping. Auto-detection based on column headers.
- **D-15:** CSV export of collection data (COLL-10).

### Analytics
- **D-16:** Core analytics only: total collection value (EUR), breakdown by colour/set/rarity (bar/pie charts via Chart.js), top 10 most valuable cards. No price gainers/losers (requires historical price tracking — deferred).
- **D-17:** Analytics displayed inline on the collection screen — stats summary at top, detailed breakdowns in collapsible panel or sub-tab within Treasure Cruise. No separate screen.

### Deck Cross-Reference
- **D-18:** Build a "Used in decks" section in card detail view now, showing "No decks yet" placeholder. Phase 3 wires it when decks exist. Data relationship ready from day one.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System
- `assets/stitch/stitch_izzet_arcana_app_corgi_izzet_companion_mtg_izzet_forge_darkmode_izzet_hub/aetheric_terminal_v3/DESIGN.md` — Organic Brutalism philosophy, colour tokens, surface hierarchy, typography triad, elevation rules, component specs
- `.planning/phases/01-foundation-data-layer/01-CONTEXT.md` — Phase 1 decisions: visual identity, typography, colour palette, no-line rule, ghost borders, Mila integration

### Screen Mockup
- `assets/stitch/stitch_izzet_arcana_app_corgi_izzet_companion_mtg_izzet_forge_darkmode_izzet_hub/treasure_cruise_collection_manager_terminology_update/screen.png` — Collection Manager mockup (simplified, not followed exactly)
- `assets/stitch/stitch_izzet_arcana_app_corgi_izzet_companion_mtg_izzet_forge_darkmode_izzet_hub/treasure_cruise_collection_manager_terminology_update/code.html` — Reference HTML implementation with Tailwind classes

### PRD & Requirements
- `assets/stitch/stitch_izzet_arcana_app_corgi_izzet_companion_mtg_izzet_forge_darkmode_izzet_hub/counterflux_prd.md` — Full PRD with data architecture and UI screen specifications
- `.planning/REQUIREMENTS.md` — v1 requirements COLL-01 through COLL-13

### Existing Code
- `src/db/schema.js` — Dexie database schema (cards table, meta table). Collection table must be added here via schema version bump.
- `src/db/search.js` — Card search implementation (reusable for mass entry resolution and add-card autocomplete)
- `src/db/card-accessor.js` — Unified card field accessor for all Scryfall layouts
- `src/stores/app.js` — Alpine store pattern (app store, toast store). Collection store follows same pattern.
- `src/screens/treasure-cruise.js` — Current placeholder screen module. Will be replaced.
- `src/components/empty-state.js` — Reusable empty state component with Mila

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Card search** (`src/db/search.js`): `searchCards()` with startsWith + includes fallback — reusable for mass entry card resolution and add-card autocomplete
- **Card accessor** (`src/db/card-accessor.js`): Unified field accessor handling all Scryfall card layouts (transform, split, modal_dfc, etc.)
- **Empty state component** (`src/components/empty-state.js`): Mila-powered empty states — use for empty collection
- **Toast notifications** (`src/stores/app.js`): Toast store for success/error feedback on add/import/delete actions
- **Virtual scroller**: ~150-line vanilla JS implementation documented in CLAUDE.md — reuse for gallery and table views

### Established Patterns
- Alpine.store() for state management (app, toast, search, bulkdata stores exist)
- Screen modules export `mount(container)` function, loaded by Navigo router
- Organic Brutalism visual system: 0px border-radius, tonal shifting for boundaries, ghost borders for data grids, JetBrains Mono for metadata
- Syne for headers, Space Grotesk for body text
- Chart.js available in stack for analytics charts

### Integration Points
- `src/db/schema.js` — Add new `collection` table via Dexie schema version 2
- `src/stores/` — Add new `collection.js` Alpine store
- `src/screens/treasure-cruise.js` — Replace placeholder with full collection manager
- `src/router.js` — Unlock Treasure Cruise route (currently locked in app store)
- `src/stores/app.js` — Set `locked: false` for treasure-cruise screen entry

</code_context>

<specifics>
## Specific Ideas

- Pricing in EUR (Cardmarket averages) via Scryfall's `prices.eur` / `prices.eur_foil` fields — already in bulk data cache
- Mockup shows "Archive Manifest" as the collection header with stats — use as inspiration but simplify
- Mockup has "CRITICAL_ASSETS_DETECTED" panel for high-value cards — deferred (part of simplified analytics approach)
- Category model is deliberately minimal (Owned + Wishlist) — simpler than COLL-07 requirements. Can evolve.
- Cards can be both Owned and Wishlisted simultaneously (want a different printing/foil)

</specifics>

<deferred>
## Deferred Ideas

- **Price gainers/losers tracking** — Requires historical price snapshots stored over time. Adds a new Dexie table and background job. Could be added in a future analytics enhancement phase.
- **Condition tracking (NM/LP/MP/HP/DMG)** — Dropped from v1 for simplicity. Data model can accommodate it later with a schema migration.
- **Trade Binder / Lent Out categories with borrower tracking** — Dropped from COLL-07. Owned + Wishlist covers core needs.
- **Cost basis / acquired price / P&L calculations** — Dropped. Pricing is market-value only from Cardmarket EUR averages.
- **CRITICAL_ASSETS_DETECTED high-value panel** — From mockup. Could be added as analytics enhancement.

</deferred>

---

*Phase: 02-collection-manager-treasure-cruise*
*Context gathered: 2026-04-04*
