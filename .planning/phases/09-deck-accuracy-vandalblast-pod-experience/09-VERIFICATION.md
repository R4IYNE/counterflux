---
phase: 09-deck-accuracy-vandalblast-pod-experience
verified: 2026-04-17T11:00:00Z
status: human_needed
score: 4/4 success criteria automation-verified; 7 items routed to HUMAN-UAT
re_verification: false
human_verification:
  - test: "Slot-machine spinner perceived feel"
    expected: "Player names cycle vertically in JetBrains Mono primary blue, decelerate over ~2.4s with ease-out-expo curve, settle on chosen player with a 600ms pause. With prefers-reduced-motion enabled, result reveals instantly."
    why_human: "Animation timing/easing/legibility is a perceptual judgement; only 4 unit tests + RAF stub coverage automated. Real RAF cadence + visual smoothness only verifiable in browser."
  - test: "T-shape 3-player layout visual"
    expected: "Start a 3-player game; player 1 spans top row (full width), players 2 and 3 split bottom row 50/50."
    why_human: "Layout correctness only confirmable by visual inspection of grid-template-areas rendering at real viewport widths."
  - test: "RAG life-colour transitions"
    expected: "Life > 20 = green (#22C55E); life ≤ 20 = amber (#F59E0B); life ≤ 10 = red (#E23838); colour transition smooth (200ms ease-out)."
    why_human: "Inline :style binding wires correctly per code inspection, but smooth colour transition perception (no flicker / hard cut) needs eyes-on confirmation."
  - test: "Material Symbols glyph rendering"
    expected: "Expand a player card; vaccines (poison), paid (tax), shield_with_heart (commander damage) all render as glyphs — NOT tofu boxes (□)."
    why_human: "Glyph names locked in source; whether the variable font ships these specific Outlined glyphs is a runtime browser concern. Plan 2 SUMMARY documents fallback options (science / payments / military_tech) if any render as tofu."
  - test: "Fullscreen state preservation"
    expected: "Adjust life totals + add counters mid-game; click fullscreen toggle; chrome (sidebar + header) hides; all game state survives. Click again; chrome returns; state still intact."
    why_human: "Real Fullscreen API behaviour (vs jsdom mocks) only testable in a real browser. Plan 2 SUMMARY notes WebKit prefix handled for Safari ≤16.4."
  - test: "Wall-clock anchor mid-game (background tab)"
    expected: "Background the tab for 2 minutes during a turn. Return; click NEXT TURN. Recorded lap is ~2 minutes (proves Date.now() anchor works under real Chrome setInterval throttling)."
    why_human: "30-min vi.spyOn(Date,'now') jump test proves the math, but real Chrome background-tab throttling behaviour is the actual user-facing concern."
  - test: "TURN PACING tile aesthetics + post-game flow"
    expected: "End game; post-game overlay shows TURN PACING section: 32px JetBrains Mono primary blue values, 11px Space Grotesk uppercase labels, LONGEST TURN with player subtitle (ellipsis if >12 chars), AVG TURN, PER-PLAYER AVG sorted slowest first."
    why_human: "Visual hierarchy + typography rendering is a design quality judgement only confirmable by eye."
---

# Phase 9: Deck Accuracy + Vandalblast Pod Experience — Verification Report

**Phase Goal:** Thousand-Year Storm's analytics tell the truth, and Vandalblast feels like a real pod-play companion — not a prototype.
**Verified:** 2026-04-17T11:00:00Z
**Status:** human_needed (all automated checks PASS; 7 items deferred to HUMAN-UAT)
**Re-verification:** No — initial verification

## Goal Achievement

### Success Criteria (from ROADMAP §Phase 9)

