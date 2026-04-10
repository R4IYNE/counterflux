# Roadmap: Counterflux — The Aetheric Archive

## Overview

Counterflux delivers a unified MTG command centre in six phases. Phase 1 validates the hardest technical risk (Scryfall bulk data + IndexedDB) and establishes the visual shell. Phases 2-4 build the three core modules in dependency order: Collection (first user value), Deck Builder (core differentiator), then Intelligence (enhances decks with EDHREC/combos). Phase 5 adds the remaining independent modules (Market Intel + Game Tracker). Phase 6 wires everything into the Dashboard, adds cross-cutting UX polish, and hardens offline/performance. Each phase delivers standalone, verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation + Data Layer** - Scryfall bulk data pipeline, IndexedDB persistence, navigation shell, Izzet visual identity, Mila system familiar
- [ ] **Phase 2: Collection Manager (Treasure Cruise)** - Full collection management with gallery/table/set views, mass entry, CSV import/export, analytics
- [ ] **Phase 3: Deck Builder (Thousand-Year Storm)** - Three-panel editor with search, drag-and-drop categories, live analytics, collection-aware owned/missing
- [x] **Phase 4: Intelligence Layer** - EDHREC synergy suggestions, Commander Spellbook combo detection, category gap analysis, salt scores (completed 2026-04-06)
- [ ] **Phase 5: Market Intel + Game Tracker** - Spoiler browser, price watchlist, release calendar, life totals, commander damage, game history
- [ ] **Phase 6: Dashboard + Polish (Epic Experiment)** - Dashboard panels wired to all modules, keyboard shortcuts, undo system, offline hardening, performance targets

## Phase Details

### Phase 1: Foundation + Data Layer
**Goal**: Users can search Magic cards instantly from a cached local database inside an Izzet-themed navigation shell
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, DATA-08, SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05, SHELL-06, SHELL-07, MILA-01, MILA-02, MILA-03, PERF-01
**Success Criteria** (what must be TRUE):
  1. User opens the app and sees Scryfall bulk data downloading with progress indication; subsequent visits use cached data that refreshes daily in the background
  2. User can type a card name in the global search bar and see autocomplete suggestions within 200ms, with correct results for all card layouts (transform, split, modal DFC, etc.)
  3. User can navigate between all five screen placeholders via the sidebar, which collapses to icons on narrow viewports and shows Mila at the bottom
  4. The full Izzet visual identity is present: colour palette, ghost borders, active glow, aether gradient, Crimson Pro/Space Grotesk/JetBrains Mono typography, toast notifications
  5. Initial page load completes in under 3 seconds on broadband
**Plans:** 1/4 plans executed
Plans:
- [x] 01-01-PLAN.md — Project scaffold, Vite+Tailwind+fonts, Dexie schema, card accessor, search module, test infra
- [x] 01-02-PLAN.md — Web Worker bulk data pipeline, streaming parser, splash screen, Alpine bulkdata store
- [x] 01-03-PLAN.md — Navigation shell (sidebar, topbar, routing, toast, Mila, empty states)
- [x] 01-04-PLAN.md — Search autocomplete, card detail flyout, visual checkpoint
**UI hint**: yes

### Phase 2: Collection Manager (Treasure Cruise)
**Goal**: Users can manage their entire MTG collection with multiple view modes, bulk entry, import/export, and analytics
**Depends on**: Phase 1
**Requirements**: COLL-01, COLL-02, COLL-03, COLL-04, COLL-05, COLL-06, COLL-07, COLL-08, COLL-09, COLL-10, COLL-11, COLL-12, COLL-13
**Success Criteria** (what must be TRUE):
  1. User can add individual cards with quantity, condition, foil status, and price — and edit or delete them later
  2. User can switch between gallery view (card images), table view (spreadsheet rows with sortable/filterable columns), and set completion view (per-set progress bars)
  3. User can paste batch syntax into the mass entry terminal and have cards auto-resolved against Scryfall, with unresolved items flagged for manual matching
  4. User can import a CSV from Deckbox/Moxfield/Archidekt and export their collection as CSV
  5. User can view collection analytics (total value chart, breakdown by set/colour/rarity, top 10 most valuable, P&L) and see which decks each card appears in
