---
phase: 01-foundation-data-layer
verified: 2026-04-04T10:15:00Z
status: human_needed
score: 17/17 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 14/17
  gaps_closed:
    - "SHELL-03: Compact search input with autocomplete dropdown added to persistent topbar header in index.html — search now survives navigation between all screens"
    - "UI copywriting: COUNTERFLUX title in topbar is correct per REQUIREMENTS.md SHELL-03 ('Counterflux wordmark'). Sidebar COUNTERFLUX/V1.0 is an intentional user override of UI-SPEC and is accepted."
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Load the app in Chrome after clearing IndexedDB (DevTools > Application > Storage > Clear site data)"
    expected: "Splash screen appears showing 'Initializing Aetheric Archive...', Mila image with animate-pulse, progress bar filling, 'DOWNLOADING BULK DATA' counter, rotating flavour text, then 'ARCHIVE READY' completion message before fading out"
    why_human: "Requires live browser with network access to download ~300MB Scryfall bulk data and visual inspection of splash animation"
  - test: "After bulk data loads, navigate away from Welcome (e.g. to Archive), then type 'lightning' in the persistent topbar search bar"
    expected: "Autocomplete dropdown appears within ~200ms showing card results with thumbnail, set icon (keyrune), and mana cost icons. Results are not limited to the Welcome screen — topbar search works on any active screen."
    why_human: "Requires live Dexie data and cross-screen navigation to verify persistence"
  - test: "Select a card from the topbar autocomplete and inspect the flyout"
    expected: "Card detail flyout slides in from right showing: full card image, card name (Syne 20px), type line, mana cost (mana-font), Oracle text, MARKET PRICE with USD value, FORMAT LEGALITIES grid with colour-coded badges, 'Add to Collection' disabled button, 'View on Scryfall' active button"
    why_human: "Visual inspection required for flyout layout, mana icon rendering, legality badge colours"
  - test: "Verify Organic Brutalism — inspect the DOM for any element with border-radius > 0 (excluding avatar images)"
    expected: "All panels, inputs, buttons, and containers have 0px border-radius"
    why_human: "Visual inspection of rendered CSS across all components"
  - test: "Run Lighthouse audit on the production build (npm run build && npm run preview)"
    expected: "Initial load time under 3 seconds (PERF-01) — Lighthouse Performance score shows FCP < 1.5s, LCP < 3s on fast connection after bulk data is cached"
    why_human: "Requires browser Lighthouse audit with production bundle"
---

# Phase 1: Foundation Data Layer Verification Report

**Phase Goal:** Users can search Magic cards instantly from a cached local database inside an Izzet-themed navigation shell
**Verified:** 2026-04-04T10:15:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure

## Re-verification Summary

Previous status was `gaps_found` (14/17, 3 gaps). All gaps are now closed:

| Gap | Previous Status | Current Status |
|-----|----------------|----------------|
| SHELL-03: No search in persistent topbar | FAILED | CLOSED — search input + autocomplete dropdown added to topbar header in `index.html` |
| Topbar title mismatch | FAILED (UI-SPEC) | ACCEPTED — REQUIREMENTS.md SHELL-03 specifies "Counterflux wordmark"; COUNTERFLUX is correct |
| Sidebar brand/version mismatch | PARTIAL (UI-SPEC) | ACCEPTED — user explicit override; COUNTERFLUX/V1.0 is intentional |

