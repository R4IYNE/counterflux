---
phase: 09-deck-accuracy-vandalblast-pod-experience
plan: 03
subsystem: vandalblast
tags: [vandalblast, game-store, turn-mechanics, wall-clock-timer, slot-machine-spinner, post-game-stats, alpinejs, dexie, vitest, tdd, jsdom, raf, prefers-reduced-motion]

# Dependency graph
requires:
  - phase: 07-polish-pass-perf-baseline-schema-migration
    provides: "Dexie v6 games_next.turn_laps schema field (backfilled to []); v8 games table preserves it under the clean name"
  - phase: 09-deck-accuracy-vandalblast-pod-experience-plan-02
    provides: ".cf-player-active CSS body + :class binding hook in player-card.js (keyed off $store.game.activePlayerIndex which Plan 3 ships); .cf-first-player-spinner @media (prefers-reduced-motion) selector entry; tests/setup.js MutationObserver/CustomEvent stubs (Plan 3 extends with RAF + matchMedia + cancelAnimationFrame)"
provides:
  - "GAME-07 first-player spinner: spinForFirstPlayer(playerNames) Promise<winnerIndex> with ease-out-expo deceleration, 2400ms total, 600ms settle, prefers-reduced-motion bypass, aria-live polite at settle"
  - "GAME-08 active player rotation: $store.game.activePlayerIndex state field + nextTurn advance modulo players.length with eliminated-skip safety counter; cf-player-active border-glow auto-activates via Plan 2's binding"
  - "GAME-09 turn-lap persistence: $store.game.turn_laps array; nextTurn pushes (Date.now() - turnStartedAt) lap; saveGame writes turn_laps + active_player_index to db.games row; final lap pushed in saveGame for the turn that ended without nextTurn"
  - "GAME-09 post-game TURN PACING section: 3 tiles (LONGEST TURN with player subtitle, AVG TURN, PER-PLAYER AVG sorted slowest first); mm:ss formatting; section x-show gated on turn_laps.length > 0 so v1.0 saved games hide cleanly"
  - "GAME-10 wall-clock anchor turn timer: startTimer rewritten to RAF display tick + Date.now() snapshot; setInterval no longer used; immune to background-tab throttling (Pitfall P-1 closed); 30-min vi.setSystemTime jump test proves accuracy"
  - "tests/setup.js cross-plan baseline: requestAnimationFrame falls through to setTimeout(cb, 16); cancelAnimationFrame -> clearTimeout; matchMedia returns matches:false stub (per-test override pattern documented inline)"
  - ".cf-first-player-spinner CSS body rule: 48px JetBrains Mono primary blue, fixed inset overlay, z-index 100, pointer-events: none"
affects: [phase-09-HUMAN-UAT-walk]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wall-clock anchor pattern: Date.now() snapshot + RAF display tick replaces setInterval accumulation. Reusable for any future duration-tracking component (round timer, sync-status freshness, idle-warning countdown). Proof test = vi.spyOn(Date, 'now') + arbitrary clock jump."
    - "Slot-machine spinner with ease-out-expo deceleration via RAF — single-file standalone module, no Alpine import; reusable for any future 'spin to pick' UX (e.g. random commander prompt, weighted dice roll animation)."
    - "Cross-plan CSS-class consumption pattern verified end-to-end — Plan 2 shipped .cf-player-active CSS body + :class binding placeholder; Plan 3 added the activePlayerIndex data field and the binding came online with ZERO further player-card.js edits. This validates the 'data field arriving later' coordination pattern from Phase 8.1 / Phase 9 Plan 2."
    - "vi.spyOn(Date, 'now') instead of vi.useFakeTimers() for wall-clock test control — fake timers deadlock with fake-indexeddb's internal microtask ordering (Dexie ops never resolve). Date.now spy keeps real timers + microtasks running normally while letting tests advance the wall clock arbitrarily."
    - "TURN PACING section x-show='turn_laps && turn_laps.length > 0' graceful degradation — v1.0 saved games (no turn_laps in record) hide the section entirely instead of rendering NaN/0:00 tiles. Future stats sections should follow the same gating pattern."
    - "Final-lap push in saveGame — the turn the user ended in (without pressing NEXT TURN) gets its lap captured by saveGame before the snapshot. Avoids losing the longest turn (often the final, decisive one) from the pacing data."
    - "TDD red→green commit pairs for both code-bearing tasks (Tasks 2 + 3 + 4). Task 1 (test infrastructure) committed as a single chore — tests don't fail in absence of stubs, they're enablers."

