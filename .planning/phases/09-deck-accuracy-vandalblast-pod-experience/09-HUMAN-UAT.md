---
status: partial
phase: 09-deck-accuracy-vandalblast-pod-experience
source: [09-VERIFICATION.md]
started: 2026-04-17T11:15:00Z
updated: 2026-04-17T11:15:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Slot-machine spinner perceived feel
expected: Player names cycle vertically in JetBrains Mono primary blue, decelerate over ~2.4s with ease-out-expo curve, settle on chosen player with a 600ms pause. With prefers-reduced-motion enabled, result reveals instantly.
steps: Start a 3-player Vandalblast game from `npm run dev`. Watch the first-player spinner intro. Then enable prefers-reduced-motion (Chrome DevTools → Rendering → "prefers-reduced-motion: reduce") and start another game.
result: [pending]

### 2. T-shape 3-player layout visual
expected: Player 1 spans top row (full width), players 2 and 3 split bottom row 50/50.
steps: Start a 3-player Vandalblast game. Inspect the player-card grid arrangement.
result: [pending]

### 3. RAG life-colour transitions
expected: Life > 20 = green (#22C55E); life ≤ 20 = amber (#F59E0B); life ≤ 10 = red (#E23838); colour transition smooth (200ms ease-out, no flicker / hard cut).
steps: Mid-game, click life decrement until life crosses 20 (amber) and 10 (red). Watch the colour change.
result: [pending]

### 4. Material Symbols glyph rendering
expected: Expand a player card; vaccines (poison), paid (tax), shield_with_heart (commander damage) all render as glyphs — NOT tofu boxes (□).
steps: Mid-game, click to expand a player card. Inspect the poison/tax/commander-damage expansion widgets.
result: [pending]

### 5. Fullscreen state preservation
expected: Adjust life totals + add counters mid-game; click fullscreen toggle; chrome (sidebar + header) hides; all game state survives. Click again; chrome returns; state still intact.
steps: Adjust some life totals + add counters mid-game. Click fullscreen on the floating toolbar. Confirm state. Exit fullscreen. Confirm state again.
result: [pending]

### 6. Wall-clock anchor mid-game (background tab)
expected: Recorded lap is ~2 minutes (proves Date.now() anchor works under real Chrome setInterval throttling).
steps: Start a turn. Background the tab for 2 minutes. Return to tab. Click NEXT TURN. Inspect `turn_laps[lastIndex]` via console (`Alpine.store('game').turn_laps`).
result: [pending]

### 7. TURN PACING tile aesthetics + post-game flow
expected: Post-game overlay shows TURN PACING section: 32px JetBrains Mono primary blue values, 11px Space Grotesk uppercase labels, LONGEST TURN with player subtitle (ellipsis if >12 chars), AVG TURN, PER-PLAYER AVG sorted slowest first.
steps: Play a short game with 3+ turns of varied duration. End the game. Inspect the post-game overlay's TURN PACING section.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
