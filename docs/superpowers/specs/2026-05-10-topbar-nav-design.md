# Topbar Navigation — Design

**Date:** 2026-05-10
**Author:** James Arnall (via brainstorming with Claude)
**Status:** Approved — ready for implementation plan
**Scope:** Counterflux app shell — move static navigation from sidebar to topbar

## Summary

Counterflux's app shell currently renders a global left sidebar carrying the brand block, the 5-screen navigation, a collapse toggle, and Mila's chrome presence. This design replaces the sidebar with a single-row top bar that absorbs the brand and screen navigation. The sidebar element is removed entirely. Screens that already have their own internal left-side panel layouts (Treasure Cruise's add-card workbench, Thousand-Year Storm's three-panel editor) are untouched — those panels live inside each screen's content area, not in global chrome. Dashboard, Market Intel, and Game Tracker simply reclaim the freed-up left edge as full-width content.

The change is a minimal-blast-radius UI refactor: chrome-level only, no per-screen layout work, no new abstractions.

## Decisions captured

| Decision | Choice | Rationale |
|---|---|---|
| What moves to the topbar | Screens + brand block | User confirmed both screen-router links AND the COUNTERFLUX wordmark/logo block move together. |
| Sidebar fate | Contextual panel — but interpreted minimally | No global sidebar abstraction. Each screen owns its own left-side layout. Existing per-screen panels stay where they are. |
| Empty-sidebar behavior | Hide entirely | Screens without a contextual panel render at full width. No thin rail, no ambient content. |
| Topbar layout | Approach A — single row | Brand-left, nav-immediately-after, search + actions right-justified. Single row matches the dense Neo-Occult Terminal aesthetic. |
| Nav labels | Plain function names | `Dashboard / Collection / Decks / Market / Game`. Card names (Epic Experiment, Treasure Cruise, etc.) retained as the page H1 inside each screen. Plain labels keep the topbar legible at 1280px+. |
| Mila + collapse toggle | Mila in Dashboard only, toggle gone | Mila vacates chrome and continues to live in Dashboard's existing "Mila's Insights" card plus empty states. Sidebar collapse toggle removed — no global sidebar to collapse. |
| Implementation approach | Approach 1 — minimal | Remove the global sidebar. Don't introduce a contextual-sidebar slot abstraction. Don't refactor existing per-screen layouts. |

## Architecture

The app shell loses its global `<aside>` sidebar entirely. The topbar grows from "actions-only" to "full chrome":

```
+--------------------------------------------------------------------------+
| [~] COUNTERFLUX   Dashboard Collection Decks Market Game     [search]    |
|                                                              [pill] [B] [S] [U] [P]
+--------------------------------------------------------------------------+
|                                                                          |
| ... screen content area, full width by default ...                       |
|                                                                          |
+--------------------------------------------------------------------------+
```