key-files:
  created:
    - "src/components/first-player-spinner.js — spinForFirstPlayer() standalone module"
    - "tests/first-player-spinner.test.js — 4 tests covering reduced-motion bypass, animation lifecycle, aria-live, edge cases"
    - "tests/post-game-overlay.test.js — 8 tests covering computePacingStats helper + renderPostGameOverlay HTML contract + _computePacing component method"
  modified:
    - "tests/setup.js — appended RAF + cancelAnimationFrame + matchMedia stubs (existing MutationObserver + CustomEvent stubs preserved); inline docblock describes per-test override patterns"
    - "src/styles/main.css — appended Phase 9 Plan 3 marker block with .cf-first-player-spinner body rule (selector entry already in @media block from Plan 2)"
    - "src/stores/game.js — startGame async + spinner integration; nextTurn lap push + activePlayerIndex advance + eliminated-skip; startTimer/pauseTimer/resetTimer rewritten for RAF + wall-clock anchor; saveGame final-lap + turn_laps + active_player_index persistence; init restore + _resetState updated; _debouncedAutoSave snapshot extended"
    - "src/components/post-game-overlay.js — formatLap helper + computePacingStats exported helper + TURN PACING HTML section + pacing computed property + _computePacing method on Alpine component"
    - "tests/game-store.test.js — added 8 Plan 3 tests in a new describe block using vi.mock('alpinejs') + real initGameStore + vi.spyOn(Date, 'now') for wall-clock control; existing 18 tests untouched"

key-decisions:
  - "Wall-clock test control via vi.spyOn(Date, 'now') NOT vi.useFakeTimers(). Fake timers deadlock with fake-indexeddb's internal timer-based microtask ordering — Dexie ops never resolve and afterEach hangs. Date.now spy keeps real timers running while letting the test advance the clock arbitrarily. Proven across 8 new game-store Plan 3 tests; 30-min jump test runs in <50ms."
  - "Final-lap push in saveGame, NOT just nextTurn. The turn the user ended the game in (by clicking END GAME without pressing NEXT TURN) gets its lap captured by saveGame BEFORE the gameRecord snapshot. Without this, the game's final turn — often the longest, most dramatic one — would be excluded from the pacing data."
  - "TURN PACING section x-show='turn_laps && turn_laps.length > 0'. Hides the entire section for legacy v1.0 saved games (no turn_laps field in old game records) instead of rendering NaN tiles or 0:00 placeholders. Discovered while writing Test 4 (empty turn_laps returns zero stats) — the helper handles emptiness gracefully but the UI should hide the section entirely rather than show all-zero tiles."
  - "PER-PLAYER AVG sorted slowest first per CONTEXT D-19. The slowest player is the most actionable insight ('your decks are taking forever to fire'); putting them at the top of the per-player list mirrors how leaderboards / RAG warnings prioritise the worst case for human attention."
  - "Spinner re-anchors turnStartedAt to spinner-resolution moment. Without this, the first player's lap would include the ~3s spinner duration. With it, the lap clock starts when the user actually sees who goes first — matching the player's mental model of 'turn starts when I know it's my turn'."
  - "Eliminated-player skip in nextTurn uses a safety counter (= players.length) to prevent infinite loop if all players are eliminated. Edge case: if every player is eliminated, activePlayerIndex stays where it was and the game should be ended — but the loop never spins forever."
  - "spinForFirstPlayer returns Promise<0> for empty/null/undefined input rather than throwing. startGame's defensive try/catch + numeric range check provide a second layer; the spinner being permissive at the boundary keeps the call site clean."
  - "_timerInterval kept as a defensive null in pauseTimer's clearInterval branch even though startTimer no longer assigns it. Future code paths (or a cherry-picked legacy patch) that accidentally re-introduce setInterval will get cleaned up rather than leaking. Costs zero perf — just an undefined check."