**Plans:** 5 plans
Plans:
- [x] 02-01-PLAN.md — Dexie schema v2, Alpine collection store, dependency install, test scaffolds
- [ ] 02-02-PLAN.md — Screen layout, stats header, filter bar, gallery/table/set views, virtual scrolling
- [x] 02-03-PLAN.md — Add card modal, mass entry terminal, context menu, edit/delete, flyout enhancements
- [x] 02-04-PLAN.md — CSV import/export, Chart.js analytics panel
- [ ] 02-05-PLAN.md — Visual and functional verification checkpoint
**UI hint**: yes

### Phase 3: Deck Builder (Thousand-Year Storm)
**Goal**: Users can build Commander decks in a three-panel editor that knows what they own and provides live analytics
**Depends on**: Phase 2
**Requirements**: DECK-01, DECK-02, DECK-03, DECK-04, DECK-05, DECK-06, DECK-07, DECK-08, DECK-09, DECK-10, DECK-11, DECK-12, DECK-13, DECK-14, DECK-15, DECK-16, DECK-17, DECK-18, DECK-19
**Success Criteria** (what must be TRUE):
  1. User can start the "Initialize Ritual" flow by entering a commander, which locks colour identity and opens the three-panel editor (search / the 99 / analytics)
  2. User can search cards with Scryfall syntax, toggle "In Collection" to filter to owned cards, and add cards to the deck via drag-and-drop or context menu — with persistent card count tracking (67/99)
  3. User can organise cards into custom categories with drag-and-drop reordering, and toggle between visual grid and compact list views
  4. User can see live-updating mana curve, colour pie, type breakdown, category fill indicators, and price summary in the analytics sidebar — all recalculating within 100ms
  5. User can import decklists from Moxfield/Archidekt/MTGGoldfish/plain text and export as plain text, MTGO, Arena, or CSV formats
**Plans:** 5/6 plans executed
Plans:
- [x] 03-01-PLAN.md — Dexie schema v3, deck store, type classifier, tag heuristics, commander detection, tests
- [x] 03-02-PLAN.md — Deck landing page, Initialize Ritual modal, deck management context menu, SortableJS install
- [x] 03-03-PLAN.md — Three-panel editor layout, search panel, centre panel, card tiles, drag-and-drop, context menu, tags
- [x] 03-04-PLAN.md — Analytics sidebar: mana curve, colour pie, type/tag breakdown, price summary
- [x] 03-05-PLAN.md — Import/export services and modals (Moxfield, Archidekt, MTGGoldfish, plain text, CSV)
- [x] 03-06-PLAN.md — Integration wiring, sidebar unlock, search drag-to-deck, full verification checkpoint
**UI hint**: yes

### Phase 4: Intelligence Layer
**Goal**: Users receive data-driven deck recommendations, combo detection, and daily insights powered by EDHREC and Commander Spellbook
**Depends on**: Phase 3
**Requirements**: INTEL-01, INTEL-02, INTEL-03, INTEL-04, INTEL-05, INTEL-06
**Success Criteria** (what must be TRUE):
  1. User selects a commander and sees EDHREC top synergy suggestions filtered by colour identity with lift scores
  2. User sees known combos in their current 99 highlighted with badges, plus near-miss suggestions where only 1 piece is missing
  3. User is warned when their deck has fewer than threshold ramp, removal, or card draw cards, and can see the deck's aggregate salt score
**Plans:** 4/4 plans complete
Plans:
- [x] 04-01-PLAN.md — Dexie schema v4, EDHREC service with caching and rate limiting, salt score normalization, tests
- [x] 04-02-PLAN.md — Commander Spellbook combo detection service, gap detection utility, tests
- [x] 04-03-PLAN.md — Intelligence Alpine store orchestration, Mila insight engine, main.js wiring
- [x] 04-04-PLAN.md — UI integration: salt gauge, synergy suggestions, combo badges/popover, gap warnings, near-miss section, visual checkpoint
**UI hint**: yes

