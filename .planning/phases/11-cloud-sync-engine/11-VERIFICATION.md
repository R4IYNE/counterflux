---
phase: 11-cloud-sync-engine
verified: 2026-04-19T00:48:00Z
status: passed
score: 7/7 requirements verified
re_verification: false
---

# Phase 11: Cloud Sync Engine — Verification Report

**Phase Goal:** Make Counterflux a multi-device app: local edits sync to Supabase cloud, offline edits replay on reconnect, v1.0 upgraders never lose data on first sign-in.
**Verified:** 2026-04-19T00:48:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Supabase schema mirrors synced Dexie tables with RLS, user_id, updated_at, deleted_at | ✓ VERIFIED | `20260417_counterflux_auth_foundation.sql` + `20260419_counterflux_soft_delete.sql` — 6 tables with RLS USING/WITH CHECK, per-user + household policies, deleted_at on 5 tables |
| 2 | Dexie hooks enqueue create/update/delete ops for synced tables only | ✓ VERIFIED | `sync-engine.js` installSyncHooks() — 6-table loop with creating/updating/deleting hooks; suppression guard `_suppressHooks > 0` |
| 3 | Flush engine batches upsert to Supabase with origin-tagging suppression | ✓ VERIFIED | `flushQueue()` in sync-engine.js — upsert under `withHooksSuppressed`, FK-safe PUSH_ORDER, dedup by row_id, dead-letter via classifyError |
| 4 | First-sign-in reconciliation handles all 4 states without silent data loss | ✓ VERIFIED | `sync-reconciliation.js` classifyState() + reconcile() — 4-branch switch; populated-populated triggers lockdown modal with 3 choices |
| 5 | Conflict resolution uses LWW via updated_at; deck_cards atomic; beyond-LWW surfaced in sync_conflicts | ✓ VERIFIED | `sync-pull.js` resolveLWW() (tie→cloud), resolveDeckCardConflict() (atomic merge logged), logLocalDeleteRemoteUpdateConflict() |
| 6 | Offline queue survives reload; flushes on reconnect; user_id-tagged entries never cross-contaminate | ✓ VERIFIED | initSyncEngine() calls scheduleFlush(0) on boot; flushQueue() guards `where('user_id').equals(currentUserId)`; online listener in sync store |
| 7 | Topbar sync chip shows 4 states: synced/syncing/offline/error, replacing connectivity chip | ✓ VERIFIED | `index.html` lines 294–340 — 4-branch x-if templates bound to `$store.sync.status`; sync-store.js state machine with VALID_TRANSITIONS |