patterns-established:
  - "Wall-clock anchor with RAF display tick — Date.now() snapshot at start of measured period; subsequent reads compute (Date.now() - anchor); RAF used purely for display refresh smoothness, never for accumulation. Reusable for any duration tracking that must survive background-tab throttling (sync-status freshness, idle countdown, turn timer)."
  - "vi.spyOn(Date, 'now') for time-controlled tests. Avoids fake-timer / fake-indexeddb deadlock. Pattern: const clock = pinDateNow(t0); ... clock.set(t0 + 5000); ... game.nextTurn(); expect(...);"
  - "x-show='field && field.length > 0' graceful degradation for additive-schema fields. Legacy records without the field hide the new UI section cleanly without NaN/empty-state spam. Preferable to defaulting the field to an empty array on read since it lets the UI distinguish 'no data captured' from 'data captured, was empty'."
  - "Cross-plan data-field-arrives-later coordination — Plan A ships CSS body + binding hook with a placeholder evaluator; Plan B (later) ships the data field; binding activates automatically. Validated end-to-end across Plan 2 → Plan 3 with ZERO Plan 2 file edits required when Plan 3 landed."

requirements-completed: [GAME-07, GAME-08, GAME-09, GAME-10]

# Metrics
duration: 11m 49s
completed: 2026-04-17
---

# Phase 09 Plan 03: Vandalblast Turn Mechanics + Post-Game Stats Summary

**Vandalblast now plays like a pod-tracking companion that respects how the
turn actually unfolds — a slot-machine spinner picks the first player with a
satisfying ease-out-expo deceleration, the active player's card glows in
primary blue and rotates on NEXT TURN (skipping eliminated players), and
every turn's wall-clock duration gets captured into a `turn_laps` array
that surfaces post-game as LONGEST / AVG / PER-PLAYER pacing tiles. The
turn timer is now immune to background-tab throttling — a 30-minute
backgrounded turn records as 30 minutes (proved by a `vi.spyOn(Date, 'now')`
jump test), not the ~5 minutes Chrome's setInterval throttle would have
permitted. Plan 2's `.cf-player-active` border-glow + binding came online
with zero further player-card.js edits — the cross-plan CSS-class-shipping
pattern paid off exactly as designed.**

## Performance

- **Duration:** ~11m 49s (start 2026-04-17T09:35:06Z → end 2026-04-17T09:46:55Z)
- **Tasks:** 4 (with 3 TDD RED + 3 TDD GREEN commit pairs = 7 atomic commits)
- **Files modified:** 5 source/test (3 test files created/modified + 1 source created + 4 source modified) + 1 css
- **Tests added:** 20 net-new (4 spinner + 8 game-store Plan 3 + 8 post-game-overlay)
- **Total Plan 3 tests passing:** 38 across 3 test files (spinner 4 + game-store 26 + post-game-overlay 8)
- **Full suite:** 667 pass + 10 todo across 74 files (Plan 2 finished at 647 pass; Plan 3 added 20 net-new passing tests)
- **Cross-plan check:** 31 Plan 2 tests still pass (router + player-card + floating-toolbar)
- **Regression check:** 112 Plan 1 + pre-Phase-9 tests still pass (deck-editor / deck-analytics-fixtures / edhrec-service / gap-detection / deck-analytics-panel / deck-centre-panel / migration-v5-to-v7 / salt-score / deck-analytics)

## Accomplishments