| # | Criterion | Status | Evidence |
| -- | -- | -- | -- |
| 1 | **Deck accuracy:** Commander as own type category; mana curve + colour distribution match hand-calculated values for 3 reference decks; salt gauge non-zero for salty decks; gap warnings show RAG severity badge with `+N` suggested count (no category-name duplication); back button returns to deck list | VERIFIED (automation) | `deck-centre-panel.js:247-287` Commander section above TYPE_ORDER + suppression filter at `:294-296`; `tests/deck-analytics-fixtures.test.js` 10 cases lock Krenko/Niv-Mizzet/Ur-Dragon math; `intelligence.js:79-123` salt aggregate via `fetchTopSaltMap`; `deck-analytics-panel.js:600-665` `[RED|AMBER] +N` badge format; `deck-editor.js:34-36` dispatches `deck-back-to-landing` CustomEvent |
| 2 | **First-player coin-flip + active-player highlight:** Coin-flip / spinner picks first player; active player has visible highlight that advances on NEXT TURN | VERIFIED (automation) | `first-player-spinner.js:14-77` (2400ms ease-out-expo, 600ms settle, prefers-reduced-motion bypass); `game.js:175-194` startGame integrates spinner + sets activePlayerIndex; `player-card.js:180` `:class` binding `cf-player-active` keyed off `activePlayerIndex === pIdx`; `game.js:264-287` nextTurn pushes lap + advances activePlayerIndex with eliminated-skip safety counter; `main.css:279-283` `.cf-player-active` border-glow body |
| 3 | **Mid-game UX:** RAG life colours; counter expansion icons; in-card counter editing; fullscreen toggle without state loss; player names don't clip in 2-col; 3-player dynamic layout | VERIFIED (automation) | `player-card.js:219` inline `:style` RAG (>20 green / >10 amber / ≤10 red) with 200ms ease-out; `player-card.js:236, 264, 319` Material Symbols glyphs `vaccines` / `paid` / `shield_with_heart` at 16px; `player-card.js:343-370` per Plan 2 SUMMARY in-card +/- buttons (existing); `floating-toolbar.js:81` real `requestFullscreen()` / `exitFullscreen()` from synchronous @click; `player-card.js:175` `cf-player-grid-3` binding when `players.length === 3`; `main.css:290-300` T-shape `grid-template-areas: "p1 p1" / "p2 p3"` + nth-child grid-area assignments; ellipsis name truncation per Plan 2 SUMMARY GAME-01 |
| 4 | **Post-game stats:** longest turn / average turn / per-player average from `turn_laps: number[]` persisted to game record; laps remain accurate even if tab was backgrounded mid-turn (wall-clock anchor) | VERIFIED (automation) | `game.js:264-271` nextTurn pushes `Date.now() - turnStartedAt` lap; `game.js:340-343` saveGame final-lap push for END-GAME turn; `game.js:354-357` persists `turn_laps` + `active_player_index` to db.games; `game.js:299-309` startTimer uses RAF + `Date.now() - turnStartedAt` (no setInterval accumulation); `post-game-overlay.js:159-221` TURN PACING section gated on `turn_laps && turn_laps.length > 0`; `tests/game-store.test.js` Plan 3 describe block + 30-min `vi.spyOn(Date, 'now')` jump test proves wall-clock accuracy |

**Score:** 4/4 success criteria automation-verified.

### Locked-Spec Invariants (from prompt)

