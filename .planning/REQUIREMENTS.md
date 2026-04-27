# Requirements: Counterflux v1.2 — Deploy the Gatewatch

**Defined:** 2026-04-27
**Core Value:** The deck builder knows what you own, and the collection knows what's in your decks — one interconnected data layer. Multi-device when signed in. Now production-deployable.
**Milestone Goal:** Make Counterflux production-deployable on Vercel by closing every v1.1 carry-over blocker. Pure cleanup — no new user-facing features.

> **Prior milestone:** v1.1 requirements archived at `.planning/milestones/v1.1-REQUIREMENTS.md`.

## v1.2 Requirements

### Vercel Deployment Infrastructure

- [ ] **DEPLOY-01**: Counterflux is linked to a Vercel project with this repo (`R4IYNE/counterflux`) as the build source
- [ ] **DEPLOY-02**: Supabase URL + anon key are configured as Vercel environment variables for both Production and Preview environments
- [ ] **DEPLOY-03**: Pull requests automatically build a Preview deployment with a unique URL; pushes to `master` are eligible for Production promotion (auto-deploy on push, or manual promotion — pipeline must work either way)
- [ ] **DEPLOY-04**: Production responses include `Cache-Control: no-cache` on the index document so the Pitfall §15 cache-bust + `vite:preloadError` recovery shipped in Phase 13 has the upstream cache header it depends on
- [ ] **DEPLOY-05**: Vercel build succeeds against the existing Vite/Rolldown config — no new build-tool migration. Bundle-budget tests (`tests/auth-bundle.test.js` and any sibling guards) stay green in CI
- [ ] **DEPLOY-06**: A `vercel.ts` or `vercel.json` configuration file is committed defining build command, output directory, framework hint, and any required headers/redirects (matching the Vercel platform's recommended project-config approach)

### EDHREC CORS Proxy

- [ ] **PROXY-01**: A Vercel Function at `/api/edhrec-proxy` proxies EDHREC API requests so production deploys can fetch synergies, salt scores, and bulk Top-100 data without the CloudFront CORS preflight failure that currently blocks production
- [ ] **PROXY-02**: The EDHREC service client (`src/services/intelligence-edhrec.js` or equivalent) routes through the Vite dev proxy in development and the Vercel Function in production, switching automatically based on `import.meta.env.PROD`
- [ ] **PROXY-03**: The proxy preserves the existing User-Agent header convention (`Counterflux/1.x`) and any rate-limit/spacing behavior already enforced client-side
- [ ] **PROXY-04**: Anonymous users still load zero proxy-related code in their initial bundle — parity with the lazy-load principle gated by `tests/auth-bundle.test.js`. A bundle-inspection test asserts the proxy/EDHREC path stays out of the initial chunk
- [ ] **PROXY-05**: The proxy surfaces upstream EDHREC errors and timeouts back to the client without crashing the function or leaking partial responses; existing intelligence-store error handling continues to work unchanged

### Live-Environment UAT Pass

- [ ] **UAT-01**: `@lhci/cli` soft-gate runs against a real Preview deployment URL (not just `vite preview` locally) on at least one PR and surfaces a status check or PR comment — closes the Plan 13 deferred item
- [ ] **UAT-02**: A Production Lighthouse run confirms the v1.1 perf budget holds post-deploy (LCP ≤ 2.5s, FCP ≤ 0.5s, CLS ≤ 0.1, Perf ≥ 85). Any drift triggers re-baseline of `.planning/PERF-BASELINE.md` with the new numbers and a regression analysis
- [ ] **UAT-03**: `phases/13-performance-optimisation/13-HUMAN-UAT.md` items are checked off with deploy-URL evidence (Cache-Control header present, soft-gate visibly fired). Sibling deferred UAT items in any other phase (e.g. live RLS verification on prod Supabase) are audited and either closed or explicitly carried to v1.3

### Codified Product Decisions

- [ ] **DECIDE-01**: The deferral comment in `phases/10-supabase-auth-foundation/10-CONTEXT.md:113` regarding public sign-up is removed and replaced with a "decision: household model only" note. The corresponding entry in PROJECT.md "Out of Scope" is updated to reflect this is a permanent product decision (not deferred). No new auth-wall UI changes
- [ ] **DECIDE-02**: Nyquist validation gate is disabled for v1.2 via `node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-set workflow.nyquist_validation false`. A v1.3 backlog item is planted (`.planning/seeds/SEED-002-nyquist-revisit.md`) capturing the trade-off so the gate can be re-enabled deliberately later if backfilling phases 7–14 is ever judged worth the time

## Future Requirements (deferred)

- 999.1 — MTGJSON Tokens.json "Required Tokens" tab in Thousand-Year Storm — parked. Re-evaluate at v1.3 with production-traffic data
- 999.2 — MTGJSON AllPrices.json historical price charts (collection + watchlist + recently-viewed) — parked. Re-evaluate at v1.3
- SEED-001 — Catalog/userdata storage split (wa-sqlite + OPFS for static catalog, Dexie for user data) — parked. Trigger: Phase 11 sync engine running in production for a meaningful window without regressions

## Out of Scope (v1.2)

- Public sign-up UI surface — explicit product decision codified in DECIDE-01: household model only, no public sign-up route, existing-account credentials remain the entry path
- Custom domain configuration (e.g. `counterflux.app`) — Vercel-assigned `*.vercel.app` URL is sufficient for v1.2. Custom domain is a separate decision the user can make post-deploy
- Backfilling Nyquist `VALIDATION.md` for phases 7–14 — DECIDE-02 disables the gate; backfilling 8 archived phases is process debt that returns no functional value when tests already exist
- Production analytics / observability stack (Vercel Analytics, Sentry, Logflare) — out of scope for v1.2; Web Vitals instrumentation already shipped in v1.1 covers core perf telemetry
- Edge runtime migration — Vercel platform note overrides any historical preference: Fluid Compute (Node.js) is the default and recommended runtime; do not introduce edge runtime constraints
- Promotion of any backlog item (999.1, 999.2, SEED-001) into v1.2 scope — milestone is intentionally cleanup-only
- Marketing site / landing page / public README polish — Counterflux remains a personal-collaborator tool; no public marketing surface in v1.2
- Vercel team/billing setup beyond the Hobby tier — Hobby is sufficient for expected EDHREC proxy traffic; upgrade only if real usage proves otherwise

## Traceability

| REQ-ID | Phase |
|--------|-------|
| DEPLOY-01 | Phase 15 |
| DEPLOY-02 | Phase 15 |
| DEPLOY-03 | Phase 15 |
| DEPLOY-04 | Phase 15 |
| DEPLOY-05 | Phase 15 |
| DEPLOY-06 | Phase 15 |
| DECIDE-01 | Phase 15 |
| DECIDE-02 | Phase 15 |
| PROXY-01 | Phase 16 |
| PROXY-02 | Phase 16 |
| PROXY-03 | Phase 16 |
| PROXY-04 | Phase 16 |
| PROXY-05 | Phase 16 |
| UAT-01 | Phase 17 |
| UAT-02 | Phase 17 |
| UAT-03 | Phase 17 |

### Coverage by Phase

| Phase | Name | REQ Count | Categories Covered |
|-------|------|-----------|--------------------|
| 15 | Vercel Foundation & Codified Decisions | 8 | DEPLOY (6), DECIDE (2) |
| 16 | EDHREC CORS Proxy | 5 | PROXY (5) |
| 17 | Live-Environment UAT Pass | 3 | UAT (3) |
| **Total** | | **16** | **All 4 categories** |

---
*Last updated: 2026-04-27 — v1.2 Deploy the Gatewatch traceability populated by gsd-roadmapper. 16 requirements mapped to 3 phases (15–17), 100% coverage, no orphans.*
