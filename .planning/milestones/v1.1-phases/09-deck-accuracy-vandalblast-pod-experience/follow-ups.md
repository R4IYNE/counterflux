# Phase 9 — Follow-up Polish + Bugfix Items

User-reported items from the Phase 9 human-UAT walkthrough on 2026-04-17. **5 of 7 UAT items failed** — Phase 9 implementation is feature-complete at code level but visible regressions / unfinished wiring need addressing before Phase 10.

Suggested next step: `/gsd:insert-phase 9.1` (mirrors Phase 8 → 8.1 polish-phase pattern).

## Items

### 1. First-player spinner doesn't animate
**Reported:** 2026-04-17
**Symptom:** No spinner animation on game start — winner is revealed instantly. User does NOT have prefers-reduced-motion enabled.
**Investigation needed:**
- Is `requestAnimationFrame` loop actually running in browser? (Tests use a stub that fires once instantly — production behaviour may differ.)
- Is `matchMedia('(prefers-reduced-motion: reduce)')` being misdetected as `matches: true`?
- Does the spinner DOM container ever mount? (Plan 3 created `src/components/first-player-spinner.js` but the component must be mounted via `Alpine.data()` and rendered into the screen.)
- Is the animation completing in a few ms (timing curve broken — `cubic-bezier(0.16, 1, 0.3, 1)` over 2400ms should be visible).
**Likely fix area:** `src/components/first-player-spinner.js` + integration in `src/screens/vandalblast.js` or `src/components/game-setup.js`.
**Risk:** Medium — requires browser debugging; may need to add console.log instrumentation in dev to trace.

### 2. T-shape 3-player layout — top player doesn't span full width
**Reported:** 2026-04-17 with screenshot
**Symptom:** In a 3-player game, the top player card ('giy' in screenshot) only spans about 2/3 of the row width, leaving empty space top-right. Players 2 and 3 ('You' + 'y') correctly split the bottom row 50/50. The CSS `grid-template-areas: "p1 p1" "p2 p3"` rule isn't being respected at the rendered output.
**Investigation needed:**
- Is `.cf-player-grid-3` class actually applied to the grid wrapper element? (Could be applied to a child instead.)
- Does the parent container have `display: flex` or fixed width that constrains the grid?
- Is `grid-area: p1` being applied to the first player-card's outer element, or a wrapping div?
- Inspect Chrome DevTools to see computed grid layout vs expected.
**Likely fix area:** `src/components/player-card.js` (grid class application + grid-area assignments) + `src/styles/main.css` `.cf-player-grid-3` rule scoping.
**Risk:** Medium — pure CSS / DOM-structure fix.

### 3. Poison icon — change `vaccines` → `skull`
**Reported:** 2026-04-17
**Symptom:** Current poison icon (`vaccines` Material Symbol — looks like a syringe) is technically functional but feels off-brand. User wants `skull` (or `skull_outline`) — more on-brand for MTG poison/lethal.
**Likely fix:** 1-line glyph swap in `src/components/player-card.js:236` — change `>vaccines<` → `>skull<`. Update test expectation in `tests/player-card.test.js` accordingly.
**Risk:** Trivial.

### 4. Poison counter RAG colouring
**Reported:** 2026-04-17
**Symptom:** Poison counter shows the count but doesn't visually warn as user approaches lethal (10 in commander = lethal poison).
**Required behaviour:** Mirror the existing life-RAG treatment:
- 0-3 poison → green (or default — far from lethal)
- 4-7 poison → amber (warning)
- 8+ poison → red (fatal-adjacent)
**Likely fix area:** Poison expansion widget in `src/components/player-card.js` — add a `:style` binding driven by `player.poison` value. Match the colour tokens used for life RAG (`#22C55E`, `#F59E0B`, `#E23838`).
**Risk:** Small — 5-10 line change with a test.

### 5. Commander damage counter RAG colouring
**Reported:** 2026-04-17
**Symptom:** Commander damage counter shows the count but doesn't visually warn as user approaches lethal (21 from a single commander = lethal).
**Required behaviour:** Mirror the existing life-RAG + poison-RAG treatment:
- 0-9 → green (or default)
- 10-15 → amber (warning)
- 16+ → red (fatal-adjacent — within striking distance of 21)
**Likely fix area:** Commander damage expansion widget in `src/components/player-card.js` — add a `:style` binding driven by max commander damage value. Per-attacker tracking already exists in the data model.
**Risk:** Small — 5-10 line change with a test.

### 6. Turn timer doesn't auto-start on NEXT TURN
**Reported:** 2026-04-17
**Symptom:** Turn timer should start ticking automatically when NEXT TURN is clicked (and when game starts). User reports it does NOT auto-start.
**Investigation needed:**
- Is `startTimer()` being called inside `nextTurn()` and `startGame()`?
- Is the RAF display tick ever firing?
- Is the visible timer DOM element rendering and bound to a reactive store property?
**Likely fix area:** `src/stores/game.js` — verify `startTimer()` invocation in `nextTurn()` (line ~264-290) and `startGame()` (line ~175-200). Per Plan 09-03 GAME-09 + GAME-10 spec, the timer should anchor on NEXT TURN with `turnStartedAt = Date.now()` AND start a RAF loop that ticks the visible display.
**Risk:** Medium — likely a 1-2 line fix once the missing call site is identified, BUT the symptom suggests `turn_laps` may not be accumulating either (item 7 is downstream of this).

### 7. TURN PACING section not rendering on post-game screen
**Reported:** 2026-04-17
**Symptom:** Post-game overlay does NOT show the TURN PACING section at all — section is missing entirely (not just empty / blank).
**Investigation needed:**
- Is `turn_laps` array empty on game end? (Likely — cascades from item 6: if the timer never started, no laps are pushed.)
- Is the section template's guard condition `turn_laps && turn_laps.length > 0` evaluating false?
- Is there a separate render-time check that's hiding the section?
**Likely fix area:** Cascading from item 6. Once `startTimer()` is wired correctly + `nextTurn()` pushes laps reliably, this should resolve. Verify `post-game-overlay.js:159-221` guard + computed properties are correct.
**Risk:** Medium — DEPENDS ON item 6. Cannot be fixed in isolation.

## Suggested scope for Phase 9.1

All 7 items, in 2-3 plans:

| Plan | Items | Est | Notes |
|------|-------|-----|-------|
| 9.1-01 | Item 1 (spinner debug + fix) + Item 2 (T-shape grid wrapper) | ~2 hr | Visual / layout debugging |
| 9.1-02 | Items 4-5 (RAG colouring) + Item 3 (icon swap) | ~1 hr | Counter widget polish — touches same file |
| 9.1-03 | Item 6 (timer auto-start) + Item 7 (TURN PACING render) | ~2 hr | Timer + post-game wiring (item 7 cascades from item 6) |

Total: ~5 hours, similar shape to Phase 8.1.

## Recommendation

**Insert Phase 9.1 via `/gsd:insert-phase 9` then `/gsd:plan-phase 9.1`** rather than `/gsd:plan-phase 09 --gaps` — the phase-9.1 path keeps Phase 9 closed and produces a clean polish-phase artifact (mirrors Phase 8 → 8.1).
