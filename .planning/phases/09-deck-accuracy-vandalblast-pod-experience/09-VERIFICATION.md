---
phase: 09-deck-accuracy-vandalblast-pod-experience
verified: 2026-04-17T11:00:00Z
reverified: 2026-04-17T14:15:00Z
status: human_needed
score: 4/4 success criteria automation-verified; 7 UAT gaps now code-verified; awaiting browser rewalk
re_verification:
  previous_status: gaps_found
  previous_source: .planning/phases/09-deck-accuracy-vandalblast-pod-experience/09-HUMAN-UAT.md
  previous_score: 2/7 UAT tests passed (5 failed, 0 pending)
  gaps_closed:
    - "Gap 1 — spinner animates visibly (startTime anchored inside first RAF callback, commit da8c6fa)"
    - "Gap 2 — T-shape 3-player grid (inline :style gridArea on each card, commit 5c69511)"
    - "Gap 3 (UAT §4a) — poison glyph skull replaces vaccines (commit 05ede7f)"
    - "Gap 4 (UAT §4b) — poison counter three-tier RAG at 0-3/4-7/8+ (commit ddc0066)"
    - "Gap 5 (UAT §4c) — commander damage three-tier RAG at 0-9/10-15/16+ (commit fdbc993)"
    - "Gap 6 (UAT §6) — timer auto-starts in startGame + nextTurn (commit 50b9423)"
    - "Gap 7 (UAT §7) — TURN PACING render path locked down as cascade fix from Gap 6 (commit b72b159)"
  gaps_remaining: []
  regressions: []
  test_suite: "688 passed / 10 todo / 0 failing (was 667 at initial verify — +21 new regression tests)"
human_verification:
  - test: "Slot-machine spinner perceived feel (Gap 1 re-walk)"
    expected: "Player names cycle vertically in JetBrains Mono primary blue for ~2.4s before settling. First RAF seeds startTime, subsequent frames run easing math. With prefers-reduced-motion enabled, result reveals instantly."
    why_human: "Code-verified: startTime anchored inside first RAF callback per commit da8c6fa. Visual cadence + smoothness only confirmable in real browser; 3 new regression tests with manual RAF driver cover the timing contract but not paint behaviour."
  - test: "T-shape 3-player layout visual (Gap 2 re-walk)"
    expected: "Player 1 spans full top-row width; players 2 and 3 split bottom row 50/50."
    why_human: "Code-verified: inline :style='{ gridArea: \"p\" + (pIdx + 1) }' on each card per commit 5c69511. DOM-structure tests boot real Alpine and confirm 3 ghost-border children + inline grid-area styles, but layout width at real viewports needs eyes-on."
  - test: "RAG life-colour transitions (already PASSED in initial UAT)"
    expected: "Life > 20 = green; life ≤ 20 = amber; life ≤ 10 = red; smooth 200ms ease-out transition."
    why_human: "Previously PASSED in UAT walk 2026-04-17. No regression expected."
  - test: "Material Symbols glyph rendering + counter RAG (Gap 3/4/5 re-walk)"
    expected: "Poison row = skull glyph; poison digit cycles green→amber→red at 4/8 boundaries. Commander damage digit cycles green→amber→red at 10/16 boundaries. Row-level lethal-highlight class still fires at poison=10 and commander damage=21."
    why_human: "Code-verified at player-card.js:237 (skull), :250 (poison RAG ternary), :339 (commander damage RAG ternary). 7 new tests lock the glyph + thresholds + row-level non-regression, but visible colour transitions + dual-channel feedback perception need browser eyes."
  - test: "Fullscreen state preservation (already PASSED in initial UAT)"
    expected: "Adjust life + counters mid-game; fullscreen toggle hides chrome; all state survives."
    why_human: "Previously PASSED in UAT walk 2026-04-17. No regression expected."
  - test: "Timer auto-start on NEXT TURN (Gap 6 re-walk) + wall-clock anchor"
    expected: "Start game → spinner resolves → timer immediately ticks 00:01, 00:02... without any manual play-button press. Click NEXT TURN → timer resets to 00:00 and resumes ticking automatically. Background tab for 2 min mid-turn; recorded lap is ~2 min."
    why_human: "Code-verified: this.startTimer() in startGame() line 205 (after spinner) and nextTurn() line 307 (after pauseTimer clears RAF). 3 regression tests confirm timerRunning=true post-startGame and post-nextTurn. Real Chrome background-tab throttling behaviour still needs browser verification."
  - test: "TURN PACING tile aesthetics + post-game flow (Gap 7 re-walk)"
    expected: "End 3-turn game; post-game overlay shows TURN PACING section with LONGEST TURN (mm:ss + player subtitle), AVG TURN, PER-PLAYER AVG sorted slowest first. All tiles use 32px JetBrains Mono primary blue values + 11px Space Grotesk uppercase labels."
    why_human: "Code-verified: Gap 7 diagnosed as cascade from Gap 6 (Plan 06 SUMMARY) — render path was already correct in Plan 3, just had empty turn_laps from frozen timer. 4 new end-to-end tests confirm computePacingStats contract + _computePacing wiring + x-show guard. Typography + layout quality judgement still needs browser eyes."
