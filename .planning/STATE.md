---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Deploy the Gatewatch
status: v1.2 scope reset — 2 phases, 8 active requirements (DEPLOY/DECIDE validated inline)
stopped_at: Scope reset complete — ready for /gsd:discuss-phase 15 (EDHREC Proxy) or /gsd:plan-phase 15
last_updated: "2026-04-28T08:00:00.000Z"
last_activity: 2026-04-28
progress:
  total_phases: 2
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-28 with v1.2 scope reset)

**Core value:** The deck builder knows what you own, and the collection knows what's in your decks — one interconnected data layer that eliminates tab-juggling. Multi-device when signed in (v1.1).
**Current focus:** v1.2 Deploy the Gatewatch — Phase 15 EDHREC CORS Proxy (next), Phase 16 Live-Environment UAT Pass

## Current Position

Phase: 15 (not started — EDHREC CORS Proxy)
Plan: —
Status: Roadmap reset, awaiting plan-phase
Last activity: 2026-04-28 — v1.2 scope reset; DEPLOY/DECIDE validated inline; ROADMAP/REQUIREMENTS/PROJECT updated
Progress: ░░░░░░░░░░ 0% (0/2 phases complete)

## Milestone Progress

| Milestone | Phases | Status |
|-----------|--------|--------|
| v1.0 The Aetheric Archive | 6/6 | ✅ Shipped 2026-04-13 |
| v1.1 Second Sunrise | 8/8 | ✅ Shipped 2026-04-27 |
| v1.2 Deploy the Gatewatch | 0/2 | 🟡 Scope reset 2026-04-28 — ready to plan Phase 15 |

## Backlog & Seeds

Forward-looking work captured during v1.1/v1.2 — parked for v1.3 with production-traffic data in hand:

- **999.1** — MTGJSON Tokens.json "Required Tokens" tab in Thousand-Year Storm
- **999.2** — MTGJSON AllPrices.json historical price charts (collection + watchlist + recently-viewed)
- **SEED-001** — Catalog/userdata storage split (wa-sqlite + OPFS for catalog, keep Dexie for user data)
- **SEED-002** — Revisit Nyquist VALIDATION.md gate at v1.3 (re-enable / leave disabled / backfill phases 7–14)

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table.

**v1.2 scoping decisions (2026-04-27, original):**
- Public sign-up: leave as-is (household model only) — explicit product call
- Nyquist validation gate: disable, revisit at v1.3
- EDHREC CORS proxy: Vercel Function (free, same repo)
- Milestone scope: ship-to-prod readiness only

**v1.2 scope reset (2026-04-28):**
- DEPLOY-01..06 validated inline — Counterflux has been live on Vercel since 2025-04-05 (8 production deploys, `Cache-Control: no-cache` confirmed live, env vars present, auto-deploy on master push). Original "Phase 15 Vercel Foundation" deleted; the work it described had already happened.
- DECIDE-01 validated inline — household-model Key Decision row added to PROJECT.md, Out-of-Scope rewritten from "deferred" to "permanent decision"
- DECIDE-02 validated inline — `gsd-tools config-set workflow.nyquist_validation false` ran 2026-04-28; SEED-002 planted with v1.3 trigger
- Milestone collapses from 3 phases / 16 reqs to 2 phases / 8 reqs. Phase numbering: PROXY phase is now 15 (was 16), UAT phase is now 16 (was 17)
- Auto-deploy on master push retained (NOT manual promotion as the 2026-04-27 discussion locked) — reality already differs and works fine
- Spellbook proxy parity question deferred to Phase 15 plan-phase (low marginal cost vs deferred to v1.3)

### Roadmap Evolution

- v1.0 → v1.1: Phase 8.1 inserted to capture HUMAN-UAT polish + precon coverage gap
- v1.1 → v1.1: Phase 14 added 2026-04-22 via `/gsd:plan-milestone-gaps` to close audit findings
- v1.1 → v1.2: New cleanup-themed milestone, no carry-over of in-flight work
- v1.2 original (2026-04-27): 16 requirements mapped to 3 phases (15–17)
- v1.2 reset (2026-04-28): scope discovery during Phase 15 discuss-phase revealed Vercel infrastructure already shipped; collapsed to 2 phases / 8 active requirements + 8 validated-inline

### Pending Todos

None — Phase 15 (EDHREC Proxy) planning is the next step (`/gsd:discuss-phase 15` or `/gsd:plan-phase 15`).

### Blockers/Concerns (resolving in v1.2)

- **EDHREC CORS proxy needed for production deployment** — IN SCOPE for v1.2, Phase 15. Production has been silently broken on EDHREC features since v1.0 (Vite dev proxy doesn't ship)
- **~~Public sign-up UI surface~~** — VALIDATED INLINE 2026-04-28 (household model permanent)
- **~~Nyquist VALIDATION.md backfill~~** — VALIDATED INLINE 2026-04-28 (gate disabled, SEED-002 planted)
- **Live-environment UAT items deferred to first Vercel deploy** — IN SCOPE for v1.2, Phase 16. Cache-Control verified inline 2026-04-28; perf-soft-gate workflow rewrite + Production Lighthouse run still real work

## Session Continuity

Last session: 2026-04-28 — v1.2 scope reset
Stopped at: ROADMAP/REQUIREMENTS/PROJECT/STATE updated; SEED-002 planted; Nyquist gate disabled. Old Phase 15 directory deleted (premise was wrong). Ready for Phase 15 (EDHREC Proxy) discussion or planning.
Resume: `/gsd:discuss-phase 15` (recommended — Phase 15 is now meaningfully different work) or `/gsd:plan-phase 15`