- **GAME-07 slot-machine spinner shipped.** New `src/components/first-player-spinner.js`
  exports `spinForFirstPlayer(playerNames): Promise<number>`. Animation:
  2400ms total, ease-out-expo deceleration via RAF
  (`1 - Math.pow(2, -10 * t)` approximating cubic-bezier(0.16, 1, 0.3, 1)).
  600ms settle pause holds on the winner before overlay removal. JetBrains
  Mono 48px primary blue (`#0D52BD`) per CLAUDE.md typography.
  `prefers-reduced-motion: reduce` skips the animation entirely and reveals
  the result instantly via a 1.2s announce overlay. `aria-live="off"`
  during the cycle (per RESEARCH §P-7 to avoid screen-reader flooding from
  20+ cycled names), flipped to `aria-live="polite"` at settle so screen
  readers announce only the winner.
- **GAME-08 active player rotation.** `$store.game.activePlayerIndex` state
  field added; `nextTurn()` advances `(activePlayerIndex + 1) % players.length`
  with a safety counter that skips eliminated players (and prevents an
  infinite loop if all are eliminated). Plan 2's `:class` binding on
  `renderPlayerGrid()` (line 180) now resolves truthy and the
  `.cf-player-active` border-glow lights up — **ZERO edits to player-card.js
  required** (cross-plan coordination paid off exactly as Plan 2's SUMMARY
  predicted).
- **GAME-09 turn-lap persistence.** `nextTurn()` now pushes
  `(Date.now() - turnStartedAt)` onto `turn_laps` before re-anchoring.
  `saveGame()` pushes the final lap (for the turn that ended without
  pressing NEXT TURN) and includes `turn_laps` + `active_player_index` in
  the `db.games` row. `_debouncedAutoSave` snapshot extended with the three
  new fields (`activePlayerIndex`, `turn_laps`, `turnStartedAt`) so an
  interrupted game restores correctly. `init()` restore + `_resetState()`
  both updated.
- **GAME-09 post-game TURN PACING section.** `src/components/post-game-overlay.js`
  gets a new HTML section between Game Stats and Elimination Order. Three
  tiles per CONTEXT D-19 spec:
  - **LONGEST TURN** — 32px JetBrains Mono primary blue value + Space Grotesk
    11px subtitle showing the player who took it (ellipsis-truncated, full
    name in `:title`)
  - **AVG TURN** — overall mean of all laps
  - **PER-PLAYER AVG** — laps grouped by index modulo players.length, mean
    per player, sorted slowest-first
  Section gated on `x-show="$store.game.turn_laps && $store.game.turn_laps.length > 0"`
  so legacy v1.0 saved games (no `turn_laps` field) hide the section
  cleanly. New exported helpers: `formatLap(ms)` for mm:ss formatting and
  `computePacingStats(turnLaps, players)` returning the structured stats.
- **GAME-10 wall-clock anchor turn timer.** `startTimer()` rewritten:
  RAF tick reads `timerSeconds = Math.floor((Date.now() - turnStartedAt) / 1000)`;
  no more `setInterval` accumulation. Immune to background-tab throttling
  per Pitfall P-1. Proof test (`game-store.test.js > GAME-10 wall-clock anchor
  > lap accurate after 30min jump`) does a `vi.spyOn(Date, 'now')` jump
  of 30 minutes mid-turn and asserts `turn_laps[0] === 30 * 60 * 1000` —
  the lap is exactly 30 minutes regardless of how few RAF ticks fired
  during the "background period".
- **`tests/setup.js` cross-plan baseline extended.** Added
  `requestAnimationFrame` (falls through to `setTimeout(cb, 16)`),
  `cancelAnimationFrame` (clearTimeout), and `matchMedia` (returns
  `matches: false` stub). Existing MutationObserver + CustomEvent stubs
  preserved. Inline docblock documents per-test override patterns for
  deterministic RAF (synchronous frame fire) and reduced-motion bypass
  (`matches: true`).
- **`.cf-first-player-spinner` CSS body rule shipped.** 48px JetBrains Mono
  primary blue, `position: fixed; inset: 0; z-index: 100; pointer-events: none`,
  fade transition. Selector entry already in the merged
  `@media (prefers-reduced-motion: reduce)` block from Plan 2 — Plan 3
  did NOT touch the @media block per cross-plan coordination contract.
