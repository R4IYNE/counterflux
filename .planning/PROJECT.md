# Counterflux: The Aetheric Archive

## What This Is

A premium, desktop-first web application for Magic: The Gathering collectors and Commander players. Counterflux consolidates collection tracking, deckbuilding, market intelligence, spoiler browsing, and game tracking into a single command centre — with cloud sync across devices and a distinctive "Neo-Occult Terminal" visual identity inspired by the Izzet guild. Local-first by default, multi-device when signed in. No other MTG tool offers this combination.

## Core Value

The deck builder knows what you own, and the collection knows what's in your decks — one interconnected data layer that eliminates tab-juggling across fragmented tools, and now follows you across every device you sign in on.

## Current State

**Shipped:** v1.0 (2026-04-13) → v1.1 Second Sunrise (2026-04-27) → v1.2 Deploy the Gatewatch (2026-04-28)
**Codebase:** ~24,470 LOC across 132 source/api files, 134 test files, 568 commits
**Stack:** Alpine.js 3.15 + Dexie.js 4 + Chart.js 4 + Vite 8 + Tailwind CSS v4 + SortableJS + Navigo + mana-font + **Supabase JS 2.103+** (lazy-loaded for sync/auth) + **2 Vercel Functions** (`api/edhrec/[...path].js` + `api/spellbook/[...path].js`, server-side-only, never enter client bundle)

