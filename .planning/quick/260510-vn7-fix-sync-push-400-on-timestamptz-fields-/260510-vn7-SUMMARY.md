---
phase: 260510-vn7-quick
plan: 01
subsystem: sync-engine
tags: [hot-fix, sync, supabase, timestamptz, postgres, vn7]
requires:
  - src/services/sync-engine.js (existing flushQueue + upsert seam)
  - Supabase counterflux.* schema with timestamptz columns
provides:
  - Number→ISO timestamp serialisation at the Supabase upsert boundary
  - Unblocks cloud push for deck_cards (90 backlog conflicts) and any future synced row carrying Number-typed timestamps
affects:
  - src/services/sync-engine.js (additive — new helper + 1 call line; hooks untouched)
  - tests/sync-engine-push.test.js (extended — 1 new test in existing describe)
tech-stack:
  added: []
  patterns:
    - "Conversion seam at the I/O boundary: keep local representation rich (Number for LWW math), serialise only at the wire (ISO for Postgres timestamptz)"
key-files:
  created: []
  modified:
    - tests/sync-engine-push.test.js  # +65 LoC, 1 new test inside 'flushQueue pipeline' describe
    - src/services/sync-engine.js     # +47 LoC, helper + 1 call line above flushQueue
decisions:
  - "Whitelist by column NAME across all 6 synced tables (8 columns total), not per-table schema introspection — auto-covers any future timestamptz column added under one of these names"
  - "Leave Dexie creating/updating hooks (sync-engine.js ~L220, ~L243) untouched — local Dexie keeps Number values; LWW resolver in sync-pull.js _toTs is already tolerant of both shapes"
  - "Skip non-finite Numbers (NaN, Infinity) so Postgres surfaces real bugs instead of silent fix-up masking them"
  - "Defer local Dexie row migration (Number → ISO) to v1.3 SEED-006 — once shipped, the conversion seam can eventually be removed and hooks can stamp ISO directly"
metrics:
  duration: "~4 minutes"
  completed: 2026-05-10
  tasks: 2
  commits: 2
---

# Quick Task 260510-vn7: Fix Sync Push HTTP 400 on timestamptz Fields Summary

**One-liner:** Convert Number-typed timestamp fields to ISO-8601 strings at the Supabase upsert seam in `flushQueue`, unblocking the 90 dead-lettered `deck_cards` mutations that have been silently failing since v1.1 ship.

## The Bug

Postgres `timestamp with time zone` columns cannot parse a raw integer like `1776555292268` — PostgREST forwards it as the integer literal, Postgres interprets ms-since-epoch as seconds-since-epoch (~year 58 million), and rejects with HTTP 400 / SQLSTATE 22008 `date/time field value out of range`.

The Dexie `creating` / `updating` hooks at `src/services/sync-engine.js:220` and `:243` deliberately stamp `obj.updated_at = Date.now()` (a JS Number) for fast local-side LWW math. Those Number values flowed straight through `flushQueue`'s spread-then-stamp pattern at the upsert seam (~L421) and into `supabase.schema('counterflux').from(tableName).upsert(rows)` unchanged.

**Symptom in production:** `classifyError` saw the 400 response, classified it as `permanent`, and dead-lettered the row to `sync_conflicts`. The user accumulated 90 conflicts and the cloud `counterflux.deck_cards` table held 0 rows for them. Every subsequent deck mutation also dead-lettered.

## The Fix

Single conversion seam at the upsert boundary, no hook surgery:

```javascript
// src/services/sync-engine.js — sited immediately above flushQueue
const TIMESTAMPTZ_COLUMNS = [
  'updated_at', 'synced_at', 'deleted_at', 'added_at',
  'created_at', 'started_at', 'ended_at', 'last_alerted_at'
];

function _isoStampTimestamps(rows) {
  for (const row of rows) {
    if (!row) continue;
    for (const col of TIMESTAMPTZ_COLUMNS) {
      const v = row[col];
      if (typeof v === 'number' && Number.isFinite(v)) {
        row[col] = new Date(v).toISOString();
      }
    }
  }
  return rows;
}

// ... and one new line at the upsert seam (~L466):
const rows = Array.from(latestByRow.values()).map(e => ({ ...e.payload, user_id: currentUserId }));
_isoStampTimestamps(rows);   // vn7 — convert Number timestamps to ISO before Supabase upsert
const { error } = await supabase.schema('counterflux').from(tableName).upsert(rows);
```

**Why a name-based whitelist (not per-table schema introspection):** the 8 column names in the whitelist are the union across all 6 synced tables (`collection`, `decks`, `deck_cards`, `games`, `watchlist`, `profile`). Adding a new `timestamptz` column under one of these names anywhere is auto-covered. Any future column with a different name needs to be added to the whitelist explicitly — that surface is small and reviewed.

**Why non-finite Numbers are skipped:** `Number.isFinite(v)` guards against `NaN` and `Infinity`. If a bug elsewhere produces those values, we WANT Postgres to reject them rather than silently coercing to a date — silent fix-up would mask the real defect.

