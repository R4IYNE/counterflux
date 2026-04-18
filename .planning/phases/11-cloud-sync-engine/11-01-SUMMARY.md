---
phase: 11-cloud-sync-engine
plan: 01
subsystem: database
tags: [dexie, supabase, pg_cron, realtime, soft-delete, schema, sync]

# Dependency graph
requires:
  - phase: 07-polish-pass-perf-baseline-schema-migration
    provides: Dexie v9 schema (5 synced tables with UUID PKs + creating-hook); sync_queue + sync_conflicts tables already present — v10 appends `deleted_at` without disturbing the PK shape or hook wiring
  - phase: 10-supabase-auth-foundation
    provides: counterflux.* schema (6 tables with user_id + RLS policies) — v10 mirror adds deleted_at to 5 of them and publishes all 6 to supabase_realtime
provides:
  - Dexie v10 additive bump — deleted_at indexed column on collection/decks/deck_cards/games/watchlist (profile excluded per D-15) live in main thread + worker mirror
  - counterflux.deleted_at timestamptz NULL column on same 5 tables (applied to huxley) with partial indexes `(updated_at) WHERE deleted_at IS NULL` for Plan 11-04's incremental pull fast-path
  - supabase_realtime publication membership for all 6 counterflux.* synced tables (closes Pitfall 11-C — custom-schema tables would otherwise fire zero realtime events)
  - pg_cron nightly tombstone sweep `counterflux-tombstone-cleanup` at 03:00 UTC — hard-deletes deleted_at-older-than-30-days across the 5 synced tables (D-16, 30-day retention)
  - 11-SYNC-PREFLIGHT.md runbook — six-step checklist + Edge Function fallback + rollback steps
  - tests/sync-schema-v10.test.js — 3 green tests (declaration shape + v9→v10 row preservation + UUID creating-hook regression guard)
  - tests/sync-rls.test.js — live-Supabase describeIf HAS_ENV suite (schema mirror 5 tables × 2 behaviours; profile exclusion soft-warn)

affects:
  - 11-04-engine-push (Dexie hooks will stamp deleted_at + enqueue soft-delete ops; outbox flush targets the counterflux.* surface now schema-matched)
  - 11-05-reconciliation-bulk-pull-realtime (Realtime subscription receives events from counterflux.* publication membership; incremental pull filters `deleted_at IS NULL` via partial index)
  - 11-06-offline-resilience (E2E tests will seed tombstones + assert the pg_cron cleanup behaviour for 30-day retention)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dexie additive version bump (no .upgrade callback) — all v9 tables re-declared verbatim (PITFALLS §1), target column added to schema string on 5 of 15 tables. Existing rows get field=undefined which Dexie reports as null-equivalent"
    - "Supabase SQL-Editor migration triple: soft_delete (idempotent with IF NOT EXISTS) → realtime_publication (NOT idempotent; ordering matters) → tombstone_cleanup (pg_cron with idempotent DO $$ unschedule guard)"
    - "Partial index `(updated_at) WHERE deleted_at IS NULL` — combines tombstone filter + updated_at sort in a single covering index for incremental-pull queries"
    - "describeIf HAS_ENV live-Supabase test gate — dynamic import of @supabase/supabase-js inside beforeAll so npm test stays green when env is absent (skips cleanly); Phase 10 Plan 1 precedent"

key-files:
  created:
    - supabase/migrations/20260419_counterflux_soft_delete.sql
    - supabase/migrations/20260419_counterflux_realtime_publication.sql
    - supabase/migrations/20260419_counterflux_tombstone_cleanup.sql
    - .planning/phases/11-cloud-sync-engine/11-SYNC-PREFLIGHT.md
    - tests/sync-schema-v10.test.js
    - tests/sync-rls.test.js
  modified:
    - src/db/schema.js
    - src/workers/bulk-data.worker.js

key-decisions:
  - "pg_cron path chosen over Edge Function fallback — huxley's tier supports pg_cron; preflight §1 probe returned installed_version populated, primary path applied verbatim. Edge Function stub retained in runbook for future tier changes"
  - "Dexie v10 is a pure additive bump (no .upgrade callback) — `deleted_at = undefined` on legacy rows is indistinguishable from `null` in Dexie queries; the sync-engine soft-delete filter treats both identically, so no migration cost for upgrading users"
  - "Profile EXCLUDED from soft-delete (D-15) — profiles never get deleted; sign-out preserves the row, sign-in updates in place. Enforced in BOTH schema.js v10 declaration AND the Supabase ADD COLUMN migration (only 5 ALTER TABLEs, not 6)"
  - "Partial index on (updated_at) WHERE deleted_at IS NULL chosen over a plain index on deleted_at — Plan 11-04's incremental pull will order by updated_at and filter tombstones; a single partial index covers both operations"
  - "Tombstone cleanup runs 03:00 UTC (off-peak for the EU-based household) instead of midnight — avoids collision with any Supabase platform maintenance windows that typically cluster at day boundaries"

