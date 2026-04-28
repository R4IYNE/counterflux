# Phase 15: EDHREC CORS Proxy - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship two Vercel Functions that proxy EDHREC and Commander Spellbook API requests, fixing the CORS-preflight failure that has silently broken these features in production since v1.0. The Vite dev proxy stays as-is for `npm run dev`; the change is purely a production-path addition with **zero client-side path changes** thanks to catch-all path alignment.

**In scope:**
- `api/edhrec/[...path].js` — Vercel Function matching `/api/edhrec/*` → `https://json.edhrec.com/*`
- `api/spellbook/[...path].js` — Vercel Function matching `/api/spellbook/*` → `https://backend.commanderspellbook.com/*`
- Server-side `User-Agent: Counterflux/1.x (+https://counterflux.vercel.app)` on each outbound upstream request
- Pass-through of method, query, body, and headers (with UA replacement)
- Pass-through of upstream status code and JSON body to the client
- Bundle-budget verification post-change (existing `tests/bundle-budget.test.js`)
- Tests for the Functions themselves (passthrough, error mapping, UA injection)

**NOT in this phase:**
- Any client-side change to `src/services/edhrec.js` or `src/services/spellbook.js` (catch-all path alignment makes this unnecessary)
- Server-side rate limiting (client already enforces 200ms spacing for EDHREC; add only if abuse surfaces post-launch)
- Server-side caching beyond Vercel's defaults (client already caches synergies + Top-Salt map for 7d in Dexie / meta table)
- Edge runtime experimentation (Fluid Compute / Node.js per Vercel platform default — edge explicitly out)
- Vercel Analytics / Sentry / Logflare instrumentation on the Functions (out of scope per REQUIREMENTS.md)
- LHCi soft-gate workflow rewrite to target real Preview URL — Phase 16 territory (UAT-01)
- Production Lighthouse run — Phase 16 territory (UAT-02)

</domain>

<decisions>
## Implementation Decisions

### Path Strategy
- **D-01:** **Catch-all path-aligned proxies.** Files: `api/edhrec/[...path].js` and `api/spellbook/[...path].js`. The Vite dev proxy in `vite.config.js:7-18` strips `/api/edhrec` and `/api/spellbook` and rewrites to the upstream — Vercel's `[...path]` catch-all gives the Function the same path slug for free. Both environments serve the identical URL shape: `EDHREC_BASE = '/api/edhrec'` and `SPELLBOOK_BASE = '/api/spellbook'` continue to work unchanged in `src/services/edhrec.js:5` and `src/services/spellbook.js:9`.
- **D-02:** **Zero client-side change.** No `import.meta.env.PROD` switch in client services. No new `*-proxy` paths. The existing `EDHREC_BASE` / `SPELLBOOK_BASE` constants stay literal-equal to today.
- **D-03:** REQUIREMENTS.md PROXY-01 was reworded during discuss-phase to drop the `-proxy` suffix from the originally-proposed file name; the updated wording reflects this catch-all strategy.

### Spellbook Parity (added during discuss-phase)
- **D-04:** **Spellbook proxy ships in this phase, not deferred.** `src/services/spellbook.js:8` carries the same "wire to a serverless proxy" comment as EDHREC; same CORS preflight problem; same fix shape. Marginal cost is one additional file + ~3-5 test cases. Risk is tiny — Spellbook only does POST/JSON to `/find-my-combos`, the proxy is a thin passthrough.
- **D-05:** **PROXY-01..05 reworded to be service-generic.** Rather than parallel `SPELLBOOK-01..05` IDs, the existing PROXY category now covers both services in each requirement. Tighter traceability, less doc bloat.

### Bundle Discipline (PROXY-04 reframe)
- **D-06:** **PROXY-04 originally framed as "anonymous bundle parity gated by `tests/auth-bundle.test.js`" — both pieces wrong.** EDHREC + Spellbook code is already in `dist/assets/index-*.js` (statically imported via `src/main.js:12 → src/stores/intelligence.js:1-9`). It has been since v1.0. There is no "lazy-load gate" to preserve. Also, `tests/auth-bundle.test.js` does not exist; the relevant gate is `tests/bundle-budget.test.js` enforcing the 300 KB gz main budget via `scripts/assert-bundle-budget.js`.
- **D-07:** **Reframed PROXY-04:** "Adding the proxy Functions does not grow the main client bundle past 300 KB gz." The Vercel Functions live in `api/` — server-side only by Vercel's bundling, never importable from `src/`. By construction, the client bundle is unchanged. Phase 15 success is the existing `npm run build:check` continuing to pass.
- **D-08:** No new bundle-inspection test added — the existing budget test is sufficient. A "no `api/*` imported from `src/*`" guard test was discussed and rejected as belt-and-suspenders for a constraint that's enforced by Vercel's build pipeline anyway.

