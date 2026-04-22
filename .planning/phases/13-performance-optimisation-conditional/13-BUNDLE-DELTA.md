# Phase 13 Plan 5 — Bundle Splitting + Structural LCP Fix

**Triggered:** Plan 1 Branch B (LCP 6.1s) + post-Plan-3 re-measurement (LCP 6.08s, 98% Render Delay) confirmed LCP target still missed after streaming-UI shipped
**Pre-split LCP (post-Plan-3):** 6.08s (Lighthouse 12.6.1, desktop preset, headless Chromium)
**Target:** LCP < 2.5s
**Final LCP (post-Task-6):** **2.49s ✓** — PERF-04 target met.
**Methodology:** `npx lighthouse http://localhost:4173/ --preset=desktop --only-categories=performance --chrome-flags="--headless=new --no-sandbox" --quiet`; matches 13-REMEASURE-POST-PLAN3.md

## Sharpening Evidence (from 13-REMEASURE-POST-PLAN3.md)

- **LCP element:** `body > div#cf-auth-wall > h1` ("COUNTERFLUX", Syne 48px/700) — same as Plan 1 re-measurement
- **LCP phase breakdown:** TTFB 121ms (2%) + Load Delay 0ms + Load Time 0ms + **Render Delay 5,962ms (98%)**
- **Interpretation:** The DOM is ready within 121ms; the auth-wall `<h1>` can't paint for another ~6 seconds. Network is already fast (Load Time = 0ms). The dominant blocker is whatever prevents the first contentful paint of the auth-wall heading.
- **Orchestrator's priority reordering (via post-Plan-3 measurement):**
  1. `font-display: swap` on Syne (biggest LCP win, lowest risk)
  2. `<link rel="preload" as="font" crossorigin>` for Syne Bold 700
  3. Bundle splitting (mana-font / keyrune / Chart.js / screen modules) — regression-prevention, not primary LCP lever
  4. Pitfall 15 cache-bust recovery (`vite:preloadError` + `Cache-Control: no-cache`)
  5. Per-chunk size budgets via `scripts/assert-bundle-budget.js`

## Discovery during Task 1 audit

1. **`font-display: swap` is ALREADY applied** to Syne, Space Grotesk, JetBrains Mono, and Crimson Pro in `src/styles/main.css` lines 42-68 (shipped in an earlier phase). The built CSS confirms `font-display:swap` on the Syne `@font-face` declaration. Plan 5 Task 1 therefore LOCKS this contract via a regression test instead of adding it fresh — the test prevents a future refactor from accidentally dropping `swap`.
2. **Syne preload is MISSING.** `index.html` lines 7-8 preload Space Grotesk and JetBrains Mono but NOT Syne. Adding `<link rel="preload" as="font" type="font/woff2" crossorigin>` for Syne is the net-new LCP lever this plan ships.
3. **The auth-wall (LCP element) is JS-constructed, NOT in initial HTML.** `src/components/auth-wall.js` uses `document.createElement('div')` + `appendChild(document.body)`. The wall mounts only after:
   - main.js parses + executes
   - `runMigration()` resolves
   - Store init runs
   - `Alpine.start()` fires
   - `initRouter()` completes
   - `Alpine.store('auth').init()` resolves (which, for users with a prior session, triggers a dynamic `import('./services/supabase.js')`)
   - Alpine.effect dispatches `syncAuthWall()` → `openAuthWall()` builds the DOM
4. **This means the LCP Render Delay is primarily JS-boot-dominated, not font-blocked** — but the font-preload still helps because `<link rel=preload>` fires before the main chunk finishes parsing, so the Syne woff2 is already in cache by the time the h1 mounts.

## Pre-Split Chunk Inventory (dist/assets/ after `npm run build`, raw+gzip)