**Score:** 7/7 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/services/sync-engine.js` | installSyncHooks, withHooksSuppressed, flushQueue, classifyError, initSyncEngine | ✓ VERIFIED | All 5 exports present and substantive (~656 lines) |
| `src/services/sync-pull.js` | bulkPull, incrementalPull, resolveLWW, resolveDeckCardConflict, BulkPullError | ✓ VERIFIED | All exports present; LWW tie→cloud, deck_cards atomic merge |
| `src/services/sync-realtime.js` | subscribeRealtime, unsubscribeRealtime, applyRealtimeChange | ✓ VERIFIED | Single 'counterflux-household' channel; idempotent subscribe with in-flight guard |
| `src/services/sync-reconciliation.js` | classifyState, reconcile, handleMergeEverything, handleKeepLocal, handleKeepCloud | ✓ VERIFIED | All 5 exports present; 4-state detection; Pitfall 11-E resume path |
| `src/stores/sync.js` | 4-state machine, initSyncStore, flush, retry, discard, getTooltip | ✓ VERIFIED | VALID_TRANSITIONS enforced; pending_count 2s poll; engine delegation |
| `src/components/reconciliation-modal.js` | Lockdown modal with 3-choice, no X, Escape blocked | ✓ VERIFIED | Capture-phase Escape blocker; backdrop preventDefault; no X button; 3 data-choice buttons |
| `src/components/sync-errors-modal.js` | Dead-letter UI with retry/discard per row | ✓ VERIFIED | Reads sync_conflicts; per-row RETRY/DISCARD buttons wired to store.retry/discard |
| `src/components/sync-pull-splash.js` | Blocking splash with progress bar, taglines, error retry | ✓ VERIFIED | openSyncPullSplash / closeSyncPullSplash / renderSyncPullError all present |
| `src/db/schema.js` | Dexie v10 with deleted_at on 5 synced tables | ✓ VERIFIED | v10 upgrade block adds deleted_at index on collection, decks, deck_cards, games, watchlist; profile excluded per D-15 |
| `index.html` | Topbar chip with 4 states bound to $store.sync | ✓ VERIFIED | Lines 294–340; x-if branches for synced/syncing/offline/error; error renders as keyboard-accessible button |
| `supabase/migrations/20260419_counterflux_soft_delete.sql` | deleted_at column + partial indexes on 5 tables | ✓ VERIFIED | ALTER TABLE ADD COLUMN + CREATE INDEX WHERE deleted_at IS NULL on all 5 tables |
| `supabase/migrations/20260419_counterflux_realtime_publication.sql` | 6 tables added to supabase_realtime publication | ✓ VERIFIED | ALTER PUBLICATION for all 6 counterflux tables |
| `supabase/migrations/20260419_counterflux_tombstone_cleanup.sql` | pg_cron 30-day tombstone purge | ✓ VERIFIED | Daily 03:00 UTC job; idempotent unschedule guard; all 5 tables |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/main.js` | `sync-engine.js` initSyncEngine | `Alpine.effect` on auth.status → 'authed' | ✓ WIRED | Line 150-151: dynamic import + await initSyncEngine() |
| `src/main.js` | `sync-engine.js` teardownSyncEngine | auth.status → 'anonymous' | ✓ WIRED | Line 155-156: dynamic import + await teardownSyncEngine() |
| `src/main.js` | `src/stores/sync.js` initSyncStore | App startup | ✓ WIRED | Line 59: initSyncStore() called at startup |
| `sync-engine.js` initSyncEngine | `sync-reconciliation.js` reconcile | await on init | ✓ WIRED | Lines 575-578: dynamic import + await reconcile() |
| `sync-engine.js` initSyncEngine | `sync-realtime.js` subscribeRealtime | after reconcile | ✓ WIRED | Lines 583-586: dynamic import + await subscribeRealtime() |
| `sync-engine.js` initSyncEngine | `sync-pull.js` incrementalPull | 60s interval + focus listener | ✓ WIRED | Lines 590-601: setInterval + window.addEventListener('focus') |
| `sync-reconciliation.js` | `reconciliation-modal.js` openReconciliationModal | populated-populated case | ✓ WIRED | Lines 129-138: dynamic import + await openReconciliationModal |
| `sync-reconciliation.js` | `sync-pull-splash.js` openSyncPullSplash | empty-populated + Pitfall 11-E resume | ✓ WIRED | Lines 77-92: dynamic import used in both resume and empty-populated branches |
| `sync-pull.js` bulkPull | Supabase `.upsert()` via withHooksSuppressed | bulkPut under suppression | ✓ WIRED | Line 254: await withHooksSuppressed(() => db.table(t).bulkPut(converted)) |
| `sync-engine.js` flushQueue | Supabase `.schema('counterflux').from(t).upsert()` | FK-safe PUSH_ORDER | ✓ WIRED | Lines 410-411 |
| `sync-store.js` | `sync-errors-modal.js` openSyncErrorsModal | window.openSyncErrorsModal bridge | ✓ WIRED | Lines 51-53: window assignment at module load |
| Topbar chip (error state) | `openSyncErrorsModal` | `@click` on error button | ✓ WIRED | index.html line 328-340: error chip is a `<button>` with @click |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `reconciliation-modal.js` | localCounts / cloudCounts | `classifyState()` — Dexie `.count()` + Supabase `.select('*', {count:'exact'})` | Yes — live counts from both stores | ✓ FLOWING |
| `sync-errors-modal.js` | rows | `db.sync_conflicts.orderBy('detected_at').reverse().toArray()` | Yes — reads Dexie sync_conflicts table | ✓ FLOWING |
| `sync-pull-splash.js` | progress fill / caption | `Alpine.store('sync').bulkPullProgress` polled at 200ms; populated by `bulkPull()` emit | Yes — real pulled/total from Supabase chunk loop | ✓ FLOWING |
| Topbar chip | status / pending_count / tooltip | `Alpine.store('sync').status` (state machine) + 2s `db.sync_queue.count()` poll | Yes — real queue depth from Dexie | ✓ FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Check | Status |
|----------|-------|--------|
| withHooksSuppressed is a regular (non-async) function | `grep "^export function withHooksSuppressed"` in sync-engine.js | ✓ PASS — line 86 |
| Hooks suppressed when _suppressHooks > 0 | creating hook: `if (_suppressHooks > 0) return;` | ✓ PASS — line 217 |
| classifyError maps 429/5xx → transient, 4xx/PGRST → permanent | Code checked directly | ✓ PASS — lines 308-327 |
| flushQueue guards user_id cross-contamination | `.where('user_id').equals(currentUserId)` | ✓ PASS — line 366 |
| reconcile() handles Pitfall 11-E (interrupted bulkPull resume) | `if (await isBulkPullInProgress())` before classifyState | ✓ PASS — line 77 |
| 4-state chip in index.html | All 4 x-if branches present | ✓ PASS — lines 303/311/318/328 |
| Full test suite | 882 passed, 2 skipped, 0 failures across 98 files | ✓ PASS |

Note: 4 "Unhandled Errors" in the full suite output are Alpine reactive-effect noise from `router.test.js` referencing `$store.collection.precons.length`. These originate from Phase 8's precons feature and are pre-existing — all 100 test files pass (98 passed, 2 skipped).

