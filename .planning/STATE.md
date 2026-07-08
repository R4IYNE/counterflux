---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Brew with the Familiar — BUILT + DEPLOYED (never formally tagged/archived)
status: shipped-untagged
stopped_at: "v1.3 (Phases 17-20: AI deck generation) built overnight 2026-06-07/08, then hardened + audit-remediated through 2026-06-23 and deployed to production (7 deckgen Supabase migrations run, Vercel env vars set, live-debugged 2026-06-14/15). Never tagged or milestone-archived — only v1.0/v1.1/v1.2 git tags exist. GSD workflow retired in favour of the workspace pipeline (/idea → /land). All commits pushed to origin/master (HEAD d259901)."
last_updated: "2026-07-08T00:00:00.000Z"
last_activity: 2026-06-23
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 4
  completed_plans: 4
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md and .planning/milestones/v1.3-PRD.md (Brew with the Familiar)

**Core value:** The deck builder knows what you own, and the collection knows what's in your decks — one interconnected data layer that eliminates tab-juggling. Multi-device when signed in (v1.1). Production EDHREC + Spellbook proxies (v1.2). AI-powered brewing, upgrades, and power-level retuning (v1.3).
**Current focus:** v1.3 built and deployed; no active build in flight. Unstarted next candidates: (a) `npm run build:check` is RED on HEAD — the Thousand-Year Storm screen chunk is 46.2 KB gz vs its 42 KB budget (v1.3 brew UI growth, never checked at v1.3 landing); decide bump-budget vs code-split the brew modal/review out of the screen chunk; (b) the 4 non-fatal router-test Alpine reactive-effect errors (recurring bug class); (c) PWA service worker + manifest to make the works-offline claim real. NB: `npm test` is green (1339 pass).

## Current Position

Phase: — (v1.3 Phases 17-20 built + deployed; not formally closed)
Plan: —
Status: Deployed to production, untagged. GSD milestone ceremony retired in favour of the workspace pipeline.
Last activity: 2026-06-23 — humanize() wired into the deckgen chat path (commit d259901); the June pass closed the 86-finding AUDIT-2026-06-17.md remediation (Tier 0 security through the L-tail).
Progress: ██████████ 100% (v1.3 Phases 17-20 built)

## Milestone Progress

| Milestone | Phases | Status |
|-----------|--------|--------|
| v1.0 The Aetheric Archive | 6/6 | ✅ Shipped 2026-04-13 (tag v1.0) |
| v1.1 Second Sunrise | 8/8 | ✅ Shipped 2026-04-27 (tag v1.1) |
| v1.2 Deploy the Gatewatch | 2/2 | ✅ Shipped 2026-04-28 (tag v1.2; Phase 15 + Phase 16 collapse) |
| v1.3 Brew with the Familiar | 4/4 built | ⚑ Deployed 2026-06 — AI deck generation (Phases 17-20). NOT tagged/archived; GSD ceremony retired |

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

None in flight. v1.3 built + deployed. Unstarted next candidates (see Current focus): the 4 non-fatal router-test Alpine reactive-effect errors; PWA service worker + manifest.

### Blockers/Concerns (carry-over to v1.3)

- **Nyquist VALIDATION.md gate currently disabled** — SEED-002 trigger is v1.3 scoping; re-enable + backfill phases 7–14 OR accept permanently
- **LHCi-on-Vercel-Preview wiring deferred** — SEED-003 trigger is when CDN edge perf becomes load-bearing; until then, localhost-LHCi catches the relevant regressions
- **Catalog/userdata storage split (SEED-001)** — 14 days of post-Phase-11 production sync data accumulated by v1.2 ship; re-evaluate trigger at v1.3 scoping
- **MTGJSON-driven features (backlog 999.1, 999.2)** — both depend on production-traffic data to validate; v1.3 candidates if real users surface demand
- **Production EDHREC + Spellbook proxies not yet promoted** — Phase 15 commits are on master; the next Vercel Production deploy makes them live. Verify post-deploy via the existing intelligence-store flows (no manual UAT needed; symptom of failure would be EDHREC console errors which would surface immediately)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260510-k4t | Fix bulk-pull resume branch missing _markReconciled call | 2026-05-10 | 33d920a | [260510-k4t-fix-bulk-pull-resume-branch-missing-mark](./quick/260510-k4t-fix-bulk-pull-resume-branch-missing-mark/) |
| 260510-vn7 | Fix sync push HTTP 400 on timestamptz fields | 2026-05-10 | 4cbda85 | [260510-vn7-fix-sync-push-400-on-timestamptz-fields-](./quick/260510-vn7-fix-sync-push-400-on-timestamptz-fields-/) |
| 260510-w54 | Fix flushQueue re-entrancy bug causing Postgres deadlocks on bulk RETRY ALL | 2026-05-10 | e3e9ecd | [260510-w54-fix-flushqueue-re-entrancy-bug-causing-p](./quick/260510-w54-fix-flushqueue-re-entrancy-bug-causing-p/) |
| 260511-0k0 | Fix Alpine reactivity gotcha in deck-landing showing stale 0/100 + missing commander art | 2026-05-11 | 70b500b | [260511-0k0-fix-alpine-reactivity-gotcha-in-deck-lan](./quick/260511-0k0-fix-alpine-reactivity-gotcha-in-deck-lan/) |
| 260514-uqc | Defer catalog readiness: Scryfall API search fallback + oracle-cards bulk feed | 2026-05-14 | b676a12 | [260514-uqc-defer-catalog-readiness-scryfall-api-sea](./quick/260514-uqc-defer-catalog-readiness-scryfall-api-sea/) |
| 260515-05m | UI cleanup: topbar dropdown row layout + sticky add-card-panel header + rename Archive Manifest to Treasure Cruise | 2026-05-15 | 15b304a | [260515-05m-ui-cleanup-topbar-dropdown-row-layout-st](./quick/260515-05m-ui-cleanup-topbar-dropdown-row-layout-st/) |