---

# Phase 9: Deck Accuracy + Vandalblast Pod Experience — Verification Report

**Phase Goal:** Thousand-Year Storm's analytics tell the truth, and Vandalblast feels like a real pod-play companion — not a prototype.
**Verified:** 2026-04-17T11:00:00Z (initial)
**Re-verified:** 2026-04-17T14:15:00Z (post gap-closure)
**Status:** human_needed (all 15 requirements automation-verified; 7 UAT gaps now code-verified; awaiting browser rewalk)

## Goal Achievement

### Success Criteria (from ROADMAP §Phase 9)

| # | Criterion | Status | Evidence |
| -- | -- | -- | -- |
| 1 | **Deck accuracy:** Commander as own type category; mana curve + colour distribution match hand-calculated values for 3 reference decks; salt gauge non-zero for salty decks; gap warnings show RAG severity badge with `+N` suggested count (no category-name duplication); back button returns to deck list | VERIFIED (automation) | `deck-centre-panel.js:247-287` Commander section above TYPE_ORDER + suppression filter at `:294-296`; `tests/deck-analytics-fixtures.test.js` 10 cases lock Krenko/Niv-Mizzet/Ur-Dragon math; `intelligence.js:79-123` salt aggregate via `fetchTopSaltMap`; `deck-analytics-panel.js:600-665` `[RED|AMBER] +N` badge format; `deck-editor.js:34-36` dispatches `deck-back-to-landing` CustomEvent |
| 2 | **First-player coin-flip + active-player highlight:** Coin-flip / spinner picks first player; active player has visible highlight that advances on NEXT TURN | VERIFIED (automation) | `first-player-spinner.js:14-101` (2400ms ease-out-expo, 600ms settle, prefers-reduced-motion bypass, startTime anchored inside first RAF per Gap 1 fix); `game.js:175-207` startGame integrates spinner + sets activePlayerIndex + auto-starts timer; `player-card.js:180` `:class` binding `cf-player-active` keyed off `activePlayerIndex === pIdx`; `game.js:272-309` nextTurn pushes lap + advances activePlayerIndex + re-starts timer; `main.css:279-283` `.cf-player-active` border-glow body |
| 3 | **Mid-game UX:** RAG life colours; counter expansion icons; in-card counter editing; fullscreen toggle without state loss; player names don't clip in 2-col; 3-player dynamic layout | VERIFIED (automation) | `player-card.js:219` inline `:style` RAG (>20 green / >10 amber / ≤10 red) with 200ms ease-out; `player-card.js:237` poison **skull** glyph (Gap 3/4a swap) + `:250` three-tier poison RAG + `:320` shield_with_heart + `:339` three-tier commander damage RAG (Gap 5/4c); `player-card.js:343-370` per Plan 2 SUMMARY in-card +/- buttons; `floating-toolbar.js:81` real `requestFullscreen()` / `exitFullscreen()` from synchronous @click; `player-card.js:175, 182` `cf-player-grid-3` class binding + inline `:style` gridArea per card (Gap 2 fix); `main.css:290-300` T-shape `grid-template-areas: "p1 p1" / "p2 p3"` + defensive `width: 100%; min-width: 0`; ellipsis name truncation per Plan 2 SUMMARY GAME-01 |
| 4 | **Post-game stats:** longest turn / average turn / per-player average from `turn_laps: number[]` persisted to game record; laps remain accurate even if tab was backgrounded mid-turn (wall-clock anchor) | VERIFIED (automation) | `game.js:272-277` nextTurn pushes `Date.now() - turnStartedAt` lap; `game.js:350` saveGame final-lap push for END-GAME turn; `game.js:363-367` persists `turn_laps` + `active_player_index` to db.games; `game.js:313-334` startTimer uses RAF + `Date.now() - turnStartedAt` (no setInterval accumulation); `game.js:205, 307` startTimer auto-called from startGame + nextTurn (Gap 6 fix); `post-game-overlay.js:159-221` TURN PACING section gated on `turn_laps && turn_laps.length > 0`; `tests/game-store.test.js` Plan 3 describe block + 30-min `vi.spyOn(Date, 'now')` jump test proves wall-clock accuracy; `tests/post-game-overlay.test.js` gap 7 describe block locks end-to-end render path |

