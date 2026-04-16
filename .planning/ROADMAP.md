# Roadmap: Counterflux — The Aetheric Archive

## Milestones

- [x] **v1.0 The Aetheric Archive** — Phases 1-6 (shipped 2026-04-13) — [archive](milestones/v1.0-ROADMAP.md)
- [ ] **v1.1 Second Sunrise** — Phases 7-13 (active, started 2026-04-14)

## Phases

<details>
<summary>✅ v1.0 The Aetheric Archive (Phases 1-6) — SHIPPED 2026-04-13</summary>

- [x] Phase 1: Foundation + Data Layer (4/4 plans) — Scryfall bulk pipeline, navigation shell, Izzet visual identity
- [x] Phase 2: Collection Manager / Treasure Cruise (5/5 plans) — Gallery/table/set views, mass entry, CSV import/export, analytics
- [x] Phase 3: Deck Builder / Thousand-Year Storm (6/6 plans) — Three-panel editor, drag-and-drop, live analytics, import/export
- [x] Phase 4: Intelligence Layer (4/4 plans) — EDHREC synergy, combo detection, salt scores, gap analysis
- [x] Phase 5: Market Intel + Game Tracker (8/8 plans) — Spoilers, watchlist, release calendar, full game lifecycle
- [x] Phase 6: Dashboard + Polish / Epic Experiment (4/4 plans) — Dashboard panels, keyboard shortcuts, undo, offline status

</details>

### v1.1 Second Sunrise (active)

- [ ] **Phase 7: Polish Pass + Perf Baseline + Schema Migration** — 11 cross-app polish fixes, web-vitals + Lighthouse baseline, Dexie v5→v6 migration with safe backfill of `updated_at`, `turn_laps`, and sync tables
- [ ] **Phase 8: Treasure Cruise Rapid Entry** — LHS persistent pop-out add panel, Commander precon browser with add-all, set-icon printing picker, mass-entry close button
- [ ] **Phase 9: Deck Accuracy + Vandalblast Pod Experience** — Deck analytics QA, RAG gap warning redesign, Commander-as-own-type, full Vandalblast layout/colour/counter uplift, first-player picker, visual turn indicator, persisted per-turn laps
- [ ] **Phase 10: Supabase Auth Foundation** — Lazy-loaded Supabase client, email magic-link + Google OAuth, PKCE flow, auth-aware profile, RLS policies on every synced table
- [ ] **Phase 11: Cloud Sync Engine** — Postgres schema, Dexie hook outbox, batched RPC flush, first-sign-in reconciliation, LWW conflict resolution, offline queue, topbar sync-status chip
- [ ] **Phase 12: Notification Bell + Preordain Spoiler Refresh** — Unified notification inbox with sync-error surfacing, set icons in spoiler dropdown, visual spoiler overhaul with NEW badges, quick add-to-watchlist
- [ ] **Phase 13: Performance Optimisation (conditional)** — Targeted fixes if baseline measurement reveals regressions vs agreed targets; documentation-only pass if targets already met

## Phase Details

### Phase 7: Polish Pass + Perf Baseline + Schema Migration
**Goal**: Resolve every v1.0 rough edge users reported, establish an honest performance baseline, and land the Dexie v6 schema that unblocks turn-lap persistence (Phase 9) and cloud sync (Phase 11)
**Depends on**: v1.0 shipped (Phase 6)
**Requirements**: POLISH-01, POLISH-02, POLISH-03, POLISH-04, POLISH-05, POLISH-06, POLISH-07, POLISH-08, POLISH-09, POLISH-10, POLISH-11, PERF-01, PERF-02, PERF-03, SCHEMA-01, SCHEMA-02, SCHEMA-03
**Success Criteria** (what must be TRUE):
  1. A v1.0 user upgrading to v1.1 opens the app, sees the migration complete without data loss, and every existing game/deck/collection row survives with new `updated_at`/`synced_at` timestamps and `turn_laps: []` populated
  2. Splash loading quotes, favicon, card-detail rounded corners, toast icon opacity, sidebar collapse toggle, "Brew a new storm" rename, red-accent coverage increase, and add-to-wishlist toast wording all pass visual QA across every screen
  3. Top losers panel shows only cards with resolvable names (no raw `scryfall_id` strings leak into the UI), and additional-counters uses a `+` icon in place of `more_horiz`
  4. Running `npm run perf` produces a desktop Lighthouse report against `vite preview`, and web-vitals metrics (LCP/INP/CLS/FCP/TTFB) log to the console on every page load in dev mode
  5. `.planning/` contains a committed baseline report capturing current v1.0 numbers with explicit TTI/LCP targets derived from measurement