## Session Continuity

Last build activity: 2026-06 — v1.3 "Brew with the Familiar" (AI deck generation) built overnight 2026-06-07/08 (Phases 17-20: `/api/deckgen` infra + Dexie v11 `deckgen_cache`, brew-from-commander modal + review screen, daily upgrade-scan cron, Sonnet power-level retune), then hardened through 2026-06-23: NDJSON streaming brew review, branded splash boot screen, deck-builder filter UX, a11y focus-trap pass, deck legality engine, condition/language tracking, advanced Scryfall search, humanize() on generated reasoning, and full remediation of the 86-finding AUDIT-2026-06-17.md (Tier 0 security through the L-tail). Deployed to production: 7 deckgen Supabase migrations run; Vercel env vars (ANTHROPIC_API_KEY / SUPABASE_SERVICE_ROLE_KEY / CRON_SECRET) set. Never tagged or milestone-archived. Overnight report + open follow-ups: .planning/milestones/v1.3-OVERNIGHT-NOTES.md.

This session — 2026-07-08 (landing + doc-truth only, no product code touched): committed the CLAUDE.md 210→17-line rewrite, mirrored AGENTS.md to it, reconciled STATE.md/ROADMAP.md/MILESTONES.md to record v1.3, dropped retired GSD references, pruned debris (cf-boot.png, .playwright-mcp/), pushed. Tests green (1339 pass; 4 known non-fatal router-test Alpine errors remain, deliberately out of scope).

Resume next session: (1) fix the 4 router-test Alpine reactive-effect errors (undefined `$store.collection.precons.length`; recurring bug class, same as quick-task 260511-0k0) as a tracked requirement; (2) PWA service worker + manifest to make the works-offline claim true (behind /spec). Optional: retroactively tag v1.3 if a formal release marker is wanted.

### Prior snapshot — 2026-05-11 (pre-v1.3, retained as history)

Last session: 2026-05-11 — Completed quick task 260511-0k0: Fix Alpine reactivity gotcha in deck-landing (pre-init `_cardCount`/`_commanderCard` reactive keys in `loadDecks` + drop `=== undefined` guards and hoist dynamic import in `enrichDecks`). Two atomic commits: 6d8ca6b RED, 70b500b GREEN. 5/5 new tests pass. Zero regressions in deck-store + deck-feature sweep + full project suite (1074/1074 attributable tests pass). Deferred broader reactivity audit to v1.3 SEED-007.
Stopped at: v1.2 archived (b6025d5, v1.2 tag pushed). Eight post-archive feature/fix commits since the archive — EDHREC combos integration as Spellbook fallback (26d2ded), gap-badge UX iteration (05d9fab → a319953 → 956090b), basic-land Ramp tag fix + commander singleton exemption (a877852), deck-builder UX batch — sticky LHS + basic-land +/- + smaller commander + group counts by quantity + no DnD (5200baf), quick-task fix (260510-k4t, commit 33d920a) for bulk-pull resume branch in `src/services/sync-reconciliation.js:131` now calling `_markReconciled(userId)` on success (modal-loop trap fix for users with a large household collection after an interrupted MERGE EVERYTHING). Plus today's vn7 hot-fix (commits d7fd67c + 4cbda85): `flushQueue` in `src/services/sync-engine.js` now serialises Number-typed timestamptz payload fields to ISO-8601 strings via the new `_isoStampTimestamps(rows)` helper called at the upsert seam (~L466). Whitelist covers all 8 timestamptz columns (`updated_at`, `synced_at`, `deleted_at`, `added_at`, `created_at`, `started_at`, `ended_at`, `last_alerted_at`) across the 6 synced tables. Dexie creating/updating hooks at lines 220/243 deliberately untouched (LWW resolver `sync-pull.js:_toTs` is already tolerant of both shapes). RED-then-GREEN regression coverage in `tests/sync-engine-push.test.js`. Unblocks the user's 90 dead-lettered `deck_cards` conflicts — once deployed, "Retry All" in the Sync Errors modal drains the backlog. Production EDHREC + Spellbook integrations functional via EDHREC fallback path; Spellbook proxy debug deferred to v1.3 via SEED-004; local Dexie row migration (Number → ISO) deferred to v1.3 via SEED-006.
Resume: `/gsd:new-milestone` to scope v1.3 — five seeds (SEED-001/002/003/004/006) and two backlog items (999.1/999.2) surface automatically during scoping. Strong v1.3 candidates now: SEED-005 — UX-level rework of the reconciliation modal (auto-resume + mark, escape hatch on N failed merges) so an in-flight bulkPull failure can't trap a user even after the 260510-k4t Band-Aid; SEED-006 — migrate local Dexie rows from Number-typed timestamps to ISO so the vn7 conversion seam can be removed and hooks can stamp ISO directly. Post-archive hot-fixes have NOT been formally rolled into a v1.2.x or v1.3 scope yet — that decision belongs to the next `/gsd:new-milestone` discussion.
