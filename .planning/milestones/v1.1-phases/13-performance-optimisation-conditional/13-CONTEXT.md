# Phase 13: Performance Optimisation (conditional) - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship v1.1 meeting the performance targets set in Phase 7 (PERF-03):
- **LCP** < 2.5s, **CLS** < 0.1, **FCP** < 1.0s, **INP** < 200ms

Phase 13 is **conditional**. The first plan re-measures the final v1.1 preview build (which now includes auth wall, sync chip, notification bell, spoiler gallery rewrite — none of which existed when the v1.0 baseline was captured). If the re-measurement meets all four targets, the phase closes with a sign-off artefact and zero code changes. If any target misses, subsequent plans ship data-driven fixes, starting with a small set of near-zero-risk freebies.

**In scope:** Re-measurement, streaming-UI refactor of the splash screen (if triggered), topbar bulk-data progress indicator, CLS audit + targeted fixes, non-composited animation fix, bfcache investigation, soft-gate Lighthouse CI, PERF-SIGNOFF.md artefact.

**Out of scope:** Any new feature work, further schema changes, breaking the current mana-font/keyrune import contract unless bundle-splitting investigation proves it's required to hit LCP.

</domain>

<decisions>
## Implementation Decisions

### Scope & sequencing

- **D-01:** **Hybrid structure.** Plan 1 is a re-measurement plan — fresh Lighthouse desktop run (median of 3) + web-vitals capture against `vite preview` on the final v1.1 build. Plans 2+ are derived from the re-measured numbers, not speculated from the v1.0 baseline.
- **D-02:** **Conditional exit is honored.** If re-measurement shows LCP < 2.5s AND CLS < 0.1 AND FCP < 1.0s AND INP < 200ms, Phase 13 closes with PERF-SIGNOFF.md only — no code changes ship. Matches ROADMAP success criterion 3.
- **D-03:** **Fallback scope when targets missed.** Ship two near-zero-risk freebies (non-composited animation + bfcache investigation — see D-08/D-09) alongside whichever targeted fixes the re-measurement justifies. Anything beyond that is gated on measured gap > target.

### Bulk-data first-load strategy (executes only if LCP misses target)

