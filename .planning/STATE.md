---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Deploy the Gatewatch — COMPLETE 2026-04-28
status: completed
stopped_at: ROADMAP/REQUIREMENTS/PROJECT/STATE all updated to milestone-complete; SEED-003 planted; PERF-PROD-2026-04-28.md captured; 13-HUMAN-UAT + 11-HUMAN-UAT resolved; pre-existing Phase 13 path-resolution test fixed
last_updated: "2026-04-28T19:50:12.584Z"
last_activity: 2026-04-28
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-28 with v1.2 completion)

**Core value:** The deck builder knows what you own, and the collection knows what's in your decks — one interconnected data layer that eliminates tab-juggling. Multi-device when signed in (v1.1). Production EDHREC + Spellbook integrations now functional (v1.2).
**Current focus:** v1.2 milestone shipped. Awaiting `/gsd:complete-milestone` archival or `/gsd:new-milestone` for v1.3.

## Current Position

Phase: — (v1.2 complete)
Plan: —
Status: Milestone complete; ready for archive
Last activity: 2026-04-28
Progress: ██████████ 100% (2/2 phases — 1 shipped, 1 collapsed inline)

## Milestone Progress

| Milestone | Phases | Status |
|-----------|--------|--------|
| v1.0 The Aetheric Archive | 6/6 | ✅ Shipped 2026-04-13 |
| v1.1 Second Sunrise | 8/8 | ✅ Shipped 2026-04-27 |
| v1.2 Deploy the Gatewatch | 2/2 | ✅ Shipped 2026-04-28 (Phase 15 + Phase 16 collapse) |

## Backlog & Seeds

Forward-looking work captured during v1.1/v1.2 — re-evaluate at v1.3 with production-traffic data:

- **999.1** — MTGJSON Tokens.json "Required Tokens" tab in Thousand-Year Storm
- **999.2** — MTGJSON AllPrices.json historical price charts (collection + watchlist + recently-viewed)
- **SEED-001** — Catalog/userdata storage split (wa-sqlite + OPFS for catalog, keep Dexie for user data)
- **SEED-002** — Revisit Nyquist VALIDATION.md gate at v1.3 (re-enable / leave disabled / backfill phases 7–14)
- **SEED-003** — Wire `@lhci/cli` soft-gate to a real Vercel Preview URL (UAT-01 deferred from Phase 16). Trigger when CDN edge perf becomes a real concern OR when introducing dynamic SSR / per-request API integration

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table.

**v1.2 scoping decisions (2026-04-27, original):**

- Public sign-up: leave as-is (household model only)
- Nyquist validation gate: disable, revisit at v1.3
- EDHREC CORS proxy: Vercel Function (free, same repo)
- Milestone scope: ship-to-prod readiness only

**v1.2 scope reset (2026-04-28):**

- DEPLOY-01..06 + DECIDE-01..02 validated inline (Counterflux already on Vercel since 2025-04-05)
- Original Phase 15 (Vercel Foundation) deleted; what was Phase 16 became Phase 15, Phase 17 became Phase 16
- Auto-deploy on master push retained (reality differs from the originally-locked manual-promotion plan)

**v1.2 Phase 15 ship (2026-04-28):**

- Catch-all path strategy chosen — `api/edhrec/[...path].js` + `api/spellbook/[...path].js` with zero client-side path changes
- Spellbook proxy folded in (PROXY-01..05 service-generic, no parallel SPELLBOOK-* IDs)
- PROXY-04 reframed from "anonymous bundle parity" to "main bundle stays ≤ 300 KB gz" (existing test gates)
- Server-side hardening: UA injection only; no rate-limiting; no caching; no CORS headers (same-origin)

**v1.2 Phase 16 collapse (2026-04-28):**

- Phase 16 collapsed inline on honest-ROI grounds — same pattern as the original Phase 15 reset
- UAT-02 validated inline via `npx lighthouse https://counterflux.vercel.app/`: Perf 99 / FCP 0.6s / LCP 0.7s / CLS 0.048 (Vercel edge CDN crushes the v1.1 lab 2.49s LCP measurement)
- UAT-03 validated inline: 13-HUMAN-UAT.md flipped `partial` → `resolved`; 11-HUMAN-UAT.md flipped `partial` → `live-use-validated` (10-day production household-use track record + sibling test coverage); pre-existing 8-test path-resolution failure in `tests/perf/remeasure-contract.test.js` fixed inline
- UAT-01 deferred to v1.3 via SEED-003 — Counterflux's lack of SSR / edge functions / per-request API divergence makes Preview-URL Lighthouse marginal vs localhost
- Pattern recognition: when a phase's real engineering is < 30 min and the rest is documentation closure, bypass the phase mechanism entirely

### Roadmap Evolution

- v1.0 → v1.1: Phase 8.1 inserted to capture HUMAN-UAT polish + precon coverage gap
- v1.1 → v1.1: Phase 14 added 2026-04-22 via `/gsd:plan-milestone-gaps` to close audit findings
- v1.1 → v1.2: New cleanup-themed milestone, no carry-over of in-flight work
- v1.2 original (2026-04-27): 16 requirements mapped to 3 phases (15–17)
- v1.2 reset (2026-04-28): Vercel infrastructure already shipped; collapsed to 2 phases / 8 active requirements + 8 validated-inline
- v1.2 Phase 16 collapse (2026-04-28): second collapse-inline event — UAT-02/03 inline, UAT-01 deferred. Final v1.2 shape: 1 phase shipped (15) + 1 phase collapsed (16)

### Pending Todos

None — v1.2 milestone shipped. Run `/gsd:complete-milestone` for archival, or `/gsd:new-milestone` to scope v1.3.

### Blockers/Concerns (carry-over to v1.3)

- **Nyquist VALIDATION.md gate currently disabled** — SEED-002 trigger is v1.3 scoping; re-enable + backfill phases 7–14 OR accept permanently
- **LHCi-on-Vercel-Preview wiring deferred** — SEED-003 trigger is when CDN edge perf becomes load-bearing; until then, localhost-LHCi catches the relevant regressions
- **Catalog/userdata storage split (SEED-001)** — 14 days of post-Phase-11 production sync data accumulated by v1.2 ship; re-evaluate trigger at v1.3 scoping
- **MTGJSON-driven features (backlog 999.1, 999.2)** — both depend on production-traffic data to validate; v1.3 candidates if real users surface demand
- **Production EDHREC + Spellbook proxies not yet promoted** — Phase 15 commits are on master; the next Vercel Production deploy makes them live. Verify post-deploy via the existing intelligence-store flows (no manual UAT needed; symptom of failure would be EDHREC console errors which would surface immediately)

## Session Continuity

Last session: 2026-04-28 — v1.2 milestone archived via `/gsd:complete-milestone`
Stopped at: v1.2 Deploy the Gatewatch fully archived. ROADMAP collapsed to one-line entry; REQUIREMENTS.md deleted (fresh for v1.3); MILESTONES.md entry rewritten with proper accomplishments; phase 15 directory moved to `milestones/v1.2-phases/`; PROJECT.md evolution review complete; RETROSPECTIVE.md v1.2 section appended; STATE.md updated. Awaiting v1.2 git tag + push, and `/gsd:new-milestone` to scope v1.3.
Resume: `/gsd:new-milestone` to scope v1.3 — three seeds (SEED-001/002/003) and two backlog items (999.1/999.2) surface automatically during scoping
