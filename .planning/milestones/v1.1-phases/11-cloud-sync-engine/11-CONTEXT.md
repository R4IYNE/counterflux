# Phase 11: Cloud Sync Engine - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the multi-device sync engine on top of the Phase 7 schema + Phase 10 identity layer. Counterflux becomes a "local-first with cloud mirror" app: writes hit Dexie first (instant), enqueue into `sync_queue`, flush to Supabase via outbox pattern; other devices pull via Supabase Realtime. First-sign-in reconciles local data with household cloud, never silently destroying data. Offline works; errors surface.

**In-scope (SYNC-01..07):**
- Dexie `table.hook('creating'|'updating'|'deleting')` taps that enqueue ops into `sync_queue` (synced tables: collection, decks, deck_cards, games, watchlist, profile)
- Sync engine push: batched RPC flush from `sync_queue` to Supabase with origin-tag idempotency
- Sync engine pull: Supabase Realtime `postgres_changes` subscription; `_suppressHooks` flag prevents pull-side writes from re-enqueuing
- First-sign-in reconciliation modal — 4 states (local/remote × empty/populated); populated/populated uses a global 3-button choice (MERGE / KEEP LOCAL / KEEP CLOUD)
- Conflict resolution: row-level LWW via `updated_at` with deck_cards atomic merge by (deck_id, scryfall_id); unresolvable conflicts surface in `sync_conflicts`
- Soft delete via `deleted_at` column + scheduled Supabase cleanup function (tombstone retention: 30 days)
- Offline queue: `sync_queue` survives reload (already Dexie-persisted), flushes automatically on reconnect, tagged with `user_id` at enqueue (refuses cross-user flush)
- Topbar sync-status chip (4 states: synced, syncing, offline, error) — replaces the existing connectivity chip
- Sync-errors modal (click on ERROR chip) — list failed entries with Retry/Discard per row

**Out of scope (Phase 12+):**
- Notification bell integration for sync errors (SYNC-08 — Phase 12)
- Realtime presence indicators ("Sharon is editing this deck")
- Per-field conflict UI (LWW is row-level in Phase 11)
- Sync history / undo / time-travel
- Multi-household support / invite flow (v2.0 commercial expansion)

**Key boundary:** Phase 11 assumes D-38 household model (James + Sharon in `counterflux.shared_users`) and D-40 auth-wall. The sync engine only runs while `auth.status === 'authed'`. Sign-out halts sync; re-sign-in resumes (household-scoped RLS means data is valid for either member).

</domain>

<decisions>
## Implementation Decisions

### Reconciliation modal (first-sign-in populated/populated)
- **D-01:** Single global choice. Modal presents exactly 3 buttons: `MERGE EVERYTHING` / `KEEP LOCAL` / `KEEP CLOUD`. Applied uniformly across all 5 synced tables. No per-table granularity, no diff-review mode (both deferred). Keeps cognitive load low; matches Phase 10 D-16..D-20 precedent (binary choice).
- **D-02:** `MERGE EVERYTHING` semantics = row-level LWW by `updated_at`. For a row existing on both sides, the side with the higher `updated_at` wins. Tie goes to cloud (household-authoritative default). Conflicts beyond LWW (e.g., deck_cards atomic-merge edge cases) surface in `sync_conflicts` for later user review. Aligned with ARCHITECTURE.md Pattern 3.
- **D-03:** Modal shows counts per table pre-choice. Summary grid: `Local: 45 cards, 3 decks, 10 games, 8 watchlist / Household (cloud): 120 cards, 8 decks, 15 games, 12 watchlist`. No sample rows, no conflict count (avoids slow overlap-scan pre-render). Enough for user to gauge scale of merge without overwhelming.
- **D-04:** **Full lockdown, non-dismissible.** No X button, no Escape key, no backdrop click close. User MUST pick one of the 3 options. Precedent: Phase 10 D-16 first-sign-in profile prompt + migration-blocked-modal pattern. Rationale: PITFALLS §3 — "never silently destroy data" — an accidental dismiss that defaults to something is worse than forced engagement.

