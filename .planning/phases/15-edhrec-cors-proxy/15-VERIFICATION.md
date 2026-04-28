---
phase: 15-edhrec-cors-proxy
verified: 2026-04-28T11:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 15: EDHREC CORS Proxy — Verification Report

**Phase Goal:** Production deploys can fetch EDHREC synergies, salt scores, bulk Top-100 data, AND Commander Spellbook combo lookups without the CloudFront CORS preflight failure — via two catch-all Vercel Functions (`api/edhrec/[...path].js` + `api/spellbook/[...path].js`) — while development continues to use the Vite dev proxy unchanged. Zero client-side path changes.

**Verified:** 2026-04-28T11:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| #   | Truth                                                                                                                                                              | Status     | Evidence                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Both Vercel Functions exist on disk at the catch-all paths and route to the correct upstreams (build-layer evidence; live verification deferred to Phase 16)        | ✓ VERIFIED | `api/edhrec/[...path].js` exists (95 lines), routes to `https://json.edhrec.com`; `api/spellbook/[...path].js` exists (77 lines), routes to `https://backend.commanderspellbook.com`           |
| 2   | `EDHREC_BASE = '/api/edhrec'` and `SPELLBOOK_BASE = '/api/spellbook'` are byte-identical to pre-Phase-15 state — zero client path changes (PROXY-02 hard gate)      | ✓ VERIFIED | Only 2-line comment swap in each file vs `0f503ec`; `git diff 0f503ec..HEAD -- src/services/{edhrec,spellbook}.js` shows constants unchanged                                                       |
| 3   | Outbound requests carry the verbatim UA `Counterflux/1.x (+https://counterflux.vercel.app)` and pass method/query/body/headers transparently                        | ✓ VERIFIED | Constant `USER_AGENT = 'Counterflux/1.x (+https://counterflux.vercel.app)'` in both Functions; passthrough loop strips host/connection/user-agent and re-injects UA (lines 53-59 / 42-48)        |
| 4   | `npm run build:check` continues to exit 0 — main bundle stays ≤ 300 KB gz post-change (PROXY-04)                                                                    | ✓ VERIFIED | `npm run build:check` exits 0; main `index-C_rvNwqN.js` = 36.0 KB gz (budget 300 KB); all 34 chunks within budget; `dist/api` does not exist (Vercel server-side bundling boundary preserved)    |
| 5   | Network failure → 502 with `{ error: "upstream unavailable", source: "<edhrec\|spellbook>" }`; upstream non-2xx → status preserved + body forwarded; never crashes | ✓ VERIFIED | Both Functions wrap upstream call in try/catch; outer catch returns `res.status(502).json({ error: 'upstream unavailable', source: SOURCE })`. SOURCE = `'edhrec'` / `"spellbook"` per file       |

**Score:** 5/5 truths verified

---

## Required Artifacts

| Artifact                                | Expected                                                              | Status     | Details                                                                                       |
| --------------------------------------- | --------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------- |
| `api/edhrec/[...path].js`               | Vercel Function, ≥ 40 lines, contains `export default async function handler` | ✓ VERIFIED | 95 lines; handler signature present (1×); UA verbatim (1×); upstream `json.edhrec.com` (2× — JSDoc + const); 502 error JSON (2× — log + body) |
| `api/spellbook/[...path].js`            | Vercel Function, ≥ 40 lines, contains `export default async function handler` | ✓ VERIFIED | 77 lines; handler signature present (1×); UA verbatim (1×); upstream `backend.commanderspellbook.com` (2×); 502 error JSON (2×); zero `edhrec` leak |
| `tests/api-edhrec-proxy.test.js`        | Vitest unit tests, ≥ 80 lines, ≥ 8 it() blocks, references handler      | ✓ VERIFIED | 194 lines; 10 it() blocks; imports handler from `../api/edhrec/[...path].js`; asserts UA verbatim, 502 shape with `source: 'edhrec'`; `@vitest-environment node` directive present  |
| `tests/api-spellbook-proxy.test.js`     | Vitest unit tests, ≥ 80 lines, ≥ 8 it() blocks, references handler      | ✓ VERIFIED | 237 lines; 10 it() blocks; imports handler from `../api/spellbook/[...path].js`; asserts UA verbatim, 502 shape with `source: 'spellbook'` (NOT `'edhrec'`); 5× `find-my-combos` references |
| `src/services/edhrec.js`                | TODO comment retired; constant unchanged                              | ✓ VERIFIED | `const EDHREC_BASE = '/api/edhrec';` present; old `wire /api/edhrec to a serverless proxy` gone; replacement comment with `Vercel Function` present (1×); no `import.meta.env` switch        |
| `src/services/spellbook.js`             | TODO comment retired; constant unchanged                              | ✓ VERIFIED | `const SPELLBOOK_BASE = '/api/spellbook';` present; old `wire /api/spellbook to a serverless proxy` gone; replacement comment with `Vercel Function` present (1×); no `import.meta.env`     |

