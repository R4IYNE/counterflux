# Phase 11 Sync — Preflight Runbook

**Applied to:** huxley (`hodnhjipurvjaskcsjvj`, eu-west-2)
**Prerequisites:** Phase 10 migrations applied; `.env.local` has `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`

**Companion artifacts:**

- `supabase/migrations/20260419_counterflux_soft_delete.sql` — adds `deleted_at` column to 5 synced tables
- `supabase/migrations/20260419_counterflux_realtime_publication.sql` — publishes counterflux.* to `supabase_realtime`
- `supabase/migrations/20260419_counterflux_tombstone_cleanup.sql` — pg_cron nightly hard-delete at 03:00 UTC
- `tests/sync-rls.test.js` — the live-Supabase hard gate this runbook unblocks
- `tests/sync-schema-v10.test.js` — Dexie-side gate (already green after Task 2)

---

## Preflight Checklist

### 1. Verify pg_cron availability on huxley

Run in **Supabase Dashboard → huxley → SQL Editor**:

```sql
SELECT name, installed_version, default_version
FROM pg_available_extensions
WHERE name = 'pg_cron';
```

**Outcomes:**

- `installed_version` is NOT NULL → pg_cron is already installed. Proceed with file 3 as-is.
- `installed_version` is NULL but `default_version` is NOT NULL → pg_cron is available to install. File 3's `CREATE EXTENSION IF NOT EXISTS pg_cron;` will handle it. (May require Pro+ tier — see fallback.)
- Zero rows returned → pg_cron is NOT available on this tier. **Skip file 3 entirely** and use the Edge Function fallback (see §Edge Function Fallback below).

Record the outcome in the Task 5 resume signal (`approved — pg_cron` or `approved — edge-function`).

---

### 2. Apply migrations in order

Apply via **Supabase Dashboard → huxley → SQL Editor → New Query**, pasting each file's contents and clicking **RUN**. OR via `supabase db push` if the CLI is wired.

Order matters — the realtime publication references tables that must exist first:

1. `supabase/migrations/20260419_counterflux_soft_delete.sql` — safe to re-run (`ADD COLUMN IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`)
2. `supabase/migrations/20260419_counterflux_realtime_publication.sql` — NOT idempotent. If any table is already in `supabase_realtime`, the whole migration aborts with `relation ... is already member of publication`. In that case, DROP first (see §Rollback) or skip the already-published lines manually.
3. `supabase/migrations/20260419_counterflux_tombstone_cleanup.sql` — **SKIP if pg_cron unavailable**. The migration has an idempotent `DO $$ ... cron.unschedule ... $$` guard so re-runs are safe.

Expected result for each: `Success. No rows returned.` (or similar).

---

### 3. Verify Realtime publication membership

```sql
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND schemaname = 'counterflux'
ORDER BY tablename;
```

**Expected:** exactly 6 rows in this order: `collection`, `deck_cards`, `decks`, `games`, `profile`, `watchlist`.

Missing any row means Plan 11-05's Realtime subscription won't fire events on that table (Pitfall 11-C). Re-run file 2's ADD TABLE for the missing ones manually.

---

### 4. Verify deleted_at columns

```sql
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'counterflux' AND column_name = 'deleted_at'
ORDER BY table_name;
```

**Expected:** exactly 5 rows — `collection`, `deck_cards`, `decks`, `games`, `watchlist`. Every row has `data_type = 'timestamp with time zone'` and `is_nullable = 'YES'`.

**Must NOT see `profile` in the list** — D-15 excludes profile from soft-delete. If profile appears, file 1 was misapplied — drop the column with `ALTER TABLE counterflux.profile DROP COLUMN deleted_at;` and investigate.

Verify the partial indexes exist too:

```sql
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'counterflux' AND indexname LIKE 'idx_%_deleted_at_live'
ORDER BY tablename;
```

**Expected:** 5 rows, each with `indexdef` containing `WHERE (deleted_at IS NULL)`.

---

### 5. Verify tombstone job scheduled (pg_cron path only)

SKIP this step if you used the Edge Function fallback.

```sql
SELECT jobname, schedule, command
FROM cron.job
WHERE jobname = 'counterflux-tombstone-cleanup';
```

**Expected:** 1 row with `schedule = '0 3 * * *'` and `command` containing 5 `DELETE FROM counterflux.<table>` statements.

Manual smoke-test — seed a stale tombstone and trigger the job:

```sql
-- Seed one tombstone that's 31 days old (uses the schema owner — runs as postgres, bypassing RLS).
INSERT INTO counterflux.collection (id, user_id, scryfall_id, category, foil, deleted_at)
VALUES (
  'tombstone-smoketest-' || gen_random_uuid()::text,
  (SELECT id FROM auth.users WHERE email = 'jamesarnall87@gmail.com' LIMIT 1),
  'smoke-test-scryfall-id',
  'main',
  false,
  now() - interval '31 days'
);

-- Trigger the cleanup job body immediately (bypasses the 03:00 cron timer).
DO $$
BEGIN
  DELETE FROM counterflux.collection  WHERE deleted_at < now() - interval '30 days';
  DELETE FROM counterflux.decks       WHERE deleted_at < now() - interval '30 days';
  DELETE FROM counterflux.deck_cards  WHERE deleted_at < now() - interval '30 days';
  DELETE FROM counterflux.games       WHERE deleted_at < now() - interval '30 days';
  DELETE FROM counterflux.watchlist   WHERE deleted_at < now() - interval '30 days';
END
$$;

-- Assert the row is gone.
SELECT count(*) FROM counterflux.collection
  WHERE scryfall_id = 'smoke-test-scryfall-id';  -- expect 0
```

