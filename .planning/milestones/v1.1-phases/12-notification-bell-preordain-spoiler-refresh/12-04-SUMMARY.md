---
phase: 12-notification-bell-preordain-spoiler-refresh
plan: 04
subsystem: ui
tags: [alpine, spoiler-gallery, market, keyrune, hover-preview, bookmark, watchlist, preordain]

# Dependency graph
requires:
  - phase: 12-notification-bell-preordain-spoiler-refresh
    provides: groupedSpoilerCards getter (Plan 01) + renderSpoilerSetFilter() (Plan 02)
  - phase: 08-treasure-cruise-rapid-entry
    provides: .card-tile-hover + .card-quick-actions-checkbox precedent (Plan 08.1 Plan 3 hover-reveal pattern cloned 1:1)
  - phase: 11-cloud-sync-engine
    provides: market.watchlist unchanged (no schema delta consumed)
provides:
  - Rewritten src/components/spoiler-gallery.js — sectioned grid with day headers, hover preview, hover-reveal bookmark
  - .cf-spoiler-bookmark + .cf-hover-preview CSS classes (clone of Phase 08.1 hover-reveal pattern, top-LEFT + .is-watching modifier)
  - Static-grep gate enforcing D-10 (no notification-surface references in spoiler-gallery.js)
affects: [12-VERIFICATION, future-spoiler-tile-changes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Sectioned template grid with getter-driven grouping (Plan 01 getter + Plan 04 renderer)
    - Hover-reveal affordance with persistent .is-watching modifier (clone of .card-quick-actions-checkbox)
    - Viewport-edge-aware preview flip via inline @mouseenter (window.innerWidth - rect.right < 270)
    - DFC-safe image fallback on hover overlay (card.card_faces[0].image_uris.normal)
    - Static-grep gate in tests to lock down invariants (no notification surface in source)
    - Merged @media (prefers-reduced-motion: reduce) block with new selectors appended (Phase 9 convention preserved)

key-files:
  created:
    - tests/spoiler-gallery.test.js
  modified:
    - src/components/spoiler-gallery.js
    - src/styles/main.css

key-decisions:
  - "Day-section render wrapped in outer x-if on groupedSpoilerCards.length > 0 (Pitfall 8) — keeps the two existing empty-state templates as single source of truth for 'no cards' UX, no new empty state needed"
  - "formatReleaseDate declared as an inline x-data method (not a store getter) — release-calendar.js:12-18 precedent; only 12 month strings, zero locale ambiguity, cheaper than pulling in an Intl helper"
  - "isWatching is a per-tile Alpine getter reading $store.market.watchlist.some(...) — market.js re-ASSIGNS watchlist on every add/remove (Pitfall 1), so Alpine's reactivity re-runs .some() for free with no parallel Set bookkeeping"
  - "flipLeft threshold: 270px = 250 preview width + 8 margin + 12 safety — single-number literal in @mouseenter handler, no named constant (inline template-string code, unit tests assert the numeric)"
  - "Grid decomposed into two nested x-for: outer iterates groupedSpoilerCards (key=group.date), inner iterates group.cards (key=card.id) — Alpine re-renders per group when spoilerCards filters, no manual invalidation needed"
  - "Filter-bar block (colour/rarity/type) preserved verbatim from pre-Phase-12 file — zero UX churn to existing filter logic, tests/spoiler-filter.test.js unchanged 5/5"
  - "Static-grep gate on file source via Test 11 (readFileSync over spoiler-gallery.js) locks D-10 — mirrors settings-modal-auth.test.js Test 8 pattern; adjusted component comments to avoid the word 'toast' because the regex matches source-wide, not just code"
  - "CSS reduced-motion: extended Phase 8/08.1/09 Plan 2 merged block by appending .cf-spoiler-bookmark + .cf-hover-preview to the comma-list — NO duplicate @media block shipped"
  - "Bookmark CSS is a structural clone of .card-quick-actions-checkbox with three delta points: left:8px instead of right:8px (top-LEFT per D-09), added .is-watching selector for persistent visibility, glyph font-size 18px vs 16px (bookmark glyphs read better at 18)"

patterns-established:
  - "Pattern: Sectioned grid with getter-driven groups — market store getter returns [{date, cards}[]]; template does outer x-for over groups + inner x-for over cards with :key on both levels"
  - "Pattern: Hover-reveal toggle button with persistent 'selected' state — clone .card-quick-actions-checkbox CSS, add an .is-{state} modifier that forces opacity:1; the glyph swap IS the visual feedback (no toast, no separate selected pill)"
  - "Pattern: Viewport-edge preview flip — inline @mouseenter handler reads getBoundingClientRect() + window.innerWidth, sets a local Alpine flipLeft boolean that drives :class between 'left-full' and 'right-full'"
  - "Pattern: DFC-safe image binding — always write :src='card.image_uris?.{size} || card.card_faces?.[0]?.image_uris?.{size} || '''; Scryfall's DFCs (~3% of any set) crash otherwise (Pitfall 3)"
  - "Pattern: Static-grep invariant gate — readFileSync the source + regex .not.toMatch; cheaper than mock-based tests, enforces cross-file invariants like 'this module must not import X'"

requirements-completed: [MARKET-02, MARKET-03]

# Metrics
duration: 4m 20s
completed: 2026-04-19
---

# Phase 12 Plan 04: Spoiler Gallery Rewrite Summary

**Sectioned, hover-preview-driven, bookmark-ready spoiler grid replacing the flat v1.0 responsive grid — ships MARKET-01 wiring, MARKET-02 visuals, and MARKET-03 quick-add watchlist in a single template rewrite with zero new dependencies and zero regression.**

## Performance

- **Duration:** 4m 20s
- **Started:** 2026-04-19T08:37:32Z
- **Completed:** 2026-04-19T08:41:55Z
- **Tasks:** 2 (1 RED + 1 GREEN, TDD pair)
- **Files modified:** 2 (spoiler-gallery.js rewritten + main.css extended)
- **Files created:** 1 (tests/spoiler-gallery.test.js, 117 lines, 11 assertions)

## Accomplishments
- Rewrote `src/components/spoiler-gallery.js` to iterate `$store.market.groupedSpoilerCards` (Plan 12-01 getter) — cards now render in reverse-chronological `<section>`s with day headers formatted `APR 18, 2026 • 12 CARDS` on mono-font + ghost-border dividers (MARKET-02 / D-07)
- Swapped the native `<select>` for Plan 12-02's `renderSpoilerSetFilter()` — MARKET-01's Keyrune dropdown now ships on the Preordain screen via a single interpolation
- Added hover-reveal bookmark button in the top-left of every tile (MARKET-03 / D-09, D-10) — opacity 0 at rest, visible on `.card-tile-hover:hover`, persistent with `.is-watching` class when the card is on the watchlist; glyph swaps between `bookmark_add` and filled `bookmark` — no notification surface fires per D-10
- Added full-size hover card-image overlay at 250px (MARKET-02 / D-08) — DFC-safe via `card_faces[0].image_uris.normal` fallback (Pitfall 3), flips left when tile is within 270px of the viewport right edge
- Locked the grid to `grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` (D-06) — legacy responsive 5/6-col scale removed so tiles grow larger
- Authored 11 structural assertions in `tests/spoiler-gallery.test.js` covering every Phase 12 directive: custom-filter import, grouped-grid iteration, day-header format, fixed column count, NEW badge preservation, bookmark handlers, glyph swap, is-watching class, DFC fallback, flipLeft threshold, and a static-grep gate enforcing D-10 toast absence
- Extended the merged `@media (prefers-reduced-motion: reduce)` block with `.cf-spoiler-bookmark` and `.cf-hover-preview` — no duplicate `@media` block shipped (Phase 9 convention preserved)
- Closed the Phase 12 Preordain refresh triad: Plan 01 (store getters) + Plan 02 (keyrune dropdown) + Plan 04 (gallery rewrite) now compose into a cohesive MARKET-01/02/03 ship

## Task Commits

Each task was committed atomically with `--no-verify` per parallel-executor convention:

1. **Task 1: RED — failing tests for spoiler-gallery redesign** — `7bb7a63` (test)
2. **Task 2: GREEN — rewrite spoiler-gallery.js + add cf-spoiler-bookmark and cf-hover-preview CSS** — `7801ee1` (feat)

## Files Created/Modified

### Created
- `tests/spoiler-gallery.test.js` (117 lines, 11 assertions) — Structural contract tests against the HTML returned by `renderSpoilerGallery()`. Test 11 uses the `readFileSync` + regex pattern from `tests/settings-modal-auth.test.js` Test 8 to enforce D-10 (no `Alpine.store('toast')` or `$store.toast` references anywhere in the source).

### Modified
- `src/components/spoiler-gallery.js` (52 → 187 lines net, full rewrite) — Now imports `renderSpoilerSetFilter` from Plan 02 and iterates `$store.market.groupedSpoilerCards` from Plan 01. Filter-bar (colour/rarity/type) preserved verbatim. New per-tile Alpine scope exposes `hovered`, `flipLeft`, `card`, and a reactive `isWatching` getter.
- `src/styles/main.css` — Extended the existing `@media (prefers-reduced-motion: reduce)` block with `.cf-spoiler-bookmark` and `.cf-hover-preview`; appended the two new class definitions after `.card-quick-actions-checkbox` near the Phase 09 section boundary. `grep -c` gives 11 matches for `cf-spoiler-bookmark` (definition + selectors + reduced-motion entry) and 3 for `cf-hover-preview` (definition + reduced-motion entry + comment line) — comfortably above the plan's ≥2 requirement.

## Decisions Made

- **Outer `x-if` on `groupedSpoilerCards.length > 0`:** Per Pitfall 8, wrapping the day-section render in an outer guard preserves the two existing empty-state templates ("no set selected" + "set selected, zero cards") as the single source of truth — the plan explicitly specifies this structure, and it avoids a brief paint-frame where both a sectioned-grid skeleton and an empty-state Mila could render simultaneously.
- **`formatReleaseDate` declared inline in `x-data`:** Matches `release-calendar.js:12-18` precedent (manual month array, zero locale ambiguity). A store getter would require round-tripping to `market.js` and introduces an ownership-ambiguity question the plan doesn't address.
- **`isWatching` is a per-tile Alpine getter:** Reads `$store.market.watchlist.some(w => w.scryfall_id === this.card.id)`. Per Pitfall 1, `market.js` re-assigns `this.watchlist = await db.watchlist.toArray()` on every add/remove, so Alpine's reactivity tracks the reference and re-runs `.some()` for free — no parallel `Set` for O(1) lookup, no manual invalidation.
- **Bookmark `@click.stop`:** The bookmark lives inside the tile, and the tile's `@click` delegates to `$store.search.selectResult(card)` (opens the card flyout). Without `.stop`, clicking the bookmark would both toggle watchlist state AND open the card preview — user expectation is the bookmark is a local toggle, so stop propagation at the bookmark click.
- **Static-grep test for D-10:** Test 11 reads the source file directly via `readFileSync` and regexes `Alpine.store('toast')` + `$store.toast`. Cheaper and more durable than a mock-based test — enforces a file-wide invariant that survives future refactors. One side effect: component comments can no longer contain the literal word `toast` anywhere, since the regex matches source-wide. Adjusted the top-of-file doc comment to say "notification surface" instead of "toast" to satisfy the gate.
- **CSS clone deltas from `.card-quick-actions-checkbox`:** Three changes — `left: 8px` instead of `right: 8px` (top-LEFT per D-09), added `.cf-spoiler-bookmark.is-watching { opacity: 1 }` for persistent visibility when watching, glyph font-size `18px` vs `16px` (bookmark glyph has more interior density, reads better at 18). Everything else (transition, hover glow, focus-visible outline) copied structurally.

## Deviations from Plan

**[Rule 1 — Bug] Static-grep gate initially failed due to component comments** — Writing the GREEN component, I included doc comments that literally contained the words `toast`, `Alpine.store('toast')`, and `2xl:grid-cols-6` (referring to what the rewrite was REMOVING). The static-grep tests (Test 4 for `2xl:grid-cols-6` absence, Test 11 for toast absence) correctly caught these, turning 9/9 initial passes into 9/11. Rephrased the affected comments to describe the behaviour without the banned strings — e.g., "this file does NOT import or reference the notification surface" instead of "does NOT import toast.js or Alpine.store('toast')". All 11 tests passed after the edit.

- **Found during:** Task 2 (GREEN)
- **Issue:** Grep-based invariant tests match source-wide (comments + code), so prose mentioning the banned strings trips the gate
- **Fix:** Rephrased three comment lines in spoiler-gallery.js to avoid the literal banned strings while preserving the documentation intent
- **Files modified:** src/components/spoiler-gallery.js (3 comment edits)
- **Commit:** Folded into `7801ee1` (rephrased before committing GREEN)
- **Lesson:** When a test uses `readFileSync` + regex, the gate applies to the ENTIRE file, including JSDoc headers and HTML comments. Future static-grep gates should note this in their test description so the implementer expects it.

## Issues Encountered

- **Pre-existing `tests/router.test.js` async-cleanup noise:** Full suite `npm test` emits 4 unhandled async errors originating in `tests/router.test.js` (`TypeError: listenerTarget.removeEventListener is not a function` at `alpinejs/module.cjs.js:3516`). These are the same carry-over errors documented in `12-02-SUMMARY.md § Issues Encountered` and `12-01-SUMMARY.md`. The assertions themselves pass (17/17 on router.test.js, 909 passed / 0 failed on full suite). Zero new errors introduced by this plan. Out of scope per SCOPE BOUNDARY — deferred to a separate investigation outside Phase 12.
- **Worktree `.claude/` and `.planning/phases/11-*-PLAN.md` untracked files:** Pre-existing worktree drift from the branch point (`ce0e861`). Not introduced by this plan; same state as 12-01-SUMMARY and 12-02-SUMMARY noted. Out of scope.

## User Setup Required

None — pure frontend rewrite. Existing Scryfall data, existing watchlist store, existing Keyrune font. User will see the new visual layout on the next `npm run dev` / `npm run build`.

## Next Phase Readiness

- **Phase 12 complete after Plan 04:** With 12-01 (market store getters + SYNC-08 polling), 12-02 (spoiler-set-filter component), and 12-04 (this plan — gallery rewrite wiring all three) landed, only Plan 12-03 (notification-bell popover) remains. 12-03 and 12-04 are parallel (both in Wave 2, both depend on 12-01/02). No inter-plan blocking.
- **Visual UAT readiness:** All four Phase 12 plan deliverables compose into a visually-testable Preordain redesign. Suggested UAT flow: open Preordain → pick a set via the Keyrune dropdown → verify day-section headers render in mono-font with the `•` separator → hover a tile → verify 250px preview flies in from the right → hover a tile near the right edge → verify the preview flips left → hover a tile without clicking → verify bookmark button fades in top-left → click bookmark → verify glyph swaps to filled + persists after mouse leaves → click again → verify glyph returns to `bookmark_add` and bookmark fades out.
- **12-VERIFICATION touchpoints:** The plan's success criteria cover visual-only checks; automated coverage is complete (11 contract tests + 5 filter regression + 15 market-store regression + 8 spoiler-set-filter + merged into 100 test files full suite). No additional regression test files needed.
- **No DB or service work downstream:** Phase 12 is a pure UI phase; Plan 04 ships zero schema deltas, zero API changes, zero worker changes.

## Known Stubs

None. Scan of `src/components/spoiler-gallery.js` (the only modified component) shows every data binding sources from a real Alpine store getter (`$store.market.groupedSpoilerCards`, `$store.market.watchlist`, `$store.market.spoilerCards`, `$store.market.activeSet`, `$store.market.loading`) or a card field (`card.id`, `card.name`, `card.released_at`, `card.image_uris`, `card.card_faces`, `card.prices?.eur`, `card.set_name`, `card.set`). No hardcoded empty arrays, no placeholder text, no "TODO" / "coming soon" / "not available" strings. The template-level empty-state copy ("No cards revealed yet for this set." / "Select a set above to browse spoiler cards.") was preserved verbatim from the v1.0 file — these are live functional empty states keyed on real store flags, not stubs.

## Self-Check: PASSED

- `tests/spoiler-gallery.test.js`: FOUND (confirmed via ls)
- `src/components/spoiler-gallery.js`: FOUND and rewritten (52 → 187 lines)
- `src/styles/main.css`: FOUND and extended (11 `.cf-spoiler-bookmark` matches, 3 `.cf-hover-preview` matches, both in reduced-motion block)
- Commit `7bb7a63` (test RED): FOUND in git log
- Commit `7801ee1` (feat GREEN): FOUND in git log
- `npm test -- spoiler-gallery`: 11/11 passing
- `npm test -- spoiler-filter`: 5/5 passing (regression ok)
- `npm test -- market-store`: 15/15 passing (regression ok)
- `npm test -- spoiler-set-filter`: 8/8 passing (regression ok)
- Full-suite regression: 909 passed / 0 failed / 2 skipped (only the documented pre-existing router.test.js async-cleanup noise, no new failures)
- D-06 gate: `grep -n "2xl:grid-cols-6" src/components/spoiler-gallery.js` — no matches
- D-10 gate: `grep -n "toast" src/components/spoiler-gallery.js` — no matches
- CSS ≥2-matches gate: `cf-spoiler-bookmark` (11 matches) + `cf-hover-preview` (3 matches) both ≥ 2

---
*Phase: 12-notification-bell-preordain-spoiler-refresh*
*Plan: 04*
*Completed: 2026-04-19*