**Why the Dexie hooks were not touched:** local Dexie continues to hold Number-typed timestamps. The LWW resolver `sync-pull.js:_toTs` already accepts both Number and ISO, so the dual representation is fine. Migrating the existing 5,000+ rows to ISO is risky migration churn for zero functional gain — deferred to v1.3 SEED-006 where it can be done as part of a bigger schema refresh.

## TDD Path

**Task 1 — RED** (`d7fd67c`): Added one test inside `tests/sync-engine-push.test.js`'s existing `'sync-engine push: flushQueue pipeline'` describe block. Seeds `sync_queue` with two entries:

- `deck_cards` with Number-typed `updated_at`, `synced_at`, `added_at`
- `games` with Number-typed `updated_at`, `started_at`, `ended_at`

After `flushQueue()`, asserts the captured `upsertCalls[*].rows[*]` carry ISO-8601 strings (regex `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/`), with a round-trip sanity check (`new Date(row.updated_at).getTime() === 1776555292268`) and untouched non-timestamp fields (`quantity === 4`, `scryfall_id === 'sc1'`, `deck_id === 'd-uuid-1'`).

Pre-fix output: `AssertionError: expected 'number' to be 'string'`. RED confirmed; 18 pre-existing tests continued to pass.

**Task 2 — GREEN** (`4cbda85`): Added `TIMESTAMPTZ_COLUMNS` const + `_isoStampTimestamps(rows)` helper above `flushQueue`, and a single call line at the upsert seam. Diff scope: 2 hunks at L336+ and L466. Lines 209-285 (Dexie hooks) untouched.

Post-fix output: 19/19 push tests pass; 68/68 sync-surface tests pass (suppression, cross-user, pull-splash, bulk-pull, conflict, realtime, RLS, offline, store, status-chip, schema-v10); 1067/1067 full project tests pass. The 4 router.test.js Alpine template warnings observed in the full-suite run are pre-existing on `master` (verified via `git stash` baseline) and unrelated to this fix.

## Recovery Path (Post-Deploy)

1. User deploys this build to Vercel production.
2. User opens Counterflux on a fresh device.
3. User clicks **Retry All** in the Sync Errors modal.
4. The 90 accumulated `sync_conflicts` re-enter `sync_queue`.
5. `flushQueue` picks them up; `_isoStampTimestamps` converts Number → ISO; Supabase accepts the upsert.
6. Cloud `counterflux.deck_cards` populates; Sync Errors modal shows 0 conflicts.

No data loss, no manual SQL, no migration script. The user runs Retry All themselves — automating the recovery is intentionally OUT OF SCOPE per the plan.

## Deferred Work (v1.3 SEED-006 candidate)

Migrate local Dexie rows from Number to ISO so:
1. The `_isoStampTimestamps` conversion seam can be removed.
2. The Dexie hooks at `:220` / `:243` can stamp `new Date().toISOString()` directly.
3. The dual-representation tolerance in `sync-pull.js:_toTs` can be tightened to ISO-only.

This requires: (a) a Dexie schema bump (v9), (b) a `.modify()` migration over the 6 synced tables backfilling Number → ISO on every row, (c) updating the hooks, (d) tightening `_toTs`. Roughly a one-plan effort, gated on user demand for the cleanup vs the cost of another upgrade event.

## Deviations from Plan

**None — plan executed exactly as written.**

The plan whitelist (`['updated_at','synced_at','deleted_at','added_at','created_at','started_at','ended_at','last_alerted_at']`) was applied verbatim. The conversion seam was placed at the exact line specified (`AFTER` the `const rows = ...` spread, `BEFORE` the `supabase.schema(...)...upsert(rows)` call). The Dexie hooks at lines 220 and 243 were not touched. `_toTs`, `sync-pull.js`, `sync-realtime.js`, and the LWW resolver were not touched. Non-finite Numbers are guarded with `Number.isFinite(v)` per the plan.

**Note on test count:** The plan estimated "16 pre-existing + 1 new = 17 tests" in `tests/sync-engine-push.test.js`. Actual count is 18 pre-existing + 1 new = 19. This is a planning estimate vs reality discrepancy — not a deviation. The new test failed in isolation pre-fix and passes post-fix exactly as specified.

## Self-Check: PASSED

**Files modified (verified present):**
- FOUND: `tests/sync-engine-push.test.js` (+65 LoC inside existing `flushQueue pipeline` describe)
- FOUND: `src/services/sync-engine.js` (+47 LoC: helper above `flushQueue`, single call line at upsert seam)

**Commits (verified via `git log`):**
- FOUND: `d7fd67c test(sync): add RED test for Number→ISO timestamp conversion in flushQueue (vn7)`
- FOUND: `4cbda85 fix(sync): convert Number timestamps to ISO strings before Supabase upsert (vn7)`

**Verification gates (all green):**
- vn7 isolated test: 1 pass (was 1 fail pre-fix)
- `tests/sync-engine-push.test.js`: 19/19 pass
- Full sync surface (11 files): 68 pass, 0 regressions
- Full project suite: 1067 pass, 0 new failures
- `git diff src/services/sync-engine.js`: confirmed 2 hunks only, lines 209-285 (Dexie hooks) untouched