---

### 6. Run live-Supabase test gate

From a shell with `.env.local` loaded (Vite auto-loads it during Vitest):

```bash
npx vitest run tests/sync-rls.test.js
```

**Expected:** all schema-mirror + filter-acceptance tests green (10 tests across 5 tables × 2 behaviours).

If any test reports `42703 column ... does not exist` — file 1 was not applied to the table in the error message. Re-run file 1 and retry.

If any test reports `PGRST204` — PostgREST cache hasn't reloaded. Wait 30 seconds and retry. If still failing, restart the Supabase project from the dashboard.

---

## Edge Function Fallback (if pg_cron unavailable)

Create a Supabase Edge Function at `supabase/functions/tombstone-cleanup/index.ts`:

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const tables = ['collection', 'decks', 'deck_cards', 'games', 'watchlist'];
  const results: Record<string, number> = {};

  for (const t of tables) {
    const { count, error } = await supabase
      .schema('counterflux')
      .from(t)
      .delete({ count: 'exact' })
      .lt('deleted_at', cutoff);
    if (error) {
      return new Response(
        JSON.stringify({ error: error.message, table: t }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    results[t] = count ?? 0;
  }

  return new Response(
    JSON.stringify({ cleaned: results, cutoff }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
```

Deploy and schedule:

1. `supabase functions deploy tombstone-cleanup` (CLI) — or deploy via Dashboard → Edge Functions → New Function.
2. Supabase Dashboard → **Edge Functions** → `tombstone-cleanup` → **Schedule** tab → set cron expression `0 3 * * *` (daily at 03:00 UTC).
3. Verify the `SUPABASE_SERVICE_ROLE_KEY` secret is set in the function's environment (Dashboard → Edge Functions → `tombstone-cleanup` → **Secrets**). Supabase usually auto-injects the URL/service-role by default.

### Smoke-test the Edge Function

POST to the function URL from any authenticated client (or `curl` with a service-role bearer token):

```bash
curl -X POST https://hodnhjipurvjaskcsjvj.supabase.co/functions/v1/tombstone-cleanup \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```

**Expected response:**

```json
{ "cleaned": { "collection": 0, "decks": 0, "deck_cards": 0, "games": 0, "watchlist": 0 }, "cutoff": "2026-03-19T..." }
```

Seed a 31-day-old tombstone (same SQL as §5), POST again, confirm the count > 0 for that table, and the row is gone via a follow-up SELECT.

---

## Rollback

If anything goes sideways, these steps undo each migration in reverse order.

### 1. Tombstone cleanup

```sql
SELECT cron.unschedule('counterflux-tombstone-cleanup');
-- OR: for Edge Function fallback — Dashboard → Edge Functions → tombstone-cleanup → Delete.
```

### 2. Realtime publication

```sql
ALTER PUBLICATION supabase_realtime DROP TABLE counterflux.collection;
ALTER PUBLICATION supabase_realtime DROP TABLE counterflux.decks;
ALTER PUBLICATION supabase_realtime DROP TABLE counterflux.deck_cards;
ALTER PUBLICATION supabase_realtime DROP TABLE counterflux.games;
ALTER PUBLICATION supabase_realtime DROP TABLE counterflux.watchlist;
ALTER PUBLICATION supabase_realtime DROP TABLE counterflux.profile;
```

### 3. Soft-delete column

```sql
ALTER TABLE counterflux.collection   DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE counterflux.decks        DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE counterflux.deck_cards   DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE counterflux.games        DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE counterflux.watchlist    DROP COLUMN IF EXISTS deleted_at;
-- Partial indexes are dropped automatically when the column is dropped.
```

### 4. Dexie v10 client rollback

Re-pin `src/db/schema.js` to v9 by reverting commit `091441e`. Existing rows keep their `deleted_at` field values — Dexie ignores the field without a schema declaration, so client reads and writes continue working. New rows just won't receive the field via schema enforcement.

The Dexie schema version in a user's IndexedDB does NOT downgrade cleanly. Rolling back v10 requires users to clear the `counterflux` IndexedDB (or use `Dexie.delete('counterflux')` on next boot). Document in the release notes if you actually ship this rollback.

---

## Completion Signal

All six steps 1-6 in Preflight Checklist pass → mark Plan 11-01 done in STATE.md and unblock Plans 11-04 (push engine) and 11-05 (pull + realtime).

Reply to the Task 5 checkpoint with one of:

- `approved — pg_cron` — pg_cron path succeeded; 11-05 can rely on scheduled cleanup
- `approved — edge-function` — Edge Function fallback deployed; scheduled via Dashboard
- `blocked: <reason>` — stop here, report to orchestrator

---

*Phase 11 Plan 01 — 2026-04-18*