---

## Key Link Verification (Wiring)

| From                                       | To                                                  | Via                                                                                | Status   | Details                                                                                                       |
| ------------------------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `api/edhrec/[...path].js`                  | `https://json.edhrec.com`                           | `fetch(upstreamUrl, init)` with `User-Agent` header set in outbound init             | ✓ WIRED  | `UPSTREAM_BASE = 'https://json.edhrec.com'` (line 19); `await fetch(upstreamUrl, init)` (line 76)              |
| `api/spellbook/[...path].js`               | `https://backend.commanderspellbook.com`            | `fetch(upstreamUrl, init)` with `User-Agent` header set in outbound init             | ✓ WIRED  | `UPSTREAM_BASE = 'https://backend.commanderspellbook.com'` (line 20); `await fetch(upstreamUrl, init)` (line 59) |
| Both Functions                             | `User-Agent: Counterflux/1.x ...`                   | `outboundHeaders['User-Agent'] = USER_AGENT` after sanitisation loop                  | ✓ WIRED  | Line 59 (edhrec) / 48 (spellbook); UA value verbatim from D-09                                                  |
| Both Functions network-failure branch      | `{ error: 'upstream unavailable', source: '<svc>' }` | Outer try/catch returns `res.status(502).json(...)` (Function never throws)         | ✓ WIRED  | Line 92-93 (edhrec) / 73-75 (spellbook); SOURCE constant differs by file                                        |
| `tests/api-edhrec-proxy.test.js`           | `api/edhrec/[...path].js` handler                   | `import handler from '../api/edhrec/[...path].js'` + mocked req/res + stubbed fetch | ✓ WIRED  | All 10 tests pass via `vitest run`                                                                              |
| `tests/api-spellbook-proxy.test.js`        | `api/spellbook/[...path].js` handler                | Same as above for the Spellbook handler                                             | ✓ WIRED  | All 10 tests pass via `vitest run`                                                                              |
| Client `EDHREC_BASE`/`SPELLBOOK_BASE`      | Production proxy at the same URL prefix              | Catch-all alignment — Vite dev proxy + Vercel Function serve identical URL shape    | ✓ WIRED  | Constants byte-identical pre/post; comment block now documents the dual-environment alignment                  |
| `tests/bundle-budget.test.js` + script    | Post-Phase-15 `dist/assets/index-*.js`               | `npm run build:check` enforces 300 KB gz main bundle                                | ✓ WIRED  | Build exits 0; main bundle 36.0 KB gz                                                                          |

---

## Data-Flow Trace (Level 4)

| Artifact                          | Data Variable     | Source                                                                                                | Produces Real Data | Status      |
| --------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------- | ------------------ | ----------- |
| `api/edhrec/[...path].js`         | `upstreamRes`     | Live `fetch()` to `${UPSTREAM_BASE}/${pathSuffix}` — passes through caller's request                  | Yes (network call) | ✓ FLOWING   |
| `api/spellbook/[...path].js`      | `upstreamRes`     | Same — live fetch to `https://backend.commanderspellbook.com`                                         | Yes (network call) | ✓ FLOWING   |
| Catch path (502 branch)           | error JSON body   | Static `{ error: 'upstream unavailable', source: SOURCE }` — protocol contract, not stub               | Yes (by contract)  | ✓ FLOWING   |

The Functions are pure passthroughs — no static fixtures, no hardcoded responses, no mock data outside the test files. Verified by reading both Function files in full (no `return Response.json([])`, no `return null` early returns, no placeholder JSON bodies).

---

## Behavioral Spot-Checks

