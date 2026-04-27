---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Deploy the Gatewatch
status: v1.2 milestone started — defining requirements
stopped_at: Milestone scoped via /gsd:new-milestone — production-readiness only, four carry-over blockers
last_updated: "2026-04-27T22:00:00.000Z"
last_activity: 2026-04-27
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-27 with v1.2 Deploy the Gatewatch scope)

**Core value:** The deck builder knows what you own, and the collection knows what's in your decks — one interconnected data layer that eliminates tab-juggling. Multi-device when signed in (v1.1).
**Current focus:** v1.2 Deploy the Gatewatch — production-readiness milestone, defining requirements

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-27 — Milestone v1.2 started

## Milestone Progress

| Milestone | Phases | Status |
|-----------|--------|--------|
| v1.0 The Aetheric Archive | 6/6 | ✅ Shipped 2026-04-13 |
| v1.1 Second Sunrise | 8/8 | ✅ Shipped 2026-04-27 |
| v1.2 Deploy the Gatewatch | —/— | 🟡 Scoping — defining requirements |

## Backlog & Seeds

Forward-looking work captured during v1.1 — parked for v1.3 with production-traffic data in hand:

- **999.1** — MTGJSON Tokens.json "Required Tokens" tab in Thousand-Year Storm (lightweight, additive)
- **999.2** — MTGJSON AllPrices.json historical price charts (scoped to user data: collection + watchlist + recently-viewed)
- **SEED-001** — Catalog/userdata storage split (wa-sqlite + OPFS for catalog, keep Dexie for user data). Trigger: after Phase 11 sync engine has been live in production without regressions
- **(v1.2-derived)** Revisit Nyquist VALIDATION.md gate — re-enable for v1.3 if backfilling 7–14 makes sense, otherwise leave disabled permanently

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table. Per-phase implementation decisions archived in `milestones/v1.1-ROADMAP.md` and individual phase SUMMARY.md files.

**v1.2 scoping decisions (2026-04-27):**
- Public sign-up: leave as-is (household model only, no public sign-up surface) — explicit product call, codified to Out of Scope
- Nyquist validation gate: disable for v1.2, revisit at v1.3 — paperwork debt vs real coverage gap
- EDHREC CORS proxy: Vercel Function (free, same repo) chosen over Cloudflare Worker (separate deploy) and Supabase Edge Function (couples to auth/sync project)
- Milestone scope: ship-to-prod readiness only, no new user-facing features pulled from backlog

### Roadmap Evolution

- v1.0 → v1.1: Phase 8.1 inserted to capture HUMAN-UAT polish + precon coverage gap
- v1.1 → v1.1: Phase 14 added 2026-04-22 via `/gsd:plan-milestone-gaps` to close audit findings; expanded inline from 3 plans to 12 as 2 latent v1.1 bugs surfaced during UAT
- v1.1 → v1.2: New cleanup-themed milestone, no carry-over of in-flight work — v1.1 fully shipped before v1.2 began

### Pending Todos

None — v1.2 requirements next.

### Blockers/Concerns (resolving in v1.2)

- **EDHREC CORS proxy needed for production deployment** — IN SCOPE for v1.2 (Vercel Function)
- **Public sign-up UI surface** — IN SCOPE for v1.2 (codify household-model decision, no new UI)
- **Nyquist VALIDATION.md backfill** — IN SCOPE for v1.2 (disable gate, revisit at v1.3)
- **Live-environment UAT items deferred to first Vercel deploy** — IN SCOPE for v1.2 (first deploy + UAT pass clears them)

## Session Continuity

Last session: 2026-04-27 — v1.2 milestone scoping via `/gsd:new-milestone`
Stopped at: PROJECT.md + STATE.md updated; milestone confirmed; ready for requirements + roadmap
Resume: Continue `/gsd:new-milestone` workflow — research decision → REQUIREMENTS.md → ROADMAP.md
