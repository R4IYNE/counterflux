# Requirements: Counterflux v1.1 — Second Sunrise

**Defined:** 2026-04-14
**Core Value:** The deck builder knows what you own, and the collection knows what's in your decks — one interconnected data layer
**Milestone Goal:** Refine every rough edge users hit in v1.0, elevate Preordain's spoiler experience and Vandalblast's pod-play polish, and move Counterflux from single-device local-first to multi-device synced.

> **Prior milestone:** v1.0 requirements archived at `.planning/milestones/v1.0-REQUIREMENTS.md`.

## v1.1 Requirements

### Polish Pass (cross-app quick wins)

- [x] **POLISH-01**: Splash loading quotes render without `--` separators and use typographic treatment (quote mark, italic attribution, spacing)
- [x] **POLISH-02**: Izzet red (`#E23838`) accents injected across app — card detail hover, secondary CTAs, rag indicators — increasing red coverage from ~5% of surfaces to ~15%
- [x] **POLISH-03**: Favicon set to `assets/niv-mila.png` and declared via `<link rel="icon">` in `index.html`
- [x] **POLISH-04**: Card images in detail flyout render with rounded corners matching Scryfall's border-radius, no white triangles visible
- [x] **POLISH-05**: Toast icons render at full opacity (no alpha transparency) so they don't overlap with CTAs behind them
- [x] **POLISH-06**: Rename "Initiate ritual" → "Brew a new storm" and "Abandon ritual" → "Abandon storm" across ritual modal and any other call sites
- [x] **POLISH-07**: Additional-counters trigger icon changed from `more_horiz` to `+` (Material Symbols `add`)
- [x] **POLISH-08**: 'LIVE' status indicator refined — either pulsing dot added to justify the chip or chip removed entirely (decision during phase)
- [x] **POLISH-09**: Sidebar has a manual collapse toggle button (icon in sidebar header) that persists user preference across sessions
- [x] **POLISH-10**: Top losers panel never renders raw `scryfall_id` strings — missing names show graceful fallback or the entry is filtered out
- [x] **POLISH-11**: Add-to-wishlist toast reads "Added to wishlist" (not "Added to collection") — all wishlist add paths audited

### Performance

- [x] **PERF-01**: Web Vitals instrumentation (`web-vitals` 5.2.x) records LCP, FID, CLS, TTI, FCP on every page load; metrics visible in console in dev mode
- [x] **PERF-02**: Lighthouse CI (`@lhci/cli`) added as dev dependency with a `npm run perf` script that produces a desktop-preset report against `vite preview`
- [x] **PERF-03**: Baseline performance report committed to `.planning/` capturing current v1.0 numbers; target TTI/LCP set based on measured baseline
- [ ] **PERF-04**: Any regressions identified in baseline measurement are addressed (candidates: splash → bulk data deferral, store init, bundle splitting) to hit the agreed target

### Schema Migration (infrastructure for new features)

- [ ] **SCHEMA-01**: Dexie IndexedDB schema version 5 → 6 migration function backfills new fields (`updated_at`, `synced_at`, `turn_laps`) and adds new tables (`sync_queue`, `sync_conflicts`)
- [ ] **SCHEMA-02**: Migration tested against fixture data representing v1.0 user states (empty collection, 500-card collection, 10 decks, active games) with zero data loss
- [ ] **SCHEMA-03**: Pre-migration localStorage backup step captures a one-shot snapshot of critical Dexie tables before the upgrade runs

### Treasure Cruise (Collection Manager)

- [x] **COLLECT-01**: "Query database" results in add-card modal never show mana cost (audit confirms removed if previously present)
- [x] **COLLECT-02**: User can browse Scryfall precon products (`set_type: commander`, `duel_deck`, `starter`) in a precon drawer, view the full decklist, and one-click add all cards to collection
- [x] **COLLECT-03**: Card image preview renders in the card entry selection dropdown (thumbnail visible alongside name before selection)
- [x] **COLLECT-04**: User can click through a list of paper printings (`games: paper` filter on `prints_search_uri`) displayed as clickable set icons to switch the selected printing; price and identity update on selection
- [x] **COLLECT-05**: Mass entry terminal has a visible X close button in the header wired to the existing `discard()` method
- [x] **COLLECT-06**: Add-to-collection converts from modal overlay to a permanent left-hand-side pop-out panel; collection grid reflows to the right; user can add multiple cards in sequence without dismissing the panel

### Thousand-Year Storm (Deck Builder)