**Score:** 4/4 success criteria automation-verified.

### Locked-Spec Invariants (from prompt)

| Invariant | Status | Evidence |
| -- | -- | -- |
| DECK-04 `fetchTopSaltMap` consumes `/pages/top/salt.json` (NOT broken `/pages/cards/`) | VERIFIED | `edhrec.js:151` `${EDHREC_BASE}/pages/top/salt.json`; legacy `getCardSalt` REMOVED per `:127`; comments `:104-114` document the structural fix |
| GAME-04 Material Symbols glyphs: `paid` / `shield_with_heart` (poison glyph updated to `skull` per HUMAN-UAT Gap 3/4a reversal) | VERIFIED | `player-card.js:237` `>skull<` (was `>vaccines<` at initial verify — reversed in commit 05ede7f per UAT §4a), `:265` `>paid<`, `:320` `>shield_with_heart<`. CONTEXT D-12's skull exclusion was explicitly overridden by user's HUMAN-UAT call. |
| GAME-08 `.cf-player-active` CSS body shipped + `:class` binding wired to `$store.game.activePlayerIndex === pIdx` | VERIFIED | `main.css:279-283` body rule (`border: 2px solid var(--color-primary, #0D52BD)`, `box-shadow: 0 0 12px var(--color-glow-blue)`, `transition: 200ms ease-out`); `player-card.js:180` `:class` binding |
| GAME-09 `nextTurn()` pushes `Date.now() - turnStartedAt` onto `turn_laps`; `saveGame()` persists | VERIFIED | `game.js:272-277` nextTurn lap push + re-anchor; `game.js:363-367` `turn_laps: [...this.turn_laps]` in saveGame snapshot |
| GAME-10 wall-clock anchor: NO setInterval accumulation; `Date.now()` snapshot pattern | VERIFIED | `game.js:313-334` startTimer uses `requestAnimationFrame` only — `tick()` reads `Math.floor((Date.now() - this.turnStartedAt) / 1000)`; ZERO `setInterval` calls in startTimer/pauseTimer/resetTimer; `_timerRafId` replaces `_timerInterval` |
| GAME-07 spinner respects `prefers-reduced-motion` | VERIFIED | `first-player-spinner.js:21-39` `window.matchMedia('(prefers-reduced-motion: reduce)').matches` triggers instant-result bypass with announce overlay; @media block in `main.css:158-168` includes `.cf-first-player-spinner` |
| 3-player layout uses `.cf-player-grid-3` class with `grid-template-areas: "p1 p1" "p2 p3"` | VERIFIED | `main.css:290-300` exact match (+ defensive `width: 100%; min-width: 0` added in Gap 2 fix); `player-card.js:175` class binding; `player-card.js:182` inline `:style` gridArea per card — `:nth-child` grid-area rules removed because Alpine `<template x-for>` counted as a sibling |
| Single merged `@media (prefers-reduced-motion)` block in main.css covering all 4+ selectors | VERIFIED | `main.css:158-168` single block with 6 selectors: `.tc-panel-column, .tc-grid-column, .cf-panel-reopen, .card-quick-actions-checkbox, .cf-player-active, .cf-first-player-spinner` |

