---
phase: 08-treasure-cruise-rapid-entry
plan: 01
subsystem: ui
tags: [alpine, tailwind, treasure-cruise, collection, mass-entry, keyrune, vitest]

requires:
  - phase: 07-polish-perf-schema
    provides: cf-card-img rounded-thumbnail utility (POLISH-04); Vitest + fake-indexeddb regression pattern; var(--color-*) @theme tokens
provides:
  - Wave 0 test scaffolds for COLLECT-01/-03/-05 (10 test cases)
  - 40px thumbnail + name + set-icon dropdown row in add-card modal
  - 32x32 X close icon button in MASS ENTRY TERMINAL header wired to discard()
  - Mana-cost absence regression guard on add-card-modal.js
affects:
  - Plan 08-02 (LHS panel conversion reaches into the same two files; keyboard nav deferred to that plan)
  - Plan 08-03 (precon browser will reuse the same 56px card-row pattern for decklist preview)

tech-stack:
  added: []
  patterns:
    - "Inline Alpine x-template tests via window-shim + renderXxx() HTML-string inspection (mirrors tests/add-card-modal.test.js pattern from Phase 7)"
    - "var(--color-*) token usage in new markup (replacing hard-coded #EAECEE/#4A5064 in the dropdown row)"

key-files:
  created:
    - tests/add-card-panel.audit.test.js
    - tests/add-card-panel.dropdown.test.js
    - tests/mass-entry-panel.test.js
    - .planning/phases/08-treasure-cruise-rapid-entry/deferred-items.md
  modified:
    - src/components/add-card-modal.js
    - src/components/mass-entry-panel.js

key-decisions:
  - "Dropdown row uses var(--color-*) tokens (not hex) — early alignment with Plan 2's panel conversion which will lean heavily on tokens"
  - "Task 4 required no source edits — audit grep returned 0 mana-cost matches; the three completed edits were already compliant"
  - "Name-span x-text switched from card._name to card.name — _name was a legacy alias; UI-SPEC anatomy references card.name directly"

patterns-established:
  - "Phase 8 test files can omit jsdom entirely — inspect rendered HTML string; faster than mount-and-query and sufficient for DOM-shape assertions"
  - "Window-shim pattern: `if (typeof globalThis.window === 'undefined') globalThis.window = {}` before import — carries through from tests/add-card-modal.test.js"

requirements-completed: [COLLECT-01, COLLECT-03, COLLECT-05]

duration: 4min
completed: 2026-04-16
---

# Phase 8 Plan 1: Treasure Cruise Rapid Entry — Warm-Up Polish Summary

**Three low-risk UX fixes landed with Wave 0 test scaffolds: 40px dropdown thumbnails, MASS ENTRY TERMINAL X-close button, and a mana-cost regression guard — de-risking Plan 2's larger LHS panel conversion by touching the same two files first.**

## Performance

- **Duration:** ~4 min (215 seconds wall-clock)
- **Started:** 2026-04-16T08:46:53Z
- **Completed:** 2026-04-16T08:50:28Z
- **Tasks:** 4 (3 implementation + 1 verification-only)
- **Files modified:** 2 source + 3 new tests + 1 deferred-items log

## Accomplishments

- **COLLECT-03 delivered** — search dropdown rows now render `[thumb 40px] [name] [set icon]` left-to-right at 56px row height. Thumbnail uses the shared `cf-card-img` utility class (Phase 7 POLISH-04), lazy-loads from `image_uris.small`, and hides gracefully on Scryfall CDN failures via `onerror`.
- **COLLECT-05 delivered** — MASS ENTRY TERMINAL header now ships a visible 32×32 icon button with Material Symbols `close` glyph, wired to the existing `discard()` method so the `confirm("Discard N unparsed entries?")` guard at line 82 is preserved. `aria-label="Close mass entry"` + `title` tooltip included.
- **COLLECT-01 audit passed** — `grep -cE 'mana[_-]?cost|class="ms ms-|card\.mana_cost' src/components/add-card-modal.js` returns `0` after Task 2's edit. The dropdown rework didn't sneak mana-cost markup in, and the selected-card preview was already compliant.
- **Ten test cases added** as regression guards — 2 COLLECT-01 audit + 5 COLLECT-03 dropdown + 3 COLLECT-05 X-close. Plan 2's panel conversion will inherit these as a safety net when it renames `add-card-modal.js` → `add-card-panel.js`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 scaffolds** — `4bf7a0c` (test) — three new test files; RED step confirmed (7/10 failing as expected, 3/10 audit tests already green per D-22)
2. **Task 2: COLLECT-03 dropdown thumbnail** — `b6ef178` (feat) — search-result row markup replaced; GREEN (5/5 dropdown tests + 2/2 audit tests passing)
3. **Task 3: COLLECT-05 X close** — `1b994ae` (feat) — header h2 wrapped in flex-justify-between row + icon button; GREEN (3/3 mass-entry tests passing)
4. **Task 4: Full-suite audit** — no commit (pure verification gate — no source edits required); full Vitest suite shows 533 passing + 10 todo + 1 pre-existing unrelated failure logged to `deferred-items.md`

**Plan metadata commit:** pending (created by execute-plan finaliser with this SUMMARY + STATE + ROADMAP updates)

