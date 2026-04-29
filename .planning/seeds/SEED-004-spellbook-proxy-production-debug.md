---
id: SEED-004
status: dormant
planted: 2026-04-29
planted_during: v1.2 post-ship hot-fix cycle
trigger_when: When user demand for production combo detection surfaces, OR when Spellbook gains a feature that becomes load-bearing for deck-building, OR when v1.3 includes any deck-builder analytics work
scope: Small (30 min – 3 hours, depending on diagnosis path)
---

# SEED-004: Spellbook proxy returns HTTP 400 in production despite identical headers working in direct curl

## Why This Matters

Phase 15 shipped two Vercel Function proxies for upstream APIs that don't allow CORS preflight:

- **EDHREC proxy** (`api/edhrec.js`) — works in production. Real synergy data flowing.
- **Spellbook proxy** (`api/spellbook.js`) — function runs, reaches upstream, but `https://backend.commanderspellbook.com/find-my-combos` returns HTTP 400 (Django default error HTML). The proxy faithfully forwards the 400 back to the client.

Spellbook combo detection is the deck-builder analytics widget that surfaces "you're 1 card away from this infinite combo" in Thousand-Year Storm. v1.0 and v1.1 shipped without this working in production (Vite dev proxy doesn't deploy to Vercel) — the world didn't end. v1.2 attempted to fix it via the catch-all proxy pattern but the bug below blocks it.

**Production user impact:** when a signed-in user opens Thousand-Year Storm with a Commander, the Spellbook combo panel renders an empty state / error rather than combos. EDHREC synergies, salt scores, and gap analysis all still work. Deck builder is functional minus this one widget.

## What We Know (verified during v1.2 hot-fix cycle 2026-04-28→29)

1. **Direct curl to upstream works** — `curl -X POST -H "Content-Type: application/json" -H "User-Agent: Counterflux/1.x (+https://counterflux.vercel.app)" -d 'BODY' https://backend.commanderspellbook.com/find-my-combos` returns HTTP 200 with the proxy's exact UA, exact `Accept: */*` header, exact body shape. Tested 3 times during diagnosis.

2. **Through the proxy fails consistently** — same payload, same headers, returns Django's default 400 HTML error page. No useful body content.

3. **Vercel function logs confirm the function runs** — POST reaches `/api/spellbook/find-my-combos`, function executes, fetch() to upstream completes, upstream returns 400. Logged via `console.error` but Vercel MCP log tool truncates payloads at ~50 chars (this is the diagnosis bottleneck — see "Approach" below).

4. **Things tried that didn't fix it:**
   - Hot-fix #2: strip `content-length` + `accept-encoding` from forwarded headers (correct fix for one class of issue, but didn't resolve)
   - Hot-fix #3: switch to Web Standard fetch handler (`request`/`Response` API) — broke EDHREC because `duplex: 'half'` was incompatible with Vercel's runtime, reverted

5. **Things NOT yet tried** (most-likely-to-work first):
   - **Read raw body stream** instead of relying on Vercel's auto-parsed `req.body`. The current proxy does `JSON.stringify(req.body)` which produces deterministic compact JSON, but Vercel's body parser may be doing something subtle that the round trip doesn't preserve byte-for-byte.
   - **Strip `accept` header** entirely (Vercel sends `accept: */*` by default; maybe Spellbook's Django parser is picky about specific accept values).
   - **Strip `cookie` / `referer` / `origin`** headers (proxy currently forwards these; Django CSRF middleware might reject mismatched origins).
   - **Try Web Standard fetch handler again WITHOUT `duplex: 'half'`** — was wrong implementation last time, not the wrong approach.

## When to Surface

**Trigger:** Any of these:
- A v1.3 milestone has Thousand-Year Storm or deck-builder analytics work in scope
- User reports "combos aren't showing in production"
- Phase 15's PROXY-05 (error handling) needs revisit — graceful degradation when Spellbook proxy fails would benefit from this being unblocked
- A free 30-90 min slot opens up where the user wants to take a focused crack at it

This seed should be presented during `/gsd:new-milestone` whenever scope mentions Thousand-Year Storm, deck builder, combos, or production-perf-of-deck-builder.

## Approach (when triggered)

**Step 1 — Diagnose by viewing FULL Vercel logs (15 min):**

The bottleneck during v1.2 hot-fix cycle was the MCP log tool truncating `console.error` payloads at ~50 chars. Bypass this by:
1. Open `https://vercel.com/jamesarnall87-2435s-projects/counterflux/<latest-deployment>` in a browser
2. Click "Functions" → `/api/spellbook` → "Runtime Logs"
3. Trigger a curl POST to `/api/spellbook/find-my-combos` from terminal
4. The web UI shows full `console.error` output (no truncation)
5. Re-add the debug instrumentation that was in `api/spellbook.js` at commit `cbdb200` (logs typeof req.body, outbound URL, all outbound headers, body bytes, body preview, upstream status)
6. Compare proxied request bytes vs. direct curl bytes — diff reveals the corrupted bit

The instrumented code is preserved in git history at `cbdb200` if you need to copy it back.

**Step 2 — Apply targeted fix (10–60 min depending on diagnosis):**

Most likely diagnoses:
- **Body byte mismatch** — `JSON.stringify(req.body)` produces different bytes than the original. Fix: read raw body stream via Node.js IncomingMessage interface, forward bytes verbatim. ~30 min.
- **Header conflict** — some Vercel-injected header (origin, referer, cookie, x-real-ip) trips Django's CSRF or input validation. Fix: extend the strip list. ~10 min.
- **Spellbook deprecated `find-my-combos`** — the API may have moved. Check Spellbook's own docs/recent changelog. Fix: update endpoint path. ~varies.

**Step 3 — Re-verify (5 min):**

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"commanders":[{"card":"Atraxa, Praetors'\''s Voice"}],"main":[{"card":"Sol Ring"},{"card":"Doubling Season"}]}' \
  https://counterflux.vercel.app/api/spellbook/find-my-combos
```

Expected: HTTP 200 with `{ results: { included: [...], almostIncluded: [...] } }`.

## Scope Estimate

**Small (30 min – 3 hours)**:
- 70% confidence: 30 min – 1 hour (read raw body stream + targeted header strip)
- 25% confidence: 1–3 hours (genuinely-weird Vercel runtime quirk requiring isolation in a separate test project)
- 5% confidence: > 3 hours (Spellbook itself changed its API and we need to align)

## Breadcrumbs

Code in current state:

- `api/spellbook.js` — current proxy. Uses Vercel's legacy req/res signature. Forwards `JSON.stringify(req.body)` to upstream. Strips `content-length` + `accept-encoding` (hot-fix #2). Returns upstream's 400 verbatim.
- `src/services/spellbook.js` line 9 — client `SPELLBOOK_BASE = '/api/spellbook'`. Unchanged. Hits the proxy via the rewrite in `vercel.json`.
- `src/stores/intelligence.js` line 9 — imports `findDeckCombos`. Lines 129-160 are the call site.
- `vercel.json` — rewrites `/api/spellbook/:path*` → `/api/spellbook?path=:path*`. Same pattern as EDHREC.
- `tests/api-spellbook-proxy.test.js` — 11 unit tests, all pass with mocked req/res. Tests prove the function logic is correct in isolation.

Key git history:

- `26ca4df` — revert of hot-fix #3 (current Spellbook state)
- `f1f2960`, `cbdb200` — debug instrumentation that LOGGED but couldn't be READ via MCP tool (preserved for re-use)
- `5dfe422` — hot-fix #3 (Web Standard fetch handler) BROKE EDHREC, reverted
- `d742d02` — hot-fix #2 (strip content-length + accept-encoding) — partial fix
- `06f89a1` — hot-fix #1 (replace [...path] catch-all with rewrites) — fixed EDHREC

Direct upstream curl that confirms our payload is fine:

```bash
curl -sX POST \
  -H "Content-Type: application/json" \
  -H "User-Agent: Counterflux/1.x (+https://counterflux.vercel.app)" \
  -H "Accept: */*" \
  -d '{"commanders":[{"card":"Atraxa, Praetors'\''s Voice"}],"main":[{"card":"Sol Ring"}]}' \
  https://backend.commanderspellbook.com/find-my-combos
# → HTTP 200, JSON body with results.included + results.almostIncluded
```

## Notes

- v1.2 token-burn lesson: we spent ~30% of the v1.2 token budget on hot-fix iteration after milestone close. Three deploys, one revert, no functional fix. Next time: when a hot-fix doesn't land in 2 attempts, **stop and defer** rather than spinning. Pattern recognition from v1.0 and v1.1 — but it didn't catch in time during v1.2.
- The Vercel MCP log tool's truncation behavior is a real workflow gap. Worth flagging upstream OR routing around it next time (e.g. write logs to a Vercel KV/Edge Config write that we can query later, OR just always use the web dashboard for log inspection).
- Defense-in-depth idea worth considering at fix time: add a feature flag in `src/services/spellbook.js` that returns `{ included: [], almostIncluded: [], error: false, disabled: true }` when `import.meta.env.PROD` AND a future "spellbook_disabled" config flag are both true. Lets us ship a "graceful no-combos" UX in production until the proxy works, instead of the current "error toast on every deck load" UX.