### Out-of-Scope Guards (from prompt)

| Guard | Status | Evidence |
| -- | -- | -- |
| `src/data/precon-decks.js` does NOT exist (Tier C scope guard from Phase 8.1) | VERIFIED | `src/data/` directory does not exist |
| No Dexie schema bump (no `.version(10)` in `src/db/schema.js`) | VERIFIED | `schema.js` chain ends at `db.version(9)` — v9 was Phase 8.1's `precons_cache` table; no v10 added by Phase 9 or gap-closure plans. |
| No mobile-responsive Vandalblast media-query work | VERIFIED | `main.css` contains zero `@media (max-width:` or `@media (min-width:` rules — only the `prefers-reduced-motion` block + `:fullscreen` pseudo-class rules |

### Test Suite Health

```
Test Files: 75 passed, 2 skipped (77)
Tests:      688 passed, 10 todo (698)
Errors:     4 unhandled (pre-existing — see below)
Duration:   ~3.2s
```

**Match expected:** 688 passing, 0 failing — confirms orchestrator pre-check.

**Net new tests post-gap-closure:** +21 regression tests across 3 gap plans:
- Plan 09-04 (Gaps 1 + 2): 3 spinner + 5 DOM-structure = 8
- Plan 09-05 (Gaps 3/4/5): 1 skull rewrite + 3 poison RAG + 3 commander damage RAG = 7 net-new
- Plan 09-06 (Gaps 6 + 7): 3 game-store timer + 4 post-game-overlay = 7

**Pre-existing console errors (4):** `$store.collection.precons.length` undefined errors in `router.test.js` Alpine reactivity flushing. Documented in Plans 09-02 / 09-03 / 09-04 / 09-05 / 09-06 SUMMARYs as out-of-scope. Test outcomes unaffected (suite still reports 688/0/10).

---

## Gap Closure Verification (Re-verification, 2026-04-17T14:15:00Z)

The 2026-04-17 HUMAN-UAT walk found 5 of 7 items failed (tests 1, 2, 4 partial, 6, 7). Three gap-closure plans shipped:

| Plan | Scope | Commits | Net tests added |
| -- | -- | -- | -- |
| 09-04 | Gaps 1 (spinner) + 2 (T-shape grid) | `2a9d646`, `da8c6fa`, `f9f3e3f`, `5c69511`, docs `b2db0a7` | 8 (3 spinner regression + 5 DOM-structure) |
| 09-05 | Gaps 3/4a (skull) + 4b (poison RAG) + 4c (cmd damage RAG) | `b1d7c7d`, `05ede7f`, `6b06ec3`, `ddc0066`, `0582a38`, `fdbc993`, docs `8cc9b6b` | 7 (1 skull rewrite + 3 poison RAG + 3 cmd damage RAG) |
| 09-06 | Gaps 6 (timer auto-start) + 7 (TURN PACING render cascade) | `65fec0e`, `50b9423`, `b72b159`, docs `49f4f00` | 7 (3 timer auto-start + 4 TURN PACING end-to-end) |

### Per-Gap Code Verification

