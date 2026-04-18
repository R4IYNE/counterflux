-- ============================================================================
-- Counterflux Phase 11 Plan 1 — Tombstone cleanup scheduler (D-16)
-- ============================================================================
-- 30-day retention per D-16. Hard-deletes rows whose tombstone timestamp
-- (deleted_at) is older than 30 days, across the 5 synced data tables
-- (profile excluded per D-15 — no deleted_at column).
--
-- Runs nightly at 03:00 UTC to minimise conflict with user traffic. 30 days
-- is long enough for any household device to have seen the tombstone on at
-- least one sync cycle, even accounting for devices that sit idle for weeks.
--
-- Primary path: pg_cron (available on Supabase Pro+; may be available on
-- Free tier for some projects — verify via the preflight query in
-- 11-SYNC-PREFLIGHT.md §1).
--
-- If pg_cron is NOT available on huxley's tier, SKIP this migration entirely
-- and use the Edge Function fallback documented in 11-SYNC-PREFLIGHT.md
-- §"Edge Function Fallback". The Edge Function executes the same DELETE
-- statements via the service-role key and is scheduled through
-- Supabase Dashboard → Edge Functions → Schedule.
--
-- Idempotency: cron.schedule will error if a job with the same name exists.
-- We unschedule first (guarded by EXISTS) to make this migration safely
-- re-runnable.
-- ============================================================================

-- 1. Ensure pg_cron extension is available (no-op if already installed).
-- If this line fails with "could not access extension 'pg_cron'",
-- huxley's tier does not support pg_cron — abort this migration and use
-- the Edge Function fallback (see 11-SYNC-PREFLIGHT.md).
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Idempotent: unschedule prior job with this name before (re)scheduling.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'counterflux-tombstone-cleanup') THEN
    PERFORM cron.unschedule('counterflux-tombstone-cleanup');
  END IF;
END
$$;

-- 3. Schedule the nightly cleanup. Each DELETE is bounded by RLS-exempt
--    superuser context (cron.schedule runs as the job-owner — typically
--    postgres), so household scoping doesn't gate these deletes. That's
--    intentional: the tombstone retention policy is household-agnostic.
SELECT cron.schedule(
  'counterflux-tombstone-cleanup',
  '0 3 * * *',  -- daily at 03:00 UTC
  $$
    DELETE FROM counterflux.collection  WHERE deleted_at < now() - interval '30 days';
    DELETE FROM counterflux.decks       WHERE deleted_at < now() - interval '30 days';
    DELETE FROM counterflux.deck_cards  WHERE deleted_at < now() - interval '30 days';
    DELETE FROM counterflux.games       WHERE deleted_at < now() - interval '30 days';
    DELETE FROM counterflux.watchlist   WHERE deleted_at < now() - interval '30 days';
  $$
);