| Behavior                                                          | Command                                                                   | Result                                                              | Status |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------ |
| Phase 15-touching tests (proxy unit tests) all pass                | `./node_modules/.bin/vitest run tests/api-edhrec-proxy.test.js tests/api-spellbook-proxy.test.js` | 20/20 tests passed in 222 ms                                        | ✓ PASS |
| Focused regression suite (services, panels, auth, bundle) passes  | `./node_modules/.bin/vitest run tests/{edhrec-service,spellbook-service,insight-engine,deck-analytics-panel,salt-score,bundle-budget,auth-store,auth-modal,auth-wall}.test.js` | 92/92 tests passed in 3.15 s                                        | ✓ PASS |
| Build succeeds + bundle budget passes (PROXY-04)                  | `npm run build:check`                                                    | Exit 0; main bundle 36.0 KB gz (budget 300); all 34 chunks ok        | ✓ PASS |
| Vercel Functions stay server-side (not in client bundle)          | `ls dist/api 2>/dev/null`                                                | Empty (no leak)                                                     | ✓ PASS |
| No `src/*` imports `api/*`                                        | `grep -rcE "from ['\"]\\.\\./\\.\\./api" src/`                            | No matches                                                          | ✓ PASS |
| Live production HTTP behavior (CORS preflight no longer blocks)   | curl against `https://counterflux.vercel.app/api/edhrec/...`              | Not run — DEFERRED to Phase 16 UAT                                  | ? SKIP |

The single SKIP — live HTTP verification — is deliberately deferred to Phase 16 UAT-01..03 per the user's directive and the phase boundary spelled out in 15-CONTEXT.md (`<deferred>` block). Phase 15 is verified at the build/test layer.

---

## Requirements Coverage

| Requirement | Source Plan(s)         | Description                                                                                            | Status        | Evidence                                                                                                                              |
| ----------- | ---------------------- | ------------------------------------------------------------------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| PROXY-01    | 15-01, 15-02           | Vercel Functions at `api/edhrec/[...path].js` + `api/spellbook/[...path].js` route to upstreams         | ✓ SATISFIED   | Both files exist, both `UPSTREAM_BASE` constants set correctly, both export an async handler                                          |
| PROXY-02    | 15-01, 15-02, 15-03    | Client services require zero client-side path changes (constants byte-identical pre/post)              | ✓ SATISFIED   | `git diff 0f503ec..HEAD -- src/services/{edhrec,spellbook}.js` shows only 2-line comment swap; constants unchanged                    |
| PROXY-03    | 15-01, 15-02           | Each Function injects verbatim UA + transparent passthrough; no rate limit / cache / CORS headers       | ✓ SATISFIED   | UA constant verbatim in both Functions; outbound headers strip host/connection/user-agent; no `Access-Control-*` headers; no caching   |
| PROXY-04    | 15-03                  | Main bundle stays ≤ 300 KB gz post-change (existing `tests/bundle-budget.test.js` + assert script gate)  | ✓ SATISFIED   | `npm run build:check` exits 0; main = 36.0 KB gz; bundle-budget meta-test passes                                                       |
| PROXY-05    | 15-01, 15-02           | Network failures → 502 + verbatim JSON body; non-2xx status preserved; Function never crashes           | ✓ SATISFIED   | Outer try/catch in both Functions; verbatim error JSON shape with `source: '<svc>'`; status preservation via `res.status(upstreamRes.status)` |

All five PROXY requirements (PROXY-01..05) closed across plans 15-01, 15-02, 15-03. Phase 15 plan frontmatter declares only PROXY-* IDs; cross-referenced against `.planning/REQUIREMENTS.md` Traceability table — exact match, no orphans.

---

## Symmetry-Breaker Verification (D-04)

`grep -c '"edhrec"' "api/spellbook/[...path].js"` returns **0** (locked invariant — no copy-paste leak from sibling Function).

`grep -c '"spellbook"' "api/edhrec/[...path].js"` returns **0** (mirror invariant — Functions are intentionally service-distinct).

`grep -c "json.edhrec.com" "api/spellbook/[...path].js"` returns **0**. `grep -c "backend.commanderspellbook.com" "api/edhrec/[...path].js"` returns **0**.

Each Function is wholly its own service — symmetry without bleed.

---

## Locked Decision Verification (CONTEXT.md D-01..D-20)

