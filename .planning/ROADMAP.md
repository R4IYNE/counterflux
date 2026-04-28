# Roadmap: Counterflux — The Aetheric Archive

## Milestones

- [x] **v1.0 The Aetheric Archive** — Phases 1-6 (shipped 2026-04-13) — [archive](milestones/v1.0-ROADMAP.md)
- [x] **v1.1 Second Sunrise** — Phases 7-14 (shipped 2026-04-27) — [archive](milestones/v1.1-ROADMAP.md)
- [ ] **v1.2 Deploy the Gatewatch** — Phases 15-16 (in flight)

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

- [x] Phase 7: Polish Pass + Perf Baseline + Schema Migration (3/3 plans)
- [x] Phase 8: Treasure Cruise Rapid Entry (3/3 plans)
- [x] Phase 8.1: Treasure Cruise Polish & Precon Coverage (3/3 plans)
- [x] Phase 9: Deck Accuracy + Vandalblast Pod Experience (6/6 plans)
- [x] Phase 10: Supabase Auth Foundation (4/4 plans)
- [x] Phase 11: Cloud Sync Engine (6/6 plans)
- [x] Phase 12: Notification Bell + Preordain Spoiler Refresh (4/4 plans)
- [x] Phase 13: Performance Optimisation (6/6 plans)
- [x] Phase 14: v1.1 Audit Gap Closure (12/12 plans)

Full phase details, success criteria, and plan-by-plan breakdown: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

</details>

### v1.2 Deploy the Gatewatch (in flight — Phases 15-16)