- **No edits to player-card.js, floating-toolbar.js, or the @media block.**
  All three were owned by Plan 2; Plan 3 honored the boundary exactly.
  The active-player highlight + spinner + reduced-motion handling all
  came online via the data field + CSS body Plan 3 shipped.

## Task Commits

Atomic commits per task, with TDD red/green pairs for code-bearing tasks:

1. **Task 1: tests/setup.js extension** — `b173a04` `chore(09-03)` —
   single-file edit appending RAF + cancelAnimationFrame + matchMedia
   stubs; existing 647 tests still pass.
2. **Task 2 RED: spinner failing tests** — `c1ab41d` `test(09-03)` —
   4 tests covering reduced-motion bypass, animation lifecycle, aria-live,
   edge cases.
3. **Task 2 GREEN: spinner component + CSS body** — `240fd8d` `feat(09-03)` —
   `src/components/first-player-spinner.js` created; `.cf-first-player-spinner`
   body rule appended to `src/styles/main.css`.
4. **Task 3 RED: game-store Plan 3 failing tests** — `bd9261d` `test(09-03)` —
   8 tests covering GAME-07 store-side / GAME-08 / GAME-09 / GAME-10 /
   reset state.
5. **Task 3 GREEN: game store turn mechanics + spinner integration** —
   `504d4dc` `feat(09-03)` — `src/stores/game.js` rewrite (startGame async,
   nextTurn lap push + advance, startTimer RAF, saveGame final-lap +
   turn_laps persist, init restore, _resetState clear); test harness
   updated to use `vi.spyOn(Date, 'now')` instead of fake timers (Dexie
   deadlock workaround).
6. **Task 4 RED: post-game-overlay failing tests** — `d2d6c55` `test(09-03)` —
   8 tests covering computePacingStats helper + renderPostGameOverlay HTML
   contract + _computePacing component method.
7. **Task 4 GREEN: TURN PACING section** — `810b50d` `feat(09-03)` —
   `formatLap` + `computePacingStats` exported helpers + TURN PACING HTML
   section + `pacing` computed property + `_computePacing` method on
   Alpine component.

**Plan metadata:** appended after this summary in the final commit.

## Files Created/Modified

### Source (4 modified, 1 created)

- `src/components/first-player-spinner.js` (CREATED) — `spinForFirstPlayer`
  standalone module. ~75 lines including detailed docblocks. No Alpine
  import (pure DOM + Promise + RAF). Reused-style accessibility per
  RESEARCH §P-7 (aria-live=off during animation, polite at settle).
- `src/stores/game.js` — GAME-07/08/09/10 implementation. New imports
  (`spinForFirstPlayer`); 3 new state fields (`activePlayerIndex`,
  `turn_laps`, `turnStartedAt`) + `_timerRafId`; `startGame` converted
  to async with spinner integration; `nextTurn` rewritten with lap push
  + active player advance + eliminated-skip; `startTimer/pauseTimer/
  resetTimer` rewritten for RAF + wall-clock anchor; `saveGame` extended
  with final-lap push + `turn_laps` + `active_player_index` persistence;
  `_debouncedAutoSave` snapshot extended; `init()` restore + `_resetState()`
  updated.
- `src/components/post-game-overlay.js` — TURN PACING section + helpers.
  `formatLap(ms)` for mm:ss formatting; `computePacingStats(turnLaps,
  players)` exported helper; HTML section inserted between Game Stats
  and Elimination Order; `pacing` Alpine computed property; `_computePacing`
  method called from `init()`.
- `src/styles/main.css` — Phase 9 Plan 3 marker block appended;
  `.cf-first-player-spinner` body rule (48px JetBrains Mono primary blue,
  fixed full-screen overlay).

### Tests (2 created, 1 modified)

