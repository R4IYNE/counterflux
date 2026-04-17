---
phase: 09-deck-accuracy-vandalblast-pod-experience
plan: 05
subsystem: vandalblast
tags: [vandalblast, player-card, material-symbols, rag-colours, poison, commander-damage, alpinejs, vitest, tdd, jsdom, gap-closure]

# Dependency graph
requires:
  - phase: 09-deck-accuracy-vandalblast-pod-experience-plan-02
    provides: "life-RAG :style ternary pattern + GAME-04 Material Symbols glyph mapping (vaccines/paid/shield_with_heart) — Plan 05 mirrors the :style pattern on poison + commander damage counters and reverses the vaccines → skull decision per HUMAN-UAT"
provides:
  - "skull Material Symbols glyph on poison counter row (replaces vaccines per HUMAN-UAT §4a reversal of CONTEXT D-12)"
  - "Three-tier RAG :style binding on poison count digit (0-3 green / 4-7 amber / 8+ red) — approaches-lethal-10 affordance at the digit level"
  - "Three-tier RAG :style binding on commander damage per-attacker count digit (0-9 green / 10-15 amber / 16+ red) — approaches-lethal-21 affordance per opponent"
  - "200ms colour transitions on both new bindings (mirrors life-RAG ease-out timing)"
  - "7 new test cases lock the glyph swap + both RAG patterns + lethal-highlight non-regression"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RAG :style ternary chain on count digits — thresholds are tiered at 2 boundaries below the lethal class trigger (e.g. poison red at 8, row-level lethal-highlight at 10; commander damage red at 16, row-level lethal-highlight at 21). Digit-level RAG narrates the approach; row-level class affordance signals the actual kill."
    - "jsdom attribute-serialization-neutral test assertions — regex anchors searching on content boundaries (shield glyph, x-text attribute value) rather than attribute order/quoting, since jsdom re-serializes innerHTML. Uses indexOf walks to reach the Nth occurrence of a repeated token."

key-files:
  created: []
  modified:
    - "src/components/player-card.js — Poison widget: vaccines → skull glyph + three-tier RAG :style on count span. Commander damage widget: static style=#EAECEE → dynamic :style three-tier RAG on count span. Both add 200ms color transition. Comment on poison row updated for D-12 reversal traceability."
    - "tests/player-card.test.js — Existing GAME-04 vaccines assertion rewritten for skull (+ vaccines regression guard). New describe 'gap 4b (poison RAG colouring)' with 3 cases. New describe 'gap 4c (commander damage RAG colouring)' with 3 cases."

key-decisions:
  - "D-12 reversal on the poison glyph is LOCKED: skull over vaccines. User's HUMAN-UAT call — 'skull feels more on-brand for MTG poison/lethal' — overrides the original D-12 'too dark/morbid' exclusion. Material Symbols Outlined variable font ships the skull glyph natively per 09-RESEARCH.md, so no fallback CSS is needed."
  - "RAG thresholds are tiered BELOW the row-level lethal class trigger to preserve dual-channel feedback. Poison: digit red at 8, class lethal at 10. Commander damage: digit red at 16, class lethal at 21. The digit narrates the approach; the class (bordered row glow) confirms the kill. Merging both into a single threshold would collapse two distinct affordances."
  - "Test assertions use jsdom-neutral anchoring (shield glyph / x-text attribute boundaries + indexOf walks to Nth occurrence) instead of :style= regex matching. jsdom re-serializes innerHTML, normalizing attribute quoting and order in ways that break naive :style=\"[^\"]+\" captures. Anchoring on content (glyph names, x-text values) is robust across jsdom versions."
  - "Commander damage RAG applies per-attacker, not max-across-attackers. The existing row-level lethal-highlight at >= 21 is already per-row (per-attacker), so the digit RAG inherits that cardinality — one fatal attacker lights that row red regardless of other attackers. This matches how commander damage is tracked in the data model (object keyed by attacker sIdx)."
  - "commander-damage-tracker.js module is a legacy artifact used only by renderPlayerCard (unused card renderer). All live rendering flows through renderPlayerGrid's inline commander-damage block (player-card.js:316-350). Plan 09-05 modifies ONLY the inline block to match the live-rendered path. The legacy module was not touched (out of scope; no consumers)."