| # | UAT item | Acceptance criterion | Code evidence | Commit | Status |
| -- | -- | -- | -- | -- | -- |
| 1 | Spinner not animating | `startTime` captured INSIDE first RAF callback (not before schedule) so Alpine re-render delay doesn't saturate frame 1 | `first-player-spinner.js:64-74` — `let startTime = null;` declared pre-RAF; inside `frame(now)` the first invocation does `startTime = now; requestAnimationFrame(frame); return;`; subsequent frames run `elapsed = now - startTime` easing math. Overlay `.textContent` seeded with `playerNames[0]` at line 49 so overlay never paints empty. `Math.abs` defence on visibleIndex at line 83. | `da8c6fa` | CLOSED (code) |
| 2 | T-shape grid top player not full-width | Grid wrapper has 3 immediate children (or uses sibling-agnostic `grid-area`); top player spans full width | `player-card.js:175` `<div :class="$store.game.players.length === 3 ? 'cf-player-grid-3 pb-[80px]' : ...">` wraps `<template x-for>` which materialises 3 player cards. `player-card.js:182` `:style="$store.game.players.length === 3 ? { gridArea: 'p' + (pIdx + 1) } : {}"` on each card's outer div — sibling-position-agnostic (sidesteps Alpine `<template>` counting in `:nth-child`). `main.css:290-300` T-shape `grid-template-areas: "p1 p1" "p2 p3"` + defensive `width: 100%; min-width: 0`. Object `:style` syntax merges with static style attribute (doesn't replace). | `5c69511` | CLOSED (code) |
| 3 | Poison icon vaccines → skull | `player-card.js` poison row uses `skull` glyph | `player-card.js:237` `<span class="material-symbols-outlined" style="font-size: 16px; color: #7A8498;">skull</span>`. `grep -c vaccines src/components/player-card.js` returns 0 (full removal confirmed). Adjacent comment at `:233` documents the D-12 reversal. Material Symbols Outlined ships `skull` natively per 09-RESEARCH; no fallback needed. | `05ede7f` | CLOSED (code) |
| 4 | Poison counter RAG | Three-tier `:style` binding on poison count span: green 0-3, amber 4-7, red 8+ | `player-card.js:249-251` count span has `:style="'color: ' + ((player.poison || 0) >= 8 ? '#E23838' : (player.poison || 0) >= 4 ? '#F59E0B' : '#22C55E') + '; transition: color 200ms ease-out;'"`. Row-level lethal-highlight class at `:235` preserved (`>= 10 ? 'lethal-highlight' : ''`) for dual-channel affordance. | `ddc0066` | CLOSED (code) |
| 5 | Commander damage counter RAG | Three-tier `:style` binding on commander damage count span: green 0-9, amber 10-15, red 16+ | `player-card.js:338-340` `<span :style="'color: ' + ((player.commander_damage[sIdx] || 0) >= 16 ? '#E23838' : (player.commander_damage[sIdx] || 0) >= 10 ? '#F59E0B' : '#22C55E') + '; transition: color 200ms ease-out;'"`. Row-level lethal-highlight at `:327` preserved (`>= 21 ? 'lethal-highlight' : ''`). Per-attacker cardinality (matches data model keyed by `sIdx`). | `fdbc993` | CLOSED (code) |
| 6 | Timer auto-start on NEXT TURN | `game.js` has `this.startTimer()` in both `startGame()` (after spinner resolves) AND `nextTurn()` (after `pauseTimer()`) | `grep -n "this.startTimer" src/stores/game.js` returns 2 call sites + 1 method definition (line 313). `startGame()`: `this.startTimer()` at line 205 (after spinner integration + `_debouncedAutoSave`, before `return true`). `nextTurn()`: `this.pauseTimer(); // line 306` precedes `this.startTimer(); // line 307` — explanatory comment at lines 298-305 documents the pause-cancel-then-fresh-start sequence required to bypass the `if (this.timerRunning) return` guard. | `50b9423` | CLOSED (code) |
| 7 | TURN PACING not rendering post-game | Cascade from Gap 6 — render path in `post-game-overlay.js` was correct; Gap 6 fix unblocks it. End-to-end regression tests lock the contract. | `tests/post-game-overlay.test.js:147-230` new "gap 7" describe block with 4 tests: (a) `computePacingStats([60s, 90s, 45s], [You, Op1, Op2])` returns longestTurn=90000 / longestPlayerName='Op1' / avgTurn=65000 / perPlayerAvg slowest-first; (b) `_computePacing` populates display strings `1:30` / `1:05`; (c) `renderPostGameOverlay` HTML contains x-show guard + LONGEST TURN / AVG TURN / PER-PLAYER AVG labels + bindings to `pacing.longestTurnDisplay`; (d) regression: guard uses `length > 0` not `length >= 0`. All 4 tests PASS against shipped source, confirming render path was already correct — Gap 7 was indeed a cascade from Gap 6. | `b72b159` | CLOSED (code) |

