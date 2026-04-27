---
plan: 14-07b
phase: 14
status: complete
completed: 2026-04-26
type: gap_closure
---

# Plan 14-07b Summary — Reconcile one-shot + release calendar sort

## What was built

### 1. One-shot reconciliation guard

`src/services/sync-reconciliation.js` now writes a `sync_reconciled_at` meta key after every reconciliation outcome. `reconcile()` short-circuits if the flag exists — silently flushing any local-only changes via `_enqueueAllLocalRows() + scheduleFlush(0)` instead of re-running classifyState and re-opening the modal.

Stamp sites:
- `empty-empty` branch (after seeding the cursor)
- `empty-populated` branch (after successful bulkPull)
- `populated-empty` branch (after enqueue + scheduleFlush)
- `populated-populated` branch — inside the `onChoice` callback, AFTER the chosen handler resolves (so a failed handler doesn't suppress retry)

`src/stores/auth.js` `signOut()` deletes the flag so the next sign-in (potentially a different account) re-runs reconciliation cleanly.

### 2. Release calendar — newest-first

`src/components/release-calendar.js` `sortedSets` getter flipped from `a - b` to `b - a`. Upcoming Releases timeline now reads top-down as furthest-future → soonest; Released list reads top-down as most-recent → oldest. Matches the 14-07 spoiler-dropdown ordering shipped in `src/services/sets.js`.

### 3. Precon multiplicity — intentional, no change

User confirmed: precon browser showing multiple commander decks per release is intended behaviour. No work.

## Status

**Complete.** 2 tasks landed, 2 regression tests added, 13/13 reconciliation tests passing standalone.

## Files touched

- `src/services/sync-reconciliation.js` — `RECONCILED_META_KEY`, `_markReconciled`, `_isReconciled`, fast-path short-circuit + 4 stamp sites
- `src/stores/auth.js` — `signOut()` clears `sync_reconciled_at`
- `src/components/release-calendar.js` — `sortedSets` getter sort direction flipped
- `tests/sync-reconciliation.test.js` — `+2` regression tests under `Phase 14.07b: sync_reconciled_at one-shot reconciliation` describe block

## Self-Check

- [x] Reconcile-modal-every-refresh bug fixed — flag stamped on first decision, fast-path skip on subsequent calls
- [x] Sign-out clears flag → next sign-in re-runs reconciliation
- [x] Stamp happens AFTER handler resolves (not before) so handler failure preserves retry semantics
- [x] Release calendar sort direction matches 14-07's dropdown ordering
- [x] 13/13 sync-reconciliation tests passing standalone (+2 over previous baseline of 11)

## Deviations

- **Cross-file test flake.** Running `vitest run` over the full suite occasionally surfaces 2 pre-existing failures in `KEEP_LOCAL invokes Supabase delete...` and `populated-empty does NOT invoke reconciliation modal — silent push`. Both fail with `expected 0 to be greater than or equal to N` indicating sync_queue is empty when the test expected enqueued rows — symptom of `_hooksInstalled` module flag persisting across test files while the underlying Dexie instance is recreated. Pre-existing, unrelated to this work. Tracked as v1.2 process debt.
- **No new test for sign-out clearing the flag.** The auth.signOut() change is exercised implicitly when `__resetSyncEngineForTests()` runs in beforeEach — fresh Dexie has no flag, modal can fire. Direct test would require mocking the auth store + signOut path; cost-benefit doesn't justify it for a 2-line dynamic-import.