| Invariant | Status | Evidence |
| -- | -- | -- |
| DECK-04 `fetchTopSaltMap` consumes `/pages/top/salt.json` (NOT broken `/pages/cards/`) | VERIFIED | `edhrec.js:151` `${EDHREC_BASE}/pages/top/salt.json`; legacy `getCardSalt` REMOVED per `:127`; comments `:104-114` document the structural fix |
| GAME-04 Material Symbols glyphs are exactly `vaccines` / `paid` / `shield_with_heart` | VERIFIED | `player-card.js:236` `>vaccines<`, `:264` `>paid<`, `:319` `>shield_with_heart<` |
| GAME-08 `.cf-player-active` CSS body shipped + `:class` binding wired to `$store.game.activePlayerIndex === pIdx` | VERIFIED | `main.css:279-283` body rule (`border: 2px solid var(--color-primary, #0D52BD)`, `box-shadow: 0 0 12px var(--color-glow-blue)`, `transition: 200ms ease-out`); `player-card.js:180` `:class` binding |
| GAME-09 `nextTurn()` pushes `Date.now() - turnStartedAt` onto `turn_laps`; `saveGame()` persists | VERIFIED | `game.js:264-271` nextTurn lap push + re-anchor; `game.js:354-355` `turn_laps: [...this.turn_laps]` in saveGame snapshot |
| GAME-10 wall-clock anchor: NO setInterval accumulation; `Date.now()` snapshot pattern | VERIFIED | `game.js:302-309` startTimer uses `requestAnimationFrame` only — `tick()` reads `Math.floor((Date.now() - this.turnStartedAt) / 1000)`; ZERO `setInterval` calls in startTimer/pauseTimer/resetTimer; `_timerRafId` replaces `_timerInterval` |
| GAME-07 spinner respects `prefers-reduced-motion` | VERIFIED | `first-player-spinner.js:21-39` `window.matchMedia('(prefers-reduced-motion: reduce)').matches` triggers instant-result bypass with announce overlay; @media block in `main.css:158-168` includes `.cf-first-player-spinner` |
| 3-player layout uses `.cf-player-grid-3` class with `grid-template-areas: "p1 p1" "p2 p3"` | VERIFIED | `main.css:290-300` exact match; `player-card.js:175` ternary binding |
| Single merged `@media (prefers-reduced-motion)` block in main.css covering all 4+ selectors | VERIFIED | `main.css:158-168` single block with 6 selectors: `.tc-panel-column, .tc-grid-column, .cf-panel-reopen, .card-quick-actions-checkbox, .cf-player-active, .cf-first-player-spinner` (Plan 2 extended Phase 8.1's block from 4 → 6 — NOT a duplicate block) |

### Out-of-Scope Guards (from prompt)

| Guard | Status | Evidence |
| -- | -- | -- |
| `src/data/precon-decks.js` does NOT exist (Tier C scope guard from Phase 8.1) | VERIFIED | `src/data/` directory does not exist |
| No Dexie schema bump (no `.version(10)` in `src/db/schema.js`) | VERIFIED | `schema.js` chain ends at `db.version(9)` (`:392-412`) — v9 was Phase 8.1's `precons_cache` table; no v10 added by Phase 9. Salt cache uses meta table per RESEARCH (CONTEXT D-05). |
| No mobile-responsive Vandalblast media-query work | VERIFIED | `main.css` contains zero `@media (max-width:` or `@media (min-width:` rules — only the `prefers-reduced-motion` block + `:fullscreen` pseudo-class rules |

### Test Suite Health

```
Test Files: 74 passed, 2 skipped (76)
Tests:      667 passed, 10 todo (677)
Errors:     4 unhandled (pre-existing — see below)
Duration:   ~3.2s
```

**Match expected:** 667 passing, 0 failing — confirms orchestrator pre-check.

**Pre-existing console errors (4):** `$store.collection.precons.length` undefined errors in `router.test.js` Alpine reactivity flushing. Documented in Plan 2 + Plan 3 SUMMARYs as out-of-scope. Test outcomes unaffected (suite still reports 667/0/10).

### Carry-Over Failure Resolution

| Pre-existing failure | Status | Evidence |
| -- | -- | -- |
| `tests/router.test.js > vandalblast` (Phase 5/6 carry-over per `08/deferred-items.md`) | FIXED | Targeted run: `npx vitest run tests/router.test.js` → `Test Files 1 passed (1) | Tests 17 passed (17)`. Fix: defensive `Alpine?.data?.()` guard at `src/screens/vandalblast.js:21` per Plan 2 SUMMARY. |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -- | -- | -- | -- |
| `src/services/edhrec.js` | `fetchTopSaltMap` exported, queries `/pages/top/salt.json`; `getCardSalt` removed | VERIFIED | `:138-172` |
| `src/stores/intelligence.js` | Wires `fetchTopSaltMap` + `aggregateDeckSalt` for non-zero salt; calls `detectGapsRAG` | VERIFIED | `:81-123` salt aggregate; `:207-227` updateGaps |
| `src/utils/gap-detection.js` | Exports `RAG_THRESHOLDS`, `getCreatureThresholds`, `detectGapsRAG` | VERIFIED | `:89, 104, 143` |
| `src/components/deck-analytics-panel.js` | `[RED|AMBER] +N` badge render (no category-name duplication; GREEN suppressed) | VERIFIED | `:600-665` badge block; `:616` `if (gap.severity === 'green') continue` |
| `src/components/deck-centre-panel.js` | Commander section ABOVE TYPE_ORDER with `data-type-group="Commander"` + primary-blue label + suppression filter | VERIFIED | `:247-287` render; `:294-296` filter |
| `src/components/deck-editor.js` | Back button dispatches `deck-back-to-landing` CustomEvent | VERIFIED | `:27-37` |
| `src/components/player-card.js` | Ellipsis name + `cf-player-grid-3` 3-player binding + RAG life :style + Material Symbols glyphs + `cf-player-active` binding | VERIFIED | `:175, 180, 219, 236, 264, 319` |
| `src/components/floating-toolbar.js` | Real Fullscreen API wired synchronously from @click; x-data `isFullscreen` + fullscreenchange listener | VERIFIED | `:69-84, 121` |
| `src/components/first-player-spinner.js` | `spinForFirstPlayer(playerNames): Promise<number>` with prefers-reduced-motion bypass + aria-live + 2400ms ease-out-expo | VERIFIED | `:14-77` |
| `src/components/post-game-overlay.js` | TURN PACING section gated on `turn_laps.length > 0`; LONGEST/AVG/PER-PLAYER tiles with brand typography | VERIFIED | `:28, 50, 159-221` |
| `src/stores/game.js` | `activePlayerIndex` field; `nextTurn` lap push + advance + eliminated-skip; `saveGame` final-lap + persist; RAF wall-clock timer | VERIFIED | `:42-44, 68-75, 264-287, 299-309, 328, 340-343, 354-357, 405-407, 432-434` |
| `src/screens/vandalblast.js` | Defensive `Alpine?.data?.()` guard fixing pre-existing router-test failure | VERIFIED | `:21-22` |
| `src/styles/main.css` | `.cf-player-active`, `.cf-player-grid-3` (T-shape), `.cf-first-player-spinner`, `:fullscreen` chrome-hide rules; merged @media block | VERIFIED | `:158-168` (@media), `:279-283` (active), `:290-300` (grid-3), `:306-308` (:fullscreen), `:332` (spinner) |

### Key Link Verification

| From | To | Via | Status | Detail |
| -- | -- | -- | -- | -- |
| `intelligence.js` | `edhrec.js fetchTopSaltMap` | named import + await call | WIRED | `intelligence.js:6-7` import; `:90` await invocation |
| `intelligence.js` | `gap-detection.js detectGapsRAG` | named import + invocation | WIRED | `intelligence.js:13` import; `:227` call |
| `deck.js` | `intelligence.updateGaps(... activeDeck.tags)` | passes archetype tags for creature thresholds | WIRED | `deck.js:120` |
| `deck-analytics-panel.js` | RAG badge from `intel.gaps` | reads `gap.severity` + `gap.suggestedAdd` | WIRED | `deck-analytics-panel.js:620-624` |
| `deck-centre-panel.js` | `activeDeck.commander_id` | `resolveCommanderEntry` helper with fallback | WIRED | `deck-centre-panel.js:27-58, 252` |
| `player-card.js` | `$store.game.activePlayerIndex` | `:class` binding | WIRED | `player-card.js:180` |
| `game.js startGame` | `first-player-spinner spinForFirstPlayer` | await + assign winnerIndex to activePlayerIndex | WIRED | `game.js:175-194` |
| `game.js nextTurn` | `db.games turn_laps` field (Phase 7 v6) | push lap + saveGame snapshot | WIRED | `game.js:264-271, 354-357` |
| `floating-toolbar.js` | document.documentElement.requestFullscreen | synchronous @click | WIRED | `floating-toolbar.js:81` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -- | -- | -- | -- | -- |
| `salt-gauge.js` | `intel.saltScore` | `fetchTopSaltMap` → `aggregateDeckSalt` (DECK-04 fix) | YES — Stasis 3.06 / Smothering Tithe 2.84 / Cyclonic Rift 2.71 from Top-100 bulk endpoint | FLOWING |
| `deck-analytics-panel.js` | `intel.gaps[].severity + suggestedAdd` | `detectGapsRAG(analytics, RAG_THRESHOLDS, deckTags, deckSize)` | YES — three-tier severity computed from EDHREC-derived thresholds + per-deck custom thresholds normalised | FLOWING |
| `deck-centre-panel.js` | Commander entry | `resolveCommanderEntry(store)` reading `activeDeck.commander_id` (Phase 7 v8 row field) | YES — primary path uses commander_id; fallback derives from first Legendary Creature/Planeswalker matching colour-identity | FLOWING |
| `player-card.js` life colour | `player.life` | game store; user-adjusted via life-adjuster | YES — reactive | FLOWING |
| `player-card.js` active highlight | `$store.game.activePlayerIndex` | game store; advanced by `nextTurn()` | YES — Plan 3 ships the field; Plan 2's binding now resolves to a real number | FLOWING |
| `post-game-overlay.js` TURN PACING | `$store.game.turn_laps` | pushed in `nextTurn()` + `saveGame()`; persisted to `db.games` | YES — wall-clock-derived; gated on `length > 0` so legacy v1.0 records hide cleanly (graceful degradation, NOT a stub) | FLOWING |

### Behavioural Spot-Checks

| Behaviour | Command | Result | Status |
| -- | -- | -- | -- |
| Full test suite passes | `npx vitest run` | `Test Files 74 passed | Tests 667 passed | 10 todo` | PASS |
| Pre-existing router > vandalblast failure repaired | `npx vitest run tests/router.test.js` | `Test Files 1 passed (1) | Tests 17 passed (17)` | PASS |
| `src/data/precon-decks.js` does not exist | `ls src/data/` | "src/data DOES NOT EXIST" | PASS |
| No `.version(10)` in schema | `grep version( src/db/schema.js` | Latest is v9 (Phase 8.1 precons_cache); no v10 added | PASS |
| No mobile media queries in main.css | `grep '@media.*max-width\|min-width' src/styles/main.css` | No matches | PASS |
| `fetchTopSaltMap` queries correct endpoint | `grep '/pages/top/salt\|/pages/cards/' src/services/edhrec.js` | `:151` consumes `/pages/top/salt.json`; legacy `/pages/cards/` only mentioned in comments documenting the historical broken path | PASS |
| Material Symbols glyph names locked | `grep 'vaccines\|paid\|shield_with_heart' player-card.js` | All three present at `:236, :264, :319` | PASS |
| RAG life colour binding wired | `grep '22C55E.*F59E0B.*E23838' player-card.js` | `:219` inline ternary `> 20 → #22C55E` / `> 10 → #F59E0B` / `else → #E23838` | PASS |
| `setInterval` not used in turn timer | `grep 'setInterval' src/stores/game.js` | Only defensive `clearInterval` kept in pauseTimer per Plan 3 D-29; startTimer is RAF-only | PASS |
| `:fullscreen` chrome-hide rules present | `grep ':fullscreen' src/styles/main.css` | `:306-308` `:fullscreen aside, :fullscreen header { display: none !important }` | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| -- | -- | -- | -- | -- |
| DECK-01 | 09-01 | Back button returns to deck list | SATISFIED | `deck-editor.js:34-36` |
| DECK-02 | 09-01 | Mana curve + colour distribution match hand-calc for 3 reference decks | SATISFIED | `tests/deck-analytics-fixtures.test.js` 10 cases pass against Krenko/Niv/Ur-Dragon fixtures |
| DECK-03 | 09-01 | Gap warnings show RAG severity + `+N`, no category duplication | SATISFIED | `gap-detection.js:89-180` + `deck-analytics-panel.js:600-665` |
| DECK-04 | 09-01 | Salt gauge non-zero for salty decks | SATISFIED | `edhrec.js fetchTopSaltMap` + `intelligence.js:79-123` aggregate path |
| DECK-05 | 09-01 | Commander rendered as own type category | SATISFIED | `deck-centre-panel.js:247-287` with `data-type-group="Commander"`, primary blue label |
| GAME-01 | 09-02 | Player names don't clip in 2-col | SATISFIED (automation) | `player-card.js renderPlayerGrid` ellipsis + `padding-bottom: 16px` per Plan 2 SUMMARY; `:title` preserves full name |
| GAME-02 | 09-02 | 3-player dynamic layout (T-shape) | SATISFIED (automation) | `player-card.js:175` binding + `main.css:290-300` T-shape grid |
| GAME-03 | 09-02 | RAG life colours green > 20 / amber ≤ 20 / red ≤ 10 | SATISFIED (automation) | `player-card.js:219` inline `:style` ternary |
| GAME-04 | 09-02 | Counter expansion icons (vaccines / paid / shield_with_heart) | SATISFIED (automation) | `player-card.js:236, 264, 319` |
| GAME-05 | 09-02 | Fullscreen toggle without state loss | SATISFIED (automation) | `floating-toolbar.js:81` real Fullscreen API + `main.css:306-308` chrome hide; DOM tree unchanged so Alpine state survives |
| GAME-06 | 09-02 | In-card counter editing | SATISFIED | `player-card.js:343-370` per Plan 2 SUMMARY (existing wiring locked by tests) |
| GAME-07 | 09-03 | First-player coin-flip / spinner animation | SATISFIED (automation) | `first-player-spinner.js spinForFirstPlayer` integrated in `game.js:175-194` |
| GAME-08 | 09-03 | Active-player highlight advances on NEXT TURN | SATISFIED (automation) | `game.js:264-287` nextTurn advance + `player-card.js:180` binding + `main.css:279-283` border-glow |
| GAME-09 | 09-03 | Post-game stats: longest / average / per-player from `turn_laps` | SATISFIED (automation) | `game.js:354-357` persist + `post-game-overlay.js:159-221` TURN PACING section |
| GAME-10 | 09-03 | Wall-clock anchor turn timer | SATISFIED (automation) | `game.js:299-309` RAF + `Date.now() - turnStartedAt`; 30-min vi.spyOn jump test in `tests/game-store.test.js` |

**Coverage:** 15/15 requirements satisfied via automation. Visual / motion / browser-runtime aspects routed to HUMAN-UAT (see frontmatter).

**Orphaned requirements:** None — REQUIREMENTS.md Phase 9 IDs (DECK-01..05 + GAME-01..10) all claimed by Plans 1/2/3 frontmatter.

### Anti-Patterns Found

None found in Phase 9 source. Spot-checks across the modified files:

| File | Pattern | Severity | Impact |
| -- | -- | -- | -- |
| `game.js` | `_timerInterval = null` retained as defensive null in pauseTimer's clearInterval branch | INFO | Plan 3 SUMMARY documents this (D-29) — defence-in-depth against future code paths re-introducing setInterval. Zero perf cost. |
| `post-game-overlay.js` | TURN PACING section gated on `turn_laps && turn_laps.length > 0` | NOT-A-STUB | Documented in Plan 3 SUMMARY as graceful degradation for legacy v1.0 saved games (no `turn_laps` field). Section hides cleanly instead of rendering NaN/0:00 tiles. |
| `player-card.js` | `cf-player-active` binding to `$store.game.activePlayerIndex` (was placeholder in Plan 2) | NOT-A-STUB | Plan 3 shipped the data field; binding now resolves to real number. Cross-plan coordination pattern paid off. |

No `TODO|FIXME|XXX|HACK|PLACEHOLDER` matches in Phase 9 source touched files.

### Human Verification Required

See frontmatter `human_verification` for the 7 items. Categories:

1. **Animation timing/easing perception** — slot-machine spinner (~2.4s ease-out-expo + 600ms settle)
2. **Layout visual** — T-shape 3-player grid at real viewport widths
3. **Colour transition smoothness** — RAG life-colour 200ms ease-out
4. **Glyph rendering** — Material Symbols vaccines / paid / shield_with_heart (vs tofu)
5. **Real Fullscreen API** — chrome hide + state preservation under real browser
6. **Background-tab throttling** — 2-min background then NEXT TURN, lap should be ~2 min
7. **TURN PACING tile aesthetics** — typography/hierarchy quality judgement

Per CONTEXT D-00 + Plan 3 SUMMARY "Phase 9 HUMAN-UAT Walk Checklist", a single UAT covering all 15 requirements is the agreed delivery model. The user is engaged and walked Phase 8 + Phase 8.1 already.

### Gaps Summary

**No automated gaps.** All 4 ROADMAP success criteria, all 15 requirement IDs, all 8 locked-spec invariants, and all 3 out-of-scope guards verified against actual codebase state. Test suite reports 667/0/10 with the documented pre-existing router console-error noise (4 unhandled errors in router.test.js Alpine reactivity flushing — Plan 2 acknowledged, out of scope).

The 7 HUMAN-UAT items are not gaps — they are perceptual/runtime qualities (animation feel, glyph rendering, real-browser fullscreen, background throttling) that automation cannot meaningfully cover. The CONTEXT D-00 phase shape explicitly anticipated this single UAT walk at the end.

**Carry-over noted (not a Phase 9 gap):** Production CORS proxy for EDHREC remains unresolved per Plan 1 + Plan 2 + Plan 3 SUMMARYs and STATE.md "Blockers/Concerns". Affects DECK-04 in production deployment (works in dev via Vite proxy at `vite.config.js:8-12`). v1.0 carry-over, surfaces here for v1.1 milestone tracking.

---

*Verified: 2026-04-17T11:00:00Z*
*Verifier: Claude (gsd-verifier)*
