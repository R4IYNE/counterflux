# Phase 4: Intelligence Layer - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver data-driven deck intelligence: EDHREC synergy suggestions with lift scores filtered by colour identity, Commander Spellbook combo detection with badges on combo pieces and near-miss suggestions, category gap analysis with inline warnings for Ramp/Draw/Removal/Lands/Board Wipes, aggregate salt score gauge in the analytics sidebar, and a Mila insight generation service for deck upgrade suggestions (wired to dashboard in Phase 6).

</domain>

<decisions>
## Implementation Decisions

### EDHREC Data Sourcing
- **D-01:** Primary data source is **EDHREC's internal JSON endpoints** (e.g. `/json/commanders/{commander}.json`). Unofficial but structured and stable. HTML scraping as fallback if JSON endpoints fail or change format.
- **D-02:** EDHREC data **cached in IndexedDB** (Dexie) keyed by commander name/ID. First fetch hits EDHREC, subsequent views use cache. Cache refreshes on demand or after 7 days.
- **D-03:** **Graceful degradation** on EDHREC failure — show "Intelligence unavailable — using local heuristics" message. Fall back to existing oracle text tag heuristics from `tag-heuristics.js`. Salt score shows "N/A". No crash, no blocking.
- **D-04:** Rate limiting on EDHREC requests — respect their servers, batch requests, add delays between fetches.

### Commander Spellbook (Combo Data)
- **D-05:** Use **Commander Spellbook's public API** to fetch combos by card name. Returns pieces, steps, and results. Well-documented and purpose-built.
- **D-06:** Combo data also cached in IndexedDB per deck/commander for offline access after first fetch.

### Intelligence UI Placement
- **D-07:** Synergy suggestions appear as a **new "SYNERGY SUGGESTIONS" section in the right analytics sidebar** below existing charts. Shows top 10-15 synergy cards with lift scores. Clicking a suggestion adds it to deck. Three-panel layout stays intact.
- **D-08:** Combo detection uses **badges on combo piece card tiles** in the 99. Clicking the badge shows a popover with combo name, all pieces, and steps. Near-miss combos (1 piece missing) shown in analytics sidebar with the missing piece highlighted.
- **D-09:** Salt score **replaces the existing placeholder** in the analytics panel with a visual gauge (0-10 scale, colour-coded green/yellow/red). Matches mockup's "SALT: 7/10 CRITICAL" design.
- **D-10:** Gap warnings displayed **inline in the tag/category breakdown section** — tags below threshold show a warning icon + amber text (e.g. "Ramp: 3 cards -- below 8"). Contextual, right where the user already looks.

### Category Gap Thresholds
- **D-11:** **Sensible defaults, user-editable per deck.** Ship with community-standard defaults. Users can adjust thresholds in a settings popover accessible from the gap warning area.
- **D-12:** Default thresholds (100-card Commander): Ramp: 10, Draw: 10, Removal: 8, Board Wipes: 3, Lands: 36. Scale proportionally for 60-card formats.
- **D-13:** Gap detection covers **five categories**: Ramp, Draw, Removal, Board Wipes, and Lands. Not all default tags — archetype-specific tags (Mill, Stax, Tokens) would generate false warnings.

### Mila's Daily Insights (INTEL-06)
- **D-14:** Insight content focused on **deck upgrade suggestions** — Mila suggests swapping a card for a higher-synergy alternative from EDHREC data. E.g. "Swap Cultivate for Three Visits in your Prossh deck — 12% higher synergy". Directly actionable.
- **D-15:** Insight appears on the **Epic Experiment dashboard only** (DASH-04 panel). Phase 4 builds the insight generation service; Phase 6 wires it to the dashboard UI.
- **D-16:** One insight per day, rotated. Insight generation service picks the most impactful suggestion across all user decks.

### Claude's Discretion
- EDHREC JSON endpoint URL patterns and parsing strategy (research needed)
- Commander Spellbook API query structure and response mapping
- Synergy card tile design within the analytics sidebar
- Combo badge icon/styling within Organic Brutalism
- Salt gauge visual design (bar vs radial vs linear)
- Gap threshold settings popover UX
- Insight generation algorithm (how to rank upgrade suggestions)
- Cache invalidation strategy details (7-day default, on-demand refresh UX)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System
- `assets/stitch/stitch_izzet_arcana_app_corgi_izzet_companion_mtg_izzet_forge_darkmode_izzet_hub/aetheric_terminal_v3/DESIGN.md` — Organic Brutalism philosophy, colour tokens, surface hierarchy, component specs
- `.planning/phases/01-foundation-data-layer/01-CONTEXT.md` — Phase 1 decisions: visual identity, typography, colour palette, no-line rule, ghost borders