### Spot-Check SUMMARY Outcomes vs Codebase

| SUMMARY claim | Grep check | Result |
| -- | -- | -- |
| 09-04: startTime anchored inside first RAF callback | `grep -n "startTime = null" src/components/first-player-spinner.js` | Line 64: `let startTime = null;` — declared pre-RAF, assigned on first callback invocation (line 68). MATCH. |
| 09-04: inline :style gridArea on each card | `grep -n "gridArea" src/components/player-card.js` | Line 182: `:style="$store.game.players.length === 3 ? { gridArea: 'p' + (pIdx + 1) } : {}"`. MATCH. |
| 09-04: defensive width rules in .cf-player-grid-3 | `grep -n "width: 100%\|min-width: 0" src/styles/main.css` (inside `.cf-player-grid-3` block) | Present in main.css. MATCH. |
| 09-05: vaccines glyph fully removed | `grep -c "vaccines" src/components/player-card.js` | 0. MATCH. |
| 09-05: skull glyph present | `grep -n "skull" src/components/player-card.js` | Line 233 (comment), line 237 (glyph). MATCH. |
| 09-05: poison RAG at 4/8 | `grep -n "player.poison.*>=.*8.*E23838" src/components/player-card.js` | Line 250. MATCH. |
| 09-05: commander damage RAG at 10/16 | `grep -n "commander_damage\[sIdx\].*>=.*16.*E23838" src/components/player-card.js` | Line 339. MATCH. |
| 09-06: this.startTimer has 3 sites (2 calls + def) | `grep -n "startTimer" src/stores/game.js` (code, not comments) | Lines 205, 307, 313. MATCH. |
| 09-06: pauseTimer precedes startTimer in nextTurn | Inspection of `nextTurn()` body | Line 306 `this.pauseTimer()` precedes line 307 `this.startTimer()`. MATCH. |
| 09-06: 688 pass / 10 todo | `npx vitest run` | `Test Files 75 passed (+2 skipped)` / `Tests 688 passed + 10 todo` / `0 failing`. MATCH. |

All 3 gap SUMMARY claims match the codebase state exactly. No drift.

---

## Required Artifacts (unchanged from initial — all still VERIFIED)

