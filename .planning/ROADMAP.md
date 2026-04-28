# Roadmap: Counterflux — The Aetheric Archive

## Milestones

- [x] **v1.0 The Aetheric Archive** — Phases 1-6 (shipped 2026-04-13) — [archive](milestones/v1.0-ROADMAP.md)
- [x] **v1.1 Second Sunrise** — Phases 7-14 (shipped 2026-04-27) — [archive](milestones/v1.1-ROADMAP.md)
- [x] **v1.2 Deploy the Gatewatch** — Phase 15 + Phase 16 collapse (shipped 2026-04-28) — [archive](milestones/v1.2-ROADMAP.md)

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

<details>
<summary>✅ v1.2 Deploy the Gatewatch (Phase 15 + Phase 16 collapse) — SHIPPED 2026-04-28</summary>

- [x] Phase 15: EDHREC CORS Proxy (3/3 plans) — two catch-all Vercel Functions (`api/edhrec/[...path].js` + `api/spellbook/[...path].js`), zero client-side path changes, transparent passthrough with UA injection, 502 mapping with `source: "edhrec"|"spellbook"`. 20 new unit tests pass; main bundle stays 36.0 KB gz
- [⊘] Phase 16: Live-Environment UAT Pass (collapsed inline) — UAT-02 (Production Lighthouse: Perf 99 / LCP 0.7s) + UAT-03 (HUMAN-UAT closure across 13 + 11 + sibling audit) validated inline; UAT-01 (LHCi-on-Vercel-Preview wiring) deferred to v1.3 via SEED-003 on honest-ROI grounds

Full phase details, scope-reset history, and plan-by-plan breakdown: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)

</details>

### v1.3 (TBD)

Run `/gsd:new-milestone` to scope the next milestone. Three seeds with explicit re-trigger conditions surface automatically during scoping:

- [SEED-001](seeds/SEED-001-catalog-userdata-storage-split.md) — Catalog-vs-userdata storage split (wa-sqlite + OPFS for catalog, keep Dexie for user data). Trigger: after Phase 11 Cloud Sync Engine has been live for a meaningful period without regressions
- [SEED-002](seeds/SEED-002-nyquist-revisit.md) — Revisit Nyquist `VALIDATION.md` gate. Re-enable for v1.3 if backfilling phases 7–14 makes sense, otherwise leave disabled permanently
- [SEED-003](seeds/SEED-003-lhci-preview-url.md) — Wire `@lhci/cli` soft-gate to a real Vercel Preview URL (UAT-01 deferred from v1.2 Phase 16). Trigger when CDN edge perf becomes a real concern OR when Counterflux gains SSR / per-request server logic

Plus two backlog candidates (999.1 MTGJSON Tokens, 999.2 MTGJSON AllPrices) waiting for production-traffic-driven user demand.

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1-6 | v1.0 | 31/31 | Shipped | 2026-04-13 |
| 7-14 | v1.1 | 47/47 | Shipped | 2026-04-27 |
| 15 | v1.2 | 3/3 | Shipped | 2026-04-28 |
| 16 | v1.2 | 0/0 | Collapsed inline | 2026-04-28 |

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

---
*Last updated: 2026-04-28 — v1.2 Deploy the Gatewatch shipped and archived. Three milestones in two months: v1.0 (2026-04-13), v1.1 (2026-04-27), v1.2 (2026-04-28). Run `/gsd:new-milestone` to scope v1.3.*