The topbar remains a single row at its existing height (no vertical growth). The brand block uses the existing Material Symbols cyclone icon + JetBrains Mono uppercase wordmark treatment (same as the current sidebar brand block, transplanted). The 5-screen nav reads from `Alpine.store('app').screens` and binds its active state to `Alpine.store('app').currentScreen`. Active state styling: blue accent (#0D52BD) on text + 2px bottom border, replacing the current sidebar's `border-r-4 border-primary` left-edge treatment. Inactive nav links use the existing muted text colour; hover state matches existing topbar link patterns.

Existing topbar elements remain unchanged in position and behaviour: search input, bulk-data progress pill (Phase 13), 4-state sync chip (Phase 11), notification bell (Phase 12), profile avatar (Phase 10).

## Components / Files

| File | Change |
|---|---|
| `index.html` | Remove the `<aside class="fixed left-0...">` block (lines ~117-191 of current index.html). Topbar single-row block widens to host the brand block at left and the 5-screen nav block immediately after the brand. |
| `src/components/topbar.js` | Add brand block (cyclone icon + wordmark, transplanted from sidebar). Add nav block reading `Alpine.store('app').screens`, active state bound to `currentScreen`. Preserve all existing topbar functionality. |
| `src/components/sidebar.js` | **Delete.** No replacement file. |
| `src/stores/app.js` | Remove `sidebarCollapsed` state + `toggleSidebar()` action. Keep `screens` array + `currentScreen` (still used by topbar nav). |
| `src/styles.css` and any module-level CSS | Audit for left-padding/margin offsets assuming 60px (`w-60`) or 16px (`w-16`) sidebar width. Content area becomes full-width. |
| `src/main.js` | If it imports `sidebar.js`, remove the import. |
| `.planning/PROJECT.md` | Update "Mila — Corgi system familiar (sidebar, empty states, tips)" to drop the sidebar mention. |
| `tests/sidebar.test.js` | **Delete.** No sidebar to test. |
| `tests/topbar.test.js` | Add tests for brand rendering, nav link rendering, active-state highlighting, click-routes-correctly. |

## Out of scope

Explicitly NOT in this design:

- **No new "contextual sidebar slot" abstraction.** That was Approach 2 territory. If a future screen wants a left panel, it builds one inside its own content area.
- **No redesign of Treasure Cruise or Thousand-Year Storm internal layouts.** Their existing add-card workbench and three-panel editor stay exactly as they are.
- **No mobile responsive topbar treatment.** Counterflux is desktop-first. Vandalblast is the only mobile-targeted screen, and it's full-screen and unaffected by chrome changes.
- **No migration of Mila's existing content.** She already lives in Dashboard's "Mila's Insights" card plus empty states. The sidebar reference is the only thing removed; her content stays where it is.
- **No fix for the 4 pre-existing uncaught Alpine errors in `tests/router.test.js`.** They were broken before this change.

## Edge cases

- **Topbar overflow at narrow widths.** Estimated width budget: brand ~140px + 5 nav links × ~80px = 400px + search 220px + 4 action chips ~140px ≈ 900px. Fits 1280px+ comfortably. Below 1280px (rare on this desktop-first app), the nav block allows horizontal scroll inside itself; the search input shrinks to a 180px minimum. No hamburger collapse.
- **Static auth-wall (z-90) and migration splash (z-50).** Both render above the shell. Neither touches the sidebar in DOM or CSS. Unchanged.
- **Keyboard shortcuts (`?`, `/`, `ESC`, `Ctrl+Z`).** All bound to `window`. Unaffected by sidebar removal.
- **Orphaned `sidebarCollapsed` value in localStorage** (if persisted by the current Alpine store). Acceptable — the key sits unused; no migration step needed.
- **Screens that previously assumed sidebar offset in CSS.** Audit during implementation. Most screen-level CSS in the codebase uses Tailwind utility classes; any `pl-60` or similar offsets need to be removed.

## Testing

- **`tests/topbar.test.js`** — new test cases:
  1. Brand block renders: cyclone Material Symbol + "COUNTERFLUX" wordmark.
  2. All 5 nav links render with correct plain labels and routes.
  3. Clicking a nav link calls `window.__counterflux_router.navigate(route)` with the right path.
  4. The link whose route matches `Alpine.store('app').currentScreen` carries the active styling class.
  5. Existing topbar features still render (search, bell, sync chip, profile, bulk-data pill).
- **`tests/sidebar.test.js`** — delete.
- **Per-screen smoke (manual).** Open each of the 5 screens. Confirm no left-edge content clipping, Treasure Cruise add-card panel positions correctly, Thousand-Year Storm three-panel layout positions correctly, Mila no longer appears in chrome on any screen.
- **Full suite** — `npm test` passes at ≥ pre-change rate (1053+ tests minus deleted sidebar tests plus new topbar tests).
- **Lighthouse soft-gate** — existing CI `@lhci/cli` warning-only check still passes. Layout shift on first paint should be ≤ pre-change (likely improves: the static auth-wall already paints the LCP element and fewer competing chrome elements means less cumulative shift).

## Rollout

- **Workflow:** `/gsd:quick`. Pattern matches the recent 260510-k4t bulk-pull-resume fix. Small, focused, atomic. Not a phase.
- **Commit plan:**
  1. RED tests for topbar nav (brand + nav links + active state + routing).
  2. GREEN topbar nav implementation.
  3. Sidebar removal + CSS audit + `src/stores/app.js` cleanup.
  4. Docs touch-up (`PROJECT.md` Mila line).
- **Deploy:** Vercel auto-deploys on master push. No manual promotion step.
- **Risk:** low. Pure UI change. No data migration, no auth impact, no sync impact. Worst case: a screen has a residual left padding that needs a CSS tweak post-deploy.
