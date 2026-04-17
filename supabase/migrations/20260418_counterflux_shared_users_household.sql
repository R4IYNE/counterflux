-- ============================================================================
-- Counterflux Phase 10.1 — Shared-users household model
-- ============================================================================
-- Applied to huxley: 2026-04-18
-- Migration name (Supabase): counterflux_shared_users_household
--
-- Context:
--   Phase 10 originally shipped per-user RLS (auth.uid() = user_id) on every
--   synced table. James + Sharon share the same physical card collection and
--   want mutual admin rights. This migration introduces a lightweight household
--   model: a whitelist table (counterflux.shared_users) whose members share
--   visibility and write access across the 5 data tables.
--
-- Architectural decision: see 10-CONTEXT.md D-38.
--
-- Scope:
--   1. NEW table: counterflux.shared_users (whitelist of household members)
--   2. Replace RLS policies on 5 shared data tables:
--      collection, decks, deck_cards, games, watchlist
--   3. profile keeps its per-user RLS (each user has own identity)
--   4. Seed shared_users with James + Sharon
--
-- Security boundary preserved:
--   - Outsider (not in shared_users): empty results on all 5 tables
--   - Same Lovable-class protection — now scoped to household, not individual
--   - user_id column still denormalised on every row (D-23 intact) for attribution
--
-- Forward migration path (future multi-household support):
--   Add counterflux.household + counterflux.household_members tables; copy
--   shared_users rows into household_members with a default household_id;
--   add household_id column to the 5 data tables; swap RLS to use
--   household_members; drop shared_users. Client code unchanged.
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1. Create shared_users membership table
-- -----------------------------------------------------------------------------
CREATE TABLE counterflux.shared_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE counterflux.shared_users ENABLE ROW LEVEL SECURITY;

-- Members can read the list (prevents external enumeration).
-- INSERT/UPDATE/DELETE intentionally have no policy — admin-only via SQL editor.
CREATE POLICY "members see the list" ON counterflux.shared_users
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM counterflux.shared_users)
  );

-- -----------------------------------------------------------------------------
-- 2. Seed household: James + Sharon
-- -----------------------------------------------------------------------------
INSERT INTO counterflux.shared_users(user_id)
SELECT id FROM auth.users
WHERE email IN ('jamesarnall87@gmail.com', 'sharon.strom10@gmail.com');

-- -----------------------------------------------------------------------------
-- 3. Replace per-user RLS with household RLS on 5 shared data tables
-- -----------------------------------------------------------------------------

-- collection
DROP POLICY "users see own collection" ON counterflux.collection;
DROP POLICY "users modify own collection" ON counterflux.collection;

CREATE POLICY "household sees collection" ON counterflux.collection
  FOR SELECT USING (
    user_id IN (SELECT user_id FROM counterflux.shared_users)
    AND auth.uid() IN (SELECT user_id FROM counterflux.shared_users)
  );

CREATE POLICY "household modifies collection" ON counterflux.collection
  FOR ALL USING (
    user_id IN (SELECT user_id FROM counterflux.shared_users)
    AND auth.uid() IN (SELECT user_id FROM counterflux.shared_users)
  ) WITH CHECK (
    user_id IN (SELECT user_id FROM counterflux.shared_users)
    AND auth.uid() IN (SELECT user_id FROM counterflux.shared_users)
  );

-- decks
DROP POLICY "users see own decks" ON counterflux.decks;
DROP POLICY "users modify own decks" ON counterflux.decks;

CREATE POLICY "household sees decks" ON counterflux.decks
  FOR SELECT USING (
    user_id IN (SELECT user_id FROM counterflux.shared_users)
    AND auth.uid() IN (SELECT user_id FROM counterflux.shared_users)
  );

CREATE POLICY "household modifies decks" ON counterflux.decks
  FOR ALL USING (
    user_id IN (SELECT user_id FROM counterflux.shared_users)
    AND auth.uid() IN (SELECT user_id FROM counterflux.shared_users)
  ) WITH CHECK (
    user_id IN (SELECT user_id FROM counterflux.shared_users)
    AND auth.uid() IN (SELECT user_id FROM counterflux.shared_users)
  );

-- deck_cards
DROP POLICY "users see own deck_cards" ON counterflux.deck_cards;
DROP POLICY "users modify own deck_cards" ON counterflux.deck_cards;

CREATE POLICY "household sees deck_cards" ON counterflux.deck_cards
  FOR SELECT USING (
    user_id IN (SELECT user_id FROM counterflux.shared_users)
    AND auth.uid() IN (SELECT user_id FROM counterflux.shared_users)
  );

CREATE POLICY "household modifies deck_cards" ON counterflux.deck_cards
  FOR ALL USING (
    user_id IN (SELECT user_id FROM counterflux.shared_users)
    AND auth.uid() IN (SELECT user_id FROM counterflux.shared_users)
  ) WITH CHECK (
    user_id IN (SELECT user_id FROM counterflux.shared_users)
    AND auth.uid() IN (SELECT user_id FROM counterflux.shared_users)
  );

-- games
DROP POLICY "users see own games" ON counterflux.games;
DROP POLICY "users modify own games" ON counterflux.games;

CREATE POLICY "household sees games" ON counterflux.games
  FOR SELECT USING (
    user_id IN (SELECT user_id FROM counterflux.shared_users)
    AND auth.uid() IN (SELECT user_id FROM counterflux.shared_users)
  );

CREATE POLICY "household modifies games" ON counterflux.games
  FOR ALL USING (
    user_id IN (SELECT user_id FROM counterflux.shared_users)
    AND auth.uid() IN (SELECT user_id FROM counterflux.shared_users)
  ) WITH CHECK (
    user_id IN (SELECT user_id FROM counterflux.shared_users)
    AND auth.uid() IN (SELECT user_id FROM counterflux.shared_users)
  );

-- watchlist
DROP POLICY "users see own watchlist" ON counterflux.watchlist;
DROP POLICY "users modify own watchlist" ON counterflux.watchlist;

CREATE POLICY "household sees watchlist" ON counterflux.watchlist
  FOR SELECT USING (
    user_id IN (SELECT user_id FROM counterflux.shared_users)
    AND auth.uid() IN (SELECT user_id FROM counterflux.shared_users)
  );

CREATE POLICY "household modifies watchlist" ON counterflux.watchlist
  FOR ALL USING (
    user_id IN (SELECT user_id FROM counterflux.shared_users)
    AND auth.uid() IN (SELECT user_id FROM counterflux.shared_users)
  ) WITH CHECK (
    user_id IN (SELECT user_id FROM counterflux.shared_users)
    AND auth.uid() IN (SELECT user_id FROM counterflux.shared_users)
  );

-- profile: NO CHANGES (per-user identity stays per-user)
