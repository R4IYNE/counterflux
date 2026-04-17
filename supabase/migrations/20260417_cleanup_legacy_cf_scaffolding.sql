-- ============================================================================
-- Counterflux Phase 10 — Cleanup of legacy pre-Phase-10 public.cf_* scaffolding
-- ============================================================================
-- Applied to huxley: 2026-04-17
-- Migration name (Supabase): cleanup_legacy_cf_scaffolding
--
-- Context:
--   An earlier Counterflux Supabase schema attempt created 9 tables in the
--   `public` schema (violating D-02 which mandates the `counterflux` schema).
--   All 9 tables were empty (0 rows) and had no application code references.
--
--   This migration drops the orphaned scaffolding and the trigger function
--   (`public.cf_set_updated_at`) that supported 3 of those tables. This also
--   resolves a `function_search_path_mutable` security advisor warning.
--
-- Scope: DESTRUCTIVE — drops tables + function. Safe because all tables were
--   verified empty via row-count query prior to migration.
--
-- Phase 10 tables (unaffected): all live in the `counterflux` schema.
-- ============================================================================

DROP TABLE IF EXISTS public.cf_game_commander_damage CASCADE;
DROP TABLE IF EXISTS public.cf_game_life_events CASCADE;
DROP TABLE IF EXISTS public.cf_game_players CASCADE;
DROP TABLE IF EXISTS public.cf_games CASCADE;
DROP TABLE IF EXISTS public.cf_deck_cards CASCADE;
DROP TABLE IF EXISTS public.cf_decks CASCADE;
DROP TABLE IF EXISTS public.cf_collection CASCADE;
DROP TABLE IF EXISTS public.cf_price_alerts CASCADE;
DROP TABLE IF EXISTS public.cf_user_preferences CASCADE;

DROP FUNCTION IF EXISTS public.cf_set_updated_at() CASCADE;
