-- v1.3.x hotfix — table GRANTs for the deckgen tables.
--
-- 20260607_counterflux_deckgen.sql created counterflux.deckgen_cache and
-- counterflux.deckgen_recommendations with RLS ENABLED + per-user policies, but
-- never GRANTed table privileges to the `authenticated` role. RLS controls which
-- ROWS a role may see; the role still needs a table-level GRANT to touch the
-- table at all. Without it PostgREST rejects every request with
-- "permission denied for table ..." (SQLSTATE 42501) -- which broke
-- loadRecommendations (boot 401), the deckgen_cache read/write on brew, and the
-- cron's recommendation inserts.
--
-- The existing counterflux.* tables (collection, decks, ...) already carry these
-- grants from the Phase 10/11 migrations; this just brings the deckgen tables in
-- line. RLS still enforces auth.uid() = user_id per row. The Phase 19 cron uses
-- SERVICE_ROLE, which bypasses both grants and RLS, so it is unaffected either way.

GRANT SELECT, INSERT, UPDATE, DELETE ON counterflux.deckgen_cache TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON counterflux.deckgen_recommendations TO authenticated;
