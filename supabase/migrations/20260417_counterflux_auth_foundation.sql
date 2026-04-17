-- Phase 10 Plan 1 — Counterflux Supabase auth foundation.
-- Mirrors Dexie v8 synced tables into a dedicated `counterflux` schema inside the
-- shared `huxley` project (D-01, D-02). RLS enforced on every table with
-- denormalised user_id policies + WITH CHECK on writes (D-23, D-24).
-- Every user_id column indexed (D-25; PITFALLS §2.4).

-- 1. Schema
CREATE SCHEMA IF NOT EXISTS counterflux;

-- Grant usage to the anon + authenticated Supabase roles so the client SDK can resolve the schema.
GRANT USAGE ON SCHEMA counterflux TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA counterflux TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA counterflux TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA counterflux GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA counterflux GRANT ALL ON SEQUENCES TO authenticated;

-- Expose the schema to PostgREST (required for supabase.schema('counterflux').from(...) to work).
-- Supabase reads this from the postgrest.conf; in the SQL editor we append via ALTER ROLE.
-- If the project already exposes counterflux, this is a no-op.
-- NOTE: If PostgREST is still returning PGRST106 after running this migration, set
-- Database → API → Exposed schemas = "public, counterflux" in the Supabase Dashboard UI.

-- 2. Tables (mirror Dexie v8 shape; payload fields are jsonb for flexibility — Phase 11 wires the writer)

CREATE TABLE IF NOT EXISTS counterflux.collection (
  id           text PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scryfall_id  text NOT NULL,
  category     text,
  foil         boolean DEFAULT false,
  quantity     integer DEFAULT 1,
  condition    text,
  language     text,
  notes        text,
  price_paid   numeric,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  synced_at    timestamptz
);

CREATE TABLE IF NOT EXISTS counterflux.decks (
  id            text PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  format        text,
  commander_id  text,
  colors        text,
  notes         text,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  synced_at     timestamptz
);

CREATE TABLE IF NOT EXISTS counterflux.deck_cards (
  id            text PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deck_id       text NOT NULL REFERENCES counterflux.decks(id) ON DELETE CASCADE,
  scryfall_id   text NOT NULL,
  quantity      integer DEFAULT 1,
  category      text,
  is_commander  boolean DEFAULT false,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  synced_at     timestamptz
);

CREATE TABLE IF NOT EXISTS counterflux.games (
  id                  text PRIMARY KEY,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deck_id             text,
  started_at          timestamptz,
  ended_at            timestamptz,
  players             jsonb,
  turn_laps           jsonb DEFAULT '[]'::jsonb,
  first_player_index  integer,
  winner_index        integer,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  synced_at           timestamptz
);

CREATE TABLE IF NOT EXISTS counterflux.watchlist (
  id            text PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scryfall_id   text NOT NULL,
  target_price  numeric,
  notes         text,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  synced_at     timestamptz,
  UNIQUE (user_id, scryfall_id)
);

CREATE TABLE IF NOT EXISTS counterflux.profile (
  id          text PRIMARY KEY,
  user_id     uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text,
  avatar_url  text,
  email_local text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 3. Indexes on every user_id (D-25; PITFALLS §2.4 — RLS on unindexed user_id times out at 1M rows)

CREATE INDEX IF NOT EXISTS idx_collection_user_id  ON counterflux.collection  (user_id);
CREATE INDEX IF NOT EXISTS idx_decks_user_id       ON counterflux.decks       (user_id);
CREATE INDEX IF NOT EXISTS idx_deck_cards_user_id  ON counterflux.deck_cards  (user_id);
CREATE INDEX IF NOT EXISTS idx_games_user_id       ON counterflux.games       (user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id   ON counterflux.watchlist   (user_id);
CREATE INDEX IF NOT EXISTS idx_profile_user_id     ON counterflux.profile     (user_id);

-- 4. Enable RLS on every table (PITFALLS §2 — default is OFF, must enable explicitly)

ALTER TABLE counterflux.collection  ENABLE ROW LEVEL SECURITY;
ALTER TABLE counterflux.decks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE counterflux.deck_cards  ENABLE ROW LEVEL SECURITY;
ALTER TABLE counterflux.games       ENABLE ROW LEVEL SECURITY;
ALTER TABLE counterflux.watchlist   ENABLE ROW LEVEL SECURITY;
ALTER TABLE counterflux.profile     ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies — SELECT + ALL with WITH CHECK (D-24). WITH CHECK is NON-NEGOTIABLE
--    per PITFALLS §2.2; without it authenticated users can spoof user_id on INSERT/UPDATE.

CREATE POLICY "users see own collection"    ON counterflux.collection FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users modify own collection" ON counterflux.collection FOR ALL    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users see own decks"         ON counterflux.decks      FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users modify own decks"      ON counterflux.decks      FOR ALL    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users see own deck_cards"    ON counterflux.deck_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users modify own deck_cards" ON counterflux.deck_cards FOR ALL    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users see own games"         ON counterflux.games      FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users modify own games"      ON counterflux.games      FOR ALL    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users see own watchlist"     ON counterflux.watchlist  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users modify own watchlist"  ON counterflux.watchlist  FOR ALL    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users see own profile"       ON counterflux.profile    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users modify own profile"    ON counterflux.profile    FOR ALL    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
