---
phase: 15-edhrec-cors-proxy
plan: 15-02
subsystem: infra
tags: [vercel, vercel-functions, cors, spellbook, proxy, vanilla-js]

# Dependency graph
requires:
  - phase: 15-edhrec-cors-proxy
    provides: "Plan 15-01 EDHREC sibling Function — Plan 15-02 mirrors its structure exactly"
provides:
  - "Vercel Function at api/spellbook/[...path].js routing /api/spellbook/* to https://backend.commanderspellbook.com/* in production"
  - "Server-side User-Agent injection (Counterflux/1.x) on every outbound Spellbook request"
  - "Transparent passthrough of method/query/body/headers (excluding host/connection/UA)"
  - "502 error mapping with { error: 'upstream unavailable', source: 'spellbook' } on network failure"
  - "Status preservation on non-2xx upstream responses (no remap)"
  - "Vitest unit-test contract for the Function (10 tests covering POST/GET passthrough, UA injection, header strip, status preservation, network-failure mapping)"
affects: [phase-16-uat, intelligence-store, spellbook-service]

# Tech tracking
tech-stack:
  added: [Vercel Functions (api/* directory pattern, catch-all [...path] route)]
  patterns:
    - "Catch-all path-aligned proxy: same URL shape (/api/spellbook/*) in dev (Vite proxy) and prod (Vercel Function); zero client-side changes"
    - "Buffer-and-respond proxy (D-16): JSON payloads <200 KB; no streaming"
    - "Inline mock req/res helpers in test files (intentional duplication with Plan 15-01 sibling, matches CONTEXT.md guidance — symmetry over DRY for two test files)"

key-files:
  created:
    - "api/spellbook/[...path].js — 77-line catch-all Vercel Function"
    - "tests/api-spellbook-proxy.test.js — 237-line vitest unit tests (10 tests)"
  modified: []

key-decisions:
  - "SOURCE constant uses double-quoted string literal ('spellbook') so the source-of-truth grep for the symmetry-breaker (between EDHREC and Spellbook source values) finds it as written; the JSON output is identical regardless of quote style"
  - "Mock req/res helpers duplicated inline in test file rather than factored to tests/_helpers/ (per CONTEXT.md — duplication is intentional symmetry between the two parallel test files)"
  - "Used vi.stubGlobal('fetch', vi.fn()) pattern to match Plan 15-01's test file (alternative was global.fetch = fetchSpy from existing tests/spellbook-service.test.js — both work, picked vi.stubGlobal for cross-file symmetry)"

patterns-established:
  - "Vercel Function structure for the codebase: top-level constants for UPSTREAM_BASE/SOURCE/USER_AGENT, single async handler, outer try/catch with res.status(502).json on network failure, transparent passthrough otherwise"
  - "Test pattern for Vercel Functions: @vitest-environment node header, mockReq/mockRes helpers with case-insensitive header lookup helper, vi.stubGlobal('fetch') in beforeEach"

requirements-completed: [PROXY-01, PROXY-02, PROXY-03, PROXY-05]

# Metrics
duration: 16min
completed: 2026-04-28
---

# Phase 15 Plan 02: Spellbook CORS Proxy Summary

**Vercel Function at `api/spellbook/[...path].js` proxies `/api/spellbook/*` to `https://backend.commanderspellbook.com/*` with UA injection and 502 error mapping; 10 vitest unit tests verify POST passthrough, header handling, and the symmetry-breaker `source: "spellbook"` error contract**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-04-28T10:00:00Z (approx)
- **Completed:** 2026-04-28T10:16:33Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- Catch-all Vercel Function at `api/spellbook/[...path].js` (77 lines) routes the load-bearing POST `/find-my-combos` call (only client call site today, per `src/services/spellbook.js:37-48`) plus any future Spellbook endpoints to `https://backend.commanderspellbook.com/*` without code changes
- `User-Agent: Counterflux/1.x (+https://counterflux.vercel.app)` injected verbatim on every outbound request (D-09); browser-side UA stripping (forbidden header) is non-issue server-side
- Network failures (DNS/timeout/connection refused) return 502 with the verbatim error body `{ error: 'upstream unavailable', source: 'spellbook' }`; upstream non-2xx responses pass through with status preserved (D-12, D-13)
- 10 vitest unit tests cover: POST `/find-my-combos` body passthrough (load-bearing), GET path slug routing, GET no-body, query-string passthrough, UA injection (verbatim assertion), Content-Type passthrough, host-header strip with x-trace retention, status preservation on 500, 502 mapping with `source: 'spellbook'` symmetry-breaker, no-throw on fetch reject
- `src/services/spellbook.js` byte-identical to pre-plan state — `git diff src/services/spellbook.js` returned 0 lines, confirming PROXY-02 (zero client-side changes via catch-all path alignment)

## Task Commits

Each task was committed atomically (parallel-executor protocol: `--no-verify` per orchestrator instruction):

1. **Task 1: Build the Spellbook Vercel Function** — `7294f86` (feat)
2. **Task 2: Vitest unit tests** — `6ddaf58` (test)

## Files Created/Modified

- **`api/spellbook/[...path].js`** (created, 77 lines) — Vercel catch-all Function. Constants `UPSTREAM_BASE` / `SOURCE` / `USER_AGENT`; outer try/catch; URL builder reads `req.query.path` (Vercel catch-all conventions) + remaining query params; outbound headers strip host/connection/inbound-UA and inject our UA; body re-serialised via `JSON.stringify(req.body)` for non-GET/HEAD; `res.status(upstream.status)` preserves upstream status; JSON branch via `res.json()`, non-JSON via `res.send()` with content-type passthrough; catch maps to 502 + verbatim error JSON
- **`tests/api-spellbook-proxy.test.js`** (created, 237 lines) — 10 vitest tests. Inline `mockReq` / `mockRes` / `findHeaderCaseInsensitive` helpers; `@vitest-environment node`; `vi.stubGlobal('fetch', vi.fn())` in beforeEach; `vi.restoreAllMocks()` in afterEach. Symmetry-breaker assertion: `expect(res._body).toEqual({ error: 'upstream unavailable', source: 'spellbook' })` proves the error body uses `'spellbook'` not `'edhrec'`

## Decisions Made

- **SOURCE constant quoted with double quotes** — the locked acceptance criterion `grep -c '"spellbook"' "api/spellbook/[...path].js"` requires the literal `"spellbook"` (double-quoted) appears in the source. Initial implementation used single quotes (`'spellbook'`) which is JS-equivalent but failed the grep; flipped to double quotes for source-text compliance. Runtime JSON output is identical
- **Followed CONTEXT.md "Claude's Discretion" guidance:** kept the Function and tests as separate files duplicating the helper boilerplate from Plan 15-01 rather than factoring shared `api/_lib/proxy.js` or `tests/_helpers/` (CONTEXT.md: "Both are fine; planner picks duplicate for v1.2"). v1.3 refactor cost is cheap if it surfaces

## Deviations from Plan

None — plan executed exactly as written. The single SOURCE-quote-style adjustment described above happened mid-Task-1 before the commit landed and was the locked acceptance-criterion-driven path; treating it as part of normal task execution rather than a Rule-1 deviation since the task was not yet committed.

## Issues Encountered

- **Parallel-execution race on test commit (cosmetic):** `git commit` for Task 2 (Spellbook tests) swept up the parallel Plan 15-01 agent's `tests/api-edhrec-proxy.test.js` because that file was already staged in the index but not yet committed when this agent ran `git add tests/api-spellbook-proxy.test.js` followed by `git commit`. Result: commit `6ddaf58` is attributed to "test(15-02)" but contains both test files (431 lines total). The 15-01 agent will discover its file is already committed and skip its own commit step. Both files needed to land in `master` and now have. No corruption, no functional impact, no rework needed. Note for future parallel waves: when two agents touch `tests/`, prefer `git add` of the specific file followed by an immediate `git commit` with no other staging operations between.

## Self-Check: PASSED

- `api/spellbook/[...path].js` exists ✓
- `tests/api-spellbook-proxy.test.js` exists ✓
- Commit `7294f86` (feat Task 1) found in `git log` ✓
- Commit `6ddaf58` (test Task 2) found in `git log` ✓
- `npx vitest run tests/api-spellbook-proxy.test.js` exits 0 (10/10 pass) ✓
- `git diff src/services/spellbook.js` is empty (PROXY-02 evidence) ✓
- `grep -c '"edhrec"' "api/spellbook/[...path].js"` returns 0 (no copy-paste leak from Plan 15-01) ✓
- `grep -c "json.edhrec.com" "api/spellbook/[...path].js"` returns 0 ✓
- `grep -c "Access-Control" "api/spellbook/[...path].js"` returns 0 (D-17) ✓
- `grep -cE "runtime.*edge" "api/spellbook/[...path].js"` returns 0 (D-14) ✓

## User Setup Required

None — Vercel Functions deploy automatically on `master` push (DEPLOY-03 validated inline 2026-04-28). No env vars, no dashboard config. Live verification happens in Phase 16 UAT against the real Preview URL.

## Next Phase Readiness

- **Plan 15-03 (verification & docs cleanup) ready to start** — both Functions (15-01 EDHREC, 15-02 Spellbook) now exist with passing unit tests
- **Phase 16 (Live-Environment UAT Pass) ready to start** after 15-03 — should explicitly include Spellbook combo lookup as part of the live Preview UAT script (the only client call site is POST `/find-my-combos` in the deck-builder flow)
- **No blockers**

---
*Phase: 15-edhrec-cors-proxy*
*Plan: 15-02*
*Completed: 2026-04-28*
