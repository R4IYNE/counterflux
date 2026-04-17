---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Second Sunrise
status: executing
stopped_at: Completed 09-02-PLAN.md (GAME-01..06 Vandalblast layout + visuals + router-test fix)
last_updated: "2026-04-17T09:32:21.545Z"
last_activity: 2026-04-17
progress:
  total_phases: 8
  completed_phases: 3
  total_plans: 12
  completed_plans: 11
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-14)

**Core value:** The deck builder knows what you own, and the collection knows what's in your decks — one interconnected data layer
**Current focus:** Phase 09 — deck-accuracy-vandalblast-pod-experience

## Current Position

Phase: 09 (deck-accuracy-vandalblast-pod-experience) — EXECUTING
Plan: 3 of 3
Status: Ready to execute
Last activity: 2026-04-17

Progress: [          ] 0%

## Milestone Progress

| Milestone | Phases | Status |
|-----------|--------|--------|
| v1.0 The Aetheric Archive | 6/6 | ✅ Shipped 2026-04-13 |
| v1.1 Second Sunrise | 0/7 | Active — Phase 7 next |

## Performance Metrics

**Velocity (v1.0 — for reference):**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 8min | 2 | 26 |
| Phase 01 P03 | 6min | 2 | 17 |
| Phase 01 P04 | 8min | 1 | 5 |
| Phase 02 P03 | 7min | 2 | 12 |
| Phase 02 P04 | 7min | 2 | 8 |
| Phase 03 P01 | 9min | 2 | 14 |
| Phase 03 P02 | 5min | 2 | 8 |
| Phase 03 P03 | 7min | 2 | 7 |
| Phase 03 P04 | 4min | 2 | 2 |
| Phase 03 P05 | 5min | 2 | 7 |
| Phase 04 P02 | 3min | 2 | 5 |
| Phase 04 P03 | 4min | 2 | 4 |
| Phase 04 P04 | 12min | 3 | 16 |
| Phase 06 P04 | 5min | 2 | 7 |
| Phase 07 P01 | 12min | 8 tasks | 16 files |
| Phase 07 P02 | 3min | 5 tasks | 4 files |
| Phase 08 P01 | 4min | 4 tasks | 5 files |
| Phase 08 P02 | 15min | 6 tasks tasks | 10 files files |
| Phase 08 P03 | 14m 21s | 6 tasks tasks | 7 files files |
| Phase 08.1 P01 | 2m 55s | 2 tasks | 4 files |
| Phase 08.1 P03 | 14m | 2 tasks | 5 files |
| Phase 08.1 P02 | 6m 29s | 2 tasks | 6 files |
| Phase 09 P01 | 25min | 5 tasks tasks | 20 files files |
| Phase 09 P02 | 8m 22s | 4 tasks (8 commits w/ TDD pairs) tasks | 8 files files |

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table.

**v1.1 scope decisions (2026-04-14):**

- Auth + cloud sync in scope (previously Out of Scope) — unblocks multi-device use
- Preordain item 20 scoped to spoiler-focused overhaul only (no news/RSS feeds)
- Item 8 printings limited to paper (`games: paper`) — excludes MTGO/Arena-only printings
- Item 6 precons sourced from Scryfall precon products (`set_type: commander`, etc.)
- Turn laps (item 29) persist to game history — requires schema migration for games table
- Performance target (item 1) deferred — measure first, set baseline, pick target (PERF-04 gated on Phase 7 findings)

**v1.1 roadmap decisions (2026-04-14):**

