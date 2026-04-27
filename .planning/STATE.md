---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Deploy the Gatewatch
status: v1.2 roadmap created — 3 phases, 16 requirements mapped
stopped_at: ROADMAP.md written; ready for /gsd:plan-phase 15
last_updated: "2026-04-27T22:30:00.000Z"
last_activity: 2026-04-27
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-27 with v1.2 Deploy the Gatewatch scope)

**Core value:** The deck builder knows what you own, and the collection knows what's in your decks — one interconnected data layer that eliminates tab-juggling. Multi-device when signed in (v1.1).
**Current focus:** v1.2 Deploy the Gatewatch — production-readiness milestone, roadmap created (3 phases, Phases 15–17)

## Current Position

Phase: 15 (not started — Vercel Foundation & Codified Decisions)
Plan: —
Status: Roadmap created, awaiting plan-phase
Last activity: 2026-04-27 — ROADMAP.md written, REQUIREMENTS.md traceability populated
Progress: ░░░░░░░░░░ 0% (0/3 phases complete)

## Milestone Progress

| Milestone | Phases | Status |
|-----------|--------|--------|
| v1.0 The Aetheric Archive | 6/6 | ✅ Shipped 2026-04-13 |
| v1.1 Second Sunrise | 8/8 | ✅ Shipped 2026-04-27 |
| v1.2 Deploy the Gatewatch | 0/3 | 🟡 Roadmap created — ready to plan Phase 15 |

## Backlog & Seeds

Forward-looking work captured during v1.1 — parked for v1.3 with production-traffic data in hand:

- **999.1** — MTGJSON Tokens.json "Required Tokens" tab in Thousand-Year Storm (lightweight, additive)
- **999.2** — MTGJSON AllPrices.json historical price charts (scoped to user data: collection + watchlist + recently-viewed)
- **SEED-001** — Catalog/userdata storage split (wa-sqlite + OPFS for catalog, keep Dexie for user data). Trigger: after Phase 11 sync engine has been live in production without regressions
- **SEED-002 (planned in Phase 15)** — Revisit Nyquist VALIDATION.md gate. Re-enable for v1.3 if backfilling 7–14 makes sense, otherwise leave disabled permanently

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table. Per-phase implementation decisions archived in `milestones/v1.1-ROADMAP.md` and individual phase SUMMARY.md files.

**v1.2 scoping decisions (2026-04-27):**
- Public sign-up: leave as-is (household model only, no public sign-up surface) — explicit product call, codified to Out of Scope
- Nyquist validation gate: disable for v1.2, revisit at v1.3 — paperwork debt vs real coverage gap
- EDHREC CORS proxy: Vercel Function (free, same repo) chosen over Cloudflare Worker (separate deploy) and Supabase Edge Function (couples to auth/sync project)
- Milestone scope: ship-to-prod readiness only, no new user-facing features pulled from backlog

**v1.2 roadmap decisions (2026-04-27):**
- 3 phases (not 4+) — small operational milestone; DECIDE-01/02 piggy-back on the Vercel infra phase rather than getting their own paperwork-only phase
- DEPLOY + DECIDE collapsed into Phase 15 — both are config/doc-only work that ships alongside the Vercel project link, no parallel-execution benefit from splitting
- PROXY isolated as Phase 16 — only depends on Vercel project existing, has its own bundle-budget test, naturally atomic
- UAT held to last phase — must run against real Preview/Production URLs, depends on every infra piece being live

### Roadmap Evolution

- v1.0 → v1.1: Phase 8.1 inserted to capture HUMAN-UAT polish + precon coverage gap
- v1.1 → v1.1: Phase 14 added 2026-04-22 via `/gsd:plan-milestone-gaps` to close audit findings; expanded inline from 3 plans to 12 as 2 latent v1.1 bugs surfaced during UAT
- v1.1 → v1.2: New cleanup-themed milestone, no carry-over of in-flight work — v1.1 fully shipped before v1.2 began
- v1.2 roadmap (2026-04-27): 16 requirements mapped to 3 phases (15–17). Granularity = standard, compressed for small operational milestone

### Pending Todos

None — Phase 15 planning is the next step (`/gsd:plan-phase 15`).

### Blockers/Concerns (resolving in v1.2)

- **EDHREC CORS proxy needed for production deployment** — IN SCOPE for v1.2, Phase 16
- **Public sign-up UI surface** — IN SCOPE for v1.2, Phase 15 (DECIDE-01)
- **Nyquist VALIDATION.md backfill** — IN SCOPE for v1.2, Phase 15 (DECIDE-02)
- **Live-environment UAT items deferred to first Vercel deploy** — IN SCOPE for v1.2, Phase 17

## Session Continuity

Last session: 2026-04-27 — v1.2 roadmap created via `/gsd:new-project` → `gsd-roadmapper`
Stopped at: ROADMAP.md, STATE.md, REQUIREMENTS.md traceability written; ready for plan-phase
Resume: `/gsd:plan-phase 15` — decompose Phase 15 (Vercel Foundation & Codified Decisions) into plans
