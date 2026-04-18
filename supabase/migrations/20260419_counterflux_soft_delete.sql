-- ============================================================================
-- Counterflux Phase 11 Plan 1 — Soft-delete column (D-15)
-- ============================================================================
-- Mirrors Dexie v10 additive migration: adds `deleted_at timestamptz NULL`
-- to the 5 synced data tables. Profile is EXCLUDED per D-15 (sign-out
-- preserves; never deletes — profile rows are per-user identity, not
-- user-generated content).
--
-- A partial index `WHERE deleted_at IS NULL` speeds up live-row scans
-- (the default read path — the client soft-delete filter excludes
-- tombstoned rows). At current 2-user household scale this is a minor
-- optimisation, but it ships now so 11-04's incremental pull uses
-- the index automatically.
--
-- Applied via 11-SYNC-PREFLIGHT.md checklist (human action — Task 5).
-- Rollback: ALTER TABLE ... DROP COLUMN deleted_at; (drops index automatically).
-- ============================================================================

-- 1. Add deleted_at column on the 5 synced data tables (profile excluded per D-15)
ALTER TABLE counterflux.collection   ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
ALTER TABLE counterflux.decks        ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
ALTER TABLE counterflux.deck_cards   ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
ALTER TABLE counterflux.games        ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
ALTER TABLE counterflux.watchlist    ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
-- profile EXCLUDED per D-15

-- 2. Partial indexes on (updated_at) WHERE deleted_at IS NULL.
--    Rationale: the incremental pull query in Plan 11-04 is
--      SELECT * FROM counterflux.<table>
--      WHERE deleted_at IS NULL AND updated_at > $since
--    Indexing updated_at over live rows keeps it cheap once households grow.
--    (Index name = idx_<table>_deleted_at_live for easy identification in
--    pg_indexes — the "live" suffix signals the partial-index semantics.)
CREATE INDEX IF NOT EXISTS idx_collection_deleted_at_live ON counterflux.collection (updated_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_decks_deleted_at_live      ON counterflux.decks      (updated_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deck_cards_deleted_at_live ON counterflux.deck_cards (updated_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_games_deleted_at_live      ON counterflux.games      (updated_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_watchlist_deleted_at_live  ON counterflux.watchlist  (updated_at) WHERE deleted_at IS NULL;