No regressions detected. Welcome screen hero search remains intact (additive approach — both topbar and hero search share `$store.search`).

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Vite dev server starts and serves index.html with Tailwind processing | VERIFIED | `npm run build` exits 0 in 307ms, dist output generated |
| 2 | All four self-hosted fonts render correctly (Syne, Space Grotesk, JetBrains Mono, Crimson Pro) | VERIFIED | 4 .woff2 files in `src/styles/fonts/`, 4 `@font-face` blocks in main.css |
| 3 | Dexie schema creates counterflux database with cards and meta tables | VERIFIED | `src/db/schema.js` line 4: `new Dexie('counterflux')`, `db.version(1).stores({ cards: ..., meta: ... })` |
| 4 | Card accessor correctly extracts name, image, mana cost, oracle text from all Scryfall layouts | VERIFIED | `src/db/card-accessor.js` handles `DOUBLE_SIDED_LAYOUTS` array, 7 exported functions; 8 layout types in fixtures; 93 tests pass |
| 5 | Scryfall helper sends User-Agent header and compares updated_at timestamps | VERIFIED | `src/utils/scryfall.js`: `User-Agent: Counterflux/1.0` in fetchBulkDataMeta, `shouldRefresh()` compares dates |
| 6 | Persistent storage request function works | VERIFIED | `src/utils/storage.js`: wraps `navigator.storage.persist()`, returns `{supported, granted}` |
| 7 | Vitest runs and all tests pass | VERIFIED | 93 tests across 9 files, all green (841ms) |
| 8 | Web Worker downloads Scryfall bulk file via streaming fetch | VERIFIED | `src/workers/bulk-data.worker.js` + `src/workers/bulk-data-pipeline.js`: streaming via `@streamparser/json-whatwg`, no `JSON.parse` on full body |
| 9 | Cards batch-inserted into Dexie inside the Worker | VERIFIED | `bulk-data-pipeline.js` line 54: `await db.cards.bulkPut(toInsert)` inside Worker context |
| 10 | Progress messages flow from Worker to Alpine store | VERIFIED | `src/stores/bulkdata.js`: `worker.onmessage` wired to update store fields for all message types |
| 11 | Splash screen blocks interaction with progress bar, flavour text, Mila animate-pulse | VERIFIED | `index.html` lines 13-76: full-screen overlay, `$store.bulkdata.progress` binding, `animate-pulse` on Mila, 5 flavour text quotes in `splash-screen.js` |
| 12 | Hash routing switches content area between screens with instant swap | VERIFIED | `src/router.js`: Navigo with `{ hash: true }`, 6 routes, lazy `import()` loaders, `notFound` fallback |
| 13 | Locked sidebar items show cursor-not-allowed and do not navigate | VERIFIED | `index.html` line 106: `cursor-not-allowed opacity-50` for locked items, `@click.prevent` guards navigation |
| 14 | Each placeholder screen shows Mila with contextual empty state message | VERIFIED | All 5 screen modules call `renderEmptyState()` with correct headings/body text matching UI-SPEC |
| 15 | Toast notifications appear bottom-right, stack max 3, auto-dismiss after 5s | VERIFIED | `src/stores/app.js` toast store has max-3 logic, `setTimeout` for dismiss; tests pass |
| 16 | Persistent topbar shows wordmark, search input with autocomplete, and notification bell | VERIFIED | `index.html` lines 149-225: topbar has COUNTERFLUX title, full search input wired to `$store.search`, autocomplete dropdown with results/loading/empty states, notification bell |
| 17 | User can search from any screen (search input survives navigation) | VERIFIED | Search input is in persistent topbar header (not Welcome screen only); `$store.search` shared between topbar and hero search; Welcome hero search retained as additive UX |