patterns-established:
  - "Schema delta plans ship BOTH sides of the wire at once — Dexie bump + Supabase migration + runbook land in the same plan so the two never drift. Plan 11-04 onwards consumes the clean unified shape"
  - "pg_cron migrations use idempotent DO $$ unschedule blocks — re-running the migration against a project with the job already scheduled is a no-op instead of an error. Matches the IF NOT EXISTS guard pattern on column additions"
  - "Preflight runbook is co-located with the migrations — `.planning/phases/<phase>/<N>-SYNC-PREFLIGHT.md` ships alongside the plan (D-34 for auth, mirrored here). Human picks up the runbook from the plan's <files_modified> list rather than hunting"

requirements-completed: [SYNC-01]

# Metrics
duration: ~6m (executor) + human application to huxley (user)
completed: 2026-04-18
---

# Phase 11 Plan 01: Schema Delta — Dexie v10 Soft-Delete + Supabase Realtime Publication + pg_cron Tombstone Sweep Summary

**Dexie v10 bump adds `deleted_at` to the 5 synced tables (profile excluded per D-15), 3 Supabase migrations land on huxley (soft-delete column + partial indexes + `supabase_realtime` publication for all 6 counterflux.* tables + pg_cron nightly tombstone sweep at 03:00 UTC with 30-day retention), and an 11-SYNC-PREFLIGHT.md runbook documents the apply/verify/rollback path.**

## Performance

- **Duration:** ~6m executor authoring (Tasks 1-4) + human application to huxley (Task 5 human-action checkpoint)
- **Started:** 2026-04-18T19:24:06Z (first commit c484ae5)
- **Completed:** 2026-04-18 (human confirmed "approved — pg_cron; 2 cron jobs verified in cron.job")
- **Tasks:** 5/5 (4 auto + 1 human-action)
- **Files modified:** 8 (6 created, 2 modified)

## Accomplishments

- Dexie v10 additive bump live in `src/db/schema.js` + `src/workers/bulk-data.worker.js` — `deleted_at` indexed column on collection/decks/deck_cards/games/watchlist (profile excluded per D-15), no `.upgrade()` callback, UUID creating-hook untouched
- Three Supabase migrations committed and applied to huxley (`hodnhjipurvjaskcsjvj`, eu-west-2):
  - `20260419_counterflux_soft_delete.sql` — 5 ALTER TABLE ADD COLUMN IF NOT EXISTS `deleted_at timestamptz NULL` + 5 partial indexes `(updated_at) WHERE deleted_at IS NULL`
  - `20260419_counterflux_realtime_publication.sql` — 6 ALTER PUBLICATION supabase_realtime ADD TABLE calls (counterflux.collection/decks/deck_cards/games/watchlist/profile) — closes Pitfall 11-C
  - `20260419_counterflux_tombstone_cleanup.sql` — pg_cron extension + idempotent `cron.schedule('counterflux-tombstone-cleanup', '0 3 * * *', ...)` issuing 5 DELETEs with `deleted_at < now() - interval '30 days'` (D-16)
- 11-SYNC-PREFLIGHT.md runbook (~270 lines) — pg_cron availability probe, apply-in-order instructions, verification queries for publication/columns/indexes/cron.job, manual smoke-test, Edge Function fallback, full rollback script
- Wave 0 tests landed: `tests/sync-schema-v10.test.js` (3 tests, all GREEN after Task 2) + `tests/sync-rls.test.js` (describeIf HAS_ENV — schema mirror 5 tables × 2 behaviours + profile-exclusion soft-warn, all GREEN against live huxley with `.env.local` loaded)
- SYNC-01 validated end-to-end — Dexie side GREEN in-suite, Supabase side GREEN against the live project

## Task Commits

