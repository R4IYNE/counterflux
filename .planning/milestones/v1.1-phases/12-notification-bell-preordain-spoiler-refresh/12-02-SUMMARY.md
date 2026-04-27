---
phase: 12-notification-bell-preordain-spoiler-refresh
plan: 02
subsystem: ui
tags: [alpine, keyrune, dropdown, market, spoiler, custom-select]

# Dependency graph
requires:
  - phase: 08-treasure-cruise-rapid-entry
    provides: ss-fallback keyrune convention (precon-browser.js pattern)
  - phase: 11-cloud-sync-engine
    provides: Dexie v10 schema and market store surface (unchanged)
provides:
  - renderSpoilerSetFilter() — pure template-returning function exporting a Keyrune-aware custom Alpine dropdown
  - Custom-select precedent for future Counterflux icon-bearing dropdowns
  - Pitfall 4/6/7 defences baked into the template (escape guard, x-cloak, click-outside on menu)
affects: [12-04-spoiler-gallery-rewrite, future-keyrune-selects]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Custom Alpine dropdown with keyrune glyphs inside <li><button> options
    - @click.outside on dropdown menu (not trigger) to avoid same-click race
    - @keydown.escape.window with if (open) guard to avoid escape-consumer collisions
    - x-cloak + x-transition.origin.top on dropdown menu to prevent initial-render flash

key-files:
  created:
    - src/components/spoiler-set-filter.js
    - tests/spoiler-set-filter.test.js
  modified: []

key-decisions:
  - "Component isolated in its own module so Plan 12-04 can swap <select> with one import + interpolation — avoids coupling dropdown state to gallery render"
  - "ss-fallback paired with every dynamic ss-{code} class (defence-in-depth, Pitfall 2) — both on trigger icon and option icons"
  - "@click.outside lives on the <ul> dropdown menu, NOT the trigger button — avoids the same-click open-then-close race (Pitfall 7)"
  - "Escape handler uses 'if (open)' guard per Pitfall 4 — prevents popover from swallowing Escape for other handlers when already closed"
  - "x-cloak on the dropdown prevents Alpine's initial-render flash (Pitfall 6) — mirrors precon-browser.js convention"
  - "Trigger button renders active set's Keyrune icon + name via $store.market.sets.find(...)?.name fallback — no store extension needed"

patterns-established:
  - "Pattern: Custom Alpine dropdown with icon-bearing options — standalone template function returning Alpine x-data HTML, consumable via single interpolation"
  - "Pattern: Keyrune in dynamic options — 'ss-' + set.code.toLowerCase() binding paired with static ss-fallback class"
  - "Pattern: Click-outside placement — listener goes on the menu (inside the open/close scope), trigger click stays 'inside' the scope, no self-trigger"

requirements-completed: [MARKET-01]

# Metrics
duration: 3m
completed: 2026-04-19
---

# Phase 12 Plan 02: Spoiler Set Filter (Keyrune Dropdown) Summary

**Custom Alpine dropdown exporting renderSpoilerSetFilter() with per-option Keyrune set glyphs, replacing the native `<select>` paradigm for MARKET-01; ready for Plan 12-04 to wire into spoiler-gallery.js.**

## Performance

- **Duration:** 2m 36s (156s)
- **Started:** 2026-04-19T08:30:13Z
- **Completed:** 2026-04-19T08:32:49Z
- **Tasks:** 2
- **Files created:** 2 (1 component, 1 test file)

## Accomplishments
- Shipped `renderSpoilerSetFilter()` — a pure template function returning a 320-px-min-width Alpine custom dropdown with Keyrune icons, set names, and card counts per option
- Authored 8 structural unit tests locking down every Alpine directive required for MARKET-01: open flag, click-outside, escape guard, x-cloak, ss-fallback, dynamic ss-{code} class binding, store iteration, load-and-close handler, and Neo-Occult Terminal colour tokens
- Established the custom-select precedent Counterflux previously lacked — documented in patterns-established for future icon-bearing dropdowns (e.g., any screen where a `<select>` cannot host glyphs)
- All three high-impact Pitfalls from 12-RESEARCH are baked into the template: Pitfall 2 (ss-fallback), Pitfall 4 (escape guard), Pitfall 6 (x-cloak), Pitfall 7 (click-outside on menu)

## Task Commits

Each task was committed atomically with TDD RED/GREEN pairs:

