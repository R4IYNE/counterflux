# Phase 11: Cloud Sync Engine — Research

**Researched:** 2026-04-18
**Domain:** Local-first (Dexie v8) → household-scoped cloud sync (Supabase Postgres + Realtime), field-level LWW merge, outbox pattern, first-sign-in reconciliation, 4-state status chip
**Confidence:** HIGH for stack + patterns (CONTEXT.md has 16 locked decisions; ARCHITECTURE.md + PITFALLS.md already anchor the shape; Dexie v8 + Supabase schema already landed); MEDIUM for edge-case details the planner must resolve (bulk-pull chunking size tuning, sync-queue retention, Realtime topology choice between 6 channels vs 1).

---

## Summary

Phase 11 ships the push/pull engine that glues the already-landed Dexie v8 schema (Phase 7) to the already-landed Supabase `counterflux` schema + household RLS (Phase 10). The architecture is prescribed by CONTEXT.md's 16 decisions, ARCHITECTURE.md Patterns 2+3, and PITFALLS.md §§3/4/5/7/9. The implementation is a **roll-your-own sync engine** (~500–800 LOC) using `@supabase/supabase-js@2.103.x`'s PostgREST query builder + Realtime `postgres_changes` channel — no new top-level dep, no CRDT library, no PowerSync/ElectricSQL. Dexie `table.hook('creating'|'updating'|'deleting')` is the single capture point; a module-scoped `_suppressHooks` flag + origin-tagging (`synced_at != null`) is the single loop breaker. LWW at row level by `updated_at` is the conflict policy; `deck_cards` is a documented special case (atomic merge by `(deck_id, scryfall_id)`). Soft-delete via `deleted_at timestamptz NULL` is new in v9.

