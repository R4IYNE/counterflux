# Counterflux: The Aetheric Archive

## What This Is

A premium, desktop-first web application for Magic: The Gathering collectors and Commander players. Counterflux consolidates collection tracking, deckbuilding, market intelligence, spoiler browsing, and game tracking into a single command centre — with a distinctive "Neo-Occult Terminal" visual identity inspired by the Izzet guild. No other MTG tool offers this combination of unified data and aesthetic identity.

## Core Value

The deck builder knows what you own, and the collection knows what's in your decks — one interconnected data layer that eliminates tab-juggling across fragmented tools.

## Current State

**Shipped:** v1.0 (2026-04-13)
**Codebase:** 15,367 LOC across 104 source files, 45 test files, 222 commits
**Stack:** Alpine.js 3.15 + Dexie.js 4 + Chart.js 4 + Vite 8 + Tailwind CSS v4 + SortableJS + Navigo + mana-font

All six modules operational: Dashboard (Epic Experiment), Collection Manager (Treasure Cruise), Deck Builder (Thousand-Year Storm), Intelligence Layer, Market Intel (Preordain), Game Tracker (Vandalblast). Local-first with IndexedDB persistence, Scryfall bulk data pipeline, keyboard shortcuts, undo system, and connectivity status.

## Current Milestone: v1.1 Second Sunrise

**Goal:** Refine every rough edge users hit in v1.0, elevate Preordain's spoiler experience and Vandalblast's pod-play polish, and move Counterflux from single-device local-first to multi-device synced.

**Target features:**
- Polish Pass — 11 cross-app quick-win items (quotes UI, favicon, red accents, toast opacity, card corners, rename "ritual" → "storm", sidebar collapse, top-losers bug, add-to-wishlist toast wording)
- Performance baseline & optimisation — measure first, then optimise boot time
- Treasure Cruise rapid entry — LHS pop-out add panel, precon quick-add, set-icon printing picker, mass-entry close button
- Thousand-Year Storm accuracy — QA analytics, RAG warning redesign, salt score debug, Commander as own type
- Preordain spoiler refresh — visual spoiler browser overhaul, set icons in dropdown, quick add-to-watchlist
- Vandalblast pod experience — layout fixes, RAG life colours, counter icons, fullscreen fix, in-card counter edits, coin-flip + visual turn indicator + persisted per-turn laps
- Supabase auth — email magic-link + Google OAuth, auth-driven profile
- Cloud sync — multi-device sync for collection/decks/games/watchlist, conflict resolution, offline queue, notification bell wire-up

**Key context:**
- Auth + cloud sync is the largest scope addition (previously Out of Scope); makes this a multi-device milestone
- Scope decisions: spoiler-focused only (no news feeds), paper printings only, Scryfall precon products, turn laps persist to game history (schema migration)
- 8 phases planned, continuing from phase 7 (v1.0 ended at phase 6)

## Requirements

### Validated

- ✓ Scryfall API integration with bulk data caching and rate-limit compliance — v1.0
- ✓ IndexedDB local-first persistence for all user data (collection, decks, games) — v1.0
- ✓ Global navigation shell with Izzet-themed sidebar and top app bar — v1.0
- ✓ Dashboard (Epic Experiment) — portfolio summary, quick add, price alerts, Mila's insights, deck quick-launch — v1.0
- ✓ Collection Manager (Treasure Cruise) — gallery/table/set-completion views, mass entry terminal, CSV import/export, inventory categories, analytics — v1.0
- ✓ Deck Builder (Thousand-Year Storm) — three-panel editor with search, the 99 (grid/list), live analytics sidebar, collection-aware owned/missing, import/export — v1.0
- ✓ EDHREC synergy recommendations and Commander Spellbook combo detection in Deck Builder — v1.0
- ✓ Market Intel (Preordain) — spoiler browser, price watchlist with alerts, market trends, release calendar — v1.0
- ✓ Game Tracker (Vandalblast) — life totals, commander damage, poison/counters, dice, turn tracking, post-game summary, game history and stats — v1.0
- ✓ Full visual identity — colour palette, typography (Syne / Space Grotesk / JetBrains Mono), ghost borders, active glow, aether gradient — v1.0
- ✓ Mila (System Familiar) — sidebar presence, insights, empty states — v1.0
- ✓ Keyboard-first interaction patterns, right-click context menus, undo support — v1.0
- ✓ Offline capability for collection, decks, and game tracking — v1.0