patterns-established:
  - "Three-tier :style RAG on counter digits — template pattern for future counters (experience, energy, etc.) that have a lethal or boundary threshold in their own ruleset"

requirements-completed: []

# Metrics
duration: 4m 44s
completed: 2026-04-17
---

# Phase 09 Plan 05: Counter Widget Polish Summary

**The poison counter now wears a skull (not a syringe) and both the poison and commander damage counters pulse through green → amber → red as the digits approach lethal, mirroring the life-RAG pattern already shipped in Plan 09-02. Row-level lethal-highlight class affordances at poison=10 and commander_damage=21 stay intact, preserving the dual-channel "approaching vs fatal" narrative.**

## Performance

- **Duration:** ~4m 44s (start 2026-04-17T12:47:09Z → end 2026-04-17T12:51:53Z)
- **Tasks:** 3 tasks with TDD RED → GREEN pairs (6 atomic commits)
- **Files modified:** 1 source + 1 test = 2 files
- **Tests added:** 7 new cases (1 updated skull assertion + 3 poison RAG + 3 commander damage RAG)
- **Full suite result:** 676 pass + 10 todo across 76 files (net +6 net-new passing tests, 1 updated in place). The 4 pre-existing router.test.js "Errors" are documented carry-over from Plan 09-02 — unrelated, out-of-scope.

## Accomplishments

- **Gap 4a — poison glyph skull swap.** `src/components/player-card.js:236` `>vaccines<` → `>skull<`. Adjacent comment updated from `GAME-04: vaccines glyph` to `GAME-04 + gap 4a: skull glyph per HUMAN-UAT reversal` for traceability of the D-12 override.
- **Gap 4b — poison counter RAG.** Line 248-250 replaced two-tier binding (`>= 10 ? red : default`) with three-tier ternary chain: `>= 8 → #E23838` / `>= 4 → #F59E0B` / fallback `#22C55E`. Added `transition: color 200ms ease-out` for smooth threshold crossings (mirrors life-RAG timing).
- **Gap 4c — commander damage counter RAG.** Line 337-339 converted static `style="color: #EAECEE;"` to dynamic `:style` ternary: `>= 16 → #E23838` / `>= 10 → #F59E0B` / fallback `#22C55E`. 200ms transition added.
- **Non-regression preserved.** Row-level lethal-highlight at poison `>= 10` (line 234) and commander_damage `>= 21` (line 326) stay untouched — verified by explicit "remains intact" tests in each new describe block.
- **Dual-channel affordance maintained.** At poison=8, digit turns red (danger narrative). At poison=10, the row also glows via lethal-highlight class (kill confirmation). Same pattern for commander damage at 16 (digit) / 21 (row).

## Task Commits

Atomic commits per task, with TDD red/green pairs:

1. **Task 1 RED: skull glyph test swap** — `b1d7c7d` `test(09-05)` — existing vaccines assertion rewritten for skull + regression guard; RED confirmed (test fails against shipped vaccines).
2. **Task 1 GREEN: skull glyph swap** — `05ede7f` `feat(09-05)` — one-char glyph replacement + comment update; all 10 player-card tests green.
3. **Task 2 RED: poison RAG tests** — `6b06ec3` `test(09-05)` — 3 new tests (all colours, thresholds 4/8, lethal >= 10 preserved); 2 of 3 RED as expected (lethal-highlight passes because Plan 09-02 already shipped it).
4. **Task 2 GREEN: poison RAG binding** — `ddc0066` `feat(09-05)` — three-tier `:style` ternary on poison count span + test regex adjusted to be jsdom-attribute-serialization-neutral; 13 tests green.
5. **Task 3 RED: commander damage RAG tests** — `0582a38` `test(09-05)` — 3 new tests; 2 of 3 RED as expected.
6. **Task 3 GREEN: commander damage RAG binding** — `fdbc993` `feat(09-05)` — three-tier `:style` ternary on commander damage count span + test anchoring adjusted to reach the SECOND occurrence of `commander_damage[sIdx]` (the count-span x-text, past the lethal-highlight binding); 16 tests green.

**Plan metadata:** appended after this summary in the final commit.

## Files Created/Modified

### Source (1 modified)