**Plans**: 3 plans
  - [x] 07-01-PLAN.md — Polish batch: 11 cross-app polish fixes (POLISH-01..11)
  - [x] 07-02-PLAN.md — Perf baseline: web-vitals + Lighthouse CI tooling + committed PERF-BASELINE.md (PERF-01..03)
  - [x] 07-03-PLAN.md — Schema v6+v7 migration: temp-table shuffle to UUID PKs + sync_queue + sync_conflicts + profile (SCHEMA-01..03)

### Phase 8: Treasure Cruise Rapid Entry
**Goal**: Collectors can add cards faster than they could in v1.0 — whether entering one card, picking a specific printing, or importing a whole Commander precon
**Depends on**: Phase 7 (schema v6 adds the `precons` cache table)
**Requirements**: COLLECT-01, COLLECT-02, COLLECT-03, COLLECT-04, COLLECT-05, COLLECT-06
**Success Criteria** (what must be TRUE):
  1. User opens Treasure Cruise and the add-to-collection panel is a permanent left-hand-side pop-out; adding a card does not dismiss the panel, and the collection grid reflows to the right without reopening a modal
  2. User clicks "Browse precons", picks a Commander precon (e.g. Commander Masters), views the full decklist, and one click adds every card to their collection with a confirmation toast
  3. User searching for a card sees a thumbnail preview in the entry dropdown and can click through a list of set icons (paper printings only) to switch the selected printing; price and card identity update live
  4. Mass-entry terminal has a visible X close button in the header that discards the open session
  5. Add-card modal results never render mana cost (audit confirms removed)
**Plans**: 3 plans
  - [x] 08-01-PLAN.md — Polish batch: dropdown thumbnail, mass-entry X close, mana-cost audit (COLLECT-01, -03, -05)
  - [x] 08-02-PLAN.md — LHS panel conversion + printing picker + Scryfall queue (COLLECT-04, -06)
  - [x] 08-03-PLAN.md — Precon browser + Dexie v9 + src/services/precons.js (COLLECT-02)
**UI hint**: yes

### Phase 08.1: Treasure Cruise Polish & Precon Coverage (INSERTED)

**Goal:** Resolve four user-reported polish/bugfix items captured during Phase 8 human-UAT walkthrough — dropdown scroll cutoff, collapsed-panel re-open affordance, collection-grid hover-checkbox edit, and Commander precon coverage gap (allowlist widening + multi-deck size guard).
**Depends on:** Phase 8 (touches Phase 8 surfaces — add-card-panel, precon-browser, collection grid)
**Requirements**: None — polish phase, items derive from `phases/08-treasure-cruise-rapid-entry/follow-ups.md` and `debug/precon-browser-missing-commander-decks.md`
**Success Criteria** (what must be TRUE):
  1. LHS add-card panel dropdown shows all matching search results within an internally-scrollable area — no clipping by the panel boundary; scrollbar lives on the dropdown, not the panel
  2. Collapsed-panel re-open affordance is unmistakable — visually obvious chevron_right button (brighter accent, larger, or paired label) at the top-left of the collection grid
  3. Collection grid card tiles expose a checkbox on hover that opens the same quick-action menu as the existing right-click context menu; keyboard-accessible
  4. BROWSE PRECONS surfaces previously-missing Commander products via a code-level allowlist: Commander Masters (`cmm`), Commander Legends (`cmr`/`clb`), Planechase (`pca`/`pc2`/`hop`), Archenemy (`arc`/`e01`), Premium Deck Series (`pd2`/`pd3`/`h09`), Commander's Arsenal (`cm1`), Commander Collection (`cc1`/`cc2`), Game Night (`gnt`/`gn2`/`gn3`), Tales of Middle-earth Deluxe Commander Kit (`pltc`)
  5. Multi-deck Commander products (any precon with `decklist.length > 200` such as Doctor Who, Fallout, Warhammer 40K, Tales of Middle-earth, Final Fantasy, all modern C-decks) display a "This product contains multiple decks — open in Scryfall to pick a specific deck" message instead of dumping a 400-1000 card list; ADD ALL is disabled for bundled products