| Artifact | Expected | Status | Details |
| -- | -- | -- | -- |
| `src/services/edhrec.js` | `fetchTopSaltMap` exported, queries `/pages/top/salt.json`; `getCardSalt` removed | VERIFIED | `:138-172` |
| `src/stores/intelligence.js` | Wires `fetchTopSaltMap` + `aggregateDeckSalt` for non-zero salt; calls `detectGapsRAG` | VERIFIED | `:81-123` salt aggregate; `:207-227` updateGaps |
| `src/utils/gap-detection.js` | Exports `RAG_THRESHOLDS`, `getCreatureThresholds`, `detectGapsRAG` | VERIFIED | `:89, 104, 143` |
| `src/components/deck-analytics-panel.js` | `[RED|AMBER] +N` badge render (no category-name duplication; GREEN suppressed) | VERIFIED | `:600-665` badge block; `:616` `if (gap.severity === 'green') continue` |
| `src/components/deck-centre-panel.js` | Commander section ABOVE TYPE_ORDER with `data-type-group="Commander"` + primary-blue label + suppression filter | VERIFIED | `:247-287` render; `:294-296` filter |
| `src/components/deck-editor.js` | Back button dispatches `deck-back-to-landing` CustomEvent | VERIFIED | `:27-37` |
| `src/components/player-card.js` | Ellipsis name + `cf-player-grid-3` 3-player binding + inline gridArea per card + RAG life/poison/cmd-damage :style + skull/paid/shield_with_heart glyphs + `cf-player-active` binding | VERIFIED | `:175, 180, 182, 219, 237, 250, 265, 320, 339` |
| `src/components/floating-toolbar.js` | Real Fullscreen API wired synchronously from @click; x-data `isFullscreen` + fullscreenchange listener | VERIFIED | `:69-84, 121` |
| `src/components/first-player-spinner.js` | `spinForFirstPlayer(playerNames): Promise<number>` with prefers-reduced-motion bypass + aria-live + 2400ms ease-out-expo + startTime-inside-RAF | VERIFIED | `:14-101` |
| `src/components/post-game-overlay.js` | TURN PACING section gated on `turn_laps.length > 0`; LONGEST/AVG/PER-PLAYER tiles with brand typography | VERIFIED | `:28, 50, 159-221` |
| `src/stores/game.js` | `activePlayerIndex` field; `nextTurn` lap push + advance + eliminated-skip + pauseTimer→startTimer; `saveGame` final-lap + persist; RAF wall-clock timer; `startGame` auto-starts timer after spinner | VERIFIED | `:42-44, 68-75, 205, 272-309, 313-334, 350, 363-367` |
| `src/screens/vandalblast.js` | Defensive `Alpine?.data?.()` guard fixing pre-existing router-test failure | VERIFIED | `:21-22` |
| `src/styles/main.css` | `.cf-player-active`, `.cf-player-grid-3` (T-shape + defensive width), `.cf-first-player-spinner`, `:fullscreen` chrome-hide rules; merged @media block | VERIFIED | `:158-168` (@media), `:279-283` (active), `:290-300` (grid-3 + `width: 100%; min-width: 0`), `:306-308` (:fullscreen), `:332` (spinner) |

### Anti-Patterns Found

None new in the gap-closure diffs. Spot-checks:

| File | Pattern | Severity | Impact |
| -- | -- | -- | -- |
| `first-player-spinner.js` | `let startTime = null` + lazy-assign in first RAF | NOT-A-STUB | Intentional startup pattern (Plan 09-04 SUMMARY). Frame 1 seeds, frame 2+ runs easing. Prevents Alpine re-render delay from eating animation budget. |
| `player-card.js:182` | `:style` conditional returns `{}` when `players.length !== 3` | NOT-A-STUB | Object-syntax :style must return an object; `{}` is the valid no-op. Alpine merges with static `style` attribute, so base styles remain. |
| `game.js:306-307` | pauseTimer→startTimer pair in nextTurn | NOT-A-STUB | Required to re-anchor a guarded RAF loop (`if (timerRunning) return` early-exit). Plan 09-06 SUMMARY documents the sequence. |
| `post-game-overlay.js` | x-show guard `turn_laps && turn_laps.length > 0` | NOT-A-STUB | Graceful degradation for v1.0 saved games without `turn_laps` field. Regression test (gap 7 test 4) explicitly locks `length > 0` not `length >= 0`. |
| `tests/first-player-spinner.test.js` | Plan 09-03 test updated to drive 2 RAF frames | NOT-A-STUB | Required update to match the fixed two-frame startup (seed + saturate). Plan 09-04 SUMMARY auto-fix #1 documents. |

No `TODO|FIXME|XXX|HACK|PLACEHOLDER` matches in gap-closure diffs.

### Requirements Coverage

All 15 Phase 9 requirements remain SATISFIED. Gap-closure plans did NOT claim new requirement IDs — they re-validate GAME-02 / GAME-04 / GAME-07 / GAME-08 / GAME-09 / GAME-10 after UAT-surfaced production bugs were fixed.

**No orphaned requirements.**

### Behavioural Spot-Checks (post gap-closure)