### Server-Side Hardening
- **D-09:** **Set `User-Agent: Counterflux/1.x (+https://counterflux.vercel.app)`** on every outbound upstream request from both Functions. Server-side UA is unrestricted (unlike browsers, where `src/services/edhrec.js:42-43` notes UA is a forbidden header silently stripped, so the client correctly omits it). Politeness signal to EDHREC + Spellbook ops; gives them a way to identify and contact us if needed.
- **D-10:** **NO server-side rate limiting.** Client enforces 200ms spacing for EDHREC (`src/services/edhrec.js:7,33-38`). Spellbook is bursty by nature (one POST per deck-load) and not on a published rate limit. Adding server-side limiting would require either an in-memory store (works on a single Fluid Compute instance but not across cold starts) or Vercel Runtime Cache (added complexity, scope creep). Defer until abuse / runaway-loop telemetry demands it.
- **D-11:** **NO server-side caching.** Client already caches EDHREC synergies (7d TTL via `db.edhrec_cache`) and Top-Salt map (7d TTL via `db.meta`). Spellbook combos are cached by the intelligence store (Plan 03 logic, `src/stores/intelligence.js`). Adding a server cache would duplicate effort and complicate cache-invalidation semantics. Vercel's default response handling (no extra cache headers) is sufficient.
- **D-12:** **Transparent passthrough otherwise.** Method, query string, body, and request headers (excluding `host`) pass through unchanged. Status code and response body pass back unchanged. Only mutation: replace UA on the way out.
- **D-13:** **Error mapping:** Network failure (DNS, timeout, connection refused) → return 502 Bad Gateway with a small JSON body (`{ error: "upstream unavailable", source: "edhrec" }`). Upstream non-2xx → pass through with status code preserved, body forwarded. Function never crashes — outer try/catch with structured logging via `console.error`.

### Runtime + Posture
- **D-14:** **Fluid Compute / Node.js runtime** (Vercel platform default per session knowledge update). Edge runtime explicitly NOT used. No `runtime: 'edge'` config in any function file. Default 300s timeout is fine; these proxies should respond in <1s normally.
- **D-15:** **Function language:** plain JavaScript (vanilla codebase posture per Phase 15 prior CONTEXT.md D-01 in the now-deleted Vercel Foundation phase). No TypeScript introduction for Function files. `export default async function handler(req, res) { ... }` style.
- **D-16:** **Streaming not used.** Both upstream APIs return small JSON payloads (<200 KB even for the EDHREC Top-Salt map). Buffer-and-respond is fine.
- **D-17:** **CORS headers on the response:** the proxy is same-origin (`/api/edhrec` is served from `counterflux.vercel.app`, same as the client), so explicit CORS headers on the response are NOT required. The whole point of this phase is to AVOID the CORS preflight that CloudFront blocks on the upstream — the proxy makes the upstream call same-origin. Functions return JSON without `Access-Control-*` headers.

### Testing Posture
- **D-18:** **Vitest unit tests** for each Function: handler signature, UA injection, method+body passthrough, error mapping (502 on network failure, status preserved on non-2xx). Mock `fetch` globally per existing test pattern (`tests/edhrec-service.test.js` style).
- **D-19:** **No live integration test in CI.** Functions are tested in isolation (mocked fetch); end-to-end verification happens during Phase 16 UAT against the live Preview URL. Adding a CI job that hits real EDHREC would burn CI minutes for no gain — the Function logic is straightforward passthrough.
- **D-20:** **Bundle-budget verification:** run `npm run build:check` post-change. The script in `scripts/assert-bundle-budget.js` already gates main bundle at 300 KB gz, vendor at 100 KB gz, etc. Phase 15 success criterion: this command continues to exit 0.

### Claude's Discretion
- Exact wording of the UA string ("Counterflux/1.x" vs "Counterflux/1.2" vs reading from `package.json` version) — planner picks during execution.
- Whether to factor a shared `proxyHandler(upstreamBase, ua)` helper into `api/_lib/proxy.js` vs duplicate ~30 lines across the two Function files. Both are fine; planner can DRY-up if it falls out cleanly.
- Test file location and split (single `tests/api-proxy.test.js` covering both vs separate `tests/api-edhrec-proxy.test.js` + `tests/api-spellbook-proxy.test.js`) — planner picks.
- Order of operations during execution (EDHREC Function first vs both at once vs Spellbook first) — planner sequences.
- Whether to add a one-line README/comment update at `src/services/edhrec.js:4` and `src/services/spellbook.js:8` removing the now-stale "wire to a serverless proxy or edge function" TODO comments — minor cleanup, planner can include.

