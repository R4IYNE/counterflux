# Phase 15: EDHREC CORS Proxy - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 15-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 15-edhrec-cors-proxy
**Areas discussed:** Function path strategy, Spellbook parity, PROXY-04 reframe, Server-side hardening

---

## Function Path Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Catch-all `/api/edhrec/[...path]` (Recommended) | File: `api/edhrec/[...path].js`. Client `EDHREC_BASE` stays `/api/edhrec` exactly as today. No env-aware switch. Vite dev proxy + Vercel Function map to the same URL shape. | ✓ |
| Separate `/api/edhrec-proxy` | File: `api/edhrec-proxy.js`. Add `import.meta.env.PROD` switch in `src/services/edhrec.js`. Slightly more explicit but costs a one-line client change and a switch test. | |

**User's choice:** Catch-all `/api/edhrec/[...path]` (Recommended)
**Notes:** Zero client-side change. Same URL shape in dev (Vite proxy) and prod (Vercel Function). Locked as D-01, D-02, D-03.

---

## Spellbook Parity

### Q1: Include Spellbook proxy in Phase 15 scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — ship both EDHREC and Spellbook (Recommended) | Add `api/spellbook/[...path].js` alongside the EDHREC function. Same catch-all pattern, same test shape. Closes the same 'silently broken in production' gap in one phase. | ✓ |
| No — EDHREC-only, defer Spellbook | Phase 15 strictly EDHREC. Spellbook stays broken in production until v1.3. | |

**User's choice:** Yes — ship both EDHREC and Spellbook (Recommended)
**Notes:** Marginal cost (one more file, ~3-5 test cases). Risk tiny. Locked as D-04.

### Q2: REQ-ID style for Spellbook reqs?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse PROXY-01..05 generically (Recommended) | Rename existing requirements to apply to BOTH services. One requirement covers both. | ✓ |
| Add SPELLBOOK-01..05 as parallel set | Keep PROXY-01..05 EDHREC-specific, add SPELLBOOK-01..05 as a sibling category. | |

**User's choice:** Reuse PROXY-01..05 generically (Recommended)
**Notes:** Tighter traceability, less doc bloat. REQUIREMENTS.md updated during this discuss-phase to apply PROXY-* to both services. Locked as D-05.

---

## PROXY-04 Reframe

| Option | Description | Selected |
|--------|-------------|----------|
| Replace with 'main bundle stays under 300 KB gz' (Recommended) | Reword: 'Adding the proxy does not grow the main bundle past the existing 300 KB gz budget. The Vercel Function file in `api/` is server-side-only and never imported by client code; existing `tests/bundle-budget.test.js` asserts the budget on every `npm run build:check`.' | ✓ |
| Drop PROXY-04 entirely | Bundle discipline already enforced by the existing budget test. The proxy doesn't change client bundle by construction. | |
| Add a forward-looking guard test | New test: 'No file in `api/` is imported from `src/`'. Belt-and-suspenders. | |

**User's choice:** Replace with 'main bundle stays under 300 KB gz' (Recommended)
**Notes:** Original PROXY-04 framing assumed lazy-load gating that doesn't exist; EDHREC code has been in main bundle since v1.0. Reframed to enforce the existing budget. Locked as D-06, D-07, D-08.

---

## Server-Side Hardening

| Option | Description | Selected |
|--------|-------------|----------|
| Set User-Agent + transparent passthrough (Recommended) | Function sets `User-Agent: Counterflux/1.x (+https://counterflux.vercel.app)`. Pass query/body/method through unchanged. Pass status code + JSON body back. NO server-side rate limiting. NO server-side caching. | ✓ |
| Plus server-side rate limiting | Above + token-bucket per IP. Defends against runaway client bug or abuse. Adds complexity. | |
| Minimal passthrough — no UA, no rate limit | Just forward. Simplest possible function. | |

**User's choice:** Set User-Agent + transparent passthrough (Recommended)
**Notes:** Politeness gesture (UA), no defensive measures yet (defer until abuse signals appear). Locked as D-09 through D-13.

---

## Claude's Discretion

- Exact UA string formatting and version format ("1.x" vs reading from package.json).
- DRY vs duplicate: shared `api/_lib/proxy.js` helper vs ~30 lines duplicated across two Function files.
- Test file split: single combined test vs separate per Function.
- Order of operations during execution.
- Including a one-line cleanup of the now-stale "wire to a serverless proxy" TODO comments at `src/services/edhrec.js:4` and `src/services/spellbook.js:8`.

## Deferred Ideas

- Live verification of the proxy → Phase 16 UAT.
- Lighthouse perf impact of EDHREC traffic via proxy → Phase 16 UAT-02.
- Server-side rate limiting → v1.3+ if abuse signals appear.
- Server-side caching → v1.3+ if Vercel function-invocation costs grow.
- Edge runtime → explicit out per platform note.
- Function observability (Vercel Analytics on the proxy) → v1.3+.
- Shared `api-client.js` abstraction across client services → refactor candidate, not v1.2.
