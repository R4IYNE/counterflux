---
status: partial
phase: 09-deck-accuracy-vandalblast-pod-experience
source: [09-VERIFICATION.md]
started: 2026-04-17T11:15:00Z
updated: 2026-04-17T13:30:00Z
walked_by: user
walked_at: 2026-04-17T12:00:00Z
gap_closure_commits: [da8c6fa, 5c69511, 05ede7f, ddc0066, fdbc993, 50b9423, b72b159]
gap_closure_tests_added: 22
---

## Current Test

[walked by user 2026-04-17 — 5 of 7 failed; 7 underlying gaps closed via plans 09-04/05/06; awaiting re-walk]

## Tests

### 1. Slot-machine spinner perceived feel
expected: Player names cycle vertically in JetBrains Mono primary blue, decelerate over ~2.4s with ease-out-expo curve, settle on chosen player with a 600ms pause. With prefers-reduced-motion enabled, result reveals instantly.
result: FAIL — no spinner animation, just shows the result instantly (regardless of prefers-reduced-motion setting). Either RAF loop never runs, or animation is completing too fast to see, or container DOM never renders.

### 2. T-shape 3-player layout visual
expected: Player 1 spans top row (full width), players 2 and 3 split bottom row 50/50.
result: FAIL — top player ('giy') does NOT span full width; only spans about 2/3 of the available row, leaving empty space top-right. The `grid-template-areas: "p1 p1" "p2 p3"` rule isn't being respected. Likely cause: `.cf-player-grid-3` class not applied to the actual grid wrapper (applied to wrong element), OR the parent container is constraining width.

### 3. RAG life-colour transitions
expected: Life > 20 = green (#22C55E); life ≤ 20 = amber (#F59E0B); life ≤ 10 = red (#E23838); colour transition smooth (200ms ease-out).
result: PASS

### 4. Material Symbols glyph rendering + RAG counter colouring
expected: Expand a player card; vaccines (poison), paid (tax), shield_with_heart (commander damage) all render as glyphs.
result: PARTIAL FAIL — glyphs render but:
  - 4a: Change poison icon from `vaccines` (syringe) to `skull` — more on-brand for MTG poison/lethal
  - 4b: Add RAG colouring to poison counter — red as approaches 10 (lethal-poison threshold in commander)
  - 4c: Add RAG colouring to commander damage counter — red as approaches 21 (lethal commander damage)
  Mirror the existing life-RAG treatment: green when far from lethal, amber as it approaches, red when fatal-adjacent.

### 5. Fullscreen state preservation
expected: Adjust life totals + add counters mid-game; click fullscreen toggle; chrome (sidebar + header) hides; all game state survives.
result: PASS

### 6. Turn timer auto-start on NEXT TURN
expected: Recorded lap is ~2 minutes after backgrounding tab for 2 min mid-turn.
result: FAIL (different concern from wall-clock test) — turn timer should start automatically when NEXT TURN is clicked, but it doesn't auto-start. Currently the user must manually start the timer (or it's not running at all). Per GAME-09 expected behaviour, `turnStartedAt = Date.now()` should anchor on NEXT TURN AND the visible timer should tick automatically.

### 7. TURN PACING tile aesthetics + post-game flow
expected: Post-game overlay shows TURN PACING section: 32px JetBrains Mono primary blue values, 11px Space Grotesk uppercase labels, LONGEST TURN with player subtitle, AVG TURN, PER-PLAYER AVG sorted slowest first.
result: FAIL — TURN PACING section not pulling through at all on post-game screen. Either the `turn_laps && turn_laps.length > 0` guard fails (laps not actually being persisted, related to item 6), OR the section is rendered but invisible (CSS issue), OR the section is below scroll fold and not discovered.

## Summary

total: 7
passed: 2
issues: 5
pending: 0
skipped: 0
blocked: 0

## Gaps

5 of 7 items failed. Captured in `.planning/phases/09-deck-accuracy-vandalblast-pod-experience/follow-ups.md` for promotion to a Phase 9.1 polish phase (mirrors Phase 8 → 8.1 pattern).

| # | Item | Severity | Likely fix area |
|---|------|----------|-----------------|
| 1 | Spinner not animating | Medium | `src/components/first-player-spinner.js` — investigate RAF / prefers-reduced-motion / DOM mount |
| 2 | T-shape top-player not full-width | Medium | `src/components/player-card.js` `.cf-player-grid-3` class application + `src/styles/main.css` grid wrapper scoping |
| 4a | Poison icon: vaccines → skull | Trivial | `src/components/player-card.js:236` — 1-line glyph swap |
| 4b | Poison counter RAG colouring | Small | `src/components/player-card.js` poison expansion widget — add RAG `:style` (red as approaches 10) |
| 4c | Commander damage RAG colouring | Small | `src/components/player-card.js` commander damage expansion widget — add RAG `:style` (red as approaches 21) |
| 6 | Turn timer doesn't auto-start on NEXT TURN | Medium | `src/stores/game.js` startTimer() — must auto-fire on nextTurn() / startGame() |
| 7 | TURN PACING not rendering post-game | Medium | `src/components/post-game-overlay.js` — investigate guard condition; likely cascading from item 6 (no laps persisted because timer never started) |
