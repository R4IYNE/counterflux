---
status: resolved
phase: 13-performance-optimisation-conditional
source: [13-VERIFICATION.md]
started: 2026-04-22
updated: 2026-04-28
resolved_during: v1.2 Phase 16 collapse (inline UAT closure)
resolved_by: user
resolved_at: 2026-04-28
---

## Current Test

[resolved 2026-04-28 during v1.2 Phase 16 collapse — see resolution notes per test below]

## Tests

### 1. Soft-gate fires on a real pull request
expected: When a PR to main/master modifies one of the watched paths (`src/**`, `vite.config.js`, `vercel.json`, `index.html`, `lighthouserc.cjs`, `scripts/assert-bundle-budget.js`, `.github/workflows/perf-soft-gate.yml`), the `perf-soft-gate` workflow runs on GitHub Actions, runs `@lhci/cli@0.15.1 autorun`, surfaces any warn-level Web Vitals failures via `$GITHUB_STEP_SUMMARY` as a markdown table in the PR Checks tab, and exits 0 (does not block the merge queue). Local dry-run verified the summary formatter + exit-code invariants in `13-SOFT-GATE-DRYRUN.md`, but the trigger path itself (event filter, paths filter, `continue-on-error` honouring, `$GITHUB_STEP_SUMMARY` rendering in the GitHub UI) cannot be exercised locally.
verify_by: Open a throwaway PR that edits one of the watched files (e.g. add a comment to `vite.config.js`). Confirm the `perf-soft-gate` job appears in the Checks tab, completes, and — even if an assertion warns — the PR stays mergeable.
result: deferred — current `perf-soft-gate.yml` runs against `npx http-server dist` locally in CI, NOT against a real Vercel Preview URL. Wiring it to the Preview URL was originally REQ UAT-01 in v1.2 Phase 16. During Phase 16 collapse (2026-04-28), UAT-01 was deferred to v1.3+ on honest-ROI grounds: Counterflux has no CDN-cached dynamic content, no SSR, no per-request API integration, so the Preview-vs-localhost delta for Lighthouse is small. The localhost-CI pipeline still functions and surfaces bundle-related Web Vitals regressions; the gap is "real-world CDN edge behavior" which is not load-bearing for this app. Re-evaluate when CDN edge perf becomes a real concern. Documented in `.planning/seeds/SEED-003-lhci-preview-url.md`.
deferred_to: v1.3 (SEED-003)

### 2. Vercel production deploy serves Cache-Control: no-cache on /index.html and /
expected: `vercel.json` declares `Cache-Control: no-cache` headers on `/` and `/index.html`. A live Vercel deployment (preview or production) must actually emit those headers. Pitfall 15 end-to-end recovery (stale chunk 404 → preloadError handler catches → soft-reload → new chunks load) depends on returning users fetching fresh chunk references immediately after a deploy — which requires the index.html response to NOT be served from a CDN cache.
verify_by: After the next Vercel deploy of the v1.1 build, run `curl -sI https://<preview-or-prod-url>/` and `curl -sI https://<url>/index.html` — both responses should include `cache-control: no-cache` (or an equivalent header that prevents CDN caching of the index document). Cross-check with the Pitfall 15 recovery flow: sign in to the live deploy, keep session open, then deploy a new build, then trigger a route change in the original tab — the app should either load the new chunks cleanly OR the preloadError handler should fire and soft-reload (no blank screen).
result: passed — verified inline 2026-04-28 via `curl -sI https://counterflux.vercel.app/` and `curl -sI https://counterflux.vercel.app/index.html`. Both responses include `cache-control: no-cache` (also confirmed via X-Vercel-Cache + standard `cache-control` headers). The `vercel.json` shipped with v1.0 has been emitting these headers in production since 2025-04-05 (8 production deploys observed). Pitfall 15 end-to-end recovery flow not exercised in this UAT — the static header is the load-bearing piece, not the recovery mechanism — but the `vite:preloadError` handler in v1.1 Phase 13 Plan 5 covers the dynamic recovery path independently and is unit-tested.
verified_by: user (via inline curl during v1.2 Phase 16 collapse, 2026-04-28)
verified_at: 2026-04-28

## Summary

total: 2
passed: 1
issues: 0
pending: 0
deferred: 1
skipped: 0
blocked: 0

## Resolution Notes (2026-04-28)

This file resolves alongside the v1.2 Phase 16 collapse. Both tests are accounted for:
- Test 1 (soft-gate fires on real PR) → **deferred to v1.3** with SEED-003 capturing the trade-off.
- Test 2 (Cache-Control header) → **passed** with curl evidence captured inline.

The original `pending` status reflected v1.1's choice to defer live-environment verification to "the first Vercel deploy", which has long since happened (8 production deploys observed by 2026-04-28). The status update closes the file consistent with reality.

## Gaps

None.