- [x] **DECK-01**: Deck editor back button is verified to return user to the deck list (QA existing implementation at `components/deck-editor.js:27-37`)
- [x] **DECK-02**: Mana curve and colour distribution charts validated against hand-calculated expected values for 3 representative decks; any data accuracy bugs fixed
- [x] **DECK-03**: Gap warning label removes the redundant category name; shows an RAG severity badge (red/amber/green) and the suggested count of cards to add (e.g. "+5")
- [x] **DECK-04**: Salt gauge shows a non-zero score for decks with salty cards; zero-score bug traced and fixed in `intelligence.js`
- [x] **DECK-05**: Commander renders as its own type category (separate from Creature) in the deck centre panel card grouping, using the deck's `commander_id`

### Preordain (Market Intel)

- [ ] **MARKET-01**: Set filter dropdown renders each option with its Keyrune set icon alongside the name and card count
- [ ] **MARKET-02**: Spoiler browser redesigned as a content-rich visual view — larger tiles, day/section headers, NEW badges (48h window), hover card preview
- [ ] **MARKET-03**: Spoiler card tiles surface a quick-add watch button that calls `addToWatchlist()` without opening the context menu

### Vandalblast (Game Tracker)

- [x] **GAME-01**: Player name no longer clips at the bottom of the player card in the 2-col grid (padding/overflow audit)
- [x] **GAME-02**: 3-player match grid uses dynamic layout (e.g. one player takes half-screen, other two stacked) rather than reusing the 2-col template
- [x] **GAME-03**: Life totals apply a RAG colour system: green > 20, amber ≤ 20, red ≤ 10; matches the existing poison lethal-highlight treatment
- [x] **GAME-04**: Poison, tax, and commander-damage expansion widgets show representative icons next to their counts
- [x] **GAME-05**: Fullscreen toggle on floating toolbar correctly enters and exits fullscreen without breaking layout or losing game state
- [x] **GAME-06**: User can add/remove additional counters directly from the expanded player card section (not only via the global counter panel)
- [x] **GAME-07**: At game start, a coin-flip/spinner picks the first player with visible animation; result persists for the game record
- [x] **GAME-08**: Active player is visually highlighted (border/glow); NEXT TURN button advances the highlight and resets the turn timer
- [x] **GAME-09**: Per-turn durations persist to the game record as `turn_laps: number[]`; post-game stats surface longest turn, avg turn, per-player avg
- [x] **GAME-10**: Turn timer uses a wall-clock anchor (e.g. `performance.now()` at turn start + wall delta) so background-tab throttling does not corrupt lap durations

### Authentication (Supabase)

- [ ] **AUTH-01**: Supabase JS client (`@supabase/supabase-js` 2.103.x) added as dependency and lazy-imported only when user initiates auth (preserves unauthenticated cold-boot bundle)
- [ ] **AUTH-02**: Email magic-link sign-in flow works end-to-end; Supabase auth configured with PKCE flow to avoid hash-fragment collision with Navigo router
- [ ] **AUTH-03**: Google OAuth sign-in flow works end-to-end (desktop browser)
- [ ] **AUTH-04**: Settings modal email field removed; profile name and avatar populate from auth identity when signed in; unauthenticated users see a "Sign in" CTA
- [ ] **AUTH-05**: Session persists across reloads; explicit sign-out clears Supabase session but preserves local Dexie data (local-first promise)
- [ ] **AUTH-06**: Row Level Security policies written for every synced table (`collection`, `decks`, `deck_cards`, `games`, `watchlist`, `profile`) enforcing `auth.uid() = user_id`; policies tested against a second user context

### Cloud Sync

