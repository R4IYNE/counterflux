# Requirements: Counterflux — The Aetheric Archive

**Defined:** 2026-04-03
**Core Value:** The deck builder knows what you own, and the collection knows what's in your decks — one interconnected data layer

## v1 Requirements

### Data Layer

- [ ] **DATA-01**: App downloads and caches Scryfall Oracle Cards bulk data (~80MB) in IndexedDB via Web Worker stream parsing
- [ ] **DATA-02**: App refreshes bulk data cache daily (background, non-blocking)
- [ ] **DATA-03**: User can search cards using Scryfall full-text syntax (type, colour, CMC, oracle text, set, rarity)
- [ ] **DATA-04**: Card search autocomplete returns suggestions within 200ms as user types
- [ ] **DATA-05**: App handles all Scryfall card layouts correctly (normal, transform, modal_dfc, split, flip, meld, adventure, reversible_card) via unified card accessor
- [ ] **DATA-06**: App respects Scryfall rate limits (50-100ms between requests, User-Agent header, no paywalling)
- [ ] **DATA-07**: All user data (collection, decks, games) persists in IndexedDB via Dexie.js with schema versioning
- [ ] **DATA-08**: App prompts for persistent storage permission to prevent Safari ITP eviction

### UI Shell

- [ ] **SHELL-01**: Persistent left sidebar with navigation to all 5 screens (Epic Experiment, Thousand-Year Storm, Treasure Cruise, Preordain, Vandalblast)
- [ ] **SHELL-02**: Sidebar collapses to icons on smaller viewports
- [ ] **SHELL-03**: Persistent top app bar with Counterflux wordmark, global card search, and notification bell
- [ ] **SHELL-04**: Hash-based SPA routing between screens with lazy loading
- [ ] **SHELL-05**: Full Izzet visual identity applied: colour palette (12 CSS custom properties), ghost borders, active glow effects, aether gradient background
- [ ] **SHELL-06**: Typography system: Crimson Pro (headings), Space Grotesk (body), JetBrains Mono (data/stats)
- [ ] **SHELL-07**: Toast notification system (info/success/warning/error, bottom-right, auto-dismiss 5s)

### Mila (System Familiar)

- [ ] **MILA-01**: Mila avatar displayed at bottom of sidebar navigation
- [ ] **MILA-02**: Empty states across all screens show Mila with contextual onboarding message
- [ ] **MILA-03**: Loading states show Mila icon with subtle animation

### Dashboard (Epic Experiment)

- [ ] **DASH-01**: Portfolio summary panel showing total collection value, 7/30/90-day change, unique card count, total card count, sparkline chart
- [ ] **DASH-02**: Quick Add input with autocomplete — supports quantity prefix (4x), set code suffix ([2XM]), condition/foil toggles
- [ ] **DASH-03**: Price alerts panel showing cards that crossed user-set price thresholds
- [ ] **DASH-04**: Mila's Insight panel with rotating daily tip (upgrade suggestion, price alert, or collection stat)
- [ ] **DASH-05**: Recent activity timeline (cards added, decks modified, games played)
- [ ] **DASH-06**: Deck quick-launch grid with commander art thumbnails and "Initialize Ritual" button
- [ ] **DASH-07**: Upcoming releases panel showing next 2-3 MTG sets with dates

### Collection Manager (Treasure Cruise)