- `src/components/player-card.js` — Three surgical changes inside `renderPlayerGrid()`:
  - Line 232 comment: `<!-- Poison counter (GAME-04 + gap 4a: skull glyph per HUMAN-UAT reversal) -->`
  - Line 236: `>vaccines<` → `>skull<`
  - Line 248-250: two-tier `:style="(player.poison || 0) >= 10 ? 'color: #E23838;' : 'color: #EAECEE;'"` → three-tier `:style="'color: ' + ((player.poison || 0) >= 8 ? '#E23838' : (player.poison || 0) >= 4 ? '#F59E0B' : '#22C55E') + '; transition: color 200ms ease-out;'"`
  - Line 337-339: static `style="color: #EAECEE;"` → three-tier `:style="'color: ' + ((player.commander_damage[sIdx] || 0) >= 16 ? '#E23838' : (player.commander_damage[sIdx] || 0) >= 10 ? '#F59E0B' : '#22C55E') + '; transition: color 200ms ease-out;'"`
  - No changes outside these line ranges — grid wrapper (lines 173-183) left untouched for Plan 09-04 ownership.

### Tests (1 modified)

- `tests/player-card.test.js` — Existing GAME-04 vaccines `it()` block rewritten to assert `skull` + not `vaccines` (gap 4a). Two new describe blocks appended:
  - `player-card gap 4b (poison RAG colouring)` — 3 tests: all three brand colours present in the poison count span area, threshold regex asserts `>=8` → `#E23838` + `>=4` → `#F59E0B`, row-level lethal-highlight at `>=10` still present.
  - `player-card gap 4c (commander damage RAG colouring)` — 3 tests: all three brand colours present near the commander damage count span, threshold regex asserts `>=16` → `#E23838` + `>=10` → `#F59E0B`, row-level lethal-highlight at `>=21` still present.

## Decisions Made

See `key-decisions` in frontmatter (5 decisions logged). Highlights:

- **D-12 reversed: skull over vaccines (locked).** The CONTEXT originally forbade skull as "too dark/morbid"; HUMAN-UAT reversed it. Material Symbols Outlined ships the skull glyph natively; no fallback CSS needed. Comment on the poison row records the reversal for audit trail.
- **RAG tier boundaries deliberately BELOW the lethal-highlight class threshold** (poison digit red at 8 / row lethal at 10; commander damage digit red at 16 / row lethal at 21). Two-channel feedback: the digit narrates the approach; the row class confirms the kill. Collapsing into one threshold would destroy one of the two affordances.
- **Test assertions use jsdom-neutral anchoring** (content-boundary `indexOf` walks to Nth occurrence) instead of `:style="[^"]+"` regex. jsdom re-serializes innerHTML, normalizing attribute order and quoting in ways that break naive attribute-scoped regex. The Nth-occurrence walk reaches the count-span binding past the row lethal-highlight binding on commander damage (both reference `commander_damage[sIdx]`).
- **Commander damage RAG is per-attacker, not max-across-attackers.** Inherited from the existing per-row lethal-highlight cardinality; matches the data model (object keyed by attacker `sIdx`). One fatal commander lights its row red regardless of other attackers.
- **`commander-damage-tracker.js` module left untouched.** Used only by the legacy `renderPlayerCard` (not in the live render path). All in-use rendering flows through `renderPlayerGrid`'s inline commander-damage block. Plan 09-05 only modifies the live-rendered inline block.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Test regex required two rewrites for jsdom attribute serialization**

- **Found during:** Task 2 GREEN verification (initial regex `:style="([^"]+)"` failed even though the binding was correct on disk)
- **Issue:** jsdom's `innerHTML` getter re-serializes attributes in a way that didn't match a regex requiring `player.poison` to appear BEFORE `:style=`. In the live rendered HTML, `player.poison` appears only INSIDE the `:style` value, not before the attribute.
- **Fix:** Swapped regex approach from attribute-capture to content-boundary anchoring. Use `html.indexOf('>skull<')` / `html.indexOf('>shield_with_heart<')` as anchors, walk to the count-span via `player.poison ?? 0` / second occurrence of `commander_damage[sIdx]`, slice a window, assert colours + thresholds appear.
- **Files modified:** `tests/player-card.test.js` (test definitions — PLAN-supplied regexes adapted before GREEN commit)
- **Verification:** All 7 new tests pass against the shipped bindings; 3 non-regression tests (lethal-highlight preserved) also pass.
- **Committed in:** `ddc0066` (Task 2 GREEN) and `fdbc993` (Task 3 GREEN) — test edits shipped in the same commit as the implementation since PLAN specified the TDD RED commit would use the exact PLAN regex, then GREEN would adjust where needed. This is within the plan's "TDD red→green pairs" contract.

