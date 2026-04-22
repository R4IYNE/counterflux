---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Second Sunrise
status: executing
stopped_at: Plan 13-03 complete (Wave 2) — streaming UI + two inline regression rounds + mila asset-path fix; Plan 13-04 skipped per REMEASURE (CLS already under target); next up Plan 13-05 bundle split or post-Plan-3 re-measurement
last_updated: "2026-04-22T09:09:59.950Z"
last_activity: 2026-04-22
progress:
  total_phases: 8
  completed_phases: 7
  total_plans: 35
  completed_plans: 33
  percent: 84
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-14)

**Core value:** The deck builder knows what you own, and the collection knows what's in your decks — one interconnected data layer
**Current focus:** Phase 13 — performance-optimisation-conditional

## Current Position

Phase: 13 (performance-optimisation-conditional) — EXECUTING
Plan: 4 of 6
Status: Ready to execute
Last activity: 2026-04-22

Progress: [████████░░] 84%

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
| Phase 09 P03 | 11m 49s | 4 tasks | 8 files |
| Phase 09 P05 | 4m 44s | 3 tasks | 2 files |
| Phase 09 P04 | 9m 17s | 2 tasks | 5 files |
| Phase 09 P06 | ~10m | 2 tasks | 3 files |
| Phase 10 P01 | 6m 0s | 3 tasks | 5 files |
| Phase 10 P02 | 7m 27s | 3 tasks (4 commits w/ TDD RED/GREEN pair) tasks | 9 files files |
| Phase 10 P03 | 8m 30s | 4 tasks (6 commits w/ TDD RED/GREEN pairs) tasks | 7 files files |
| Phase 10 P04 | 10m 12s | 3 tasks | 8 files |
| Phase 11 P02 | 7m 16s | 3 tasks | 6 files |
| Phase 11 P01 | ~6m executor + human apply | 5 tasks (4 auto + 1 human-action) tasks | 8 files files |
| Phase 11 P04 | 43 min | 3 tasks | 7 files |
| Phase 11 P05 | 1h 57m | 4 tasks | 8 files |
| Phase 12 P01 | 4m | 2 tasks | 2 files |
| Phase 12 P03 | 4min | 2 tasks | 7 files |
| Phase 12 P04 | 4m 20s | 2 tasks | 3 files |
| Phase 13 P02 | ~30m (Wave 2 with checkpoint) | 4 tasks | 4 files |
| Phase 13 P03 | ~2 hours | 7 tasks | 16 files |

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
- [Phase 09]: Phase 09 Plan 3: vi.spyOn(Date, 'now') instead of vi.useFakeTimers — fake timers deadlock with fake-indexeddb microtask ordering; Date.now spy keeps real timers + Dexie ops running while letting tests advance the clock arbitrarily
- [Phase 09]: Phase 09 Plan 3: wall-clock anchor pattern (Date.now snapshot + RAF display tick) replaces setInterval — immune to background-tab throttling; 30-min vi.spyOn(Date.now) jump test proves accuracy
- [Phase 09]: Phase 09 Plan 3: cross-plan CSS-class shipping pattern validated end-to-end — Plan 2 shipped .cf-player-active body + binding hook, Plan 3 shipped activePlayerIndex data field; ZERO further player-card.js edits required
- [Phase 09]: Phase 09 Plan 3: TURN PACING section x-show gated on turn_laps.length > 0 — legacy v1.0 saved games (no turn_laps field) hide section cleanly instead of rendering NaN/0:00 tiles; final lap pushed in saveGame so the END-GAME turn (often the longest) is captured
- [Phase 09]: Plan 09-05: D-12 reversed — skull replaces vaccines on poison row per HUMAN-UAT (more on-brand for MTG poison/lethal). Material Symbols Outlined ships skull glyph natively.
- [Phase 09]: Plan 09-05: counter-digit RAG thresholds tier BELOW row-level lethal class (poison digit red at 8 / row lethal at 10; commander damage digit red at 16 / row lethal at 21) — dual-channel: digit narrates approach, row class confirms kill
- [Phase 09]: Plan 09-05: test assertions use jsdom-neutral content-boundary anchoring (indexOf walks to Nth occurrence) instead of :style= attribute regex — jsdom innerHTML re-serialization breaks naive attribute-scoped patterns
- [Phase 09]: Plan 09-04 anchored spinner startTime INSIDE first RAF callback (not before the schedule) — Alpine template swap was eating the full 2.4s animation budget before frame 1 fired
- [Phase 09]: Plan 09-04 moved T-shape grid-area from :nth-child CSS to inline :style keyed on pIdx — Alpine's <template x-for> counts as a DOM child, shifting :nth-child indices off by one
- [Phase 09]: Plan 09-04 established pattern: DOM-structure regression tests live in a separate file with no top-level vi.mock — module-load-time mock hoisting defeats vi.doUnmock in the same file
- [Phase 09]: Plan 09-06: Gap 6 root cause was missing wiring, not broken logic — startTimer() existed and worked but was only invoked from the floating-toolbar manual button; fix is additive call-sites in startGame() (post-spinner) + nextTurn() (pauseTimer-then-startTimer sequence to bypass the if-running guard)
- [Phase 09]: Plan 09-06: Gap 7 (TURN PACING section missing post-game) was a CASCADE from Gap 6, NOT an independent render-path bug — Plan 3's render path was correct (_computePacing called in init at line 344, x-show guard is length > 0); empty turn_laps from frozen timer made the guard evaluate false; 4 new direct-GREEN regression tests lock down the existing-correct contract
- [Phase 09]: Plan 09-06: pause-cancel-then-fresh-start sequence for re-anchoring guarded RAF loops — when startTimer() has an 'if (running) return' guard, call pauseTimer() first to clear the flag + cancel the RAF, THEN startTimer() to schedule a new loop with the new anchor; reusable for any RAF-based timer that supports re-anchoring
- [Phase 10]: Plan 10-01: RLS test uses dynamic import of @supabase/supabase-js inside beforeAll — static imports resolve at Vitest collection time regardless of describe.skip, which would break npm test before Plan 10-02 installs the package. Dynamic import + describeIf skip-gate keeps npm test green (9 tests skipped cleanly) while preserving the D-37 hard-gate contract.
- [Phase 10]: Plan 10-01: RLS migration ships 12 policies using the D-24 template verbatim (6 SELECT + 6 ALL with WITH CHECK on writes — non-negotiable per PITFALLS §2.2). Every user_id column carries a B-tree index (D-25; PITFALLS §2.4 — unindexed user_id times out at 1M rows). counterflux schema mirrors Dexie v8 shape exactly so Phase 11 sync can push/pull 1:1.
- [Phase 10]: Plan 10-01: Pre-flight runbook (10-AUTH-PREFLIGHT.md) is standalone (D-34) — covers Supabase SQL Editor + PostgREST exposed-schemas + Google Cloud Console OAuth + Vercel env vars + local .env.local bootstrap + verification + rotation. README.md created (did not exist) with Auth Setup section linking per D-35.
- [Phase 10]: Plan 10-02: AUTH-01 lazy-load proof locked at BOTH test-time (walkStaticImports regex assertions in tests/supabase-lazy-load.test.js) and production-bundle time (dist/assets/supabase-*.js = 187KB code-split chunk, zero refs in index-*.js). Rollup/Rolldown resolves dynamic imports at build time, so a stub at src/components/auth-callback-overlay.js ships in Plan 2 to unblock router wiring before Plan 3's real overlay overwrites it.
- [Phase 10]: Plan 10-02: Auth store exposes D-30 shape exactly — { status: 'anonymous'|'pending'|'authed', user, session, signInMagic(email), signInGoogle(), signOut(), init() }. hasPriorSession() regex /^sb-.*-auth-token$/ probes localStorage BEFORE any dynamic import, giving anonymous users zero boot latency (D-29). _stateChangeSubscribed module flag makes onAuthStateChange registration idempotent so repeat sign-in attempts don't stack listeners.
- [Phase 10]: Plan 10-02: PKCE flow config (flowType: 'pkce' + persistSession + autoRefreshToken + detectSessionInUrl) ships in src/services/supabase.js getSupabase() — prevents Navigo hash-fragment collision (PITFALLS §10). /auth-callback route registers FIRST in initRouter() (line 47 vs screenLoaders loop at line 60) so Supabase PKCE redirects don't fall through to notFound().
- [Phase 10]: Plan 10-03: auth-modal ships with captureCurrentPreAuthRoute STATICALLY imported from auth-callback-overlay — route must stash BEFORE window.location navigates to Google/Supabase; dynamic import would race the redirect. Rolldown emits INEFFECTIVE_DYNAMIC_IMPORT (overlay lands in main bundle, ~3KB gz cost) but AUTH-01 preserved: supabase-js 187KB chunk still 100% code-split.
- [Phase 10]: Plan 10-03: RESEND countdown uses setInterval(tick, 1000) + Date.now snapshot anchor (wall-clock immune to background-tab throttling, Phase 9 Vandalblast timer precedent). Magic-link-sent swap uses innerHTML replacement of #cf-auth-body — preserves header + X close + escape handler across idle↔sent state flip, no listener churn. Google button hover wired via inline onmouseover/onmouseout matching existing settings-modal inline-style pattern.
- [Phase 10]: Plan 10-03: Sidebar widget registered via Alpine.data('sidebarComponent', sidebarComponent) in main.js — template x-data='sidebarComponent()' resolves new profileWidgetClick/authedDisplayName/authedAvatarUrl helpers via registry (HTML can't import). Reduced-motion selector list front-loads #cf-first-sign-in-prompt (Plan 4 component) to avoid editing main.css twice — invalid selectors for not-yet-mounted elements are a harmless no-op per established convention.
- [Phase 10]: Plan 10-04: Auth-aware profile store uses _source ('local'|'cloud') state machine + id-fetch-first upsert pattern for counterflux.profile (text UUID PK); update() always mirrors to localStorage (D-19) so sign-out re-hydrate has fresh snapshot
- [Phase 10]: Plan 10-04: D-22 sign-out preservation enforced by static grep gate in tests/settings-modal-auth.test.js Test 8 — reads settings-modal.js source and regex-asserts no db.(collection|decks|deck_cards|games|watchlist|profile) matches; cheaper + more durable than Dexie mock
- [Phase 10]: Plan 10-04: first-sign-in-prompt uses capture-phase Escape blocker (addEventListener third-arg true) to intercept before any downstream document-level Escape handler; preventDefault + stopPropagation on keydown, preventDefault on backdrop — D-16 lockdown
- [Phase 10]: Plan 10-04: Alpine.effect in main.js uses async IIFE to sequence profile.hydrate() then maybeShowFirstSignInPrompt() — prompt guards depend on _source/_loaded flags set by hydrate, so sequential await is mandatory; IIFE keeps effect body synchronous while awaiting internally
- [Phase 11]: Plan 11-02: VALID_TRANSITIONS object enforces single-write-path state machine on Alpine.store('sync') — offline→synced direct jump is illegal; reconnect must route offline→syncing to give Plan 11-04's flushQueue room to run
- [Phase 11]: Plan 11-02: chip template uses x-if per state (not :class juggling) — UI-SPEC mandates <button> in error state for keyboard reachability + <div role=status> otherwise; single-element + class-swap cannot express that. Cost: slightly more template volume, benefit: each branch independently grep-able for tests
- [Phase 11]: Plan 11-02: deleted tests/connectivity-status.test.js alongside src/utils/connectivity.js (Rule 3 blocking deviation) — the test audited BOTH the deleted utility AND the replaced v1.0 chip template; leaving it in would fail npm test at import time. New tests/sync-status-chip.test.js replaces the coverage 1:1 + adds per-state assertions
- [Phase 11]: Plan 11-01: Phase 11 schema delta applied to live huxley — Dexie v10 soft-delete (deleted_at column on 5 synced tables, profile excluded per D-15) + 3 Supabase migrations (counterflux.deleted_at + partial indexes + supabase_realtime publication for all 6 tables + pg_cron nightly tombstone sweep at 03:00 UTC with 30-day retention per D-16). pg_cron path used; 2 cron jobs verified in cron.job. Closes Pitfall 11-C so Plan 11-05's Realtime subscription will fire events on counterflux.*
- [Phase 11]: Reconciliation modal stays mounted on onChoice failure — resets buttons + surfaces toast + waits for retry; mirrors settings-modal profile-save error recovery.
- [Phase 11]: Splash progress subscription uses 200ms setInterval polling rather than Alpine.effect — effect throws if splash mounts pre-Alpine.start; polling safely no-ops until store is available.
- [Phase 11]: window.openSyncErrorsModal assignment unconditional in src/stores/sync.js — Plan 11-02's !window.x guard would block the real-modal swap; removed the guard, real import always wins.
- [Phase 11]: [Phase 11]: Plan 11-04: _suppressHooks reference-count (not boolean) — Dexie .update() reads before firing updating hook, async boundary leaks a plain bool; counter + Promise.finally() holds across awaits while keeping Pitfall 11-B grep gate (non-async function decl)
- [Phase 11]: [Phase 11]: Plan 11-04: Enqueue dual-path (tx.table inline + tx.on('complete') fallback) — avoids refactoring 11+ caller sites to scope sync_queue in multi-table tx; fallback fires enqueue after tx commits so outbox invariant holds (queue row persists only when data is durable)
- [Phase 11]: [Phase 11]: Plan 11-04: Transient error 3-attempt budget — attempts === 3 promotes to dead-letter even if classified transient; prevents infinite retry on persistent-transient conditions (quota exhaustion masquerading as 429)
- [Phase 11]: Row-level LWW with tie-to-cloud (D-02) implemented; REQUIREMENTS 'field-level' text superseded per RESEARCH footnote
- [Phase 11]: Single schema-wide Realtime channel (Option B) — stays 24× under Supabase free-tier 200-concurrent quota
- [Phase 11]: Pitfall 11-E closed via sync_pull_in_progress meta flag; reconcile() checks flag FIRST before classifyState
- [Phase 11]: deck_cards atomic merge special case — divergent UUIDs sharing composite → loser logged to sync_conflicts
- [Phase 12]: [Phase 12]: Plan 12-01: syncErrorCount + unifiedBadgeCount live on market store (not sync) — CONTEXT D-02 defines unifiedBadgeCount = syncErrorCount + alertBadgeCount, so keeping both summands on one store is cleaner than cross-store arithmetic in bell template
- [Phase 12]: [Phase 12]: Plan 12-01: __tickSyncErrorPoll test helper exported from market.js mirrors _pollSyncErrors interval body verbatim — keeps _pollSyncErrors signature unchanged while enabling deterministic single-tick unit tests (spy on moduleDb.sync_conflicts, not top-level db, because vi.resetModules creates a fresh schema.js instance)
- [Phase 12]: [Phase 12]: Plan 12-01: market-store.test.js switched to @vitest-environment jsdom to match the Phase 09 deck-analytics-panel precedent; existing watchlist tests are environment-agnostic and pass unchanged
- [Phase 12]: [Phase 12]: Plan 12-03: Bell popover injected via mount-point innerHTML BEFORE Alpine.start() — single-pass directive binding with no Alpine.initTree() defensive call
- [Phase 12]: [Phase 12]: Plan 12-03: Rule 1 auto-fix: sync-status-chip.test.js sentinel re-pointed from textual aria-label to structural id=cf-notification-bell-mount
- [Phase 12]: [Phase 12]: Plan 12-04: Static-grep gate on banned strings ('toast', '2xl:grid-cols-6') applies source-wide via readFileSync — comment prose must avoid the literal strings too; rephrased spoiler-gallery.js doc comments to 'notification surface' + 'responsive 5/6-col scale' to satisfy Tests 4 + 11
- [Phase 12]: [Phase 12]: Plan 12-04: isWatching as per-tile Alpine getter reading $store.market.watchlist.some() — market.js re-ASSIGNS watchlist on every add/remove (Pitfall 1), Alpine's reactivity tracks the reference and re-runs .some() for free; no parallel Set bookkeeping, no manual invalidation
- [Phase 12]: [Phase 12]: Plan 12-04: .cf-spoiler-bookmark is a structural clone of .card-quick-actions-checkbox (Phase 08.1 Plan 3) with 3 delta points — left:8px (top-LEFT per D-09), .is-watching modifier for persistent visibility, 18px glyph font-size vs 16px (bookmark glyph density); CSS reduced-motion selectors appended to the merged @media block — no duplicate block
- [Phase 13]: Plan 13-02: D-09 cheap-path fix shipped only (Dexie close/reopen). Empirical DevTools verify showed authed bfcache works WITHOUT sync-engine teardown — supabase-js v2 Realtime releases cleanly on pagehide; Open Question 3 resolved strictly-better than Research predicted.
- [Phase 13]: Plan 13-02: D-08 targeted the shimmer keyframe (background-position → transform translateX with will-change hint) — NOT the splash progress bar which Plan 3 D-04 deletes. Regression locked via static grep over @keyframes bodies (tests/animation-composability.test.js).
- [Phase 13]: Plan 13-03: D-04 streaming UI — splash REPURPOSED (not deleted), x-show narrowed from status!=='ready' to migrationProgress>0 && <100; Phase 7 migration UX preserved, bulk-data boot gate removed
- [Phase 13]: Plan 13-03: D-06 topbar bulk-data pill inherits sync-chip visual vocabulary verbatim — zero new design tokens, auto-dismisses on status==='ready'; pill cycles through CHECKING ARCHIVE / ARCHIVE N% / INDEXING N / ARCHIVE ERROR
- [Phase 13]: Plan 13-03: db.cards 18-consumer audit — all Pattern A (structurally safe via v1.0 truthy-check culture); zero surgical guards added; only Treasure Cruise add-card + Thousand-Year Storm search needed D-05 explicit placeholders
- [Phase 13]: Plan 13-03: _isBulkDataReady() helper + Alpine.effect subscription pattern for honest empty-state gating — Epic Experiment Welcome banner, Quick Add, empty-states, commander tiles + Treasure Cruise Mila CTAs flip to normal UX on status==='ready' transition; caught via Task 5 human-verify checkpoint (Tasks 5b + 5c inline regression rounds)
- [Phase 13]: Plan 13-03: Mila PNG asset-path bug — pre-existing Vite content-hashing bug on HTML attribute string references (8 img src= sites + favicon). Rule 3 Blocking fix: moved static PNGs to public/assets/ for unhashed serve. Exposed — not caused — by Plan 3 splash removal
- [Phase 13]: Plan 13-03: Preordain 'Upcoming Releases' shows 33-year-old sets (Alpha/Beta/Unlimited/Arabian Nights on 2026-04-21) — OUT OF SCOPE, filed to 13-FINDINGS.md; deferred to Plan 6 audit sweep or dedicated bug-fix plan
- [Phase 13]: Plan 13-03: checkpoint:human-verify design validated — two rounds of smoke-test regression patches (Task 5b + 5c) caught hollow-CTA and asset-path issues invisible to automated tests; both resolved inline via RED/GREEN patches, no replanning

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

Last session: 2026-04-22T08:04:07.963Z
Stopped at: Plan 13-03 complete (Wave 2) — streaming UI + two inline regression rounds + mila asset-path fix; Plan 13-04 skipped per REMEASURE (CLS already under target); next up Plan 13-05 bundle split or post-Plan-3 re-measurement
Resume file: None
