-- Phase 14.07g — profile.synced_at column parity.
-- The 14-05 column-parity migration (20260422) skipped the profile table
-- because no client code wrote to it at the time. v1.1 lit up profile writes
-- on every auth rehydrate (Phase 10 — Welcome Back flow), and the sync
-- creating/updating hooks include synced_at on every push payload.
-- Without this column, every profile row dead-letters with PGRST204
-- "Could not find the 'synced_at' column of 'profile' in the schema cache".
-- Live UAT on 2026-04-27 surfaced 11,867 dead-letters from a single profile
-- caught in a tight rehydrate-write loop.
--
-- Strategy: additive-only, idempotent. Same shape as the other 5 synced
-- tables which already have synced_at (collection / decks / deck_cards /
-- games / watchlist).

ALTER TABLE counterflux.profile
  ADD COLUMN IF NOT EXISTS synced_at timestamptz;
