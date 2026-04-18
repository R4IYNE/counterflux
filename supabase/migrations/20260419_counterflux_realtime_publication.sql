-- ============================================================================
-- Counterflux Phase 11 Plan 1 — Realtime publication membership (Pitfall 11-C)
-- ============================================================================
-- Supabase's default `supabase_realtime` publication covers the `public`
-- schema only. Custom-schema tables (counterflux.*) fire ZERO realtime
-- events until explicitly added to the publication.
--
-- Without this, Plan 11-05's Realtime subscription to postgres_changes
-- silently returns no events; incremental polling (60s backstop) becomes
-- the only pull mechanism, which is user-visible latency.
--
-- All 6 synced tables are added (profile included — sign-in updates need
-- to propagate to other household devices so the profile widget stays
-- in sync). deleted_at is a column change like any other; its INSERT/UPDATE
-- firing through Realtime is what lets Device B soft-delete propagate
-- from Device A.
--
-- Verification (Supabase SQL Editor):
--   SELECT schemaname, tablename
--   FROM pg_publication_tables
--   WHERE pubname = 'supabase_realtime' AND schemaname = 'counterflux'
--   ORDER BY tablename;
-- Expected: 6 rows — collection, deck_cards, decks, games, profile, watchlist.
--
-- Idempotency: ALTER PUBLICATION ... ADD TABLE is NOT idempotent — if the
-- table is already published, it errors with
--   "relation 'counterflux.<table>' is already member of publication ...".
-- Re-running this migration after partial success requires DROP TABLE first.
-- See 11-SYNC-PREFLIGHT.md §Rollback.
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE counterflux.collection;
ALTER PUBLICATION supabase_realtime ADD TABLE counterflux.decks;
ALTER PUBLICATION supabase_realtime ADD TABLE counterflux.deck_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE counterflux.games;
ALTER PUBLICATION supabase_realtime ADD TABLE counterflux.watchlist;
ALTER PUBLICATION supabase_realtime ADD TABLE counterflux.profile;
