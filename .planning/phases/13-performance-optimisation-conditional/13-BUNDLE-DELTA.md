# Phase 13 Plan 5 — Bundle Splitting & Font-Display Audit

**Triggered:** Plan 1 Branch B (LCP 6.1s) + post-Plan-3 re-measurement (LCP 6.08s, 98% Render Delay) confirmed LCP target still missed after streaming-UI shipped
**Pre-split LCP (post-Plan-3):** 6.08s (Lighthouse 12.6.1, desktop preset, headless Chromium)
**Target:** LCP < 2.5s
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

| Chunk | Pre-Split Raw KB | Pre-Split Gzip KB | Post-Split Raw KB | Post-Split Gzip KB | Delta |
|-------|------------------|-------------------|-------------------|---------------------|-------|
| index-*.css (main CSS) | 140.7 | 25.9 | TBD Task 4 | TBD Task 4 | — |
| index-*.js (main JS) | 126.5 | 34.4 | TBD Task 4 | TBD Task 4 | — |
| vendor-*.js | 149.1 | 49.1 | TBD Task 4 | TBD Task 4 | — |
| mana-font chunk | (inside main CSS) | — | TBD Task 4 | TBD Task 4 | — |
| keyrune chunk | (inside main CSS) | — | TBD Task 4 | TBD Task 4 | — |

## Before / After Perf Metrics

| Run | LCP | FCP | CLS | Perf Score | Methodology |
|-----|-----|-----|-----|------------|-------------|
| Baseline (Phase 7, Lighthouse 13.0.2) | 3.7s | 1.0s | 1.00 | 54 | Median of 3, DevTools GUI |
| Plan 1 post-streaming pre-work (Lighthouse 12.6.1) | 6.1s | 0.4s | 0.023 | 76 | Single-run headless |
| Post-Plan-3 (Lighthouse 12.6.1) | 6.08s | 0.4s | 0.0594 | 76 | Single-run headless |
| **Post-Plan-5** (Task 5 human-verify) | TBD | TBD | TBD | TBD | Single-run headless |

## References

- Research priority order: [13-RESEARCH.md §Pattern 6](./13-RESEARCH.md)
- Pitfall 15 (cache-bust retry mandatory): [PITFALLS.md §15](../../research/PITFALLS.md)
- Post-Plan-3 measurement context: [13-REMEASURE-POST-PLAN3.md](./13-REMEASURE-POST-PLAN3.md)
- Plan 1 baseline measurement + methodology: [13-REMEASURE.md](./13-REMEASURE.md)