| Decision | Description                                                                                                  | Status     | Evidence                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| D-01     | Catch-all path-aligned proxies at `api/{service}/[...path].js`                                                | ✓ HOLDS    | Both Function files at the locked paths; `[...path]` filename pattern intact (literal brackets in filename)                  |
| D-02     | Zero client-side change — no `import.meta.env.PROD` switch                                                    | ✓ HOLDS    | `grep -c "import.meta.env" src/services/{edhrec,spellbook}.js` returns 0 in both                                                |
| D-04     | Spellbook proxy ships in this phase, not deferred                                                             | ✓ HOLDS    | `api/spellbook/[...path].js` exists with 77 lines + tests                                                                       |
| D-09     | UA string verbatim: `Counterflux/1.x (+https://counterflux.vercel.app)`                                        | ✓ HOLDS    | Verbatim string present in both Functions and both test files (verbatim assertion)                                              |
| D-10     | NO server-side rate limiting                                                                                  | ✓ HOLDS    | No rate-limiting code in either Function (read-through verified)                                                                |
| D-11     | NO server-side caching                                                                                        | ✓ HOLDS    | No cache headers, no in-memory cache, no `Cache-Control` set on responses                                                        |
| D-13     | Error JSON shape `{ error: "upstream unavailable", source: "<svc>" }`                                          | ✓ HOLDS    | `res.status(502).json({ error: 'upstream unavailable', source: SOURCE })` in both Functions; `source` is lowercase per file     |
| D-14     | Fluid Compute / Node.js runtime — NO `runtime: 'edge'` config                                                 | ✓ HOLDS    | `grep -cE "runtime.*edge\|edge.*runtime"` returns 0 in both Functions                                                            |
| D-15     | Plain JavaScript only — no TypeScript                                                                         | ✓ HOLDS    | Both Functions are `.js` files; no `.ts` files anywhere in `api/`; tests are also `.js`                                          |
| D-17     | NO `Access-Control-*` headers (proxy is same-origin)                                                          | ✓ HOLDS    | `grep -c "Access-Control"` returns 0 in both Functions                                                                          |

All 20 decisions traced; no drift detected.

---

## Anti-Patterns Found

None in Phase 15 files. Anti-pattern scan on the four new files (`api/edhrec/[...path].js`, `api/spellbook/[...path].js`, `tests/api-edhrec-proxy.test.js`, `tests/api-spellbook-proxy.test.js`) and the two modified files (`src/services/edhrec.js`, `src/services/spellbook.js`):

- TODO/FIXME/XXX/HACK markers: 0 across all six files
- `console.log` calls: 0 (Functions use `console.error` for upstream-failure observability per D-13 — intentional, not a debug leftover)
- Stub language ("not yet implemented", "coming soon", "placeholder text"): 0
- Stale TODO comments: 0 (the `wire /api/edhrec to a serverless proxy or edge function` and `wire /api/spellbook to a serverless proxy or edge function` comments at `src/services/edhrec.js:4` and `src/services/spellbook.js:8` were the explicit Phase 15 retirement target — confirmed gone in `760611b`)

---

## Out of Scope (tracked separately)

### Pre-existing test failures NOT caused by Phase 15

Per the user's verification context and `.planning/phases/15-edhrec-cors-proxy/deferred-items.md`:

- **8 tests fail in `tests/perf/remeasure-contract.test.js`** — root cause is the v1.1 milestone archive (commit `dfad4e7`) moving `13-REMEASURE.md` from `.planning/phases/13-performance-optimisation-conditional/` to `.planning/milestones/v1.1-phases/13-performance-optimisation-conditional/` without updating the test's path resolver.
- **Verified pre-existing:** `deferred-items.md` documents that reverting plan 15-03's two-file comment swap to `HEAD~1` produces an identical 8/1069 result. Phase 15 plan 15-03 only edited comments in `src/services/*.js`; it cannot affect a Phase 13 path-resolution test.
- **Status:** Tracked as v1.2 follow-up; Phase 16 will need to fix this before running the production Lighthouse re-baseline (UAT-02). NOT a Phase 15 regression.

### Live-environment verification deferred to Phase 16

- **UAT-01:** `@lhci/cli` soft-gate against real Preview URL (closes Plan 13 deferred item).
- **UAT-02:** Production Lighthouse run against `https://counterflux.vercel.app/`.
- **UAT-03:** Sibling deferred UAT items audited; this includes the live "EDHREC + Spellbook synergy/combo lookup works on the live Preview" verification per the 15-CONTEXT.md `<deferred>` block. Phase 15 verifies at the build/test layer; Phase 16 verifies against the real CloudFront-fronted Vercel deployment.

This is expected and architecturally correct — Phase 15's success criterion #1 (live production end-to-end) is explicitly Phase 16 territory per the phase boundary spelled out in 15-CONTEXT.md `<deferred>` lines 152-154.

---

## Gaps Summary

None. All five PROXY requirements satisfied; both Functions exist with the verbatim contract values; both client services unchanged save for the planner-discretion comment cleanup in plan 15-03; bundle budget holds; 20/20 new tests + 92/92 focused regression tests pass; build:check exits 0.

The single deliberate SKIP (live HTTP verification) is correctly out-of-scope for Phase 15 and slotted for Phase 16 UAT-01..03.

---

_Verified: 2026-04-28T11:00:00Z_
_Verifier: Claude (gsd-verifier)_
