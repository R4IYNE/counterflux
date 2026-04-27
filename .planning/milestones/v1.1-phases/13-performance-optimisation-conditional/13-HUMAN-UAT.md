---
status: partial
phase: 13-performance-optimisation-conditional
source: [13-VERIFICATION.md]
started: 2026-04-22
updated: 2026-04-22
---

## Current Test

[awaiting human testing — items below can only be verified in live environments, not local headless]

## Tests

### 1. Soft-gate fires on a real pull request
expected: When a PR to main/master modifies one of the watched paths (`src/**`, `vite.config.js`, `vercel.json`, `index.html`, `lighthouserc.cjs`, `scripts/assert-bundle-budget.js`, `.github/workflows/perf-soft-gate.yml`), the `perf-soft-gate` workflow runs on GitHub Actions, runs `@lhci/cli@0.15.1 autorun`, surfaces any warn-level Web Vitals failures via `$GITHUB_STEP_SUMMARY` as a markdown table in the PR Checks tab, and exits 0 (does not block the merge queue). Local dry-run verified the summary formatter + exit-code invariants in `13-SOFT-GATE-DRYRUN.md`, but the trigger path itself (event filter, paths filter, `continue-on-error` honouring, `$GITHUB_STEP_SUMMARY` rendering in the GitHub UI) cannot be exercised locally.
verify_by: Open a throwaway PR that edits one of the watched files (e.g. add a comment to `vite.config.js`). Confirm the `perf-soft-gate` job appears in the Checks tab, completes, and — even if an assertion warns — the PR stays mergeable.
result: [pending]

### 2. Vercel production deploy serves Cache-Control: no-cache on /index.html and /
expected: `vercel.json` declares `Cache-Control: no-cache` headers on `/` and `/index.html`. A live Vercel deployment (preview or production) must actually emit those headers. Pitfall 15 end-to-end recovery (stale chunk 404 → preloadError handler catches → soft-reload → new chunks load) depends on returning users fetching fresh chunk references immediately after a deploy — which requires the index.html response to NOT be served from a CDN cache.
verify_by: After the next Vercel deploy of the v1.1 build, run `curl -sI https://<preview-or-prod-url>/` and `curl -sI https://<url>/index.html` — both responses should include `cache-control: no-cache` (or an equivalent header that prevents CDN caching of the index document). Cross-check with the Pitfall 15 recovery flow: sign in to the live deploy, keep session open, then deploy a new build, then trigger a route change in the original tab — the app should either load the new chunks cleanly OR the preloadError handler should fire and soft-reload (no blank screen).
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

None — both items are live-environment verifications, not gaps.
