# Phase 1: Foundation + Data Layer - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the foundational infrastructure for Counterflux: Scryfall Default Cards bulk data pipeline (download, stream-parse in Web Worker, cache in IndexedDB via Dexie.js), global card search with autocomplete, SPA navigation shell with Izzet-themed sidebar, full "Organic Brutalism" visual identity, Mila system familiar integration, and toast notification system. Users can search Magic cards instantly from a cached local database inside the themed navigation shell.

</domain>

<decisions>
## Implementation Decisions

### Bulk Data Strategy
- **D-01:** Use Scryfall **Default Cards** bulk file (~300MB) from Phase 1 — not Oracle Cards. This gives per-printing data (set-specific art, collector numbers, prices) from the start, avoiding a two-tier migration later.
- **D-02:** First-load experience is a **full blocking splash screen** with Counterflux logo, Mila, progress bar, download stats (MB/total), and rotating MTG flavour text. User cannot interact until data is ready.
- **D-03:** Bulk file parsed via **streaming JSON parser** in a Web Worker (ReadableStream + incremental JSON tokenizer). Cards batch-inserted to IndexedDB as they're parsed. Lower peak memory (~50-100MB vs ~600MB for JSON.parse).
- **D-04:** Daily background refresh uses **full re-download** — check Scryfall bulk-data endpoint `updated_at` timestamp, re-download + re-parse if newer than cached. Silent background Worker, app uses stale cache until refresh completes.

### Card Search UX
- **D-05:** Autocomplete dropdown shows **card name + small thumbnail + set icon + mana cost** per suggestion. Rich, recognisable at a glance. Familiar pattern from Scryfall/Moxfield.
- **D-06:** Selecting a card from autocomplete opens a **card detail flyout** — slide-in panel showing full card image, Oracle text, type line, mana cost, price, legalities, and action buttons (Add to Collection, View on Scryfall). Consistent with DECK-19 flyout pattern.
- **D-07:** Search scope for Phase 1 is at **Claude's discretion** — may be name-only or include basic Scryfall syntax depending on implementation complexity. Full syntax required by Phase 2/3.