- `tests/first-player-spinner.test.js` (CREATED) — 4 cases: reduced-motion
  bypass returns valid winnerIndex; overlay appended/removed during
  animation; aria-live attribute present; empty/null/undefined input
  handled gracefully.
- `tests/post-game-overlay.test.js` (CREATED) — 8 cases: computePacingStats
  longestTurn / longestPlayerName / avgTurn / perPlayerAvg correctness;
  empty laps return zero stats; renderPostGameOverlay HTML contains all
  4 section labels + bindings; brand primary blue used for value text;
  `_computePacing` populates mm:ss display strings on Alpine component.
- `tests/game-store.test.js` (MODIFIED) — added 8 Plan 3 tests in a new
  describe block using `vi.mock('alpinejs')` + real `initGameStore` +
  `vi.spyOn(Date, 'now')` for wall-clock control. Existing 18 tests
  unchanged. `afterEach` import added.

### Test infrastructure (1 modified)

- `tests/setup.js` — appended RAF + cancelAnimationFrame + matchMedia
  stubs after the existing MutationObserver + CustomEvent block. Inline
  docblock documents per-test override patterns.

## Decisions Made

See `key-decisions` in frontmatter (8 decisions logged). Highlights:

- **`vi.spyOn(Date, 'now')` instead of `vi.useFakeTimers()`.** Fake timers
  deadlock with fake-indexeddb's internal timer-based microtask ordering —
  Dexie ops never resolve and afterEach hangs. The Date.now spy keeps
  real timers + microtasks running normally while letting tests advance
  the wall clock arbitrarily. The 30-min jump proof test runs in <50ms
  with the spy approach (would have hung with fake timers).
- **Final-lap push in saveGame.** Without this, the game's final turn —
  often the longest, most dramatic one — would be excluded from pacing
  data. Saved games will now include the END-GAME lap as the last entry
  in `turn_laps`.
- **TURN PACING section x-show gate.** Legacy v1.0 saved games (no
  `turn_laps` field) hide the section entirely instead of rendering
  NaN/0:00 tiles. Discovered while writing the empty-laps test —
  `computePacingStats` handles emptiness gracefully (returns zero stats),
  but rendering all-zero tiles would be confusing. The x-show gate is the
  cleanest fix.
- **Spinner re-anchors turnStartedAt to spinner-resolution moment.**
  Without re-anchoring, the first player's lap would include the ~3s
  spinner duration. With it, the lap clock starts when the user actually
  sees who goes first — matching the mental model of "turn starts when I
  know it's my turn."
- **Cross-plan coordination validated end-to-end.** Plan 2's
  `.cf-player-active` CSS body + `:class` binding hook + Plan 3's
  `activePlayerIndex` data field came online with **ZERO further
  player-card.js edits** in Plan 3. The pattern (Plan A ships CSS + binding
  with placeholder evaluator; Plan B ships the data field) is now
  validated through to a real shipping flow and documented in
  `patterns-established` for reuse.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `vi.useFakeTimers()` deadlock with fake-indexeddb**

- **Found during:** Task 3 GREEN, first run of new game-store Plan 3 tests
- **Issue:** The plan specified `vi.useFakeTimers()` + `vi.setSystemTime()`
  for wall-clock control. In practice, fake timers deadlocked with
  fake-indexeddb's internal microtask ordering — `db.games.clear()` in
  `afterEach` never resolved, causing 4 of the 8 new tests to time out
  at 5-15 seconds each. Other 4 tests passed because they didn't hit Dexie.
- **Fix:** Replaced `vi.useFakeTimers()` + `vi.setSystemTime()` with
  `vi.spyOn(Date, 'now').mockImplementation()` controlled via a `pinDateNow(t0)`
  helper that returns `{set, advance}` methods. Real timers + Dexie
  microtasks keep running normally; the test only controls what `Date.now()`
  returns. All 8 new tests now pass; the 30-min jump proof test runs in
  <50ms (was hanging at 10s timeout).