- Phase numbering continues from v1.0 (Phase 7-13); no reset
- Schema v5→v6 migration front-loaded into Phase 7 so `turn_laps` (GAME-09) and sync (SYNC-*) share a single migration event
- Auth (Phase 10) hard-precedes sync (Phase 11); sync engine has no `user_id` identity without it
- SYNC-08 (notification bell) lives in Phase 12 alongside Preordain spoiler refresh — bell needs sync errors to surface as day-one content
- Phase 13 (PERF-04) is conditional on Phase 7 baseline measurement; documentation-only pass if targets already met
- [Phase 07]: Filter nameless movers rows (strategy A) with per-column empty state — cleaner UX than scryfall_id fallback
- [Phase 07]: Sidebar collapse resize handler respects persisted user preference (D-28)
- [Phase 07]: cf-card-img shared utility class applied to all card-image render sites (POLISH-04)
- [Phase 07]: web-vitals v5 requires fresh opts literal per onX call — initUnique uses opts identity as WeakMap key, shared reference collides Manager instances (crashed INP/CLS with 'd.T is not a function' on interaction)
- [Phase 07]: PERF-BASELINE.md captured honest median-of-3 numbers (FCP 1.0s, LCP 3.7s, CLS 1.00, Perf 54) — 5 gaps flagged for Phase 13: CLS critical, LCP exceeds 2.5s, bulk-data blocks UI ~5min, bfcache disabled, 1 non-composited animation
- [Phase 08]: [Phase 08]: Plan 1 warm-up batch — dropdown uses var(--color-*) tokens (not hex) to align with Plan 2's token-first panel conversion
- [Phase 08]: [Phase 08]: x-text binding switched card._name → card.name in search-results row (legacy alias; canonical property per UI-SPEC Anatomy 4)
- [Phase 08]: [Phase 08]: Plan 2 spike outcome A — bulk-data-pipeline.js stores raw Scryfall card objects with no field projection; loadPrintings uses card.prints_search_uri fast path
- [Phase 08]: [Phase 08]: Scryfall rate-limited queue shipped (src/services/scryfall-queue.js) — 100ms spacing + Counterflux/1.1 User-Agent; closes Pitfall 1 (primitive previously referenced but absent)
- [Phase 08]: [Phase 08]: Printing selection uses cf:printing-selected CustomEvent pattern — store mutates activePrintingIdByCard + dispatches event; panel x-data listens and patches its selectedCard view (decouples store from panel instance)
- [Phase 08]: [Phase 08]: tests/setup.js globally stubs MutationObserver + CustomEvent so node-only vitest tests can import alpinejs-dependent modules without jsdom overhead
- [Phase 08]: [Phase 08]: vi.mock('alpinejs') over vi.spyOn — Alpine module init runs at import; only vi.mock's hoisted replacement intercepts the store call in time
- [Phase 08]: Plan 3 shipped Dexie v9 additive bump + precons_cache table — no .upgrade callback; worker mirror per PITFALLS §1; Phase 7 v5→v8 chain intact
- [Phase 08]: addAllFromPrecon uses Dexie transaction + single loadEntries + single collection_add_batch undo entry with structured {added[], updated[{id,prevQuantity}]} payload (Pitfall 2 + 7)
- [Phase 08]: precons_cache PK is Scryfall set code (string) — deliberately EXCLUDED from UUID_TABLES creating-hook; callers MUST supply code
- [Phase 08]: .ss.ss-fallback CSS rule ships defence-in-depth — spike confirmed 100% duel-deck coverage in keyrune 3.18.0 but keyrune release cadence is independent of Scryfall
- [Phase 08.1]: Plan 1: re-open affordance migrated to class-only consumer (.cf-panel-reopen utility) — 48px primary-accent surface + OPEN PANEL mono label replaces the original 32px ghost chevron that failed UAT visibility
- [Phase 08.1]: Plan 3 reused the existing card-context-menu CustomEvent — hover-checkbox click + keyboard Enter/Space dispatch the SAME event right-click already fires. No new menu, no new actions, no new listener. Single source of truth.
- [Phase 08.1]: Plan 3 used delegated click+keydown listeners on the virtual-scroller container — Alpine bindings cannot live inside renderItem's static HTML string. data-entry-id attribute bridges inert DOM back to reactive store.entries lookup.
- [Phase 08.1]: Plan 3 + Plan 1 merged a single @media (prefers-reduced-motion: reduce) block in main.css covering tc-panel-column, tc-grid-column, cf-panel-reopen, card-quick-actions-checkbox — extended Phase 8 Plan 2's existing block rather than appending duplicates.
- [Phase 08.1]: Plan 02: 18-code PRECON_EXTRA_CODES allowlist surfaces Commander Masters/Legends I+II/Planechase/Archenemy/Premium Deck Series/Commander's Arsenal/Commander Collection/Game Night/ToME Deluxe Commander Kit — surgical (code-level not set_type widening) so mb2 Mystery Booster 2 stays excluded
- [Phase 08.1]: Plan 02: isMultiDeckBundle threshold = strictly > 200 cards. Bundle guard early-returns silently from addAllFromPrecon (no Dexie writes, no loadEntries, no toast, no undo entry) and precon-browser swaps the giant decklist for a MULTI-DECK PRODUCT warning + OPEN IN SCRYFALL link. Browser stays open so the warning stays visible.
- [Phase 08.1]: Plan 02: Reclassified existing cmm fixture row in place from set_type 'commander' → 'masters' (matches Scryfall reality) rather than appending a duplicate. cmm now flows through the FOLLOWUP-4A allowlist path, dogfooding the new code.
- [Phase 09]: Plan 1: DECK-04 root cause was structural — getCardSalt queried /pages/cards/{slug}.json card.salt path EDHREC has never returned. Fix is rewrite to /pages/top/salt.json bulk endpoint (single fetch, name-keyed map, 7d meta-table cache), NOT a wiring patch. RESEARCH live HTTP probes caught this before implementation.
- [Phase 09]: Plan 1: salt cache lives in existing meta table (single row, key 'top_salt_map') instead of new salt_cache table — no Dexie schema bump, mirrors edhrec_cache + combo_cache 'one fetch one row' philosophy.
- [Phase 09]: Plan 1: DECK-03 RAG keeps legacy DEFAULT_THRESHOLDS + detectGaps as back-compat alias — existing 10 two-tier tests stay green, no test rewrites needed. Custom per-deck thresholds get auto-normalised in updateGaps from single-number → { green, amber } shape so saveDeckThresholds API is untouched.
- [Phase 09]: Plan 1: Commander section uses fallback derivation (first Legendary Creature/Planeswalker matching deck colour-identity union) for legacy v1.0 decks lacking commander_id. Console.warn surfaces the fallback for diagnostic visibility. Commander tile is intentionally NOT SortableJS-registered — moving the commander between type sections is meaningless.
- [Phase 09]: Plan 1: deck-analytics-panel + deck-centre-panel read window.Alpine directly (NOT the import). Test mocking via vi.mock('alpinejs') has no effect on these components — pattern is to set window.Alpine = { store, effect, data } in beforeEach + restore in afterEach. Plan 2's player-card.test.js + floating-toolbar.test.js will likely need the same setup.
- [Phase 09]: Phase 09 Plan 2: GAME-05 was net-new wiring, not a bugfix — replaced dead $store.app.gameFullscreen toggle with real document.documentElement.requestFullscreen() / exitFullscreen() called synchronously from @click (P-2 user-gesture)
- [Phase 09]: Phase 09 Plan 2: 3-player layout uses PLAYER-1-ALWAYS-TOP (RESEARCH OVERRIDE of CONTEXT D-10 'auto-rotate to active player'). Auto-rotation is disorienting; D-16 active-player border-glow handles 'whose turn' affordance
- [Phase 09]: Phase 09 Plan 2: cf-player-active CSS body + :class binding hook ship in Plan 2 keyed off $store.game.activePlayerIndex (Plan 3 dependency). Until Plan 3 lands, binding is a no-op — Plan 3 needs ZERO player-card.js edits
- [Phase 09]: Phase 09 Plan 2: single merged @media (prefers-reduced-motion) block in main.css — extended Phase 8.1's existing block (4→6 selectors) including .cf-first-player-spinner (Plan 3 ships body only); NO duplicate block
- [Phase 09]: Phase 09 Plan 2: removed dead $store.app.gameFullscreen field from app store (Rule 1 cleanup) — three writers, zero readers after Plan 2's wiring fix; navigate() + hashchange handler now read document.fullscreenElement as source-of-truth
- [Phase 09]: Phase 09 Plan 2: Material Symbols glyphs LOCKED in source — vaccines (poison) / paid (tax) / shield_with_heart (commander damage) per RESEARCH §4; visual UAT capture deferred to Phase 9 HUMAN-UAT walk per CONTEXT D-00