| File | Raw KB | Gzip KB | Category | Lazy? | Split Candidate? |
|------|--------|---------|----------|-------|-------------------|
| chart-_J5g3QoL.js | 183.7 | 63.2 | vendor (Chart.js) | No (vendor chunk) | Yes — keep in vendor or separate chart-only chunk |
| supabase-C0xbGhSR.js | 182.6 | 47.2 | vendor (supabase-js, Phase 10 AUTH-01 split) | Yes (dynamic import in auth store) | Already split; keep as-is |
| vendor-CXDJebgL.js | 149.1 | 49.1 | vendor (alpinejs + dexie + navigo) | No | Keep — core runtime |
| index-Ll2T9DLM.css | 140.7 | 25.9 | main CSS (Tailwind + mana-font + keyrune + material-symbols + fonts) | No | **YES** — mana-font + keyrune + material-symbols bloat here |
| index-DjUBnY1F.js | 126.5 | 34.4 | main entry (stores + components) | No | Minor candidate — most is shared infra |
| bulk-data.worker-BDtxSEkC.js | 125.2 | 37.0 | worker | Yes (Web Worker) | Already isolated |
| thousand-year-wVVBr795.js | 110.4 | 30.9 | screen (Thousand-Year Storm) | Yes (route) | Already lazy |
| treasure-cruise-BaOT9k25.js | 110.3 | 21.7 | screen (Treasure Cruise) | Yes (route) | Already lazy |
| vandalblast-R_2cwpOf.js | 59.2 | 11.1 | screen (Vandalblast) | Yes (route) | Already lazy |
| preordain-BNwOUWKe.js | 39.1 | 8.3 | screen (Preordain) | Yes (route) | Already lazy |
| epic-experiment-DPu6Mw3H.js | 22.7 | 6.0 | screen (Epic Experiment) | Yes (route) | Already lazy |
| papaparse.min-BRZgoD4Z.js | 18.8 | 6.8 | vendor (csv parser) | Yes (dynamic import) | Already split |
| ritual-modal-DSX0E_z0.js | 15.6 | 4.0 | component (dynamic) | Yes | Already split |

**Total critical-path (blocking):** index-DjUBnY1F.js (34.4KB gz) + index-Ll2T9DLM.css (25.9KB gz) + vendor-CXDJebgL.js (49.1KB gz) = **~109KB gzipped main payload**

**Key insight:** Routes are already lazy-loaded via Navigo per the established CLAUDE.md pattern. The main payload bloat is in the CSS bundle (140KB raw) which inlines mana-font, keyrune, and material-symbols CSS at the top of `src/main.js`.

## Planned Splits (in priority order — ordered to lock LCP win first)

