---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: completed
stopped_at: Phase 5 UI-SPEC approved
last_updated: "2026-04-08T21:29:32.986Z"
last_activity: 2026-04-07
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 19
  completed_plans: 18
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-03)

**Core value:** The deck builder knows what you own, and the collection knows what's in your decks — one interconnected data layer
**Current focus:** Phase 04 — intelligence-layer (COMPLETE)

## Current Position

Phase: 5
Plan: Not started
Status: Phase 4 complete — ready for Phase 5
Last activity: 2026-04-07

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01 P01 | 8min | 2 tasks | 26 files |
| Phase 01 P03 | 6min | 2 tasks | 17 files |
| Phase 01 P04 | 8min | 1 tasks | 5 files |
| Phase 02 P03 | 7min | 2 tasks | 12 files |
| Phase 02 P04 | 7min | 2 tasks | 8 files |
| Phase 03 P01 | 9min | 2 tasks | 14 files |
| Phase 03 P02 | 5min | 2 tasks | 8 files |
| Phase 03 P03 | 7min | 2 tasks | 7 files |
| Phase 03 P04 | 4min | 2 tasks | 2 files |
| Phase 03 P05 | 5min | 2 tasks | 7 files |
| Phase 04 P02 | 3min | 2 tasks | 5 files |
| Phase 04 P03 | 4min | 2 tasks | 4 files |
| Phase 04 P04 | 12min | 3 tasks | 16 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Stack: Alpine.js 3.15 + Dexie.js 4 + Chart.js 4 + Vite 8 + Tailwind CSS v4 + SortableJS + Navigo + mana-font (~99KB JS gzipped)
- Scryfall bulk data must be stream-parsed in Web Worker (300MB JSON will crash tab if parsed with JSON.parse)
- EDHREC API access needs research when Phase 4 approaches (no official public API)
- [Phase 01]: Used fontsource npm packages for self-hosted .woff2 fonts
- [Phase 01]: Material Symbols Outlined-only import (3.9MB vs 12.6MB)
- [Phase 01]: Vite 8 manualChunks uses function form for Rolldown compatibility
- [Phase 01]: Storage utils use dependency injection for browser API testability
- [Phase 01]: ROUTE_MAP exported from router.js for testable route-to-screen mapping
- [Phase 01]: Screen module pattern: each screen exports mount(container) function
- [Phase 01]: Toast store tested as plain object decoupled from Alpine runtime
- [Phase 01]: 150ms debounce for autocomplete balancing responsiveness with DB load
- [Phase 01]: renderManaCost exposed as window global for Alpine template x-html usage
- [Phase 02]: Context menu uses custom DOM events for decoupled cross-component communication
- [Phase 02]: Collection store initialized in main.js alongside other stores
- [Phase 02]: PapaParse unparse needs explicit fields array for empty data
- [Phase 02]: Analytics computation functions exported as pure functions for testability, Chart.js tree-shaken
- [Phase 02]: Chart.js cleanup: destroy() instances on panel close to prevent memory leaks
- [Phase 03]: Extracted computeDeckAnalytics to utils/deck-analytics.js for Alpine-free testability
- [Phase 03]: Removed duplicate scryfall_id index from deck_cards schema (ConstraintError fix)
- [Phase 03]: Ritual modal uses imperative DOM approach for complex multi-step async wizard
- [Phase 03]: Deck landing uses Alpine.data() registration for reactive grid with async enrichment
- [Phase 03]: Centre panel uses 500ms polling for header stats (imperative DOM, not Alpine template)
- [Phase 03]: Tag manager placed in analytics right panel above chart placeholder
- [Phase 03]: Deck analytics prices formatted directly as GBP (already converted by eurToGbpValue) rather than round-tripping through eurToGbp
- [Phase 03]: PapaParse unparse with explicit fields array for CSV export; empty CSV returns header-only
- [Phase 03]: Import modal uses imperative DOM pattern consistent with centre panel
- [Phase 03]: Format auto-detection regex cascade: Moxfield > Archidekt > Arena > plaintext
- [Phase 04]: Spellbook mapCombo includes zoneLocations for future zone display
- [Phase 04]: Gap detection sorts results critical-first for UI priority
- [Phase 04]: Salt label thresholds: 0-3 MILD, 4-6 SPICY, 7-10 CRITICAL
- [Phase 04]: Combo cache 24h TTL; insight rotation day-of-year % top-10 pool
- [Phase 04]: Vite dev server CORS proxy for EDHREC and Spellbook APIs (CloudFront blocks OPTIONS preflight)
- [Phase 04]: Intelligence UI reads store reactively; synergy card add resolves Scryfall ID by name before deck addCard

### Pending Todos

None yet.

### Blockers/Concerns

- EDHREC has no official public API — may require scraping or community wrapper (affects Phase 4)
- Commander Spellbook API documentation quality unknown (affects Phase 4)
- Navigo router last updated ~5 years ago — may need custom fallback

## Session Continuity

Last session: 2026-04-08T21:29:32.984Z
Stopped at: Phase 5 UI-SPEC approved
Resume file: .planning/phases/05-market-intel-game-tracker/05-UI-SPEC.md
