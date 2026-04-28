---
id: SEED-003
status: dormant
planted: 2026-04-28
planted_during: v1.2 Phase 16 collapse (UAT-01 deferral)
trigger_when: When CDN edge perf becomes a real concern, OR when introducing dynamic SSR / per-request API integration that diverges between Vercel Preview and `npx http-server dist` measurement contexts
scope: Small
---

# SEED-003: Wire @lhci/cli soft-gate to a real Vercel Preview URL

## Why This Matters

Today the `perf-soft-gate.yml` GitHub Action runs `npx --yes http-server dist -p 4173 -s &` and points `@lhci/cli@0.15.1` at `http://localhost:4173/`. That catches **bundle regressions** (chunk size, late-loaded code, expensive imports) but NOT **real-world infrastructure issues** (CDN edge cache behavior, real network conditions, Vercel-specific routing/headers, geographically-distributed first-byte latency).

The original v1.2 REQ UAT-01 wanted to swap the localhost target for the actual Vercel Preview URL of the PR being tested. During v1.2 Phase 16 collapse (2026-04-28), this requirement was **deferred to v1.3+** on honest-ROI grounds.

## The Honest-ROI Call (2026-04-28)

For Counterflux specifically, the Preview-vs-localhost delta is small because:
- **No CDN-cached dynamic content** — index.html ships `Cache-Control: no-cache`; all dynamic state lives in IndexedDB, fetched at runtime, not server-rendered.
- **No SSR** — the app is fully client-rendered. Vercel serves static assets; there's no server-side render step that could differ between Preview and localhost.
- **No per-request API integration** — Phase 15's EDHREC + Spellbook proxy Functions exist, but they make outbound calls to `json.edhrec.com` and `backend.commanderspellbook.com`, which are the same regardless of where Lighthouse runs from.
- **No geographically-distributed user concerns** — the user (James) is the primary measurement subject. Production Lighthouse run 2026-04-28 captured the actual UK-edge experience (`PERF-PROD-2026-04-28.md`).

So the `npx http-server dist` localhost run catches what actually matters (bundle shape) and the manual production Lighthouse run catches the rest. Wiring up the Preview-URL Lighthouse path would add CI complexity (Vercel deployment-status webhook polling OR third-party action OR custom URL discovery) for marginal additional information.

## When to Surface

**Trigger:** Any of these:
- A perf regression slips through localhost-LHCi but appears in production (i.e. the gap is real and bites us)
- Counterflux gains SSR, edge functions with significant cache behavior, or per-request server logic that would diverge between Preview and `http-server`
- A future milestone explicitly themed around "verify perf in real Vercel infrastructure"
- Vercel ships first-class LHCi tooling that makes the wiring trivial (e.g. native `vercel.ts` config block for performance assertions)

This seed should be presented during `/gsd:new-milestone` whenever the user's stated focus mentions perf-on-CDN, SSR, edge functions, or "test against real Vercel".

## Implementation Approach (when triggered)

Three viable paths, listed in order of complexity:

1. **GitHub Action with Vercel deployment-status webhook (simplest)** — Use Vercel's existing `deployment.ready` webhook to trigger a LHCi run after Preview build completes. Pass the deployed URL via webhook payload to a `workflow_dispatch` event in `perf-soft-gate.yml`. ~1 hour of YAML.
2. **Third-party action (`treosh/lighthouse-ci-action`)** — Drop in the popular community action that handles Vercel + Lighthouse + comment-on-PR. Faster setup, slightly less control, adds a third-party dependency to CI. ~30 min.
3. **Custom CLI script (most control)** — Write `scripts/wait-for-vercel.cjs` that polls Vercel's API for the latest Preview deployment of the current SHA and prints the URL; pipe to `lhci collect --url=$URL`. Most flexible but most ongoing maintenance.

When triggered, evaluate which path has the lowest marginal cost given Vercel's CI tooling at that time.

## Scope Estimate

**Small** — the underlying infrastructure (`@lhci/cli`, `lighthouserc.cjs`, `scripts/lhci-warn-summary.cjs`, `perf-soft-gate.yml`) is all already in place. The change is replacing `npx http-server dist -p 4173 -s &` + `lhci autorun` with `<wait for Vercel> + lhci collect --url=<vercel-preview-url>`. ~30 min – 2 hours depending on path chosen.

## Breadcrumbs

- `.github/workflows/perf-soft-gate.yml` — current localhost-LHCi workflow, lines 41-47 are the swap point
- `lighthouserc.cjs` lines 22-35 — `collect` block; `startServerCommand` + `url` would change to remove the local server and accept an external URL
- `scripts/lhci-warn-summary.cjs` — already framework-agnostic (reads `.lighthouseci/assertion-results.json`); no changes needed
- `.planning/milestones/v1.1-phases/13-performance-optimisation-conditional/13-CONTEXT.md` D-11 — soft-gate is intentionally `warn`-level only; never block merges. Any LHCi-on-Preview wiring must preserve this posture.
- `.planning/PERF-PROD-2026-04-28.md` — production Lighthouse run captured during v1.2 Phase 16 collapse, demonstrates production perf is well within budget. Worth re-running after this seed activates to confirm Preview-URL Lighthouse measures match.

## Notes

- **Anti-pattern to avoid:** error-level Lighthouse assertions in CI. The soft-gate is intentionally non-blocking per Phase 13 D-11. Whatever path activates this seed must keep `assertions: { ..., 'metric-name': ['warn', ...] }` and `continue-on-error: true` in the workflow.
- **Vercel Hobby tier** — current pricing has unlimited Preview deploys but limited build minutes (6000/month). Adding a Lighthouse run per PR adds ~30s × N PRs to the build budget. Probably fine even at v1.x scale, but check before adopting.
- **Lighthouse 12 vs 13 vs 14** — the `perf-soft-gate` workflow currently uses `@lhci/cli@0.15.1` which embeds a specific Lighthouse version. When this seed activates, decide whether to upgrade simultaneously or pin LHCi version.
- **Vercel's roadmap** — Vercel has been hinting at first-class perf assertions in vercel.ts/vercel.json. If they ship that before this seed triggers, the implementation may collapse to a few lines of config.