- **Files modified:** `tests/game-store.test.js` (Plan 3 describe block)
- **Verification:** All 26 game-store tests pass (18 existing + 8 new);
  full suite 667 pass / 10 todo / no regressions.
- **Committed in:** `504d4dc` (Task 3 GREEN — same commit as the source
  changes, since the test rewrite is the only thing that exercises the
  source).

---

**Total deviations:** 1 auto-fixed (Rule 1 — test infrastructure bug:
fake-timer + fake-indexeddb interaction).

**Impact on plan:** Plan production diff matches PLAN spec exactly. The
deviation was confined to test scaffolding — no source-code behavior
changed; the wall-clock anchor + spinner + post-game-stats were
implemented exactly as the plan described. The `pinDateNow` helper is
arguably cleaner than fake timers for time-control scenarios that don't
also need timer advancement, and is documented as a reusable pattern in
`patterns-established`.

## Issues Encountered

- **Pre-existing console errors during router.test.js.** Same as Plan 2 —
  4 `TypeError: Cannot read properties of undefined (reading 'length')`
  errors from `$store.collection.precons.length` bindings while the
  vandalblast screen mounts in jsdom without booting Alpine. These existed
  BEFORE Plan 3 (acknowledged in Plan 2 SUMMARY) and are unrelated to
  Plan 3 work. The full suite still reports `Test Files 74 passed` /
  `Tests 667 passed` despite the `Errors 4` line. Out of scope for Plan 3.
- **No new issues encountered.** The cross-plan coordination from Plan 2
  worked exactly as designed; no surprises in the source code touched.

## Known Stubs

- **None new.** Plan 3 ships data + behavior; the only previously-shipped
  stub (Plan 2's `.cf-player-active` binding consuming an
  undefined-until-Plan-3 field) has now been resolved by Plan 3 shipping
  the data field.
- **Plan 2's `tests/fixtures/screenshots/game-04-icons.png.md`** placeholder
  is unaffected — still deferred to the Phase 9 HUMAN-UAT walk per
  CONTEXT D-00.

## User Setup Required

None — Plan 3 ships purely client-side code. No new external services or
configuration.

## Phase 9 HUMAN-UAT Walk Checklist

The /gsd:verify-work flow should walk a human user through these steps to
visually confirm Phase 9 end-to-end. (Per CONTEXT D-00 — single UAT
covering all 15 requirements.)

**Deck Builder (Plan 1):**
1. Open Thousand-Year Storm; pick any deck. Confirm Commander section
   renders ABOVE Creature section. Mana curve + colour distribution
   match the deck (sanity check).
2. Inspect a deck with known salty cards (Stasis, Smothering Tithe, etc.)
   — salt gauge shows non-zero score.
3. Inspect a deck with gaps (low ramp, low draw). Gap warnings show
   `[RED] +N` or `[AMBER] +N` badges; no category-name duplication.
4. Click back button on deck-editor — returns to deck list.

**Vandalblast layout/visuals (Plan 2):**
5. Start a 4-player game with a long opponent name like "Alexander the
   Great Lifelinker". Name truncates with ellipsis; full name on hover.
6. Start a 3-player game; layout is T-shape with player 1 on top spanning
   both columns.
7. Adjust life totals; values turn green > 20, amber ≤ 20, red ≤ 10
   with smooth colour transition.
8. Expand a player; confirm `vaccines` (poison), `paid` (tax), and
   `shield_with_heart` (commander damage) glyphs render — NOT tofu boxes.
9. Click fullscreen toggle; chrome (sidebar + header) hides; game state
   survives. Click again; chrome returns; state still intact.
10. Add a counter to a player; the in-card +/- buttons in the expanded
    view increment/decrement the counter without leaving the player card.

**Vandalblast turn mechanics + post-game stats (Plan 3 — THIS PLAN):**
11. Start a fresh game (4 players). Slot-machine spinner cycles names in
    JetBrains Mono primary blue, decelerates over ~2.4s, lands on a
    random player. The chosen player's card has the primary-blue
    border-glow.
