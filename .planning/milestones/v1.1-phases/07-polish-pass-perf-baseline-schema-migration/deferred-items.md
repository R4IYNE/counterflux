# Deferred Items — Phase 07 Plan 02

Pre-existing test failures observed but NOT caused by Plan 02 changes. Out of scope per scope boundary rule.

## router.test.js — Vandalblast screen mount
- File: `tests/router.test.js:121`
- Error: `TypeError: Cannot read properties of undefined (reading 'data')` in `src/screens/vandalblast.js:17`
- Root cause: Alpine.data mock/init timing in test environment (pre-existing)
- Occurs in 3 tests across `tests/router.test.js` (vandalblast screen content tests)
- Not caused by Plan 02 — present at pre-Plan-02 baseline