**Plans:** 3 plans

Plans:
- [ ] 08.1-01-PLAN.md — CSS polish batch: dropdown scroll containment + re-open affordance redesign (FOLLOWUP-1, FOLLOWUP-2)
- [ ] 08.1-02-PLAN.md — Precon coverage A+B: PRECON_EXTRA_CODES allowlist + multi-deck bundle size guard (FOLLOWUP-4A, FOLLOWUP-4B)
- [ ] 08.1-03-PLAN.md — Collection-grid hover-revealed quick-actions checkbox + keyboard a11y (FOLLOWUP-3)
**UI hint**: yes

### Phase 9: Deck Accuracy + Vandalblast Pod Experience
**Goal**: Thousand-Year Storm's analytics tell the truth, and Vandalblast feels like a real pod-play companion — not a prototype
**Depends on**: Phase 7 (schema v6 `turn_laps` field must exist before GAME-09 persistence ships)
**Requirements**: DECK-01, DECK-02, DECK-03, DECK-04, DECK-05, GAME-01, GAME-02, GAME-03, GAME-04, GAME-05, GAME-06, GAME-07, GAME-08, GAME-09, GAME-10
**Success Criteria** (what must be TRUE):
  1. User opens any deck and sees Commander rendered as its own type category in the centre panel; mana curve and colour distribution match hand-calculated values for the three reference decks; salt gauge shows non-zero scores for decks with salty cards; gap warnings show an RAG severity badge and suggested count (e.g. "+5") without repeating the category name; back button returns to the deck list
  2. User starts a Vandalblast game and a coin-flip/spinner animation picks the first player; the active player has a visible highlight (border/glow) that advances on NEXT TURN
  3. At any point mid-game the life totals use RAG colouring (green > 20, amber ≤ 20, red ≤ 10); poison, tax, and commander-damage expansion widgets show representative icons; user can add/remove additional counters directly from the expanded player card; fullscreen toggle enters and exits without losing game state; player names don't clip in 2-col; 3-player games use a dynamic layout
  4. When the game ends, post-game stats surface longest turn, average turn, and per-player average computed from `turn_laps: number[]` persisted to the game record; laps remain accurate even if the tab was backgrounded mid-turn (wall-clock anchor, not interval counter)
**Plans**: TBD
**UI hint**: yes

### Phase 10: Supabase Auth Foundation
**Goal**: Users can create a Counterflux account, sign in on any device, and the local-first promise stays intact — without forcing account creation on anyone who doesn't want one
**Depends on**: Phase 7 (schema v6 is required before sync tables get populated; auth lands first so sync has an identity layer)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06
**Success Criteria** (what must be TRUE):
  1. An unauthenticated user cold-boots the app and the Supabase client is not in the bundle (network panel confirms no Supabase chunk until first auth click); app functions identically to v1.0
  2. User can sign in with an email magic link from a fresh browser; the link lands on `/#auth-callback` without Navigo intercepting the hash fragment, and the session persists across page reloads
  3. User can sign in with Google OAuth from a desktop browser and their profile name + avatar populate from the auth identity; the "Sign in" CTA in the settings modal flips to email + Sign out
  4. User signs out and their local Dexie data (collection, decks, games, watchlist) is fully preserved; only the Supabase session is cleared
  5. A second Supabase user context attempting to read or write the first user's rows (collection, decks, deck_cards, games, watchlist, profile) receives empty results — RLS policies enforce `auth.uid() = user_id` on every synced table with `WITH CHECK` on writes
**Plans**: TBD
**UI hint**: yes