- [ ] **COLL-01**: User can add cards to collection with quantity, condition (NM/LP/MP/HP/DMG), foil status, and acquired price
- [ ] **COLL-02**: Gallery view displays card images in a filterable, sortable grid (by name, set, price, date, colour)
- [ ] **COLL-03**: Table view displays spreadsheet-style rows (name, set, collector #, condition, foil, qty, location, market price, cost basis, P&L) with sortable/filterable columns
- [ ] **COLL-04**: Set completion view shows per-set progress bars (owned/total), filterable by rarity tier
- [ ] **COLL-05**: Mass entry terminal accepts batch syntax: `{qty}x {name} [{set}] {condition} {foil?} {@price?}` with Scryfall auto-resolution
- [ ] **COLL-06**: Unresolved mass entry items flagged for manual matching with confirmation modal
- [ ] **COLL-07**: Inventory categories: Collection, Trade Binder, Wishlist, Lent Out (with borrower tracking)
- [ ] **COLL-08**: Collection analytics: total value with historical chart, breakdown by set/colour/rarity, top 10 most valuable, price gainers/losers, cost basis vs market P&L
- [ ] **COLL-09**: CSV import supporting Deckbox, Moxfield, Archidekt, and generic formats with column mapping
- [ ] **COLL-10**: CSV export of collection data
- [ ] **COLL-11**: Collection view virtualised for smooth scrolling at 1,000+ cards
- [ ] **COLL-12**: User can edit and delete existing collection entries
- [ ] **COLL-13**: Cards in collection show which decks they appear in

### Deck Builder (Thousand-Year Storm)

- [ ] **DECK-01**: Three-panel layout: card search (left), the 99 (centre), live analytics (right)
- [ ] **DECK-02**: Card search powered by Scryfall with full syntax, autocomplete, and filter toggles (colour identity locked to commander, card type, CMC, rarity)
- [ ] **DECK-03**: "In Collection" toggle filters search results to cards user owns; unowned cards show ghost border with price
- [ ] **DECK-04**: The 99 toggles between visual grid (card images, drag-and-drop) and list view (compact table)
- [ ] **DECK-05**: User-defined category sorting (Ramp, Card Draw, Removal, etc.) with custom category creation
- [ ] **DECK-06**: Drag-and-drop cards between categories via SortableJS
- [ ] **DECK-07**: Persistent card count tracker: `67/99 — 32 slots remaining`
- [ ] **DECK-08**: Owned/missing indicators (green/red dots) with summary: "You own 72 of 99 cards. Remaining cost: £47.30"
- [ ] **DECK-09**: Live mana curve bar chart (CMC 0-7+, colour-coded) with average CMC
- [ ] **DECK-10**: Live colour pie doughnut chart (mana symbol distribution vs land colour production)
- [ ] **DECK-11**: Live type breakdown (creatures/instants/sorceries/enchantments/artifacts/planeswalkers/lands)
- [ ] **DECK-12**: Live category breakdown with card counts and target fill indicator
- [ ] **DECK-13**: Price summary (total cost, cost of unowned, most expensive card)
- [ ] **DECK-14**: Initialize Ritual flow: enter commander (autocomplete), auto-populate colour identity, lock filters, open canvas
- [ ] **DECK-15**: Support partner commanders and companions
- [ ] **DECK-16**: Import decklists from Moxfield, Archidekt, MTGGoldfish, and plain text formats
- [ ] **DECK-17**: Export as plain text, MTGO format, Arena format, and CSV
- [ ] **DECK-18**: Right-click context menu on cards: Add to Deck, Add to Collection, Add to Wishlist, View Details, View on Scryfall
- [ ] **DECK-19**: Card detail flyout: full image, Oracle text, type line, mana cost, price, legalities, collection status, deck usage

### Intelligence Layer

- [ ] **INTEL-01**: EDHREC synergy suggestions surfaced on commander selection (top synergy cards filtered by colour identity with lift scores)
- [ ] **INTEL-02**: Category gap detection: prompt when deck has fewer than threshold ramp/removal/draw cards
- [ ] **INTEL-03**: Commander Spellbook combo detection: surface known combos in current 99 with badge, pieces, and steps
- [ ] **INTEL-04**: Near-miss combo suggestions where only 1 piece is missing
- [ ] **INTEL-05**: Salt score aggregate for deck (from EDHREC data)
- [ ] **INTEL-06**: Mila's daily insights: upgrade suggestions, price alerts, collection stats

### Market Intel (Preordain)

- [ ] **MRKT-01**: Spoiler browser showing upcoming/recent sets with filterable card image gallery (colour, rarity, type)
- [ ] **MRKT-02**: New cards highlighted with "NEW" badge during spoiler season
- [ ] **MRKT-03**: Price watchlist: user-curated cards with current price, 7/30/90-day trend, sparkline, target price
- [ ] **MRKT-04**: Price alert configuration: notify on price below/above threshold or change by percentage
- [ ] **MRKT-05**: Market trends: top movers (24h/7d/30d), format staples tracker, reprint tracker
- [ ] **MRKT-06**: Release calendar: visual timeline of upcoming MTG products with dates and types

### Game Tracker (Vandalblast)

- [ ] **GAME-01**: Game setup: select deck (from builder) or enter commander manually, set starting life (default 40), add 1-5 opponents with name/commander/colour
- [ ] **GAME-02**: Life total tracking with large readable numbers, +/- buttons, long-press for fast adjustment (5/10 increments)
- [ ] **GAME-03**: Commander damage tracking per-player per-commander, auto-flag at 21+, support partner commanders
- [ ] **GAME-04**: Poison counter tracking per-player, auto-KO at 10
- [ ] **GAME-05**: Commander tax tracking (cast count and current tax cost per player)
- [ ] **GAME-06**: Additional counters: Energy, Experience, Treasure, Monarch, Initiative, Day/Night, City's Blessing, Storm count
- [ ] **GAME-07**: Turn tracker with current turn number and optional timer (stopwatch/countdown/chess-clock)
- [ ] **GAME-08**: Dice roller: d4, d6, d8, d10, d12, d20, high-roll mode, coin flip
- [ ] **GAME-09**: Post-game summary: duration, turn count, winner, elimination order
- [ ] **GAME-10**: Life total chart: line graph of each player's life over the game, shareable as image
- [ ] **GAME-11**: Game saved to history linked to deck
- [ ] **GAME-12**: Game history stats: win rate by deck, average game length, most-played commanders, win rate by player, win streaks
- [ ] **GAME-13**: Vandalblast has a mobile-responsive layout for use at the table

### Interaction Patterns

- [ ] **UX-01**: Keyboard shortcuts: `/` focuses card search, Escape closes modals, Enter confirms
- [ ] **UX-02**: Right-click context menus on card tiles across all screens
- [ ] **UX-03**: Ctrl+Z undo for destructive actions (card removal, deck deletion) with 10-second grace period

### Offline & Performance

- [ ] **PERF-01**: Initial page load under 3 seconds on broadband
- [ ] **PERF-02**: Full collection and deck data available offline after initial load
- [ ] **PERF-03**: Game Tracker fully functional offline
- [ ] **PERF-04**: Deck builder analytics recalculate within 100ms on card add/remove
- [ ] **PERF-05**: Stale price data indicator when offline

## v2 Requirements

### Cloud & Social (Future Phase 5)

- **CLOUD-01**: Supabase integration for user accounts and authentication
- **CLOUD-02**: Cloud sync for cross-device collection and deck access
- **CLOUD-03**: Shareable deck links (public URLs)
- **CLOUD-04**: Firemind (Personal Analytics) — aggregate insights across all modules
- **CLOUD-05**: Trade binder matching between users

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile companion app | Desktop-first. Vandalblast responsive layout covers game-day mobile use |
| Real-time marketplace integration | Scryfall daily prices sufficient. Real-time adds API cost and complexity |
| OAuth / social login | No user accounts in v1 (local-first) |
| Card scanning (camera) | High complexity, low reliability. Mass entry terminal is faster for power users |
| Multiplayer / real-time collaboration | Adds enormous complexity. Single-user tool in v1 |
| AI-powered deck recommendations | Over-engineering. EDHREC data is the recommendation engine |
| Custom card creation | Niche use case, high complexity, deferred indefinitely |
| Multi-language card data | English-only in v1. Scryfall supports it but adds UI complexity |
| Planeswalker loyalty tracking in Game Tracker | Niche, complex (per-planeswalker per-player), deferred |

## Traceability

Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| (populated by roadmapper) | | |

**Coverage:**
- v1 requirements: 78 total
- Mapped to phases: 0
- Unmapped: 78

---
*Requirements defined: 2026-04-03*
*Last updated: 2026-04-03 after initial definition*
