---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Second Sunrise
status: executing
stopped_at: Phase 8 Plan 2 complete; Plan 3 (precon browser + Dexie v9) ready to execute
last_updated: "2026-04-16T09:12:27.799Z"
last_activity: 2026-04-16
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 6
  completed_plans: 5
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-14)

**Core value:** The deck builder knows what you own, and the collection knows what's in your decks — one interconnected data layer
**Current focus:** Phase 08 — treasure-cruise-rapid-entry

## Current Position

Phase: 08 (treasure-cruise-rapid-entry) — EXECUTING
Plan: 3 of 3
Status: Ready to execute
Last activity: 2026-04-16

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

### Pending Todos

None — roadmap complete, next step is `/gsd:plan-phase 7`.

### Blockers/Concerns

- EDHREC CORS proxy needed for production deployment (works via Vite dev proxy only) — carry-over from v1.0; out of v1.1 scope but acknowledged
- Auth + sync adds new operational concerns: Supabase project provisioning, env vars, sync conflict semantics — Phase 10 planner must produce a pre-flight checklist (Google OAuth provider config, magic-link redirect URL allowlisting for Vercel preview + prod)
- Vercel preview URL dynamic allowlisting for OAuth — decision needed before Phase 10 (wildcard vs per-deploy)
- First-sync reconciliation modal UX wireframe not yet specified — Phase 11 planner must resolve before implementation

## Session Continuity

Last session: 2026-04-16T09:12:09.143Z
Stopped at: Phase 8 Plan 2 complete; Plan 3 (precon browser + Dexie v9) ready to execute
Resume file: None
