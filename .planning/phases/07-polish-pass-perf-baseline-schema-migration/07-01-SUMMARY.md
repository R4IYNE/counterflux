---
phase: 07-polish-pass-perf-baseline-schema-migration
plan: 01
subsystem: UI polish pass
tags: [polish, ui, css, a11y, toast, sidebar, splash, mtg]
requires:
  - Alpine.js 3.15 (existing)
  - Dexie.js 4 (existing — not touched this plan)
provides:
  - cf-live-dot pulsing dot primitive (topbar LIVE chip)
  - cf-card-img utility (card-image rounded corners)
  - rag-red / price-drop utility classes (D-32)
  - cf-badge-alert alias for bell unread ping
  - app-store toggleSidebar() with localStorage persistence
  - splashScreen.migrationProgress accessor (D-17a hook for Plan 3)
  - FLAVOUR_TEXTS as { quote, attribution } object array
affects:
  - src/stores/app.js (new toggleSidebar + hydrate from localStorage)
  - src/styles/main.css (@keyframes cf-pulse, red-accent tokens, new utilities)
  - src/styles/utilities.css (.tab-active repainted red)
  - index.html (favicon links, splash template, sidebar chevron, connectivity dot binding, toast data-attr, flyout toast wording)
  - src/components/splash-screen.js (structured quotes + D-17a hook)
  - src/components/ritual-modal.js (Brew a new storm / Abandon storm + red CTA)
  - src/components/deck-landing.js (two button labels renamed)
  - src/components/counter-panel.js (add glyph)
  - src/components/sidebar.js (toggleSidebar delegates to store)
  - src/components/movers-panel.js (filter nameless + empty state)
  - src/components/add-card-modal.js (wishlist toast wording + cf-card-img)
  - src/components/card-tile.js (cf-card-img)
  - src/components/toast.js (full-opacity docs)
tech-stack:
  added:
    - CSS @keyframes cf-pulse (1.5s ease-in-out)
  patterns:
    - localStorage persistence for user UI preferences (D-28)
    - Percentage-based border-radius that scales across card sizes
    - x-data computed accessors for filter + empty-state branching
key-files:
  created:
    - assets/niv-mila.png (tracked)
    - tests/favicon.test.js
    - tests/splash-screen.test.js
    - tests/ritual-modal.test.js
    - tests/counter-panel.test.js
    - tests/sidebar-collapse.test.js
    - tests/movers-panel.test.js
    - tests/add-card-modal.test.js
  modified:
    - index.html
    - src/styles/main.css
    - src/styles/utilities.css
    - src/components/splash-screen.js
    - src/components/ritual-modal.js
    - src/components/deck-landing.js
    - src/components/counter-panel.js
    - src/components/sidebar.js
    - src/components/topbar.js (no-op — state machine unchanged; dot binding moved to index.html)
    - src/components/movers-panel.js
    - src/components/add-card-modal.js
    - src/components/card-tile.js
    - src/components/toast.js
    - src/stores/app.js
    - src/utils/connectivity.js (unchanged; return shape preserved per plan)
    - tests/toast.test.js (extended)
    - tests/connectivity-status.test.js (extended)