- **D-04:** **Streaming UI (shell-first).** Remove the full-screen splash overlay as the boot gate. Dashboard and unaffected screens render immediately after `runMigration()` + store init completes. Bulk-data pipeline continues in the background (it's already async; `startBulkDataPipeline()` in `src/main.js` is fire-and-forget).
- **D-05:** **Shell scope = collection-only loading.** Only two user flows show a "bulk data still loading" placeholder:
  1. Treasure Cruise add-card flow (requires bulk data for autocomplete)
  2. Thousand-Year Storm card-search autocomplete (same dependency)
  All other screens render without bulk data: Dashboard (Epic Experiment), Deck Builder non-search paths (deck list, deck editor rendering, analytics on existing decks — those operate on user rows from Dexie), Market Intel (Preordain), Game Tracker (Vandalblast), Collection Manager grid (operates on `db.collection` rows, not `db.cards`).
- **D-06:** **Progress signal = topbar pill.** Persistent pill in the topbar adjacent to the sync-status chip / notification bell showing `Downloading card archive — N%`. Matches the existing sync-chip visual pattern (reuses tokens from `src/components/topbar.js`). Auto-dismisses on `$store.bulkdata.status === 'ready'`.

### CLS fix approach

- **D-07:** **Audit-driven.** Re-measurement (Plan 1) enumerates the top CLS contributors post-streaming-UI. Phase 13 fixes whichever sources still push CLS above 0.1. No speculative pre-work — the biggest baseline culprit (splash → dashboard swap) disappears with D-04, so the residual hotspots are unknown until measured.
- **D-08:** **Non-composited animation fix is always in scope.** Flagged by Phase 7 baseline (likely POLISH-08 LIVE pulse at `src/utils/connectivity.js` + `src/components/topbar.js`, or the splash progress bar which D-04 is removing anyway). Fix: switch to `transform` / `opacity` animations + `will-change: transform`. 5-minute change, near-zero regression risk, worth shipping regardless of re-measurement.
- **D-09:** **bfcache investigation is always in scope.** Flagged by baseline (1 failure reason). Investigation: identify blocker (likely an `unload` listener; swap to `pagehide`). If cheap, fix. If structural (e.g. Supabase auth session polling), document the reason and defer.

### Bundle splitting

- **D-10:** **Data-driven only.** Listed in PERF-04 acceptance criteria as a candidate. Plan is gated on re-measured LCP > 2.5s *after* D-04 streaming-UI lands. If triggered, candidates in priority order: mana-font (~99KB), keyrune CSS, Chart.js (tree-shaken already but worth auditing), route-level splitting for screen modules (`src/screens/`). Must respect Pitfall 15 (lazy-chunk cache-bust) — stale-chunk retry logic required if split boundaries change.

### CI gating

- **D-11:** **Soft gate.** Add `@lhci/cli` assertions that emit warnings (not failures) when LCP/CLS/FCP/INP cross the "Good" thresholds. Mechanism: either a PR-comment GitHub Action or a non-failing build step that prints the delta. Blocking hotfixes on a perf regression is a poor tradeoff for a solo-developer project.
- **D-12:** **`npm run perf` remains the primary manual tool.** Already exists from Phase 7 Plan 2 (D-19). Soft-gate is a net-new artefact for automated awareness, not a replacement for manual inspection.

### Sign-off artefact

- **D-13:** **New file: `.planning/phases/13-performance-optimisation-conditional/13-PERF-SIGNOFF.md`.** Contents: re-measured median-of-3 numbers, delta vs Phase 7 baseline, list of optimisations that shipped (or "none — baseline already met"), verdict line `v1.1 meets perf budget`, timestamp, methodology reproducibility note.
- **D-14:** **PERF-BASELINE.md remains frozen.** Do not mutate the Phase 7 artefact. PERF-SIGNOFF.md cross-references it. Historical v1.0 numbers stay intact as the comparison anchor.

### Claude's Discretion

- Exact placeholder UX on Treasure Cruise add-flow and card-search autocomplete (skeleton shape, empty-state wording, visual density)
- Exact pill styling within the topbar-chip visual vocabulary (border, animation on progress update, text formatting of N%)
- Specific bfcache blocker to remove (if investigation finds multiple, prioritise the cheapest)
- `@lhci/cli` soft-gate mechanism (GitHub Action PR-comment vs non-failing build step vs status-check only)
- Bundle-splitting boundaries if D-10 triggers (which chunks, route-level vs lib-level, naming)
- Placeholder min-height values (must support skeleton layout without reintroducing CLS — target < 0.1)
- `will-change: transform` placement specifics for D-08 (which selector, whether scoped to hover/focus)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — PERF-04 full acceptance criteria (candidates: splash → bulk data deferral, store init, bundle splitting)
- `.planning/ROADMAP.md` §Phase 13 — goal, success criteria (3 items including the conditional-exit criterion)
- `.planning/PROJECT.md` — v1.1 scope + constraint: "Initial load < 3s"

### Phase 7 perf lineage (authoritative prior art)
- `.planning/phases/07-polish-pass-perf-baseline-schema-migration/PERF-BASELINE.md` — **critical read.** v1.0 measured numbers, targets, 5 flagged gaps, methodology, reproducibility note
- `.planning/phases/07-polish-pass-perf-baseline-schema-migration/07-CONTEXT.md` §Performance baseline — D-18 (absolute targets), D-19 (`npm run perf`), D-20 (CI-gating deferred to Phase 13), D-21 (web-vitals dev-mode only), D-22 + D-22a (baseline captured pre-migration)
- `.planning/phases/07-polish-pass-perf-baseline-schema-migration/07-02-PLAN.md` — how web-vitals + @lhci/cli were originally wired; reuse/extend patterns
- `.planning/phases/07-polish-pass-perf-baseline-schema-migration/07-01-PLAN.md` §POLISH-08 — LIVE pulse animation (candidate for D-08 non-composited-animation fix)

### Research (v1.1 Second Sunrise)
- `.planning/research/STACK.md` §Performance — `web-vitals` 5.2.x + `@lhci/cli` 0.15.x library rationale
- `.planning/research/PITFALLS.md` §Pitfall 8 — Auth State Race With Store Init (relevant: D-04 reorders boot; auth-wall must still resolve before sync-eligible writes)
- `.planning/research/PITFALLS.md` §Pitfall 11 — Web Vitals Observer Slowing Down Boot Itself (relevant: Plan 1 re-measurement must use lazy-load + `requestIdleCallback` per existing `src/services/perf.js` pattern, NOT ship new synchronous instrumentation)
- `.planning/research/PITFALLS.md` §Pitfall 15 — Lazy-Loaded Chunks Break After Cache Bust on Deploy (relevant: triggered only if D-10 bundle-splitting activates)
- `.planning/research/FEATURES.md` — cross-reference for dependent-screen inventory

### Existing code references
- `src/main.js` — boot order: `window.Alpine` + bulkdata-store init → `runMigration()` → all other stores → `Alpine.start()` → router → auth.init → auth-wall effect → sync-engine effect → bulk-data pipeline kickoff → web-vitals lazy-import (dev only). D-04 does NOT change migration gate or store init order; it removes splash as a boot gate and adds a topbar pill.
- `src/components/splash-screen.js` — current Alpine component, shown when `$store.bulkdata.status !== 'ready'`. Fades out 1s after `ready`. Rotates FLAVOUR_TEXTS every 8s.
- `src/stores/bulkdata.js` — status state machine: `idle | checking | downloading | parsing | ready | error`. Exposes `migrationProgress` (used by Phase 7 Plan 3 migration UX).
- `src/services/perf.js` — web-vitals dev-mode boot (PERF-01). Already lazy-loaded via `requestIdleCallback` in `src/main.js`. Re-measurement Plan 1 reuses this contract — do NOT add synchronous instrumentation.
- `src/components/topbar.js` — sync-status chip + notification bell mount points. D-06 topbar pill lives here, reusing the chip visual vocabulary.
- `src/utils/connectivity.js` — POLISH-08 LIVE pulse (candidate non-composited animation per D-08).
- `package.json` — `npm run perf` script + `@lhci/cli` 0.15.x dev dependency (from Phase 7 Plan 2).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Topbar chip vocabulary** (`src/components/topbar.js`) — sync-status chip + notification bell already occupy this slot. D-06 pill inherits the same visual grammar (border, padding, font scale) so it feels native.
- **Splash screen progress contract** (`src/components/splash-screen.js`) — the progress/percentage data binding already exists via `$store.bulkdata`. D-06 pill reuses those reactive fields; splash itself is removed or repurposed.
- **`src/services/perf.js`** — the lazy-loaded web-vitals boot already follows Pitfall 11 guidance. Plan 1 reuses it, does NOT add parallel instrumentation.
- **`npm run perf` script + `./lighthouse-report/` output** — reproducibility scaffolding already in place. Plan 1 consumes it; no new tooling needed unless @lhci/cli soft-gate (D-11) adds a CI-side invocation.

### Established Patterns
- **Lazy-import for non-critical modules** (`src/main.js` lines 159-167 sync-engine effect; lines 190-197 perf.js) — D-10 bundle-splitting (if triggered) follows this shape: dynamic `import()` behind an `Alpine.effect` or lifecycle hook.
- **Alpine effect + reactive dep** for boot-sequenced side effects (auth-wall sync, profile hydration, sync-engine lifecycle) — D-04 streaming-UI dependent-screen placeholders follow this shape: each affected screen subscribes to `$store.bulkdata.status` and swaps its UI accordingly.
- **Dexie singleton opened inside `runMigration()`** — D-04 does NOT alter this gate. Migration must still complete before stores init. The removal of splash affects what's rendered *after* stores init, not the migration window itself.

### Integration Points
- **Boot order anchor** (`src/main.js` `bootApp()`): migration → stores → Alpine.start → router → auth → sync → bulk-data kickoff. D-04 inserts "hide splash overlay" between Alpine.start and router init (or removes the splash entirely; UI-researcher to confirm).
- **Topbar mount** (`src/components/topbar.js`): existing slots for sync-chip and notification bell. D-06 pill slots adjacent to one of these.
- **Affected screens for D-05 placeholder**: `src/components/card-search.js` (or equivalent autocomplete), Treasure Cruise add-flow component. Planner must inventory every `db.cards` consumer and flag which need placeholder guards.
- **Lighthouse CI wire-point**: `package.json` scripts + (likely) `.github/workflows/` if GitHub Actions is present. D-11 soft-gate plugs in here.

</code_context>

<specifics>
## Specific Ideas

- **"Hybrid: measure + parallel prep" language from discussion** — the user's framing is that Plan 2 (cheap fixes) is near-zero risk AND bundles naturally with whatever the measured gaps reveal. Do not ship Plan 2 as a speculative-fix plan in isolation; always attach the non-composited animation + bfcache fixes to the perf-fix plan that's derived from the re-measurement.
- **"CLS is audit-driven" framing** — don't prescribe specific CLS fixes in planning. The post-streaming-UI residual sources may be entirely different from the baseline's splash-swap / progress-text hotspots. Planner generates the CLS-fix plan *after* Plan 1 completes, not before.
- **Sign-off filename convention:** `13-PERF-SIGNOFF.md` (matches the `{padded_phase}-{NAME}.md` pattern used elsewhere in the phase directory).
- **Conditional-exit as first-class outcome** — Plan 1 explicitly has two branches in its verification-criteria: Branch A = targets met → write signoff, close phase; Branch B = targets missed → spawn Plans 2+. Planner must make this explicit in Plan 1's must_haves.

</specifics>

<deferred>
## Deferred Ideas

- **Chunked download with resume** — rejected for Phase 13 (medium complexity, doesn't fix the first-visit 5min block; streaming-UI is the better primary fix). Revisit if IndexedDB population itself becomes the bottleneck in a later milestone.
- **Slimmer bulk variant (oracle_cards vs default_cards)** — rejected: would break per-printing picker (COLLECT-04) which relies on `prints_search_uri` and per-printing `games: paper` filter. Revisit only if default_cards size becomes untenable.
- **Hard CI gate on perf regression** — deferred to v1.2. Soft-gate first (D-11); if the warning-pattern reveals genuine ongoing regressions, escalate to hard-gate then.
- **Lighthouse "image delivery savings (3.5MB)"** — Scryfall-owned, app has no control over source image sizes. Would require proxying through a self-hosted image CDN — out of scope. Revisit if Counterflux ships its own image transform service.
- **Lighthouse "minify JS savings (1MB)"** — Vite already minifies production JS; the flag reflects third-party code (mana-font, keyrune). Folded into D-10 as a bundle-splitting candidate rather than a standalone minification task.
- **Splash flavour-text retention** — D-04 streaming-UI removes the splash overlay. The FLAVOUR_TEXTS array and rotation logic can be preserved as a Mila-system easter-egg (e.g., rendered as a topbar tooltip or Dashboard welcome strip) but that's a v1.2 polish item, not Phase 13 scope.

</deferred>

---

*Phase: 13-performance-optimisation-conditional*
*Context gathered: 2026-04-20*