### Folded Todos
None — `gsd-tools todo match-phase 15` returned zero matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Vercel Platform (session-loaded knowledge)
- `vercel:knowledge-update` — Fluid Compute / Node.js is the default runtime; edge runtime explicitly NOT recommended. Default function timeout 300s. Catch-all routes via `[...path]` filename pattern.
- `vercel:vercel-functions` — load when designing the handler signature (`export default async function handler(req, res)`), runtime config, response patterns. Auto-loads on relevant prompts.
- `vercel:routing-middleware` — only load if a question arises about request rewriting BEFORE the function. Probably not needed for Phase 15.

### Phase 15 Code Targets (FULL paths)
- `src/services/edhrec.js` — current EDHREC client. `EDHREC_BASE = '/api/edhrec'` (line 5). `rateLimitedFetch` enforces 200ms client spacing (lines 33-38). Comment line 4 explicitly anticipates this phase. NO client-side change required (D-02).
- `src/services/spellbook.js` — current Spellbook client. `SPELLBOOK_BASE = '/api/spellbook'` (line 9). Comment line 8 explicitly anticipates this phase. POST `/find-my-combos` (line 44). NO client-side change required (D-02).
- `src/stores/intelligence.js` — orchestrates EDHREC + Spellbook calls, owns `error.edhrec` + `error.spellbook` state flags (lines 39-40). PROXY-05 requires this error-handling path to keep working unchanged.
- `src/main.js:12` — static import of `initIntelligenceStore`. Confirms EDHREC/Spellbook code is in the main bundle, not lazy-loaded. Drives the PROXY-04 reframe (D-06, D-07).
- `vite.config.js` lines 7-18 — Vite dev proxy rules for both services. Phase 15 leaves these unchanged; they remain the dev-environment behavior.
- `vercel.json` — repo root, 16 lines, currently declares Cache-Control headers only. Phase 15 may extend with `functions` runtime config if needed (D-14 default is fine; only add if explicit pinning is required).
- `scripts/assert-bundle-budget.js` — bundle-budget gate. Main = 300 KB gz, vendor = 100 KB gz, default = 500 KB gz. Phase 15 must pass this script post-change.
- `tests/bundle-budget.test.js` — vitest gate that the script exists + has expected budgets. PROXY-04 success criterion (D-07) leans on this.

### Existing EDHREC + Spellbook Tests (mocked-fetch pattern to follow)
- `tests/edhrec-service.test.js` — vitest pattern: `vi.stubGlobal('fetch', vi.fn())` in beforeEach, mock the JSON response, assert behavior. Same pattern works for Function tests.
- `tests/spellbook-service.test.js` — sibling test for Spellbook client. Same vitest mock-fetch pattern.

### Prior Phase Decisions (Phase 13, archived)
- `.planning/milestones/v1.1-phases/13-performance-optimisation-conditional/13-CONTEXT.md` D-11 — soft-gate is intentionally `warn`-level only. Phase 15 must not affect this; bundle-budget script + perf-soft-gate workflow stay independent.
- `.planning/milestones/v1.1-phases/13-performance-optimisation-conditional/13-HUMAN-UAT.md` — Test 1 (soft-gate fires on real PR) and Test 2 (Cache-Control) — Phase 16 verifies, Phase 15 prerequisite is "don't break the build that the soft-gate runs against."

### Project / Roadmap (current)
- `.planning/PROJECT.md` — current milestone scope, Active section, Out of Scope.
- `.planning/REQUIREMENTS.md` — PROXY-01..05 (updated during this discuss-phase to cover both services and reframe PROXY-04).
- `.planning/ROADMAP.md` — Phase 15 goal, success criteria, Spellbook parity question now resolved.