### Household sync attribution (D-38 interaction)
- **D-05:** On update, `user_id` **stays with the original creator**. James editing Sharon's deck does NOT swap user_id to James. `updated_at` changes; `user_id` is stable for the row's lifetime. Simpler model, no schema change, RLS stays stable. Trade-off: "last edited by" is not tracked in Phase 11 (acceptable — nobody's asked for it yet). If needed later, add a separate `updated_by` column (deferred).
- **D-06:** Empty-local + populated-cloud case (Sharon signing in on a fresh device): **silent pull, no modal.** Nothing to destroy, decision is unambiguous. Chip flips to SYNCING during hydration; user lands on dashboard and household data populates via the bulk-pull splash (D-12). Aligned with "modal only when there's risk" philosophy.
- **D-07:** Same-household handoff (shared browser, James signs out → Sharon signs in): **local Dexie data stays.** Household members see the same data, so there's no reason to wipe. Sharon's sync engine starts and catches her up to cloud HEAD on next pull cycle. Aligned with Phase 10 D-22 (sign-out preserves local data).

### Sync status UX + error handling
- **D-08:** Topbar chip shows **icon + label only, no count**. Four states: `SYNCED` (check icon), `SYNCING…` (spinner), `OFFLINE` (cloud-off icon), `SYNC ERROR` (alert icon). Pending count shown on hover (tooltip). Matches existing connectivity-chip density; avoids clutter.
- **D-09:** Clicking the chip in ERROR state opens a new `sync-errors-modal.js`. Modal lists failed sync_queue entries — `table_name`, op (create/update/delete), error message, `detected_at` timestamp — each row has `Retry` + `Discard` buttons. Modal is dismissible (Escape, X, backdrop click). Follows `settings-modal.js` pattern.
- **D-10:** **Error classification per PITFALLS §9.** Transient errors (5xx, 429 rate-limit, network failures) retry with exponential backoff (3 attempts, 2s/4s/8s) while chip shows `SYNCING…`; chip never flips to ERROR for transients. Permanent errors (4xx: 400 validation, 403 RLS rejection, 409 conflict, 422 constraint) immediately dead-letter + flip chip to ERROR. User sees ERROR state only for actionable failures.
- **D-11:** Offline UX — **chip-only feedback.** No toast, no banner, no persistent modal. The chip flipping to `OFFLINE` is the single visual signal. Local writes still work via Dexie persistence; `sync_queue` accumulates entries; chip flips back to `SYNCING…` then `SYNCED` on reconnect. Minimal UI, matches user preference pattern from Phase 10.

### Pull strategy on new-device sign-in
- **D-12:** **Bulk pull with progress splash** (Phase 7 splash pattern) on first sign-in when local Dexie is empty for synced tables. Splash blocks app until pull completes. Parallel per-table pulls; chunked 500 rows per request (tunable — Claude's discretion). Copy: `Syncing household data… N / M cards` (Phase 7 style). For 5000 cards: ~15–30 seconds. Same UX precedent as bulk-data download.
- **D-13:** **Bulk pull failure → error splash + manual RETRY button.** Splash flips to `Sync failed. Check your connection and retry.` with a `RETRY` button. Partial pulls are preserved in Dexie (not rolled back — they're just fewer rows than the full household). App stays blocked until retry succeeds or user dismisses via a secondary `Continue with partial data` (TBD — planner's discretion on whether to offer a partial-ok escape path).
- **D-14:** **No skip option on the bulk pull splash.** The point of signing in is to get shared household data; skipping leaves the user with an empty app that claims to be synced. Matches D-40 auth-wall philosophy: if you're in, you're fully in.

### Deletion semantics
- **D-15:** **Soft delete via `deleted_at timestamptz NULL` column** on the 5 synced data tables (collection, decks, deck_cards, games, watchlist). Profile table excluded from deletes (per-user identity; sign-out preserves but never deletes the profile row). Delete operations set `deleted_at = now()`; row remains in Dexie and Supabase. Queries filter `WHERE deleted_at IS NULL`. LWW on deletions works cleanly: Sharon's stale local copy gets the tombstone applied on next pull, so the row removes locally too.
  - Schema migration: add `deleted_at timestamptz NULL` to 5 tables in both Dexie (schema v9) and Supabase (new migration).
  - Client query layer adds a soft-delete filter by default (all reads exclude `deleted_at IS NOT NULL`).
- **D-16:** **30-day tombstone retention, scheduled Supabase cleanup.** A `pg_cron` job (or Edge Function if pg_cron unavailable on the huxley tier) runs nightly and hard-deletes rows where `deleted_at < now() - interval '30 days'`. 30 days is enough time for any household device to have seen the tombstone at least once. One-time setup: create the cron job.

### Claude's Discretion
- Exact visual design of the 4-state chip — icons, colors, hover tooltip content (design contract in UI-SPEC)
- Exact copy/wording on reconciliation modal buttons (follow Mila brand voice established in Phase 10 D-16)
- Chunk size for bulk pull (500 suggested; tune based on row payload size)
- `sync_queue` retention policy after successful flush — delete immediately (default) vs keep for audit (deferred)
- `sync-errors-modal` layout specifics (list rendering, sort order by timestamp, per-row UI)
- Whether bulk-pull failure splash offers a `Continue with partial data` escape hatch (D-13 suggests manual RETRY only, but planner may decide partial-is-OK for resilience)
- Realtime subscription topology — 6 per-table channels vs 1 schema-wide channel (planner + researcher choice; Supabase quotas matter)
- `_suppressHooks` flag implementation — module-scoped boolean, AsyncLocalStorage, or promise-scoped
- Exponential backoff specifics (2s/4s/8s suggested, tunable)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/ROADMAP.md` §Phase 11 — goal + 5 success criteria
- `.planning/REQUIREMENTS.md` — SYNC-01 through SYNC-07 (SYNC-08 deferred to Phase 12)
- `.planning/PROJECT.md` — v1.1 "auth + cloud sync" is the largest scope addition

### Research (v1.1 Second Sunrise)
- `.planning/research/STACK.md` §Sync engine — roll-your-own rationale (RxDB/PowerSync/Triplit rejected); Dexie hook + outbox + Realtime; ~300–500 LOC custom code
- `.planning/research/ARCHITECTURE.md` Pattern 2 — Dexie hook → sync_queue → 500ms debounced flush; module-scoped `_suppressHooks` flag; origin tagging on push
- `.planning/research/ARCHITECTURE.md` Pattern 3 — Row-level LWW by `updated_at`; deck_cards atomic merge by (deck_id, scryfall_id); `sync_conflicts` for unresolvable cases
- `.planning/research/PITFALLS.md` §3 — First-sync wipe pattern (drives D-01..D-04)
- `.planning/research/PITFALLS.md` §4 — Sync-loop avoidance (origin tagging + `_suppressHooks` + rate-limit safety net)
- `.planning/research/PITFALLS.md` §5 — Conflict resolution patterns
- `.planning/research/PITFALLS.md` §7 — Cross-user queue contamination (drives user_id-tagged queue + refuse-cross-user-flush)
- `.planning/research/PITFALLS.md` §9 — Stuck queue / error classification (drives D-10)
- `.planning/research/FEATURES.md` §Auth/Sync — UX decisions for sync indicator, offline writes

### Prior phase context
- `.planning/phases/07-polish-pass-perf-baseline-schema-migration/07-CONTEXT.md` — Dexie v8 schema (sync_queue, sync_conflicts, profile, user_id + updated_at + synced_at on synced tables)
- `.planning/phases/10-supabase-auth-foundation/10-CONTEXT.md` D-38 — **Household model (shared_users table + is_household_member SECURITY DEFINER function)**. Sync engine must honour household-scope semantics: RLS allows both household members to see/modify each other's rows.
- `.planning/phases/10-supabase-auth-foundation/10-CONTEXT.md` D-22 — Sign-out preserves local Dexie data; D-29 lazy-load; D-30 auth store contract
- `.planning/phases/10-supabase-auth-foundation/10-CONTEXT.md` D-40 — Auth-wall boot gate. Sync engine never runs pre-auth; initializes only when `auth.status === 'authed'`.
- `.planning/phases/10-supabase-auth-foundation/10-UI-SPEC.md` — Neo-Occult Terminal design tokens; modal patterns

### Supabase migrations (live on huxley)
- `supabase/migrations/20260417_counterflux_auth_foundation.sql` — `counterflux` schema, 6 tables with user_id + updated_at + synced_at, RLS scaffolding
- `supabase/migrations/20260418_counterflux_shared_users_household.sql` — household model seed (James + Sharon in shared_users)
- `supabase/migrations/20260418_counterflux_household_rls_fix_recursion.sql` — `is_household_member(uuid)` SECURITY DEFINER function; household-scoped RLS on all 5 data tables; profile retains per-user RLS

### Existing code references
- `src/db/schema.js` — Dexie v8 schema; UUID_TABLES list + creating hooks (Phase 7 groundwork). Phase 11 adds v9 (deleted_at column + new hooks for sync_queue enqueue).
- `src/services/supabase.js` — Singleton getSupabase() lazy-loaded via auth.js dynamic import; PKCE + `detectSessionInUrl: true` (post-D-40 fix)
- `src/stores/auth.js` — `Alpine.store('auth')` shape, `init()` flow, `_subscribeToStateChanges` single-subscription pattern
- `src/utils/connectivity.js` — Existing `getConnectivityStatus(isOnline, bulkDataUpdatedAt)`. Phase 11 extends or parallels with `getSyncStatus()` returning synced/syncing/offline/error.
- `src/components/migration-blocked-modal.js` — Vanilla-DOM blocking modal template (Phase 7). Reconciliation modal follows this pattern.
- `src/components/first-sign-in-prompt.js` — Phase 10 lockdown modal with 2-button forced choice. Reconciliation modal's lockdown (D-04) follows this exactly.
- `src/components/settings-modal.js` — Dismissible modal pattern. Sync-errors modal follows this.
- `src/components/auth-wall.js` — Full-screen Alpine.effect-driven gate. Sync engine initializes AFTER this dismisses.
- `src/main.js` — Alpine.effect that opens auth-wall on anonymous; similar pattern can trigger reconciliation modal on first authed sign-in when populated local + populated cloud detected.

### External docs
- Supabase Realtime — https://supabase.com/docs/guides/realtime/postgres-changes (postgres_changes subscription, quotas)
- Supabase RPC / Edge Functions — for tombstone cleanup cron
- pg_cron — https://supabase.com/docs/guides/database/extensions/pg_cron (if huxley tier supports it)
- Dexie hooks — https://dexie.org/docs/Table/Table.hook('creating') + updating/deleting variants
- Supabase PostgREST upsert — https://supabase.com/docs/reference/javascript/upsert (batched writes for sync push)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/db/schema.js` v8 foundation** — `sync_queue(++id, table_name, user_id, created_at)`, `sync_conflicts(++id, table_name, detected_at)`, `profile(id, user_id, updated_at)` already declared. All 5 synced tables have `user_id`, `updated_at`, `synced_at` columns. UUID auto-assign hooks installed on 6 tables (collection, decks, deck_cards, games, watchlist, profile). Phase 11 adds v9: `deleted_at timestamptz NULL` column on 5 tables + sync-queueing hooks.
- **`src/services/supabase.js`** — Singleton, lazy-loaded, `.schema('counterflux').from()` access pattern proven by Phase 10 profile writes.
- **`src/utils/connectivity.js`** — Online/offline detection already wired. Phase 11 adds a parallel `getSyncStatus()` for the 4-state sync chip, composing `isOnline` with sync engine's internal state.
- **`src/components/migration-blocked-modal.js`** — Vanilla-DOM blocking modal template. Reconciliation modal (D-01..D-04) follows this exactly.
- **`src/components/first-sign-in-prompt.js`** — Phase 10 lockdown pattern with Escape/backdrop disabled. Reconciliation modal inherits the lockdown mechanism.
- **`src/components/settings-modal.js`** — Dismissible modal template. Sync-errors modal (D-09) follows this.
- **`src/stores/auth.js` `Alpine.effect` subscription pattern** — Phase 10 D-40 auth-wall + Phase 10 Plan 4's profile.hydrate() both use this. Phase 11 adds a third effect: when `auth.status` flips to `'authed'`, initialize the sync engine + run reconciliation check.
- **`src/main.js`** — Boot order is the contract. Sync engine init slots AFTER `auth-wall` closes (status → 'authed') and AFTER `profile.hydrate()` resolves.

### Established Patterns
- **Vanilla-DOM modals over Alpine templates** (Phase 10 proved this works well for auth flows)
- **Module-scoped singletons** (supabase.js client, auth.js module cache, Phase 11 sync engine follows this)
- **Alpine.store reactive state + Alpine.effect for cross-store coordination** (auth → profile hydration, auth → wall; Phase 11: auth → sync engine init)
- **Lazy-loaded services** (AUTH-01 lazy-load discipline — sync engine continues this; never blocks anonymous boot)
- **RLS at Postgres layer, not client** (client just calls `.schema('counterflux').from(...).upsert()`; RLS filters server-side via `is_household_member`)

### Integration Points
- **`src/main.js`** — Add `Alpine.effect` that starts the sync engine on first `auth.status === 'authed'` transition (after bulk-data download, after profile hydrate)
- **`src/db/schema.js` v9** — Add `deleted_at` column + sync-queueing hooks (`creating`, `updating`, `deleting`) to the 5 synced tables
- **`src/stores/`** — NEW: `src/stores/sync.js` — Alpine store with `{ status, pending_count, last_error, last_synced_at, init(), flush(), retry(id), discard(id) }`
- **`src/services/`** — NEW: `src/services/sync-engine.js` — push/pull/flush core logic; module-scoped `_suppressHooks` flag; debounced flush scheduler
- **`src/services/`** — NEW: `src/services/sync-reconciliation.js` — 4-state detection + modal orchestration on first authed sign-in
- **`src/services/`** — NEW: `src/services/sync-pull.js` — bulk pull with progress events for the splash (Phase 7 splash pattern reused)
- **`src/components/`** — NEW: `src/components/reconciliation-modal.js` — the lockdown 3-button modal (D-01..D-04)
- **`src/components/`** — NEW: `src/components/sync-errors-modal.js` — dismissible list of failed entries (D-09)
- **`src/components/`** — NEW: `src/components/sync-pull-splash.js` — bulk-pull progress UI (D-12..D-14)
- **Topbar** — MODIFIED: existing connectivity chip replaced with sync-status chip driven by `Alpine.store('sync').status` (D-08)

### Not Reusable (anti-patterns to avoid)
- **Don't use onAuthStateChange alone to detect session creation during callback** — Phase 10 PKCE fix polls getSession(). Phase 11 can rely on the post-D-40 auth store that correctly sets `status = 'authed'` via Alpine.effect in main.js; don't re-subscribe redundantly.
- **Don't synchronously block on network in the sync engine** — everything goes through the queue. Writes return immediately once enqueued; the engine flushes in the background.
- **Don't hard-delete rows in client code** — always soft-delete (set `deleted_at`). Hard delete is the cleanup cron's job only.

</code_context>

<specifics>
## Specific Ideas

- **"Never silently destroy data" is the safety net** — drives D-01..D-04 (reconciliation modal lockdown) and D-15 (soft delete with tombstone).
- **Household-first, user-scoped-queue** — sync_queue entries tagged with `auth.uid()` at enqueue; the engine refuses to flush entries if the current user doesn't match (PITFALLS §7). D-05 means rows attribution stays with creator, but the queue itself is per-current-user.
- **Phase 10 D-40 auth-wall is the initialization gate** — sync engine doesn't exist pre-auth. This is a natural fit with AUTH-01 lazy-load (Supabase client loads on sign-in, sync engine initializes on first auth-post-wall transition).
- **Bulk pull reuses Phase 7 splash** — don't reinvent the progress UI. Counterflux already has a bulk-data splash pattern; sync-pull-splash is the same component with different data source.
- **deck_cards atomic merge is the one special case** — all other tables use row-level LWW. deck_cards treats each row as atomic (delete + re-insert on conflict) rather than merging columns. Documented in ARCHITECTURE.md Pattern 3.
- **Realtime subscription topology is planner/researcher's choice** — there's a tradeoff between 6 per-table channels (granular, possibly over-quota) vs 1 schema-wide channel (simpler, but Supabase may route differently). Research should surface quota limits before planning locks this.
- **Reconciliation modal is UX-critical** — the ONE screen where an accidental dismiss could cause 5000 cards of data loss. Non-dismissibility (D-04) is non-negotiable. Testing this path (D-01..D-04) is the milestone's load-bearing guardrail similar to how D-37 RLS isolation was for Phase 10.

</specifics>

<deferred>
## Deferred Ideas

- **Notification bell integration for sync errors** — SYNC-08, explicitly in Phase 12.
- **Realtime presence** ("Sharon is editing this deck right now") — v1.2+.
- **Per-field conflict UI** — Phase 11 uses row-level LWW. Field-level conflict resolution is a more complex UX pattern, deferred.
- **Sync history / undo / time-travel** — no version retention beyond the `deleted_at` tombstone; rollback is out of scope.
- **Offline-only toggle** — currently local-first auto-queues. Deferred; user doesn't explicitly opt into offline mode.
- **`updated_by` column for last-editor attribution** — D-05 keeps `user_id` as creator; `updated_by` is a future schema addition if needed.
- **Diff-review reconciliation mode** — row-by-row conflict prompts. Considered in Area 1, rejected as too exhausting for 100+ row scenarios. Deferred.
- **Per-table reconciliation granularity** — considered in Area 1, rejected. Deferred to future phase if user needs emerge.
- **Partial pull / page-on-demand** — Phase 11 does full bulk pull. Lazy per-screen hydration is deferred (complex state machine per table).
- **Skip option on bulk-pull splash** — considered in Area 4, rejected. Deferred.
- **Multi-household support + invite flow** — Counterflux is a private app (household = James + Sharon only). Commercial expansion (v2.0) might add this.
- **Realtime postgres_changes for Phase 12 market data** — specific sync for price_history table, separate concern.
- **Sync analytics / telemetry** — out of scope for v1.1; would revisit alongside PostHog/similar in v1.2+.

### Reviewed Todos (not folded)
_None — `todo match-phase 11` returned zero matches._

</deferred>

---

*Phase: 11-cloud-sync-engine*
*Context gathered: 2026-04-18*
