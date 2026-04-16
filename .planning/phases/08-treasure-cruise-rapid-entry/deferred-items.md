# Phase 8 — Deferred Items

Out-of-scope discoveries logged during Phase 8 execution. These are pre-existing issues not caused by current phase changes; recorded here per GSD scope-boundary rule.

## Pre-existing test failures

### `tests/router.test.js > Screen content > vandalblast shows game tracker screen with setup`

- **Discovered during:** Phase 8 Plan 1 Task 4 full-suite regression gate
- **Failure:** `TypeError: Cannot read properties of undefined (reading 'data')` at `src/screens/vandalblast.js:17:10` (`Alpine.data('postGameOverlay', postGameOverlay)` — Alpine test-environment handle undefined)
- **Secondary:** `listenerTarget.removeEventListener is not a function` in Alpine cleanup
- **Verification:** Reproduced on commit `1b994ae` WITHOUT any Phase 8 source edits (via `git stash && npx vitest run tests/router.test.js`). Same 1/17 failure, same stack trace.
- **Status:** Not caused by Plan 1 changes. The Vandalblast route mount appears to expect an Alpine test shim that isn't wired up for that suite.
- **Proposed resolution:** Separate debug task — likely needs a jsdom environment flag on `tests/router.test.js` or a test-only Alpine init shim. Does NOT belong to Phase 8 (Treasure Cruise) scope.
- **Impact on Phase 8:** zero — `tests/router.test.js` doesn't exercise any Treasure Cruise surfaces.