### Phase 5: Market Intel + Game Tracker
**Goal**: Users can track card prices with alerts and spoilers, and run full Commander game sessions with life totals, commander damage, and game history
**Depends on**: Phase 1
**Requirements**: MRKT-01, MRKT-02, MRKT-03, MRKT-04, MRKT-05, MRKT-06, GAME-01, GAME-02, GAME-03, GAME-04, GAME-05, GAME-06, GAME-07, GAME-08, GAME-09, GAME-10, GAME-11, GAME-12, GAME-13, PERF-03
**Success Criteria** (what must be TRUE):
  1. User can browse upcoming/recent set spoilers with filterable card gallery, see NEW badges during spoiler season, and view a release calendar of upcoming MTG products
  2. User can maintain a price watchlist with sparkline trends (7/30/90-day), set price alerts (above/below/percentage change), and browse top market movers
  3. User can set up a Commander game (select deck or enter commander, set life totals, add opponents), track life/commander damage/poison/commander tax/additional counters, and use dice/coin tools
  4. User can complete a game and see a post-game summary (duration, turns, winner, elimination order) with a life total chart, and browse game history with win rate stats by deck/player/commander
  5. Game Tracker works fully offline and has a mobile-responsive layout for use at the table
**Plans:** 8 plans
Plans:
- [x] 05-01-PLAN.md — Dexie schema v5, market store, price-history service, sets service, sparkline, tests
- [x] 05-02-PLAN.md — Game store, game-stats utility, game data layer tests
- [x] 05-03-PLAN.md — Preordain screen layout, tab bar, release calendar, spoiler gallery
- [x] 05-04-PLAN.md — Watchlist panel, movers panel, Watch Price context menu, alert badges
- [x] 05-05-PLAN.md — Vandalblast screen, game setup, player card grid, life/poison/damage tracking
- [x] 05-06-PLAN.md — Floating toolbar, dice roller, coin flipper, turn timer, counter panel
- [x] 05-07-PLAN.md — Post-game overlay, life chart, game history view, stats cards
- [x] 05-08-PLAN.md — Integration wiring, sidebar unlock, visual verification checkpoint
**UI hint**: yes

### Phase 6: Dashboard + Polish (Epic Experiment)
**Goal**: Users land on a unified dashboard that surfaces data from all modules, with keyboard-first interaction, undo support, and hardened offline/performance
**Depends on**: Phase 5
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07, UX-01, UX-02, UX-03, PERF-02, PERF-04, PERF-05
**Success Criteria** (what must be TRUE):
  1. User lands on Epic Experiment dashboard and sees portfolio summary (total value, change trends, sparkline), recent activity timeline, deck quick-launch grid, upcoming releases, Mila's daily insight, and price alerts
  2. User can Quick Add cards from the dashboard using autocomplete with quantity prefix, set code suffix, and condition/foil toggles
  3. User can press `/` to focus search, Escape to close modals, right-click any card tile for context menu, and Ctrl+Z to undo destructive actions with a 10-second grace period
  4. Full collection and deck data is available offline after initial load, with a stale price data indicator when connectivity is lost
**Plans:** 4 plans
Plans:
- [ ] 06-01-PLAN.md — Activity logger, undo store, undo toast, connectivity utility (foundation services)
- [ ] 06-02-PLAN.md — Keyboard shortcuts, cheat sheet modal, Escape priority chain
- [ ] 06-03-PLAN.md — Epic Experiment dashboard screen (all 7 panels, Quick Add, empty states)
- [ ] 06-04-PLAN.md — Status chip, auto-refresh, activity/undo integration, visual checkpoint
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Data Layer | 1/4 | In Progress|  |
| 2. Collection Manager (Treasure Cruise) | 0/5 | Planned | - |
| 3. Deck Builder (Thousand-Year Storm) | 5/6 | In Progress|  |
| 4. Intelligence Layer | 4/4 | Complete   | 2026-04-06 |
| 5. Market Intel + Game Tracker | 0/8 | Planned | - |
| 6. Dashboard + Polish (Epic Experiment) | 0/4 | Planned | - |