### Phase 11: Cloud Sync Engine
**Goal**: Counterflux becomes a multi-device app — changes made on one device show up on another, offline edits replay on reconnect, and v1.0 upgraders never lose data on first sign-in
**Depends on**: Phase 7 (schema v6 `sync_queue`, `sync_conflicts`, `updated_at` backfill), Phase 10 (auth identity for RLS-scoped writes)
**Requirements**: SYNC-01, SYNC-02, SYNC-03, SYNC-04, SYNC-05, SYNC-06, SYNC-07
**Success Criteria** (what must be TRUE):
  1. Supabase Postgres has tables mirroring the synced Dexie tables (collection, decks, deck_cards, games, watchlist, profile) each with `user_id`, `updated_at`, and per-row primary keys; Dexie hooks enqueue create/update/delete ops for these tables into `sync_queue` and exclude `cards`/`meta`/`*_cache`
  2. A v1.0 user with a populated local collection signs in for the first time; the reconciliation modal surfaces all 4 states (local/remote × empty/populated) and the populated-populated case prompts the user to merge, keep local, or keep remote — data is never silently destroyed
  3. User makes a change on Device A (edit a deck), the change appears on Device B within the next sync cycle; field-level LWW via `updated_at` picks the newer write, `deck_cards` rows resolve atomically, and unresolvable conflicts surface in `sync_conflicts` for review
  4. User goes offline, makes 10 edits across collection and decks, reloads the page, then reconnects — the outbox queue survives reload and flushes automatically on reconnect, tagged with `user_id` so sign-in switching never cross-contaminates users
  5. Topbar sync-status indicator shows one of four states at all times: synced, syncing, offline, error — replacing the existing connectivity chip
**Plans**: TBD
**UI hint**: yes

### Phase 12: Notification Bell + Preordain Spoiler Refresh
**Goal**: The notification bell becomes a meaningful unified inbox (sync errors + price alerts), and Preordain's spoiler browser evolves from a functional list into the visual-first reveal experience collectors expect
**Depends on**: Phase 11 (sync engine must emit errors before the bell can surface them as day-one content)
**Requirements**: SYNC-08, MARKET-01, MARKET-02, MARKET-03
**Success Criteria** (what must be TRUE):
  1. Notification bell badge count unifies across sync errors (deduplicated) and existing watchlist price alerts; clicking the bell opens the notification inbox
  2. User opens Preordain, the set-filter dropdown renders each option with its Keyrune set icon alongside the name and card count
  3. User browses the redesigned spoiler view: larger tiles, day/section headers grouped reverse-chronologically, NEW badges on cards revealed in the last 48 hours, hover preview for the full card
  4. User clicks the quick add-to-watchlist button on any spoiler tile and the card is added without opening the context menu (toast confirms)
**Plans**: TBD
**UI hint**: yes

### Phase 13: Performance Optimisation (conditional)
**Goal**: Ship v1.1 meeting the performance targets set in Phase 7 — either by targeted optimisation if the baseline regressed, or by signing off the baseline as-is if already green
**Depends on**: Phase 12 (all feature work complete; conditional on Phase 7 baseline data showing measurable regression vs targets)
**Requirements**: PERF-04
**Success Criteria** (what must be TRUE):
  1. A fresh Lighthouse run against the final v1.1 build meets or beats the TTI/LCP targets agreed in the Phase 7 baseline report
  2. If optimisations were applied (splash → bulk data deferral, store init sequencing, bundle splitting), before/after web-vitals samples are captured in `.planning/` showing the delta
  3. If no regressions were found, the Phase 7 baseline report is signed off with a "v1.1 meets perf budget" record and no code changes ship from this phase
**Plans**: TBD

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. Foundation + Data Layer | v1.0 | 4/4 | Complete | 2026-04-04 |
| 2. Collection Manager | v1.0 | 5/5 | Complete | 2026-04-05 |
| 3. Deck Builder | v1.0 | 6/6 | Complete | 2026-04-06 |
| 4. Intelligence Layer | v1.0 | 4/4 | Complete | 2026-04-06 |
| 5. Market Intel + Game Tracker | v1.0 | 8/8 | Complete | 2026-04-08 |
| 6. Dashboard + Polish | v1.0 | 4/4 | Complete | 2026-04-10 |
| 7. Polish Pass + Perf Baseline + Schema Migration | v1.1 | 0/3 | Not started | — |
| 8. Treasure Cruise Rapid Entry | v1.1 | 3/3 | Complete | 2026-04-16 |
| 8.1. Treasure Cruise Polish & Precon Coverage | v1.1 | 0/3 | Planned | — |
| 9. Deck Accuracy + Vandalblast Pod Experience | v1.1 | 0/? | Not started | — |
| 10. Supabase Auth Foundation | v1.1 | 0/? | Not started | — |
| 11. Cloud Sync Engine | v1.1 | 0/? | Not started | — |
| 12. Notification Bell + Preordain Spoiler Refresh | v1.1 | 0/? | Not started | — |
| 13. Performance Optimisation (conditional) | v1.1 | 0/? | Not started | — |

---
*v1.1 Second Sunrise roadmap drafted 2026-04-14 — 7 phases (7-13) continuing from v1.0*