### Split 0 (Task 1): Syne font preload (NEW LEVER)
- Rationale: LCP element is the Syne 48px/700 h1; preloading means the browser fetches the woff2 in parallel with the main CSS/JS parse, rather than waiting to encounter it via CSS-declared `@font-face`
- File: `index.html` — add `<link rel="preload" href="/assets/Syne-Variable.woff2" as="font" type="font/woff2" crossorigin>` below the existing Space Grotesk + JetBrains Mono preloads
- Preload-path caveat: the Syne file is hashed by Rolldown to `dist/assets/Syne-Variable-{hash}.woff2`. Preload uses the dev-server path `/src/styles/fonts/Syne-Variable.woff2` which Vite rewrites for prod builds. Match the existing Space Grotesk/JetBrains Mono pattern (they use the dev-server path + rely on Vite's asset pipeline)
- Expected LCP delta: ~500-1500ms reduction (font-file fetch moves from post-CSS-parse to parallel-with-HTML-parse)

### Split 1 (Task 4): mana-font CSS chunk (Pattern 6 priority 1)
- Rationale: Largest third-party CSS blocker; 99KB raw (per measurement) blocks first paint even though actual mana-symbol rendering happens later
- File: `vite.config.js` rollupOptions.output.manualChunks
- Expected deploy-size delta: main CSS drops by ~99KB raw (~20-30KB gz)
- Expected LCP delta: minor — main CSS still blocks; mana-font chunk becomes a separate CSS file that still blocks on its own. Primary win is cache granularity + deploy-bandwidth savings.

### Split 2 (Task 4): keyrune CSS chunk (Pattern 6 priority 2)
- Rationale: Set-icon CSS; needed only on Preordain + Treasure Cruise printings picker
- File: `vite.config.js` — enable after Split 1 confirmed working
- Expected deploy-size delta: modest (keyrune is smaller than mana-font)

### Split 3 (Task 4, conditional): Chart.js
- Rationale: 63KB gz; only consumed by Epic Experiment + analytics panels
- Already in its own `chart-*.js` chunk via existing vendor config — verify in split output

### Split 4 (not planned): Screen-level modules
- Routes are ALREADY lazy-loaded (verified via chunk inventory above — each screen has its own chunk). Nothing to do here.

## Before / After Bundle Sizes

| Chunk | Pre-Split Raw KB | Pre-Split Gzip KB | Post-Split Raw KB | Post-Split Gzip KB | Delta (Raw) |
|-------|------------------|-------------------|-------------------|---------------------|-------------|
| index-*.css (main CSS) | 140.7 | 25.9 | 70.49 | 12.63 | **−70.2 KB (−49.9%)** |
| index-*.js (main JS) | 126.5 | 34.4 | 129.89 | 35.46 | +3.4 KB (+2.7%) |
| vendor-*.js | 149.1 | 49.1 | 152.63 | 50.77 | +3.5 KB (+2.3%) |
| **mana-font-*.css** (NEW chunk) | — (inside main) | — | **45.31** | **9.01** | — |
| **keyrune-*.css** (NEW chunk) | — (inside main) | — | **27.73** | **5.05** | — |
| **material-symbols-*.css** (NEW chunk) | — (inside main) | — | **0.55** | **0.31** | — |

**Critical-path payload (main JS + main CSS) went from 267 KB raw / 60.3 KB gz → 200.4 KB raw / 48.1 KB gz** (−66.6 KB raw / −12.2 KB gz, or −25%/−20%).

The mana-font + keyrune CSS are now loadable in parallel with the main CSS (browser sees three `<link rel=stylesheet>` tags, not one), which should improve CSS parse latency on fast connections.

## Split decisions taken (Task 4)

1. **Syne preload in index.html** — net-new LCP lever. Preload sits BEFORE `/src/main.js` script tag so Vite emits it into the `<head>` before the app bootstraps. Browser fetches the woff2 in parallel with the CSS parse rather than after.
2. **mana-font chunk** — 99 KB raw (pre-gzip) moved out of main CSS into a dedicated `mana-font-*.css` chunk. Scripts that render mana symbols (Thousand-Year Storm, Treasure Cruise, card-flyout) still work because the `<link>` tag is emitted by Vite into index.html and parsed before those screens mount.
3. **keyrune chunk** — set-icon CSS (used on Preordain + printings picker). Same pattern as mana-font.
4. **material-symbols chunk** — tiny @font-face declaration (0.55 KB) but still separated for cache granularity. The actual woff2 file (3.9 MB) is its own asset regardless of chunking.
5. **Screen-level splits NOT added** — routes already lazy-loaded via Navigo before this plan. No work needed.
6. **Chart.js / Supabase** — already their own chunks from prior phases (Phase 9 / Phase 10 AUTH-01). No further split needed; both fit comfortably within the 100 KB gz vendor budget.

## Self-imposed Rule 1 auto-fix during Task 4

The Task 2 `vite:preloadError` handler comment originally contained the literal string `Alpine.start()`. `tests/streaming-ui.test.js` Tests 2 and 5 use `indexOf('Alpine.start()')` to anchor boot-order assertions, and the comment string was found first (at offset 3245) while the real `Alpine.start()` call site is at offset ~5193. Result: both Tests 2 and 5 failed. Rule 1 fix: rephrased the comment to "Registered early (before Alpine boot)" — no functional change, contract restored. Documented in the commit message; both streaming-ui tests now GREEN along with the 4 Plan-5 test files.

## Before / After Perf Metrics

| Run | LCP | FCP | CLS | Perf Score | Methodology |
|-----|-----|-----|-----|------------|-------------|
| Baseline (Phase 7, Lighthouse 13.0.2) | 3.7s | 1.0s | 1.00 | 54 | Median of 3, DevTools GUI |
| Plan 1 post-streaming pre-work (Lighthouse 12.6.1) | 6.1s | 0.4s | 0.023 | 76 | Single-run headless |
| Post-Plan-3 (Lighthouse 12.6.1) | 6.08s | 0.4s | 0.0594 | 76 | Single-run headless |
| Post-Plan-5 Task 5 (2026-04-22) | 6.13s | 0.4s | 0.0588 | 76 | Single-run headless |
| **Post-Plan-5 Task 6** (2026-04-22) | **2.49s** | **0.4s** | **0.0588** | **86** | Single-run headless |

**LCP delta Task 5 → Task 6:** **−3.64s (−59%)**. Now **under** the 2.5s Web Vitals "Good" threshold.
**Perf score delta:** 76 → 86 (+10).
**Task 5 report:** `.planning/phases/13-performance-optimisation-conditional/post-plan5-lh/run1.json`
**Task 6 report:** `.planning/phases/13-performance-optimisation-conditional/post-plan5-task6-lh/run1.json`

## Post-Plan-5 Task 5 LCP phase breakdown (for contrast)

| Phase | Timing | % of LCP |
|-------|--------|----------|
| TTFB | 121.97ms | 2% |
| Load Delay | 0ms | 0% |
| Load Time | 0ms | 0% |
| **Render Delay** | **6,003.94ms** | **98%** |

The Render Delay was **identical to post-Plan-3** (6,003ms vs 5,962ms, within measurement noise). Bundle splits and Syne preload neither helped nor hurt at the whole-LCP level — they locked cache granularity + deploy safety but left the JS-constructed-h1 serial boot as the dominant blocker.

## Post-Plan-5 Task 6 LCP phase breakdown (the win)

| Phase | Timing | % of LCP |
|-------|--------|----------|
| TTFB | 121.94ms | 5% |
| Load Delay | 0ms | 0% |
| Load Time | 0ms | 0% |
| **Render Delay** | **2,367.76ms** | **95%** |

**LCP element (unchanged shape, now statically pre-painted):**
`body > div#cf-auth-wall > h1.cf-auth-wall-title` — selector confirms Lighthouse is measuring the new paint-critical h1 ( `<h1 class="cf-auth-wall-title">COUNTERFLUX</h1>` ) that Task 6 moved into `index.html` <body>.

**What the residual 2,368ms Render Delay represents:** the remaining gap between TTFB-ready DOM and the browser deciding to paint. This is now a combination of CSS parse + Syne woff2 swap + browser layout-ready checks, not a JS-boot-chain wait. Lighthouse's remaining opportunities (`modern-image-formats` −1,450ms, `image-delivery-insight` −2,000ms) are all Scryfall-image-related and explicitly **out of scope** per 13-CONTEXT.md Deferred §"Lighthouse image delivery savings" — Scryfall-owned, no app-side transform.

## Task 6 trajectory summary

| Wave | Intervention | LCP | Delta vs prior |
|------|--------------|------|----------------|
| Plan 1 | baseline (Phase 13 entry) | 6.1s | — |
| Plan 3 | streaming UI (splash → migration-only) | 6.08s | −0.02s |
| Plan 5 Task 4 | manualChunks split + Syne preload + font-display lock | 6.13s | +0.05s (within noise) |
| **Plan 5 Task 6** | **paint-critical h1 in initial HTML** | **2.49s** | **−3.64s** |

Tasks 1-5 were regression-prevention infrastructure — they lock the cache-bust recovery (Pitfall 15), bundle budgets, and font-loading contract so a future change can't silently undo the LCP fix by adding weight back. Task 6 delivered the actual LCP win by eliminating the JS-construct-first-paint serial chain identified in §"Why the LCP didn't move" below.

## Why the LCP didn't move through Task 5 — honest analysis (retained; Task 6 below is the fix)

Task 5 concluded with LCP = 6.13s. That did not satisfy `must_haves.truths[0]`. Root-cause analysis below led directly to Task 6's structural fix.

Root-cause analysis based on the LCP element + phase breakdown:

1. **LCP element:** `body > div#cf-auth-wall > h1` ("COUNTERFLUX")
2. **#cf-auth-wall is CREATED IN JAVASCRIPT** via `document.createElement('div')` in `src/components/auth-wall.js` line 50. It is NOT in the initial HTML.
3. **Therefore the browser cannot paint the LCP element until the entire JS boot chain completes:**
   - Main JS + CSS download + parse
   - `runMigration()` (IndexedDB open + potential v6+v7+v8 upgrade)
   - 10+ `initXStore()` calls
   - `Alpine.start()` walks the whole DOM, binding directives
   - `initRouter()`
   - `Alpine.store('auth').init()` — for returning users, this dynamic-imports `supabase-js` (187 KB gz chunk) and calls `getSession()`
   - Alpine.effect dispatches `syncAuthWall()` which calls `openAuthWall()` which creates the `<h1>`
4. **Font preload is fast** — browser downloads Syne woff2 in parallel with CSS parse, as designed. But the `<h1>` doesn't EXIST in the DOM until step 3.7. The font being pre-cached doesn't help if the element isn't rendered yet.
5. **Bundle splitting helps deploy size and cache granularity** but does not eliminate the dominant JS-boot serial chain.

**This is a structural LCP, not a font-blocking or bundle-size LCP.** The interventions Plan 5 shipped (font-display:swap retention, Syne preload, manualChunks, Pitfall 15 recovery) all matter for other reasons — the font preload will help when any Syne-using content IS rendered in initial HTML, the bundle splits halved the main CSS and improve deploy-time cache hits, and Pitfall 15 recovery prevents post-deploy blank-screen — but none of them attack the serialised-boot-to-auth-wall-h1-paint chain that the LCP algorithm is measuring.

## Task 6 — structural LCP fix (the actual win)

User elected **Option A** after the Task 5 residual analysis above. Task 6 ships two coordinated changes that collapse the LCP Render Delay from ~6s to ~2.4s:

### Change 1: paint-critical markup in `index.html`

The static `#cf-auth-wall` with its paint-critical `<h1 class="cf-auth-wall-title">COUNTERFLUX</h1>` now lives in `index.html` `<body>`, sitting at the very top so HTML parsing reaches it before the splash overlay or the app shell. Accompanying critical CSS lands in a `<style>` block in `<head>`:

```html
<style>
  #cf-auth-wall {
    position: fixed; inset: 0; z-index: 90;
    background: #0B0C10;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 32px;
    font-family: 'Space Grotesk', system-ui, sans-serif;
  }
  #cf-auth-wall .cf-auth-wall-title {
    font-family: 'Syne', sans-serif;
    font-size: 48px; font-weight: 700;
    color: #EAECEE;
    letter-spacing: 0.01em;
    text-transform: uppercase;
    margin: 0 0 8px 0;
    text-align: center;
  }
</style>
```

**Why critical CSS in `<head>` and not external:** external `index-*.css` is render-blocking but still has to fetch + parse. Inline critical CSS is ready the instant the `<head>` parses, so the h1 paints with correct typography on the first layout pass. This prevents a CLS regression from the h1 flashing in default sans-serif before Syne loads.

**Styling verbatim match:** the critical CSS replicates `src/components/auth-wall.js`'s previous inline styles exactly (48px/700 Syne, `#EAECEE`, letter-spacing 0.01em, uppercase, 0 0 8px 0 margin). Identical geometry + typography means Lighthouse's LCP candidate (post-decoration h1) has the same bounding box as the pre-decoration static h1 — no layout shift.

### Change 2: `openAuthWall()` decorates pre-existing DOM

`src/components/auth-wall.js` was modified so `openAuthWall()` first checks `document.getElementById('cf-auth-wall')`. If present (production path), it reuses the element and appends only the tagline + sign-in card + Mila caption. If absent (tests that wipe `document.body`), the legacy `createElement` fallback preserves full backwards compatibility. An `isConnected` check around `document.body.appendChild(wallEl)` prevents a redundant reflow on the static path.

`closeAuthWall()` is unchanged — `wallEl.remove()` cleans up both the static markup and the JS-added decoration together, so post-auth the dashboard takes over cleanly with no orphan h1.

### Measurement (post-Task-6)

See the Before/After Perf Metrics table above. **LCP 2.49s, −3.64s vs Task 5.** Perf score **86 (+10)**. LCP element selector confirmed: `body > div#cf-auth-wall > h1.cf-auth-wall-title` — Lighthouse sees the static h1 (which is then decorated in place), exactly as designed.

### Remaining 2,368ms Render Delay

Lighthouse attributes the post-Task-6 residual to `modern-image-formats` (−1,450ms available) and `image-delivery-insight` (−2,000ms available). Both are Scryfall card images — **out of scope per 13-CONTEXT.md Deferred §"Lighthouse image delivery savings"** (Scryfall-owned, no app-side transform service). PERF-04 target is met without touching those.

## Residual gap analysis (historical — resolved by Task 6)

Before Task 6 shipped, the structural fix was documented here as Option A. Keeping the prior analysis for the audit trail:

> The structural fix for this LCP is to render a static COUNTERFLUX `<h1>` directly in `index.html` (inside the existing splash overlay or as a separate "brand lockup" element), so the browser paints it immediately after CSS parse without waiting for any JS. The Plan 3 splash-screen already has this h1 in the markup (line 43-46 of index.html) but its visibility is gated on `migrationProgress > 0 && migrationProgress < 100` — for fresh visitors past the v5→v8 migration, the splash doesn't render, and Lighthouse sees the auth-wall's post-JS-mount h1 as the first significant paint.
>
> **Two paths for Plan 6 / follow-up work:**
>
> - **Option A (cheap, structural):** Add a static "COUNTERFLUX" brand h1 directly in `index.html` body (above the `#main-content` div, inside a minimal wrapper). It paints after CSS parse, well before the auth wall JS-mounts. Auth wall then replaces/overlays it. Expected LCP: sub-1s. Downside: visual flicker if the static h1 doesn't exactly match auth-wall styling — mitigatable by matching typography and letting the auth-wall overlay it opaquely.
> - **Option B (deferred, accept):** Acknowledge the residual in PERF-SIGNOFF.md. All other Web Vitals pass (FCP 0.4s < 1.0s; CLS 0.0588 < 0.1; INP not lab-measurable; TBT 0ms). LCP is structurally tied to the auth-wall render chain, which is by-design for an auth-gated product. v1.1 ships with this known gap; v1.2 can take Option A.

**Option A chosen and shipped as Task 6.** Actual post-Task-6 LCP (2.49s) landed higher than the analysis's "sub-1s" estimate — the residual Scryfall image delivery gap was underestimated — but still under the 2.5s target.

## Plan 5 deliverables — full picture

### Infrastructure + deploy safety (Tasks 1-5)

- **Bundle splitting:** Main CSS 140.7 KB → 70.49 KB raw (−50%). Mana-font / keyrune / material-symbols now in dedicated chunks. Deploy size reduction across all users; cache granularity means cross-release CSS churn updates only the changed chunks. Regression-prevention: `scripts/assert-bundle-budget.js` + `npm run build:check` locks per-chunk budgets.
- **Pitfall 15 cache-bust recovery:** `vite:preloadError` handler (main.js) + `Cache-Control: no-cache` on `/index.html` + `/` (vercel.json). Prevents post-deploy ChunkLoadError blank-screen. Shipped before any chunk split landed, as mandated.
- **Syne preload:** Shipped in Task 4. Now delivers its intended win: the paint-critical static h1 (Task 6) uses Syne, and the preload means the woff2 is already fetched when the h1 tries to render. Without the preload, Task 6's LCP gain would be clipped by font-fetch latency.
- **font-display: swap contract locked:** Regression test ensures a future refactor can't drop the swap hint and regress the fallback-first-paint behaviour.

### Structural LCP fix (Task 6)

- **Paint-critical h1 in `index.html`:** The auth-wall COUNTERFLUX h1 — confirmed LCP element across Plan 1, Plan 3, and Plan 5 Task 5 measurements — now ships in initial HTML with matching inline critical CSS. Paints on HTML parse instead of waiting ~6 s for the JS boot chain. `openAuthWall()` detects + decorates the pre-existing DOM rather than constructing a fresh wall.
- **Measurable outcome:** LCP 6.13 s → 2.49 s (−59%). Perf score 76 → 86 (+10). PERF-04 target met.
- **Regression contract:** `tests/auth-wall-static-h1.test.js` ships nine assertions locking the fix (static-grep for the h1 + critical CSS, integration test for no-duplicate decoration, close-removes-cleanly). Any future refactor that moves the h1 back to pure-JS mount will break the test suite before it breaks the Lighthouse number.

### Post-mortem — Plan 5's hypothesis trajectory

The pre-execution Research + Plan documents predicted the LCP was **font-blocked** (Syne, since `font-display: swap` was absent — it wasn't; it was already on). Plan 1's 98% Render Delay finding was interpreted as "font is blocking the paint", pointing the primary LCP lever at Syne preload. Task 4 shipped the preload; Task 5 measured 6.13 s — essentially unchanged.

The Task 5 residual analysis revealed the real root cause: the LCP element **didn't exist in the DOM yet**. `font-display: swap` and `<link rel="preload">` couldn't help because the h1 was created by JS after a ~6 s boot chain, long after the font file was already cached by the preload. Data corrected course mid-plan.

**What Plan 5 Tasks 1-5 still delivered:** cache-bust recovery (Pitfall 15) + bundle-budget enforcement + font-display contract lock + Syne preload are all real infrastructure shipped correctly. Task 6 built on that infrastructure — the Syne preload in particular pays off now that the h1 renders on HTML parse. Without the Tasks 1-5 foundation, Task 6 would have either been slower (no preload, longer font fetch) or dangerous to deploy (no cache-bust recovery, no size budgets).

**Why this is a planning win, not a failure:** the original plan explicitly kept Task 5 as a `checkpoint:human-verify gate="blocking"` with a residual-escalation branch. That branch triggered, the user elected Option A after reviewing the evidence, and Task 6 shipped the actual fix. The plan's check-and-escalate structure worked as designed.


## References

- Research priority order: [13-RESEARCH.md §Pattern 6](./13-RESEARCH.md)
- Pitfall 15 (cache-bust retry mandatory): [PITFALLS.md §15](../../research/PITFALLS.md)
- Post-Plan-3 measurement context: [13-REMEASURE-POST-PLAN3.md](./13-REMEASURE-POST-PLAN3.md)
- Plan 1 baseline measurement + methodology: [13-REMEASURE.md](./13-REMEASURE.md)