- [ ] **SYNC-01**: Supabase Postgres schema mirrors the synced Dexie tables (collection, decks, deck_cards, games, watchlist, profile) with `user_id`, `updated_at`, and per-row primary keys
- [ ] **SYNC-02**: Dexie `table.hook()` taps enqueue create/update/delete ops for synced tables into the `sync_queue` outbox; non-synced tables (`cards`, `meta`, `*_cache`) are excluded
- [ ] **SYNC-03**: Sync engine flushes the outbox to Supabase via batched RPC; origin tagging prevents the server's echo from re-triggering the hook
- [ ] **SYNC-04**: First-sign-in reconciliation detects all 4 states (local/remote × empty/populated); populated-populated case prompts the user to merge, keep local, or keep remote — never silently destroys data
- [ ] **SYNC-05**: Conflict resolution uses last-write-wins at field level via `updated_at` timestamps; `deck_cards` treats each row as atomic; conflicts beyond LWW surface in the `sync_conflicts` table for user review
- [ ] **SYNC-06**: Offline queue survives reload and flushes automatically on reconnect; queue entries are tagged with `user_id` so sign-in switching never cross-contaminates users
- [ ] **SYNC-07**: Topbar sync-status indicator shows 4 states: synced, syncing, offline, error — replaces the existing connectivity chip
- [ ] **SYNC-08**: Notification bell surfaces sync errors (dedup'd) alongside existing watchlist price alerts; bell badge count unifies across sources

## Future Requirements

Deferred to v1.2+:

- Firemind (Personal Analytics) — collection P&L deep-dive, meta pulse
- Trade binder matching with other users
- EDHREC CORS proxy for production deployment (currently dev-proxy only)
- All-printings view including MTGO/Arena-only printings
- MTG news/RSS feed integration
- Mila loading animation (MILA-03 from v1.0)
- Precon support for Duel Decks, Starter Decks, Secret Lair drops (v1.1 covers `set_type: commander` only)
- Realtime WebSocket channels for sub-second device-to-device sync (v1.1 ships poll-on-focus)

## Out of Scope

Explicit exclusions for v1.1:

- **Mobile companion app** — Vandalblast responsive layout covers game-day use
- **Real-time marketplace pricing** — Scryfall daily prices sufficient; reduces Scryfall API load
- **Sync of cards table or bulk data cache** — only user-generated tables are synced; card data is sourced from Scryfall per-device
- **Multi-user collaboration** (shared decks, social features) — single user across multiple devices only
- **CRDT-based merging** — last-write-wins covers the single-user multi-device use case; CRDTs would be overkill

## Traceability

Mapped by roadmapper 2026-04-14. All 56 REQ-IDs assigned to exactly one phase; 100% coverage, zero orphans.

| REQ-ID | Phase |
|--------|-------|
| POLISH-01 | Phase 7 |
| POLISH-02 | Phase 7 |
| POLISH-03 | Phase 7 |
| POLISH-04 | Phase 7 |
| POLISH-05 | Phase 7 |
| POLISH-06 | Phase 7 |
| POLISH-07 | Phase 7 |
| POLISH-08 | Phase 7 |
| POLISH-09 | Phase 7 |
| POLISH-10 | Phase 7 |
| POLISH-11 | Phase 7 |
| PERF-01 | Phase 7 |
| PERF-02 | Phase 7 |
| PERF-03 | Phase 7 |
| PERF-04 | Phase 13 |
| SCHEMA-01 | Phase 7 |
| SCHEMA-02 | Phase 7 |
| SCHEMA-03 | Phase 7 |
| COLLECT-01 | Phase 8 |
| COLLECT-02 | Phase 8 |
| COLLECT-03 | Phase 8 |
| COLLECT-04 | Phase 8 |
| COLLECT-05 | Phase 8 |
| COLLECT-06 | Phase 8 |
| DECK-01 | Phase 9 |
| DECK-02 | Phase 9 |
| DECK-03 | Phase 9 |
| DECK-04 | Phase 9 |
| DECK-05 | Phase 9 |
| GAME-01 | Phase 9 |
| GAME-02 | Phase 9 |
| GAME-03 | Phase 9 |
| GAME-04 | Phase 9 |
| GAME-05 | Phase 9 |
| GAME-06 | Phase 9 |
| GAME-07 | Phase 9 |
| GAME-08 | Phase 9 |
| GAME-09 | Phase 9 |
| GAME-10 | Phase 9 |
| AUTH-01 | Phase 10 |
| AUTH-02 | Phase 10 |
| AUTH-03 | Phase 10 |
| AUTH-04 | Phase 10 |
| AUTH-05 | Phase 10 |
| AUTH-06 | Phase 10 |
| SYNC-01 | Phase 11 |
| SYNC-02 | Phase 11 |
| SYNC-03 | Phase 11 |
| SYNC-04 | Phase 11 |
| SYNC-05 | Phase 11 |
| SYNC-06 | Phase 11 |
| SYNC-07 | Phase 11 |
| SYNC-08 | Phase 12 |
| MARKET-01 | Phase 12 |
| MARKET-02 | Phase 12 |
| MARKET-03 | Phase 12 |

### Coverage by Phase

| Phase | Name | REQ Count | Categories Covered |
|-------|------|-----------|--------------------|
| 7 | Polish Pass + Perf Baseline + Schema Migration | 17 | POLISH (11) + PERF (3 of 4) + SCHEMA (3) |
| 8 | Treasure Cruise Rapid Entry | 6 | COLLECT (6) |
| 9 | Deck Accuracy + Vandalblast Pod Experience | 15 | DECK (5) + GAME (10) |
| 10 | Supabase Auth Foundation | 6 | AUTH (6) |
| 11 | Cloud Sync Engine | 7 | SYNC (7 of 8) |
| 12 | Notification Bell + Preordain Spoiler Refresh | 4 | SYNC-08 + MARKET (3) |
| 13 | Performance Optimisation (conditional) | 1 | PERF-04 |
| **Total** | | **56** | **9 categories, 100% coverage** |

---
*Last updated: 2026-04-14 — v1.1 Second Sunrise requirements defined; traceability populated by roadmapper*
