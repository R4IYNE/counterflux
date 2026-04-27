# Phase 13: Performance Optimisation (conditional) - Research

**Researched:** 2026-04-20
**Domain:** Web performance measurement + targeted optimisation (streaming UI, CLS, bfcache, bundle splitting, CI soft-gate)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Scope & sequencing:**
- **D-01: Hybrid structure.** Plan 1 is a re-measurement plan — fresh Lighthouse desktop run (median of 3) + web-vitals capture against `vite preview` on the final v1.1 build. Plans 2+ are derived from the re-measured numbers, not speculated from the v1.0 baseline.
- **D-02: Conditional exit is honored.** If re-measurement shows LCP < 2.5s AND CLS < 0.1 AND FCP < 1.0s AND INP < 200ms, Phase 13 closes with PERF-SIGNOFF.md only — no code changes ship. Matches ROADMAP success criterion 3.
- **D-03: Fallback scope when targets missed.** Ship two near-zero-risk freebies (non-composited animation + bfcache investigation — see D-08/D-09) alongside whichever targeted fixes the re-measurement justifies. Anything beyond that is gated on measured gap > target.

**Bulk-data first-load strategy (executes only if LCP misses target):**
- **D-04: Streaming UI (shell-first).** Remove the full-screen splash overlay as the boot gate. Dashboard and unaffected screens render immediately after `runMigration()` + store init completes. Bulk-data pipeline continues in the background (it's already async; `startBulkDataPipeline()` in `src/main.js` is fire-and-forget).
- **D-05: Shell scope = collection-only loading.** Only two user flows show a "bulk data still loading" placeholder:
  1. Treasure Cruise add-card flow (requires bulk data for autocomplete)
  2. Thousand-Year Storm card-search autocomplete (same dependency)
  All other screens render without bulk data: Dashboard (Epic Experiment), Deck Builder non-search paths (deck list, deck editor rendering, analytics on existing decks), Market Intel (Preordain), Game Tracker (Vandalblast), Collection Manager grid.
- **D-06: Progress signal = topbar pill.** Persistent pill in the topbar adjacent to the sync-status chip / notification bell showing `Downloading card archive — N%`. Matches the existing sync-chip visual pattern. Auto-dismisses on `$store.bulkdata.status === 'ready'`.

**CLS fix approach:**
- **D-07: Audit-driven.** Re-measurement (Plan 1) enumerates the top CLS contributors post-streaming-UI. No speculative pre-work.
- **D-08: Non-composited animation fix is always in scope.** 5-minute change, near-zero regression risk, worth shipping regardless of re-measurement.
- **D-09: bfcache investigation is always in scope.** Flagged by baseline (1 failure reason). If cheap, fix. If structural, document and defer.

**Bundle splitting:**
- **D-10: Data-driven only.** Gated on re-measured LCP > 2.5s *after* D-04 streaming-UI lands. Priority order if triggered: mana-font, keyrune CSS, Chart.js audit, route-level splitting. Must respect Pitfall 15.

**CI gating:**
- **D-11: Soft gate.** Add `@lhci/cli` assertions that emit warnings (not failures) when LCP/CLS/FCP/INP cross "Good" thresholds.
- **D-12: `npm run perf` remains the primary manual tool.** Soft-gate is a net-new artefact for automated awareness.

**Sign-off artefact:**
- **D-13: New file: `.planning/phases/13-performance-optimisation-conditional/13-PERF-SIGNOFF.md`.** Contents: re-measured median-of-3 numbers, delta vs Phase 7 baseline, list of optimisations that shipped, verdict line `v1.1 meets perf budget`, timestamp, methodology reproducibility note.
- **D-14: PERF-BASELINE.md remains frozen.** Do not mutate the Phase 7 artefact. PERF-SIGNOFF.md cross-references it.

### Claude's Discretion

- Exact placeholder UX on Treasure Cruise add-flow and card-search autocomplete (skeleton shape, empty-state wording, visual density)
- Exact pill styling within the topbar-chip visual vocabulary (border, animation on progress update, text formatting of N%)
- Specific bfcache blocker to remove (if investigation finds multiple, prioritise the cheapest)
- `@lhci/cli` soft-gate mechanism (GitHub Action PR-comment vs non-failing build step vs status-check only)
- Bundle-splitting boundaries if D-10 triggers
- Placeholder min-height values (must support skeleton layout without reintroducing CLS — target < 0.1)
- `will-change: transform` placement specifics for D-08

### Deferred Ideas (OUT OF SCOPE)

- Chunked download with resume (rejected — streaming-UI is the better primary fix)
- Slimmer bulk variant (oracle_cards vs default_cards) — rejected; breaks COLLECT-04
- Hard CI gate on perf regression — deferred to v1.2
- Lighthouse "image delivery savings" (Scryfall-owned)
- Lighthouse "minify JS savings" (folded into D-10)
- Splash flavour-text retention (defer to v1.2 as Mila easter-egg)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERF-04 | Any regressions identified in baseline measurement are addressed (candidates: splash → bulk data deferral, store init, bundle splitting) to hit the agreed target | Re-measurement protocol (Standard Stack §Measurement), streaming-UI blast-radius map (Architecture §Streaming UI), bfcache root-cause (Common Pitfalls §bfcache), soft-gate config (Code Examples §LHCI warn assertions), signoff template (Code Examples §PERF-SIGNOFF template). All conditional fixes have pre-mapped implementation patterns so planner can spawn Plans 2+ directly from Plan 1's measured gaps. |
</phase_requirements>

## Summary

Phase 13 is unusual among v1.1 phases: its **first plan is a measurement, not an implementation**. Plan 1's output is a decision branch — either Phase 13 closes with a documentation-only signoff (Branch A), or it spawns Plans 2+ to ship the specific fixes the re-measurement justified (Branch B). All of the conditional fixes have been researched upfront so that Branch B can move directly from "measured gap" to "plan spec" without a second research round.

The Phase 7 baseline (2026-04-15) captured **LCP 3.7s, CLS 1.00, FCP 1.0s, Perf 54** against a v1.0 + Plan 1 polish codebase. Since then, v1.1 has shipped auth wall, sync chip, notification bell, reconciliation modals, and the spoiler-gallery rewrite — none of which existed in the baseline. The baseline's three critical flags (CLS 1.00 dominated by the splash→dashboard swap, LCP 3.7s dominated by the splash-screen progress UI itself, bulk-data 5-min first-visit block) point at the same root cause: **the full-screen splash overlay gates app boot on a ~510MB download**. D-04's streaming-UI removes that overlay, which is expected to collapse all three metrics in one refactor.

**Primary recommendation:** Execute Plan 1 (re-measurement) first. If LCP/CLS/FCP/INP are all green, ship PERF-SIGNOFF.md and close. If any miss, Plan 2 is always-in-scope freebies (D-08 non-composited animation + D-09 bfcache fix: close Dexie on `pagehide`, reopen on `pageshow`). Plan 3+ is conditional on what missed — most likely D-04 streaming-UI if LCP > 2.5s. Bundle splitting (D-10) is last-resort, gated on LCP still > 2.5s *after* streaming-UI lands.

## Standard Stack

### Core — already installed, reused verbatim
| Library | Version (locked) | Purpose | Why Standard |
|---------|------------------|---------|--------------|
| `web-vitals` | 5.2.0 | LCP/INP/CLS/FCP/TTFB runtime capture | Phase 7 already shipped; Pitfall 11 already mitigated via lazy-load + requestIdleCallback in `src/main.js`. Plan 1 re-measurement MUST reuse — do not introduce parallel instrumentation. |
| `@lhci/cli` | 0.15.1 | Lighthouse CI runner (desktop-preset, vite preview target) | Already wired in `package.json` + `lighthouserc.cjs`. D-11 soft-gate extends by adding an `assert` block with `warn`-level thresholds. |
| Lighthouse | 13.x (via @lhci/cli) | Lab-condition perf measurement | Phase 7 baseline was Lighthouse 13.0.2 — keep **the same Lighthouse version** for the re-measurement so the comparison is apples-to-apples. |

**Version verification (2026-04-20):**
```bash
npm view @lhci/cli version     # 0.15.1 — matches installed
npm view web-vitals version    # 5.2.0 — matches installed
```
No version drift since Phase 7. Lighthouse version ships bundled inside @lhci/cli — verify `npx lhci --version` returns the same major Lighthouse version as the baseline run before Plan 1 executes. If `@lhci/cli` has auto-updated to a newer Lighthouse internally, that biases the comparison and must be flagged in PERF-SIGNOFF.md's methodology section.

### Supporting — new for Phase 13 (conditional)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| — | — | No new dependencies. | All fixes are native browser APIs (Performance API, pagehide/pageshow, dynamic import) + CSS (`will-change: transform`) + existing Vite chunking. |

Deliberate non-addition. The baseline already shipped the heavy tooling; Phase 13 is "use what we have, better." Adding a new perf library here would itself regress perf.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @lhci/cli `warn` assertions | GitHub Action PR-comment bot (`treosh/lighthouse-ci-action`) | Action posts a table on every PR; more visible, but more moving parts. Default to native `warn` assertions; escalate to Action only if the warnings aren't being read. |
| @lhci/cli `warn` assertions | Calibre / SpeedCurve / Vercel Analytics | External SaaS, ongoing cost. Over-scoped for a solo-developer project; rejected per D-11's "solo-dev tradeoff" rationale. |
| Vite chunk splitting for mana-font | Switch to SVG symbol set (inline) | ~99KB → ~15KB savings in theory, but requires refactoring every `<i class="ms">` consumer. Deferred to v1.2 if D-10 triggers and mana-font is still the top offender after naive code-split. |

**Installation:** None. Reuse existing stack.

## Architecture Patterns

### Recommended artefact layout (Phase 13)
```
.planning/phases/13-performance-optimisation-conditional/
├── 13-CONTEXT.md              # (exists)
├── 13-RESEARCH.md             # (this file)
├── 13-DISCUSSION-LOG.md       # (exists)
├── 13-01-PLAN.md              # Re-measurement (unconditional)
├── 13-01-RE-MEASURE.md        # Plan 1 output: median-of-3 numbers + branch decision
├── 13-02-PLAN.md              # Freebies (D-08 non-composited + D-09 bfcache) — ships if any gap OR if user wants the wins anyway
├── 13-03-PLAN.md              # Streaming-UI refactor (conditional on LCP/CLS miss)
├── 13-04-PLAN.md              # CLS targeted fixes (conditional)
├── 13-05-PLAN.md              # Bundle splitting (conditional on LCP still > 2.5s post-streaming-UI)
├── 13-06-PLAN.md              # @lhci/cli soft-gate (unconditional closer)
└── 13-PERF-SIGNOFF.md         # Final artefact — delta vs baseline + verdict
```

**Plan numbering is reserved regardless of branch.** If Plan 1's re-measurement is green, Plan 2–5 skip and Plan 6 (soft-gate) still ships. If Plan 1 shows a gap, downstream plans activate sequentially with re-measurement gates between them.

### Pattern 1: Plan 1 Re-Measurement Protocol (unconditional)

**What:** Reproduce the Phase 7 baseline methodology exactly against the final v1.1 `vite preview` build, producing a median-of-3 number set plus a web-vitals console snapshot from a real dev session.

**When to use:** Always. This is the branch decision for Phase 13.

**Methodology contract (NON-NEGOTIABLE — mirrors `PERF-BASELINE.md` §Methodology):**
1. Verify Lighthouse version still matches baseline (`npx lhci --version` — flag any drift in PERF-SIGNOFF.md).
2. `npm run build && npm run preview` — vite preview on port 4173.
3. Open Chromium 146+ (same major version as baseline) → DevTools Lighthouse panel → desktop preset → Performance only → single-page-session mode → custom throttling.
4. Run 3 times, capture FCP, LCP, TBT, CLS, SI, Perf score each time.
5. Compute median (middle value per metric).
6. Capture INP separately from `npm run dev` + web-vitals console.table after ~30s of real interaction (click through Treasure Cruise, open a deck, trigger a search).
7. Record Lighthouse's "IndexedDB pre-populated" warning state (same warning in Phase 7 baseline — note whether it still appears; if suppressed by incognito run, flag methodology divergence).

**Example (code template for plan file):**
```markdown
## Plan 1 — Re-measurement results (2026-04-{XX})

| Metric | Run 1 | Run 2 | Run 3 | Median | Phase 7 Baseline | Delta | Rating |
|--------|-------|-------|-------|--------|------------------|-------|--------|
| FCP    |       |       |       |        | 1.0s             |       |        |
| LCP    |       |       |       |        | 3.7s             |       |        |
| CLS    |       |       |       |        | 1.00             |       |        |
| TBT    |       |       |       |        | 0ms              |       |        |
| INP    |       |       |       |        | —                |       |        |

**Branch decision:**
- [ ] Branch A: All targets met (LCP < 2.5s, CLS < 0.1, FCP < 1.0s, INP < 200ms) → ship PERF-SIGNOFF.md, close phase
- [ ] Branch B: Gap identified → spawn Plan 2 freebies + conditional plans per measured gap
```

### Pattern 2: Streaming UI (D-04) — boot-order blast radius

**What:** Remove the full-screen splash overlay as a boot gate. Dashboard renders immediately after `runMigration()` + store init. Only two flows show "bulk data loading" placeholders (Treasure Cruise add-card, Thousand-Year Storm card-search). All other screens render unconditionally.

**Critical boot-order contract (UNCHANGED by D-04 — re-affirmed here so planner doesn't accidentally regress Pitfall 8):**

Current order in `src/main.js:bootApp()` (lines 39-202):
1. `window.Alpine = Alpine` + `initBulkDataStore()` (line 46-47)
2. `await runMigration()` (line 50) — **gates everything below**
3. `initAppStore()` … `initGameStore()` (lines 57-67) — all remaining stores
4. Register Alpine components (`Alpine.data('splashScreen', ...)`, `Alpine.data('sidebarComponent', ...)`) (lines 87-88)
5. Notification bell popover inject (lines 93-96)
6. `Alpine.start()` (line 99)
7. `initRouter()` (line 102)
8. `Alpine.store('auth').init()` (line 107)
9. `Alpine.effect` → auth-wall sync (lines 113-126) — **gates UI behind auth**
10. `Alpine.effect` → profile hydrate (lines 137-147)
11. `Alpine.effect` → sync-engine lifecycle (lines 155-168)
12. `startBulkDataPipeline()` fire-and-forget (lines 178-185)
13. web-vitals lazy-load via requestIdleCallback (dev only) (lines 190-197)

**D-04 constrains changes:**
- Steps 1-11 remain unchanged. Migration still gates stores. Auth-wall still renders before anything sync-eligible. Pitfall 8 (Auth State Race) is preserved.
- Splash removal happens at step 6-7 — the splash Alpine component is either deleted or kept but no longer receives the `x-show="$store.bulkdata.status !== 'ready'"` overlay behaviour. Index.html markup that renders the splash overlay as a full-screen backdrop is removed.
- The topbar pill (D-06) is a NEW component mounted inside existing `<header>` adjacent to `#cf-notification-bell-mount`. It subscribes to `$store.bulkdata.status`, `.progress`, `.downloadedMB`, `.totalMB` — all already reactive per `src/stores/bulkdata.js`.

**D-05 blast-radius inventory (EVERY `db.cards` consumer, researched from grep):**

| File | Line(s) | Consumer | Renders at boot? | Action |
|------|---------|----------|------------------|--------|
| `src/workers/bulk-data-pipeline.js` | 54, 61 | Writer — bulk insert | N/A (worker) | No change |
| `src/screens/epic-experiment.js` | 309, 393 | Search dropdown on dashboard | Yes — on input only | **Needs loading placeholder** (was implicitly gated by splash) |
| `src/screens/epic-experiment.js` | 479 | Deck commander lookup for dashboard panels | Yes — on screen render | **Needs fallback** — show deck without commander tile if cards empty |
| `src/db/search.js` | 22, 50, 86 | Core search service | On user search | **Needs loading placeholder** — this is the Thousand-Year Storm + Treasure Cruise autocomplete (D-05 explicit) |
| `src/services/csv-import.js` | 108 | Import path | User action | No change — user-initiated, show toast if empty |
| `src/stores/collection.js` | 128, 162, 174 | Card hydration for collection entries | On Collection Manager render | **Needs fallback** — D-05 says Collection grid operates on `db.collection` rows, not `db.cards`; verify no UI path regresses |
| `src/stores/deck.js` | 79, 104, 137, 162, 182, 290 | Card hydration for deck rows | On Deck Builder render | **Needs fallback** — D-05 says Deck Builder non-search paths work without bulk data; verify rendering stays stable when cards lookups return undefined |
| `src/stores/intelligence.js` | 69 | Printings lookup for analytics | On deck analytics render | **Needs fallback** — graceful degradation |
| `src/stores/market.js` | 145, 196, 203 | Market Intel set-level queries | On Preordain render | **D-05 says Preordain renders without bulk data** — verify store reads don't crash on empty `db.cards` |
| `src/components/deck-analytics-panel.js` | 42 | Printings lookup | On deck open | Fallback |
| `src/components/deck-card-tile.js` | 297 | Printings lookup | On card tile render | Fallback |
| `src/services/price-history.js` | 29 | Price history ingestion | Background | No UI regression risk |
| `src/components/deck-export-modal.js` | 30 | Export lookup | User action | No change — user can wait or retry |
| `src/components/deck-landing.js` | 115 | Deck list commander thumbnails | On Deck Builder landing | **Needs fallback** — show placeholder tile until bulk data loads |
| `src/components/precon-browser.js` | 45 | Precon card name lookup | On precon browse | **Needs placeholder** — precon browser is a D-05 "no" screen (Collection Manager sub-surface); verify |
| `src/components/ritual-modal.js` | 522 | Commander lookup for brew ritual | Modal open | Fallback |
| `src/components/set-completion.js` | 69 | Set-completion analytics | On Collection analytics | Fallback |
| `src/components/watchlist-panel.js` | 214, 257 | Watchlist card enrichment | On watchlist render | Fallback |

**The principle:** every consumer above needs to handle `db.cards` returning empty / undefined gracefully while `$store.bulkdata.status !== 'ready'`. Most already do (they use `await db.cards.get(...)` and check for truthy return before rendering). The audit task in Plan 3 is to **grep every one and verify** — not to rewrite all of them.

**Two explicit placeholders (D-05):**
1. **Treasure Cruise add-card autocomplete** (`src/components/add-card-panel.*` — check grep for current file name) — show "Bulk data loading…" skeleton below the input while `status !== 'ready'`.
2. **Thousand-Year Storm card-search autocomplete** (`src/db/search.js` consumer inside deck builder) — same skeleton.

All other `db.cards` consumers render their non-card-data UI path and let card lookups resolve later (or remain empty if the user acts faster than the download).

### Pattern 3: Topbar Pill (D-06) — inherits sync-chip visual grammar

**Visual vocabulary source:** `index.html:294-340` (the sync-status chip). Key classes and tokens:
- Container: `flex items-center gap-xs px-sm py-xs` (same padding as sync chip)
- Dot: `cf-live-dot` (6px, `animation: cf-pulse 1.5s` — **already non-composited; use D-08 as precedent to make new pill composited from day one**)
- Label: `font-mono text-[11px] font-bold uppercase tracking-[0.15em]`
- Status tints: `text-text-primary` (active) / `text-text-muted` (idle) / `text-warning` (error)

**Pill contract:**
- Renders when `$store.bulkdata.status !== 'ready'`
- Subscribes to `.status`, `.progress` (percentage getter), `.downloadedMB`, `.totalMB`
- Template branches:
  - `checking` → `CHECKING ARCHIVE…` (no progress)
  - `downloading` → `DOWNLOADING — {progress}%` with blue glow halo (matches `cf-chip-spinner` syncing state)
  - `parsing` → `PARSING — {parsed} CARDS`
  - `error` → `ARCHIVE ERROR` as `<button>` with click → toast or retry (match sync-chip error pattern)
- Auto-dismisses via Alpine `x-show` flipping false when `status === 'ready'`
- Mount point: inside `<header>` right-section `<div class="flex items-center gap-md">` (the container holding sync chip + notification bell) — new sibling before `#cf-notification-bell-mount`

**Critical:** do NOT introduce a new design token, animation, or colour. Every visual decision reuses an existing one.

### Pattern 4: Non-composited animation fix (D-08)

**Candidate inventory (researched from `src/styles/main.css` + `src/styles/utilities.css`):**

| Animation | File:Line | Property | Status | Fix |
|-----------|-----------|----------|--------|-----|
| `cf-pulse` | main.css:127-130 | `opacity` + `transform: scale()` | **Already composited** (both transform/opacity) | No fix needed |
| `cf-spin` | main.css:147-149 | `transform: rotate()` | **Already composited** | No fix needed |
| `cf-auth-spin` | main.css:245-248 | `transform: rotate()` | **Already composited** | No fix needed |
| `cf-reconciliation-fade-in` | main.css:161-164 | `opacity` + `transform: scale()` | **Already composited** | No fix needed |
| `scanline-sweep` | utilities.css:28 | — (need to read) | Unknown | Audit during Plan 2 |
| `shimmer` | utilities.css:114-116 | — (need to read) | Unknown | Audit during Plan 2 |
| `dice-roll`, `coin-flip` | utilities.css:168-183 | — (need to read) | Unknown | Audit during Plan 2 |
| Splash progress bar | splash-screen.js template | **width** transition (likely) | **Non-composited** (width triggers layout) | **DELETED by D-04** — streaming UI removes splash entirely |

**Lighthouse Phase 7 flag: 1 non-composited animation.** After D-04 deletes the splash progress bar, if the re-measurement still flags one animation, the candidate is either `shimmer` or `scanline-sweep` — both in `utilities.css`. Plan 2's audit task reads those two rules and converts any `left`/`top`/`width`/`height`/`background-position` animations to `transform: translate()` equivalents with `will-change: transform` on the animated element (not the parent — `will-change` budget is tight).

**Example transform-only shimmer:**
```css
/* Before — triggers paint every frame */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* After — GPU composited */
.cf-shimmer-mask {
  will-change: transform;
}
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
```

### Pattern 5: bfcache fix (D-09) — close Dexie on `pagehide`, reopen on `pageshow`

**Root cause verified (web.dev/articles/bfcache):** IndexedDB open connections block Chrome bfcache. Counterflux's Dexie singleton (`src/db/schema.js`) holds the connection open for the entire session. Grep confirmed: ZERO `unload` / `beforeunload` / `pagehide` handlers currently exist in `src/`. The blocker is structural — Dexie stays connected.

**Fix pattern (from web.dev):**
```javascript
// src/services/bfcache.js (new file — Plan 2 ships this)
import { db } from '../db/schema.js';

let _pagehideBound = false;

export function bindBfcacheHandlers() {
  if (_pagehideBound) return;
  _pagehideBound = true;

  // Close Dexie connection when page enters bfcache
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) {
      // Page MIGHT enter bfcache — close IDB to stay eligible
      try { db.close(); } catch { /* noop */ }
    }
  });

  // Reopen on restore (bfcache restore OR normal load replay)
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && !db.isOpen()) {
      // Restored from bfcache — reopen
      db.open().catch(err => {
        console.warn('[Counterflux] bfcache reopen failed', err);
      });
    }
  });
}
```

**Wire point:** `src/main.js:bootApp()` — call `bindBfcacheHandlers()` after `Alpine.start()` (step 7 above). Synchronous, idempotent, ~20 lines of code.

**Caveat — the Realtime WebSocket (Phase 11 sync engine):** if sync is active, the Realtime subscription is ALSO a bfcache blocker per the web.dev list. Plan 2 must either (a) also teardown the Realtime channel on `pagehide` and resubscribe on `pageshow`, OR (b) document in PERF-SIGNOFF.md that bfcache is structurally incompatible with authed sessions and the fix only benefits anonymous users. **Option (b) is the cheap path per D-09** — mention in signoff, defer full fix to v1.2.

**Verification (can't be automated):** Use Chrome DevTools → Application tab → Back/forward cache → "Run test." Records "Restored from back-forward cache" or blocker reasons. Capture a screenshot for PERF-SIGNOFF.md.

### Pattern 6: Bundle splitting (D-10) — conditional

**Only triggered if re-measured LCP > 2.5s AFTER D-04 streaming-UI.** If streaming-UI fixes LCP, skip this entire plan.

**Candidate priority order (from CONTEXT.md + verified from `src/main.js:1-5`):**
1. **mana-font CSS** (~99KB) — imported top of `src/main.js:3`. Candidate for lazy-load keyed on "first render that needs mana symbols" (deck editor, card detail flyout). Blocker: flash-of-unstyled-mana on first card render. Mitigation: inline a ~5KB subset of the most common symbols as CSS for zero-flash fallback.
2. **keyrune CSS** — imported top of `src/main.js:4`. Same split strategy. Blocker: flash-of-unstyled-set-icon in Preordain + Treasure Cruise printings picker.
3. **material-symbols** (`src/main.js:5`) — imported globally. Lower priority; many screens use glyphs.
4. **Chart.js** — already tree-shaken per CLAUDE.md. Lazy-load per-screen (Dashboard analytics) via dynamic import if baseline flags it.
5. **Route-level splitting** — Navigo already lazy-loads screen modules per CLAUDE.md architecture. Verify this is actually happening in `dist/` by inspecting chunk sizes after `npm run build`.

**Vite 8 / Rolldown cache-bust contract (Pitfall 15 — verified via vite.dev docs):**
```javascript
// src/main.js — before Alpine.start(), register preload error recovery
window.addEventListener('vite:preloadError', (event) => {
  // Stale chunk after deploy — hard reload to fetch fresh index.html + new chunk URLs
  event.preventDefault();
  // Consider a toast: "App updated — reloading to apply" (non-blocking, 500ms delay)
  setTimeout(() => window.location.reload(), 500);
});
```

Also: set `Cache-Control: no-cache` on `index.html` at the hosting layer (Vercel `vercel.json` headers rule). Without this, bullet 1 has no effect — the user still sees the old index.html pointing at deleted chunks. This is a deployment-side change and must be in Plan 5's action list, not just a code change.

**If D-10 triggers, Plan 5 MUST:**
- [ ] Add `vite:preloadError` handler in `src/main.js`
- [ ] Add `vercel.json` `headers` rule for `index.html` → `Cache-Control: no-cache`
- [ ] Measure before/after chunk size (`dist/` inspection) and bundle analysis
- [ ] Re-run Lighthouse and include delta in PERF-SIGNOFF.md

### Anti-Patterns to Avoid

- **Parallel web-vitals instrumentation.** Plan 1 re-measurement MUST reuse `src/services/perf.js` verbatim. Do not add a second `PerformanceObserver` anywhere. Pitfall 11 measured with its own instrumentation WILL regress what it measures.
- **Measuring against `npm run dev` for the Lighthouse number.** Dev mode skips minify, ships sourcemaps, and has HMR overhead. ALWAYS `npm run build && npm run preview` for the measurement.
- **Mutating `PERF-BASELINE.md`.** D-14 locks it frozen. PERF-SIGNOFF.md cross-references it with relative metrics ("LCP improved 3.7s → X.Xs vs Phase 7 baseline 2026-04-15").
- **Shipping a non-composited animation fix for an animation that already IS composited.** Audit first; `cf-pulse`, `cf-spin`, `cf-auth-spin`, `cf-reconciliation-fade-in` are all already transform/opacity-only. The Phase 7 flag was almost certainly the splash progress bar (which D-04 deletes).
- **Speculating Plan 3 fixes in Plan 2 execution.** Plan 2 (freebies) ships D-08 + D-09 only. CLS fixes (Plan 4) and streaming-UI (Plan 3) are gated on the re-measurement explicitly flagging them. Don't pre-emptively optimise.
- **Introducing a new brand token / colour for the topbar pill.** D-06 inherits from sync-chip. New token = scope creep.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Measure LCP / INP / CLS / FCP / TTFB | Custom PerformanceObserver wrapper | Existing `web-vitals` 5.2.0 via `src/services/perf.js` | Already shipped. Handles SPA soft-nav edge cases, CLS windowing (5s), INP interaction attribution. Custom observer would miss ≥3 subtle cases per the v5 source. |
| Run Lighthouse | Custom Puppeteer script | Existing `@lhci/cli` via `npm run perf` | Already shipped. Handles vite-preview lifecycle, desktop throttling calibration, HTML report generation. |
| Chunk error recovery after deploy | Custom ChunkLoadError catch in every `import()` callsite | Native `vite:preloadError` event | Single listener covers all dynamic imports. Verified in Vite 8 official docs (2026). |
| IndexedDB close/reopen for bfcache | Manual connection tracking state machine | `db.close()` / `db.open()` on `pagehide`/`pageshow` | Dexie 4.x idempotent open; no ref-counting needed for Counterflux's single-page-lifetime use. |
| Non-composited animation detection | Manual Performance panel grep | Lighthouse's built-in "non-composited animations" audit | Already runs as part of `npm run perf`. Trust the tool. |
| Before/after perf comparison | Parse Lighthouse JSON programmatically | Side-by-side median numbers in PERF-SIGNOFF.md table | Table is readable, durable, grep-able. JSON parse adds zero value for a one-shot comparison. |

**Key insight:** Phase 13 is a "use the tools we already shipped, better" phase. Every new file beyond PERF-SIGNOFF.md + the conditional fix files is a signal of scope creep. The tooling investment from Phase 7 Plan 2 was specifically so that Phase 13 could be cheap.

## Runtime State Inventory

> Phase 13 is a performance phase, not a rename/refactor/migration. No persisted state is being renamed. This section documents state touched by the streaming-UI refactor (D-04) in case the planner treats the splash removal as a mini-refactor.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `$store.bulkdata.status` is transient Alpine.store() state, not persisted. `db.cards` contents are untouched by Phase 13. | None |
| Live service config | None — no CI job names, no external webhooks reference "splash" or "bulkdata". Scryfall API calls are unchanged. | None |
| OS-registered state | None — browser tab only; no Task Scheduler / systemd / service worker registrations. | None |
| Secrets/env vars | None — no env vars reference perf instrumentation or splash behaviour. | None |
| Build artifacts / installed packages | None will be stale after Phase 13. If D-10 bundle-splitting ships, `dist/` output changes shape but is regenerated on `npm run build`. Vercel deploy replaces chunks on next push. | None — if D-10 triggers, document `Cache-Control: no-cache` on `index.html` (already in Pattern 6 action list) |

**Verified by:** grep for "splash" across src/ + `.planning/` + `package.json` + `vite.config.js` + `lighthouserc.cjs`; grep for "bulkdata" across the same; grep for `unload`/`beforeunload`/`pagehide` across src/ (zero results — confirms Pattern 5's "structural blocker" diagnosis).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm run build, npm run perf | ✓ | 22.x (required by Vite 8) | — |
| Chrome / Chromium | Lighthouse lab runs, bfcache DevTools test | ✓ | 146+ (@lhci/cli auto-downloads) | — |
| `@lhci/cli` Chromium cache (~150MB) | `npm run perf` first run | ✓ (from Phase 7) | Cached at `~/.cache/lhci` | Re-download if pruned |
| `npm run preview` port 4173 | Lighthouse target | ✓ | localhost:4173 | — |
| `node_modules/web-vitals` | `src/services/perf.js` | ✓ | 5.2.0 (verified 2026-04-20) | — |
| Chrome DevTools Application → Back/forward cache panel | D-09 bfcache verification | ✓ (built into Chrome 146+) | — | Can't be replaced; required for one manual check |
| Git working tree matching v1.1 tip | Re-measurement must be against actual v1.1 final build | ✓ | master @ 6276030 | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

**Verified by:** `npm view` version checks, file-path existence checks against prior Phase 7 Plan 2 artefact inventory.

## Common Pitfalls

### Pitfall 1: Lighthouse version drift biasing the comparison

**What goes wrong:** Phase 7 baseline was captured under Lighthouse 13.0.2 (embedded in @lhci/cli 0.15.1). Five weeks later, @lhci/cli 0.15.1 is still pinned in `package.json`, but its internal Lighthouse dep may have been released with 13.1.x or 14.0.0 via a transitive minor bump. A metric that moved 200ms between Lighthouse versions could masquerade as a perf regression (or improvement).

**Why it happens:** Lighthouse changes scoring algorithms and lab-calibration constants across minor versions. @lhci/cli internally bumps Lighthouse without bumping its own major version.

**How to avoid:**
1. Before Plan 1 runs, capture `npx lhci --version` and the effective Lighthouse version (from the first run's `lighthouse-report/report.html` meta). Record both in PERF-SIGNOFF.md's Methodology section.
2. If the Lighthouse version differs from Phase 7 baseline (13.0.2), note it explicitly in PERF-SIGNOFF.md and mark the comparison as "cross-version" rather than "same-version." Do not attempt to "correct" for it — just document.
3. If differences are large (>10% swings in FCP/LCP), pin `@lhci/cli@0.15.1` more aggressively (check `package-lock.json` and consider `npm ci` from the same lockfile as Phase 7).

**Warning signs:** Re-measurement shows a 20%+ improvement with no code changes between Phase 7 and Phase 13. Either the code genuinely got faster (unlikely — no perf work shipped) or the Lighthouse version changed.

### Pitfall 2: Boot-order regression from incomplete D-04 refactor

**What goes wrong:** Planner treats "remove splash" as "delete splash-screen.js and its x-show." Splash was implicitly gating several screens from rendering before `$store.bulkdata.status === 'ready'`. Screens that assumed `db.cards` was populated throw (e.g. an `await db.cards.get(id)` returns undefined in a context that tried to read `.name` off it).

**Why it happens:** The splash overlay was load-bearing for more than just visual polish — it's an implicit rendering gate for every `db.cards` consumer listed in the D-05 blast-radius inventory.

**How to avoid:**
1. Plan 3 action list MUST include the full blast-radius grep (inventory above) and an audit task that verifies each consumer handles `db.cards.get(x) === undefined` gracefully.
2. TDD pattern: add a test that mounts `db.cards` as empty and asserts each top-level screen renders without throwing. Use `@vitest-environment jsdom` + the existing `fake-indexeddb` + the `vi.mock('alpinejs')` pattern from Phase 09 precedent (per STATE.md accumulated context).
3. The two explicit D-05 placeholders (Treasure Cruise add-card, Thousand-Year Storm card-search) are **additive UI** — they render when `status !== 'ready'`. All other screens need **fallback UI** — they render *anyway* and show empty states / missing thumbnails until bulk data arrives.

**Warning signs:** Manual smoke-test after D-04 lands shows one of: blank screen on Dashboard, commander tile showing "undefined," deck list showing `[object Object]`, Preordain crashing on mount.

### Pitfall 3: Web-vitals duplicate instrumentation during re-measurement

**What goes wrong:** Planner thinks "Plan 1 is a re-measurement — let's add a telemetry beacon to capture the numbers automatically." New PerformanceObserver registered alongside the existing one in `src/services/perf.js`. The double-observer fires two handlers per metric. web-vitals v5 uses opts-object identity as a WeakMap key (STATE.md Phase 7 lesson) — sharing or duplicating handlers is a known footgun.

**Why it happens:** The word "re-measurement" implies new tooling. The correct reading is "re-use existing tooling to measure again."

**How to avoid:**
1. Plan 1 action list MUST be prescriptive: "reuse `src/services/perf.js` as-is, do not edit, do not create parallel module."
2. The re-measurement captures numbers from two sources: (a) Lighthouse report HTML (already automated via `npm run perf`), (b) web-vitals `console.table` screenshot from a real dev session. Both are existing infrastructure.
3. If Plan 1's numbers need to land in a non-markdown format (e.g. JSON for future tooling), emit them by copying from the HTML report or the console — do not re-instrument.

**Warning signs:** Any diff in Plan 1 that touches `src/services/perf.js` or adds a new `PerformanceObserver()` call. Reject in review.

### Pitfall 4: Soft-gate warnings silenced by GitHub Actions log noise

**What goes wrong:** D-11 ships `@lhci/cli` `warn`-level assertions. Warnings are emitted to stderr during CI but the exit code is zero, so the build passes and the warning scrolls past in the Actions log. Six months later the baseline has drifted 40% without anyone noticing.

**Why it happens:** Unread warnings are unfunded flags. A warning that nobody reads has negative value (false security).

**How to avoid:**
1. Plan 6's soft-gate mechanism must include **a surface that forces visibility**: either (a) a GitHub Action PR comment that posts the metric table to every PR (via `treosh/lighthouse-ci-action` or `actions/github-script`), or (b) a status-check that appears in the PR merge UI (green if good, yellow if warn). Option (a) is recommended per Claude's discretion.
2. If Claude chooses the plain `npm run perf` + non-failing exit code path, Plan 6 must also update the PR template to include "Check Lighthouse warnings in CI log" as a checkbox. Making the user do the work is the tradeoff.

**Warning signs:** PR merges that cross "Good" thresholds without a single review comment. If this happens, the soft-gate is being ignored — escalate to hard-gate or PR comment bot.

### Pitfall 5: bfcache fix also requires Realtime teardown (Phase 11 cross-cut)

**What goes wrong:** Plan 2 ships the Dexie close/reopen pattern (Pattern 5) and the bfcache test still fails for authed users because the Supabase Realtime WebSocket is also a bfcache blocker per web.dev's "open connections" list.

**Why it happens:** Counterflux's v1.1 sync engine (Phase 11) establishes a single schema-wide Realtime channel (STATE.md: "Single schema-wide Realtime channel (Option B) — 24× under Supabase free-tier quota"). This channel is a WebSocket, which blocks bfcache.

**How to avoid:**
1. Plan 2 bfcache investigation MUST test with both anonymous AND authed sessions. Chrome DevTools Back/forward cache panel surfaces each blocker reason independently.
2. If Realtime is flagged: either add the same pagehide/pageshow teardown pattern to `src/services/sync-engine.js` (symmetric with Dexie), OR accept it as a structural limitation and document in PERF-SIGNOFF.md. Per D-09 "if cheap, fix; if structural, defer" — the Realtime teardown is cheap (teardown is already a function; just call it).
3. If the Realtime teardown is simple, fold it into Plan 2's D-09 scope. If it reveals sync-engine edge cases (pending outbox flush on pagehide?), defer and document.

**Warning signs:** bfcache test passes for anonymous user but fails with "WebSocket" blocker for authed. This is the Realtime channel.

## Code Examples

### Example 1: `npm run perf` re-run (Plan 1)

Already wired. No code change needed. Captured for reference:

```bash
# Plan 1 Task: Re-measurement
npm run build
# (in one terminal)
npm run preview
# (in a separate terminal, 3x)
# Manually open Chrome → DevTools → Lighthouse → desktop → Performance → Analyze
# Record numbers in 13-01-RE-MEASURE.md

# OR, automated single-run reproducibility check
npm run perf
# → ./lighthouse-report/report.html
```

### Example 2: @lhci/cli soft-gate config (D-11 implementation — Plan 6)

Source: verified from https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md

```javascript
// lighthouserc.cjs — extend existing config with assert block
module.exports = {
  ci: {
    collect: {
      // ... existing collect config unchanged ...
    },
    assert: {
      // D-11 soft-gate — warn-level only, never fail CI
      assertions: {
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }], // Good < 2.5s
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],   // Good < 0.1
        'first-contentful-paint':  ['warn', { maxNumericValue: 1000 }],  // Phase 7 baseline = 1.0s, don't regress
        'interactive':             ['warn', { maxNumericValue: 3500 }],  // Aspirational TTI target
        'total-blocking-time':     ['warn', { maxNumericValue: 200 }],   // INP proxy
      },
    },
  },
};
```

**Behaviour:** `npm run perf` now emits warnings to stderr if any threshold is crossed. Exit code remains 0. CI stays green. The warnings surface in `lighthouse-report/report.html` and in the stderr stream — PR-comment mechanism (Pitfall 4) surfaces them in review.

### Example 3: bfcache handler (D-09 implementation — Plan 2)

```javascript
// src/services/bfcache.js — NEW FILE
import { db } from '../db/schema.js';

let _bound = false;

export function bindBfcacheHandlers() {
  if (_bound || typeof window === 'undefined') return;
  _bound = true;

  window.addEventListener('pagehide', (event) => {
    // `persisted === true` means the browser is considering bfcache for this page.
    // Close Dexie to remove the IDB-open blocker.
    if (event.persisted) {
      try { db.close(); } catch { /* noop — already closed */ }
    }
  });

  window.addEventListener('pageshow', (event) => {
    // `persisted === true` means we were actually restored from bfcache.
    // Reopen Dexie; tree-walks reactive Alpine stores pick up again transparently.
    if (event.persisted && !db.isOpen()) {
      db.open().catch(err => {
        console.warn('[Counterflux] bfcache reopen failed', err);
      });
    }
  });
}
```

```javascript
// src/main.js — wire point (add after Alpine.start() at line 99)
import { bindBfcacheHandlers } from './services/bfcache.js';
// ...
Alpine.start();
bindBfcacheHandlers();   // D-09 — Phase 13 Plan 2
```

### Example 4: Non-composited animation fix (D-08 — if applicable to shimmer)

```css
/* src/styles/utilities.css — replace width/background-position animations with transforms */

/* Before — may trigger paint per frame (audit needed) */
/* @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } } */

/* After — transform-only, GPU composited */
.cf-shimmer-container {
  position: relative;
  overflow: hidden;
}
.cf-shimmer-container::before {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%);
  will-change: transform;
  animation: shimmer-transform 1.5s ease-in-out infinite;
}
@keyframes shimmer-transform {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
```

### Example 5: Vite preload error recovery (Pitfall 15 — if D-10 triggers)

```javascript
// src/main.js — add BEFORE Alpine.start() so it catches any import() during boot
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();   // suppress default uncaught error
  console.warn('[Counterflux] chunk preload failed — app was updated, reloading');
  // Soft delay so any pending UI updates settle
  setTimeout(() => window.location.reload(), 500);
});
```

```json
// vercel.json — companion hosting config (REQUIRED with chunk-splitting)
{
  "headers": [
    {
      "source": "/index.html",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache" }
      ]
    },
    {
      "source": "/",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache" }
      ]
    }
  ]
}
```

Sources:
- [web.dev bfcache guide](https://web.dev/articles/bfcache) — IndexedDB/WebSocket blockers, pagehide/pageshow pattern
- [Vite 8 build docs](https://vite.dev/guide/build.html) — `vite:preloadError` event, Cache-Control: no-cache guidance
- [Lighthouse CI config docs](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md) — warn/error/off assertion levels

### Example 6: Topbar pill Alpine template (D-06 — Plan 3)

```html
<!-- index.html — insert inside <header> right-section, BEFORE #cf-notification-bell-mount -->

<!-- Bulk-data progress pill (Phase 13 D-06) — inherits sync-chip visual vocabulary.
     Renders while bulk data is downloading; auto-dismisses when status === 'ready'. -->
<template x-if="$store.bulkdata && $store.bulkdata.status !== 'ready'">
  <div
    role="status"
    aria-live="polite"
    class="flex items-center gap-xs px-sm py-xs"
    :title="'Downloading card archive — ' + $store.bulkdata.progress + '%'"
    :aria-label="'Archive download status: ' + $store.bulkdata.status + ' ' + $store.bulkdata.progress + ' percent'"
  >
    <!-- Downloading: blue glow halo + spinner + label -->
    <template x-if="$store.bulkdata.status === 'downloading'">
      <span class="flex items-center gap-xs" style="box-shadow: 0 0 8px var(--color-glow-blue);">
        <span class="material-symbols-outlined text-primary cf-chip-spinner" style="font-size: 12px;">progress_activity</span>
        <span class="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-text-primary">
          ARCHIVE — <span x-text="$store.bulkdata.progress"></span>%
        </span>
      </span>
    </template>
    <!-- Parsing: live dot + parsed count -->
    <template x-if="$store.bulkdata.status === 'parsing'">
      <span class="flex items-center gap-xs">
        <span class="cf-live-dot"></span>
        <span class="material-symbols-outlined text-primary" style="font-size: 12px;">database</span>
        <span class="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-text-primary">
          INDEXING — <span x-text="$store.bulkdata.parsed.toLocaleString()"></span>
        </span>
      </span>
    </template>
    <!-- Checking: idle muted state -->
    <template x-if="$store.bulkdata.status === 'checking' || $store.bulkdata.status === 'idle'">
      <span class="flex items-center gap-xs">
        <span class="material-symbols-outlined text-text-muted" style="font-size: 12px;">cloud_sync</span>
        <span class="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-text-muted">CHECKING ARCHIVE…</span>
      </span>
    </template>
  </div>
</template>

<!-- Error: <button> for keyboard reachability, matches sync-chip error pattern -->
<template x-if="$store.bulkdata && $store.bulkdata.status === 'error'">
  <button
    type="button"
    class="cf-chip-error-halo flex items-center gap-xs px-sm py-xs cursor-pointer"
    :title="$store.bulkdata.error || 'Archive download failed'"
    @click="$store.bulkdata.retry && $store.bulkdata.retry()"
  >
    <span class="w-2 h-2 bg-secondary"></span>
    <span class="material-symbols-outlined text-secondary" style="font-size: 12px;">error</span>
    <span class="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-secondary">ARCHIVE ERROR</span>
  </button>
</template>
```

**Note on animation composability:** the pill reuses `cf-chip-spinner` (already transform-only) and `cf-live-dot` (already transform+opacity). No new keyframes; no new non-composited flag risk.

### Example 7: PERF-SIGNOFF.md template (D-13 — Plan 6 or Plan 1-Branch-A)

```markdown
# Counterflux v1.1 — Performance Signoff (PERF-04)

**Signed off:** 2026-04-{XX}
**Phase:** 13 — Performance Optimisation (conditional)
**Verdict:** v1.1 meets perf budget  <!-- or: v1.1 meets perf budget after targeted fixes -->

## Methodology

- Same methodology as [Phase 7 PERF-BASELINE.md](../07-polish-pass-perf-baseline-schema-migration/PERF-BASELINE.md): median of 3 cold-boot Lighthouse runs against `vite preview` (http://localhost:4173/), desktop preset, Performance only, single-page-session mode, custom throttling.
- Lighthouse version: {version from `npx lhci --version` at time of measurement} vs 13.0.2 at baseline — {SAME / MINOR-DIFF note}.
- Chrome version: {version} vs 146.0.0.0 at baseline.
- Codebase state: v1.1 final build at commit {sha}.

## Re-Measured Numbers

| Metric | Run 1 | Run 2 | Run 3 | Median | Phase 7 Baseline | Delta | Rating | Target | Pass/Fail |
|--------|-------|-------|-------|--------|------------------|-------|--------|--------|-----------|
| FCP    |       |       |       |        | 1.0s             |       |        | < 1.0s | ✓/✗ |
| LCP    |       |       |       |        | 3.7s             |       |        | < 2.5s | ✓/✗ |
| CLS    |       |       |       |        | 1.00             |       |        | < 0.1  | ✓/✗ |
| TBT    |       |       |       |        | 0ms              |       |        | —      | —   |
| INP    |       |       |       |        | —                |       |        | < 200ms| ✓/✗ |
| Perf score | | |      |        | 54               |       |        | —      | —   |

## Optimisations Shipped in Phase 13

<!-- Pick one: -->

**Option A (Branch A — no code changes):**
> None. Re-measurement showed all targets met on v1.1 as-built. Phase 13 closes documentation-only per D-02.

**Option B (Branch B — fixes shipped):**
| Plan | Fix | Files Touched | Measured Delta |
|------|-----|----------------|----------------|
| 13-02 | D-08 Non-composited animation (shimmer transform conversion) | `src/styles/utilities.css` | CLS: X → Y |
| 13-02 | D-09 bfcache Dexie close/reopen | `src/services/bfcache.js`, `src/main.js` | bfcache: blocked → restored |
| 13-03 | D-04 Streaming UI (splash removed, topbar pill added) | `src/main.js`, `index.html`, `src/components/splash-screen.js` (deleted), +new pill | LCP: 3.7s → X.Xs; CLS: 1.00 → 0.0X |
| 13-06 | D-11 @lhci/cli soft-gate | `lighthouserc.cjs` | — (monitoring only) |

## Cross-References

- [Phase 7 PERF-BASELINE.md](../07-polish-pass-perf-baseline-schema-migration/PERF-BASELINE.md) — frozen baseline, do not mutate.
- [13-CONTEXT.md](./13-CONTEXT.md) — decision log D-01..D-14.
- [13-01-RE-MEASURE.md](./13-01-RE-MEASURE.md) — Plan 1 output, branch decision evidence.

## Reproducibility

- Rerun measurement: `npm run perf` (single Lighthouse run, HTML report at `./lighthouse-report/report.html`).
- Rerun baseline methodology: 3 manual runs through DevTools Lighthouse panel, median.
- Commit sha at measurement: {sha}.
- @lhci/cli version at measurement: {version}.
```

## State of the Art

| Old Approach (training-data default) | Current Approach (2026) | When Changed | Impact |
|--------------------------------------|-------------------------|--------------|--------|
| Fail CI on Lighthouse perf regression | Warn-level soft-gate (per-team tradeoff) | 2024+ | Solo-dev projects especially benefit; hard-gates block hotfixes for non-regressions |
| `onFID` from web-vitals | `onINP` from web-vitals v4+ (FID deprecated) | web-vitals v4 (2024) | Counterflux already on v5.2; Phase 7 removed onFID per STATE.md |
| Full-screen splash blocking boot | Streaming UI / skeleton + background load | — | Industry standard for PWAs with large first-visit data; Counterflux's v1.0 splash is the regression, not the norm |
| Custom ChunkLoadError catch | Native `vite:preloadError` event | Vite 4+ (2023) | Vite 8 (Rolldown) keeps the event; no custom code needed |
| IndexedDB held open for page lifetime | Close on `pagehide`, reopen on `pageshow` | web.dev bfcache guide (2024 revision) | Required for bfcache-eligibility; Dexie users most often miss this |

**Deprecated/outdated:**
- **onFID**: web-vitals removed from v4+. Counterflux already migrated per Phase 7 (verified in `src/services/perf.js`).
- **TTI as primary metric**: Lighthouse 13 deprecated TTI in favour of INP + TBT. Counterflux already reflects this in PERF-BASELINE.md.
- **`unload` event listener**: actively harmful for bfcache; prefer `pagehide`. Verified no uses in Counterflux src/.

## Open Questions

1. **Does @lhci/cli 0.15.1 auto-update Lighthouse transitively?**
   - What we know: `@lhci/cli@0.15.1` was pinned at Phase 7 (2026-04-15). Lighthouse runs bundled inside it.
   - What's unclear: Whether `npm install` at Phase 13 time re-resolves the transitive Lighthouse dep to a newer version despite the pinned outer. `package-lock.json` should answer; verify during Plan 1.
   - Recommendation: Plan 1 Task 1 is "compare `npx lhci --version` and the Lighthouse version line in the first generated `lighthouse-report/report.html` against Phase 7 baseline." Document in PERF-SIGNOFF.md.

2. **Which specific animation is Phase 7's "1 non-composited animation" flag?**
   - What we know: Audit against main.css + utilities.css shows `cf-pulse`, `cf-spin`, `cf-auth-spin`, `cf-reconciliation-fade-in` are all already transform/opacity (composited). Splash progress bar uses `width` transition (non-composited) and is deleted by D-04.
   - What's unclear: Whether `shimmer`, `scanline-sweep`, `dice-roll`, or `coin-flip` (in utilities.css) trip the flag. Could not confirm from grep; full CSS read required.
   - Recommendation: Plan 2's D-08 action task includes "read utilities.css:28-190, identify any animation using `left`/`top`/`width`/`height`/`background-position` as the animated property, convert to `transform`." If none found post-splash-deletion, Plan 2 documents the flag as "resolved by splash removal" and no animation changes ship.

3. **Does the Realtime WebSocket (Phase 11) need matching bfcache teardown?**
   - What we know: web.dev explicitly lists WebSocket as a bfcache blocker. Phase 11's single schema-wide Realtime channel keeps a persistent WebSocket for authed users.
   - What's unclear: Whether teardown + resubscribe on pagehide/pageshow introduces sync-engine edge cases (outbox flush mid-pagehide, re-auth on resubscribe).
   - Recommendation: Plan 2 D-09 tests bfcache BOTH anonymous AND authed. If authed still blocks on WebSocket, evaluate teardown cost; if simple, ship; if complex, document "bfcache benefits anonymous sessions only; authed defer to v1.2" in PERF-SIGNOFF.md per D-09's "if structural, defer" clause.

4. **Is Chart.js already tree-shaken, or is CLAUDE.md stale?**
   - What we know: CLAUDE.md claims "Chart.js (tree-shaken)." No verification captured in research.
   - What's unclear: Whether the actual `dist/` output includes only used Chart.js modules or the whole bundle.
   - Recommendation: Plan 1 Task — after `npm run build`, inspect `dist/assets/*.js` for Chart.js size. If > 50KB, Chart.js tree-shake is broken and is a D-10 candidate. If < 20KB, claim is verified and Chart.js is not a D-10 candidate.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 (existing, no upgrade needed) |
| Config file | `vitest.config.js` at repo root (verified) |
| Quick run command | `npx vitest run tests/{file}.test.js -t {pattern}` |
| Full suite command | `npm test` |
| Perf measurement | `npm run perf` (Lighthouse, not Vitest — out-of-band) |

### Phase Requirements → Test Map

Phase 13's plans are measurement-driven and often involve CSS/HTML/config changes where unit tests have limited value. The test strategy blends Vitest (for code-change verification) with manual Chrome DevTools checks (for perf-metric verification) and `npm run perf` output (for Lighthouse-metric verification).

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| PERF-04 | Re-measurement produces median-of-3 numbers captured in 13-01-RE-MEASURE.md | manual-only | `npm run perf` + DevTools Lighthouse panel (3x) | ❌ Wave 0 — 13-01-RE-MEASURE.md must be created |
| PERF-04 | web-vitals console.table fires on `npm run dev` without parallel observer | regression guard | `npx vitest run tests/perf-bootstrap.test.js` | ✅ (exists from Phase 7) |
| PERF-04 (D-04) | Streaming UI: Dashboard renders without `$store.bulkdata.status === 'ready'` | integration | `npx vitest run tests/streaming-ui.test.js` | ❌ Wave 0 |
| PERF-04 (D-04) | Every `db.cards` consumer handles empty result gracefully | regression guard | `npx vitest run tests/db-cards-empty-guard.test.js` | ❌ Wave 0 |
| PERF-04 (D-06) | Topbar pill renders when `status !== 'ready'` and dismisses at ready | unit + smoke | `npx vitest run tests/topbar-bulkdata-pill.test.js` | ❌ Wave 0 |
| PERF-04 (D-08) | No CSS rule animates `width` / `height` / `left` / `top` / `background-position` under selectors that are actually mounted | static-grep | `npx vitest run tests/animation-composability.test.js` | ❌ Wave 0 |
| PERF-04 (D-09) | `bindBfcacheHandlers()` wires pagehide → db.close and pageshow → db.open | unit | `npx vitest run tests/bfcache-handlers.test.js` | ❌ Wave 0 |
| PERF-04 (D-09) | Manual Chrome DevTools Back/forward cache → "Run test" reports "Restored from back-forward cache" for anonymous user | manual-only | DevTools Application → Back/forward cache panel | N/A (capture screenshot in 13-PERF-SIGNOFF.md) |
| PERF-04 (D-10) | `vite:preloadError` handler registered before Alpine.start | unit | `npx vitest run tests/preload-error-handler.test.js` | ❌ Wave 0 (only if D-10 triggers) |
| PERF-04 (D-10) | `dist/` bundle splits respect size budgets | smoke | `node scripts/check-bundle-sizes.js` | ❌ Wave 0 (only if D-10 triggers) |
| PERF-04 (D-11) | `lighthouserc.cjs` emits warnings (not errors) for all perf budgets | config-read | `npx vitest run tests/lhci-soft-gate.test.js` | ❌ Wave 0 |
| PERF-04 (D-13) | `13-PERF-SIGNOFF.md` contains verdict line `v1.1 meets perf budget` and cross-reference to Phase 7 baseline | static-grep | `grep -c "meets perf budget" .planning/phases/13-performance-optimisation-conditional/13-PERF-SIGNOFF.md` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/{specific-file}.test.js` (per-file, fast feedback)
- **Per wave merge:** `npm test` (full Vitest suite)
- **Phase gate:** Full suite green + `npm run perf` output showing targets met OR 13-PERF-SIGNOFF.md explaining why deltas are acceptable
- **Branch A (signoff only):** Full suite green + `grep -q "meets perf budget" 13-PERF-SIGNOFF.md` → pass

### Wave 0 Gaps

For Branch A (no code changes), only these Wave 0 artefacts:
- [ ] `.planning/phases/13-performance-optimisation-conditional/13-01-RE-MEASURE.md` — captures Plan 1 measurement decision
- [ ] `.planning/phases/13-performance-optimisation-conditional/13-PERF-SIGNOFF.md` — finalises Phase 13 per D-13

For Branch B (fixes ship), add as each plan activates:
- [ ] `tests/streaming-ui.test.js` — covers D-04 boot-order regression guards (Pitfall 2)
- [ ] `tests/db-cards-empty-guard.test.js` — covers D-05 blast-radius consumers
- [ ] `tests/topbar-bulkdata-pill.test.js` — covers D-06 pill render contract
- [ ] `tests/animation-composability.test.js` — static grep for non-transform animations (D-08)
- [ ] `tests/bfcache-handlers.test.js` — unit tests for `src/services/bfcache.js` (D-09)
- [ ] `tests/lhci-soft-gate.test.js` — config-read assertion that warn-level is set (D-11)
- [ ] `tests/preload-error-handler.test.js` — only if D-10 triggers
- [ ] `scripts/check-bundle-sizes.js` — only if D-10 triggers

**Framework install:** None needed. Vitest 4.1.2, jsdom 29.0.1, fake-indexeddb 6.2.5 all present per `package.json`.

## Sources

### Primary (HIGH confidence)
- `.planning/phases/07-polish-pass-perf-baseline-schema-migration/PERF-BASELINE.md` — measured v1.0 baseline, 5 flagged gaps, methodology reproducibility contract
- `.planning/phases/07-polish-pass-perf-baseline-schema-migration/07-CONTEXT.md` — D-18..D-22a baseline decisions
- `.planning/phases/07-polish-pass-perf-baseline-schema-migration/07-02-PLAN.md` — how web-vitals + @lhci/cli were wired
- `.planning/research/PITFALLS.md` §8, §11, §15 — auth race, web-vitals observer, lazy-chunk cache-bust
- `.planning/research/STACK.md` §Performance — `web-vitals` 5.2.x + `@lhci/cli` 0.15.x rationale
- `src/main.js` (200 lines) — verified boot order, lazy-load perf pattern, auth-wall effect
- `src/components/splash-screen.js` — current Alpine component being refactored
- `src/stores/bulkdata.js` — status state machine contract for pill reactivity
- `src/services/perf.js` — web-vitals lazy-loader pattern (do NOT duplicate)
- `index.html` §topbar (lines 287-347) — sync-chip visual grammar for D-06 pill
- `src/styles/main.css` §animations (lines 120-260) — animation composability audit
- `package.json` — version pins, existing scripts
- `lighthouserc.cjs` — existing LHCI config for extension
- [web.dev bfcache guide](https://web.dev/articles/bfcache) — IndexedDB blocker, pagehide/pageshow fix pattern (verified 2026-04-20)
- [Lighthouse CI configuration docs](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md) — warn/error/off assertion levels (verified 2026-04-20)
- [Vite 8 build docs](https://vite.dev/guide/build.html) — `vite:preloadError` event (verified 2026-04-20)

### Secondary (MEDIUM confidence)
- `npm view @lhci/cli version` → 0.15.1 (matches installed) — verified at research time
- `npm view web-vitals version` → 5.2.0 (matches installed) — verified at research time
- Grep results for `db.cards` consumers across src/ — exhaustive inventory; grep is deterministic but some consumers may guard card-lookups in ways only visible at runtime (covered by Pitfall 2 + D-05 audit task)

### Tertiary (LOW confidence)
- Exact non-composited animation identity (Open Question 2) — requires runtime Lighthouse report inspection to confirm
- Chart.js tree-shake effectiveness (Open Question 4) — requires `dist/` inspection; claim from CLAUDE.md unverified
- Whether bfcache fix extends to authed sessions (Pitfall 5 / Open Question 3) — requires Chrome DevTools test with logged-in Supabase session

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified against live npm registry; all tooling already shipped from Phase 7
- Architecture (streaming UI blast radius): HIGH — exhaustive grep across src/ verified
- Boot order contract: HIGH — direct file read of `src/main.js`
- Pitfalls: HIGH for Lighthouse version drift, boot-order regression, web-vitals duplication; MEDIUM for soft-gate noise (untested assumption about PR workflow); MEDIUM for Realtime bfcache cross-cut (extrapolated from web.dev blocker list)
- Code examples: HIGH for LHCI config (verified source), bfcache handler (verified source), topbar pill (direct inheritance from existing chip code)

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (stable; revisit if Lighthouse major bumps or web-vitals v6 ships)
