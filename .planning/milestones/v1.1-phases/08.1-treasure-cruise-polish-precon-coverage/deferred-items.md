# Phase 08.1 — Deferred Items (Out-of-scope discoveries)

Items discovered during Phase 08.1 plan execution that fall OUTSIDE the
scope of any 08.1 plan. Logged here per GSD scope-boundary rule, not
auto-fixed.

## From Plan 03 execution (2026-04-16)

### 1. tests/router.test.js — vandalblast screen content assertion fails
- **Status:** Pre-existing failure (predates Phase 08.1 work — confirmed via
  baseline test run on HEAD prior to Plan 03 changes)
- **Symptom:** Alpine cleanup error: `TypeError: Cannot read properties of
  undefined (reading 'length')` from a template binding referencing
  `$store.collection.precons.length` and `$store.collection.preconsLoading`.
  The test asserts vandalblast screen content but the failure originates in
  Alpine cleanup of the treasure-cruise screen still mounted from a prior
  test.
- **Likely cause:** Test isolation issue — collection store fields added in
  Phase 8 Plan 3 (precons, preconsLoading, preconsError, selectedPreconCode)
  are not reset between router test cases, so the next screen mount tears
  down references to fields that have been re-initialised to undefined.
- **Recommended owner:** Phase 9 or a future test-hygiene polish pass.
  Out of scope for FOLLOWUP-3 (hover-checkbox affordance).

### 2. tests/precons.test.js — Tests 1, 4, 6 failing during parallel execution
- **Status:** Caused by sibling Plan 02 (in-flight) modifying
  `tests/fixtures/scryfall-precons.js` while Plan 03 executes in parallel.
- **Symptom:** Three precons.test.js tests fail when fixture file is
  mid-modification. When the sibling Plan 02 fixture changes are stashed
  out, all 23 precons tests pass.
- **Recommended owner:** Plan 02 verifier — should resolve once Plan 02
  commits its fixture updates and source changes atomically.
- **Out of scope** for Plan 03 (FOLLOWUP-3 hover-checkbox).
