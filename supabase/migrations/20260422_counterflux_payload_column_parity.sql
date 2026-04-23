-- Phase 14.5 — payload-to-schema column parity for counterflux.* tables.
-- Closes Phase 11's latent schema drift: the Dexie v8 local schema and the
-- client store .add()/.update() payloads reference columns that were never
-- added to the Supabase mirror in 20260417_counterflux_auth_foundation.sql.
-- The drift stayed latent through Phase 11 testing because happy-path tests
-- only exercised the minimal subset of columns. Live UAT on 2026-04-22
-- surfaced it: 848 deck_cards dead-lettered with PGRST204 "Could not find
-- the 'sort_order' column of 'deck_cards' in the schema cache".
--
-- Strategy: additive-only. Use ADD COLUMN IF NOT EXISTS so the migration is
-- idempotent and safe to re-run. No drops, no type changes, no data writes.
-- Columns are nullable with sensible defaults where the client expects one.

-- collection
ALTER TABLE counterflux.collection
  ADD COLUMN IF NOT EXISTS added_at timestamptz;

-- decks — the largest drift (client carries deck-builder metadata the server
-- schema never modelled: commander partner/companion, deck_size, color_identity,
-- per-deck tags for the tag-panel grouping, separate created_at vs updated_at).
ALTER TABLE counterflux.decks
  ADD COLUMN IF NOT EXISTS deck_size integer,
  ADD COLUMN IF NOT EXISTS partner_id text,
  ADD COLUMN IF NOT EXISTS companion_id text,
  ADD COLUMN IF NOT EXISTS color_identity text[],
  ADD COLUMN IF NOT EXISTS tags text[],
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

-- deck_cards — the UAT-triggering offender. tags[] = Recursion/Ramp/Removal
-- classification, sort_order = stable display order within a tag group.
ALTER TABLE counterflux.deck_cards
  ADD COLUMN IF NOT EXISTS tags text[],
  ADD COLUMN IF NOT EXISTS sort_order integer;

-- games — saveGame() persists replay metadata the server never modelled.
-- elimination_order is nullable (only recorded for multi-player pods).
ALTER TABLE counterflux.games
  ADD COLUMN IF NOT EXISTS turn_count integer,
  ADD COLUMN IF NOT EXISTS elimination_order jsonb,
  ADD COLUMN IF NOT EXISTS active_player_index integer;

-- watchlist — alert configuration columns the market store writes on every add.
ALTER TABLE counterflux.watchlist
  ADD COLUMN IF NOT EXISTS added_at timestamptz,
  ADD COLUMN IF NOT EXISTS alert_type text,
  ADD COLUMN IF NOT EXISTS alert_threshold numeric,
  ADD COLUMN IF NOT EXISTS last_alerted_at timestamptz;

-- profile: no drift — nothing writes to profile locally yet (Phase 10 wired
-- the table shape; consumer code arrives in v1.2).