| Behaviour | Command | Result | Status |
| -- | -- | -- | -- |
| Full test suite passes | `npx vitest run` | `Test Files 75 passed (+2 skipped) | Tests 688 passed + 10 todo | 0 failing` | PASS |
| Gap 1 — `startTime = null` pre-RAF in spinner | `grep -n "let startTime = null" src/components/first-player-spinner.js` | `:64: let startTime = null;` | PASS |
| Gap 2 — inline gridArea on each card | `grep -n "gridArea.*pIdx" src/components/player-card.js` | `:182: :style=\"$store.game.players.length === 3 ? { gridArea: 'p' + (pIdx + 1) } : {}\"` | PASS |
| Gap 3 — skull glyph present, vaccines removed | `grep -c skull src/components/player-card.js` + `grep -c vaccines` | skull=2 (comment + glyph), vaccines=0 | PASS |
| Gap 4 — poison three-tier RAG | `grep "player.poison.*>=.*8.*E23838.*>=.*4.*F59E0B.*22C55E" src/components/player-card.js` | Line 250 matches | PASS |
| Gap 5 — commander damage three-tier RAG | `grep "commander_damage\[sIdx\].*>=.*16.*E23838.*>=.*10.*F59E0B.*22C55E" src/components/player-card.js` | Line 339 matches | PASS |
| Gap 6 — this.startTimer in startGame + nextTurn | `grep -n "this.startTimer" src/stores/game.js` | Lines 205, 307 (+ def line 313) | PASS |
| Gap 6 — pauseTimer precedes startTimer in nextTurn | Inspection lines 306-307 | `pauseTimer()` at 306, `startTimer()` at 307 | PASS |
| Gap 7 — TURN PACING end-to-end test suite | `grep "gap 7.*TURN PACING" tests/post-game-overlay.test.js` | Line 147 describe block | PASS |
| All 15 commit hashes in log | `git log --oneline -20` | All 21 gap-closure commits present (4 tests + 7 fixes + 3 docs + originals) | PASS |

### Human Verification Required (re-walk needed for 5 of 7)

The 7 UAT items are re-listed in frontmatter `human_verification`. Summary:

| # | Gap | Code-verified | Browser re-walk needed |
| -- | -- | -- | -- |
| 1 | Spinner animation | YES (startTime-inside-RAF + 3 regression tests) | YES — visual cadence + paint behaviour |
| 2 | T-shape grid | YES (inline gridArea + 5 DOM-structure tests) | YES — layout width at real viewports |
| 3 (UAT §3) | RAG life colour | YES (already PASSED in initial UAT) | NO — no regression expected |
| 4 (UAT §4) | Glyphs + counter RAG | YES (skull + poison RAG + cmd damage RAG + 7 tests) | YES — glyph rendering + colour transitions |
| 5 (UAT §5) | Fullscreen | YES (already PASSED in initial UAT) | NO — no regression expected |
| 6 (UAT §6) | Timer auto-start | YES (startTimer calls + 3 regression tests) | YES — real ticking display + background throttling |
| 7 (UAT §7) | TURN PACING render | YES (cascade from Gap 6, 4 end-to-end tests) | YES — typography + layout quality |

### Gaps Summary

**All 7 UAT gaps are CLOSED at the code level.** Each has:
- A targeted source fix with an explanatory comment documenting the root cause (not "made X work" but "WHY X broke originally")
- Regression tests that specifically fail against the shipped buggy source and pass against the fix (Gaps 1, 2, 3, 4, 5, 6)
- End-to-end tests that lock down already-correct render paths to catch future regressions (Gap 7, as cascade)

**Status stays `human_needed`** because the original 7 UAT items are perceptual/browser-runtime qualities that automated tests can proxy but not fully replace. Per CONTEXT D-00 + Plan 09-06 SUMMARY, browser re-walk is the authoritative end-to-end verifier.

**Regressions:** None. The test suite grew from 667 → 688 passing (net +21 new regression tests); zero tests went red; the 4 pre-existing router.test.js console errors persist out-of-scope.

**Carry-over (not a Phase 9 gap):** Production CORS proxy for EDHREC remains unresolved per v1.0 STATE.md blockers. Affects DECK-04 in production deployment (works in dev via Vite proxy). Documented across all Phase 9 Plan SUMMARYs.

---

*Initial verified: 2026-04-17T11:00:00Z*
*Re-verified (post gap-closure): 2026-04-17T14:15:00Z*
*Verifier: Claude (gsd-verifier)*