### Screen Mockup
- `assets/stitch/stitch_izzet_arcana_app_corgi_izzet_companion_mtg_izzet_forge_darkmode_izzet_hub/thousand_year_storm_deck_builder_v3_updated_nav/screen.png` — Deck Builder mockup showing salt score "SALT: 7/10 CRITICAL" in analytics sidebar
- `assets/stitch/stitch_izzet_arcana_app_corgi_izzet_companion_mtg_izzet_forge_darkmode_izzet_hub/thousand_year_storm_deck_builder_v3_updated_nav/code.html` — Reference HTML for analytics panel layout

### PRD & Requirements
- `.planning/REQUIREMENTS.md` — v1 requirements INTEL-01 through INTEL-06
- `assets/stitch/stitch_izzet_arcana_app_corgi_izzet_companion_mtg_izzet_forge_darkmode_izzet_hub/counterflux_prd.md` — Full PRD with intelligence layer specifications

### Prior Phase Context
- `.planning/phases/03-deck-builder-thousand-year-storm/03-CONTEXT.md` — Phase 3 decisions: three-panel layout, tag system (source-agnostic API), analytics sidebar, salt score placeholder, oracle text heuristics

### Existing Code (Key Files)
- `src/utils/tag-heuristics.js` — Oracle text heuristic engine with DEFAULT_TAGS and TAG_HEURISTICS patterns. Phase 4 upgrades this with EDHREC-backed suggestions.
- `src/utils/deck-analytics.js` — `computeDeckAnalytics()` pure function. Gap detection integrates here.
- `src/components/deck-analytics-panel.js` — Analytics sidebar with salt score placeholder at line 359-369. Synergy section, gap warnings, and salt gauge wire into this component.
- `src/stores/deck.js` — Deck Alpine store. Intelligence data feeds through this store.
- `src/services/currency.js` — `eurToGbp()` / `eurToGbpValue()` for price display in synergy suggestions.
- `src/db/schema.js` — Dexie schema. New tables needed for EDHREC cache and combo cache.
- `src/components/deck-card-tile.js` — Card tiles in deck editor. Combo badges added here.

### Project Planning
- `.planning/ROADMAP.md` — Phase definitions, success criteria, dependency chain
- `.planning/STATE.md` — Current progress, blockers/concerns about EDHREC API and Commander Spellbook

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Tag heuristics** (`src/utils/tag-heuristics.js`): 18 default tags with regex patterns. EDHREC suggestions can augment or replace these per commander.
- **Deck analytics** (`src/utils/deck-analytics.js`): Single-pass analytics computation. Gap detection hooks into the tag breakdown already computed here.
- **Analytics panel** (`src/components/deck-analytics-panel.js`): Chart.js with tree-shaking, Organic Brutalism styling, salt score placeholder ready to replace.
- **Card tile** (`src/components/deck-card-tile.js`): Deck editor card tiles. Combo badge needs to be added as an overlay element.
- **Currency conversion** (`src/services/currency.js`): GBP conversion for synergy card prices.
- **Mana parser** (`src/utils/mana.js`): `renderManaCost()` for rendering mana costs on synergy suggestion tiles.
- **Toast notifications** (`src/stores/app.js`): For feedback on intelligence actions (e.g. "Added Sol Ring from suggestions").

### Established Patterns
- Alpine.store() for state management — intelligence store follows same pattern
- Imperative DOM rendering in analytics panel (not Alpine templates)
- Chart.js instances with destroy() cleanup on panel close
- Dexie schema versioning for new tables
- Rate-limited API queue pattern (ScryfallService uses 75ms-spaced queue)

### Integration Points
- `src/db/schema.js` — Add `edhrec_cache` and `combo_cache` Dexie tables via schema version bump
- `src/components/deck-analytics-panel.js` — Add synergy suggestions section, replace salt placeholder with gauge, add gap warnings to tag breakdown
- `src/components/deck-card-tile.js` — Add combo badge overlay
- `src/stores/deck.js` — Expose intelligence data (synergies, combos, gaps, salt) for reactive UI
- `src/services/` — New `edhrec.js` and `spellbook.js` service modules
- `src/utils/deck-analytics.js` — Extend with gap detection logic

</code_context>

<specifics>
## Specific Ideas

- Salt score gauge should match the mockup's "SALT: 7/10 CRITICAL" aesthetic — bold, alarming at high values, colour-coded within Organic Brutalism palette
- Synergy suggestions should feel like "EDHREC whispers" — surfaced recommendations, not forced additions. Click to add, not auto-add.
- Combo badges should be subtle enough not to clutter the card grid but discoverable — small icon overlay, popover on click with full combo details
- Insight generation service is a Phase 4 deliverable but its UI is Phase 6 — build the data/logic layer now, dashboard wiring later
- Tag API remains source-agnostic: oracle heuristics (Phase 3) and EDHREC suggestions (Phase 4) both feed into the same tag system
- EDHREC JSON endpoints are the same data that powers their website — likely includes synergy percentages, salt scores, and top cards per commander

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-intelligence-layer*
*Context gathered: 2026-04-06*