## Files Created/Modified

**Created:**
- `tests/add-card-panel.audit.test.js` — COLLECT-01 regression guard (2 test cases). Asserts dropdown + selected-card preview render zero mana-cost markup via regex audit.
- `tests/add-card-panel.dropdown.test.js` — COLLECT-03 DOM-shape assertion (5 test cases). Covers `cf-card-img` class, `image_uris?.small` binding, img/name/set-icon order, onerror fallback, 56px row, 40px img.
- `tests/mass-entry-panel.test.js` — COLLECT-05 X-close wiring (3 test cases). Covers aria-label, 32×32 button with `close` glyph, `@click="discard()"` binding.
- `.planning/phases/08-treasure-cruise-rapid-entry/deferred-items.md` — log of the pre-existing `tests/router.test.js > vandalblast` failure (out-of-scope per GSD scope-boundary rule).

**Modified:**
- `src/components/add-card-modal.js` (lines 131-147, and the x-text binding on the name span) — dropdown row reshaped to `[img 40px] [name] [ss icon]`; `var(--color-*)` tokens replace hard-coded hex on new markup; name span font switched to Space Grotesk 14/700 per UI-SPEC typography.
- `src/components/mass-entry-panel.js` (lines 98-114) — h2 heading wrapped in a flex-justify-between row; icon button appended with 120ms ease-out hover transition; `discard()` method body at line 80 UNCHANGED.

## Decisions Made

- **Use `var(--color-*)` tokens in new markup** — rather than hex-copying the existing `#EAECEE` / `#4A5064` pattern in the dropdown, the new row uses `var(--color-text-primary)` / `var(--color-text-dim)` / `var(--color-surface-hover)`. Aligns early with Plan 2's token-first panel conversion and matches UI-SPEC Color section. The two hard-coded hex values in the unchanged `close()` / backdrop chrome stay as-is (out of scope).
- **x-text binding switched from `card._name` to `card.name`** — the `_name` alias was a legacy artefact of the map step at line 44 (`_name: c.name`). UI-SPEC §Component Anatomy 4 references `card.name` directly, and the test expectation checked `x-text="card.name"`. Kept the `_name` field populated on the map step (no knock-on effect for existing consumers) but the rendered row now reads the canonical property.
- **Task 4 required zero source edits** — per D-22 the existing selected-card preview was already mana-cost-free, and Task 2's snippet didn't introduce any. Task 4 was a pure gate (grep + vitest run) and produced no commit.

## Deviations from Plan

None - plan executed exactly as written. No Rule 1-3 auto-fixes required; no Rule 4 architectural questions surfaced; no authentication gates hit. The only incidental edit (switching `x-text="card._name"` → `card.name`) was explicitly required by the Task 2 snippet in the plan (§Component Anatomy 4 + test assertion in `tests/add-card-panel.dropdown.test.js`) and is documented as Decision #2.

## Issues Encountered

- **Pre-existing `tests/router.test.js > vandalblast` failure** — reproduced on a `git stash` of working-tree changes (confirming it's not caused by Plan 1). The Vandalblast route mount hits `Alpine.data('postGameOverlay', ...)` when Alpine isn't shimmed for that test environment. Logged to `deferred-items.md`; does NOT affect any Treasure Cruise surfaces, which is Phase 8's exclusive scope.

## User Setup Required

None — no external service configuration. No new dependencies added. No schema migration triggered (Dexie v9 is Plan 3's work).

## Next Phase Readiness

**Ready for Plan 2 (LHS panel conversion + printing picker):**
- Two Phase 8 source files (`add-card-modal.js`, `mass-entry-panel.js`) now have fresh regression guards. Plan 2's rename of `add-card-modal.js` → `add-card-panel.js` + chrome swap will keep all 10 Plan 1 test cases GREEN provided the tests are updated to import the new filename.
- `cf-card-img` utility class confirmed live on `src/styles/main.css:97-98,118` — ready to apply to the 96×69 selected-card preview upgrade in Plan 2.
- `card._name` alias left in place on the search-results map step (line 44) to avoid churn; Plan 2 can remove it when the state machine moves to the panel file.
- No blockers for Plan 2 or Plan 3 arose from this polish batch.

**Visual regression anchor coverage after Plan 1:**
- ✅ Anchor 6 (dropdown row thumbnail) verifiable in dev — type "lightning" to see 40px thumbs with no mana cost.
- ⏳ Anchors 1-5 remain on Plan 2 + Plan 3.

## Self-Check: PASSED

Verified all claimed artefacts exist on disk and all commit hashes resolve:

- FOUND: tests/add-card-panel.audit.test.js
- FOUND: tests/add-card-panel.dropdown.test.js
- FOUND: tests/mass-entry-panel.test.js
- FOUND: .planning/phases/08-treasure-cruise-rapid-entry/deferred-items.md
- FOUND: src/components/add-card-modal.js (modified)
- FOUND: src/components/mass-entry-panel.js (modified)
- FOUND: commit 4bf7a0c (Task 1 — test scaffolds)
- FOUND: commit b6ef178 (Task 2 — dropdown thumbnail)
- FOUND: commit 1b994ae (Task 3 — X close button)

---
*Phase: 08-treasure-cruise-rapid-entry*
*Completed: 2026-04-16*