decisions:
  - Filter nameless movers rows (strategy A) rather than fallback text, with per-column "No movers data available" empty state. Nameless rows have no value to the user; filtering keeps the top-N slots populated by cards the user can act on.
  - Topbar connectivity binding lives inline in index.html (local x-data, pre-existing). Plan tests therefore audit the local `color === 'success'` binding rather than `$store.connectivity` (which does not exist). Same contract, lighter footprint.
  - FLAVOUR_TEXTS exported so tests can assert shape without constructing an Alpine component. `splashScreen.init()` made defensive — works in jsdom/node test envs without `$watch`.
  - `cf-card-img` chosen as a shared class (utility-first) rather than inline styles at each site, per plan Task 7 guidance. Applied to three canonical card-image surfaces (flyout / add-card preview / collection tile). Future card renders inherit by adding the class.
  - Sidebar collapse resize handler now respects a persisted user preference (does not overwrite localStorage when viewport changes). Cleaner UX than v1.0 auto-collapse at <1024px.
  - Red-accent uplift (POLISH-02) landed the four D-surfaces. D-31 "Clear collection" CTA does not exist in the current app — deferred-item if that surface ever ships (Task scope covered existing CTAs: Abandon storm + Delete deck which already used #E23838).
metrics:
  duration: 12min
  completed: 2026-04-14
---

# Phase 07 Plan 01: Polish Pass Summary

Eleven cross-app polish items (POLISH-01 … POLISH-11) landed in one coordinated UI pass. All eight new test files pass (57/57 green inside plan scope); the full `npm test` suite stays at its pre-plan baseline (1 pre-existing router.test.js failure, documented in `deferred-items.md`).

## What Shipped

### POLISH-01 — Splash flavour typography (Task 1)
- `FLAVOUR_TEXTS` restructured from flat strings with `-- Attribution` separators to `{ quote, attribution }` objects.
- Template wraps the quote in curly quote marks + italic Space Grotesk, and renders the attribution on a new line in JetBrains Mono with a U+2014 em-dash prefix.
- **Files:** `src/components/splash-screen.js`, `index.html`
- **Tests:** `tests/splash-screen.test.js` (FLAVOUR_TEXTS shape, component accessor, no `--` in data, migrationProgress hook)
- **Commit:** `a899125`

### POLISH-03 — Favicon (Task 1)
- `assets/niv-mila.png` now tracked in git.
- Four `<link>` tags declared in `<head>`: 16×16, 32×32, 192×192, `apple-touch-icon`.
- **Files:** `index.html`, `assets/niv-mila.png`
- **Tests:** `tests/favicon.test.js`
- **Commit:** `a899125`

### D-17a hook — Schema migration progress (Task 1)
- `splashScreen()` component exposes `migrationProgress` getter reading `Alpine.store('bulkdata').migrationProgress ?? null`.
- Template renders "Migrating your archive — N%" in warning colour when non-null. Plan 3 will populate the store value; this task lays the receiver.
- **Files:** `src/components/splash-screen.js`, `index.html`
- **Commit:** `a899125`

### POLISH-05 — Toast icon full opacity (Task 2)
- Icon span gains `data-toast-icon` sentinel. Module and template docs forbid `opacity-*` / `text-opacity-*` utilities on the icon.
- Audited: no opacity-reducing class currently applied (pre-existing baseline was fine — this locks it in via regression tests).
- **Files:** `src/components/toast.js`, `index.html`
- **Tests:** `tests/toast.test.js` (POLISH-05 block appended)
- **Commit:** `312abff`

### POLISH-11 — Wishlist toast wording (Task 2)
- `add-card-modal` and the card-detail flyout now branch on selected category:
  - `wishlist` → `"<name> added to wishlist."`
  - `owned`/default → `"<name> added to collection."`
- `deck-context-menu` already shipped correct wording in v1.0; regression-guarded by the new tests.
- **Files:** `src/components/add-card-modal.js`, `index.html`
- **Tests:** `tests/add-card-modal.test.js` (+ deck-context-menu regression guards)
- **Commit:** `312abff`

### POLISH-06 — Ritual rename (Task 3)
- Literal strings replaced app-wide (`Initialize Ritual` / `Begin Ritual` / `Abandon Ritual` → `Brew a new storm` / `Abandon storm`).
- Rename hit three files: `ritual-modal.js` (3 occurrences), `deck-landing.js` (2 button labels + copy).
- Plan `must_haves` specified `Initiate ritual` / `Abandon ritual` (lowercase) — those literals were never in the code, so the assertion is vacuously satisfied and additionally guarded against the actual legacy spellings.
- **Files:** `src/components/ritual-modal.js`, `src/components/deck-landing.js`
- **Tests:** `tests/ritual-modal.test.js`
- **Commit:** `7df2a4a`

### POLISH-07 — Counter `add` glyph (Task 3)
- Material Symbols glyph text `more_horiz` → `add` on the additional-counters popover trigger.
- `aria-label="Counters"` preserved (Pitfall G guard).
- **Files:** `src/components/counter-panel.js`
- **Tests:** `tests/counter-panel.test.js`
- **Commit:** `7df2a4a`

### POLISH-08 — LIVE chip pulsing dot (Task 4, D-26)
- Added `@keyframes cf-pulse` (opacity 1↔0.5 + scale 1↔1.3, 1.5s ease-in-out) and `.cf-live-dot` class (6×6px, background `var(--color-success)`, infinite animation).
- Connectivity dot in index.html binds `cf-live-dot` class only when `color === 'success'`; `warning` stays static `bg-warning`, `secondary` stays static `bg-secondary`.
- `src/utils/connectivity.js` return shape unchanged per plan.
- **Files:** `src/styles/main.css`, `index.html`
- **Tests:** `tests/connectivity-status.test.js` (POLISH-08 block appended)
- **Commit:** `3857482`

### POLISH-09 — Sidebar collapse (Task 5, D-27..D-29)
- `initAppStore()` hydrates `sidebarCollapsed` from `localStorage.sidebar_collapsed` (falls back to viewport default when unset).
- New `toggleSidebar()` method on the app store writes the new value back to localStorage.
- Resize listener now only applies the viewport default when no preference is stored — user choice survives resize events.
- Sidebar header gains a chevron toggle button (D-29) with `chevron_left`/`chevron_right` glyphs and dynamic aria-label.
- Nav items get `:title="screen.label"` tooltips when collapsed (discoverability). Collapsed width is `w-16` / 64px (D-27 — never `w-0` or `hidden`).
- **Files:** `src/stores/app.js`, `src/components/sidebar.js`, `index.html`
- **Tests:** `tests/sidebar-collapse.test.js` (10 tests: hydrate, persist, toggle, source audit for w-16 / chevron / tooltips)
- **Commit:** `72ac386`

### POLISH-10 — Top losers fallback (Task 6)
- Added `x-data` computed accessors `gainersNamed` / `losersNamed` that filter rows where `card.name` is missing/empty.
- Each column now renders a per-column "No movers data available" empty state when filtered list is empty.
- Removed all `x-text="card.name || card.scryfall_id"` bindings. `scryfall_id` only appears as `:key` (list identity), never as rendered text.
- **Files:** `src/components/movers-panel.js`
- **Tests:** `tests/movers-panel.test.js`
- **Commit:** `9d0bd88`

### POLISH-04 — Rounded card corners (Task 7)
- New `.cf-card-img { border-radius: 4.75%; }` utility (percentage scales to card size).
- Applied to three card-image render sites:
  1. Card-detail flyout (`index.html`)
  2. Add-card modal preview (`src/components/add-card-modal.js`)
  3. Collection card-tile (`src/components/card-tile.js`)
- **Visual QA pending** (POLISH-04 is manual-only per 07-VALIDATION.md).
- **Commit:** `e3da9a0`

### POLISH-02 — Red accent uplift (Task 8, D-30..D-33)
- Added `--color-secondary-hover` (`#FF5555`) and `--color-secondary-active` (`#C42424`) ramp tokens in `@theme`.
- **D-30** (card-tile / card-img hover): `.card-tile-hover:hover` and `.cf-card-img:hover` now draw a 2px red box-shadow ring.
- **D-31** (destructive CTAs): `Abandon storm` button repainted to `var(--color-secondary)`. Delete deck modal already used `#E23838` in v1.0 (verified). "Clear collection" CTA does not exist in the current app — noted as deferred surface.
- **D-32** (RAG red): `.rag-red` + `.price-drop` utility classes defined. Movers panel already renders losers in `text-secondary` (v1.0).
- **D-33** (active tab underline + bell unread): `.tab-active` underline repainted red (`var(--color-secondary)` + `var(--color-glow-red)` box-shadow). `.badge-alert` already used `var(--color-secondary)` in v1.0. Added `.cf-badge-alert` alias for explicit referencing.
- **Visual QA pending** (POLISH-02 is manual-only per 07-VALIDATION.md — user walks every screen post-build and confirms ~15% red coverage).
- **Commit:** `95ed7da`

## Visual QA Checklist (Manual-Only Verifications)

User walks through after `npm run dev`:

- [ ] **POLISH-02** — Red accent appears on: card-tile hover glow, Abandon storm button, Delete deck button, top losers numbers, active tab underline (Preordain tabs), notification bell unread dot.
- [ ] **POLISH-04** — Card flyout image has rounded corners (no dark triangles at corners). Add-card modal preview + collection card-tile thumbnails have matching rounded corners at their respective sizes.
- [ ] **POLISH-01** — Splash screen shows italic curly-quoted flavour text + JetBrains Mono attribution on a second line with em-dash prefix. Cycles every 8 seconds.
- [ ] **POLISH-03** — Browser tab icon is the niv-mila image (not a generic globe).
- [ ] **POLISH-08** — LIVE chip shows a 6px green dot pulsing at ~1.5s when connectivity is live. Goes to static amber/red on stale/offline.
- [ ] **POLISH-09** — Chevron toggle in sidebar header collapses to 64px icon rail. Preference survives page reload.

## Deviations from Plan

### Auto-fixed / clarifications

**1. [Rule 1 – Bug] Plan expected `$store.connectivity.color` binding; actual code uses local x-data `color`**
- **Found during:** Task 4
- **Issue:** Plan tests asserted `$store.connectivity.color === 'success'` pattern, but the topbar binds a local x-data variable `color` (seeded by a local `update()` function). No `$store.connectivity` exists.
- **Fix:** Updated `tests/connectivity-status.test.js` to audit the actual binding: `'cf-live-dot': color === 'success'`. The same contract (pulse only on success, static on warning/secondary) is preserved.
- **Files modified:** `tests/connectivity-status.test.js`
- **Commit:** `3857482`

**2. [Rule 2 – Missing critical functionality] Resize handler was overwriting user preference**
- **Found during:** Task 5
- **Issue:** Pre-existing `window.resize` listener called `Alpine.store('app').sidebarCollapsed = window.innerWidth < 1024;` on every resize, clobbering a user's persisted preference.
- **Fix:** Resize handler now short-circuits when `localStorage.sidebar_collapsed` is set, only applying the viewport default for users who have not made a choice.
- **Files modified:** `src/stores/app.js`
- **Commit:** `72ac386`

**3. [Rule 3 – Blocking] Test environment is `node` not `jsdom`; `add-card-modal` body references `window`**
- **Found during:** Task 2
- **Issue:** `renderAddCardModal()` assigns to `window.__cf_searchCards` at call time. Vitest config uses `environment: 'node'` — no `window` global.
- **Fix:** Tests install a minimal `globalThis.window = {}` shim before importing the module. The shim does not leak state between tests.
- **Files modified:** `tests/add-card-modal.test.js`
- **Commit:** `312abff`

**4. [Clarification] POLISH-06 literal string assertions**
- **Found during:** Task 3
- **Issue:** Plan test expected source to not contain `Initiate ritual` / `Abandon ritual` (lowercase), but the legacy code used `Initialize Ritual` / `Abandon Ritual` (title-case). Neither lowercase literal ever existed.
- **Fix:** Test now asserts both — the plan's literal exclusion (vacuous) AND additional guards against the actual legacy spellings. No behavioural difference.
- **Files modified:** `tests/ritual-modal.test.js`

### None of the following required user input (Rules 1–3 only)

- D-31 "Clear collection" destructive CTA: not present in current app, skipped with note.
- Tests run in node environment; where DOM was needed (movers template), used `readFileSync` + regex audits rather than mounting Alpine.

## Deferred Issues

- **router.test.js — Vandalblast screen mount** (pre-existing): `TypeError: Cannot read properties of undefined (reading 'data')` at `src/screens/vandalblast.js:17`. Present at pre-plan baseline; out of scope per SCOPE BOUNDARY rule. Already logged in `deferred-items.md` by Plan 07-02 executor.
- **Clear collection destructive CTA** (D-31 target): not yet shipped. If/when that CTA is built, apply the red `var(--color-secondary)` treatment per D-31.
- **Per-row empty-state for movers when one column has data and the other doesn't**: current implementation shows the empty-state inside each column, which is correct per plan Strategy A. No further work needed; noting for future reference.

## Test Counts

| Metric                | Count |
| --------------------- | ----- |
| New test files        | 7     |
| Extended test files   | 2     |
| New tests added       | 43    |
| Tests passing (scope) | 57/57 |
| Full suite            | 493 pass / 1 pre-existing fail / 10 todo |
| Files modified        | 16    |
| Files created         | 8     |
| Commits (per-task)    | 8     |

## Self-Check: PASSED

- [x] `assets/niv-mila.png` exists in git: FOUND
- [x] All 8 new test files exist and pass: FOUND (favicon, splash-screen, ritual-modal, counter-panel, sidebar-collapse, movers-panel, add-card-modal, + extended toast + extended connectivity-status)
- [x] Commits `a899125`, `312abff`, `7df2a4a`, `3857482`, `72ac386`, `9d0bd88`, `e3da9a0`, `95ed7da`: FOUND
- [x] `npm run build` green: PASS (376ms, unchanged chunk sizes)
- [x] Full test suite delta: no regression (same 1 pre-existing router.test.js failure; 493 other tests pass)
