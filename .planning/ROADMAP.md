# Roadmap: Counterflux — The Aetheric Archive

## Milestones

- [x] **v1.0 The Aetheric Archive** — Phases 1-6 (shipped 2026-04-13) — [archive](milestones/v1.0-ROADMAP.md)
- [x] **v1.1 Second Sunrise** — Phases 7-14 (shipped 2026-04-27) — [archive](milestones/v1.1-ROADMAP.md)
- [ ] **v1.2 Deploy the Gatewatch** — Phases 15-17 (in flight)

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

### v1.2 Deploy the Gatewatch (in flight — Phases 15-17)

**Milestone goal:** Make Counterflux production-deployable on Vercel by closing every v1.1 carry-over blocker. Pure cleanup — no new user-facing features. The user pulls the production-promotion trigger when the preview pipeline + UAT are green.

**Granularity:** standard (compressed for a small operational milestone — 16 requirements across 3 atomic phases, not 6+).

**Phases:**

- [ ] **Phase 15: Vercel Foundation & Codified Decisions** — Stand up the Vercel project, wire env vars, ship `vercel.ts` config, and codify the household-model + Nyquist-disabled product decisions.
- [ ] **Phase 16: EDHREC CORS Proxy** — Replace the Vite dev proxy with a Vercel Function at `/api/edhrec-proxy`, environment-aware in `intelligence-edhrec.js`, with bundle-budget parity preserved.
- [ ] **Phase 17: Live-Environment UAT Pass** — Run `@lhci/cli` soft-gate against a real Preview URL, confirm the perf budget on Production, and close every Plan 13 deferred UAT item with deploy-URL evidence.

## Phase Details

### Phase 15: Vercel Foundation & Codified Decisions

**Goal**: Counterflux has a working Vercel project — every PR builds a Preview deploy with a unique URL, Supabase env vars are wired for both environments, the index document ships with `Cache-Control: no-cache`, and the two product decisions (household-model auth, Nyquist gate disabled) are codified in the right files so the rest of the milestone can rely on them.

**Depends on**: Nothing (first phase of v1.2; v1.1 fully shipped).

**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05, DEPLOY-06, DECIDE-01, DECIDE-02

**Success Criteria** (what must be TRUE):
  1. Opening a fresh PR on `R4IYNE/counterflux` triggers a Vercel Preview build that finishes successfully and exposes a unique `*.vercel.app` URL — the user can click the URL and load the auth wall against the real Supabase project.
  2. Loading the Preview URL in DevTools shows `Cache-Control: no-cache` on the index document response, and `tests/auth-bundle.test.js` (plus any sibling bundle-budget guards) still passes in CI against the same build.
  3. A `vercel.ts` (or `vercel.json`) config file exists at the repo root declaring build command, output directory, framework hint, and the no-cache header — and the file matches Vercel's current recommended Fluid-Compute / Node.js 24 LTS posture (no edge-runtime constraints introduced).
  4. `phases/10-supabase-auth-foundation/10-CONTEXT.md:113` no longer reads as "deferred" — the public sign-up note explicitly says "decision: household model only," and PROJECT.md "Out of Scope" matches that framing.
  5. `node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.nyquist_validation` returns `false`, and `.planning/seeds/SEED-002-nyquist-revisit.md` exists with the trade-off captured for v1.3.

**Plans**: TBD

### Phase 16: EDHREC CORS Proxy

**Goal**: Production deploys can fetch EDHREC synergies, salt scores, and bulk Top-100 data without the CloudFront CORS preflight failure — via a Vercel Function at `/api/edhrec-proxy` — while development continues to use the Vite dev proxy and the anonymous bundle stays exactly the same size.

**Depends on**: Phase 15 (needs the linked Vercel project to host the function and a working Preview deploy to test against).

**Requirements**: PROXY-01, PROXY-02, PROXY-03, PROXY-04, PROXY-05