### Active

See `.planning/REQUIREMENTS.md` for the full v1.1 requirement catalogue (POLISH, PERF, COLLECT, DECK, MARKET, GAME, AUTH, SYNC categories).

### Out of Scope

- Firemind (Personal Analytics) — deferred to future milestone
- Trade binder matching with other users — future consideration
- Mobile companion app — Vandalblast responsive layout covers game-day use
- Real-time pricing / marketplace integration — Scryfall daily prices sufficient
- MTG news / RSS feed integration — scoped out of item 20; spoiler-focused overhaul only
- All-printings view including MTGO/Arena-only — v1.1 scopes to `games: paper` only
- Mila loading animation (MILA-03) — accepted as minor tech debt from v1.0

## Context

**Target users:** Spike/Johnny Commander players who own 500+ cards, maintain multiple Commander decks, and play weekly. Four personas: The Archivist (collection-focused), The Brewer (deckbuilding-focused), The Speculator (price-tracking), The Pod Leader (game-tracking).

**Data architecture:** Scryfall is the canonical card data source (free, comprehensive, community-standard). User data is local-first via IndexedDB (Dexie.js v4, schema v5). Secondary sources: Commander Spellbook API (combos), EDHREC (synergy/recommendations), Scryfall prices (daily). Bulk data stream-parsed in Web Worker to avoid blocking main thread.

**Visual identity:** "Neo-Occult Terminal" — dark, immersive, information-dense. Izzet guild colour palette (blue #0D52BD + red #E23838 on deep void #0B0C10). All screen names reference real MTG card names. Mila the Corgi is the System Familiar mascot. Profile system with settings modal added post-plan.

**Competitive landscape:** Replaces the need to juggle Moxfield (deckbuilding) + Deckbox (collection) + EDHREC (recommendations) + TCGPlayer (pricing) + MythicSpoiler (spoilers) + Commander Spellbook (combos) + Lifetap (game tracking).

## Constraints

- **Scryfall API compliance**: User-Agent header required, 50-100ms delay between requests, must not paywall Scryfall data, must not crop artist credits, must not repackage without adding value
- **Local-first**: Must work without account creation or internet (after initial data fetch). IndexedDB for persistence, bulk data cache for offline card lookup
- **Desktop-first**: Optimised for desktop viewports. Only Vandalblast (Game Tracker) requires mobile-responsive layout
- **Performance**: Initial load < 3s, autocomplete < 200ms, collection scroll virtualised at 1,000+ cards, deck analytics recalc < 100ms
- **Stack**: Alpine.js 3.15 + Dexie.js 4 + Chart.js 4 + Vite 8 + Tailwind CSS v4 + SortableJS + Navigo + mana-font (~99KB JS gzipped)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Scryfall as canonical data source | Free, comprehensive, community-standard, well-documented API | ✓ Good — powers all card data, pricing, images |
| Local-first with IndexedDB | No account required, offline-capable, fast | ✓ Good — Dexie v4 schema versioning works well |
| Izzet "Neo-Occult Terminal" visual identity | Distinctive aesthetic creates emotional attachment | ✓ Good — unique in MTG tool space |
| Alpine.js + Dexie.js lightweight stack | Keeps build simple, avoids framework overhead | ✓ Good — 99KB gzipped, fast iteration |
| Phased delivery (6 phases) | Foundation → Collection → Deck → Intelligence → Market/Game → Dashboard | ✓ Good — each phase delivered standalone value |
| Mila as System Familiar | Warm personality in data-dense app | ✓ Good — memorable touchpoint |
| Web Worker bulk data parsing | 300MB Scryfall JSON crashes main thread with JSON.parse | ✓ Good — stream parsing works reliably |
| Vite 8 with Rolldown | Modern bundler with manualChunks function form | ✓ Good — fast HMR, clean builds |
| fontsource npm packages | Self-hosted .woff2 fonts for offline support | ✓ Good — no external font CDN dependency |
| EDHREC via Vite dev proxy | CloudFront blocks CORS preflight on EDHREC | ⚠️ Revisit — needs production proxy solution |
| GBP currency throughout | User preference for pound sterling pricing | ✓ Good — EUR→GBP conversion via live rate |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-15 — Phase 07 (polish pass + perf baseline + schema v5→v8 migration) complete; 5 perf gaps flagged for Phase 13, schema pre-ready for Phases 9 and 11*
