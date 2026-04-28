# Requirements: Counterflux v1.2 — Deploy the Gatewatch

**Defined:** 2026-04-27
**Reset:** 2026-04-28 (scope discovery — Vercel infra was already shipped pre-milestone)
**Core Value:** The deck builder knows what you own, and the collection knows what's in your decks — one interconnected data layer. Multi-device when signed in. Now production-deployable on Vercel.
**Milestone Goal:** Close the only two real production gaps remaining from v1.1: the EDHREC CORS proxy (currently silently broken on Vercel because the Vite dev proxy doesn't ship to production) and the live-environment UAT pass. Pure cleanup.

> **Prior milestone:** v1.1 requirements archived at `.planning/milestones/v1.1-REQUIREMENTS.md`.

## Scope Reset (2026-04-28)

Original v1.2 scope assumed Vercel deployment infrastructure needed to be stood up. Discovery during Phase 15 discussion revealed Counterflux has been live on Vercel since 2025-04-05 (8 production deploys, including v1.1 archival commit `dfad4e7`). The `vercel.json` already emits `Cache-Control: no-cache` on `/` and `/index.html` (verified via `curl -sI` against `https://counterflux.vercel.app/`). DEPLOY-01..06 + DECIDE-01/02 were therefore validated inline rather than allocated to a phase. The milestone collapses to 2 phases (8 requirements) instead of 3 phases (16 requirements).

## v1.2 Requirements

### EDHREC + Spellbook CORS Proxies

Phase 15 ships Vercel Functions for **both** EDHREC and Spellbook — they have the identical CORS-preflight problem in production (silently broken since v1.0) and the identical fix shape (catch-all path-aligned proxy). Requirements below apply to both services unless noted.

- [ ] **PROXY-01**: Vercel Functions at `api/edhrec/[...path].js` and `api/spellbook/[...path].js` (catch-all routes matching `/api/edhrec/*` and `/api/spellbook/*`) proxy upstream API requests to `https://json.edhrec.com/*` and `https://backend.commanderspellbook.com/*` respectively. Production deploys can fetch synergies, salt scores, and combo lookups without the CloudFront CORS preflight failure currently blocking them
- [ ] **PROXY-02**: Existing client services (`src/services/edhrec.js` and `src/services/spellbook.js`) require **no client-side path changes** — the catch-all path-alignment means `EDHREC_BASE = '/api/edhrec'` and `SPELLBOOK_BASE = '/api/spellbook'` continue to work identically in dev (via Vite proxy) and in production (via Vercel Functions). Verified by `npm run dev` and `npm run build` both producing working code paths against the same URLs
- [ ] **PROXY-03**: Each Vercel Function sets `User-Agent: Counterflux/1.x (+https://counterflux.vercel.app)` on its outbound request to the upstream API — server-side User-Agent is unrestricted (unlike browsers, where the existing client code intentionally omits it per `src/services/edhrec.js:42-43`). Functions otherwise pass query, body, method, and headers through transparently. NO server-side rate limiting (client already enforces 200ms spacing for EDHREC); NO server-side caching beyond Vercel's defaults
- [ ] **PROXY-04**: Adding the proxy Functions does not grow the main client bundle past the existing 300 KB gz budget. Vercel Function files in `api/` are server-side-only and not imported by client code; the existing `tests/bundle-budget.test.js` asserts the budget on every `npm run build:check`. Phase 15 success: bundle-budget test passes on the post-change build
- [ ] **PROXY-05**: Each Function surfaces upstream errors and timeouts back to the client cleanly — non-2xx upstream responses pass through with status code preserved, network failures return 502 (Bad Gateway), function never crashes, never leaks partial responses. Existing intelligence-store error handling (`src/stores/intelligence.js` `error.edhrec` and `error.spellbook` flags, `result.error: true` fallback) continues to work unchanged

### Live-Environment UAT Pass

- [ ] **UAT-01**: `@lhci/cli` soft-gate runs against a real Preview deployment URL (not just `vite preview` locally) on at least one PR and surfaces a status check or PR comment — closes the Plan 13 deferred item. Currently `perf-soft-gate.yml` runs against `npx http-server dist`; the rewrite should target the Vercel Preview URL via the deployment webhook or `lhci collect --url`
- [ ] **UAT-02**: A Production Lighthouse run against `https://counterflux.vercel.app/` confirms the v1.1 perf budget holds (LCP ≤ 2.5s, FCP ≤ 0.5s, CLS ≤ 0.1, Perf ≥ 85). Any drift triggers re-baseline of `.planning/PERF-BASELINE.md` with the new numbers and a regression analysis. Production has been live for ~3 weeks — this run reveals whether real-world performance matches the v1.1 lab numbers
- [ ] **UAT-03**: `phases/13-performance-optimisation-conditional/13-HUMAN-UAT.md` items are marked complete with deploy-URL evidence. Test 2 (`Cache-Control: no-cache` on `/` and `/index.html`) was verified inline 2026-04-28 (`curl -sI` confirms both endpoints emit the header). Test 1 (soft-gate fires on real PR) closes when UAT-01 lands. Sibling deferred UAT items in any phase 7–14 are audited and either closed or carried to v1.3

## Validated During Scoping (2026-04-28)

The original v1.2 scope (defined 2026-04-27) included these requirements; discovery confirmed they were already true before the milestone began. No phase work needed.

- [x] **DEPLOY-01**: Vercel project linked (`prj_PX6m53ccCSFjVgeeYAVcUw6PLaMz`, team `team_sFG7qJZ18VAvmffTZYsXqlUl`) — connected to `R4IYNE/counterflux` since 2025-04-05
- [x] **DEPLOY-02**: Supabase env vars set (Production environment serves the v1.1 auth flow — Phase 11 cloud sync + magic-link / Google OAuth observably work in production, which is impossible without `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`)
- [x] **DEPLOY-03**: PRs auto-build Preview deployments; pushes to `master` auto-build Production deployments (8 production deploys observed, latest `dfad4e7` v1.1 archival commit). Auto-deploy posture replaced the manual-promotion plan from the 2026-04-27 discussion since reality already differs
- [x] **DEPLOY-04**: `Cache-Control: no-cache` confirmed live on `/` and `/index.html` (via `curl -sI https://counterflux.vercel.app/` 2026-04-28). vercel.json shipped with v1.0
- [x] **DEPLOY-05**: Build succeeds against existing Vite/Rolldown config — observable in 8 successful production deploys. Bundle-budget tests + perf-soft-gate workflow already gating
- [x] **DEPLOY-06**: `vercel.json` already committed at repo root with Cache-Control headers. Vercel auto-detects Vite framework, build command (`npm run build`), and output directory (`dist`) — no further config needed for v1.2 scope
- [x] **DECIDE-01**: Household-model decision codified in PROJECT.md "Key Decisions" table (added 2026-04-28 — see commit). The original deferral comment in `phases/10-supabase-auth-foundation/10-CONTEXT.md:113` no longer existed (replaced post-ship by Phase 10 D-38 household-RLS decision); PROJECT.md "Out of Scope" wording aligned with the permanent-decision framing in commit `b851f20`
- [x] **DECIDE-02**: Nyquist validation gate disabled via `gsd-tools config-set workflow.nyquist_validation false` (2026-04-28). `.planning/seeds/SEED-002-nyquist-revisit.md` planted with v1.3 trigger conditions

## Future Requirements (deferred)

- 999.1 — MTGJSON Tokens.json "Required Tokens" tab in Thousand-Year Storm — parked. Re-evaluate at v1.3 with production-traffic data
- 999.2 — MTGJSON AllPrices.json historical price charts (collection + watchlist + recently-viewed) — parked. Re-evaluate at v1.3
- SEED-001 — Catalog/userdata storage split (wa-sqlite + OPFS for static catalog, Dexie for user data) — parked. Trigger: Phase 11 sync engine running in production for a meaningful window without regressions
- SEED-002 — Revisit Nyquist VALIDATION.md gate at v1.3 milestone scoping (re-enable / leave disabled / backfill phases 7–14)

## Out of Scope (v1.2)

- Public sign-up UI surface — explicit product decision codified in DECIDE-01 (validated): household model only, no public sign-up route, existing-account credentials remain the entry path
- Custom domain configuration (e.g. `counterflux.app`) — Vercel-assigned URLs sufficient. Custom domain is a separate decision the user can make post-deploy
- Backfilling Nyquist `VALIDATION.md` for phases 7–14 — DECIDE-02 (validated) disabled the gate. v1.3 trigger via SEED-002
- Production analytics / observability stack (Vercel Analytics, Sentry, Logflare) — Web Vitals instrumentation already shipped in v1.1 covers core perf telemetry
- Edge runtime migration — Vercel platform default is Fluid Compute (Node.js); do not introduce edge runtime constraints
- Promotion of any backlog item (999.1, 999.2, SEED-001) into v1.2 scope — milestone is intentionally cleanup-only
- Manual production promotion gate — original 2026-04-27 plan; reality is auto-deploy and that's been working. No change
- Server-side rate limiting on the proxy Functions — client already enforces 200ms spacing for EDHREC. Add only if abuse / runaway-loop telemetry demands it
- Server-side caching on the proxy Functions — Vercel's default behavior is sufficient; client (Dexie + meta table) already caches synergies (7d TTL) and Top-Salt map (7d TTL)
- Edge runtime for the proxy Functions — Fluid Compute / Node.js per Vercel platform default. Edge runtime explicitly NOT used (deprecated for new work per platform note)

## Traceability

| REQ-ID | Phase |
|--------|-------|
| PROXY-01 | Phase 15 |
| PROXY-02 | Phase 15 |
| PROXY-03 | Phase 15 |
| PROXY-04 | Phase 15 |
| PROXY-05 | Phase 15 |
| UAT-01 | Phase 16 |
| UAT-02 | Phase 16 |
| UAT-03 | Phase 16 |

### Coverage by Phase

| Phase | Name | REQ Count | Categories Covered |
|-------|------|-----------|--------------------|
| 15 | EDHREC CORS Proxy | 5 | PROXY (5) |
| 16 | Live-Environment UAT Pass | 3 | UAT (3) |
| **Total** | | **8** | **All 2 categories** |

---
*Last updated: 2026-04-28 — Phase 15 discuss-phase folded Spellbook proxy parity into PROXY-01..05 and reframed PROXY-04 to enforce the existing 300 KB gz main-bundle budget. PROXY-* requirements now cover both EDHREC and Spellbook (one phase, two services, same Vercel Function pattern).*
