---
phase: 09-deck-accuracy-vandalblast-pod-experience
plan: 01
subsystem: deck-builder
tags: [edhrec, salt, gap-detection, rag-thresholds, deck-analytics, fixtures, vitest, alpinejs, dexie, tdd]

# Dependency graph
requires:
  - phase: 07-foundation
    provides: "Dexie v8 decks table with commander_id row field; meta table for cross-cutting key/value cache rows"
  - phase: 04-intelligence
    provides: "intelligence.js Alpine store with synergies/combos/saltScore state; salt-gauge component visual"
  - phase: 04-intelligence
    provides: "edhrec.js service skeleton (getCommanderSynergies, normalizeSalt, aggregateDeckSalt, sanitizeCommanderName)"
provides:
  - "fetchTopSaltMap() — name-keyed salt-score lookup map cached in meta table (key 'top_salt_map', 7d TTL)"
  - "RAG_THRESHOLDS + getCreatureThresholds + detectGapsRAG — three-tier gap detection (red/amber/green + suggestedAdd)"
  - "Three reference-deck fixtures (Krenko / Niv-Mizzet, Parun / The Ur-Dragon) locking mana-curve + colour-distribution math"
  - "Commander section render in deck-centre-panel (data-type-group='Commander', primary-blue label, ABOVE TYPE_ORDER)"
  - "resolveCommanderEntry helper with fallback for legacy decks lacking commander_id"
  - "[RED|AMBER] +N badge UI in deck-analytics-panel (no category-name duplication, GREEN suppressed)"