### Navigation Shell
- **D-08:** **Fixed sidebar rail** (~240px expanded, ~64px collapsed icon-only on narrow viewports). Active screen highlighted with Izzet glow. Sidebar border uses ghost-border token (#2A2D3A).
- **D-09:** Future screens (Treasure Cruise, Thousand-Year Storm, Preordain, Vandalblast) are **locked/greyed out** in the sidebar — visible but non-clickable until their phase is built.
- **D-10:** Main content area on load shows a **welcome/search landing** — Counterflux logo, Mila greeting, prominent search bar. The app's main value in Phase 1 is card search, so it's the hero.
- **D-11:** Screen transitions are **instant swap** — no animation, content replaces immediately, URL hash updates, scroll resets. Fast, snappy, terminal-feel.

### Izzet Visual Identity
- **D-12:** Visual effects are **bold and immersive** — pronounced ghost borders, strong coloured glow on active elements, visible aether gradient, decorative touches. Atmosphere-first, making it feel like a magical artifact.
- **D-13:** Follow the **"Organic Brutalism"** design system from Stitch DESIGN.md: 0px border-radius everywhere, no standard borders for layout (tonal shifting), ghost borders only as fallback at 15% opacity, glassmorphism for floating overlays.
- **D-14:** **"No-Line" Rule** — standard 1px borders are prohibited for defining layout sections. Boundaries established through tonal shifting (surface #14161C to surface-hover #1C1F28). Ghost border (#2A2D3A) only for data grids and explicit containment.
- **D-15:** Mana pips use **square/diamond containers** (0px radius), not circles — maintaining the brutalist aesthetic.

### Typography
- **D-16:** Typography follows the Stitch design system triad — **Syne** (display/headlines, bold and expressive), **Space Grotesk** (body, clean and functional), **JetBrains Mono** (labels/data/mono, terminal-heart). Crimson Pro available as serif accent. **Note:** This updates the original requirement of Crimson Pro (headings) + Space Grotesk (body) — Syne replaces Crimson Pro for headings per the Stitch designs.
- **D-17:** Fonts are **self-hosted** as .woff2 files — no Google Fonts CDN. Zero external requests, works fully offline, consistent with local-first philosophy. ~95KB total, cached on first load.
- **D-18:** JetBrains Mono used in **all-caps** for metadata to reinforce the terminal data-stream aesthetic.

### Mila (System Familiar)
- **D-19:** Mila appears as a **small avatar** (~40px circular) pinned to the bottom of the sidebar. User will provide the avatar asset (corgi illustration already exists in Stitch export).
- **D-20:** Loading states use an **animated Mila sprite** — multi-frame sprite animation (running/fetching). Requires sprite sheet artwork to be provided by user.
- **D-21:** Mila illustration is the **Izzet engineer variant** (`assets/assetsmila-izzet.png`) — corgi with brass goggles, red scarf, leather utility harness, and glowing blue aether vials on black background. Base corgi without gear also available in Stitch export (`gemini_image_clean_234w541_edited.png/screen.png`).

### Colour Palette (from Stitch code)
- **D-22:** Primary colour tokens confirmed from Stitch HTML implementation:
  - `primary`: #0D52BD (Izzet blue)
  - `secondary`: #E23838 (Izzet red)
  - `background`: #0B0C10 (deep void)
  - `surface`: #14161C
  - `surface-hover`: #1C1F28
  - `border-ghost`: #2A2D3A
  - `text-primary`: #EAECEE
  - `text-muted`: #7A8498
  - `text-dim`: #4A5064
  - `success`: #2ECC71
  - `warning`: #F39C12
  - `glow-blue`: rgba(13, 82, 189, 0.3)
  - `glow-red`: rgba(226, 56, 56, 0.25)

### Claude's Discretion
- Search syntax scope in Phase 1 (name-only vs basic Scryfall syntax) — D-07
- Toast notification positioning and auto-dismiss timing (requirements say bottom-right, 5s)
- Sidebar icon choices for each screen
- Scanline animation (present in Stitch HTML — optional decorative effect)

### Asset Dependencies (User-Provided)
- Mila avatar image for sidebar — Izzet engineer variant provided (`assets/assetsmila-izzet.png`), needs transparent background version
- Mila sprite sheet for loading animation (not yet created — based on Izzet engineer variant)
- Izzet guild logo / Counterflux wordmark (Izzet logo available in Stitch export)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System
- `assets/stitch/stitch_izzet_arcana_app_corgi_izzet_companion_mtg_izzet_forge_darkmode_izzet_hub/aetheric_terminal_v3/DESIGN.md` — Complete design system: Organic Brutalism philosophy, colour tokens, surface hierarchy, typography triad, elevation rules, component specs, do's and don'ts
- `assets/stitch/stitch_izzet_arcana_app_corgi_izzet_companion_mtg_izzet_forge_darkmode_izzet_hub/epic_experiment_dashboard_final_polished_v3/code.html` — Reference HTML implementation with Tailwind config, colour tokens, CSS utility classes (ghost-border, mono-data, syne-header, glass-overlay, aether-glow, scanline animation)

### Screen Mockups
- `assets/stitch/stitch_izzet_arcana_app_corgi_izzet_companion_mtg_izzet_forge_darkmode_izzet_hub/epic_experiment_dashboard_final_polished_v3/screen.png` — Dashboard (Epic Experiment) mockup: sidebar layout, portfolio panel, Mila insight, deck quick-launch, activity log
- `assets/stitch/stitch_izzet_arcana_app_corgi_izzet_companion_mtg_izzet_forge_darkmode_izzet_hub/treasure_cruise_collection_manager_terminology_update/screen.png` — Collection Manager mockup (Phase 2 reference)
- `assets/stitch/stitch_izzet_arcana_app_corgi_izzet_companion_mtg_izzet_forge_darkmode_izzet_hub/thousand_year_storm_deck_builder_v3_updated_nav/screen.png` — Deck Builder mockup (Phase 3 reference)
- `assets/stitch/stitch_izzet_arcana_app_corgi_izzet_companion_mtg_izzet_forge_darkmode_izzet_hub/vandalblast_game_tracker_v5_enhanced_setup/screen.png` — Game Tracker mockup (Phase 5 reference)

### Brand Assets
- `assets/assetsmila-izzet.png` — Mila the Corgi, Izzet engineer variant (goggles, scarf, harness, aether vials) — primary mascot asset
- `assets/stitch/stitch_izzet_arcana_app_corgi_izzet_companion_mtg_izzet_forge_darkmode_izzet_hub/61hy93au63l._ac_uf894_1000_ql80.jpg/screen.png` — Izzet guild logo (red drake symbol on dark blue)
- `assets/stitch/stitch_izzet_arcana_app_corgi_izzet_companion_mtg_izzet_forge_darkmode_izzet_hub/gemini_image_clean_234w541_edited.png/screen.png` — Mila the Corgi base illustration (no gear)

### PRD
- `assets/stitch/stitch_izzet_arcana_app_corgi_izzet_companion_mtg_izzet_forge_darkmode_izzet_hub/counterflux_prd.md` — Full Product Requirements Document with data architecture, user data model, Scryfall API details, UI screen specifications

### Project Planning
- `.planning/REQUIREMENTS.md` — v1 requirements with requirement IDs (DATA-01 through PERF-05)
- `.planning/ROADMAP.md` — Phase definitions, success criteria, dependency chain

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Stitch HTML mockups**: Four screen implementations with Tailwind CSS classes, colour tokens, and component patterns — can be used as reference for component structure
- **Tailwind config**: Complete colour/font/radius theme configuration extracted from Stitch code.html — can be adapted for Tailwind v4 `@theme` CSS syntax
- **CSS utility classes**: `ghost-border`, `mono-data`, `syne-header`, `glass-overlay`, `aether-glow`, `scanline` — ready to port to the real codebase
- **Mila corgi illustration**: Vector-style PNG on black background — needs transparent background version for sidebar use
- **Izzet guild logo**: PNG of the red drake symbol — usable as favicon/brand element

### Established Patterns
- No existing codebase patterns (greenfield project)
- Stitch mockups establish the visual pattern language: tonal surface hierarchy, JetBrains Mono for all data/metadata, Syne for headers, ghost borders for containment
- Material Symbols Outlined used for icons in Stitch mockups

### Integration Points
- Greenfield — no existing integration points
- Vite 8 project initialisation needed
- Alpine.js, Dexie.js, Navigo setup from scratch

</code_context>

<specifics>
## Specific Ideas

- The Stitch DESIGN.md calls for **"intentional asymmetry"** — offset headers, staggered grids, editorial feel. This should be visible from Phase 1
- **Scanline animation** exists in the Stitch HTML — a slow-moving blue gradient line that sweeps across panels. Atmospheric detail that reinforces the terminal aesthetic
- **Version label** in sidebar: "V.03.0-AETHERIC" style version string below the logo
- Sidebar logo uses a **cyclone** Material Symbol icon with primary blue tint
- The **"Initialize Ritual"** button appears in the sidebar bottom in dashboard mockup — this is a Phase 3 feature (deck creation) but the button placement pattern is established
- Typography conflict: DESIGN.md specifies Plus Jakarta Sans for body text, but Stitch HTML code uses Space Grotesk. **Decision: follow the HTML implementation (Space Grotesk)** as it's the latest iteration and matches the original requirements

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-data-layer*
*Context gathered: 2026-04-03*