### Roadmap Evolution

- Phase 08.1 inserted after Phase 8: Treasure Cruise Polish & Precon Coverage (URGENT) — covers 4 polish/bugfix items captured during Phase 8 human-UAT walkthrough; precon coverage gap diagnosed in `.planning/debug/precon-browser-missing-commander-decks.md` (landing fix tiers A+B; tier C deferred). Items 4C and 5 (browse-by-set + faceted filters) explicitly NOT in 8.1 scope.

### Pending Todos

None — roadmap complete, next step is `/gsd:plan-phase 7`.

### Blockers/Concerns

- EDHREC CORS proxy needed for production deployment (works via Vite dev proxy only) — carry-over from v1.0; out of v1.1 scope but acknowledged
- Auth + sync adds new operational concerns: Supabase project provisioning, env vars, sync conflict semantics — Phase 10 planner must produce a pre-flight checklist (Google OAuth provider config, magic-link redirect URL allowlisting for Vercel preview + prod)
- Vercel preview URL dynamic allowlisting for OAuth — decision needed before Phase 10 (wildcard vs per-deploy)
- First-sync reconciliation modal UX wireframe not yet specified — Phase 11 planner must resolve before implementation

## Session Continuity

Last session: 2026-04-17T09:31:59.208Z
Stopped at: Completed 09-02-PLAN.md (GAME-01..06 Vandalblast layout + visuals + router-test fix)
Resume file: None