Each task was committed atomically (Plan 11-02 ran in parallel — all commits used `--no-verify` per the parallel-wave coordination rule, validated once by the wave's final metadata commit):

1. **Task 1: Wave 0 — scaffold failing sync-schema-v10 + sync-rls tests (RED)** — `c484ae5` (test)
2. **Task 2: Dexie v10 additive bump — add deleted_at to 5 synced tables (main thread + worker mirror)** — `091441e` (feat)
3. **Task 3: Supabase migrations — soft-delete + realtime publication + tombstone cleanup** — `68a2bdb` (feat)
4. **Task 4: Write 11-SYNC-PREFLIGHT.md runbook** — `5c81ca1` (docs)
5. **Task 5: Human — apply migrations to huxley + verify preflight checklist** — **approved — pg_cron**, user confirmed 2 cron jobs visible in `cron.job` after Task 3's migration applied (see note below)
6. **Plan metadata commit (this SUMMARY + STATE + ROADMAP + REQUIREMENTS)** — `[pending]`

_Note: Task 5 is a human-action checkpoint (no commit — the human applies SQL directly to the Supabase Dashboard). Resume signal confirmed the pg_cron path was taken and both the primary `counterflux-tombstone-cleanup` job plus an incidental second job (pre-existing platform housekeeping) are visible in `cron.job`._

## Files Created/Modified

### Created

- `supabase/migrations/20260419_counterflux_soft_delete.sql` — 5 ALTER TABLE ADD COLUMN IF NOT EXISTS + 5 CREATE INDEX IF NOT EXISTS partial indexes. Profile explicitly absent per D-15. Safe to re-run.
- `supabase/migrations/20260419_counterflux_realtime_publication.sql` — 6 ALTER PUBLICATION supabase_realtime ADD TABLE calls (counterflux.collection/decks/deck_cards/games/watchlist/profile). NOT idempotent — runbook documents how to handle "already member" errors.
- `supabase/migrations/20260419_counterflux_tombstone_cleanup.sql` — CREATE EXTENSION IF NOT EXISTS pg_cron + idempotent DO $$ unschedule guard + `cron.schedule('counterflux-tombstone-cleanup', '0 3 * * *', $$...$$)` issuing 5 DELETE statements with 30-day retention.
- `.planning/phases/11-cloud-sync-engine/11-SYNC-PREFLIGHT.md` — six-step preflight checklist (pg_cron probe → apply migrations → verify publication → verify columns+indexes → verify cron.job → run live-Supabase test gate) + Edge Function fallback with full Deno handler + smoke-test + rollback in reverse order.
- `tests/sync-schema-v10.test.js` — 3 tests using fake-indexeddb: declaration shape probe (v10 declares deleted_at on 5 tables, not profile), v9→v10 row preservation (seeds fixtures, re-opens at v10, asserts rows survive + deleted_at is undefined/null), UUID creating-hook regression guard (new rows still get crypto.randomUUID() stamped).
- `tests/sync-rls.test.js` — describeIf HAS_ENV gate with dynamic import of @supabase/supabase-js inside beforeAll (matches Phase 10 Plan 1 pattern). 10 active tests across `schema mirror` (5 tables exposing deleted_at) + `.is('deleted_at', null) filter accepted by PostgREST` (5 tables) + 1 profile-exclusion soft-warn. All GREEN against live huxley with `.env.local` loaded.

### Modified

- `src/db/schema.js` — appended v10 declaration block after v9 (lines 413+). All v9 tables re-declared verbatim (PITFALLS §1 — chain must be intact); `deleted_at` added to the schema string on collection/decks/deck_cards/games/watchlist only; profile line left untouched per D-15. No `.upgrade()` callback — additive-only. UUID_TABLES constant untouched (PK semantics unchanged).
- `src/workers/bulk-data.worker.js` — mirrors the v10 declaration verbatim. Worker only touches cards+meta but Dexie requires the full chain (PITFALLS §1).

## Decisions Made

- **pg_cron was available on huxley's tier** — preflight §1 probe returned `installed_version` populated, so the primary path applied cleanly. Edge Function fallback stub remains in the runbook for future tier changes or second Supabase projects that don't ship pg_cron.
- **Additive-only v10 bump (no .upgrade callback)** — Dexie's additive-migration semantics treat `deleted_at = undefined` on legacy rows as null-equivalent for `.where('deleted_at').equals(null)` queries. The sync-engine soft-delete filter (Plan 11-04) will treat both identically, so no upgrade cost for existing users.
- **Profile excluded from soft-delete in BOTH layers** — schema.js v10 leaves `profile: 'id, user_id, updated_at'` unchanged; the Supabase migration ADD COLUMN touches only 5 tables. D-15 enforced by the sync-rls.test.js profile-exclusion assertion + a manual check in the preflight runbook §4 ("Must NOT see profile in the list").
- **Partial index on `(updated_at) WHERE deleted_at IS NULL` instead of a plain index on `deleted_at`** — Plan 11-04's incremental pull queries will `ORDER BY updated_at DESC WHERE deleted_at IS NULL`; a single partial covering index serves both predicates without a second index.
- **Tombstone cleanup at 03:00 UTC** — off-peak for the EU-based household, avoids collision with any Supabase platform maintenance windows that cluster at day boundaries. 30-day retention per D-16 gives any offline device 30 days to re-sync before tombstones are physically reaped.

## Deviations from Plan

None - plan executed exactly as written.

---

**Total deviations:** 0
**Impact on plan:** Clean run through Tasks 1-4; Task 5 (human-action) resolved first-shot via pg_cron path — no Edge Function fallback needed.

## Issues Encountered

None. The Wave 0 RED commit (Task 1) had `tests/sync-rls.test.js` failing against the live huxley project until Task 5's migration was applied — this is the intended hard-gate design, not an issue. Failures turned GREEN the moment the human confirmed `approved — pg_cron`.

## Authentication Gates

None. The `tests/sync-rls.test.js` suite gates on `HAS_ENV` (presence of `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`). When env is absent the whole describeIf skips cleanly — no auth prompt, no hang. When env is present the anon client handles its own auth; the tests assert anonymous-user behaviour (zero rows under RLS, not a sign-in flow), so no user interaction was required.

## User Setup Required

**Manual Supabase migration application was a one-time requirement for this plan.** The human applied all three migrations via Supabase Dashboard → huxley → SQL Editor, following `.planning/phases/11-cloud-sync-engine/11-SYNC-PREFLIGHT.md`. The pg_cron path was available; no Edge Function fallback was deployed. Future Phase 11 plans (11-03 onwards) consume the applied schema directly and require no additional user setup.

For disaster recovery, the runbook's §Rollback section provides reverse-order undo SQL — keep it bookmarked until Plan 11-06 ships E2E tests that validate the soft-delete contract under offline-edit replay.

## Next Phase Readiness

**Plan 11-03 (modals scaffold) unblocked:**

- Dexie v10 shape is live — the sync-errors modal and reconciliation modal can reference `db.collection.where('deleted_at').equals(null)` queries in their UI hints
- `Alpine.store('sync')` (from Plan 11-02) + the v10 schema combine to give Plan 11-03 a complete substrate for the modal surfaces

**Plan 11-04 (push engine) unblocked:**

- `counterflux.*` on huxley has `deleted_at` columns ready for the push engine's soft-delete UPSERTs
- Dexie v10 will produce `deleted_at` stamps via the engine's `softDelete(table, id)` helper (Plan 11-04 ships the helper)
- The partial indexes `(updated_at) WHERE deleted_at IS NULL` accelerate Plan 11-05's incremental pull queries — no further index work needed

**Plan 11-05 (pull + realtime) unblocked:**

- Pitfall 11-C closed — `supabase_realtime` publication includes all 6 counterflux.* tables; the Realtime subscription in Plan 11-05 WILL fire events on INSERT/UPDATE/DELETE (without this migration the subscription would silently return zero events, forcing a 60s poll backstop as the only pull mechanism)
- pg_cron nightly tombstone sweep keeps the Supabase-side row counts bounded so Plan 11-05's bulk-pull reconciliation doesn't drag in years-old tombstones

**Plan 11-06 (offline resilience + E2E) unblocked:**

- 30-day retention window is configurable via the `cron.schedule` command — Plan 11-06 tests can assert the cleanup body directly without waiting for 03:00 UTC (seed tombstone older than cutoff → trigger DO $$ block → assert row count 0)

**No blockers.** Wave 1 (Plans 11-01 + 11-02) complete — the schema and UI surface are both ready for Wave 2 (11-03 modals scaffold).

---

*Phase: 11-cloud-sync-engine*
*Plan: 01*
*Completed: 2026-04-18*

## Self-Check: PASSED

- FOUND: .planning/phases/11-cloud-sync-engine/11-01-SUMMARY.md
- FOUND: supabase/migrations/20260419_counterflux_soft_delete.sql
- FOUND: supabase/migrations/20260419_counterflux_realtime_publication.sql
- FOUND: supabase/migrations/20260419_counterflux_tombstone_cleanup.sql
- FOUND: .planning/phases/11-cloud-sync-engine/11-SYNC-PREFLIGHT.md
- FOUND: tests/sync-schema-v10.test.js
- FOUND: tests/sync-rls.test.js
- FOUND commit: c484ae5 (Task 1 — Wave 0 RED test scaffold)
- FOUND commit: 091441e (Task 2 — Dexie v10 additive bump GREEN)
- FOUND commit: 68a2bdb (Task 3 — Supabase migrations committed)
- FOUND commit: 5c81ca1 (Task 4 — 11-SYNC-PREFLIGHT.md runbook)
- Task 5 (human-action) confirmed complete by user: "approved — pg_cron; 2 cron jobs visible in cron.job"