12. Click NEXT TURN. Active player highlight advances to the next player
    (wrapping to player 0 after the last).
13. Eliminate a player (life → 0 or poison ≥ 10); click NEXT TURN
    repeatedly — the eliminated player is skipped in rotation.
14. Background the tab for 2 minutes during a turn. Return; click
    NEXT TURN. Confirm the recorded lap is ~2 minutes (proves wall-clock
    anchor; with the old setInterval it would have been < 30s).
15. End the game; click END GAME → save. Post-game overlay shows the
    TURN PACING section with three tiles: LONGEST TURN (with player name
    subtitle), AVG TURN, PER-PLAYER AVG (sorted slowest first).
16. Open browser settings; enable "Reduce motion" (or DevTools
    Rendering → Emulate CSS media feature prefers-reduced-motion).
    Start a new game. Spinner reveals the result instantly without
    cycling animation.
17. Open a saved v1.0 game from history (one without `turn_laps` field).
    TURN PACING section is hidden (no NaN tiles, no all-zero placeholders).

**Cross-plan integration sanity:**
18. Confirm `npm test` reports 667 pass / 10 todo with the 4 pre-existing
    router console errors (Plan 2 SUMMARY known issue, unrelated).

## Next Plan Readiness

- **Plan 3 is the FINAL plan in Phase 9** — completing all 15 requirements
  (DECK-01..05 + GAME-01..10). Phase 9 is now ready for `/gsd:verify-work`
  pending the HUMAN-UAT walk above.
- **Cross-plan handoff to Phase 11 (Cloud Sync Engine):** the new
  `turn_laps` + `active_player_index` fields on the `db.games` schema are
  additive JSON properties on existing rows — they will sync automatically
  via Phase 11's outbox once that lands. No additional migration needed.
- **Phase 11 sync-engine consumers** that read game records from the
  `games` table will receive `turn_laps: number[]` (possibly empty) and
  `active_player_index: number | null` on every record going forward.
  Legacy v1.0 records without these fields continue to work — `turn_laps`
  was backfilled to `[]` in the Phase 7 v6 migration; `active_player_index`
  is a new field that defaults to `undefined` for legacy rows.

## Carry-over Blockers

- **Production CORS proxy for EDHREC** (Plan 1 carry-over from STATE.md
  blockers) — not affected by Plan 3.
- **Pre-existing console-error noise in router.test.js** — Plan 2
  acknowledged; Plan 3 inherits unchanged. Out of v1.1 Phase 9 scope.

## Self-Check: PASSED

- All claimed source/test files exist:
  - `src/components/first-player-spinner.js` FOUND
  - `src/stores/game.js` MODIFIED (verified via grep markers)
  - `src/components/post-game-overlay.js` MODIFIED
  - `src/styles/main.css` MODIFIED
  - `tests/setup.js` MODIFIED
  - `tests/first-player-spinner.test.js` FOUND
  - `tests/game-store.test.js` MODIFIED (Plan 3 describe block added)
  - `tests/post-game-overlay.test.js` FOUND
- All 7 task commits exist in git log:
  b173a04, c1ab41d, 240fd8d, bd9261d, 504d4dc, d2d6c55, 810b50d
- All 4 GAME-07..10 requirements addressed via verifiable artifacts:
  - GAME-07 → `spinForFirstPlayer` exported + integrated in `startGame`
  - GAME-08 → `activePlayerIndex` state + `nextTurn` advance + Plan 2
    binding active
  - GAME-09 → `turn_laps` push in `nextTurn` + persistence in `saveGame`
    + TURN PACING section in post-game-overlay
  - GAME-10 → `startTimer` uses RAF + Date.now anchor; 30-min jump test
    proves wall-clock accuracy
- Test counts verified: 667 pass / 10 todo (Plan 2 was 647) — net +20
  matches expected (4 spinner + 8 game-store + 8 post-game-overlay)

---

*Phase: 09-deck-accuracy-vandalblast-pod-experience*
*Completed: 2026-04-17*
