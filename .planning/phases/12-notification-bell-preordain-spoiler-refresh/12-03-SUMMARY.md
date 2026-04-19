---
phase: 12-notification-bell-preordain-spoiler-refresh
plan: 03
subsystem: ui
tags: [alpine, popover, market-store, sync-bridge, tdd]

# Dependency graph
requires:
  - phase: 12-notification-bell-preordain-spoiler-refresh
    plan: 01
    provides: market.unifiedBadgeCount + market.syncErrorCount (2s polled)
  - phase: 11-cloud-sync-engine
    plan: 03
    provides: window.openSyncErrorsModal() (assigned unconditionally by src/stores/sync.js:52)
provides:
  - renderNotificationBellPopover() -> full bell + popover HTML template
  - topbar notification bell wired to market.unifiedBadgeCount
  - SYNC ERRORS section in popover delegates to Phase 11 sync-errors-modal
  - PRICE ALERTS section in popover navigates /preordain + sets tab to watchlist
affects: [topbar, sync-status-chip.test.js (extractChipRegion sentinel)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mount-point + innerHTML-before-Alpine.start() component injection -- Alpine parses every directive inside the injected HTML in its initial walk (single-pass binding, identical reactivity to a native template)"
    - "Open-guarded @keydown.escape.window (Pitfall 4) -- `if (open) open = false` prevents the handler swallowing Escape for higher-priority consumers"
    - "x-cloak on popover surface (Pitfall 6) -- the global [x-cloak]{display:none} rule in index.html:13 keeps the popover hidden until Alpine attaches, so no initial-render flash"
    - "Append-only extension of the prefers-reduced-motion selector list (Pattern 8) -- zero duplicate @media blocks; selector list now spans 7 surfaces across Phases 8, 8.1, 9, and 12"

key-files:
  created:
    - src/components/notification-bell-popover.js
    - tests/notification-bell-popover.test.js
  modified:
    - src/components/topbar.js                  # handleNotifications() removed (dead code cleanup)
    - index.html                                # 9-line bell button -> <div id="cf-notification-bell-mount">
    - src/main.js                               # imports renderNotificationBellPopover + injects before Alpine.start()
    - src/styles/main.css                       # adds .cf-bell-popover rule + extends reduced-motion selector list
    - tests/sync-status-chip.test.js            # Rule 1 auto-fix: extractChipRegion sentinel re-pointed from aria-label to the new mount-point id

key-decisions:
  - "Inject via mount-point innerHTML BEFORE Alpine.start() (not after). Alpine binds directives during its initial walk; injecting before start means every directive in the popover template is picked up in one pass with no rebind step. Plan sketched both approaches; the pre-start mount turned out to be the only one that keeps reactivity identical to a native template since post-start injection would need Alpine.initTree() calls per mount."
  - "Auto-fix sync-status-chip.test.js sentinel rather than preserve aria-label=\"Notifications\" on the mount div (Rule 1). The old sentinel exploited an implementation detail (inline bell aria-label) the plan was explicitly replacing. Re-pointing to id=\"cf-notification-bell-mount\" makes the sentinel structural rather than textual -- it survives future copy changes to the bell button."
  - "Skip post-Alpine.start() defensive Alpine.initTree() call. Tested before commit; pre-start injection worked cleanly and adding initTree() would have masked a real reactivity bug if the injection ever moved post-start. Leaving the single injection point keeps the intent visible."

requirements-completed:
  - SYNC-08

# Metrics
duration: ~3.6 min
completed: 2026-04-19
---

# Phase 12 Plan 03: Notification Bell Popover (SYNC-08)

**Turned the previously-inert topbar notification bell into a 320px popover unified across sync errors and price alerts, with sync-error actions bridged to the Phase 11 modal and price-alert actions bridged to the Preordain watchlist tab.**

## Performance

- **Duration:** ~3.6 min (215s start-to-commit)
- **Started:** 2026-04-19T08:39:03Z
- **Completed:** 2026-04-19T08:42:38Z
- **Tasks:** 2 (1 RED test commit + 1 GREEN implementation commit, TDD pair)
- **Files created:** 2 (notification-bell-popover.js, notification-bell-popover.test.js)
- **Files modified:** 5 (topbar.js, index.html, main.js, main.css, sync-status-chip.test.js)

## Accomplishments

- `renderNotificationBellPopover()` exported from `src/components/notification-bell-popover.js` returning the full bell + popover HTML in a single template literal -- Alpine binds every directive inside it when the template is injected ahead of `Alpine.start()`.
- Bell badge now reads from `market.unifiedBadgeCount` (Plan 12-01's getter) instead of the v1.0 `market.alertBadgeCount`. The unified count sums sync errors + price alerts so a single glyph surfaces both notification classes.
- SYNC ERRORS section in the popover calls `window.openSyncErrorsModal()` (the Phase 11 global) -- no duplicate retry/discard code path; the Phase 11 modal owns the writes.
- PRICE ALERTS section lists each `pendingAlert` row with card name + price delta copy (`dropped to €N -- below €M`) and a GO TO WATCHLIST footer link that navigates to `/preordain` + calls `market.setTab('watchlist')`.
- Empty state (`All clear`) renders when `unifiedBadgeCount === 0`.
- Old `handleNotifications()` method on `topbarComponent` -- dead code since the topbar inline bell never wired an `@click` to it in the first place -- was removed; `topbarComponent` now returns only `handleSearch`.
- 10 new unit tests in `tests/notification-bell-popover.test.js` covering the full contract (x-data, badge binding, @click.outside, @keydown.escape.window with open-guard, x-cloak, x-transition, both gated sections, empty state, mono-font styling, 320px width, x-for over pendingAlerts).
- Full test suite: 885 pass / 25 skipped / 10 todo (up from 876 pass -- the 9 sync-status-chip tests now pass against the new mount-point sentinel; 10 new popover tests added; net +10 passing tests from this plan).

## Task Commits

1. **Task 1: RED -- failing tests for notification bell popover** -- `1009fcf` (test)
2. **Task 2: GREEN -- implement notification-bell-popover component + wiring + delete handleNotifications + CSS** -- `c461863` (feat)

## Files Created/Modified

- **Created** `src/components/notification-bell-popover.js` -- 120 lines including JSDoc. Exports `renderNotificationBellPopover()` returning a template literal that parses cleanly as HTML inside Alpine's reactive walk. The popover surface uses `x-cloak`, `x-show="open"`, `x-transition.origin.top.right`, `@click.outside="open = false"`, and `@keydown.escape.window="if (open) open = false"` (the `if (open)` guard is Pitfall 4 mitigation -- avoids swallowing Escape for higher-priority modal consumers when the popover is already closed). Three gated sections: SYNC ERRORS (`x-show="syncErrorCount > 0"` with a single summary row + VIEW SYNC ERRORS button calling `window.openSyncErrorsModal`), PRICE ALERTS (`x-show="pendingAlerts.length > 0"` with an `x-for` over `pendingAlerts` + GO TO WATCHLIST footer button calling `window.__counterflux_router.navigate('/preordain')` followed by `market.setTab('watchlist')`), and the empty-state block (`x-show="unifiedBadgeCount === 0"` with the literal copy `All clear`).
- **Created** `tests/notification-bell-popover.test.js` -- 10 unit tests, all string-assertion style (no jsdom render needed). Mirrors the Plan 12-02 `tests/spoiler-set-filter.test.js` pattern.
- **Modified** `src/components/topbar.js` -- deleted `handleNotifications()`. File went from 37 to 20 lines. The topbar component is retained (returns `handleSearch` only) because some future topbar features may re-use the shell, but `handleNotifications` was never wired to any `@click` anyway (grep across the codebase returns zero call sites).
- **Modified** `index.html` -- replaced the 9-line bell button block at lines 342-350 with a single `<div id="cf-notification-bell-mount"></div>`. The mount div keeps the right-section topbar layout identical; `main.js` fills it after all store inits but before `Alpine.start()`.
- **Modified** `src/main.js` -- added `import { renderNotificationBellPopover } from './components/notification-bell-popover.js';` at the imports block and inserted a 4-line mount call (`const bellMount = document.getElementById('cf-notification-bell-mount'); if (bellMount) bellMount.innerHTML = renderNotificationBellPopover();`) immediately before `Alpine.start()`.
- **Modified** `src/styles/main.css` -- (1) appended `.cf-bell-popover` to the comma-separated selector list of the existing `@media (prefers-reduced-motion: reduce)` block at line ~187 (Pattern 8 convention -- zero duplicate media blocks), and (2) added a dedicated Phase 12 Plan 03 section at the end of the file with a `.cf-bell-popover` rule holding the `transition` and `box-shadow` declarations.
- **Modified** `tests/sync-status-chip.test.js` -- re-pointed the `extractChipRegion()` end sentinel from `aria-label="Notifications"` (the old inline bell attribute) to `id="cf-notification-bell-mount"` (the new mount div id). This is Rule 1 auto-fix: the test was written against the v1.0 inline bell, and removing the inline bell broke the test's extraction logic. Updated comment in the test explains the sentinel change.

## Decisions Made

- **Inject BEFORE `Alpine.start()`, not after.** Alpine walks the DOM in its initial `start()` call and binds every directive it finds. Injecting the popover HTML into the mount div before `start()` means the bell button + popover directives are picked up in that initial walk -- identical reactivity guarantees to a native template written directly in `index.html`. Injecting after `start()` would have required a manual `Alpine.initTree(bellMount)` call, which is more fragile (silently no-ops if the element isn't connected yet) and adds a potential race with the sidebar/splash-screen registrations.

- **Auto-fix `tests/sync-status-chip.test.js` rather than preserve a brittle textual sentinel.** The old sentinel (`aria-label="Notifications"`) was a textual marker on the inline bell button -- removed as part of Plan 12-03's explicit contract. Preserving it would have meant leaving `aria-label="Notifications"` on the mount div (misleading, as the div itself is empty until `innerHTML` runs) OR duplicating the aria-label in both the mount div and the popover's bell button (confusing Alpine's aria-expanded binding). Rule 1 applied: re-pointed the sentinel to the structural `id="cf-notification-bell-mount"` marker so future copy/locale changes to the bell cannot break the sync-status-chip extraction logic.

- **No post-Alpine.start() `Alpine.initTree()` fallback.** Explored the fallback pattern during drafting but rejected it: injecting before `start()` works cleanly (verified against the full test suite + `npm run build`), and adding a defensive `initTree()` call would mask a real reactivity bug if the injection site ever moves post-start. Keeping the single injection point surfaces the intent clearly for future maintainers.

- **Popover surface uses inline `style=` for custom-property references rather than Tailwind utilities.** The plan's template sketch mixed Tailwind utilities for layout (`absolute right-0 top-full mt-[8px] w-[320px]`) and inline `style="background: var(--color-surface)"` for design tokens. Preserved this split because the tokens come from the project's custom `@theme` block in `styles.css` and are not wrapped in Tailwind utility classes -- referencing them directly keeps the palette synchronised with the design system.

- **Price-alert row copy uses the EUR thresholds verbatim.** CONTEXT doesn't specify whether to convert to GBP for the popover row. Preserved the raw `€{threshold}` / `€{current}` copy because the underlying `pendingAlerts` entries store `threshold_eur` and `current_eur`, and converting inline in the template would require loading `eurToGbp` into the component (cross-store dependency). Watchlist's own screen handles the GBP conversion; popover surfaces the raw Scryfall price pairs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 -- Bug] `tests/sync-status-chip.test.js` broke when the inline bell's `aria-label="Notifications"` was removed.**
- **Found during:** Task 2 GREEN -- first full `npm test --run` showed 9 sync-status-chip failures.
- **Issue:** The test's `extractChipRegion()` helper used `html.indexOf('aria-label="Notifications"')` as the end-of-chip sentinel. Plan 12-03's explicit contract replaces the inline bell (which carried that aria-label) with a mount point div. No sentinel, no region slice, all 9 chip tests fall over with `Error: Notifications anchor not found`.
- **Fix:** Re-pointed the sentinel to `id="cf-notification-bell-mount"` -- a structural marker guaranteed to appear in the same topbar right-section position but tied to a stable selector rather than copy. Updated the comment above the extraction helper to explain the Plan 12-03 origin.
- **Files modified:** `tests/sync-status-chip.test.js` (extractChipRegion helper + comment)
- **Commit:** `c461863` (rolled into the GREEN commit -- part of the same atomic index.html / test change pair)

No other deviations; plan executed as written otherwise.

## Issues Encountered

- **Pre-existing uncaught exceptions in `tests/router.test.js`** (4 errors on `$store.collection.precons.length`). Same issue flagged in the Plan 12-01 SUMMARY (line 100). Confirmed unchanged by this plan's diff -- the errors originate in Alpine reactive-template teardown during async test shutdown, not test assertions. Out of scope per the SCOPE BOUNDARY rule. Test file still reports 17/17 pass.

## User Setup Required

None -- no environment variables, no external services, no first-run flow changes. Reloading the dev server after pulling Plan 12-03 should show the new popover on the next bell click.

## Next Phase Readiness

**Plan 12-04 (spoiler browser refresh) is unblocked** -- it has no dependency on the bell popover; that plan consumes `market.groupedSpoilerCards` which Plan 12-01 already shipped. Plan 12-03 is the last Wave 2 UI consumer of Plan 12-01's market-store additions; Wave 2 is complete once Plan 12-04 lands.

**No interface changes** to `market.js`, `sync.js`, or `sync-errors-modal.js` -- Plan 12-03 purely consumed their existing surface area (getters, polled fields, global modal opener). Downstream phases can ignore Plan 12-03 when planning their own store/DB work; it's a pure UI composition.

## Self-Check

- `src/components/notification-bell-popover.js` exists: FOUND
- `tests/notification-bell-popover.test.js` exists: FOUND
- Commit `1009fcf` (RED): FOUND
- Commit `c461863` (GREEN): FOUND
- All 10 popover test identifiers present and passing (string-assertion style, verified via `npm test -- notification-bell-popover --run`)

### Acceptance-criteria grep gates

| Check | Location | Result |
|-------|----------|--------|
| `export function renderNotificationBellPopover` | src/components/notification-bell-popover.js | 1 match |
| `$store.market.unifiedBadgeCount` | src/components/notification-bell-popover.js | 3 matches (badge x-show + x-text + empty-state gate) |
| `$store.market.syncErrorCount` | src/components/notification-bell-popover.js | 3 matches (section x-show + x-text + singular/plural template) |
| `$store.market.pendingAlerts` | src/components/notification-bell-popover.js | 3 matches (section x-show + x-for + key) |
| `window.openSyncErrorsModal()` | src/components/notification-bell-popover.js | 1 match (in VIEW SYNC ERRORS click handler) |
| `$store.market.setTab('watchlist')` | src/components/notification-bell-popover.js | 1 match |
| `window.__counterflux_router.navigate('/preordain')` | src/components/notification-bell-popover.js | 1 match |
| `SYNC ERRORS`, `PRICE ALERTS`, `VIEW SYNC ERRORS`, `GO TO WATCHLIST`, `All clear` | src/components/notification-bell-popover.js | all present |
| `@click.outside="open = false"` | src/components/notification-bell-popover.js | 1 match |
| `@keydown.escape.window="if (open) open = false"` | src/components/notification-bell-popover.js | 1 match |
| `x-cloak`, `x-transition`, `w-[320px]` | src/components/notification-bell-popover.js | all present |
| `handleNotifications` | src/components/topbar.js | 0 matches (removed) |
| `cf-notification-bell-mount` | index.html | 1 match |
| `renderNotificationBellPopover` | src/main.js | 2 matches (import + mount call) |
| `.cf-bell-popover` | src/styles/main.css | 2 matches (reduced-motion selector list + dedicated rule) |
| Commit `test(12-03): RED` | git log | present |
| Commit `feat(12-03): GREEN` | git log | present |
| Full test suite | `npm test -- --run` | 885 pass / 25 skipped / 10 todo (no new failures) |
| Production build | `npm run build` | built in 389ms, zero errors |

## Self-Check: PASSED

---
*Phase: 12-notification-bell-preordain-spoiler-refresh*
*Plan: 03*
*Completed: 2026-04-19*
