-- ============================================================================
-- Counterflux Phase 10.1 — Fix infinite recursion in household RLS
-- ============================================================================
-- Applied to huxley: 2026-04-18
-- Migration name (Supabase): counterflux_household_rls_fix_recursion
-- Ran AFTER: 20260418_counterflux_shared_users_household.sql
--
-- Bug discovered when running tests/rls-isolation.test.js:
--   The shared_users RLS SELECT policy self-referenced counterflux.shared_users
--   (via `auth.uid() IN (SELECT user_id FROM counterflux.shared_users)`).
--   When the 5 data-table policies subqueried shared_users for authorization,
--   that subquery triggered shared_users RLS → another subquery on
--   shared_users → Postgres error 42P17 "infinite recursion detected in
--   policy for relation".
--
-- Fix:
--   Introduce a SECURITY DEFINER function counterflux.is_household_member(uuid)
--   that bypasses RLS for the single membership check (it runs as the
--   function owner, typically postgres, which is RLS-exempt). Pinned
--   search_path = '' closes the function_search_path_mutable advisor warning
--   and forces fully-qualified references inside the function body.
--
--   All 6 RLS policies (5 data tables + shared_users itself) now call the
--   function instead of embedding raw subqueries, breaking the recursion.
--
-- Trade-off considered but rejected:
--   Making shared_users RLS check `auth.role() = 'authenticated'` would
--   leak membership UUIDs to any authenticated user. For 2 users forever,
--   negligible; for future multi-household expansion, unacceptable.
--   SECURITY DEFINER keeps the list private to members only.
--
-- Verification after migration (tests/rls-isolation.test.js):
--   - 10/10 tests pass against live huxley
--   - All outsider SELECT/INSERT/UPDATE/DELETE paths denied
--   - Denial manifests as either 42501 permission (anon has no table grants)
--     OR empty-array RLS filter (for authenticated outsiders, if any existed)
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1. Helper function — bypasses RLS to check household membership
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION counterflux.is_household_member(check_uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER       -- runs as function owner; bypasses shared_users RLS
STABLE                 -- planner hint: result stable within a statement
SET search_path = ''   -- pin search_path (closes function_search_path_mutable advisor)
AS $$
  SELECT EXISTS(SELECT 1 FROM counterflux.shared_users WHERE user_id = check_uid);
$$;

GRANT EXECUTE ON FUNCTION counterflux.is_household_member(uuid) TO authenticated, anon;

-- -----------------------------------------------------------------------------
-- 2. Replace recursive shared_users policy with function-based lookup
-- -----------------------------------------------------------------------------
DROP POLICY "members see the list" ON counterflux.shared_users;
CREATE POLICY "members see the list" ON counterflux.shared_users
  FOR SELECT USING (counterflux.is_household_member(auth.uid()));

-- -----------------------------------------------------------------------------
-- 3. Replace data-table policies to use the SECURITY DEFINER function
-- -----------------------------------------------------------------------------

-- collection
DROP POLICY "household sees collection" ON counterflux.collection;
DROP POLICY "household modifies collection" ON counterflux.collection;

CREATE POLICY "household sees collection" ON counterflux.collection
  FOR SELECT USING (
    counterflux.is_household_member(user_id)
    AND counterflux.is_household_member(auth.uid())
  );

CREATE POLICY "household modifies collection" ON counterflux.collection
  FOR ALL USING (
    counterflux.is_household_member(user_id)
    AND counterflux.is_household_member(auth.uid())
  ) WITH CHECK (
    counterflux.is_household_member(user_id)
    AND counterflux.is_household_member(auth.uid())
  );

-- decks
DROP POLICY "household sees decks" ON counterflux.decks;
DROP POLICY "household modifies decks" ON counterflux.decks;

CREATE POLICY "household sees decks" ON counterflux.decks
  FOR SELECT USING (
    counterflux.is_household_member(user_id)
    AND counterflux.is_household_member(auth.uid())
  );

CREATE POLICY "household modifies decks" ON counterflux.decks
  FOR ALL USING (
    counterflux.is_household_member(user_id)
    AND counterflux.is_household_member(auth.uid())
  ) WITH CHECK (
    counterflux.is_household_member(user_id)
    AND counterflux.is_household_member(auth.uid())
  );

-- deck_cards
DROP POLICY "household sees deck_cards" ON counterflux.deck_cards;
DROP POLICY "household modifies deck_cards" ON counterflux.deck_cards;

CREATE POLICY "household sees deck_cards" ON counterflux.deck_cards
  FOR SELECT USING (
    counterflux.is_household_member(user_id)
    AND counterflux.is_household_member(auth.uid())
  );

CREATE POLICY "household modifies deck_cards" ON counterflux.deck_cards
  FOR ALL USING (
    counterflux.is_household_member(user_id)
    AND counterflux.is_household_member(auth.uid())
  ) WITH CHECK (
    counterflux.is_household_member(user_id)
    AND counterflux.is_household_member(auth.uid())
  );

-- games
DROP POLICY "household sees games" ON counterflux.games;
DROP POLICY "household modifies games" ON counterflux.games;

CREATE POLICY "household sees games" ON counterflux.games
  FOR SELECT USING (
    counterflux.is_household_member(user_id)
    AND counterflux.is_household_member(auth.uid())
  );

CREATE POLICY "household modifies games" ON counterflux.games
  FOR ALL USING (
    counterflux.is_household_member(user_id)
    AND counterflux.is_household_member(auth.uid())
  ) WITH CHECK (
    counterflux.is_household_member(user_id)
    AND counterflux.is_household_member(auth.uid())
  );

-- watchlist
DROP POLICY "household sees watchlist" ON counterflux.watchlist;
DROP POLICY "household modifies watchlist" ON counterflux.watchlist;

CREATE POLICY "household sees watchlist" ON counterflux.watchlist
  FOR SELECT USING (
    counterflux.is_household_member(user_id)
    AND counterflux.is_household_member(auth.uid())
  );

CREATE POLICY "household modifies watchlist" ON counterflux.watchlist
  FOR ALL USING (
    counterflux.is_household_member(user_id)
    AND counterflux.is_household_member(auth.uid())
  ) WITH CHECK (
    counterflux.is_household_member(user_id)
    AND counterflux.is_household_member(auth.uid())
  );

-- profile: NO CHANGES (still per-user, no household reference)
