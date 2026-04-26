---
plan: 14-07
phase: 14
status: complete
completed: 2026-04-26
type: gap_closure
---

# Plan 14-07 Summary — v1.2-merged-into-v1.1 quality items

## What was built

Two surgical fixes pulled forward from the original v1.2 backlog per user direction "1.2 only has two small items, just merge them into this phase".

### 1. Preordain spoiler-set selector — newest-first

`src/services/sets.js` `fetchSets()` now sorts the filtered set list by `released_at` DESC with name ASC tiebreak before writing the IndexedDB cache. The Preordain spoiler-set dropdown (`src/components/spoiler-set-filter.js`) iterates `$store.market.sets` directly with no client-side re-sort, so the order in `fetchSets()` is the order the dropdown shows.

User reported during 14-01 UAT: "Preordain still shows oldest to newest sets. should be the other way around." Fixed.

### 2. Bulk RETRY ALL / DISCARD ALL on sync-errors modal

`src/components/sync-errors-modal.js` populated-rows branch grew a bulk-action bar above the row list (visible only when `n > 1`). Two buttons:
- **RETRY ALL (N)** — sequentially calls `Alpine.store('sync').retry(id)` for every row.
- **DISCARD ALL** — gated on `window.confirm("Discard N sync errors? This cannot be undone.")`. On accept, sequentially calls `.discard(id)`.

During iteration, all buttons disable, label swaps to `RETRYING N…` / `DISCARDING N…`. On completion: empty list → auto-close modal; partial failure → re-enable, update count in label, surface toast with `{succeeded} retried/discarded, {failed} still pending.`

Sequential dispatch (not `Promise.all`) is deliberate — Phase 11 sync engine respects `PUSH_ORDER` and does its own batching; parallel retries would race the queue/conflicts state.

This unblocks the real-world dead-letter recovery case Phase 14-05 surfaced (848 entries from the column-drift era — per-row UI was unusable at that scale).

## Status

**Complete.** 2 tasks, 5 new regression tests, all green.

## Files touched

- `src/services/sets.js` — sort chain appended to `fetchSets()` before cache write (8 lines added)
- `src/components/sync-errors-modal.js` — bulk-action bar HTML + click handlers (~95 lines added)
- `tests/sets-service.test.js` — `+1` regression test (newest-first ordering with same-day tiebreak)
- `tests/sync-errors-modal.test.js` — `+4` regression tests (RETRY ALL count, DISCARD ALL confirm cancel, DISCARD ALL accept, bulk bar hidden at n=1)

## Self-Check

- [x] Both fixes are additive (no behaviour change in the simple case)
- [x] Sets sort runs before cache write so cache hits inherit ordering
- [x] Bulk-action bar hidden at `n === 1` so per-row UI stays the entry point for the trivial case
- [x] DISCARD ALL gated on confirm() — irreversible action protected
- [x] Sequential dispatch (not parallel) — matches Phase 11 sync engine cadence
- [x] 18/18 plan-targeted tests passing (`tests/sets-service.test.js` + `tests/sync-errors-modal.test.js`)
- [x] No regression in original 9 sync-errors-modal tests; 13 total now passing
- [x] No regression in original 4 sets-service tests; 5 total now passing

## Deviations

- **No live UAT reflip.** The Preordain change only affects the dropdown order and is statically verifiable via test fixtures. The bulk-action change is testable end-to-end with mocked Alpine.store('sync'); no live Supabase interaction needed since the per-row code path is unchanged. Both fixes are visible in the live app whenever the user opens the Preordain spoiler picker or the sync-errors modal post-deploy.
