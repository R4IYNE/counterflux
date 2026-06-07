-- Phase 17 (v1.3) — Counterflux AI deck-generation infrastructure.
-- Adds three things:
--   1. counterflux.deckgen_cache — hash-keyed response cache, 7d TTL
--   2. counterflux.deckgen_recommendations — cron-populated upgrade/retune rows
--   3. counterflux.profile — two new columns for per-user daily budget tracking
--
-- RLS uses the same `auth.uid() = user_id` pattern as the rest of v1.0–v1.2.
-- Per-user indexes follow PITFALLS §2.4 (RLS on unindexed user_id times out at
-- 1M rows).
--
-- The cron job that populates deckgen_recommendations uses SERVICE_ROLE_KEY
-- (one explicit exception to v1.0-v1.2's no-service-role rule, documented in
-- .planning/milestones/v1.3-PRD.md). RLS still applies for user-facing reads.

-- 1. deckgen_cache — hash-keyed response cache
--    `hash` is a content-addressable key over (commander_id, power, mode,
--    archetype, collection-hash). 7d TTL enforced by the client / cleanup pass.
CREATE TABLE IF NOT EXISTS counterflux.deckgen_cache (
  hash         text PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  response     jsonb NOT NULL,
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  ttl_days     integer NOT NULL DEFAULT 7
);

CREATE INDEX IF NOT EXISTS deckgen_cache_user_idx
  ON counterflux.deckgen_cache (user_id);
CREATE INDEX IF NOT EXISTS deckgen_cache_fetched_idx
  ON counterflux.deckgen_cache (fetched_at);

ALTER TABLE counterflux.deckgen_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own deckgen cache"
  ON counterflux.deckgen_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users modify own deckgen cache"
  ON counterflux.deckgen_cache FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. deckgen_recommendations — Phase 19 cron output
--    `type` distinguishes 'upgrade' (new cards detected) from 'retune' (power-
--    level swap). Soft-dismissed via `dismissed = true` so the surface UIs
--    (Dashboard widget, notification bell, Preordain) can filter them out
--    without losing audit history. Hard-delete pass at 30d via separate cron.
CREATE TABLE IF NOT EXISTS counterflux.deckgen_recommendations (
  id               text PRIMARY KEY,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deck_id          text NOT NULL REFERENCES counterflux.decks(id) ON DELETE CASCADE,
  type             text NOT NULL CHECK (type IN ('upgrade', 'retune')),
  recommendations  jsonb NOT NULL,
  generated_at     timestamptz NOT NULL DEFAULT now(),
  dismissed        boolean NOT NULL DEFAULT false,
  dismissed_at     timestamptz
);

CREATE INDEX IF NOT EXISTS deckgen_recommendations_user_idx
  ON counterflux.deckgen_recommendations (user_id);
CREATE INDEX IF NOT EXISTS deckgen_recommendations_deck_idx
  ON counterflux.deckgen_recommendations (deck_id);
CREATE INDEX IF NOT EXISTS deckgen_recommendations_undismissed_idx
  ON counterflux.deckgen_recommendations (user_id, dismissed)
  WHERE dismissed = false;

ALTER TABLE counterflux.deckgen_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own recommendations"
  ON counterflux.deckgen_recommendations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users modify own recommendations"
  ON counterflux.deckgen_recommendations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. counterflux.profile — extend with per-user daily budget columns
--    `deckgen_generations_today` resets at UTC midnight on first call of new day
--    (lazy reset — see api/deckgen.js for the atomic UPDATE RETURNING pattern).
--    Both columns default safe so existing v1.0-v1.2 profile rows boot cleanly.
ALTER TABLE counterflux.profile
  ADD COLUMN IF NOT EXISTS deckgen_generations_today integer NOT NULL DEFAULT 0;

ALTER TABLE counterflux.profile
  ADD COLUMN IF NOT EXISTS deckgen_last_reset date;