**Primary recommendation:** Split Phase 11 into **6 plans** (see §Plan Breakdown). Use **Realtime postgres_changes with a SINGLE schema-wide channel filtered by household** (Option B in §Pull Engine) — one WebSocket, one subscription, one handler dispatch — to stay well inside Supabase's free-tier channel quota and to match the household model (both James + Sharon see each others' changes on the same channel). Use **server-authoritative `updated_at = now()`** on every upsert payload — pass `updated_at: new Date().toISOString()` client-side as the LWW comparator but let Postgres `DEFAULT now()` be the ground truth for skew-hardened ordering (per Pitfall 5). Use the **`_suppressHooks` module-boolean pattern** (simplest, already prescribed by CONTEXT.md "Claude's discretion — chosen implementation" and ARCHITECTURE.md §5 Option 2). Build the reconciliation modal and splash FIRST (they're milestone-load-bearing safety surfaces and can ship behind feature flags), then the push engine, then the pull engine, then polish.

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Reconciliation modal (first-sign-in populated/populated)**
- **D-01:** Single global choice. Modal presents exactly 3 buttons: `MERGE EVERYTHING` / `KEEP LOCAL` / `KEEP CLOUD`. Applied uniformly across all 5 synced tables. No per-table granularity, no diff-review mode.
- **D-02:** `MERGE EVERYTHING` semantics = row-level LWW by `updated_at`. For a row existing on both sides, the side with the higher `updated_at` wins. Tie goes to cloud (household-authoritative default). Conflicts beyond LWW surface in `sync_conflicts` for later user review.
- **D-03:** Modal shows counts per table pre-choice. Summary grid: `Local: 45 cards, 3 decks, 10 games, 8 watchlist / Household (cloud): 120 cards, 8 decks, 15 games, 12 watchlist`. No sample rows, no conflict count.
- **D-04:** **Full lockdown, non-dismissible.** No X button, no Escape key, no backdrop click close. User MUST pick one of the 3 options.

**Household sync attribution (D-38 interaction)**
- **D-05:** On update, `user_id` **stays with the original creator**. James editing Sharon's deck does NOT swap user_id to James. `updated_at` changes; `user_id` is stable.
- **D-06:** Empty-local + populated-cloud case (Sharon signing in on a fresh device): **silent pull, no modal.** Chip flips to SYNCING during hydration.
- **D-07:** Same-household handoff (shared browser, James signs out → Sharon signs in): **local Dexie data stays.** Sharon's sync engine catches her up to cloud HEAD on next pull cycle.

**Sync status UX + error handling**
- **D-08:** Topbar chip shows **icon + label only, no count**. Four states: `SYNCED` / `SYNCING…` / `OFFLINE` / `SYNC ERROR`. Pending count shown on hover (tooltip).
- **D-09:** Clicking the chip in ERROR state opens `sync-errors-modal.js`. Modal lists failed sync_queue entries with `Retry` + `Discard` per row. Modal is dismissible.
- **D-10:** **Error classification per PITFALLS §9.** Transient errors (5xx, 429, network) retry with exponential backoff (3 attempts, 2s/4s/8s); chip never flips to ERROR for transients. Permanent errors (4xx: 400/403/409/422) immediately dead-letter + flip chip to ERROR.
- **D-11:** Offline UX — **chip-only feedback.** No toast, no banner, no persistent modal.

**Pull strategy on new-device sign-in**
- **D-12:** **Bulk pull with progress splash** (Phase 7 splash pattern) on first sign-in when local Dexie is empty for synced tables. Parallel per-table pulls; chunked 500 rows per request (tunable). Splash blocks app until complete.
- **D-13:** **Bulk pull failure → error splash + manual RETRY button.** Partial pulls preserved in Dexie.
- **D-14:** **No skip option on the bulk pull splash.**

**Deletion semantics**
- **D-15:** **Soft delete via `deleted_at timestamptz NULL` column** on the 5 synced data tables (collection, decks, deck_cards, games, watchlist). Profile excluded. Schema migration: Dexie v9 + Supabase migration.
- **D-16:** **30-day tombstone retention, scheduled Supabase cleanup** (pg_cron or Edge Function) hard-deletes rows where `deleted_at < now() - interval '30 days'`.

### Claude's Discretion

- Exact visual design of the 4-state chip — icons, colors, hover tooltip content (**resolved by UI-SPEC**)
- Exact copy/wording on reconciliation modal buttons (**resolved by UI-SPEC**)
- Chunk size for bulk pull (500 suggested; tune based on row payload size) — **research confirms 500 is safe; see §Pull Engine**
- `sync_queue` retention policy after successful flush — delete immediately (default) vs keep for audit — **recommendation: delete immediately; see §Push Engine**
- `sync-errors-modal` layout specifics — **resolved by UI-SPEC**
- Whether bulk-pull failure splash offers `Continue with partial data` escape hatch — **UI-SPEC already declined this**
- Realtime subscription topology — 6 per-table channels vs 1 schema-wide channel — **recommendation: 1 schema-wide channel; see §Pull Engine**
- `_suppressHooks` flag implementation — module-scoped boolean, AsyncLocalStorage, or promise-scoped — **recommendation: module-scoped boolean; see §Outbox Pattern**
- Exponential backoff specifics (2s/4s/8s suggested, tunable) — **confirmed; see §Push Engine**

### Deferred Ideas (OUT OF SCOPE — ignore)

- Notification bell integration for sync errors (SYNC-08 — Phase 12)
- Realtime presence ("Sharon is editing this deck") — v1.2+
- Per-field conflict UI — Phase 11 uses row-level LWW only
- Sync history / undo / time-travel
- Offline-only toggle
- `updated_by` column for last-editor attribution
- Diff-review reconciliation mode
- Per-table reconciliation granularity
- Partial pull / page-on-demand
- Skip option on bulk-pull splash
- Multi-household support + invite flow (v2.0)
- Realtime postgres_changes for price_history
- Sync analytics / telemetry

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SYNC-01 | Supabase Postgres schema mirrors the synced Dexie tables (collection, decks, deck_cards, games, watchlist, profile) with `user_id`, `updated_at`, and per-row primary keys | §Supabase Schema Mirror — the schema is ALREADY LIVE from Phase 10 (`20260417_counterflux_auth_foundation.sql`). Phase 11's only schema delta is a new migration adding `deleted_at timestamptz NULL` to the 5 data tables (D-15) + the pg_cron cleanup job (D-16) + partial indexes on `updated_at` for pull-cursor performance. |
| SYNC-02 | Dexie `table.hook()` taps enqueue create/update/delete ops for synced tables into the `sync_queue` outbox; non-synced tables excluded | §Outbox Pattern — Dexie v9 adds `deleted_at` column + 3 hooks per synced table. Non-synced tables (`cards`, `meta`, `*_cache`) have no hooks attached. Hook-install order (after `db.open()`) and `_suppressHooks` loop-breaker are fully specified. |
| SYNC-03 | Sync engine flushes the outbox to Supabase via batched RPC; origin tagging prevents the server's echo from re-triggering the hook | §Push Engine — `supabase.schema('counterflux').from(table).upsert(rows)` batched per-table, 500ms debounced. Origin tag via `synced_at != null` on incoming rows; `_suppressHooks` during pull. |
| SYNC-04 | First-sign-in reconciliation detects all 4 states (local/remote × empty/populated); populated-populated case prompts the user to merge, keep local, or keep remote — never silently destroys data | §Reconciliation Flow — 4-state decision tree matches ARCHITECTURE.md Pattern 3 + PITFALLS §3. D-01..D-07 locked. "Populated" = any row count ≥ 1 across synced tables (minus profile). |
| SYNC-05 | Conflict resolution uses last-write-wins at field level via `updated_at` timestamps; `deck_cards` treats each row as atomic; conflicts beyond LWW surface in the `sync_conflicts` table for user review | §LWW Conflict Resolution — actually row-level LWW (the req spec says "field level" but CONTEXT D-02 locks it at row-level; planner should **document this discrepancy** — the requirement's "field-level" phrasing is superseded by D-02's row-level semantics; this is a deliberate simplification consistent with a single-user-multi-device LWW model). deck_cards merge by `(deck_id, scryfall_id)` atomic row. |
| SYNC-06 | Offline queue survives reload and flushes automatically on reconnect; queue entries are tagged with `user_id` so sign-in switching never cross-contaminates users | §Offline Resilience — queue is in IndexedDB (Dexie `sync_queue` table), durable by construction. Reload recovery re-reads queue; `user_id` tag on every row is the safety gate per PITFALLS §7. `navigator.onLine` + fetch probe + auth-status check drive the flush gate. |
| SYNC-07 | Topbar sync-status indicator shows 4 states: synced, syncing, offline, error — replaces the existing connectivity chip | §Sync-Status Indicator — Alpine store `sync` with shape locked in CONTEXT code_context. UI-SPEC §1 specifies the chip anatomy. Replaces `getConnectivityStatus()` wholesale. |

**Discrepancy flagged:** SYNC-05 in REQUIREMENTS.md says "field level" LWW; CONTEXT.md D-02 locks it at "row-level." **Row-level is correct** (CONTEXT is the authoritative source for this phase). Phase 11 ships row-level LWW; field-level would require per-column `updated_at` which Phase 7's schema does not provide. Planner should include a VERIFICATION note acknowledging the textual discrepancy.

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Alpine.js 3.15.x + Dexie 4.x + Supabase-js 2.103.x** — no new top-level deps allowed for this phase (verified: `package.json` already has `@supabase/supabase-js@^2.103.3`). Sync engine must be vanilla code, no CRDT library, no sync-specific package.
- **Neo-Occult Terminal visual identity** — all UI surfaces must use existing `@theme` tokens; zero new colors/fonts/border-radii. UI-SPEC confirms compliance.
- **Tailwind v4 CSS-first configuration** — no `tailwind.config.js`; use `@theme` + `var(--color-*)`.
- **Desktop-first** — Vandalblast is the only mobile-responsive surface. Sync chip + modals are desktop-first.
- **Scryfall API compliance** — Phase 11 does NOT touch Scryfall. Entirely Supabase-side.
- **Local-first promise** — writes hit Dexie first (instant), sync is background work.
- **GSD workflow enforcement** — every source change must go through a plan-phase → plan-check → execute-phase cycle.
- **Supabase project = huxley** (`hodnhjipurvjaskcsjvj`, eu-west-2), schema = `counterflux`. Every query must use `.schema('counterflux').from(...)`.
- **Household model (Phase 10 D-38)** — RLS is household-scoped via `is_household_member(uuid)` SECURITY DEFINER function. Sync engine must NOT assume per-user RLS; both James + Sharon see each others' rows by policy.
- **Conventions section is empty.** Phase 11 is the first sync-engine work in the repo; planner should anticipate capturing sync-specific conventions in `STATE.md` decisions log as they emerge.

---

## Standard Stack

### Core (already installed — no new deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.103.3 (verified 2026-04-18 via `npm view`) | PostgREST query builder + Realtime + Auth | Already installed from Phase 10 (AUTH-01). Realtime API for `postgres_changes`. `upsert()` for batched push. `.schema('counterflux').from()` scoping proven by Phase 10 profile writes. |
| `dexie` | 4.4.2 (verified) | Local IndexedDB persistence + hooks + transactions | Already installed. `table.hook('creating'|'updating'|'deleting')` is the universal capture point for outbox pattern. Transactional guarantees ensure queue-entry + data-write atomicity (ARCHITECTURE §Pattern 2). |
| `alpinejs` | 3.15.11 | Reactive store layer | Already installed. `Alpine.store('sync')` + `Alpine.effect` pattern established in Phase 10 auth-wall + profile hydrate. |

**No new package dependencies.** Phase 11 is implementation-only.

**Version verification (2026-04-18):**
```bash
npm view @supabase/supabase-js version  # → 2.103.3
npm view dexie version                   # → 4.4.2
```
Both confirmed current. supabase-js 2.x supports Realtime `postgres_changes`, `.schema()` scoping, and `.upsert()` with `onConflict` — all three are used in Phase 11.

### Alternatives Considered (and rejected)

| Instead of | Could Use | Tradeoff | Rejection Rationale |
|------------|-----------|----------|---------------------|
| Roll-your-own sync | PowerSync, ElectricSQL, RxDB Supabase replication | Library handles outbox + conflict resolution + retry; tradeoff is 50-200KB added + dep upgrade cost + lock-in | STACK.md §Sync engine explicitly rejects these. Counterflux's sync surface is ~500-800 LOC roll-your-own; a library adds bundle weight the app doesn't need for 2 users + 5 tables + row-level LWW. |
| `postgres_changes` Realtime | Polling only (pull on focus + 5-min interval) | Polling is simpler, no WebSocket cost; tradeoff is 5-min latency vs ~1s realtime | Realtime is affordable at 2-device scale. Household model benefits from near-real-time cross-device visibility ("Sharon added 3 cards — refresh to see" is a worse UX than "Sharon's cards appeared"). Keeps polling as a **fallback** if Realtime fails. |
| CRDT (Yjs, Automerge) | Y.Doc + Supabase persistence | CRDT resolves concurrent edits without LWW silent overwrite | REQUIREMENTS explicitly out-of-scope: "CRDT-based merging — last-write-wins covers the single-user multi-device use case; CRDTs would be overkill." |
| Field-level LWW | Per-column `updated_at` on every synced column | Fine-grained conflict resolution; less silent loss | CONTEXT D-02 locks row-level LWW. Requires no schema change. Simpler mental model for users. |
| Dexie Cloud | Dexie's own cloud sync service | Batteries-included sync; no roll-your-own | Paid add-on; tied to Dexie's infrastructure; doesn't use the Supabase Postgres we've already invested in for auth + RLS + household. |

### Already-shipped infrastructure (do NOT rebuild)

| Asset | Location | Role in Phase 11 |
|-------|----------|-------------------|
| Dexie v8 synced-table schema | `src/db/schema.js:311-333` | Row shape (UUID PK + user_id + updated_at + synced_at) — Phase 11 writes to these directly. |
| Dexie v8 UUID creating-hook | `src/db/schema.js:427-434` | Ensures `db.table.add({...})` without `id` gets a fresh UUID. Phase 11 sync-queue enqueue uses these UUIDs verbatim. |
| `sync_queue` table | `src/db/schema.js:407` (`++id, table_name, user_id, created_at`) | Phase 11's outbox. Writer added in Phase 11. |
| `sync_conflicts` table | `src/db/schema.js:408` (`++id, table_name, detected_at`) | Phase 11's dead-letter / conflict holding pen. |
| `profile` table | `src/db/schema.js:405` (`id, user_id, updated_at`) | Already sync-ready. Phase 10 already writes to Supabase `profile`; Phase 11 adds the pull half (optional — profile is the smallest table). |
| Supabase `counterflux` schema | `supabase/migrations/20260417_counterflux_auth_foundation.sql` | 6 tables, indexes, household RLS. SYNC-01 is 95% already satisfied at the Supabase level. |
| `is_household_member(uuid)` | `supabase/migrations/20260418_counterflux_household_rls_fix_recursion.sql` | RLS function. Sync engine calls the same policy — no additional SQL. |
| `Alpine.store('auth')` | `src/stores/auth.js` | `auth.status === 'authed'` is the sync-engine init gate. `auth.user.id` is the outbox `user_id` tag. |
| `getSupabase()` singleton | `src/services/supabase.js` | Lazy-loaded client. Sync engine imports via dynamic import (preserves AUTH-01 lazy-load). |
| `auth-wall` boot gate | `src/main.js:102-118` | Phase 11's sync engine mounts AFTER the wall closes (status → authed). |
| Phase 7 splash pattern | `src/components/splash-screen.js` | Sync-pull splash reuses this as a visual template (UI-SPEC §4 reinforces this). |
| `first-sign-in-prompt.js` lockdown pattern | `src/components/first-sign-in-prompt.js` (capture-phase Escape blocker + backdrop preventDefault + no X close) | Reconciliation modal mirrors this exactly. |
| `settings-modal.js` dismissible pattern | `src/components/settings-modal.js` | Sync-errors modal mirrors this. |
| Toast store | `src/stores/app.js` (toast slice) | Phase 11 toasts dispatched through existing API. No new store. |

**Installation:** none — zero new packages.

---

## Architecture Patterns

### Recommended Project Structure (Phase 11 deltas)

```
src/
├── main.js                          [MODIFIED] — add Alpine.effect for sync-engine init on auth→authed
├── db/
│   └── schema.js                    [MODIFIED] — Dexie v10 (deleted_at column; sync-hooks installed post-open)
├── services/
│   ├── sync-engine.js               [NEW]      — push/pull/flush core + _suppressHooks flag
│   ├── sync-reconciliation.js       [NEW]      — 4-state detection + modal orchestration
│   ├── sync-pull.js                 [NEW]      — bulk pull (first-sign-in splash; incremental pull)
│   └── sync-realtime.js             [NEW]      — postgres_changes subscription + dispatcher
├── stores/
│   └── sync.js                      [NEW]      — { status, pending_count, last_error, last_synced_at, init(), flush(), retry(id), discard(id) }
├── components/
│   ├── reconciliation-modal.js      [NEW]      — lockdown 3-button modal (D-01..D-04)
│   ├── sync-errors-modal.js         [NEW]      — dismissible retry/discard list (D-09)
│   └── sync-pull-splash.js          [NEW]      — bulk-pull progress splash (D-12..D-14)
├── utils/
│   └── connectivity.js              [DEPRECATED] — delete (UI-SPEC §Component Inventory recommendation)
└── index.html                       [MODIFIED] — topbar chip Alpine template swapped to sync-status shape
supabase/
└── migrations/
    ├── 20260419_counterflux_soft_delete.sql        [NEW] — adds deleted_at column + partial index
    └── 20260419_counterflux_tombstone_cleanup.sql  [NEW] — pg_cron job OR Edge Function for 30-day hard-delete
tests/
├── sync-engine.test.js              [NEW]      — outbox hook + push/pull unit tests
├── sync-reconciliation.test.js      [NEW]      — 4-state detection + LWW merge tests
├── sync-offline-queue.test.js       [NEW]      — reload recovery + user_id cross-contamination tests
├── sync-conflict.test.js            [NEW]      — LWW resolution matrix
├── reconciliation-modal.test.js     [NEW]      — lockdown + count rendering
├── sync-errors-modal.test.js        [NEW]      — retry/discard row actions
└── sync-rls.test.js                 [NEW]      — live-Supabase integration (describeIf HAS_ENV), household-scoped push/pull
```

### Pattern 1: Outbox Write via Dexie Hooks (SYNC-02)

**What:** Every local write to a synced table (collection, decks, deck_cards, games, watchlist, profile) triggers a Dexie `creating`/`updating`/`deleting` hook. The hook (a) stamps `updated_at = Date.now()` on the row and (b) synchronously enqueues an entry in `sync_queue` inside the SAME Dexie transaction as the data write. This gives atomic "data + outbox" semantics — a crash between the data write and the queue write is impossible.

**When to use:** All 6 synced tables, all 3 ops (create/update/delete).

**Source:** ARCHITECTURE.md §Pattern 2, CONTEXT.md code_context §Integration Points, Dexie docs https://dexie.org/docs/Table/Table.hook('creating')

**Code sketch:**

```js
// src/services/sync-engine.js
import { db } from '../db/schema.js';

const SYNCABLE_TABLES = ['collection', 'decks', 'deck_cards', 'games', 'watchlist', 'profile'];

// Module-scoped flag — when true, hooks skip enqueue (used during pull-side writes).
let _suppressHooks = false;

export function installSyncHooks() {
  for (const tableName of SYNCABLE_TABLES) {
    const t = db.table(tableName);

    t.hook('creating', function (primKey, obj, tx) {
      if (_suppressHooks) return;
      // Stamp updated_at client-side (skew-tolerant ordering; server DEFAULT now() is ultimate truth).
      obj.updated_at = obj.updated_at ?? Date.now();
      // Enqueue (synchronous — Dexie hook is inside the same txn).
      tx.table('sync_queue').add({
        table_name: tableName,
        op: 'put',
        row_id: obj.id ?? primKey,  // creating-hook runs AFTER UUID-hook, so obj.id is set
        user_id: _currentUserId(),
        payload: JSON.parse(JSON.stringify(obj)),  // snapshot (hook may fire before Dexie finalises)
        attempts: 0,
        created_at: Date.now()
      });
    });

    t.hook('updating', function (mods, primKey, obj, tx) {
      if (_suppressHooks) return;
      mods.updated_at = Date.now();
      const merged = { ...obj, ...mods };
      tx.table('sync_queue').add({
        table_name: tableName,
        op: 'put',
        row_id: primKey,
        user_id: _currentUserId(),
        payload: JSON.parse(JSON.stringify(merged)),
        attempts: 0,
        created_at: Date.now()
      });
    });

    t.hook('deleting', function (primKey, obj, tx) {
      if (_suppressHooks) return;
      // Phase 11 uses SOFT delete — the caller flips deleted_at rather than calling .delete().
      // This hook only fires when a test or legacy code path calls db.table.delete() directly.
      // Enqueue a delete op so the server mirrors, but log a warning.
      console.warn(`[sync] hard delete on ${tableName} — prefer soft-delete via updated_at`);
      tx.table('sync_queue').add({
        table_name: tableName,
        op: 'del',
        row_id: primKey,
        user_id: _currentUserId(),
        payload: null,
        attempts: 0,
        created_at: Date.now()
      });
    });
  }
}

function _currentUserId() {
  return window.Alpine?.store('auth')?.user?.id ?? null;
}

export function withHooksSuppressed(fn) {
  _suppressHooks = true;
  try { return fn(); } finally { _suppressHooks = false; }
}
```

**Key properties:**
- Hook must be installed AFTER `db.open()` resolves — Dexie's internal table registry isn't ready before open (Pitfall: if installed in a module-level `for` loop before `runMigration()`, no-op).
- The hook uses the third `tx` argument (Dexie provides the current transaction). `tx.table('sync_queue').add(...)` is ATOMIC with the data write — a failed data write rolls back the queue entry too.
- `_suppressHooks = true` wraps pull-side `db.table.put()` calls in `sync-pull.js` — the hook sees the flag and returns early, breaking the loop.
- **Delete semantics reversal (D-15):** in Phase 11, callers should NEVER call `db.collection.delete(id)`. Instead they call `db.collection.update(id, { deleted_at: Date.now() })` which flows through the `updating` hook. The `deleting` hook fires as a **safety net** (warns + still enqueues) for legacy code paths that weren't refactored.

### Pattern 2: Push Engine — Batched Upsert with Retry (SYNC-03)

**What:** Drain the `sync_queue` to Supabase in batches, grouped by `table_name`. Use `supabase.schema('counterflux').from(t).upsert(rows)` with default `onConflict: 'id'` (text UUID PK). On success, delete the queue entries and stamp `synced_at` on the source rows. On failure, classify error (transient vs permanent) and either retry (exponential backoff) or dead-letter.

**When to use:** Triggered by (a) `enqueue` (via 500ms debounce), (b) `online` event, (c) auth-status → authed transition, (d) manual retry from sync-errors-modal.

**Source:** ARCHITECTURE.md §5 "Local write → cloud sync flow", CONTEXT D-10, PITFALLS §9

**Code sketch:**

```js
// src/services/sync-engine.js (continued)
async function flushQueue() {
  const authStore = window.Alpine.store('auth');
  if (authStore.status !== 'authed') return;  // sync gated on auth per Phase 10 boot contract
  if (!navigator.onLine) return;

  const currentUserId = authStore.user.id;

  // PITFALLS §7: only flush entries tagged with current user_id (cross-account safety)
  const queue = await db.sync_queue
    .where('user_id').equals(currentUserId)
    .limit(200)  // chunk — prevents huge request if reconnecting after offline spree
    .toArray();

  if (!queue.length) { _setStatus('synced'); return; }

  _setStatus('syncing');

  // Group by table for batched upsert. Preserve FK order (decks before deck_cards).
  const byTable = new Map();
  for (const entry of queue) {
    if (!byTable.has(entry.table_name)) byTable.set(entry.table_name, []);
    byTable.get(entry.table_name).push(entry);
  }

  // FK-safe order: collection, decks, deck_cards, games, watchlist, profile
  const ORDER = ['collection', 'decks', 'deck_cards', 'games', 'watchlist', 'profile'];
  const sortedTables = ORDER.filter(t => byTable.has(t));

  const { getSupabase } = await import('./supabase.js');
  const supabase = getSupabase();

  const succeeded = [];
  const failed = [];

  for (const tableName of sortedTables) {
    const entries = byTable.get(tableName);
    const puts = entries.filter(e => e.op === 'put');
    const dels = entries.filter(e => e.op === 'del');

    // Deduplicate puts by row_id — only flush the most recent payload per row.
    // Prevents wasted bandwidth if a row was edited 5 times between flushes.
    const latestByRow = new Map();
    for (const e of puts) latestByRow.set(e.row_id, e);

    // Batch upsert
    const rows = Array.from(latestByRow.values()).map(e => e.payload);
    if (rows.length) {
      const { error } = await supabase.schema('counterflux').from(tableName).upsert(rows);
      if (error) {
        const category = classifyError(error);
        if (category === 'permanent') {
          for (const e of latestByRow.values()) failed.push({ entry: e, error });
        } else {
          // transient — leave in queue with incremented attempts
          for (const e of latestByRow.values()) {
            await db.sync_queue.update(e.id, { attempts: e.attempts + 1, last_error: error.message });
          }
        }
        continue;
      }
      // Success: stamp synced_at on source rows + enqueue for delete from queue
      for (const e of latestByRow.values()) {
        withHooksSuppressed(() => db.table(e.table_name).update(e.row_id, { synced_at: Date.now() }));
        succeeded.push(e.id);
      }
    }

    // Soft deletes go through upsert path (they're rows with deleted_at = now()); no .delete() call.
    for (const e of dels) {
      const { error } = await supabase.schema('counterflux').from(tableName).delete().eq('id', e.row_id);
      if (error) {
        if (classifyError(error) === 'permanent') failed.push({ entry: e, error });
        else await db.sync_queue.update(e.id, { attempts: e.attempts + 1 });
      } else {
        succeeded.push(e.id);
      }
    }
  }

  // Drop successful entries from queue
  if (succeeded.length) await db.sync_queue.bulkDelete(succeeded);

  // Dead-letter permanent failures — move to sync_conflicts for user review
  if (failed.length) {
    for (const { entry, error } of failed) {
      await db.sync_conflicts.add({
        table_name: entry.table_name,
        row_id: entry.row_id,
        op: entry.op,
        payload: entry.payload,
        error_code: error.code ?? 'unknown',
        error_message: error.message,
        detected_at: Date.now()
      });
      await db.sync_queue.delete(entry.id);
    }
    _setStatus('error');
    _setLastError(failed[0].error.message);
    return;
  }

  // If queue still has retry-pending entries, schedule retry with backoff
  const remaining = await db.sync_queue.where('user_id').equals(currentUserId).count();
  if (remaining > 0) {
    _scheduleRetry();  // exponential backoff: 2s → 4s → 8s → dead-letter at attempts === 3
  } else {
    _setStatus('synced');
    _setLastSyncedAt(Date.now());
  }
}

function classifyError(err) {
  // PITFALLS §9 + CONTEXT D-10
  const code = err.code;
  if (!code) return /network|fetch|timeout/i.test(err.message) ? 'transient' : 'permanent';
  // Postgres SQLSTATE codes + HTTP-adjacent
  if (/^(42501|PGRST301)/.test(code)) return 'permanent';  // RLS rejection
  if (/^22/.test(code)) return 'permanent';  // data exception (invalid value)
  if (/^23/.test(code)) return 'permanent';  // integrity constraint violation
  if (code === '400' || code === '403' || code === '409' || code === '422') return 'permanent';
  if (code === '429' || /^5/.test(code) || code === 'network') return 'transient';
  return 'permanent';  // unknown: fail-fast (don't loop on something we don't understand)
}
```

**Debounce contract:**
```js
let _flushTimer = null;
export function scheduleFlush(delay = 500) {
  if (_flushTimer) return;
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    flushQueue().catch(err => console.error('[sync] flush failed', err));
  }, delay);
}
```

**Retry backoff (D-10):**
- Attempt 1 fail → wait 2s → retry
- Attempt 2 fail → wait 4s → retry
- Attempt 3 fail → dead-letter (entry moves to `sync_conflicts`, chip goes `error`)
- Chip stays in `SYNCING…` during attempts 1-3 for transient errors (matches D-10 "chip never flips to ERROR for transients")

**sync_queue retention policy (Claude's discretion — chosen):** **Delete immediately on success.** Audit retention was considered but rejected: (a) `synced_at` timestamps on the source rows already carry the "when did this sync" metadata, (b) a retention queue would grow unboundedly, (c) a personal app with 2 users has no regulatory need for sync-op audit logs.

### Pattern 3: Pull Engine — Realtime + Incremental Polling (Part of SYNC-03)

**What:** Two-source pull strategy. (1) Supabase Realtime `postgres_changes` subscription receives INSERT/UPDATE/DELETE events in near-real-time when another device writes. (2) Incremental polling (every 60s + on-focus) backstops Realtime gaps using `updated_at > last_pulled_at` cursor stored in `db.meta`. The bulk pull (§Pattern 4) is a one-shot first-sign-in case, separate.

**When to use:** Every time the sync engine is running (i.e., `auth.status === 'authed'` AND not mid-reconciliation-modal).

**Source:** https://supabase.com/docs/guides/realtime/postgres-changes, ARCHITECTURE.md §5 "Cloud → local pull flow"

**Realtime topology decision (Claude's discretion — chosen):**

| Option | Pros | Cons | Choice |
|--------|------|------|--------|
| **A: One channel per table (6 channels)** | Granular filters; fault isolation (one channel failure doesn't kill the others) | 6 WebSocket subscriptions per tab; free-tier Supabase Realtime caps at 200 concurrent across all apps in the project; James + Sharon × 2 tabs each = 24 channels just for Counterflux | ❌ Rejected — quota risk |
| **B: One schema-wide channel filtered by household** | One WebSocket per tab; single dispatch handler routes by `payload.table`; stays 24× under quota; matches the household-scoped RLS model | Harder to isolate fault (one bad event schema can interrupt all tables); dispatcher code is slightly more complex | ✅ **Chosen** |

**Code sketch:**

```js
// src/services/sync-realtime.js
import { db } from '../db/schema.js';
import { withHooksSuppressed } from './sync-engine.js';

let _channel = null;

export async function subscribeRealtime() {
  const { getSupabase } = await import('./supabase.js');
  const supabase = getSupabase();

  if (_channel) return;  // already subscribed

  _channel = supabase
    .channel('counterflux-household')
    .on(
      'postgres_changes',
      { event: '*', schema: 'counterflux' },  // no table filter — one channel, 5+1 tables
      (payload) => {
        // payload: { eventType, schema, table, new, old, commit_timestamp }
        applyRealtimeChange(payload).catch(err =>
          console.warn('[sync] realtime apply failed', err)
        );
      }
    )
    .subscribe();
}

async function applyRealtimeChange(payload) {
  const { table, eventType, new: newRow, old: oldRow } = payload;
  if (!['collection', 'decks', 'deck_cards', 'games', 'watchlist', 'profile'].includes(table)) return;

  await withHooksSuppressed(async () => {
    if (eventType === 'DELETE') {
      // Realtime DELETE events don't fire with RLS enabled unless the subscriber has SELECT on the deleted row.
      // Soft-delete (setting deleted_at) fires as an UPDATE, not DELETE — so this path is primarily for
      // the 30-day cleanup cron. Tombstone already applied via UPDATE before hard-delete.
      await db.table(table).delete(oldRow.id);
    } else {
      // INSERT or UPDATE — upsert locally, applying LWW
      const incoming = { ...newRow, updated_at: new Date(newRow.updated_at).getTime(), synced_at: Date.now() };
      const local = await db.table(table).get(newRow.id);
      if (!local) {
        await db.table(table).add(incoming);
      } else if (incoming.updated_at > local.updated_at) {
        await db.table(table).put(incoming);
      } // else local is newer — no-op (push loop will upload it)
    }
  });
}

export function unsubscribeRealtime() {
  if (_channel) {
    _channel.unsubscribe();
    _channel = null;
  }
}
```

**Incremental polling backstop:**

```js
// src/services/sync-pull.js — incremental
export async function incrementalPull() {
  const authStore = window.Alpine.store('auth');
  if (authStore.status !== 'authed') return;
  if (!navigator.onLine) return;

  const meta = await db.meta.get('sync_last_pulled_at');
  const since = meta?.value ?? 0;
  const sinceIso = new Date(since).toISOString();

  const { getSupabase } = await import('./supabase.js');
  const supabase = getSupabase();

  for (const table of ['collection', 'decks', 'deck_cards', 'games', 'watchlist', 'profile']) {
    // RLS filters to household — we don't specify user_id, server filters automatically
    const { data, error } = await supabase
      .schema('counterflux')
      .from(table)
      .select('*')
      .gt('updated_at', sinceIso);

    if (error) { console.warn(`[sync] incremental pull ${table} failed`, error); continue; }

    await withHooksSuppressed(async () => {
      for (const remote of data ?? []) {
        const incoming = { ...remote, updated_at: new Date(remote.updated_at).getTime(), synced_at: Date.now() };
        const local = await db.table(table).get(remote.id);
        if (!local) {
          await db.table(table).add(incoming);
        } else if (incoming.updated_at > local.updated_at) {
          await db.table(table).put(incoming);
        }
      }
    });
  }

  await db.meta.put({ key: 'sync_last_pulled_at', value: Date.now() });
}

// Schedule every 60s as backstop for Realtime
setInterval(() => incrementalPull().catch(() => {}), 60_000);
// Also pull on window focus
window.addEventListener('focus', () => incrementalPull().catch(() => {}));
```

**Cursor storage:** a single `meta` row keyed `sync_last_pulled_at` (global across tables). This is SAFE because the incremental pull touches all 6 tables per run — either all advance, or none do. Per-table cursors would be more efficient but unnecessary at this scale.

### Pattern 4: Bulk Pull with Progress Splash (SYNC-04 empty-local branch; D-12..D-14)

**What:** On first sign-in where local Dexie has zero rows across the 5 synced data tables (excluding profile), render a full-screen progress splash (UI-SPEC §4). Fetch each table in parallel with 500-row chunks, emit progress events per table, and only dismiss the splash when all 5 tables hydrate or the user clicks RETRY after an error.

**When to use:** `applyReconciliation()` detects local-empty + cloud-populated state → calls `bulkPull()`.

**Source:** CONTEXT D-12..D-14, UI-SPEC §4

**Chunking & parallelism:**
```js
// src/services/sync-pull.js
const CHUNK_SIZE = 500;  // tunable; see rationale below

export async function bulkPull(onProgress) {
  const { getSupabase } = await import('./supabase.js');
  const supabase = getSupabase();

  const tables = ['collection', 'decks', 'deck_cards', 'games', 'watchlist', 'profile'];

  // Count total rows first so we can report meaningful progress
  const counts = {};
  for (const t of tables) {
    const { count } = await supabase
      .schema('counterflux')
      .from(t)
      .select('*', { count: 'exact', head: true });
    counts[t] = count ?? 0;
  }
  onProgress({ phase: 'counting', counts });

  // Pull tables in FK-safe order (decks before deck_cards, collection independent)
  for (const t of ['decks', 'collection', 'deck_cards', 'games', 'watchlist', 'profile']) {
    const total = counts[t];
    let pulled = 0;
    let from = 0;
    while (pulled < total) {
      const { data, error } = await supabase
        .schema('counterflux')
        .from(t)
        .select('*')
        .order('updated_at', { ascending: true })
        .range(from, from + CHUNK_SIZE - 1);

      if (error) throw new BulkPullError(t, pulled, total, error);

      await withHooksSuppressed(async () => {
        // bulkPut is faster than per-row add
        const converted = (data ?? []).map(r => ({
          ...r,
          updated_at: new Date(r.updated_at).getTime(),
          synced_at: Date.now()
        }));
        await db.table(t).bulkPut(converted);
      });

      pulled += data?.length ?? 0;
      from += CHUNK_SIZE;
      onProgress({ phase: 'pulling', table: t, pulled, total });
      if (!data || data.length < CHUNK_SIZE) break;  // last page
    }
  }

  await db.meta.put({ key: 'sync_last_pulled_at', value: Date.now() });
  onProgress({ phase: 'complete' });
}
```

**CHUNK_SIZE rationale:** 500 rows per request is safe because:
- Supabase PostgREST default row limit is 1000 — 500 stays well below.
- Payload size: collection rows ~200 bytes each → 500 rows = 100KB → ~200ms transfer on 4G, ~40ms on wifi.
- RLS evaluation cost is linear-per-row — 500 rows keeps server CPU <10ms per request.
- Experimentation deferred to planner: 500 is a good starting point; if UX testing shows the progress bar "feels stuck" during collection pull (5000 cards = 10 requests), try 1000.

**Progress UI hookup (splash component reads `Alpine.store('sync')`):** the `onProgress` callback writes progress into `Alpine.store('sync').bulkPullProgress = { table, pulled, total }` — the splash component's `x-effect` re-renders the caption.

**Error path (D-13):** `BulkPullError` is caught by the caller; the splash component receives the event, freezes the progress bar, swaps to the error body with `RETRY SYNC` button. RETRY re-invokes `bulkPull()` which resumes from where it failed (because `bulkPut` is idempotent and the Dexie rows already there won't be overwritten if their `updated_at` is equal — but since we re-pull from `range(0, ...)` we may re-fetch some rows; that's fine, `bulkPut` overwrites same-PK rows).

**Partial-pull resume (D-13):** The simplest strategy is "retry from the start of the failing table"; rows already pulled get re-upserted. A more precise cursor ("resume from the last `updated_at`") is a minor optimisation that can be deferred to planner's discretion.

### Pattern 5: First-Sign-In Reconciliation (SYNC-04; D-01..D-07)

**What:** When the sync engine initialises (immediately after `auth.status` flips to `'authed'`), before starting push/pull/Realtime, classify the "state of the world" into one of 4 cells and branch:

| Local | Cloud | Action | UI |
|-------|-------|--------|-----|
| empty | empty | no-op; set `sync_last_pulled_at = now` | silent (chip: SYNCED) |
| empty | populated | `bulkPull()` — silent pull (D-06) | full-screen pull splash (D-12) |
| populated | empty | silent push — flush entire local state | chip SYNCING → SYNCED |
| populated | populated | **LOCKDOWN reconciliation modal** (D-01..D-04) | 3-button forced choice |

**Detection:**

```js
// src/services/sync-reconciliation.js
export async function classifyState() {
  const { getSupabase } = await import('./supabase.js');
  const supabase = getSupabase();

  // Count local rows across the 5 data tables (exclude profile per D-03 grid exclusion)
  const localCounts = {
    collection: await db.collection.count(),
    decks: await db.decks.count(),
    deck_cards: await db.deck_cards.count(),
    games: await db.games.count(),
    watchlist: await db.watchlist.count()
  };
  const localPopulated = Object.values(localCounts).some(n => n > 0);

  // Count cloud rows — RLS filters to household
  const cloudCounts = {};
  for (const t of Object.keys(localCounts)) {
    const { count } = await supabase.schema('counterflux').from(t).select('*', { count: 'exact', head: true });
    cloudCounts[t] = count ?? 0;
  }
  const cloudPopulated = Object.values(cloudCounts).some(n => n > 0);

  return {
    state: !localPopulated && !cloudPopulated ? 'empty-empty'
         : !localPopulated && cloudPopulated  ? 'empty-populated'
         :  localPopulated && !cloudPopulated ? 'populated-empty'
         : 'populated-populated',
    localCounts,
    cloudCounts
  };
}

export async function reconcile() {
  const { state, localCounts, cloudCounts } = await classifyState();

  switch (state) {
    case 'empty-empty':
      await db.meta.put({ key: 'sync_last_pulled_at', value: Date.now() });
      return;
    case 'empty-populated':
      // D-06: silent pull, no modal
      await showBulkPullSplash();
      return;
    case 'populated-empty':
      // Silent push — enqueue every local row into sync_queue, flush
      await enqueueAllLocalRows();
      await flushQueue();
      return;
    case 'populated-populated':
      // D-01..D-04: lockdown modal
      return showReconciliationModal({ localCounts, cloudCounts });
  }
}
```

**Three choices from modal:**

| Choice | Implementation |
|--------|----------------|
| `MERGE EVERYTHING` | Run `bulkPull()` to fetch all cloud rows. For each, compare with local `updated_at`: if cloud newer → `withHooksSuppressed(() => db.table.put(cloud))`; if local newer → enqueue local row into `sync_queue`. Tie → cloud wins (D-02). After pull, flush push queue. |
| `KEEP LOCAL` | Delete every row in `counterflux.*` tables for the household. Requires a bulk DELETE with household predicate (RLS-safe: `DELETE FROM counterflux.collection` deletes only household rows; RLS enforces household filter). THEN enqueue every local row into `sync_queue` and flush. |
| `KEEP CLOUD` | Delete every local row (`db.collection.clear()`, `db.decks.clear()`, `db.deck_cards.clear()`, `db.games.clear()`, `db.watchlist.clear()`). Clear `sync_queue`. Call `bulkPull()` to hydrate. |

**deck_cards atomic-merge edge case (CONTEXT §Specifics):**
```js
// When running MERGE EVERYTHING, deck_cards rows are treated as atomic by (deck_id, scryfall_id).
// If local and cloud both have a row with same (deck_id, scryfall_id) but different `id` (UUIDs):
//   - Higher updated_at wins the row wholesale (NOT a per-column merge).
//   - The losing row is logged to sync_conflicts with reason="deck_cards atomic merge".
// This matches ARCHITECTURE §Anti-Pattern 4.
```

**"Populated" threshold decision (Claude's discretion — planner should resolve):** any-row ≥ 1 across the 5 data tables. A zero-card-but-has-decks user still counts as "populated" (they have real data). If a user accidentally created 1 row of noise (e.g., a test game), a threshold like ≥ 10 rows could suppress the modal — but this violates PITFALLS §3 "never silently destroy data." Stick with ≥ 1.

### Pattern 6: LWW Conflict Resolution (SYNC-05)

**What:** When a local and cloud row have diverged, compare `updated_at` at row level. Higher wins. Tie → cloud wins (D-02). For `deck_cards`, atomic merge by `(deck_id, scryfall_id)` composite key (ARCHITECTURE §Anti-Pattern 4).

**Source:** CONTEXT D-02, ARCHITECTURE.md Pattern 3, PITFALLS §5

**Algorithm:**
```js
function resolveLWW(local, remote) {
  // Both sides have the row. Compare updated_at.
  const lu = typeof local.updated_at === 'number' ? local.updated_at : new Date(local.updated_at).getTime();
  const ru = typeof remote.updated_at === 'number' ? remote.updated_at : new Date(remote.updated_at).getTime();
  if (ru > lu) return { winner: 'remote', row: remote };
  if (lu > ru) return { winner: 'local', row: local };
  return { winner: 'remote', row: remote };  // tie → cloud wins (D-02)
}
```

**deck_cards special case:**
```js
async function resolveDeckCardConflict(local, remote) {
  // local and remote share (deck_id, scryfall_id) but may have different UUIDs
  if (local.id === remote.id) return resolveLWW(local, remote);
  // Different UUIDs, same composite — pick higher updated_at's row wholesale
  const { winner, row } = resolveLWW(local, remote);
  const loser = winner === 'remote' ? local : remote;
  await db.sync_conflicts.add({
    table_name: 'deck_cards',
    row_id: loser.id,
    op: 'atomic_merge',
    payload: loser,
    error_code: 'deck_cards_atomic_merge',
    error_message: `Loser of (${loser.deck_id}, ${loser.scryfall_id}) atomic merge; winner id=${row.id}`,
    detected_at: Date.now()
  });
  return { winner, row };
}
```

**"Unresolvable" cases that surface in sync_conflicts:**
1. **deck_cards atomic merge loser** (above).
2. **Local delete + remote update** (user deleted row locally offline; another device updated it at the same time). LWW says "remote update" wins (preserves data), but the deletion intent is lost — log to conflicts for user review.
3. **Remote delete + local update** — same, inverted.
4. **Permanent push error** (Pattern 2 classifyError → 'permanent').

**Clock skew hardening (Pitfall 5):** the engine uses CLIENT-side `Date.now()` for LWW comparison — but because the server `updated_at DEFAULT now()` is the authoritative value for cloud rows, the LWW ordering is **anchored at the server side by construction**. Local writes get a client timestamp (subject to skew); cloud writes get a server timestamp (skew-free). The two streams resolve correctly as long as any single device's clock is within a few seconds of reality. If a device's clock is >60s fast, its local edits can "time-travel" and persist LATER edits from other devices — but (a) this is extraordinarily rare in practice, (b) the user sees this as "my edit won" which is the expected LWW semantic anyway, (c) CRDT is the only real fix and it's out of scope.

### Pattern 7: Sync-Status Store + Chip (SYNC-07)

**What:** `Alpine.store('sync')` exposes `{ status, pending_count, last_error, last_synced_at, bulkPullProgress }`. The topbar chip (refactored from `connectivity-chip`) `x-bind`s to `$store.sync.status`. State transitions are driven by engine-internal events.

**State machine:**

```
             ┌─────────────┐
             │   offline   │◄──────────┐ navigator.onLine === false
             └─────────────┘           │
                   │                   │
   online + authed │                   │ offline
                   ▼                   │
             ┌─────────────┐           │
             │   syncing   │───────────┘
             └─────────────┘
               │         │
     flush ok  │         │ permanent error
               │         │
               ▼         ▼
         ┌─────────┐  ┌───────┐
         │ synced  │  │ error │
         └─────────┘  └───────┘
               ▲         │
       scheduleFlush     │ user: retry / discard / all resolved
               │         │
               └─────────┘
```

**Event → transition table:**

| Event | From | To |
|-------|------|-----|
| `enqueue()` called | synced | syncing |
| `enqueue()` called | offline | offline (queue persists; stays offline) |
| `flushQueue()` completes clean | syncing | synced |
| `flushQueue()` hits permanent error | syncing | error |
| `flushQueue()` hits transient error, attempts < 3 | syncing | syncing |
| `navigator.online` → false | * | offline |
| `navigator.online` → true + authed | offline | syncing (triggers immediate flush) |
| `auth.status` → 'anonymous' | * | *(store resets; engine shuts down)* |
| `auth.status` → 'authed' (after reconciliation) | * | syncing or synced |
| User clicks `RETRY` in sync-errors-modal | error | syncing |
| All errors resolved via retry/discard | error | synced |

**pending_count:** computed from `db.sync_queue.where('user_id').equals(currentUserId).count()` — hook into this on every enqueue/flush.

**Connectivity detection:** `window.addEventListener('online'|'offline', ...)` is authoritative. No fetch probe needed — but per PITFALLS §4, add a rate-limit safety net (if >10 sync attempts/sec, pause for 30s and log).

### Pattern 8: Auth-Status Integration

**What:** Sync engine's lifecycle is bound to `auth.status`:

```js
// src/main.js (new Alpine.effect after the existing profile.hydrate effect)
Alpine.effect(() => {
  const status = Alpine.store('auth').status;  // reactive dep
  if (status === 'authed') {
    (async () => {
      // Wait for profile.hydrate to finish first (established pattern from Phase 10)
      const profile = Alpine.store('profile');
      if (!profile._loaded) await new Promise(r => setTimeout(r, 100));  // crude but effective; planner may refactor

      // Import sync engine lazily (preserves AUTH-01 lazy-load discipline)
      const { initSyncEngine } = await import('./services/sync-engine.js');
      await initSyncEngine();  // runs reconciliation, subscribes Realtime, starts polling
    })();
  } else if (status === 'anonymous') {
    // Sign-out: tear down sync engine
    (async () => {
      const { teardownSyncEngine } = await import('./services/sync-engine.js');
      await teardownSyncEngine();  // unsub Realtime, cancel poll interval, reset store
    })();
  }
});
```

**Token refresh during sync:** Supabase-js auto-refreshes tokens. If a refresh fails mid-request, the error code is `401`/`PGRST301` (classifyError → `permanent`), the entry dead-letters, chip flips to error. User clicks retry → token is fresh → succeeds.

**Sign-out mid-sync:** `auth.status → 'anonymous'` fires the teardown effect. Queue entries with the prior user's `user_id` STAY in Dexie (per D-22 local-first promise). Next time that user signs in, the `_currentUserId()` tag matches and flushQueue proceeds normally (PITFALLS §7 compliance). Cross-user contamination is impossible.

---

## Runtime State Inventory

Phase 11 is primarily greenfield additive work, but because it touches auth identity + RLS + realtime subscriptions, a runtime-state audit is valid.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| **Stored data** | Dexie v8 has `sync_queue` + `sync_conflicts` + `profile` tables already created BUT empty. Phase 11 adds Dexie v10 with `deleted_at` on 5 tables. | Schema bump (v10); additive migration backfills `deleted_at = null` on existing rows. No data migration for sync_queue/sync_conflicts (they start empty). |
| **Live service config** | Supabase `counterflux` schema has 6 tables + household RLS + `is_household_member()` function already live from Phase 10. Realtime is enabled by default on all tables in Supabase. | New migration file `20260419_counterflux_soft_delete.sql` adds `deleted_at timestamptz NULL` + partial index `WHERE deleted_at IS NULL`. Second migration `20260419_counterflux_tombstone_cleanup.sql` creates pg_cron job OR Edge Function (huxley tier check — pg_cron is available on Pro+; huxley tier may need Edge Function fallback — planner should verify). Realtime publication may need explicit `ALTER PUBLICATION supabase_realtime ADD TABLE counterflux.collection, ...` — verify in PREFLIGHT. |
| **OS-registered state** | None — Counterflux is a browser SPA; no OS-level task/cron/service registrations. | None. |
| **Secrets / env vars** | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` already configured via Phase 10 PREFLIGHT. Phase 11 uses the SAME credentials. No new secrets. | None. |
| **Build artifacts / installed packages** | `@supabase/supabase-js@2.103.3` and `dexie@4.4.2` already installed. `node_modules` contains the Realtime client code path — no additional install. | None. |

**Note on Realtime publication:** Supabase enables the `supabase_realtime` publication for `public` schema by default. For `counterflux` schema, the Phase 10 migration did NOT explicitly add tables to the publication. **The planner MUST confirm** whether Realtime events fire for `counterflux.*` — if not, Phase 11 must include `ALTER PUBLICATION supabase_realtime ADD TABLE counterflux.collection; ...` (6 tables). This is a documented Supabase gotcha: custom-schema tables need explicit publication membership. Place this in the Phase 11 preflight runbook.

---

## Environment Availability

> Phase 11 has no external CLI/tool dependencies beyond what Phase 10 established.

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Dev + test runner | ✓ | 24.13.1 | — |
| npm | Package install (no new packages) | ✓ | 11.8.0 | — |
| Supabase huxley project | Postgres + Realtime + RLS | ✓ (Phase 10 verified) | — | Phase 11 cannot ship without; no fallback by design |
| `@supabase/supabase-js` | Push/pull/Realtime | ✓ | 2.103.3 | — |
| `dexie` | Hooks + v10 migration | ✓ | 4.4.2 | — |
| pg_cron extension (for D-16 tombstone cleanup) | Nightly 30-day hard-delete | **UNKNOWN** | — | Edge Function triggered by Supabase Scheduled Jobs (available on all tiers). Planner should verify huxley's tier supports pg_cron via Supabase dashboard → Database → Extensions. Fallback is an Edge Function with a cron schedule; slightly more infrastructure but tier-agnostic. |
| Vitest + fake-indexeddb | Unit test + sync-engine integration tests | ✓ | 4.1.2 + 6.2.5 | — |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:** pg_cron — Edge Function fallback documented.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Outbox pattern | Custom queue table + polling loop with hand-tuned timers | Dexie's `table.hook()` + `sync_queue` (already in schema) | Hooks are synchronous with the data write inside the same transaction — hand-rolled queue writes are NOT atomic and will silently drop ops on crash. |
| Retry + backoff | `setInterval` + retry counter | Purpose-built `scheduleFlush(backoff)` function with explicit attempts field on queue entry | Naive retry loops without attempt counters cause stuck-queue pattern (PITFALLS §9). |
| UUID generation | `Math.random().toString(36)` | `crypto.randomUUID()` (already in Phase 7's creating-hook) | Collision probability is cosmologically small; match-id lookups work deterministically. |
| Timestamp for LWW | Client clock subtraction + naive ordering | `Date.now()` client-side AS-A-HINT + server `DEFAULT now()` as authority + LWW comparator uses remote `updated_at` after normalisation | Clock skew breaks naive comparisons (PITFALLS §5); dual-timestamp + tie-goes-cloud makes the ordering skew-tolerant. |
| Realtime WebSocket reconnect | Custom WS client + heartbeat + backoff | Supabase-js `.channel().subscribe()` — built-in reconnect + auth-token refresh + presence | Supabase-js already handles the 47 edge cases WS reconnection entails. |
| Bulk DELETE during KEEP LOCAL reconciliation | Per-row `.delete().eq('id', id)` in a loop | Single `DELETE FROM counterflux.collection` under RLS (server-side loop, atomic, <100ms) | N-request overhead is 100×; a single statement under household RLS hits only the household rows. |
| Modal z-index / backdrop / lockdown | Hand-rolled overlay | Pattern-match `first-sign-in-prompt.js` (reconciliation) or `settings-modal.js` (sync-errors) | Both patterns are battle-tested in Phase 10; mirror them to keep the keyboard-accessibility + motion + reduced-motion behaviours consistent. |
| Progress splash | New splash system | Reuse `splash-screen.js` (Phase 7 bulk-data pattern) — same DOM shape, different data source | UI-SPEC §4 explicitly instructs this. One-pattern discipline across the app. |
| Connectivity detection | `fetch` probe with timeout | `window.addEventListener('online'|'offline', ...)` + `navigator.onLine` | Built-in events fire on interface state change; probes add network overhead for no additional fidelity. |
| Toast dispatching | New notification bus | Existing `Alpine.store('toast')` (via toast.js component) | Single toast system across the app — don't split into parallel buses. |
| Exposing queue state to UI | Custom pub/sub | `Alpine.store('sync')` reactive fields; components `x-effect` subscribe | Alpine reactivity is already used everywhere else; consistent. |

**Key insight:** Phase 11 is a glue layer, not a greenfield invention. Almost every mechanism has a prescribed pattern from Phases 7/10 or from the upstream libraries. The biggest risk is re-inventing one of these patterns instead of extending it — the code review / plan check should explicitly verify planner reuses each pattern.

---

## Common Pitfalls

### Pitfall 11-A: Hook fires on pull-side writes → infinite sync loop

**What goes wrong:** `sync-pull.js` calls `db.collection.put(remoteRow)` to apply an incoming row. Dexie fires the `updating` hook. Hook enqueues a sync_queue entry. Next flush pushes the row back to Supabase (identical content, different `updated_at` if hook stamps `Date.now()` on `updating`). Supabase Realtime broadcasts it. Pull receives it. Loop.

**Why it happens:** Default hook semantics fire on ALL writes.

**How to avoid:** Module-scoped `_suppressHooks = true` flag wrapping pull-side writes. Hook checks it and returns early. Phase 11 MUST ship this in the first commit of sync-engine.js, not as an afterthought.

**Warning signs:** Steady-state Supabase POST traffic with idle user; `sync_queue` grows without user action; Supabase Realtime quota exhausted within hours.

**Verification:** Idle-user test (already in PITFALLS §4 guidance) — sign in, leave tab for 5 min, network tab should show ~5 total sync requests (heartbeats).

### Pitfall 11-B: `_suppressHooks` flag leaks across async boundaries

**What goes wrong:** `withHooksSuppressed(async () => { await db.put(...); })` — the `async` wrapper sets the flag to `false` BEFORE the `await` resolves (the function returns the promise synchronously; the flag flips back in the `finally` before the awaited op completes). Interleaved hooks from OTHER code paths that ran during the await see `_suppressHooks = false` and enqueue normally. Then the awaited pull write completes and its hook fires WITHOUT suppression.

**Why it happens:** Module-scoped booleans are synchronous; JavaScript's async/await interleaves operations.

**How to avoid:** Choose ONE of:
1. **Synchronous block only:** `withHooksSuppressed(() => db.put(x))` — NOT `async () => await db.put(x)`. Dexie's `.put()` returns a Promise but the hook fires during the call stack before the Promise resolves. ✅ **RECOMMENDED** — matches ARCHITECTURE §Pattern 2 Option 2.
2. **Promise-scoped flag:** `_suppressHooksPromise = db.put(x).finally(() => { _suppressHooksPromise = null; })` — hook checks `_suppressHooksPromise !== null`. More complex.
3. **AsyncLocalStorage:** Node-only API; unavailable in browsers.

**Recommendation:** Pattern 1. Call `withHooksSuppressed(() => db.collection.put(...))` directly without `async`. Dexie's hook runs synchronously inside the put operation's internal call chain — by the time the returned Promise settles, the hook has already run. **The code sketches above use this pattern; planner must preserve it.**

**Warning signs:** Occasional extra enqueue entries after pull bursts; `sync_queue` count doesn't return to zero after a clean pull.

**Verification:** Unit test: mount the suppressor, run `db.put(x)`, assert `sync_queue.count() === 0` post-op.

### Pitfall 11-C: Realtime publication doesn't include `counterflux` schema tables

**What goes wrong:** Phase 10 created `counterflux` schema + tables + RLS. Supabase's default `supabase_realtime` publication covers `public` schema only. `counterflux.*` tables fire NO realtime events unless explicitly added to the publication. Sync engine's Realtime subscription silently returns no events; incremental polling (60s backstop) is the only pull mechanism — latency user-visible.

**Why it happens:** Supabase UI doesn't auto-add custom-schema tables to the realtime publication.

**How to avoid:** Phase 11's Supabase migration must include:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE counterflux.collection;
ALTER PUBLICATION supabase_realtime ADD TABLE counterflux.decks;
ALTER PUBLICATION supabase_realtime ADD TABLE counterflux.deck_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE counterflux.games;
ALTER PUBLICATION supabase_realtime ADD TABLE counterflux.watchlist;
ALTER PUBLICATION supabase_realtime ADD TABLE counterflux.profile;
```

**Warning signs:** Realtime subscription shows `status: 'SUBSCRIBED'` but no events fire; incremental pull every 60s is the only source of remote changes.

**Verification:** Live-Supabase test in `tests/sync-rls.test.js`: subscribe to realtime, write to `counterflux.collection` via a second client, assert event arrives within 2 seconds.

### Pitfall 11-D: `upsert()` with an `id` already held by another household member fails RLS

**What goes wrong:** Sync engine tries to upsert a row with `id = 'abc-123'` that's already owned by James (his `user_id`). RLS `WITH CHECK` evaluates `is_household_member(user_id) AND is_household_member(auth.uid())` — both true for Sharon, so the WRITE is allowed. But PostgREST upsert with `onConflict: 'id'` tries to UPDATE, and the UPDATE's WITH CHECK evaluates against the NEW row's `user_id` (unchanged from James). Still allowed for household. **This actually works** — household members CAN edit each others' rows.

**Why it COULD surprise:** In a pure per-user RLS model, this would fail. Phase 10 D-38 household model means it succeeds. Planner + executor must internalize this: **sync engine does not need to rewrite `user_id` to the current user on update**. D-05 locks this: `user_id` stays with the creator.

**Verification:** `tests/sync-rls.test.js` includes a positive-control test — sign in as James, create a row, sign in as Sharon, update that row's `name` field, assert update succeeds AND `user_id` is still James.

### Pitfall 11-E: Bulk-pull splash interferes with reconciliation modal

**What goes wrong:** On `empty-populated` state, splash mounts (D-06). User closes tab mid-pull. Next boot: still empty-populated (no local rows were committed because splash closed before completion). Splash mounts again, user waits, but this time a `populated-populated` would have been detected if partial rows HAD been committed.

**Why it happens:** Partial pulls are preserved in Dexie (D-13) — this means next boot might classify as `populated-populated` if enough rows synced. Reconciliation modal then mounts OVER WHAT SHOULD BE SILENT-PULL.

**How to avoid:** Classify state using `sync_last_pulled_at` meta alongside row counts. If a pull was in progress and aborted (`sync_last_pulled_at` not updated), treat as "resume pull" rather than re-classifying. Alternatively, clear Dexie on splash-error if user clicks "Start Over" (out of scope — no such button per D-13).

**Recommendation:** Store a `sync_pull_in_progress` meta flag. Set on bulk-pull start, clear on bulk-pull success/error-acknowledge. On boot, if flag is true, go directly to splash (resume pull) rather than classifyState. Planner should formalise this.

### Pitfall 11-F: RLS filters break `count` queries

**What goes wrong:** `supabase.from(t).select('*', { count: 'exact', head: true })` — returns the count of rows visible under RLS. For household, that's the household-scope count. ✅ This is CORRECT for our case. But a developer unfamiliar with RLS might expect "all rows" and be surprised.

**Why it happens:** RLS applies to counts too.

**How to avoid:** Document clearly: "counts in Phase 11 are always household-scoped counts via RLS." Don't expose the raw counts to the user as "all cards in the system" — frame them as "household cards" in the reconciliation modal.

**Verification:** UI-SPEC §2 labels the cloud column `HOUSEHOLD (CLOUD)` explicitly — ✅ already compliant.

### Pitfall 11-G: `sync_queue` grows unbounded during extended offline

**What goes wrong:** User goes offline for 3 weeks, makes 5000 edits. Queue grows to 5000 entries. Reconnect triggers a flush attempt. Single `upsert()` of 5000 rows hits PostgREST's payload limit OR times out.

**Why it happens:** Naive flush tries to drain entire queue in one shot.

**How to avoid:** Chunk the flush into 200-entry batches (already in the sketch above). Also: dedupe by row_id BEFORE chunking — 5000 edits to 10 unique rows = 10 upserts, not 5000.

**Recommendation:** ARCHITECTURE §9 third scaling point says "cap queue at 5000, archive overflow." Counterflux at 2-user scale won't hit this, but defensive chunk-200 flushing is cheap. Planner should include the chunk cap in the initial implementation.

### Pitfall 11-H: `deleting` hook doesn't see the row's `user_id`

**What goes wrong:** Dexie's `deleting` hook signature is `(primKey, obj, tx)`. In some Dexie versions, `obj` may be undefined on delete if the row wasn't fetched first. If undefined, the hook can't tag the queue entry with `user_id` → flush refuses (cross-user safety) → queue item stuck.

**Why it happens:** Dexie 4.x docs show `obj` populated for delete hooks, but only if the deleting call is `db.table.where(...).delete()` which fetches rows first. Direct-key `db.table.delete(id)` may not populate obj.

**How to avoid:** For the safety net (hard-delete path), read `user_id` from the current auth store, not from `obj`. The sketch above uses `_currentUserId()` which reads from Alpine — works regardless of obj availability.

**Verification:** Unit test: `db.collection.delete(uuid)` direct, assert queue entry has correct `user_id` tag.

### Pitfall 11-I: Realtime INSERT events arrive before the pushing device's flush completes

**What goes wrong:** Device A writes → hooks enqueue → flush pushes → Supabase commits → Realtime broadcasts. Device A's Realtime subscription receives ITS OWN event. `applyRealtimeChange` sees the row as "new" (no local row with this id locally because — wait, there IS one; Device A created it). LWW check: `remote.updated_at > local.updated_at`? Usually yes (server timestamp is a few ms later than client). Remote wins — ok, no harm done. But this is extra work.

**Why it happens:** Realtime broadcasts to all subscribers including the author.

**How to avoid:** Filter by origin. When pushing, stamp the outgoing payload with a `pushed_by_me` marker — but the ground truth is: after push success, the local row gets `synced_at = Date.now()`. Realtime echo arriving shortly after can check if local row's `synced_at > remote.commit_timestamp - grace_period` — if so, we pushed this, skip. Simpler: just let LWW handle it. Echoed events do no harm; they're idempotent.

**Recommendation:** Don't optimize. Let the echo apply harmlessly. Add a metric log to detect if echo storms become a problem.

### Pitfall 11-J (from PITFALLS §6): Partial deck update under network failure

**What goes wrong:** User adds 10 cards to a deck. 10 `sync_queue.add` calls. Flush fires. First 3 upserts succeed, 4th fails with network error. Queue has entries 4-10 left. Realtime broadcasts entries 1-3 to other devices. Deck on Device B shows 3 cards, Device A's local shows 10, when re-flush completes Device B shows 10.

**Why it happens:** Cross-device visibility window is transient.

**How to avoid:** This is acceptable behaviour — eventual consistency is the contract. User-visible symptom is "Device B briefly shows 3 cards, then catches up to 10 within seconds." Not a pitfall if understood. The alternative (transactional RPC) is out of scope for Phase 11.

---

## Code Examples

Verified patterns from official sources + phase context:

### Supabase schema query with `counterflux` scoping

```js
// Source: Phase 10 profile store pattern (src/stores/profile.js:96-102)
// Source: Supabase docs https://supabase.com/docs/reference/javascript/schema

const supabase = getSupabase();
const { data, error } = await supabase
  .schema('counterflux')
  .from('collection')
  .select('*')
  .gt('updated_at', lastPulledIso);
```

### Batched upsert

```js
// Source: Supabase docs https://supabase.com/docs/reference/javascript/upsert
const { error } = await supabase
  .schema('counterflux')
  .from('collection')
  .upsert(
    rows,  // array of row objects with text PK id
    { onConflict: 'id', ignoreDuplicates: false }
  );
```

### Realtime postgres_changes for a schema

```js
// Source: Supabase docs https://supabase.com/docs/guides/realtime/postgres-changes
// One schema-wide channel — see §Pattern 3 Option B

const channel = supabase
  .channel('counterflux-household')
  .on(
    'postgres_changes',
    { event: '*', schema: 'counterflux' },
    (payload) => {
      // payload.eventType: 'INSERT' | 'UPDATE' | 'DELETE'
      // payload.table: 'collection' | 'decks' | ...
      // payload.new / payload.old
    }
  )
  .subscribe((status, err) => {
    if (status === 'CHANNEL_ERROR') console.warn('[sync] realtime subscription error', err);
  });
```

### Dexie hook with suppression flag

```js
// Source: Dexie docs https://dexie.org/docs/Table/Table.hook('creating')
// Source: ARCHITECTURE.md §Pattern 2

let _suppressHooks = false;

db.collection.hook('creating', function (primKey, obj, tx) {
  if (_suppressHooks) return;
  obj.updated_at = Date.now();
  tx.table('sync_queue').add({ table_name: 'collection', op: 'put', ...obj });
});

// Use synchronously — CRITICAL: no async wrapper (§Pitfall 11-B)
function withHooksSuppressed(fn) {
  _suppressHooks = true;
  try { return fn(); } finally { _suppressHooks = false; }
}

withHooksSuppressed(() => db.collection.put(remoteRow));  // ✅ hook sees flag=true
// NOT: await withHooksSuppressed(async () => { await db.collection.put(remoteRow); });  // ❌ flag may flip back before put runs
```

### Dexie v10 additive migration with `deleted_at`

```js
// Source: existing Dexie v9 pattern (src/db/schema.js:392-413) — additive, no upgrade callback
// Phase 11 follows the same shape

db.version(10).stores({
  // ALL v9 tables re-declared (Pitfall 1 — chain must be intact)
  // ... (verbatim from v9) ...
  // The only delta is declaring new indexed columns if needed.
  // `deleted_at` is non-indexed — add it to schema strings only if you want to query by it
  // (e.g., sync engine's soft-delete filter)
  collection: 'id, scryfall_id, category, foil, user_id, updated_at, synced_at, deleted_at, [scryfall_id+foil], [scryfall_id+category]',
  decks:      'id, name, format, user_id, updated_at, synced_at, deleted_at',
  deck_cards: 'id, deck_id, scryfall_id, user_id, updated_at, synced_at, deleted_at, [deck_id+scryfall_id]',
  games:      'id, deck_id, user_id, started_at, ended_at, updated_at, synced_at, deleted_at',
  watchlist:  'id, &scryfall_id, user_id, updated_at, synced_at, deleted_at',
  // profile not changed per D-15 (excluded from soft delete)
  // ... unchanged tables ...
});
// No .upgrade() callback — new field defaults to undefined/null; reads filter WHERE deleted_at IS NULL/undefined.
```

### Alpine store shape for sync

```js
// Source: CONTEXT code_context + UI-SPEC binding contract

Alpine.store('sync', {
  status: 'synced',           // 'synced' | 'syncing' | 'offline' | 'error'
  pending_count: 0,
  last_error: null,
  last_synced_at: null,
  bulkPullProgress: null,     // { table, pulled, total } during bulk pull, else null

  async init() { /* reconciliation + Realtime subscribe + start polling */ },
  async flush() { /* manual flush trigger */ },
  async retry(queueEntryId) { /* retry single failed sync_conflicts entry */ },
  async discard(queueEntryId) { /* drop entry from sync_conflicts */ }
});
```

### Supabase DELETE under RLS for KEEP LOCAL (bulk server-side)

```js
// Source: Supabase docs https://supabase.com/docs/reference/javascript/delete
// RLS filters to household — bulk DELETE only touches household rows

for (const t of ['collection', 'decks', 'deck_cards', 'games', 'watchlist']) {
  await supabase.schema('counterflux').from(t).delete().neq('id', 'impossible-sentinel');
  // .neq is required — Supabase rejects DELETE without a filter for safety.
  // '.neq("id", "impossible")' effectively means "delete everything (RLS scoped)".
}
// profile excluded — per D-15
```

### pg_cron tombstone cleanup job

```sql
-- 20260419_counterflux_tombstone_cleanup.sql
-- Nightly hard-delete of rows soft-deleted > 30 days ago (D-16)
-- Requires pg_cron extension. If unavailable on tier, use an Edge Function + Scheduled Jobs.

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'counterflux-tombstone-cleanup',
  '0 3 * * *',  -- daily at 03:00 UTC
  $$
    DELETE FROM counterflux.collection  WHERE deleted_at < now() - interval '30 days';
    DELETE FROM counterflux.decks       WHERE deleted_at < now() - interval '30 days';
    DELETE FROM counterflux.deck_cards  WHERE deleted_at < now() - interval '30 days';
    DELETE FROM counterflux.games       WHERE deleted_at < now() - interval '30 days';
    DELETE FROM counterflux.watchlist   WHERE deleted_at < now() - interval '30 days';
  $$
);
```

---

## Plan Breakdown (recommended 6 plans)

Each plan is sized to ≤ 30 min wall time with tight TDD pairs. Order preserves FK dependencies + safety-first.

### Plan 11-01: Schema delta + pre-flight (no code paths wired yet)
**Scope:** Dexie v10 bump adding `deleted_at` column across 5 tables + Supabase migration `20260419_counterflux_soft_delete.sql` + pg_cron OR Edge Function tombstone cleanup + publication membership for realtime.
**Files:** `src/db/schema.js`, `supabase/migrations/20260419_*.sql`, `src/workers/bulk-data.worker.js` (mirror), new `11-SYNC-PREFLIGHT.md`.
**Tests:** `tests/sync-schema-v10.test.js` (Dexie v9→v10 migration against fixtures with existing rows; all get `deleted_at = null`).
**Depends on:** Phase 7 v8 + Phase 8 v9 schema (already live).
**Risk:** LOW — additive-only.

### Plan 11-02: Reconciliation modal + sync-errors modal + sync-pull splash (UI surfaces, static)
**Scope:** Build the three new UI components with mock data; don't wire sync engine yet. Allows UI review + UAT of the safety surfaces first.
**Files:** `src/components/reconciliation-modal.js`, `src/components/sync-errors-modal.js`, `src/components/sync-pull-splash.js`, `src/styles/main.css` (reduced-motion block extension).
**Tests:** `tests/reconciliation-modal.test.js` (lockdown, 3-button, count render), `tests/sync-errors-modal.test.js` (row actions, empty state), `tests/sync-pull-splash.test.js` (progress update, error state).
**Depends on:** Plan 11-01 (schema in place).
**Risk:** MEDIUM — reconciliation modal is milestone-load-bearing; lockdown MUST work first time.

### Plan 11-03: Sync store + sync-status chip (UI binding, still no engine)
**Scope:** `Alpine.store('sync')` with the 4 states + `pending_count` + `last_synced_at` reactive fields. Refactor `index.html` topbar chip. Delete `src/utils/connectivity.js`.
**Files:** `src/stores/sync.js`, `index.html` (chip template), `src/main.js` (initSyncStore call), `src/utils/connectivity.js` deleted.
**Tests:** `tests/sync-store.test.js` (state transitions, reactive updates), `tests/sync-status-chip.test.js` (DOM bindings, tooltip copy).
**Depends on:** Plan 11-02 (sync-errors-modal exists to open from chip click).
**Risk:** LOW — Alpine store patterns well-established.

### Plan 11-04: Outbox hooks + push engine (local-first writes + flush to cloud)
**Scope:** Install Dexie hooks on 6 synced tables; `sync-engine.js` push path (flushQueue, scheduleFlush, classifyError, retry backoff). `_suppressHooks` flag + `withHooksSuppressed()` helper. Integration with `Alpine.store('sync')` state transitions.
**Files:** `src/services/sync-engine.js` (new, ~250 LOC), `src/db/schema.js` (hook install after db.open() in runMigration tail), `src/main.js` (`Alpine.effect` to init sync-engine on auth→authed).
**Tests:** `tests/sync-engine-push.test.js` (enqueue on create/update/delete, user_id tag, deduplication by row_id, error classification, retry backoff, dead-letter to sync_conflicts), `tests/sync-engine-suppression.test.js` (hook no-ops when `_suppressHooks=true`), `tests/sync-engine-cross-user.test.js` (PITFALLS §7 — queue tagged with user A doesn't flush under user B).
**Depends on:** Plan 11-03 (sync store exists for status transitions).
**Risk:** HIGH — this is the heart of the engine; lots of edge cases.

### Plan 11-05: Reconciliation flow + bulk pull + Realtime subscription + incremental polling
**Scope:** `sync-reconciliation.js` (classifyState + reconcile + 3-button choice handlers); `sync-pull.js` (bulkPull with progress, incrementalPull with cursor); `sync-realtime.js` (postgres_changes subscription + dispatcher); wire into sync-engine's init().
**Files:** `src/services/sync-reconciliation.js`, `src/services/sync-pull.js`, `src/services/sync-realtime.js`, updates to `sync-engine.js` init flow.
**Tests:** `tests/sync-reconciliation.test.js` (4-state matrix; LWW merge algorithm with 6 fixture pairs: local-newer / remote-newer / tie / deck_cards-atomic / local-delete+remote-update / both-delete), `tests/sync-bulk-pull.test.js` (progress events, error resume, FK order preserved), `tests/sync-realtime.test.js` (mock channel with INSERT/UPDATE/DELETE events; verify LWW apply + `_suppressHooks` correctly bracketed).
**Depends on:** Plan 11-04 (push engine + suppression flag exist).
**Risk:** HIGH — reconciliation correctness is safety-critical.

### Plan 11-06: Live-Supabase integration tests + soak + documentation
**Scope:** `tests/sync-rls.test.js` (live Supabase, describeIf HAS_ENV — mirrors `rls-isolation.test.js` pattern); push Device-A-edits-flow-to-Device-B test; offline→reconnect E2E; reconciliation populated/populated E2E; chip state-fidelity manual UAT checklist.
**Files:** `tests/sync-rls.test.js`, `tests/sync-offline-resilience.test.js`, `.planning/phases/11-cloud-sync-engine/11-HUMAN-UAT.md`.
**Depends on:** Plan 11-05 (entire engine operational).
**Risk:** MEDIUM — live-Supabase tests can be flaky; ensure describeIf gate + fast timeouts.

**Total estimated scope:** ~800 LOC production code + ~1200 LOC test code, 6 plans, ~3-5 hours of execution time given Phase 10's 32-40 min/plan velocity.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CRDT-first "just solve all conflicts" | Domain-appropriate LWW + user-confirmed reconciliation for divergence | CONTEXT D-01..D-04 + REQUIREMENTS.md "Out of Scope" | Single-user multi-device model rarely sees true concurrent edits; CRDT is 10× complexity for edge case coverage |
| Bidirectional sync without origin tagging | Origin tagging via `synced_at != null` + `_suppressHooks` flag | PITFALLS §4 synthesis | Prevents ping-pong loops that were universal in early local-first sync engines |
| Polling every 5s | Realtime postgres_changes + 60s incremental polling backstop | Supabase Realtime GA + ARCHITECTURE.md §Scaling | Near-realtime cross-device sync without constant network chatter |
| Per-user RLS | Household-scoped RLS via SECURITY DEFINER membership function | Phase 10 D-38 + PITFALLS §2.x | Personal app with household sharing; forward path to multi-household via table rename |
| Hard delete | Soft delete with `deleted_at` + tombstone cleanup cron | CONTEXT D-15..D-16 | Prevents cross-device "row disappeared" race; cleanup job prevents unbounded tombstone accumulation |
| Single queue per app | Per-user-tagged queue + refuse-cross-user-flush | PITFALLS §7 | Prevents account-switch data contamination |

**Deprecated/outdated:**
- Supabase's `detectSessionInUrl` being optional — Phase 10 proved it's required for OAuth PKCE callback. Phase 11 relies on auth-store's session being populated synchronously after callback; no further change.
- `postgres_changes` FILTER clause (`filter: 'user_id=eq.{uid}'`) for cross-user isolation — NOT needed when household RLS is correct. Server-side RLS applies to realtime events too (Supabase Realtime 2.x, confirmed in docs). Planner should verify this explicitly but the default is secure.

---

## Open Questions

1. **pg_cron on huxley project tier — available or not?**
   - What we know: pg_cron is in Supabase's extension catalog; availability depends on plan tier.
   - What's unclear: huxley's current tier (Phase 10 didn't document this; personal projects often on Free tier which MAY or MAY NOT include pg_cron).
   - Recommendation: Plan 11-01 includes both paths — prefer pg_cron, fall back to Supabase Edge Function + Scheduled Jobs if extension unavailable. Verify via Supabase dashboard → Database → Extensions during preflight.

2. **Realtime publication for `counterflux` schema — auto-enabled or explicit ALTER needed?**
   - What we know: Phase 10 migration didn't ALTER PUBLICATION. Supabase's default publication usually covers `public` schema only.
   - What's unclear: whether creating the schema via migration auto-added it to the publication.
   - Recommendation: Plan 11-01's preflight runbook includes an explicit `ALTER PUBLICATION supabase_realtime ADD TABLE counterflux.*` block and a smoke-test (subscribe + write + assert event arrives).

3. **Chunk size for bulk pull — 500 optimal?**
   - What we know: 500 is safely under PostgREST's 1000-row default; 100KB payload is fast over wifi.
   - What's unclear: whether specific tables (games, with large JSONB `players` + `turn_laps`) have larger per-row payloads making 500 rows slow.
   - Recommendation: Ship 500 as default. Add `CHUNK_SIZE` constants per-table (`COLLECTION_CHUNK = 500, GAMES_CHUNK = 100`) that can be tuned in a follow-up without changing the engine.

4. **Reconciliation `populated` threshold — is `≥ 1 row across any of the 5 tables` too aggressive?**
   - What we know: CONTEXT doesn't specify a threshold; "populated" is implicit.
   - What's unclear: if a user has 1 accidental game record but no cards/decks, should that trigger reconciliation modal?
   - Recommendation: Stick with ≥ 1 (PITFALLS §3 "never silently destroy data"). An accidental 1-row reconciliation prompt is a 5-second UX cost; the alternative of silent overwrite at ≥ N threshold re-creates the pitfall.

5. **Realtime echo suppression — optimization or non-issue?**
   - What we know: device's own writes echo back via Realtime; LWW handles idempotently.
   - What's unclear: if echo volume creates visible jank (every write triggers a pull-side rehydration of same row).
   - Recommendation: Ship without suppression. Add a diagnostic console log (`echo_count_per_minute`) in dev mode. If ever > 50/min, build an echo-suppression mechanism (compare incoming `commit_timestamp` vs local `synced_at` within a 5s grace window).

6. **`sync_queue` + `sync_conflicts` schema evolution — are the v6 shapes correct for Phase 11?**
   - What we know: Phase 7 declared `sync_queue: '++id, table_name, user_id, created_at'` and `sync_conflicts: '++id, table_name, detected_at'`.
   - What's unclear: Phase 11's real columns will include `op`, `row_id`, `payload`, `attempts`, `last_error` on `sync_queue` and `row_id`, `op`, `payload`, `error_code`, `error_message` on `sync_conflicts`. These are non-indexed (Dexie puts them in the row but not the schema string) — is that sufficient?
   - Recommendation: Non-indexed fields are fine. Add them implicitly by storing full row objects. If query performance on `sync_conflicts` becomes an issue (searching by `row_id`), a later schema bump can add indexes.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 + fake-indexeddb 6.2.5 |
| Config file | `vitest.config.js` (existing) |
| Quick run command | `npx vitest run tests/sync-*.test.js` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| SYNC-01 | `counterflux` schema + RLS policies match Dexie v10 shape; `deleted_at` column exists + indexed where queried | integration (live-Supabase, describeIf HAS_ENV) | `npx vitest run tests/sync-rls.test.js -t "schema mirror"` | ❌ Wave 0 |
| SYNC-02 | Dexie `creating/updating/deleting` hooks enqueue into `sync_queue` with `user_id`, `op`, `row_id`, `payload`; `cards`/`meta`/`*_cache` excluded | unit | `npx vitest run tests/sync-engine-push.test.js -t "outbox hook"` | ❌ Wave 0 |
| SYNC-02 | `_suppressHooks = true` causes hooks to skip enqueue | unit | `npx vitest run tests/sync-engine-suppression.test.js` | ❌ Wave 0 |
| SYNC-03 | Batched upsert flushes queue to Supabase; success path deletes queue entries + stamps `synced_at` | integration (live-Supabase) | `npx vitest run tests/sync-rls.test.js -t "push upsert"` | ❌ Wave 0 |
| SYNC-03 | Error classification: 429/5xx/network → transient (retry w/ backoff); 400/403/409/422 → permanent (dead-letter) | unit | `npx vitest run tests/sync-engine-push.test.js -t "classifyError"` | ❌ Wave 0 |
| SYNC-03 | Cross-user safety: queue tagged with User A stays in queue when User B signs in; doesn't flush under User B's auth | unit | `npx vitest run tests/sync-engine-cross-user.test.js` | ❌ Wave 0 |
| SYNC-03 | Realtime INSERT/UPDATE event applies LWW-correctly and does NOT re-enqueue via hooks | unit (mock channel) | `npx vitest run tests/sync-realtime.test.js -t "realtime apply"` | ❌ Wave 0 |
| SYNC-04 | `classifyState()` returns correct state for 4 fixtures: empty/empty, empty/populated, populated/empty, populated/populated | unit (mock Supabase count responses) | `npx vitest run tests/sync-reconciliation.test.js -t "classifyState"` | ❌ Wave 0 |
| SYNC-04 | Populated-populated triggers lockdown modal; 3 buttons execute correct semantics (MERGE_EVERYTHING → LWW pull+push; KEEP_LOCAL → server delete + push; KEEP_CLOUD → local clear + pull) | integration (live-Supabase + Dexie) | `npx vitest run tests/sync-reconciliation.test.js -t "three-button"` | ❌ Wave 0 |
| SYNC-04 | Reconciliation modal is non-dismissible (Escape/backdrop/X all blocked) | unit (DOM) | `npx vitest run tests/reconciliation-modal.test.js -t "lockdown"` | ❌ Wave 0 |
| SYNC-05 | LWW resolver: remote-newer wins; local-newer wins; tie → cloud wins (D-02); deck_cards atomic merge by composite key; local-delete+remote-update → sync_conflicts entry | unit | `npx vitest run tests/sync-conflict.test.js` | ❌ Wave 0 |
| SYNC-06 | Offline queue survives page reload (persisted in Dexie) | unit (fake-indexeddb reload simulation) | `npx vitest run tests/sync-offline-resilience.test.js -t "reload recovery"` | ❌ Wave 0 |
| SYNC-06 | `navigator.online` event triggers flushQueue on reconnect | unit (dispatch synthetic online event) | `npx vitest run tests/sync-offline-resilience.test.js -t "reconnect flush"` | ❌ Wave 0 |
| SYNC-07 | Sync store exposes 4 states; chip DOM binds to each; error state chip is clickable and opens sync-errors modal | unit (DOM + store) | `npx vitest run tests/sync-status-chip.test.js` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/<changed-area>.test.js -x` — fast feedback per commit (<10s).
- **Per wave merge:** `npm test` — full suite (currently ~4s for existing 40+ test files; Phase 11 adds ~7 files pushing to ~15s).
- **Phase gate:** `npm test` green + `tests/sync-rls.test.js` green (requires HAS_ENV — huxley credentials injected via env vars; same pattern as Phase 10 Plan 1 hard gate) before `/gsd:verify-work`.

### Wave 0 Gaps

All Phase 11 tests need creation:
- [ ] `tests/sync-schema-v10.test.js` — covers SYNC-01 (Dexie migration)
- [ ] `tests/sync-engine-push.test.js` — covers SYNC-02 + SYNC-03 (hooks + push + error classification)
- [ ] `tests/sync-engine-suppression.test.js` — covers SYNC-02 loop-break
- [ ] `tests/sync-engine-cross-user.test.js` — covers SYNC-06 user_id safety
- [ ] `tests/sync-reconciliation.test.js` — covers SYNC-04 + SYNC-05 (states + LWW)
- [ ] `tests/sync-conflict.test.js` — covers SYNC-05 LWW matrix
- [ ] `tests/sync-bulk-pull.test.js` — covers SYNC-04 populated-cloud bulk pull
- [ ] `tests/sync-realtime.test.js` — covers SYNC-03 pull half
- [ ] `tests/sync-offline-resilience.test.js` — covers SYNC-06 offline queue
- [ ] `tests/sync-store.test.js` — covers SYNC-07 state machine
- [ ] `tests/sync-status-chip.test.js` — covers SYNC-07 DOM
- [ ] `tests/reconciliation-modal.test.js` — covers SYNC-04 modal lockdown + counts
- [ ] `tests/sync-errors-modal.test.js` — covers D-09 modal behavior
- [ ] `tests/sync-pull-splash.test.js` — covers D-12..D-14 splash progress + error
- [ ] `tests/sync-rls.test.js` — covers SYNC-01 + SYNC-03 live integration (describeIf HAS_ENV)

No additional framework install needed — vitest + fake-indexeddb are already in devDependencies.

---

## Sources

### Primary (HIGH confidence)
- `.planning/phases/11-cloud-sync-engine/11-CONTEXT.md` — 16 locked decisions, canonical_refs, code_context (authoritative for this phase)
- `.planning/phases/11-cloud-sync-engine/11-UI-SPEC.md` — Approved UI design contract (all 6 dimensions passed first check)
- `.planning/REQUIREMENTS.md` — SYNC-01..SYNC-07 row-level acceptance criteria
- `.planning/research/ARCHITECTURE.md` §Pattern 2, Pattern 3, Anti-Pattern 4, Anti-Pattern 5, §5 (data flow diagrams), §Pattern 1 (auth-aware store hydration)
- `.planning/research/PITFALLS.md` §3 (first-sync wipe), §4 (sync loop), §5 (clock skew), §7 (cross-user queue), §9 (stuck queue / error classification), §2 (RLS)
- `.planning/research/STACK.md` §Sync engine (roll-your-own rationale, 300-500 LOC estimate — Phase 11 research revised to 800 LOC with tests)
- `src/db/schema.js` (Dexie v1..v9 chain; UUID creating-hooks; verbatim read)
- `src/services/supabase.js` (PKCE client singleton; verbatim read)
- `src/stores/auth.js` (Phase 10 Plan 2/D-39 — auth state machine; verbatim read)
- `src/stores/profile.js` (Phase 10 Plan 4 — auth-aware hydration pattern; verbatim read)
- `src/main.js` (boot order + auth-wall + Alpine.effect hooks; verbatim read)
- `supabase/migrations/20260417_counterflux_auth_foundation.sql` (SYNC-01 table shape already 95% satisfied)
- `supabase/migrations/20260418_counterflux_shared_users_household.sql` + `20260418_counterflux_household_rls_fix_recursion.sql` (household RLS + `is_household_member(uuid)` SECURITY DEFINER function)
- Supabase docs: [postgres_changes](https://supabase.com/docs/guides/realtime/postgres-changes), [upsert](https://supabase.com/docs/reference/javascript/upsert), [schema](https://supabase.com/docs/reference/javascript/schema), [delete](https://supabase.com/docs/reference/javascript/delete)
- Dexie docs: [Table.hook('creating')](https://dexie.org/docs/Table/Table.hook('creating')) and updating/deleting variants
- `tests/rls-isolation.test.js` (Phase 10 pattern for live-Supabase describeIf tests — directly applicable to Phase 11 `tests/sync-rls.test.js`)

### Secondary (MEDIUM confidence)
- Package version verification via `npm view` (2026-04-18): `@supabase/supabase-js@2.103.3`, `dexie@4.4.2` — both current.
- pg_cron availability on Supabase tiers: availability matrix not verified live; defaults documented in https://supabase.com/docs/guides/database/extensions/pg_cron — plan builds in Edge Function fallback.

### Tertiary (LOW confidence)
- Realtime channel quota exact ceiling for free tier — scale considerations documented in ARCHITECTURE §9 third bottleneck; planner should verify if 2-user household exceeds limits (extremely unlikely — household = 2 users × ~3 tabs = 6 channels max under Option B topology).

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed and proven in Phase 10
- Architecture (outbox + push + pull + reconciliation): HIGH — ARCHITECTURE.md + CONTEXT.md have locked every major decision
- Pitfalls: HIGH — PITFALLS.md documents 16 domain pitfalls; Phase 11 adds 10 phase-specific ones verified against Supabase + Dexie docs
- LWW semantics: MEDIUM — row-level LWW is locked (D-02) but requirement text says "field level"; discrepancy flagged for planner
- pg_cron availability: LOW — tier-dependent; Edge Function fallback mitigates

**Research date:** 2026-04-18
**Valid until:** ~2026-05-18 (30 days for stable stack; sooner if Supabase-js or Dexie ship major versions — neither expected imminently)
