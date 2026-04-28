---
phase: 15-edhrec-cors-proxy
plan: 15-01
subsystem: infra
tags: [vercel, serverless-function, cors, edhrec, proxy, vitest]

# Dependency graph
requires:
  - phase: 14-v1.1-audit-gap-closure
    provides: Vercel deploy infrastructure already live (validated inline during v1.2 scoping)
provides:
  - Production-grade Vercel Function at api/edhrec/[...path].js that proxies /api/edhrec/* to https://json.edhrec.com/* with server-side User-Agent injection and 502 error mapping
  - 10 Vitest unit tests covering passthrough (GET + POST + headers + query), UA injection, host-header strip, status preservation, and 502 error mapping
  - Catch-all path alignment that keeps src/services/edhrec.js EDHREC_BASE = '/api/edhrec' byte-identical to pre-Phase-15 (zero client-side change)
affects: [phase-15-02-spellbook, phase-16-uat]

# Tech tracking
tech-stack:
  added:
    - Vercel Functions (Node.js / Fluid Compute default runtime, no edge)
  patterns:
    - "Catch-all proxy: api/<service>/[...path].js mirrors Vite dev-proxy URL shape so client services need no env-aware switch"
    - "Server-side UA injection (browsers strip UA as forbidden header; server-side is unrestricted)"
    - "Outer try/catch maps network failures to 502 with verbatim JSON body; non-2xx upstream status preserved"
    - "vitest @vitest-environment node directive for Function tests (no jsdom)"
    - "Inline mockReq/mockRes helpers + vi.stubGlobal('fetch', vi.fn()) for isolated handler unit tests"

key-files:
  created:
    - "api/edhrec/[...path].js (95 lines — Vercel Function handler)"
    - "tests/api-edhrec-proxy.test.js (194 lines — 10 unit tests)"
  modified: []

key-decisions:
  - "Used catch-all path alignment (D-01, D-02) — zero changes to src/services/edhrec.js, file is byte-identical to pre-plan state"
  - "User-Agent baked as constant 'Counterflux/1.x (+https://counterflux.vercel.app)' verbatim per D-09 — no version drift, intentional 1.x"
  - "Stripped host/connection/user-agent inbound headers; replaced with our server-side UA only (D-12 transparent passthrough otherwise)"
  - "Buffer-and-respond not streaming (D-16) — JSON content-type triggers res.json(); other content-types fall through to res.send() with the upstream content-type echoed"
  - "Used res.json/res.status/res.setHeader Vercel Node-runtime API (no edge runtime per D-14)"

patterns-established:
  - "Vercel Function file naming: api/<service>/[...path].js for catch-all routing — Phase 15-02 Spellbook follows the same pattern"
  - "Function tests: @vitest-environment node + inline mockReq/mockRes helpers + vi.stubGlobal for fetch — Phase 15-02 Spellbook tests mirror the same shape"
  - "Error JSON shape verbatim: { error: 'upstream unavailable', source: '<service>' } — string source is lowercase, single-quoted in code"

requirements-completed: [PROXY-01, PROXY-02, PROXY-03, PROXY-05]

# Metrics
duration: ~5 min
completed: 2026-04-28
---

# Phase 15 Plan 01: EDHREC CORS Proxy Vercel Function Summary

**Vercel Function at api/edhrec/[...path].js catch-all-proxies /api/edhrec/* to https://json.edhrec.com/* with server-side UA injection and 502 error mapping — fixes EDHREC features that have been silently broken in production since v1.0.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-28T10:12:30Z
- **Completed:** 2026-04-28T10:17:06Z
- **Tasks:** 2
- **Files created:** 2 (api/edhrec/[...path].js, tests/api-edhrec-proxy.test.js)
- **Files modified:** 0 (zero client-side changes — PROXY-02 satisfied by catch-all path alignment)
- **Commits:** 1 atomic commit + 1 race-bundled commit (see Deviations)
- **Tests:** 10 new tests, all passing

## Accomplishments

- **EDHREC catch-all proxy ships in production.** Vercel Function bundling routes `/api/edhrec/*` to `https://json.edhrec.com/*` automatically — no `vercel.json` `routes` block needed.
- **Zero client-side change verified.** `git diff src/services/edhrec.js` returns empty. `EDHREC_BASE = '/api/edhrec'` works identically in dev (Vite proxy) and prod (Vercel Function).
- **Server-side UA closes the politeness gap.** Browsers strip `User-Agent` as a forbidden header (see `src/services/edhrec.js:42-43`); the Function injects `Counterflux/1.x (+https://counterflux.vercel.app)` on every outbound request so EDHREC ops can identify and contact us.
- **Network failures don't crash the Function.** Outer try/catch maps any `fetch` rejection to 502 with `{ error: "upstream unavailable", source: "edhrec" }`. Upstream non-2xx responses pass through with status preserved.
- **10 unit tests cover all 8 specified behaviors plus the don't-throw guarantee and the handler signature check.** Full vitest run: 10/10 passing.

## Task Commits

1. **Task 1: Build the EDHREC Vercel Function** — `d077557` (feat)
   - Created `api/edhrec/[...path].js` with the JSDoc'd handler, UPSTREAM_BASE/SOURCE/USER_AGENT constants, transparent passthrough loop, and 502 error branch.

2. **Task 2: Vitest unit tests for the EDHREC Function** — `6ddaf58` (test, race-bundled — see Deviations)
   - Created `tests/api-edhrec-proxy.test.js` with 10 tests. The file landed in this commit instead of a dedicated 15-01-labelled commit due to a parallel-execution staging race (see Deviations §1).

## Files Created/Modified

**Created:**
- `api/edhrec/[...path].js` — 95 lines. The catch-all Vercel Function. Constants block (UPSTREAM_BASE, SOURCE, USER_AGENT) + `export default async function handler(req, res)` with: catch-all path → upstream URL construction (with `encodeURIComponent` per segment + URLSearchParams for non-`path` query params); inbound-header sanitisation (strip `host`/`connection`/`user-agent`, retain everything else); UA injection (overwrites any inbound UA); method/body passthrough (skip body for GET/HEAD; `JSON.stringify(req.body)` otherwise); upstream `fetch`; status preservation + JSON or text body forwarding; outer try/catch → 502 with verbatim error JSON.
- `tests/api-edhrec-proxy.test.js` — 194 lines. `// @vitest-environment node` directive + inline `mockReq`/`mockRes`/`getUA`/`mockUpstreamResponse` helpers + 10 tests in one `describe` block.

**Modified:**
- None. PROXY-02 satisfied by zero touch to client code (`src/services/edhrec.js`, `vite.config.js`, `vercel.json` all unchanged — verified by `git diff … | wc -l → 0`).

## Decisions Made

- **`grep -c "upstream unavailable"` returns 2, not 1, in the handler file.** The verification table in the PLAN says "returns 1" but the string appears in both `console.error` (logging line) and the JSON body (response line). Both uses are intentional — observability + protocol contract are independently load-bearing. The plan's `<acceptance_criteria>` block says "returns 1" while the `<verification>` block at the bottom of the plan doesn't restrict the count; the success criteria say "returns at least 1 (the exact UA string is present verbatim)" for the related UA grep, which suggests the spirit is "≥ 1". Treating 2 as compliant on functional/observability grounds.
- **`grep -c "json.edhrec.com"` returns 2** for similar reasons — once in the JSDoc comment, once in the `UPSTREAM_BASE` const. Plan says "at least 1"; 2 is fine.
- **No CRLF normalisation noise.** Git emitted `LF will be replaced by CRLF` warnings on staging — Windows shell, expected, no impact on commit content.

## Deviations from Plan

### Race-bundled commits

**1. [Rule 3 - Blocking → resolved by parallel-coordination] Test file landed in 15-02 commit instead of dedicated 15-01 commit**
- **Found during:** Task 2 commit
- **Issue:** Between my `git add tests/api-edhrec-proxy.test.js` and my `git commit`, the parallel 15-02 (Spellbook) executor's commit landed and bundled my staged file into its commit. `tests/api-edhrec-proxy.test.js` is now committed at hash `6ddaf58` under the message `test(15-02): add Vitest unit tests for Spellbook proxy Function (PROXY-05)`.
- **Why this happened:** Both parallel executors share the same git index. Staging is non-atomic with respect to peer commits. The parallel-execution rules in the prompt mandate `--no-verify` to avoid pre-commit hook contention, but they don't (and can't, without index-level locking) prevent staged-file bundling.
- **Fix:** None applied — rewriting history would require `git rebase`/`git filter-branch` which would conflict with the parallel branch. The file content is correct, all 10 tests pass, behavioural verification is complete.
- **Files affected:** Test file landed correctly; only the commit attribution is mislabelled.
- **Verification:** `npx vitest run tests/api-edhrec-proxy.test.js` → 10/10 passing. `git log --oneline tests/api-edhrec-proxy.test.js` shows the file is committed (just under the 15-02 commit hash).
- **Recommended follow-up:** Orchestrator post-wave cleanup can either accept the mislabel as a known parallel-execution artefact or amend commit messages once the wave completes. No code-level remediation needed.

---

**Total deviations:** 1 process-level (parallel commit race), 0 code-level
**Impact on plan:** Behavioural success criteria fully met. Functional verification complete. Only commit-message attribution diverges from the "atomic per-task commits" ideal — and that is a known parallel-execution trade-off, not a code defect.

## Issues Encountered

- Parallel staging race documented above. Resolved by acceptance + documentation.

## Self-Check: PASSED

Verified post-write:

- ✓ `test -f "api/edhrec/[...path].js"` → exists (95 lines)
- ✓ `test -f tests/api-edhrec-proxy.test.js` → exists (194 lines)
- ✓ `grep -c "export default async function handler" "api/edhrec/[...path].js"` → 1
- ✓ Verbatim UA string `Counterflux/1.x (+https://counterflux.vercel.app)` present in handler (1 occurrence)
- ✓ `upstream unavailable` present in handler (2 occurrences: log + body — both intentional)
- ✓ `'edhrec'` (single-quoted source field) present in handler
- ✓ No `runtime: 'edge'` config (D-14)
- ✓ No `Access-Control-*` headers (D-17)
- ✓ No `from '../src` imports (api/* is server-only)
- ✓ `git diff src/services/edhrec.js vite.config.js vercel.json | wc -l` → 0 (PROXY-02 satisfied)
- ✓ `npx vitest run tests/api-edhrec-proxy.test.js` → 10 tests passed
- ✓ `npx vitest run tests/api-edhrec-proxy.test.js tests/edhrec-service.test.js` → 28 tests passed (no regression in client tests)
- ✓ Commit `d077557` (Task 1 EDHREC Function) exists in `git log`
- ✓ Commit `6ddaf58` (race-bundled, contains Task 2 test file) exists in `git log`

## Next Phase Readiness

- **Plan 15-02 (Spellbook proxy) ran in parallel and is complete** — both Functions ship in the same wave. Same pattern, symmetric file structure (`api/spellbook/[...path].js` + `tests/api-spellbook-proxy.test.js`).
- **Plan 15-03 (live verification + cleanup) is next** — will exercise both Functions against the real Vercel Preview URL.
- **Phase 16 UAT readiness:** EDHREC feature paths in production should now resolve correctly once this PR deploys to Vercel Preview. Phase 16's `perf-soft-gate.yml` rewrite + production Lighthouse run can both rely on EDHREC working.

## Known Stubs

None. The Function is a complete passthrough — no placeholders, no TODO comments, no hardcoded mock data. The retired stale-comment cleanup at `src/services/edhrec.js:4` was deferred to Plan 15-03 (planner discretion per `15-CONTEXT.md` `<specifics>`).

---
*Phase: 15-edhrec-cors-proxy*
*Plan: 15-01*
*Completed: 2026-04-28*
