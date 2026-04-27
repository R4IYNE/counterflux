# Roadmap: Counterflux — The Aetheric Archive

## Milestones

- [x] **v1.0 The Aetheric Archive** — Phases 1-6 (shipped 2026-04-13) — [archive](milestones/v1.0-ROADMAP.md)
- [x] **v1.1 Second Sunrise** — Phases 7-14 (shipped 2026-04-27) — [archive](milestones/v1.1-ROADMAP.md)
- [ ] **v1.2** — TBD (run `/gsd:new-milestone` to scope)

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

<details>
<summary>✅ v1.1 Second Sunrise (Phases 7-14) — SHIPPED 2026-04-27</summary>

- [x] Phase 7: Polish Pass + Perf Baseline + Schema Migration (3/3 plans) — 11 cross-app polish fixes, web-vitals + Lighthouse baseline, Dexie v6+v7+v8 UUID-PK migration with safe backfill of `updated_at`, `turn_laps`, sync tables
- [x] Phase 8: Treasure Cruise Rapid Entry (3/3 plans) — LHS persistent pop-out add panel, Commander precon browser with add-all, set-icon printing picker, mass-entry close button
- [x] Phase 8.1: Treasure Cruise Polish & Precon Coverage (3/3 plans) — dropdown scroll containment, re-open affordance, hover-checkbox quick actions, 18-code precon allowlist, multi-deck bundle guard
- [x] Phase 9: Deck Accuracy + Vandalblast Pod Experience (6/6 plans) — Deck analytics QA against fixtures, RAG gap badges, Commander-as-own-type, full Vandalblast layout/colour/counter uplift, first-player spinner, persisted per-turn laps with wall-clock anchor
- [x] Phase 10: Supabase Auth Foundation (4/4 plans) — Lazy-loaded Supabase client, email magic-link + Google OAuth, PKCE flow, auth-aware profile, RLS policies on every synced table
- [x] Phase 11: Cloud Sync Engine (6/6 plans) — Postgres schema, Dexie hook outbox, batched upsert, first-sign-in reconciliation, LWW conflict resolution, offline queue, 4-state topbar sync chip, Realtime subscription
- [x] Phase 12: Notification Bell + Preordain Spoiler Refresh (4/4 plans) — Unified notification inbox with sync-error surfacing, Keyrune set-icon dropdown, sectioned spoiler gallery with NEW badges, quick add-to-watchlist
- [x] Phase 13: Performance Optimisation (6/6 plans) — Bulk-data deferral, Alpine effect bridge, splash → bulkdata gating across screens, bfcache eligibility for authed sessions
- [x] Phase 14: v1.1 Audit Gap Closure (12/12 plans) — Closed audit Issues A/C/D + 2 latent v1.1 bugs (Phase 11 schema drift, Phase 13 auth-wall race) + 4 quality items pulled forward (Preordain dropdown sort, sync-errors bulk actions, reconcile one-shot guard, release calendar newest-first) + per-user reconcile keying + MTGJSON-sourced multi-deck precon split (45 bundles, 168 decks)

Full phase details, success criteria, and plan-by-plan breakdown: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

</details>

### v1.2 (planned)

Scope TBD. Run `/gsd:new-milestone` to begin questioning → research → requirements → roadmap. Backlog items below are candidates for promotion.

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1-6 | v1.0 | 31/31 | Shipped | 2026-04-13 |
| 7-14 | v1.1 | 47/47 | Shipped | 2026-04-27 |

## Backlog

### Phase 999.1: MTGJSON Tokens.json — "Required Tokens" tab in Thousand-Year Storm (BACKLOG)

**Goal:** [Captured for future planning] Add a "Required Tokens" tab to the Thousand-Year Storm deck builder that uses MTGJSON's `Tokens.json` to map every card in a deck to the exact tokens, emblems, and helper cards it produces — then renders a checklist of physical tokens the user needs to gather to play the deck. Lightweight dataset, additive feature, no data-layer changes required.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)

### Phase 999.2: MTGJSON AllPrices.json — historical price charts (scoped to user data) (BACKLOG)

**Goal:** [Captured for future planning] Use MTGJSON's `AllPrices.json` for daily/weekly historical price aggregates across TCGPlayer, Cardmarket, and Cardhoarder (foils included). Render sparkline charts in Preordain (Movers & Shakers) and a portfolio-value chart on Treasure Cruise. **CRITICAL SCOPE:** do NOT bulk-load the full multi-GB `AllPrices.json`. Pull only the price series for cards in user collection + watchlist + recently-viewed, and cache aggressively. Replaces the need for an expensive financial API.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)

## Seeds

Forward-looking ideas with trigger conditions — surface automatically during `/gsd:new-milestone` when scope matches.

- [SEED-001](seeds/SEED-001-catalog-userdata-storage-split.md) — Catalog-vs-userdata storage split (wa-sqlite + OPFS for catalog, keep Dexie for user data). Trigger: after Phase 11 Cloud Sync Engine has been live for a meaningful period without regressions. Re-evaluate at v1.2 milestone planning.

---
*v1.1 Second Sunrise shipped 2026-04-27. 47 plans across 8 phases (7-14). Tagged `v1.1` and released on GitHub.*