**Success Criteria** (what must be TRUE):
  1. On a Preview deploy, opening Thousand-Year Storm with a Commander selected loads EDHREC synergies and salt scores end-to-end — the function returns 200, the intelligence store populates, and the UI renders synergies (no CloudFront CORS error in the console).
  2. `intelligence-edhrec.js` (or its equivalent service file) routes through the Vite dev proxy when `import.meta.env.PROD === false` and through `/api/edhrec-proxy` when `import.meta.env.PROD === true` — `npm run dev` still works, `npm run build` produces a bundle that calls the Vercel path.
  3. Outbound requests from the function carry the `User-Agent: Counterflux/1.x` header and respect existing client-side rate-limit spacing — verifiable from EDHREC's perspective by inspecting outbound headers in the function logs.
  4. A new bundle-inspection test (sibling to `tests/auth-bundle.test.js`) asserts the EDHREC/proxy code path stays out of the initial chunk for anonymous users, and the test passes in CI.
  5. Forcing an upstream EDHREC error (timeout, 5xx, malformed payload) surfaces a clean error to the intelligence-store error handler — the function does not crash, does not leak partial responses, and the existing UI error path renders unchanged.

**Plans**: TBD

### Phase 17: Live-Environment UAT Pass

**Goal**: Every Plan 13 deferred UAT item is closed with deploy-URL evidence, the v1.1 perf budget is reconfirmed on a real Production build, and any sibling deferred items in other phases are explicitly resolved (closed or carried to v1.3) — making the milestone "done" pending only the user's production-promotion button-press.

**Depends on**: Phase 16 (needs the proxy live so the perf run reflects real EDHREC traffic) and Phase 15 (needs Preview pipeline + Cache-Control header + linked project).

**Requirements**: UAT-01, UAT-02, UAT-03

**Success Criteria** (what must be TRUE):
  1. At least one PR has `@lhci/cli` running against the live Preview deploy URL (not local `vite preview`) and surfacing results — visible as a status check or PR comment on `R4IYNE/counterflux`.
  2. A Production Lighthouse run is logged confirming LCP ≤ 2.5s, FCP ≤ 0.5s, CLS ≤ 0.1, Perf ≥ 85 — and if any metric drifts, `.planning/PERF-BASELINE.md` is updated with new numbers plus a regression analysis (not silently re-baselined).
  3. `phases/13-performance-optimisation/13-HUMAN-UAT.md` shows every item checked with the deploy-URL or PR-link that proves it (Cache-Control header verified, soft-gate visibly fired).
  4. Sibling deferred UAT items in any phase 7–14 (e.g. live RLS verification on prod Supabase) are audited — each is either closed with evidence or explicitly carried to v1.3 with a one-line reason.

**Plans**: TBD

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1-6 | v1.0 | 31/31 | Shipped | 2026-04-13 |
| 7-14 | v1.1 | 47/47 | Shipped | 2026-04-27 |
| 15 | v1.2 | 0/0 | Not started | — |
| 16 | v1.2 | 0/0 | Not started | — |
| 17 | v1.2 | 0/0 | Not started | — |

## v1.2 Coverage Summary

All 16 v1.2 requirements mapped to exactly one phase. No orphans, no duplicates.

| Category | Count | Phase |
|----------|-------|-------|
| DEPLOY-01..06 | 6 | Phase 15 |
| DECIDE-01..02 | 2 | Phase 15 |
| PROXY-01..05 | 5 | Phase 16 |
| UAT-01..03 | 3 | Phase 17 |
| **Total** | **16** | **3 phases** |

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

- [SEED-001](seeds/SEED-001-catalog-userdata-storage-split.md) — Catalog-vs-userdata storage split (wa-sqlite + OPFS for catalog, keep Dexie for user data). Trigger: after Phase 11 Cloud Sync Engine has been live for a meaningful period without regressions. Re-evaluate at v1.3 milestone planning with production-traffic data.
- **SEED-002 (planted in v1.2 Phase 15)** — Revisit Nyquist `VALIDATION.md` gate. Re-enable for v1.3 if backfilling phases 7–14 makes sense, otherwise leave disabled permanently. File written by Phase 15: `seeds/SEED-002-nyquist-revisit.md`.

---
*Last updated: 2026-04-27 — v1.2 Deploy the Gatewatch roadmap created. 16 requirements mapped to 3 phases (15–17). 100% coverage. Ready for `/gsd:plan-phase 15`.*