1. **Task 1: RED — failing tests for spoiler-set-filter custom dropdown** — `61a0905` (test)
2. **Task 2: GREEN — implement renderSpoilerSetFilter custom Alpine dropdown** — `c323048` (feat)

Both commits used `--no-verify` flag per parallel-executor convention (orchestrator validates hooks post-merge).

## Files Created/Modified

### Created
- `src/components/spoiler-set-filter.js` — 76 lines; exports `renderSpoilerSetFilter()` returning Alpine-templated HTML string for a custom Keyrune-aware dropdown. Header comment documents the Pattern 4 contract from 12-RESEARCH and every Pitfall defence.
- `tests/spoiler-set-filter.test.js` — 60 lines; 8 structural assertions covering x-data/open, click-outside + escape, ss-fallback class, dynamic lowercase set-code class, store iteration with `:key`, set.name + set.card_count render, loadSpoilers+close handler, Neo-Occult tokens, x-cloak.

### Modified
- None — this plan ships a new component in isolation. Plan 12-04 owns the spoiler-gallery.js swap.

## Decisions Made

- **Component in its own module:** Per the plan's scope boundary — splitting the dropdown from spoiler-gallery.js means Plan 12-04 gets a single-import single-interpolation swap, and dropdown state can never couple to gallery render logic. This plan's test suite tests the template in pure string-assertion form (no jsdom mount); Plan 12-04 can then test gallery-level behaviour separately.
- **Trigger uses $store.market.sets.find(...)?.name to display active set name:** Optional-chain + nullish fallback keeps the template a pure template (no JS helper needed) while avoiding TypeError if a user selects a code whose set entry was removed. Matches the defensive-read pattern the topbar already uses.
- **Both trigger icon and option icons use class="ss ss-fallback" with dynamic :class binding:** This means BOTH `<i>` elements carry `ss-fallback` defence — unknown codes render the fallback planeswalker glyph instead of blank. Consistent with precon-browser.js:162.

## Deviations from Plan

None — plan executed exactly as written. All 8 GREEN tests pass on the first GREEN commit; no auto-fix deviations triggered.

## Issues Encountered

- **Pre-existing `tests/router.test.js > vandalblast shows game tracker screen with setup` failure** — ran `npm test` full suite and observed this failure. Verified it is pre-existing on HEAD (exists in the worktree branch point `ce0e861`, unrelated to this plan's changes in `src/components/spoiler-set-filter.js` / `tests/spoiler-set-filter.test.js`). STATE.md previously noted this was fixed in Phase 09 Plan 02, but it resurfaced in this worktree's branch history. Out of scope per deviation-rule SCOPE BOUNDARY — Plan 12-02 only ships a new component and test file, neither of which touches the vandalblast screen or its imports. Logged as a deferred item; orchestrator should verify the main branch's router.test.js state before considering this a regression.
- **Worktree phase-directory gap:** The `worktree-agent-af7ea342` branch was forked from `ce0e861` which pre-dates the `f0498d8` phase-12 planning commit, so `.planning/phases/12-*/` does not exist in the worktree's tree. Created the directory in the worktree at commit time so SUMMARY.md can be tracked. Main-repo path has the full `.planning/phases/12-*/` from upstream commits.

## User Setup Required

None — no external service configuration required. Pure frontend component addition.

## Next Phase Readiness

- **Plan 12-04 unblocked:** Can import `renderSpoilerSetFilter` from `'./spoiler-set-filter.js'` and drop a single `${renderSpoilerSetFilter()}` interpolation in place of the current `<select>` at `spoiler-gallery.js:31-41`. Zero expected refactor surface in gallery state.
- **No schema change, no store change, no dependency:** Trivially composes with the broader Phase 12 scope.
- **Future-proof:** Pattern documented in patterns-established; any subsequent screen that wants a Keyrune-bearing dropdown can clone this component verbatim.

## Self-Check: PASSED

- `src/components/spoiler-set-filter.js`: FOUND
- `tests/spoiler-set-filter.test.js`: FOUND
- Commit `61a0905` (RED): FOUND in git log
- Commit `c323048` (GREEN): FOUND in git log
- `npm test -- spoiler-set-filter`: 8/8 passing
- Full-suite regression: unchanged (pre-existing router.test.js vandalblast failure documented, not introduced by this plan)

---
*Phase: 12-notification-bell-preordain-spoiler-refresh*
*Plan: 02*
*Completed: 2026-04-19*