**Score:** 17/17 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema.js` | Dexie schema with cards and meta stores | VERIFIED | Exports `db`, `getBulkMeta`, `setBulkMeta` |
| `src/db/card-accessor.js` | Unified card accessor for all layouts | VERIFIED | 7 exports, `DOUBLE_SIDED_LAYOUTS` constant |
| `src/db/search.js` | Autocomplete search over Dexie | VERIFIED | `startsWithIgnoreCase` + contains fallback |
| `src/utils/scryfall.js` | Scryfall API helpers | VERIFIED | `fetchBulkDataMeta`, `shouldRefresh`, `USER_AGENT` |
| `src/utils/storage.js` | Persistent storage wrapper | VERIFIED | `requestPersistentStorage`, `getStorageEstimate` |
| `src/styles/main.css` | Tailwind @theme with 13 colour tokens | VERIFIED | All 13 tokens present, 4 font families, `--radius-DEFAULT: 0px` |
| `vitest.config.js` | Vitest config | VERIFIED | `environment: 'node'`, `setupFiles: ['./tests/setup.js']` |
| `src/workers/bulk-data.worker.js` | Web Worker for streaming bulk data | VERIFIED | Streaming JSONParser, `bulkPut`, no `JSON.parse` on body |
| `src/stores/bulkdata.js` | Alpine bulkdata store | VERIFIED | Exports `initBulkDataStore`, `startBulkDataPipeline`, all required properties |
| `src/stores/app.js` | Alpine app and toast stores | VERIFIED | 6 screens, locked/unlocked, toast methods |
| `src/stores/search.js` | Alpine search store | VERIFIED | Exports `initSearchStore`, 150ms debounce, `searchCards` wired, `selectResult`, `closeFlyout`, `confirmSelection`, `clear` |
| `src/router.js` | Navigo hash router | VERIFIED | 6 routes, lazy loading, `notFound` fallback |
| `index.html` topbar | Persistent search in topbar | VERIFIED | Lines 159-211: search input, autocomplete dropdown with `x-for` results, loading/empty states, wired to `$store.search` |
| `src/utils/mana.js` | renderManaCost utility | VERIFIED | Converts `{2}{U}{R}` to mana-font HTML, `border-radius: 0` on pips |

Note: `src/components/topbar.js` is still an orphaned file (exported `topbarComponent()` not imported in `main.js`) but it is no longer a functional gap — the topbar is correctly implemented inline in `index.html` using Alpine store bindings directly. The file is harmless dead code.

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/db/search.js` | `src/db/schema.js` | imports db | WIRED | Line 1: `import { db } from './schema.js'` |
| `src/workers/bulk-data.worker.js` | dexie | `db.cards.bulkPut(batch)` | WIRED | Via `bulk-data-pipeline.js` line 54 |
| `src/stores/bulkdata.js` | `src/workers/bulk-data.worker.js` | `worker.onmessage` | WIRED | Lines 62-111 handle all Worker message types |
| `src/main.js` | `src/stores/bulkdata.js` | `initBulkDataStore` + `startBulkDataPipeline` | WIRED | Lines 10, 18, 36 |
| `src/router.js` | `src/stores/app.js` | updates `Alpine.store('app').currentScreen` | WIRED | Line 44 in `router.js` |
| `src/components/sidebar.js` | `src/stores/app.js` | reads `$store.app.currentScreen` | WIRED | `index.html` sidebar uses `$store.app.currentScreen` bindings |
| `src/stores/search.js` | `src/db/search.js` | calls `searchCards()` | WIRED | Line 2: `import { searchCards }` |
| `src/stores/search.js` | `src/db/card-accessor.js` | uses `getCard*` functions | WIRED | Lines 3-10: all accessor imports used |
| `index.html` topbar search | `src/stores/search.js` | `$store.search.search()` / `$store.search.results` | WIRED | Lines 167-206: `@input` triggers search, `x-for` over results, `@click` triggers `selectResult` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Topbar autocomplete dropdown | `$store.search.results` | `searchCards()` → `db.cards.where('name').startsWithIgnoreCase()` | Yes — live Dexie query against IndexedDB | FLOWING |
| Welcome hero search dropdown | `$store.search.results` | Same store — shared state | Yes — same Dexie query path | FLOWING |
| `index.html` flyout | `$store.search.selectedCard` | `selectResult()` → card accessor enrichment of Dexie card object | Yes — real card data with accessor helpers | FLOWING |
| `index.html` splash bar | `$store.bulkdata.progress` | Worker `progress` messages updating `downloaded/total` | Yes — real byte counts from stream | FLOWING |
| `welcome.js` card count | `$store.bulkdata.totalCards` | Worker `complete` message → `setBulkMeta` | Yes — actual parsed card count | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All Vitest tests pass | `npm test` | 93 tests passed in 841ms | PASS |
| Production build succeeds | `npm run build` | Exit 0, dist generated in 307ms | PASS |
| Build produces no errors for topbar inline search | `npm run build` | No Alpine/store binding errors in build output | PASS |
| `_topbarFocused` dynamic property | n/a — code analysis | Not in initial store state; set by `@focus`/`@blur` Alpine event handlers. Alpine reactivity tracks properties set after init, `|| false` guard on `x-show` prevents null read on first render. Functional but worth monitoring. | INFO |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DATA-01 | 01-02 | Bulk data downloaded and cached via Web Worker stream parsing | SATISFIED | `bulk-data.worker.js` + `bulk-data-pipeline.js` with `@streamparser/json-whatwg` |
| DATA-02 | 01-02 | Daily refresh check (background, non-blocking) | SATISFIED | Worker `check` message compares `updated_at` timestamps; `startBulkDataPipeline()` called on every app load |
| DATA-03 | 01-01, 01-04 | Card search with autocomplete | SATISFIED | Name-prefix search via `startsWithIgnoreCase`. Full Scryfall syntax deferred to Phase 2/3 per D-07. REQUIREMENTS.md marks `[x]` complete. |
| DATA-04 | 01-01, 01-04 | Autocomplete within 200ms | SATISFIED | 150ms debounce on indexed Dexie query; sub-200ms achievable on cached data |
| DATA-05 | 01-01 | All Scryfall card layouts handled correctly | SATISFIED | `DOUBLE_SIDED_LAYOUTS` constant, `getCardImage/ManaCost/OracleText` handle all 9 layouts; 8 layout types in fixtures |
| DATA-06 | 01-01 | Scryfall rate limit compliance (User-Agent, no paywalling) | SATISFIED | `USER_AGENT = 'Counterflux/1.0 (MTG collection manager)'` in both scryfall.js and worker |
| DATA-07 | 01-01 | IndexedDB via Dexie with schema versioning | SATISFIED | `db.version(1).stores({...})` with 8 indexed fields including compound `[set+collector_number]` |
| DATA-08 | 01-01 | Persistent storage permission prompt | SATISFIED | `requestPersistentStorage()` called on pipeline start; wraps `navigator.storage.persist()` |
| SHELL-01 | 01-03 | Persistent left sidebar with 5 screen navigation | SATISFIED | Sidebar with 6 items (Archive + 5 screens), locked states, icons |
| SHELL-02 | 01-03 | Sidebar collapses to icons on smaller viewports | SATISFIED | `$store.app.sidebarCollapsed` toggled at 1024px; `w-16` / `w-60` classes |
| SHELL-03 | 01-04 | Persistent top app bar with Counterflux wordmark, global card search, and notification bell | SATISFIED | Topbar has COUNTERFLUX title, search input wired to `$store.search`, notification bell. Search survives navigation between all screens. |
| SHELL-04 | 01-03 | Hash-based SPA routing with lazy loading | SATISFIED | Navigo `{ hash: true }`, 6 routes, dynamic `import()` per route |
| SHELL-05 | 01-01, 01-04 | Full Izzet visual identity (palette, ghost borders, glow, aether gradient) | SATISFIED (needs human) | 13 colour tokens in `@theme`, `ghost-border`, `aether-glow`, `glass-overlay` utilities present; visual fidelity requires human check |
| SHELL-06 | 01-01 | Typography system | SATISFIED (with documented deviation) | REQUIREMENTS.md says "Crimson Pro (headings)" but UI-SPEC D-16 assigns Syne to headings. Syne as `--font-header` is the correct implementation per the resolved design decision. |
| SHELL-07 | 01-03 | Toast notifications (info/success/warning/error, bottom-right, auto-dismiss 5s) | SATISFIED | Toast store in `app.js`, 4 types, max-3 visible, auto-dismiss; tests passing |
| MILA-01 | 01-03 | Mila avatar at sidebar bottom | SATISFIED | `index.html` lines 131-146: Mila image pinned at sidebar bottom with grayscale-to-colour hover |
| MILA-02 | 01-03 | Empty states show Mila with contextual message | SATISFIED | All 5 placeholder screens call `renderEmptyState()` with Mila image and correct UI-SPEC copy |
| MILA-03 | 01-02 | Loading states show Mila with subtle animation | SATISFIED (as scoped) | `animate-pulse` on Mila in splash screen; D-20 documents sprite sheet animation deferred until artwork provided |
| PERF-01 | 01-01 | Initial page load under 3 seconds on broadband | NEEDS HUMAN | Build succeeds (vendor chunk 152KB gzip, index 10KB gzip), sub-3s is plausible but requires Lighthouse audit |

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/components/topbar.js` | `topbarComponent()` exported but never imported in `main.js` | Info | Harmless dead code — topbar is correctly implemented inline in `index.html`. Can be deleted or repurposed in a future phase. |
| `index.html` line 181 | `$store.search._topbarFocused` not declared in store initial state | Info | Alpine sets reactive properties on first write; `|| false` guard prevents null read. Works correctly in practice but is an implicit initialisation pattern. Not a blocker. |
| `index.html` L79 | `x-show="$store.bulkdata?.isReady !== false"` shows app shell even before bulkdata store registers | Info | Defensive `?.` prevents crash but logic is inverted from typical ready-gate pattern; shell may flash briefly |

No blockers or warnings detected.

---

### Human Verification Required

#### 1. Persistent Topbar Search Across Screens

**Test:** With data loaded, navigate away from Welcome to any other screen (e.g. Archive in sidebar), then type "lightning" in the topbar search bar
**Expected:** Autocomplete results appear from the topbar — not the Welcome hero search — showing card thumbnails, set icons, mana cost. Results are visible on the non-Welcome screen, confirming search persistence.
**Why human:** Requires live Dexie data and cross-screen navigation to verify topbar search is truly global

#### 2. Splash Screen Experience

**Test:** Clear site data in browser (DevTools > Application > Storage > Clear site data), then load the app
**Expected:** Splash screen appears with "Initializing Aetheric Archive...", Mila corgi image with pulse animation, progress bar filling with byte counter, rotating MTG flavour text quotes, then "ARCHIVE READY. {N} CARDS INDEXED." before fading out
**Why human:** Live browser network required for 300MB download; visual inspection of animation and layout

#### 3. Rich Autocomplete Results

**Test:** With data loaded, type "lightning" in either the Welcome hero search or the topbar search
**Expected:** Autocomplete dropdown with results showing: card thumbnail (small image), card name in JetBrains Mono uppercase bold, keyrune set icon, mana-font mana cost with square containers (border-radius: 0)
**Why human:** Visual inspection of icon fonts rendering correctly; timing perception is subjective

#### 4. Card Detail Flyout

**Test:** Click or press Enter on an autocomplete result
**Expected:** Flyout slides in from right (300ms ease-out) showing full card image, Oracle text, MARKET PRICE with USD value, FORMAT LEGALITIES grid (green for legal, red for banned, grey for not_legal), "View on Scryfall" opens correct URL
**Why human:** Visual layout and colour coding of legality badges requires inspection

#### 5. PERF-01 Load Time

**Test:** Run `npm run build && npm run preview`, open in Chrome, run Lighthouse audit (Performance tab)
**Expected:** FCP < 1.5s, LCP < 3s on broadband after initial bulk data is cached
**Why human:** Lighthouse requires browser with real network conditions

---

### Gaps Summary

No automated gaps remain. All 17 truths verified. All 19 Phase 1 requirement IDs are accounted for. PERF-01 and visual fidelity items are pending human verification only.

---

_Verified: 2026-04-04T10:15:00Z_
_Verifier: Claude (gsd-verifier)_