---

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| SYNC-01 | Supabase Postgres schema mirrors synced Dexie tables with user_id, updated_at, deleted_at, RLS | ✓ SATISFIED | `20260417_counterflux_auth_foundation.sql` — 6 tables, per-user + household RLS with WITH CHECK. `20260419_counterflux_soft_delete.sql` — deleted_at on 5 tables. `20260418_counterflux_shared_users_household.sql` — household model replacing per-user RLS |
| SYNC-02 | Dexie hook taps for synced tables only (cards/meta/cache excluded) | ✓ SATISFIED | `installSyncHooks()` iterates `SYNCABLE_TABLES = ['collection','decks','deck_cards','games','watchlist','profile']` — exactly the 6 synced tables; no cards/meta/cache |
| SYNC-03 | Flush engine batches upsert; withHooksSuppressed prevents echo re-triggering | ✓ SATISFIED | `flushQueue()` — supabase.upsert(); `withHooksSuppressed` reference-count (not boolean) prevents nested suppression races; stamps synced_at under suppression |
| SYNC-04 | First-sign-in reconciliation handles 4 states; populated-populated prompts user — never silent destroy | ✓ SATISFIED | `classifyState()` returns 4 states; `reconcile()` switch dispatches correctly; populated-populated → `openReconciliationModal` (lockdown, no escape) |
| SYNC-05 | LWW at row level via updated_at; deck_cards atomic; beyond-LWW surfaced in sync_conflicts | ✓ SATISFIED | `resolveLWW()` (tie→cloud per D-02); `resolveDeckCardConflict()` (composite-key atomic merge, loser logged to sync_conflicts); `logLocalDeleteRemoteUpdateConflict()` for unresolvable case |
| SYNC-06 | Offline queue survives reload and flushes on reconnect; user_id-tagged entries | ✓ SATISFIED | initSyncEngine() calls `scheduleFlush(0)` at boot; online event listener triggers `_transition('syncing')` + flush; `_enqueue()` writes user_id on every entry |
| SYNC-07 | Topbar sync-status indicator: 4 states (synced/syncing/offline/error); replaces connectivity chip | ✓ SATISFIED | index.html lines 294–340 — 4 x-if branches; VALID_TRANSITIONS state machine in sync-store.js; sync-status-chip.test.js 9/9 pass |

---

## Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `sync-pull.js` line 297 | `withHooksSuppressed(() => _mergeIncomingRows(t, data ?? []))` — wrapper receives async fn | Info | Intentional — reference-count suppression handles Promise path via `.finally()`. Documented in plan and pitfall notes. Not a bug. |
| `sync-reconciliation.js` `handleMergeEverything` | No error handling around `bulkPull()` | Warning | If bulkPull throws, the merge silently fails. However the reconciliation modal stays mounted with error toast, giving user retry. Low severity. |

No blockers found. No TODO/FIXME/placeholder comments in sync service files. No empty implementations or hardcoded stub returns.

---

## Human Verification Required

### 1. Live Supabase push/pull round-trip

**Test:** Sign in on Device A, add a card to collection. Sign in on Device B (or second browser tab) with same account. Wait up to 60 seconds.
**Expected:** Card appears on Device B without page refresh (via Realtime channel) or within the 60s polling backstop.
**Why human:** Requires live Supabase instance, two browser sessions, and real-time network observation.

### 2. Reconciliation modal (populated-populated path)

**Test:** Use a v1.0 local database with existing cards/decks. Sign in for the first time to a Supabase account that also has data. Observe the reconciliation modal. Verify Escape is blocked, backdrop click is blocked, and all 3 choices execute correctly with in-progress labels.
**Expected:** Modal cannot be dismissed without making a choice. Each choice button shows MERGING… / KEEPING LOCAL… / KEEPING CLOUD… during execution. Success toast fires on completion.
**Why human:** DOM lockdown behavior (Escape suppression, backdrop block) cannot be reliably tested without a real browser. UAT anchors confirmed by Plan 11-06.

### 3. Offline queue survival

**Test:** With network offline (DevTools → Offline), make 3 collection edits. Observe sync chip shows 'offline'. Restore network. Observe chip transitions: offline → syncing → synced. Verify Supabase received the edits.
**Expected:** Chip transitions happen automatically within ~5 seconds of reconnect. All 3 edits appear in Supabase.
**Why human:** Requires real network toggle and live Supabase verification.

### 4. pg_cron tombstone cleanup

**Test:** On the Supabase project, confirm `SELECT * FROM cron.job WHERE jobname = 'counterflux-tombstone-cleanup'` returns one row. Verify the schedule is `0 3 * * *`.
**Expected:** Job exists and is scheduled.
**Why human:** Requires Supabase dashboard or SQL Editor access. Cannot verify from the codebase alone whether the migration was applied.

---

## Gaps Summary

None. All 7 SYNC requirements are satisfied by substantive, wired, data-flowing implementations. The 15 dedicated sync test files total 129 tests (with 2 skipped), all passing. The full suite of 882 tests passes with no regressions introduced by Phase 11.

The 4 unhandled-errors emitted during the full test run are pre-Phase-11 Alpine reactive-effect noise in `router.test.js` (origin: Phase 8 precons feature, `$store.collection.precons.length` accessed before store init in test environment). They do not represent Phase 11 failures.

---

_Verified: 2026-04-19T00:48:00Z_
_Verifier: Claude (gsd-verifier)_