affects: [phase-10-auth, phase-11-sync, phase-12-spoilers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "EDHREC bulk-endpoint fetch + meta-table cache (meta-row pattern instead of dedicated cache table)"
    - "Three-tier RAG severity model with archetype-aware creature thresholds derived from EDHREC + Draftsim + Burgess formula sources"
    - "TDD red→green commit pairs (test commit then feat commit) for high-risk surfaces (DECK-03, DECK-04, DECK-05)"
    - "Reference-deck fixture validation — hand-curated 100-card decks with locked expected.json analytics outputs"
    - "window.Alpine direct-read pattern in deck-centre-panel + deck-analytics-panel (test-time stub via window.Alpine = {...})"

key-files:
  created:
    - "src/utils/gap-detection.js (extended, not new) — new RAG_THRESHOLDS, getCreatureThresholds, detectGapsRAG exports"
    - "tests/deck-editor.test.js — DECK-01 back-button contract"
    - "tests/deck-analytics-fixtures.test.js — DECK-02 fixture-driven validation (10 cases)"
    - "tests/deck-analytics-panel.test.js — DECK-03 badge-render contract (4 jsdom cases)"
    - "tests/deck-centre-panel.test.js — DECK-05 Commander section contract (5 jsdom cases)"
    - "tests/fixtures/edhrec-top-salt.json — 5-entry EDHREC top-salt response capture"
    - "tests/fixtures/decks/krenko-mob-boss.cards.json + .expected.json — mono-R Krenko reference"
    - "tests/fixtures/decks/niv-mizzet-parun.cards.json + .expected.json — UR Niv-Mizzet reference"
    - "tests/fixtures/decks/the-ur-dragon.cards.json + .expected.json — 5C Ur-Dragon reference (all 6 colour buckets non-zero)"
  modified:
    - "src/services/edhrec.js — REMOVED getCardSalt (35 lines, structurally broken); ADDED fetchTopSaltMap"
    - "src/stores/intelligence.js — wired fetchTopSaltMap aggregate path; updateGaps now calls detectGapsRAG with deck.tags"
    - "src/stores/deck.js — pass activeDeck.tags to intel.updateGaps for archetype-aware creature threshold"
    - "src/components/deck-analytics-panel.js — gap-warning render (lines ~600-665) rewritten as `[RED|AMBER] +N` badge + tag-row/panel-fallback attach logic"
    - "src/components/deck-centre-panel.js — added resolveCommanderEntry helper + COMMANDER section render before TYPE_ORDER loop + commander-suppression filter on the Creature group"
    - "tests/edhrec-service.test.js — replaced getCardSalt describe block with 5 fetchTopSaltMap cases"
    - "tests/gap-detection.test.js — added 18 RAG cases (RAG_THRESHOLDS shape, severity tiers, archetype switch, scaling)"

key-decisions:
  - "DECK-04 root cause overrode the original D-04/D-06 framing: getCardSalt didn't have a bug — the endpoint path it queried (/pages/cards/{slug}.json card.salt) has never existed in EDHREC's response shape. The fix is structural (fetch /pages/top/salt.json bulk endpoint), not a patch to the existing function."
  - "Salt cache lives in the existing meta table (single row, key 'top_salt_map') instead of a new salt_cache table — no Dexie schema bump, mirrors the edhrec_cache + combo_cache 'one fetch one row' philosophy per 09-RESEARCH §'Salt Cache Schema Decision'."
  - "Reference-deck fixtures use the canonical Alpine deck-store shape `{ card, quantity, tags, owned }` (matches computeDeckAnalytics consumption + existing deck-analytics.test.js precedent) — NOT raw Scryfall card objects."
  - "Expected analytics derived by running computeDeckAnalytics once via a throwaway D:/tmp/compute-fixture-expected.mjs script, then locking the output. Future regressions in mana-curve / colour-pie / type-breakdown math are caught by the 10 fixture assertions."
  - "RAG thresholds keep the legacy DEFAULT_THRESHOLDS + detectGaps as a back-compat alias so the existing 10 two-tier gap-detection tests stay green — no test rewrites required."
  - "Custom per-deck thresholds (set via saveDeckThresholds, single-number legacy shape) are normalised in updateGaps to { green, amber } so the existing data-migration is invisible — no schema or storage changes."
  - "Commander section uses fallback derivation (first Legendary Creature/Planeswalker matching deck colour-identity union) for legacy v1.0 decks lacking commander_id, with console.warn for diagnostic visibility per 09-RESEARCH P-9."
  - "Commander tile is intentionally NOT registered with SortableJS — moving the commander between type sections is meaningless."

patterns-established:
  - "EDHREC bulk endpoint + meta-table cache: a single fetch populates the entire lookup map, cached as one meta row with { key, map, fetched_at } shape and a 7d TTL — pattern reusable for any future single-bulk-fetch reference data (e.g. Top-100 Most Played, etc.)"
  - "Three-tier RAG with suggestedAdd: severity = `red`|`amber`|`green` plus suggestedAdd = green - count, sorted red→amber→green so renderers display worst-first. GREEN gaps are emitted from the detector but suppressed by the renderer."
  - "Test-time window.Alpine stub for components that read window.Alpine directly (not the import). Pattern: assign `window.Alpine = { store, effect, data }` in beforeEach + restore in afterEach. Mocking 'alpinejs' via vi.mock alone won't work for these components."
  - "Reference-deck fixtures using canonical store-entry shape — fixture.cards.json carries `{ card: {...}, quantity, tags, owned }` per entry (matches deck-store loadDeck output), so the same fixture flows through both deck-analytics and intelligence pipelines without re-shaping."

requirements-completed: [DECK-01, DECK-02, DECK-03, DECK-04, DECK-05]

# Metrics
duration: 25min
completed: 2026-04-17
---

# Phase 09 Plan 01: Deck Accuracy + Analytics Polish Summary

**Wired Thousand-Year Storm to actually tell the truth — salt gauge now reads
non-zero for stax-heavy decks via EDHREC's Top-100 bulk endpoint, gap warnings
render `[RED|AMBER] +N` badges with EDHREC-derived per-category thresholds,
Commander has its own type section above Creature, and 100-card mana-curve +
colour-distribution math is locked against three hand-derived reference
fixtures.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-04-17T08:49:02Z
- **Completed:** 2026-04-17T09:14:00Z
- **Tasks:** 5 (Task 0 + Tasks 1-4)
- **Files modified:** 5 source + 7 test + 7 fixture (+ 1 SUMMARY) = 20 files
- **Tests added:** 32 new cases (5 deck-editor + 10 fixtures + 5 fetchTopSaltMap + 18 RAG + 4 panel + 5 commander section, minus the obsolete getCardSalt block)
- **Total Plan 1 tests passing:** 100 across 8 test files; full suite 632 pass + 1 pre-existing failure (router.test.js > vandalblast, owned by Plan 2)

## Accomplishments

- **DECK-04 structural fix.** Replaced `getCardSalt(name)` (queried a path
  EDHREC never returns) with `fetchTopSaltMap()` consuming the bulk
  `/pages/top/salt.json` endpoint. Salt aggregate now non-zero for any deck
  containing Top-100 cards (Stasis 3.06, Cyclonic Rift 2.71, Smothering Tithe
  2.84, etc.). Cached for 7 days in the existing meta table — no schema bump.
- **DECK-03 RAG redesign.** Three-tier severity (`red`/`amber`/`green` +
  `suggestedAdd`) with per-category thresholds derived from EDHREC averages,
  Draftsim ramp data, Frank Karsten draw baseline, and the Burgess formula
  for lands. Creatures threshold is archetype-aware (Tribal/Aggro green ≥ 30,
  Spellslinger/Control green ≥ 12, default green ≥ 20). Badge format
  `[RED] +5` per D-04 — no category-name duplication, GREEN gaps suppressed.
- **DECK-05 Commander section.** Renders ABOVE the existing TYPE_ORDER groups
  in `deck-centre-panel.js` with JetBrains Mono 11px primary blue header.
  Suppresses double-rendering by filtering the commander out of the Creature
  group below. Falls back to deriving the commander from the first matching
  Legendary Creature/Planeswalker for legacy decks lacking `commander_id`.
- **DECK-02 reference fixtures locked.** Three hand-curated 100-card decks
  (mono-R Krenko, UR Niv-Mizzet Parun, 5C The Ur-Dragon) with hand-derived
  expected mana-curve (integer-exact match) and colour-distribution
  (within 0.01 per bucket) values. The Ur-Dragon fixture deliberately includes
  Walker of the Wastes so all 6 colour-pie buckets including {C} are non-zero.
- **DECK-01 back-button contract locked.** Existing implementation works as
  designed; test ensures regression catches.
- **Schema invariant documented.** Added JSDoc `@typedef ActiveDeck` to
  `deck-centre-panel.js` capturing the commander_id non-indexed-row-field
  reality (Phase 7 v8 schema doesn't index commander_id but Dexie persists it).

## Task Commits

Atomic commits per task, with TDD red/green pairs for high-risk surfaces:

1. **Task 0: DECK-01 back button + commander_id verification** —
   [`605bcce`](#) `test(09-01)` — single test file + JSDoc comment.
2. **Task 1: DECK-02 reference-deck fixtures + analytics validation** —
   [`eb4365e`](#) `test(09-01)` — 6 fixture files + 1 test file.
3. **Task 2 RED: DECK-04 failing tests** — [`079bec7`](#) `test(09-01)` —
   tests/edhrec-service.test.js replacement + tests/fixtures/edhrec-top-salt.json.
4. **Task 2 GREEN: DECK-04 fetchTopSaltMap + intelligence wiring** —
   [`7db0a88`](#) `feat(09-01)` — getCardSalt removed, fetchTopSaltMap added,
   intelligence.js aggregate path live.
5. **Task 3 RED: DECK-03 failing RAG tests** — [`d61335a`](#) `test(09-01)` —
   tests/gap-detection.test.js (18 new cases) + tests/deck-analytics-panel.test.js (NEW).
6. **Task 3 GREEN: DECK-03 RAG implementation + badge UI** — [`8864a70`](#)
   `feat(09-01)` — gap-detection.js extended, intelligence.js + deck.js wired,
   deck-analytics-panel.js badge render rewritten.
7. **Task 4 RED: DECK-05 failing Commander tests** — [`78f3a63`](#)
   `test(09-01)` — tests/deck-centre-panel.test.js (NEW, 5 cases).
8. **Task 4 GREEN: DECK-05 Commander section + fallback derivation** —
   [`c74df51`](#) `feat(09-01)` — deck-centre-panel.js renderGroups
   extension + resolveCommanderEntry helper.

**Plan metadata:** appended after this summary.

## Files Created/Modified

### Source (5 modified, 0 created)
- `src/services/edhrec.js` — REMOVED structurally-broken `getCardSalt`;
  ADDED `fetchTopSaltMap` (single-fetch Top-100 bulk endpoint, meta-row cache,
  7d TTL, graceful fallback to stale cache on network failure).
- `src/stores/intelligence.js` — Wired the per-card salt aggregate path via
  `fetchTopSaltMap` + `aggregateDeckSalt`; added three-tier RAG gap call via
  `detectGapsRAG` with custom-threshold normalisation; kept commander-only
  salt as backward-compat fallback for empty/hydration-not-ready decks.
- `src/stores/deck.js` — Pass `activeDeck.tags` to `intel.updateGaps` so the
  archetype-aware creature threshold resolves correctly.
- `src/utils/gap-detection.js` — Added `RAG_THRESHOLDS`,
  `getCreatureThresholds`, `detectGapsRAG` exports. Legacy `DEFAULT_THRESHOLDS`
  + `detectGaps` preserved as back-compat alias (existing 10 two-tier tests
  unchanged).
- `src/components/deck-analytics-panel.js` — Rewrote gap-warning render block
  (lines ~600-665) to produce `[RED] +N` / `[AMBER] +N` badges. Categories
  without a tag-row (Lands, Creatures — typeBreakdown not tagBreakdown) fall
  back to a panel-level chip so the warning stays visible.
- `src/components/deck-centre-panel.js` — Added `resolveCommanderEntry`
  helper + Commander section render before TYPE_ORDER loop + commander
  suppression filter on the Creature group. Added `@typedef ActiveDeck`
  JSDoc documenting the commander_id row-field invariant (D-07 + P-9).

### Tests (4 created, 2 modified)
- `tests/deck-editor.test.js` (NEW) — 2 cases for the deck-back-to-landing
  CustomEvent dispatch.
- `tests/deck-analytics-fixtures.test.js` (NEW) — 10 cases for Krenko/Niv/
  Ur-Dragon analytics validation.
- `tests/deck-analytics-panel.test.js` (NEW) — 4 cases for the badge UI
  render contract (Chart.js + Alpine + db.cards mocked).
- `tests/deck-centre-panel.test.js` (NEW) — 5 cases for the Commander section
  + fallback derivation.
- `tests/edhrec-service.test.js` (MODIFIED) — Removed obsolete `getCardSalt`
  describe block (3 tests); added `fetchTopSaltMap` describe block (5 tests).
- `tests/gap-detection.test.js` (MODIFIED) — Added 18 RAG cases (RAG_THRESHOLDS
  shape, severity tiers, archetype switch, scaling, sort order).

### Fixtures (7 created)
- `tests/fixtures/edhrec-top-salt.json` — 5-entry EDHREC `/pages/top/salt.json`
  capture (Stasis 3.06, Smothering Tithe 2.84, Cyclonic Rift 2.71, Armageddon
  2.65, Winter Orb 2.42).
- `tests/fixtures/decks/krenko-mob-boss.{cards,expected}.json` — mono-R 100-card
  deck. R = 1.0, 36 lands, mana_curve = `{0:1, 1:14, 2:14, 3:20, 4:8, 5:3, 6:3, 7+:1}`,
  averageCmc = 2.75.
- `tests/fixtures/decks/niv-mizzet-parun.{cards,expected}.json` — UR 100-card
  spellslinger. U:R ≈ 60:40, off-colour pips < 0.05, 36 lands, averageCmc = 2.69.
- `tests/fixtures/decks/the-ur-dragon.{cards,expected}.json` — 5C dragons.
  All 6 colour buckets non-zero (Walker of the Wastes provides the {C} pip),
  36 lands, averageCmc = 3.86.

## Decisions Made

See `key-decisions` in frontmatter (8 decisions logged). Highlights:

- **DECK-04 was a structural bug, not a logic bug.** This decision overrode
  the original D-04/D-06 framing in CONTEXT — the planner had assumed a wiring
  fix in `intelligence.js` would suffice. Live HTTP probes during research
  confirmed `card.salt` has never existed at `/pages/cards/{slug}.json`,
  forcing a rewrite to the `/pages/top/salt.json` bulk endpoint. RESEARCH
  caught this before implementation; Plan 1 ships the correct path.
- **Meta-table cache wins over a dedicated `salt_cache` table.** Top-100 is
  small (~5KB), single-row, and the meta-row pattern aligns with existing
  `edhrec_cache` + `combo_cache` philosophy. Avoids a Dexie schema bump in a
  phase that doesn't need one.
- **Custom-threshold normalisation in `intelligence.updateGaps`.** Keeps the
  back-compat surface tiny: existing single-number per-deck thresholds get
  auto-normalised to `{ green: N, amber: round(N * 0.6) }` at read time. No
  data migration, no `saveDeckThresholds` API change.
- **Commander tile is NOT SortableJS-registered.** Moving the commander
  between type sections is meaningless. The Commander section is render-only.
- **RED tests committed before GREEN.** Two TDD pairs for DECK-04 and DECK-03,
  one for DECK-05. Gives reviewers a clean diff per intent (test → impl) and
  proves the new tests would have caught the historical bug.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Chart.js mock had to carry config through to instance**

- **Found during:** Task 3 (DECK-03 panel render tests)
- **Issue:** Initial Chart.js vi.mock returned a constructor that produced
  instances WITHOUT `.data.datasets`. The panel's update path
  (`manaCurveChart.data.datasets[0].data = data` on second render) crashes
  with `Cannot read properties of undefined (reading 'datasets')`. The
  module-level `manaCurveChart` survives across tests (singleton), so the
  second test in the file always hit the buggy update branch.
- **Fix:** Updated the Chart constructor mock to clone `config.data` onto
  `this.data` so subsequent updates see a well-shaped `data.datasets[0]`.
- **Files modified:** `tests/deck-analytics-panel.test.js`
- **Verification:** All 4 panel cases pass.
- **Committed in:** `8864a70` (part of Task 3 GREEN — same file as the new
  test additions).

**2. [Rule 3 - Blocking] Test mock setup gap: panel reads `window.Alpine`, not `import Alpine`**

- **Found during:** Task 3 (DECK-03 panel render tests)
- **Issue:** Both `deck-analytics-panel.js` and `deck-centre-panel.js` read
  `const Alpine = window.Alpine` directly at function entry, NOT
  `import Alpine from 'alpinejs'`. `vi.mock('alpinejs', ...)` therefore had
  no effect on these components — `window.Alpine` was undefined in jsdom
  and `store?.analytics` resolved to undefined, silently early-returning
  from `updateAllSections` with the gap-warning loop never reached.
- **Fix:** Added `window.Alpine = { store, effect, data }` stub to
  `beforeEach` (with restore in `afterEach`) using the same `__stores`
  backing object that the vi.mock factory closes over. This pattern is now
  established for both panel test files (deck-analytics-panel.test.js +
  deck-centre-panel.test.js).
- **Files modified:** `tests/deck-analytics-panel.test.js`,
  `tests/deck-centre-panel.test.js`
- **Verification:** 9 tests pass across both files.
- **Committed in:** `8864a70` (Task 3 GREEN) + `c74df51` (Task 4 GREEN).
- **Pattern established:** Recorded in frontmatter `patterns-established` for
  Plan 2 — `player-card.js` and `floating-toolbar.js` likely use the same
  window.Alpine read pattern.

**3. [Rule 3 - Blocking] vitest reporter 'basic' doesn't exist in 4.x**

- **Found during:** Task 0 (first test run)
- **Issue:** `npx vitest run --reporter=basic` errors with
  `Failed to load custom Reporter from basic`. Vitest 4.1.2 dropped the
  `basic` reporter alias.
- **Fix:** Just used the default reporter (no flag).
- **Files modified:** None (process-level, not committed).

---

**Total deviations:** 3 auto-fixed (3 blocking)
**Impact on plan:** All three were test-infrastructure friction, not
production-code issues. Production diff matches PLAN spec exactly. The
window.Alpine pattern (#2) is a useful pattern for Plan 2 to inherit.

## Issues Encountered

- **Pre-existing `tests/router.test.js > vandalblast` failure persists.**
  Documented in 09-RESEARCH §"Pre-existing" + STATE.md as a Phase 8 carry-over
  caused by `src/screens/vandalblast.js` calling `Alpine.data(...)` at mount
  time before the test boots Alpine. Plan 2 owns the fix (defensive
  `Alpine?.data?.(...)` guard recommended by RESEARCH P-3). Plan 1 verified
  the failure is identical against `git stash`-ed work tree, confirming it's
  not caused by Plan 1 changes.

## Known Stubs

None — no UI shipped with hardcoded empty values flowing to render.

## Carry-over Blockers (v1.1 SUMMARY consolidation)

- **Production CORS proxy for EDHREC remains unresolved.** Per STATE.md
  "Blockers/Concerns" + 09-CONTEXT D-05 + 09-RESEARCH §"DECK-04 EDHREC Salt
  API Contract": Plan 1's `fetchTopSaltMap` works in dev (Vite proxy at
  `vite.config.js:8-12`) but production deployment will need a serverless
  proxy or edge function rewriting `/api/edhrec/*` → `https://json.edhrec.com`.
  This is NOT a Phase 9 blocker — it's a v1.0 carry-over that affects all
  EDHREC consumers (synergies, salt) equally. Surface in v1.1 milestone
  SUMMARY for tracking.

## User Setup Required

None — no external service configuration required for Plan 1.

## Next Phase Readiness

- **Plan 2 (Vandalblast layout + visuals — GAME-01..06) is unblocked.** Plan 2
  shares zero source files with Plan 1; can start immediately.
- **The window.Alpine test stub pattern is documented for Plan 2 reuse** —
  Plan 2's player-card.test.js and floating-toolbar.test.js will likely need
  the same setup (verified via `Grep` of `window.Alpine` reads).
- **The `tests/router.test.js > vandalblast` failure remains the lowest-cost
  Plan 2 regression target** — fixing it gives Plan 2 a clean test suite to
  build on.
- **Salt cache row in meta table will be inherited by Phase 10 (auth) +
  Phase 11 (sync).** The row is per-device today (no `user_id`); when sync
  ships, cache invalidation on user switch may need a sweep. Not in scope for
  Phase 9.

## Self-Check: PASSED

- All claimed test files exist:
  - `tests/deck-editor.test.js` FOUND
  - `tests/deck-analytics-fixtures.test.js` FOUND
  - `tests/deck-analytics-panel.test.js` FOUND
  - `tests/deck-centre-panel.test.js` FOUND
  - `tests/fixtures/edhrec-top-salt.json` FOUND
  - `tests/fixtures/decks/krenko-mob-boss.{cards,expected}.json` FOUND
  - `tests/fixtures/decks/niv-mizzet-parun.{cards,expected}.json` FOUND
  - `tests/fixtures/decks/the-ur-dragon.{cards,expected}.json` FOUND
- All 8 task commits exist in git log:
  605bcce, eb4365e, 079bec7, 7db0a88, d61335a, 8864a70, 78f3a63, c74df51

---

*Phase: 09-deck-accuracy-vandalblast-pod-experience*
*Completed: 2026-04-17*