---

**Total deviations:** 1 auto-fixed (Rule 3 — test regex adjusted for jsdom attribute serialization).
**Impact on plan:** Production diff matches PLAN spec exactly (glyph swap + 2 `:style` bindings). Test assertions use semantically equivalent anchoring that's more resilient to jsdom quirks than the PLAN-supplied `:style=` regex. No PLAN-level tasks skipped or re-shaped.

## Issues Encountered

- **None blocking.** The regex adaptation for Test 2/3 GREEN (documented above as Rule 3 deviation) was a 2-minute bounce, not a blocker.
- **Pre-existing router.test.js "Errors" (4 count)** continue from Plan 09-02 — documented there as out-of-scope. Surfaces in full-suite output but does not fail any test file. No Plan 09-05 action required.

## Known Stubs

None. All changes ship live bindings + tests. No placeholders, mock data, or deferred wiring introduced.

## User Setup Required

None. No external service, config, or env change required.

## Next Plan Readiness

- **Plan 09-04 (parallel executor on grid wrapper) is independent.** File ownership disjoint: 09-04 owns lines ~173-183 (grid wrapper), 09-05 owns lines ~232-259 + ~316-350 (counter widgets). Either plan landing first leaves the other's edit cleanly applicable.
- **Plan 09-06** (remaining gaps — items 1 spinner + 6/7 turn timer + TURN PACING post-game) is untouched by 09-05 — different files, different concerns.
- **Phase 9 HUMAN-UAT re-walk** on the counter widgets: verify at poison 2/4/7/8 the digit colour steps green → amber → red with visible 200ms transition; verify at commander damage 5/10/15/16 same behaviour. Both the existing row-level lethal glow at poison=10 and commander_damage=21 still pop as secondary confirmation.

## Carry-over Blockers

- **Production CORS proxy for EDHREC** — long-standing v1.0 carry-over; not touched by Plan 09-05.
- **Pre-existing router.test.js error noise** — Plan 09-02 carry-over; out of scope.

## Self-Check: PASSED

- Source file modified at the correct line ranges:
  - `src/components/player-card.js:236` — `>skull<` FOUND (grep count 1)
  - `src/components/player-card.js` — `>vaccines<` REMOVED (grep count 0)
  - `src/components/player-card.js` — poison RAG binding at line 248-250 FOUND (grep `player.poison.*>=.*8.*#E23838` count 1, `player.poison.*>=.*4.*#F59E0B` count 1)
  - `src/components/player-card.js` — commander damage RAG binding at line 337-339 FOUND (grep `commander_damage\[sIdx\].*>=.*16.*#E23838` count 1, `commander_damage\[sIdx\].*>=.*10.*#F59E0B` count 1)
  - Row-level lethal-highlight preserved (grep `player.poison.*>=.*10.*lethal-highlight` count 1, `commander_damage\[sIdx\].*>=.*21.*lethal-highlight` count 1)
- All 6 task commits verified in git log:
  - `b1d7c7d` test(09-05) skull RED — FOUND
  - `05ede7f` feat(09-05) skull GREEN — FOUND
  - `6b06ec3` test(09-05) poison RAG RED — FOUND
  - `ddc0066` feat(09-05) poison RAG GREEN — FOUND
  - `0582a38` test(09-05) commander damage RAG RED — FOUND
  - `fdbc993` feat(09-05) commander damage RAG GREEN — FOUND
- Full test suite: `npm test` → 676 pass / 10 todo / 0 fail (exceeds PLAN's 672+ target; net +6 from Plan 09-05 = 1 skull-swap rewrite in place + 3 poison RAG + 3 commander damage RAG + 0 source-of-reg failures).
- Plan verification commands (per PLAN `<verification>` block):
  - `npx vitest run tests/player-card.test.js -x` — 16 passed / 0 failed
  - `grep -c "vaccines" src/components/player-card.js` — 0 (old glyph fully removed)

---

*Phase: 09-deck-accuracy-vandalblast-pod-experience*
*Completed: 2026-04-17*
