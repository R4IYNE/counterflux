---
quick_id: 260510-k4t
type: execute
status: complete
completed_at: 2026-05-10
tags: [sync, reconciliation, bugfix, regression-test]
requirements: [BUGFIX-260510-k4t]
key_files:
  modified:
    - tests/sync-reconciliation.test.js
    - src/services/sync-reconciliation.js
commits:
  - 00d8371 test(sync): add failing test for bulk-pull resume marks reconciled
  - aabaf3d fix(sync): mark reconciled after resumed bulk-pull (260510-k4t)
metrics:
  files_changed: 2
  lines_added: 67
  lines_removed: 0
  tasks: 2
  duration: ~10 minutes
---

# Quick Task 260510-k4t: Bulk-Pull Resume Branch Missing `_markReconciled` — Summary

**One-liner:** Stamp `sync_reconciled_at:<userId>` after a resumed bulkPull so the populated-populated lockdown modal doesn't re-fire on the next boot.

## The Bug

`reconcile()` in `src/services/sync-reconciliation.js` has five success paths. Four of them call `_markReconciled(userId)` to stamp the per-user one-shot guard:

| Branch | Line | Stamps `sync_reconciled_at:<userId>` |
| --- | --- | --- |
| empty-empty | L150 | yes |
| empty-populated | L161 | yes |
| populated-empty | L176 | yes |
| populated-populated (post-onChoice) | L192 | yes |
| **resume (Pitfall 11-E)** | L131 | **NO — bug** |

**Symptom:** when a household user interrupted a MERGE EVERYTHING bulkPull (e.g. closed the tab mid-pull on a 5000+ card collection), `sync_pull_in_progress=true` stayed in `db.meta`. On the next boot, `reconcile()` correctly took the resume branch (L126), finished the pull, cleared the flag, and closed the splash — but never stamped `sync_reconciled_at:<userId>`. The boot AFTER that (with the resumed pull complete and local now populated):

1. Per-user one-shot guard at L121 returns `false` (flag never written)
2. `classifyState()` runs, sees populated-populated (the resumed pull made local non-empty + cloud was already populated)
3. The lockdown reconciliation modal re-fires — confusing the user who just sat through a 5-minute resumed bulkPull and would see "MERGE EVERYTHING / KEEP LOCAL / KEEP CLOUD" again with no way to dismiss it.

## The Fix

Two atomic commits, one line of production code.

### Commit 00d8371 — RED test

Appended `Phase 14.07d: bulk-pull resume marks reconciled` describe block at end of `tests/sync-reconciliation.test.js` with two tests:

- **Test A — primary RED:** Pre-seed `sync_pull_in_progress=true`, seed empty cloud counts/data for the 6 SYNCED_DATA_TABLES, call `reconcile()`, assert `db.meta.get('sync_reconciled_at:user-test-uuid')` is truthy with a numeric value. Also asserts the resume branch took it (`openReconciliationModal` not called, `splashState.opened > 0`).
- **Test B — user-facing symptom:** First call hits the resume branch; then add a local row + seed populated cloud counts to make the world look populated-populated; second `reconcile()` call must NOT re-fire the modal (the flag must short-circuit the per-user one-shot guard).

Both tests FAILED on master with the expected assertion errors:
- Test A: `expected undefined to be truthy` on the meta lookup
- Test B: `expected "vi.fn()" to not be called at all, but actually been called 1 times`

All 14 pre-existing tests in the file still passed.

### Commit aabaf3d — GREEN fix

One line added inside the resume branch's try block in `src/services/sync-reconciliation.js`:

```javascript
  if (await isBulkPullInProgress()) {
    openSyncPullSplash();
    try {
      await bulkPull();
      await clearBulkPullFlag();
      closeSyncPullSplash();
      await _markReconciled(userId);   // ← new
    } catch (err) {
      // ... unchanged — failure path deliberately does NOT mark reconciled
    }
    return;
  }
```

`userId` already in scope from L108 (`const userId = _currentUserId();`). `_markReconciled` already defined L82-89 in the same module. The catch branch is deliberately left untouched — partial-pull failure must NOT mark reconciled, the user retries via the splash error UI.

## Verification

| Command | Result |
| --- | --- |
| `npx vitest run tests/sync-reconciliation.test.js` (post-fix) | 16/16 passed |
| `npx vitest run` (full suite, post-fix) | 117 files / 1053 tests passed, 0 failures |

The 4 uncaught Alpine reactivity errors in `tests/router.test.js` (`Cannot read properties of undefined (reading 'length')` on `$store.collection.precons`) are **pre-existing in master** and out of scope per the GSD scope-boundary rule. Verified via `git stash` + clean run.

## Files Changed

| File | Change | Net |
| --- | --- | --- |
| `tests/sync-reconciliation.test.js` | Appended Phase 14.07d describe block (2 tests, ~66 lines) | +66 |
| `src/services/sync-reconciliation.js` | One line — `await _markReconciled(userId);` after `closeSyncPullSplash();` in resume branch | +1 |

`git diff --stat 4a836c4..HEAD` confirms exactly two files touched.

## Deviations from Plan

None — plan executed exactly as written. Both Test A (primary) and Test B (optional symptom-lock) added per the plan's recommendation. RED commit confirmed both failures with the expected assertion messages; GREEN commit's single-line addition turned both tests green with no other source changes needed.

## Pointer to Future Work

Per the plan's `<output>` instruction: this fix closes the regression but does NOT touch the broader UX rework around interrupted-pull resume. v1.3 SEED-005 (if scoped) would cover:
- Showing a "Resuming sync — please don't close this tab" warning on the splash
- Persisting bulkPull progress (rows pulled / total) across the interruption so the resumed splash starts where it left off rather than 0%
- A "Cancel and start over" escape hatch that wipes the partial pull and re-shows the modal

This fix is scoped to the immediate regression: the modal loop. The broader UX is deliberately deferred.

## Self-Check: PASSED

- File `tests/sync-reconciliation.test.js`: FOUND, contains "Phase 14.07d: bulk-pull resume marks reconciled" describe block
- File `src/services/sync-reconciliation.js`: FOUND, contains `await _markReconciled(userId);` inside the resume branch try block
- Commit `00d8371`: FOUND in git log
- Commit `aabaf3d`: FOUND in git log
- Full Vitest suite: 1053 passed, 0 failures
- Scope: exactly 2 files changed (`git diff --stat` confirms)