### Existing Codebase Maps
- None at `.planning/codebase/`. Scout findings inline in `<code_context>` below.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/services/edhrec.js` rateLimitedFetch — client-side rate limit enforcement; the proxy doesn't replicate this server-side (D-10).
- `src/services/spellbook.js` mapCombo — request/response shape for Spellbook's POST. Proxy is upstream-agnostic so doesn't touch this; client code keeps using the helper unchanged.
- Vitest mock-fetch pattern from `tests/edhrec-service.test.js` and `tests/spellbook-service.test.js` — directly applicable to Function unit tests (mock the fetch the function makes).
- `scripts/assert-bundle-budget.js` BUDGETS table — categorizes chunks by filename. New `api/*` files don't enter `dist/assets/` so don't appear in this list at all (server-side build is separate).

### Established Patterns
- **Vanilla JS everywhere.** No TypeScript, no tsconfig.json, no `.ts` files. Function files written in plain JS with JSDoc (D-15).
- **Atomic commits via `gsd-tools commit`** — every prior phase committed each artifact independently. Planner should sequence: Function 1 → commit → Function 2 → commit → tests → commit, or whatever granularity fits the plan.
- **Try/catch with safe fallback** — both client services use `try { ... } catch { return { ..., error: true } }`. Functions follow the same posture (D-13): outer try/catch maps network failures to 502, never throws.
- **No state mutation in services** — both client services are pure-ish (cache writes via Dexie are the only side effect). Functions are similarly stateless: read request, fetch upstream, write response. No singleton patterns.

### Integration Points
- **Vercel Function discovery:** files in `api/*` are auto-discovered and routed by Vercel. `api/edhrec/[...path].js` matches `/api/edhrec/*`. No `vercel.json` `routes` block needed for this.
- **Vite dev server still owns `/api/edhrec` and `/api/spellbook` in development** (vite.config.js:7-18). The Vercel Function does NOT run in `npm run dev`. Both environments coexist by URL alignment, not by sharing code.
- **Bundle build pipeline** — `npm run build` produces `dist/`; `npm run build:check` adds the budget assertion. Vercel deploys `dist/` for static assets and `api/*.js` as Functions. No code shared between client and Functions.
- **No new src/ files** in Phase 15. All new code lives under `api/` (Functions) and `tests/` (Function tests).

</code_context>

<specifics>
## Specific Ideas

- **Catch-all is the load-bearing decision** — D-01/D-02 mean Phase 15 has zero client-side risk. The proxy can ship behind any feature gate or get rolled back without touching client code. This keeps the blast radius small.
- **Dual-service framing matters for test design** — testing both Functions in one PR (vs two sequential PRs) keeps the perf-soft-gate workflow run count low (the workflow runs on PRs touching watched paths). One PR with both Functions, one workflow run. Planner-level choice; mentioning so it's not lost.
- **UA string** — D-09 specifies `Counterflux/1.x (+https://counterflux.vercel.app)`. The `1.x` is intentional (don't bake a version that drifts on every release); the URL gives EDHREC/Spellbook ops a contact path if they care about traffic from this app.
- **TODO comment cleanup** — `src/services/edhrec.js:4` and `src/services/spellbook.js:8` both carry "In production, wire /api/edhrec to a serverless proxy or edge function" comments. Phase 15 retires these. Planner can include a one-line edit in each service file (no logic change, just delete the now-stale comment) as part of the same PR.

</specifics>

<deferred>
## Deferred Ideas

### For Phase 16
- **Live verification of the proxy** — open a PR, confirm Preview deploy hits EDHREC + Spellbook successfully, capture function logs showing the UA reaching upstream. UAT-01..03 already covers the "verify on real Preview URL" pattern; Phase 16 should explicitly include "EDHREC + Spellbook synergy/combo lookup works on the live Preview" as part of the UAT script.
- **Lighthouse perf impact** — adding two Functions doesn't directly affect client perf, but if the catch-all routing adds DNS/connection latency to first synergy load, UAT-02 might catch it. Note for Phase 16: include EDHREC-using interaction in the production Lighthouse run flow.

### For v1.3+
- **Server-side rate limiting** — D-10 deferred. Re-evaluate if abuse / runaway-loop telemetry surfaces post-launch.
- **Server-side caching** — D-11 deferred. Re-evaluate if Vercel function-invocation costs grow uncomfortable on the Hobby tier.
- **Edge runtime experimentation** — explicit Out of Scope per REQUIREMENTS.md and Vercel platform note. Don't revisit unless a specific Function needs sub-50ms cold start that Fluid Compute can't deliver.
- **CDN / Vercel Runtime Cache for proxy responses** — would require client-side cache invalidation strategy. Layered on top of existing Dexie cache, marginal value.
- **Function observability (Vercel Analytics integration on the proxy)** — out of scope; would help if abuse surfaces.
- **Migration of EDHREC + Spellbook clients to a single shared `api-client.js` abstraction** — refactor candidate, not scope for v1.2.

### Reviewed Todos (not folded)
None — `gsd-tools todo match-phase 15` returned zero matches; nothing to review.

</deferred>

---

*Phase: 15-edhrec-cors-proxy*
*Context gathered: 2026-04-28*