All six modules operational and synced: Dashboard (Epic Experiment), Collection Manager (Treasure Cruise), Deck Builder (Thousand-Year Storm), Intelligence Layer, Market Intel (Preordain), Game Tracker (Vandalblast). Local-first IndexedDB persistence (Dexie schema v10) backed by Supabase Postgres + Realtime sync when signed in. Anonymous-first remains intact: the Supabase client is not in the bundle until first auth click. EDHREC + Spellbook integrations now work in production via catch-all Vercel Functions (previously silently broken since v1.0 because the Vite dev proxy didn't ship to production).

**Auth:** email + password sign-in + Google OAuth via Supabase (PKCE flow). RLS-enforced on every synced table via household whitelist (`counterflux.shared_users`).
**Sync:** Dexie hook outbox → batched upsert, Realtime subscription for incoming changes, last-write-wins conflict resolution (`updated_at` field-level), 4-state topbar chip (synced/syncing/offline/error), reconciliation modal for first sign-in.
**Production performance (measured 2026-04-28):** Lighthouse against `https://counterflux.vercel.app/` returns Perf 99 / FCP 0.6s / **LCP 0.7s** / CLS 0.048 / TBT 0ms. All Web Vitals Good with substantial headroom (production LCP 0.7s vs v1.1 lab measurement of 2.49s — Vercel edge CDN crushes the localhost number).
**Deployment:** Vercel project `counterflux` (Hobby tier, personal account), auto-deploy on master push to `https://counterflux.vercel.app/`. `vercel.json` emits `Cache-Control: no-cache` on `/` and `/index.html`.

## Next Milestone: v1.3 (TBD)

Run `/gsd:new-milestone` to scope. Three seeds with explicit re-trigger conditions surface automatically during scoping:

- **SEED-001** — Catalog/userdata storage split (wa-sqlite + OPFS for catalog, keep Dexie for user data). Trigger: Phase 11 sync engine has now been live for 10+ days without regressions; eligible for re-evaluation
- **SEED-002** — Revisit Nyquist VALIDATION.md gate (currently disabled). Decide: re-enable for v1.3+, leave disabled permanently, or backfill phases 7–14
- **SEED-003** — Wire `@lhci/cli` soft-gate to a real Vercel Preview URL (UAT-01 deferred from v1.2 Phase 16). Trigger when CDN edge perf becomes a real concern OR when introducing dynamic SSR / per-request server logic

Plus two backlog candidates waiting for production-traffic-driven user demand:
- **999.1** — MTGJSON Tokens.json "Required Tokens" tab in Thousand-Year Storm (lightweight, additive)
- **999.2** — MTGJSON AllPrices.json historical price charts (scoped to user data: collection + watchlist + recently-viewed)
- Backlog parked: 999.1 (MTGJSON Tokens — Required Tokens tab), 999.2 (MTGJSON AllPrices — historical price charts), SEED-001 (catalog/userdata storage split), SEED-002 (Nyquist gate revisit). Re-evaluate at v1.3 with production-traffic data in hand.

## Requirements

### Validated

**v1.0 — The Aetheric Archive (shipped 2026-04-13)**
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

**v1.1 — Second Sunrise (shipped 2026-04-27)**
- ✓ Polish Pass (POLISH-01..11) — splash quotes, favicon, rounded card corners, opaque toast icons, sidebar collapse toggle, "Brew a new storm" rename, red-accent coverage, top-losers name resolution, additional-counters `+` icon, add-to-wishlist toast wording — v1.1 Phase 7
- ✓ Performance baseline (PERF-01..03) — `web-vitals` 5.2 instrumentation, `@lhci/cli` Lighthouse runner, committed `PERF-BASELINE.md` with explicit TTI/LCP targets — v1.1 Phase 7
- ✓ Schema migration (SCHEMA-01..03) — Dexie v5→v6+v7+v8 chain, UUID-PK migration on every synced table via temp-table shuffle (Pitfall §1 worked around), `sync_queue` outbox + `sync_conflicts` + `profile` tables, localStorage backup with 7-day TTL sweep, `meta.schema_version` row, blocking modal for cross-tab upgrade conflicts — v1.1 Phase 7
- ✓ Treasure Cruise rapid entry (COLLECT-01..06) — LHS persistent add panel, paper-printings picker, Commander precon browser, mass-entry X close, dropdown thumbnails, mana-cost audit — v1.1 Phase 8
- ✓ Treasure Cruise polish + precon coverage — dropdown scroll containment, prominent re-open affordance, hover-checkbox quick actions on card tiles, 18-code precon allowlist, multi-deck bundle warning + ADD ALL guard — v1.1 Phase 8.1
- ✓ Deck accuracy + Vandalblast pod experience (DECK-01..05 + GAME-01..10) — fixture-locked mana curve + colour distribution, per-category RAG gap thresholds, Commander as own type category, EDHREC bulk salt endpoint, slot-machine first-player spinner, T-shape 3-player layout, RAG life/poison/commander-damage colouring, Material Symbols icons, real Fullscreen API, auto-starting wall-clock turn timer (immune to background-tab throttling), persisted `turn_laps` + TURN PACING post-game stats — v1.1 Phase 9
- ✓ Supabase auth foundation (AUTH-01..06) — `@supabase/supabase-js` 2.103+ lazy-loaded (anonymous boot has zero Supabase chunk in bundle), email magic-link with PKCE flow + 30s resend cooldown, Google OAuth, auth-aware profile store with effectiveAvatarUrl priority chain, RLS policies enforced via `auth.uid() = user_id` on every synced table with `WITH CHECK` on writes, sign-out preserves local Dexie data — v1.1 Phase 10
- ✓ Cloud sync engine (SYNC-01..07) — Postgres schema mirroring synced Dexie tables, Dexie `creating/updating/deleting` hook outbox with reference-count suppression (Pitfall §11-B), batched Supabase upsert with error classification, first-sign-in reconciliation orchestrator (4-state dispatch + Pitfall §11-E resume branch), last-write-wins LWW resolver at field level via `updated_at` (deck_cards atomic merge special case), Realtime subscription with `withHooksSuppressed` re-enqueue prevention, offline queue surviving reload + reconnect tagged by `user_id`, 4-state topbar sync-status chip — v1.1 Phase 11
- ✓ Notification bell + Preordain spoiler refresh (SYNC-08, MARKET-01..03) — unified notification inbox combining sync errors (deduped) with watchlist price alerts, custom Keyrune set-icon dropdown, sectioned spoiler grid with day/section headers, NEW badges (last 48 hours), hover preview, quick add-to-watchlist button — v1.1 Phase 12
- ✓ Performance optimisation (PERF-04) — v1.1 meets Web Vitals budget. LCP 6.1s → 2.49s (−59%) via bfcache handlers, shimmer composability fix, splash-to-migration-only + topbar bulk-data pill + honest empty-state gating, Vite `manualChunks` CSS/JS split, `font-display: swap` + Syne preload, Pitfall 15 cache-bust recovery (`vite:preloadError` + `Cache-Control: no-cache`), bundle-budget enforcement, and the actual LCP win — static paint-critical `<h1>` in initial HTML with auth-wall decorating pre-existing DOM. CI soft-gate via `@lhci/cli` warns-not-blocks. Final Lighthouse: LCP 2.49s / FCP 0.4s / CLS 0.059 / Perf 86 — all Web Vitals `Good` — v1.1 Phase 13
- ✓ v1.1 audit gap closure — closed audit Issues A/C/D + 2 latent v1.1 bugs (Phase 11 schema drift on `counterflux.*` columns, Phase 13 auth-wall stale-static race), per-user reconcile keying, MTGJSON-sourced multi-deck precon split (45 bundles, 168 decks, exactly 100 cards each, lazy-loaded), 4 quality items pulled forward (Preordain dropdown sort, sync-errors bulk RETRY/DISCARD, reconcile one-shot guard, release calendar newest-first) — v1.1 Phase 14
- ✓ EDHREC + Spellbook CORS proxies (PROXY-01..05) — two catch-all Vercel Functions (`api/edhrec/[...path].js` + `api/spellbook/[...path].js`) proxying upstream API requests with verbatim `User-Agent: Counterflux/1.x (+https://counterflux.vercel.app)`, transparent passthrough, 502 mapping with `{ error: "upstream unavailable", source: "edhrec"|"spellbook" }`. Zero client-side path changes via catch-all alignment. Symmetry-breaker test prevents EDHREC/Spellbook source-leak. Main bundle stays 36.0 KB gz (well under 300 KB budget) — Vercel Functions never enter client bundle. 20 new unit tests pass; 92/92 focused regression tests pass — v1.2 Phase 15
- ✓ Live-environment UAT closure (UAT-02, UAT-03) — Phase 16 collapsed inline 2026-04-28 on honest-ROI grounds. UAT-02: production Lighthouse against `https://counterflux.vercel.app/` returns Perf 99 / FCP 0.6s / LCP 0.7s / CLS 0.048 / TBT 0ms (production LCP 0.7s vs v1.1 lab 2.49s thanks to Vercel edge CDN), captured in `.planning/PERF-PROD-2026-04-28.md`. UAT-03: 13-HUMAN-UAT.md flipped `partial` → `resolved` (Cache-Control verified via curl, soft-gate-on-real-PR deferred); 11-HUMAN-UAT.md flipped `partial` → `live-use-validated` (10 days of household production use, no sync regressions). Pre-existing 8-test path-resolution failure in `tests/perf/remeasure-contract.test.js` (v1.1 milestone archive shuffle aftermath) fixed inline as a one-line constant update. UAT-01 deferred to v1.3 via SEED-003 — v1.2 Phase 16 (collapsed)

### Active

(Empty — v1.2 shipped + archived 2026-04-28. Run `/gsd:new-milestone` to scope v1.3. Three seeds + two backlog items surface automatically — see "Next Milestone" above.)

### Out of Scope

- Firemind (Personal Analytics) — deferred to future milestone
- Trade binder matching with other users — future consideration
- Mobile companion app — Vandalblast responsive layout covers game-day use; primary product is desktop-first
- Real-time pricing / marketplace integration — Scryfall daily prices remain sufficient
- MTG news / RSS feed integration — spoiler-focused overhaul (v1.1) covers reveal cadence
- All-printings view including MTGO/Arena-only — v1.1 scoped to `games: paper`; review only if user demand emerges
- Mila loading animation (MILA-03) — accepted as minor tech debt from v1.0
- Public sign-up UI surface — explicit product decision (v1.2): household model only, existing-account credentials, no public sign-up route. Auth-wall UX stays as-is. Re-open if a future milestone adopts a community/multi-user pivot.
- Nyquist `VALIDATION.md` backfill across phases 7–14 — disabled for v1.2 (`workflow.nyquist_validation = false`). Tests exist (134 test files at v1.2 ship), only the per-phase receipt artifact is missing. SEED-002 surfaces during v1.3 scoping
- Catalog migration from Dexie to wa-sqlite + OPFS — captured as SEED-001. Trigger eligible at v1.3 scoping (Phase 11 sync engine has now been live 10+ days without regressions, condition met)
- LHCi soft-gate against real Vercel Preview URL — captured as SEED-003 (UAT-01 deferred from v1.2 Phase 16). Trigger: when CDN edge perf becomes a real concern OR when Counterflux gains SSR / per-request server logic

## Context

**Target users:** Spike/Johnny Commander players who own 500+ cards, maintain multiple Commander decks, and play weekly. Four personas: The Archivist (collection-focused), The Brewer (deckbuilding-focused), The Speculator (price-tracking), The Pod Leader (game-tracking). v1.1 adds the multi-device user (a player who switches between desktop, laptop, and pod-night iPad).

**Data architecture:** Scryfall is the canonical card data source (free, comprehensive, community-standard). User data is local-first via IndexedDB (Dexie.js v4, schema v10 post-v1.1) backed by Supabase Postgres when signed in. Bulk catalog still stream-parsed in Web Worker. Secondary sources: Commander Spellbook API (combos), EDHREC (synergy/recommendations + bulk Top-100 salt endpoint), Scryfall prices (daily). MTGJSON consumed for precon deck memberships (Phase 14) — first MTGJSON dependency, paving the way for SEED-001 + backlog 999.1/999.2.

**Visual identity:** "Neo-Occult Terminal" — dark, immersive, information-dense. Izzet guild colour palette (blue #0D52BD + red #E23838 on deep void #0B0C10). All screen names reference real MTG card names. Mila the Corgi is the System Familiar mascot.

**Multi-device story:** Sign in once, sync everywhere. The 4-state topbar chip (synced/syncing/offline/error) is the user's source of truth for whether changes are reaching the cloud. Reconciliation modal on first sign-in surfaces all 4 local/remote × empty/populated states without ever silently destroying data.

**Competitive landscape:** Replaces the need to juggle Moxfield (deckbuilding) + Deckbox (collection) + EDHREC (recommendations) + TCGPlayer (pricing) + MythicSpoiler (spoilers) + Commander Spellbook (combos) + Lifetap (game tracking). v1.1 closes the cross-device gap that previously sent users back to web-hosted alternatives.

## Constraints

- **Scryfall API compliance**: User-Agent header required, 50-100ms delay between requests, must not paywall Scryfall data, must not crop artist credits, must not repackage without adding value
- **Local-first**: Must work without account creation or internet (after initial data fetch). IndexedDB for persistence, bulk data cache for offline card lookup. Sign-in is opt-in — anonymous users get the v1.0 experience untouched
- **Sync correctness over speed**: LWW conflict resolution at field level. `deck_cards` resolves atomically (whole card, not per-quantity). Reconciliation lockdown modal blocks app interaction until user makes a destructive choice (merge / keep local / keep remote). Reference-count suppression prevents Realtime echo loops
- **RLS isolation**: every synced table enforces `auth.uid() = user_id` on read AND write. RLS isolation test (D-37) is a hard gate
- **Desktop-first**: Optimised for desktop viewports. Only Vandalblast (Game Tracker) requires mobile-responsive layout
- **Performance**: Initial load < 3s ✓ (FCP 0.4s, LCP 2.49s), autocomplete < 200ms, collection scroll virtualised at 1,000+ cards, deck analytics recalc < 100ms
- **Stack**: Alpine.js 3.15 + Dexie.js 4 + Chart.js 4 + Vite 8 + Tailwind CSS v4 + SortableJS + Navigo + mana-font + Supabase JS 2.103+ (lazy)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Scryfall as canonical data source | Free, comprehensive, community-standard, well-documented API | ✓ Good — powers all card data, pricing, images |
| Local-first with IndexedDB | No account required, offline-capable, fast | ✓ Good — Dexie v4 schema versioning works well |
| Izzet "Neo-Occult Terminal" visual identity | Distinctive aesthetic creates emotional attachment | ✓ Good — unique in MTG tool space |
| Alpine.js + Dexie.js lightweight stack | Keeps build simple, avoids framework overhead | ✓ Good — ~99KB JS gzipped, fast iteration |
| Phased delivery | Foundation → modules → polish/perf/sync | ✓ Good — 14 phases shipped across two milestones, each delivered standalone value |
| Mila as System Familiar | Warm personality in data-dense app | ✓ Good — memorable touchpoint |
| Web Worker bulk data parsing | 300MB Scryfall JSON crashes main thread with JSON.parse | ✓ Good — stream parsing works reliably |
| Vite 8 with Rolldown | Modern bundler with manualChunks function form | ✓ Good — fast HMR, clean builds |
| fontsource npm packages | Self-hosted .woff2 fonts for offline support | ✓ Good — no external font CDN dependency |
| EDHREC via Vite dev proxy | CloudFront blocks CORS preflight on EDHREC | ⚠️ Revisit — needs production proxy solution |
| GBP currency throughout | User preference for pound sterling pricing | ✓ Good — EUR→GBP conversion via live rate |
| Supabase as cloud backend (huxley project shared with Atlas/Huxley + MWTA) | Already in use across personal projects, free tier sufficient, RLS handles per-user isolation cleanly | ✓ Good — auth + sync + Realtime in a single dependency, lazy-loaded so anonymous users pay nothing |
| Lazy Supabase client (no-bundle when anonymous) | Anonymous-first product principle: v1.0 users must not pay a tax for the v1.1 sync feature | ✓ Good — Plan 10-02 bundle-inspection test (`tests/auth-bundle.test.js`) gates regressions |
| PKCE flow for magic-link + OAuth | More secure than implicit flow, required by Supabase v2 | ✓ Good — `/auth-callback` route works cleanly without Navigo intercept |
| UUID-PK migration via temp-table shuffle (v6+v7+v8 chain) | Dexie 4.x cannot change PK type in-place (Pitfall §1) | ✓ Good — three-step rename pattern proven by spike test, ships in single user-facing upgrade event |
| Soft-delete (`deleted_at`) for sync tombstones | Required for cross-device delete propagation; hard delete loses tombstone | ✓ Good — Dexie v10 schema, tombstone cleanup runs on Postgres side |
| Field-level LWW via `updated_at` (tie-goes-cloud) | Simple, deterministic, scales to any number of devices without coordination | ✓ Good — `deck_cards` atomic-merge special case handles multi-row deck edits |
| Reference-count suppression in Dexie hooks | Plan 11-04 needed to prevent Realtime → outbox echo loop, with awareness that Dexie `.update()` is async read-modify-write (Pitfall §11-B) | ✓ Good — `withHooksSuppressed` API used by Realtime subscription |
| Reconciliation lockdown modal (no Escape, no backdrop close, no X) | Data integrity > UX nicety. User MUST make a destructive choice | ✓ Good — D-12 forced choice prevents silent data loss on first sign-in with both local + remote populated |
| Per-user reconcile-already-ran flag (Phase 14-07c) | Single global flag cross-contaminated when multiple users signed in on the same browser | ✓ Good — flag now keyed by user_id |
| 4-state topbar chip replacing v1.0 connectivity LIVE/OFFLINE/STALE | Old chip reflected network state; new chip reflects sync state, which is the actually-load-bearing thing | ✓ Good — connectivity.js fully deleted in Plan 11-02 |
| MTGJSON for precon deck memberships (Phase 14-07j) | Scryfall doesn't expose multi-deck product splits; heuristic was missing decks | ✓ Good — 168 decks split cleanly from 45 bundles, exactly 100 cards each, weekly GitHub Action keeps it fresh |
| Wall-clock anchor for turn timer (`Date.now()` + delta, not setInterval count) | Chrome throttles setInterval to ~1s when tab backgrounded; a 30-min backgrounded turn would otherwise record as ~5 min | ✓ Good — `vi.spyOn(Date, 'now')` jump test proves immunity |
| Static paint-critical `<h1>` in initial HTML (Plan 13-05) | Auth wall creating DOM at runtime delayed LCP to 6.1s; pre-existing DOM gets to ~2.49s | ✓ Good — auth-wall now decorates rather than creates; Phase 14-06 patched the closeAuthWall stale-static race that surfaced |
| `Cache-Control: no-cache` + `vite:preloadError` recovery (Pitfall 15) | Stale chunk references after deploy cause hard failures; need cache-bust + reload recovery | ✓ Good — shipped in Plan 13-05 |
| GitHub Action for weekly precon membership sync (`scheduled-precon-sync.yml`, Node 24 runner) | Scryfall + MTGJSON both update; manual sync drifts | ✓ Good — `chore(precons): weekly MTGJSON deck-membership sync` runs on cron, opens PR (single tag-only release model retained) |
| Household model permanent — no public sign-up UI (v1.2 decision, 2026-04-28) | App is a personal-collaborator tool for two known users (James + Sharon) on the shared huxley Supabase project. Phase 10 D-38 already implemented household-RLS via the `counterflux.shared_users` whitelist post-ship. Adding a public sign-up surface would invite outsider account creation that household RLS is designed to block. Existing-account credentials remain the entry path | ✓ Good — codifies what the auth-wall already enforces; Out-of-Scope rewritten from "deferred to v1.2 scoping" to permanent decision |
| Nyquist VALIDATION.md gate disabled (v1.2 decision, 2026-04-28) | v1.1's 8 phases shipped without per-phase VALIDATION.md receipts; the tests exist (119 files, ~18K LOC) but the receipt artifact does not. Backfilling 8 archived phases is process debt that returns no functional value. Disabling unblocks v1.2 phases without weakening real coverage. SEED-002 planted to revisit at v1.3 | ✓ Good — `workflow.nyquist_validation: false` in `.planning/config.json`. Re-evaluate at v1.3 milestone scoping or earlier if a regression VALIDATION.md would have caught surfaces |
| Phase 16 collapse over engineering theater (v1.2 decision, 2026-04-28) | Same honest-ROI conversation pattern as the original Phase 15 reset. UAT-02 + UAT-03 were faster as inline closures than as a phase plan with subagent overhead; UAT-01 (LHCi-on-Preview) had marginal ROI for an app with no SSR / no edge functions / no per-request API divergence. SEED-003 planted with explicit re-trigger conditions if CDN edge perf becomes load-bearing | ✓ Good — second consecutive v1.2 phase collapsed inline. Established pattern: when a phase's "real engineering" component is < 30 min and the rest is documentation closure, bypass the phase mechanism entirely. Phase scaffolding belongs to phases that justify the overhead |

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
*Last updated: 2026-04-28 — **v1.2 Deploy the Gatewatch SHIPPED + ARCHIVED.** Three milestones in two months: v1.0 (2026-04-13), v1.1 (2026-04-27), v1.2 (2026-04-28). v1.2 demonstrated the "honest-ROI scope reset" pattern — collapsed two phases when discovery revealed they were theater. EDHREC + Spellbook proxies + production Lighthouse + HUMAN-UAT cascade closure shipped in 24 hours. Run `/gsd:new-milestone` to scope v1.3. Three seeds (SEED-001/002/003) + two backlog items (999.1/999.2) surface automatically during scoping.*
