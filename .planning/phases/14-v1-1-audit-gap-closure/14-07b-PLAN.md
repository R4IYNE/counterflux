---
plan: 14-07b
phase: 14
type: gap_closure
wave: 1
depends_on: []
requirements: [SYNC-03, MARKET-01]
files_modified:
  - src/services/sync-reconciliation.js
  - src/stores/auth.js
  - src/components/release-calendar.js
  - tests/sync-reconciliation.test.js
autonomous: true
gap_closure: true
must_haves:
  - reconcile() is one-shot per device — sets sync_reconciled_at meta after first decision; subsequent calls skip the modal and silently flush queued local changes
  - Sign-out clears sync_reconciled_at so the next sign-in (potentially a different account) re-runs reconciliation
  - Release calendar (Upcoming Releases timeline) sorts newest-first to match the spoiler dropdown ordering shipped in 14-07
  - Pre-existing 11 reconciliation tests still pass; +2 regression tests for the one-shot guard
---

# Plan 14-07b: Reconcile one-shot guard + release calendar sort

## Context

Three issues surfaced after 14-07 shipped:

1. **Reconciliation modal re-fires every refresh.** After the user picked MERGE EVERYTHING (which converges via LWW but leaves both sides populated), `classifyState()` returns `populated-populated` again on every page load, so the modal opens every time. UX intent is one-shot per device.
2. **Upcoming Releases calendar still oldest-first.** 14-07 fixed the spoiler dropdown via `src/services/sets.js` but `src/components/release-calendar.js` has its own `sortedSets` getter that sorts ascending (oldest-first). Two display surfaces, one fix wasn't enough.
3. **Browsing precons shows multiple commander decks per release.** User confirmed this is *intended* (not a bug); no change required.

## Tasks

<task id="1" type="auto">
  <name>One-shot reconcile guard via sync_reconciled_at meta</name>
  <read_first>
    <file>src/services/sync-reconciliation.js</file>
    <file>src/stores/auth.js</file>
    <file>tests/sync-reconciliation.test.js</file>
  </read_first>
  <action>
    `src/services/sync-reconciliation.js`:
    - Add `RECONCILED_META_KEY = 'sync_reconciled_at'` and `_markReconciled()` / `_isReconciled()` helpers.
    - At the top of `reconcile()` (after the bulkPull-in-progress resume but before classifyState), short-circuit when `_isReconciled()` returns true: just call `_enqueueAllLocalRows()` + `scheduleFlush(0)` and return.
    - Stamp `_markReconciled()` on every decision branch — empty-empty, empty-populated success, populated-empty, and inside the populated-populated `onChoice` callback after the chosen handler resolves.

    `src/stores/auth.js` `signOut()`:
    - After clearing session/user, dynamic-import db and `db.meta.delete('sync_reconciled_at')` so the next sign-in re-runs reconciliation.

    Append 2 regression tests to `tests/sync-reconciliation.test.js`:
    - First reconcile fires modal exactly once with populated-populated; second reconcile skips modal entirely.
    - empty-empty path stamps the flag too.
  </action>
  <verify>
    <automated>
      npx vitest run tests/sync-reconciliation.test.js
    </automated>
    <expected>13 passed (was 11; +2 one-shot guard regressions). Standalone-file run is the gate; cross-file flake on KEEP_LOCAL/populated-empty pre-dates this work.</expected>
  </verify>
  <done>
    User refreshes the app after picking MERGE EVERYTHING — reconciliation modal does NOT reappear. Sign out and back in → modal fires once again, then quiets.
  </done>
  <acceptance_criteria>
    - `grep -c "sync_reconciled_at" src/services/sync-reconciliation.js` returns at least 2
    - `grep -c "sync_reconciled_at" src/stores/auth.js` returns at least 1
    - `grep -c "_markReconciled" src/services/sync-reconciliation.js` returns at least 4 (declaration + 4 stamp sites)
    - 2 new tests in `tests/sync-reconciliation.test.js` reference `'sync_reconciled_at'`
  </acceptance_criteria>
</task>

<task id="2" type="auto">
  <name>Release calendar — newest-first ordering</name>
  <read_first>
    <file>src/components/release-calendar.js</file>
  </read_first>
  <action>
    Flip the `sortedSets` getter in `src/components/release-calendar.js` from `a - b` to `b - a` so the Upcoming Releases timeline reads top-down as furthest-future → soonest, and the Released list reads top-down as most-recent → oldest. Matches 14-07's `src/services/sets.js` ordering.
  </action>
  <verify>
    <automated>
      grep -n "new Date(b.released_at).getTime() - new Date(a.released_at).getTime()" src/components/release-calendar.js
    </automated>
    <expected>1 match (descending sort).</expected>
  </verify>
  <done>
    Upcoming Releases section in Epic Experiment + Preordain shows newest-first like the dropdown.
  </done>
  <acceptance_criteria>
    - `grep -c "newest-first" src/components/release-calendar.js` returns at least 1 (comment marker for the sort direction)
    - Sort is descending: `b.released_at - a.released_at`
  </acceptance_criteria>
</task>

## Verification

Tasks are tiny and independent. Task 1 fixes a UX regression (every-refresh modal). Task 2 closes a missed display surface from 14-07. Issue 3 (precon multiplicity) is intentional per user, no work required.

## Deviations

- **No bulk-action change** — the user's third item ("browsing precons shows multiple commander decks vs. showing individually") was annotated `(intended)`, so no change required.
- **Cross-file test flake** — KEEP_LOCAL and populated-empty silent-push tests fail intermittently (~1 in 3 runs) when many test files run together; standalone runs of `tests/sync-reconciliation.test.js` are 13/13 green. The flake pre-dates this work (hook installation race between fake-indexeddb instances) and is tracked separately as a v1.2 process-debt item.
