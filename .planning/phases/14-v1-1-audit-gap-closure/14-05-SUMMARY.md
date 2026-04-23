---
plan: 14-05
phase: 14
status: partial
completed: 2026-04-22
type: gap_closure
---

# Plan 14-05 Summary — Supabase column parity fix

## What was built

A single additive Supabase migration — `supabase/migrations/20260422_counterflux_payload_column_parity.sql` — that adds the 16 columns the Dexie-side stores write but that the Phase 10 `counterflux_auth_foundation.sql` migration never modelled.

### Columns added

| Table | Columns added | Rationale |
|-------|---------------|-----------|
| `collection` | `added_at timestamptz` | `src/stores/collection.js:156` writes ISO timestamp on add. |
| `decks` | `deck_size integer`, `partner_id text`, `companion_id text`, `color_identity text[]`, `tags text[]`, `created_at timestamptz` | `src/stores/deck.js:56` builds the commander-partner-companion metadata + deck-level tag list. |
| `deck_cards` | `tags text[]`, `sort_order integer` | `src/stores/deck.js:166` writes per-card tag classification and stable display order within a tag group. **This was the PGRST204 offender on the 2026-04-22 UAT.** |
| `games` | `turn_count integer`, `elimination_order jsonb`, `active_player_index integer` | `src/stores/game.js:364` writes replay metadata on `saveGame()`. |
| `watchlist` | `added_at timestamptz`, `alert_type text`, `alert_threshold numeric`, `last_alerted_at timestamptz` | `src/stores/market.js:110` writes alert configuration on every watchlist add. |

14 `ADD COLUMN IF NOT EXISTS` statements total (the grouped syntax lets `decks` and `watchlist` add multiple columns per ALTER). Idempotent — safe to re-run in any environment. No drops, no type changes, no data writes.

### How this surfaced

Plan 14-01's live-UAT checkpoint is what exposed the drift. The 14-01 spread-and-stamp fix was genuinely working — `payload.user_id = currentUserId` stamping made user_id reach the server, clearing the 23502 NOT NULL failure mode. Supabase then rejected the upsert at the next layer (PostgREST schema cache), which was the *actual* reason sync had been broken silently since Phase 11 deployment.

848 dead-letter `sync_conflicts` entries confirmed the scale: every deck edit on the v1.1 branch since Phase 11 had failed in one of the two ways, then dead-lettered. Fixing user_id just revealed the schema drift underneath.

### Deploy sequence

1. File committed at `supabase/migrations/20260422_counterflux_payload_column_parity.sql`.
2. Applied to huxley Supabase via Dashboard SQL Editor at ~22:48 UTC on 2026-04-22 (Supabase MCP was timing out when the user first tried; MCP came back online under the `supabase-huxley` namespace after the manual apply and was used to verify the columns).
3. `NOTIFY pgrst, 'reload schema';` refreshed PostgREST's schema cache.
4. Verification via MCP: `SELECT column_name FROM information_schema.columns WHERE table_schema='counterflux' AND column_name IN (...);` returned 16 matching rows + 1 unrelated `shared_users.added_at` that predates this migration.
5. Dead-letter cleanup: during diagnosis the 848 `sync_conflicts` entries were cleared in DevTools via `await db.sync_conflicts.clear(); await db.sync_queue.clear();` — they were stale replays of the failing writes, not new data. Source-of-truth rows in `db.collection`/`db.decks`/`db.deck_cards` were untouched.

## Status

**Partial.** Task 1 (migration file written, applied, verified) is complete. Task 2 (live UAT re-run + Phase 11 HUMAN-UAT flip) is still pending — the user needs to add a card, confirm sync lands clean, and flip the Non-Visual Live-Supabase Gate annotation.

## Files touched

- `supabase/migrations/20260422_counterflux_payload_column_parity.sql` — new, 14 ALTER COLUMN statements.

## Self-Check

- [x] Migration is additive-only (no DROP / DELETE / destructive SQL)
- [x] Migration is idempotent (`ADD COLUMN IF NOT EXISTS`)
- [x] All 14 ALTER lines accounted for by at least one client write path (grepped each new column back to its `db.<table>.add()` or `db.<table>.update()` call site)
- [x] Server schema verified aligned post-apply (via Supabase MCP query)
- [ ] Live UAT re-run (Task 2) — pending user action

## Deviations

- **Plan expansion mid-execution.** Phase 14 was scoped for 3 gaps. The UAT surfaced a 4th latent issue that met the bar for "blocking v1.1 ship" (848 failed writes per active user). Per user decision ("just fix as part of 14"), scope was expanded inline with a new 14-05 plan rather than deferred to v1.2 or spun into a separate 14.1 phase. GSD plan-phase would normally rebel against this; it was the correct call given the severity.
- **Migration applied via Dashboard, not MCP.** Supabase MCP was timing out at the moment the migration needed to land. User applied via Dashboard SQL Editor; MCP came back online afterwards and was used for verification only.
- **Dead-letter replay snippet had a bug.** First replay snippet set `user_id: c.payload?.user_id ?? null` on the sync_queue rows. Since `flushQueue()` filters by `user_id` on the queue row, and payloads never carry user_id (stamped at push time), all 848 replayed entries were invisible to the flush. Corrected by prompting the user to `.modify({ user_id: userId })` on the null-user_id rows, then superseded by the clean `sync_queue.clear()` path once it became clear the replayed data wasn't worth preserving.