**Milestone goal:** Close the only two real production gaps remaining from v1.1 — the EDHREC CORS proxy (silently broken on Vercel since launch because the Vite dev proxy doesn't ship to production) and the live-environment UAT pass.

**Granularity:** standard, compressed for a small operational milestone.

**Scope reset (2026-04-28):** original v1.2 scope assumed Vercel deployment infrastructure was unbuilt. Discovery confirmed Counterflux has been live on Vercel since 2025-04-05 with auto-deploy on master push, 8 production deploys, `Cache-Control: no-cache` headers serving correctly. DEPLOY-01..06 + DECIDE-01..02 (8 of the original 16 requirements) were validated inline rather than allocated to a phase. The originally-planned "Phase 15 Vercel Foundation & Codified Decisions" was deleted; what was Phase 16 is now Phase 15, and Phase 17 became Phase 16.

**Phases:**

- [ ] **Phase 15: EDHREC CORS Proxy** — Replace the Vite dev proxy with a Vercel Function at `/api/edhrec-proxy`, environment-aware in `src/services/edhrec.js`, with bundle-budget parity preserved. Production has been silently broken on EDHREC features since v1.0; this fixes it.
- [ ] **Phase 16: Live-Environment UAT Pass** — Run `@lhci/cli` soft-gate against a real Preview URL, confirm the perf budget on Production (`https://counterflux.vercel.app/`), and close every Plan 13 deferred UAT item with deploy-URL evidence.

## Phase Details

### Phase 15: EDHREC CORS Proxy

**Goal**: Production deploys can fetch EDHREC synergies, salt scores, and bulk Top-100 data without the CloudFront CORS preflight failure — via a Vercel Function at `/api/edhrec-proxy` — while development continues to use the Vite dev proxy and the anonymous bundle stays exactly the same size.

**Depends on**: Nothing (Vercel project already linked, vercel.json already shipped, env vars already set).

**Requirements**: PROXY-01, PROXY-02, PROXY-03, PROXY-04, PROXY-05

**Success Criteria** (what must be TRUE):
  1. On the Production deploy at `https://counterflux.vercel.app/`, opening Thousand-Year Storm with a Commander selected loads EDHREC synergies and salt scores end-to-end — the function returns 200, the intelligence store populates, and the UI renders synergies (no CloudFront CORS error in the console).
  2. `src/services/edhrec.js` routes through the Vite dev proxy when `import.meta.env.PROD === false` and through `/api/edhrec-proxy` when `import.meta.env.PROD === true` — `npm run dev` still works, `npm run build` produces a bundle that calls the Vercel path.
  3. Outbound requests from the function carry the `User-Agent: Counterflux/1.x` header and respect existing client-side rate-limit spacing — verifiable from Vercel function logs.
  4. A new bundle-inspection test (sibling to `tests/auth-bundle.test.js`) asserts the EDHREC/proxy code path stays out of the initial chunk for anonymous users, and the test passes in CI.
  5. Forcing an upstream EDHREC error (timeout, 5xx, malformed payload) surfaces a clean error to the intelligence-store error handler — the function does not crash, does not leak partial responses, and the existing UI error path renders unchanged.

**Spellbook parity question**: `src/services/spellbook.js:8` carries the same "wire to a serverless proxy or edge function" comment as EDHREC. During plan-phase, decide whether Spellbook's `/api/spellbook` proxy ships in this phase (low marginal cost, same pattern, different upstream) or stays parked for v1.3.

**Plans**: TBD

### Phase 16: Live-Environment UAT Pass

**Goal**: Every Plan 13 deferred UAT item is closed with deploy-URL evidence, the v1.1 perf budget is reconfirmed on a real Production build, and any sibling deferred items in other phases are explicitly resolved (closed or carried to v1.3).

**Depends on**: Phase 15 (perf run reflects real EDHREC traffic via the live proxy).

**Requirements**: UAT-01, UAT-02, UAT-03

**Success Criteria** (what must be TRUE):
  1. `perf-soft-gate.yml` is rewritten to run `@lhci/cli` against a real Vercel Preview deploy URL (instead of `npx http-server dist`), and a status check or PR comment surfaces the result. At least one PR has the workflow visibly fire.
  2. A Production Lighthouse run against `https://counterflux.vercel.app/` is logged confirming LCP ≤ 2.5s, FCP ≤ 0.5s, CLS ≤ 0.1, Perf ≥ 85 — and if any metric drifts, `.planning/PERF-BASELINE.md` is updated with new numbers plus a regression analysis (not silently re-baselined).
  3. `phases/13-performance-optimisation-conditional/13-HUMAN-UAT.md` shows every item checked. Test 2 (`Cache-Control: no-cache` on `/` and `/index.html`) was verified inline 2026-04-28 (`curl -sI` confirms both endpoints emit the header) — record the proof. Test 1 (soft-gate fires on real PR) closes when criterion #1 above lands.
  4. Sibling deferred UAT items in any phase 7–14 (e.g. live RLS verification on prod Supabase) are audited — each is either closed with evidence or explicitly carried to v1.3 with a one-line reason.

**Plans**: TBD

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1-6 | v1.0 | 31/31 | Shipped | 2026-04-13 |
| 7-14 | v1.1 | 47/47 | Shipped | 2026-04-27 |
| 15 | v1.2 | 0/0 | Not started | — |
| 16 | v1.2 | 0/0 | Not started | — |

## v1.2 Coverage Summary

8 active requirements across 2 phases. 8 additional requirements (DEPLOY-01..06 + DECIDE-01..02) validated inline during scoping reset.

| Category | Count | Phase / Status |
|----------|-------|----------------|
| PROXY-01..05 | 5 | Phase 15 |
| UAT-01..03 | 3 | Phase 16 |
| **Active total** | **8** | **2 phases** |
| DEPLOY-01..06 | 6 | Validated inline (2026-04-28) |
| DECIDE-01..02 | 2 | Validated inline (2026-04-28) |
| **Validated inline** | **8** | **No phase work** |

## Backlog

### Phase 999.1: MTGJSON Tokens.json — "Required Tokens" tab in Thousand-Year Storm (BACKLOG)

**Goal:** [Captured for future planning] Add a "Required Tokens" tab to the Thousand-Year Storm deck builder that uses MTGJSON's `Tokens.json` to map every card in a deck to the exact tokens, emblems, and helper cards it produces — then renders a checklist of physical tokens the user needs to gather to play the deck. Lightweight dataset, additive feature, no data-layer changes required.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)

### Phase 999.2: MTGJSON AllPrices.json — historical price charts (scoped to user data) (BACKLOG)

**Goal:** [Captured for future planning] Use MTGJSON's `AllPrices.json` for daily/weekly historical price aggregates across TCGPlayer, Cardmarket, and Cardhoarder (foils included). Render sparkline charts in Preordain (Movers & Shakers) and a portfolio-value chart on Treasure Cruise. **CRITICAL SCOPE:** do NOT bulk-load the full multi-GB `AllPrices.json`. Pull only the price series for cards in user collection + watchlist + recently-viewed, and cache aggressively.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)

## Seeds

Forward-looking ideas with trigger conditions — surface automatically during `/gsd:new-milestone` when scope matches.

- [SEED-001](seeds/SEED-001-catalog-userdata-storage-split.md) — Catalog-vs-userdata storage split (wa-sqlite + OPFS for catalog, keep Dexie for user data). Trigger: after Phase 11 Cloud Sync Engine has been live for a meaningful period without regressions. Re-evaluate at v1.3 milestone planning with production-traffic data.
- [SEED-002](seeds/SEED-002-nyquist-revisit.md) — Revisit Nyquist `VALIDATION.md` gate. Re-enable for v1.3 if backfilling phases 7–14 makes sense, otherwise leave disabled permanently. Planted 2026-04-28 during v1.2 scoping reset.

---
*Last updated: 2026-04-28 — v1.2 scope reset. 8 active requirements across 2 phases (15 PROXY, 16 UAT). DEPLOY-01..06 + DECIDE-01..02 validated inline. Ready for `/gsd:plan-phase 15`.*
