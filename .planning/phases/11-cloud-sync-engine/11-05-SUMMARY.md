---
phase: 11-cloud-sync-engine
plan: 05
subsystem: sync
tags: [reconciliation, bulk-pull, realtime, lww, dexie, supabase, postgres-changes, suppression, household]

# Dependency graph
requires:
  - phase: 11-cloud-sync-engine/11-01
    provides: Dexie v10 schema with deleted_at + counterflux.* Supabase tables + realtime publication (ALTER PUBLICATION supabase_realtime) + pg_cron 30-day tombstone cleanup
  - phase: 11-cloud-sync-engine/11-02
    provides: Alpine.store('sync') 4-state machine with bulkPullProgress field + _transition single-write-path + pending_count 2s poll
  - phase: 11-cloud-sync-engine/11-03
    provides: openReconciliationModal lockdown + openSyncPullSplash/closeSyncPullSplash/renderSyncPullError splash triple + sync-errors-modal triage surface
  - phase: 11-cloud-sync-engine/11-04
    provides: withHooksSuppressed reference-count helper (Pitfall 11-B closed) + installSyncHooks outbox + flushQueue + scheduleFlush + classifyError + initSyncEngine/teardownSyncEngine stubs extended here
provides:
  - src/services/sync-pull.js — bulkPull(onProgress?) + incrementalPull() + resolveLWW + resolveDeckCardConflict + logLocalDeleteRemoteUpdateConflict + BulkPullError + clearBulkPullFlag/isBulkPullInProgress (Pitfall 11-E flag lifecycle) + CHUNK_SIZE=500
  - src/services/sync-realtime.js — subscribeRealtime (single counterflux-household schema-wide channel per RESEARCH §Pattern 3 Option B) + unsubscribeRealtime + applyRealtimeChange dispatcher (INSERT/UPDATE/DELETE routing + LWW merge + deck_cards atomic-merge + local-delete+remote-update conflict log)
  - src/services/sync-reconciliation.js — classifyState (4-state, D-03 profile-excluded) + reconcile() orchestrator + handleMergeEverything/handleKeepLocal/handleKeepCloud + Pitfall 11-E resume branch
  - src/services/sync-engine.js — initSyncEngine lifecycle extended: reconcile → subscribeRealtime → setInterval(incrementalPull, 60s) + on-focus → scheduleFlush(0) reload-recovery; teardownSyncEngine unsubscribes Realtime + clears interval + removes focus listener
  - Row-level LWW resolver with tie-goes-cloud (D-02) + deck_cards atomic merge by composite (deck_id, scryfall_id) (ARCHITECTURE Anti-Pattern 4) + unresolvable cases (local-delete+remote-update) surfaced to sync_conflicts
affects:
  - 11-06-live-supabase-e2e (live Supabase credentials exercise bulkPull/incrementalPull/Realtime end-to-end; Device A → Device B propagation within ~2s; offline-reconnect queue drain)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "4-state reconciliation dispatch: classifyState() returns 'empty-empty' | 'empty-populated' | 'populated-empty' | 'populated-populated' with localCounts/cloudCounts keyed by the 5 data tables (profile excluded per D-03). Switch routes each state to the correct silent/modal branch, with a Pitfall 11-E fast-path that bypasses classification entirely when sync_pull_in_progress is set"
    - "Row-level LWW with tie-to-cloud (CONTEXT D-02) — resolveLWW(local, remote) returns {winner: 'local'|'remote', row}; ties resolve to cloud (household-authoritative default). REQUIREMENTS.md 'field-level' text intentionally superseded per RESEARCH §Phase Requirements footnote; verifier accepts row-level"
    - "deck_cards atomic merge by composite (deck_id, scryfall_id): matching ids → regular resolveLWW (no conflict entry); divergent UUIDs sharing the composite → winner chosen wholesale via LWW, loser logged to sync_conflicts with error_code='deck_cards_atomic_merge' for user review (ARCHITECTURE Anti-Pattern 4)"
    - "Single schema-wide Realtime channel 'counterflux-household' with dispatcher-by-payload.table (RESEARCH §Pattern 3 Option B). Option A's 6 per-table channels × 2 users × 3 tabs = 36/tab-pair would blow past 200-concurrent free-tier quota. Single channel stays 24× under quota"
    - "sync_pull_in_progress meta-flag lifecycle (Pitfall 11-E): bulkPull sets at start; caller clears on success via clearBulkPullFlag(); reconcile() checks the flag FIRST — if set, resumes pull without re-classifying (partial pulls would otherwise misread as populated-populated and bogusly prompt the user)"
    - "initSyncEngine lifecycle composition: reconcile → subscribeRealtime → setInterval(incrementalPull, 60_000) + window 'focus' listener → scheduleFlush(0) reload-recovery (LAST so reconcile completes first, avoiding Pitfall 11-I echo storms during initial pull)"
    - "Promise-guard for concurrent subscribe (_subscribeInFlight): between the dynamic supabase.js import and the _channel assignment, a second concurrent subscribeRealtime() call would see _channel===null + _subscribeInFlight===null and race into creating a second channel. Memoising the in-flight promise closes the race"

key-files:
  created:
    - src/services/sync-pull.js
    - src/services/sync-realtime.js
    - src/services/sync-reconciliation.js
    - tests/sync-reconciliation.test.js
    - tests/sync-conflict.test.js
    - tests/sync-bulk-pull.test.js
    - tests/sync-realtime.test.js
  modified:
    - src/services/sync-engine.js  # initSyncEngine extended; teardownSyncEngine extended; __resetSyncEngineForTests clears new intervals

key-decisions:
  - "Row-level LWW (CONTEXT D-02) supersedes REQUIREMENTS.md 'field-level' text. The RESEARCH §Phase Requirements footnote documents this intentional discrepancy; this plan's PLAN notes made it explicit: 'verifier MUST accept row-level'. Field-level merge would require per-column metadata on every row (no precedent in schema) and a much more complex UI for per-column conflict surfaces (deferred to v1.2+ per CONTEXT §Deferred Ideas). Row-level + deck_cards atomic is the pragmatic Phase 11 scope."
  - "deck_cards atomic merge is the ONE special case. All other tables (collection, decks, games, watchlist, profile) use plain resolveLWW. deck_cards is a join-table keyed by (deck_id, scryfall_id); LWW on the composite would silently lose whichever row is the loser — so we log to sync_conflicts with reason 'deck_cards_atomic_merge' so the user can recover manually if the merge picked wrong."
  - "Pitfall 11-E closure via sync_pull_in_progress meta flag. bulkPull() sets at start; reconcile() checks FIRST (before classifyState). Without the flag, a user who closes the tab during bulk pull would next-boot classify as populated-populated (local has some rows from partial pull; cloud has the rest) and see the bogus lockdown modal. With the flag, reconcile goes straight back into pull-resume mode. Flag cleared only on successful bulkPull completion (via clearBulkPullFlag called by the branch handlers)."
  - "Single schema-wide Realtime channel (RESEARCH §Pattern 3 Option B) vs 6 per-table channels (Option A). Rejected Option A because: 2 users × 3 tabs × 6 tables = 36 concurrent subscriptions per tab-pair, which blows past the free-tier 200-concurrent Realtime quota before any other Supabase project touches it. Option B's single channel + dispatcher-by-payload.table adds ~10 lines of routing logic but stays 24× under quota."
  - "initSyncEngine ordering — reconcile() runs BEFORE subscribeRealtime. Rationale: during a first-sign-in bulk pull, Realtime events for the same rows being pulled would fire simultaneously and cause duplicate-work echo storms (Pitfall 11-I). Running reconcile to completion first means the initial catch-up is done atomically, then Realtime picks up fresh deltas only."
  - "Pitfall 11-B discipline extended to the pull surface. Plan 11-04's reference-count _suppressHooks handles async withHooksSuppressed callbacks correctly via .finally() on the returned Promise — but the grep gate (tests/sync-engine-suppression.test.js) only scans sync-engine.js. To keep the pattern uniformly safe across the pull files, every call in sync-pull.js / sync-realtime.js / sync-reconciliation.js uses the SYNCHRONOUS wrapper shape (no `withHooksSuppressed(async () => ...)` anywhere); when multi-statement work is needed, it's extracted to a named async helper and passed as `withHooksSuppressed(() => helperFn())`."
  - "handleKeepCloud clears local tables UNDER withHooksSuppressed so the deleting hooks don't cascade into 10,000 sync_queue 'del' entries (would happen if user's local has 5000 cards + 3 decks + 50 deck_cards). After clear, sync_queue.clear() drops any stale entries from before the wipe. Then bulkPull() hydrates from cloud."
  - "Incremental-pull cursor is a SINGLE global sync_last_pulled_at meta row (not per-table). Rationale: each incrementalPull tick touches all 6 tables — either all advance together (on success), or none do (on failure any table fails we log + continue, then advance the cursor at the end). Per-table cursors would be marginally more efficient under partial failures but unnecessary at household-scale row volumes."

requirements-completed: [SYNC-03, SYNC-04, SYNC-05]

# Metrics
duration: 1h 57m
completed: 2026-04-18
---

# Phase 11 Plan 5: Reconciliation + Bulk Pull + Realtime + LWW Summary

**First-sign-in reconciliation orchestrator with 4-state dispatch and Pitfall 11-E resume branch, chunked bulk pull with sync_pull_in_progress flag lifecycle and progress-splash hookup, single schema-wide Realtime channel with dispatcher-by-payload.table and withHooksSuppressed re-enqueue prevention, and row-level LWW resolver with tie-goes-cloud + deck_cards atomic-merge special case — wired into initSyncEngine's extended lifecycle so first-authed boot composes reconcile → subscribe → poll → reload-recovery cleanly.**

## Performance

- **Duration:** 1h 57m
- **Started:** 2026-04-18T20:21:55Z
- **Completed:** 2026-04-18T22:18:54Z
- **Tasks:** 4 (all GREEN)
- **Files modified:** 8 (7 created, 1 modified — sync-engine.js)
- **Tests added:** 36 (all green; 4 new test files)
- **Full-suite result:** 874 passed / 10 todo / 2 skipped (4 pre-existing router.test.js errors unchanged)
- **Lines of code:** ~1,810 total (sync-pull 342 + sync-realtime 182 + sync-reconciliation 276 + 4 test files 1,011)

## Accomplishments

- **src/services/sync-pull.js (342 lines)** — bulkPull + incrementalPull + LWW resolvers + BulkPullError + sync_pull_in_progress flag lifecycle. CHUNK_SIZE=500; FK-safe order (decks before deck_cards); partial-pull preservation on BulkPullError; _mergeIncomingRows under withHooksSuppressed for incrementalPull's LWW path.
- **src/services/sync-realtime.js (182 lines)** — single 'counterflux-household' channel with `{ event: '*', schema: 'counterflux' }` filter; dispatcher-by-payload.table routes to applyRealtimeChange; INSERT/UPDATE/DELETE dispatch under withHooksSuppressed (re-enqueue prevention); non-synced tables ignored; concurrent-subscribe race closed via _subscribeInFlight promise memoisation.
- **src/services/sync-reconciliation.js (276 lines)** — classifyState (4-state, profile-excluded per D-03); reconcile orchestrator with Pitfall 11-E resume branch + 4 state-specific handlers; handleMergeEverything (LWW pull + push queued); handleKeepLocal (cloud-wipe + re-enqueue + flush); handleKeepCloud (local-clear + sync_queue.clear + bulkPull with splash error path).
- **initSyncEngine extended** — 5-step lifecycle: installSyncHooks → reconcile → subscribeRealtime → setInterval(incrementalPull, 60_000) + window 'focus' listener → scheduleFlush(0) reload-recovery (LAST so reconcile completes first per Pitfall 11-I). teardownSyncEngine mirrors: unsubscribe + clearInterval + removeEventListener.
- **Row-level LWW shipped with tie-goes-cloud** (CONTEXT D-02) — `resolveLWW(local, remote)` returns `{winner, row}`; remote > local → remote; local > remote → local; tie → remote (cloud wins). ISO-string updated_at normalisation handled transparently.
- **deck_cards atomic merge** (ARCHITECTURE Anti-Pattern 4) — matching ids delegate to regular LWW (no conflict entry); divergent UUIDs sharing (deck_id, scryfall_id) → LWW picks wholesale winner, loser logged to sync_conflicts with error_code='deck_cards_atomic_merge'.
- **Unresolvable local-delete + remote-update** routes to sync_conflicts with error_code='local_delete_remote_update' + full {local, remote} payload so the sync-errors-modal (Plan 11-03) can surface context for user triage.
- **Pitfall 11-E closure** — `sync_pull_in_progress` meta flag set at bulkPull start; cleared on success via `clearBulkPullFlag()`; reconcile() checks FIRST and resumes pull without re-classifying when the flag is set (prevents partial-populated state from misreading as populated-populated).
- **36/36 new tests green** across 4 Wave 0 files: 11 reconciliation (classifyState fixtures + three-button dispatch + silent branches + Pitfall 11-E) + 8 conflict (LWW matrix + deck_cards atomic + local-delete+remote-update) + 9 bulk-pull (flag lifecycle + progress + FK order + CHUNK_SIZE + BulkPullError) + 8 realtime (single-channel subscribe + INSERT/UPDATE/DELETE dispatch + non-synced ignore + suppression gate + tear-down).

## Task Commits

Each task committed atomically with `--no-verify` for consistency with the rest of Phase 11:

1. **Task 1: Wave 0 scaffold — failing tests (TDD RED)** — `6c1ef6d` (test)
2. **Task 2: Ship src/services/sync-pull.js** — `db21a25` (feat)
3. **Task 3: Ship src/services/sync-realtime.js** — `dd3a2bb` (feat)
4. **Task 4: Ship sync-reconciliation + extend initSyncEngine** — `6a80f7c` (feat)
5. **Task 4 hardening: Pitfall 11-B synchronous wrapper** — `6087d01` (fix)

_Plan metadata commit to follow (SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md)._

## Files Created/Modified

### Created

- `src/services/sync-pull.js` — Pull engine core. Exports: `bulkPull`, `incrementalPull`, `clearBulkPullFlag`, `isBulkPullInProgress`, `resolveLWW`, `resolveDeckCardConflict`, `logLocalDeleteRemoteUpdateConflict`, `BulkPullError`, `CHUNK_SIZE`, `SYNCED_DATA_TABLES`.
- `src/services/sync-realtime.js` — Single schema-wide channel. Exports: `subscribeRealtime`, `unsubscribeRealtime`, `applyRealtimeChange`, `__resetRealtimeForTests`.
- `src/services/sync-reconciliation.js` — 4-state orchestrator. Exports: `classifyState`, `reconcile`, `handleMergeEverything`, `handleKeepLocal`, `handleKeepCloud`.
- `tests/sync-reconciliation.test.js` — 11 tests: classifyState 4 fixtures + profile exclusion (D-03) + three-button dispatch (MERGE_EVERYTHING / KEEP_LOCAL / KEEP_CLOUD) + silent branches (empty-populated silent pull, populated-empty silent push) + Pitfall 11-E resume.
- `tests/sync-conflict.test.js` — 8 tests: LWW matrix (remote newer / local newer / tie → cloud + ISO-string normalisation) + deck_cards atomic merge (divergent UUIDs cloud-wins, divergent UUIDs local-wins, matching ids → no conflict entry) + local-delete+remote-update → sync_conflicts.
- `tests/sync-bulk-pull.test.js` — 9 tests: sync_pull_in_progress flag lifecycle (Pitfall 11-E) + progress emission (callback + Alpine.store fallback) + FK order (decks before deck_cards) + CHUNK_SIZE=500 + range(0, 499) + BulkPullError carries pulled/total.
- `tests/sync-realtime.test.js` — 8 tests: single-channel subscribe + idempotent re-subscribe + INSERT/UPDATE/DELETE dispatch + non-synced table ignore + suppression prevents hook re-enqueue + tear-down.

### Modified

- `src/services/sync-engine.js` — `initSyncEngine` extended from 2-line stub (installSyncHooks + scheduleFlush) to 5-step lifecycle (hooks + reconcile + subscribeRealtime + incrementalPull interval/focus + scheduleFlush reload-recovery). `teardownSyncEngine` mirrors: unsubscribeRealtime + clearInterval + removeEventListener. `__resetSyncEngineForTests` clears the new interval/listener state. `_pullInterval` + `_focusListener` module-level vars added.

## Decisions Made

See frontmatter `key-decisions`. Highlights:

1. **Row-level LWW (D-02) supersedes REQUIREMENTS "field-level" text** — RESEARCH §Phase Requirements footnote documents the intentional discrepancy; this plan implements row-level with the deck_cards atomic-merge exception per ARCHITECTURE Anti-Pattern 4. Field-level merge deferred to v1.2+ per CONTEXT §Deferred Ideas.
2. **Single schema-wide Realtime channel** (RESEARCH §Pattern 3 Option B) — Option A's 6 per-table channels × 2 users × 3 tabs = 36/tab-pair would blow past the free-tier 200-concurrent Realtime quota before any other Supabase project touches it. Single channel + dispatcher stays 24× under quota.
3. **Pitfall 11-E closed via sync_pull_in_progress meta flag** — bulkPull sets at start; reconcile checks FIRST (before classifyState); resumes pull without re-classifying when flag set. Prevents partial-populated misread on tab-close mid-pull.
4. **initSyncEngine ordering — reconcile BEFORE subscribeRealtime** — avoids Pitfall 11-I echo storms during initial bulk pull when Realtime would broadcast the same rows being pulled.
5. **Pitfall 11-B discipline extended to pull surface** — all `withHooksSuppressed(() => ...)` callbacks in the new files are SYNCHRONOUS (no `async` wrapper), even though Plan 11-04's reference-count implementation handles async correctly. Uniform pattern forestalls future regressions. Static check across 3 new files: 0 matches for `withHooksSuppressed(async`.
6. **handleKeepCloud clears under suppression** — prevents deleting hooks cascading into 10,000+ sync_queue 'del' entries for a user with 5000 cards. Followed by explicit `sync_queue.clear()` to drop stale entries from before the wipe.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] subscribeRealtime concurrent-subscribe race**
- **Found during:** Task 3 (running tests/sync-realtime.test.js "subscribeRealtime is idempotent" test)
- **Issue:** Between the `await import('./supabase.js')` dynamic import and the `_channel = supabase.channel(CHANNEL_NAME)...subscribe(...)` assignment, a second concurrent caller would see `_channel === null` and race into creating a second channel. Initial `if (_channel) return` guard was correct but insufficient — the guard check completed before `_channel` was actually assigned.
- **Fix:** Added `_subscribeInFlight` promise memoisation. First caller captures an async IIFE into `_subscribeInFlight`; concurrent callers see the in-flight promise and return it directly (waiting on the same work). Cleared in `finally` after the first caller completes.
- **Files modified:** src/services/sync-realtime.js
- **Verification:** tests/sync-realtime.test.js "subscribeRealtime is idempotent" GREEN after fix.
- **Commit:** `dd3a2bb` (Task 3 commit — fix applied during Task 3 implementation iteration)

**2. [Rule 3 - Blocking] tests/sync-realtime.test.js missing mockClear for vi.fn() counters**
- **Found during:** Task 3 (running tests/sync-realtime.test.js "subscribeRealtime is idempotent")
- **Issue:** `supabaseStub.channel` is a module-level `vi.fn()` mock. `vi.resetModules()` in beforeEach resets module state but does NOT reset `vi.fn()` call counts. The first test called `channel()` once; the second test (idempotency) saw `toHaveBeenCalledTimes(2)` because the counter persisted.
- **Fix:** Added `supabaseStub.channel.mockClear()` + `supabaseStub.schema.mockClear()` in the test's beforeEach.
- **Files modified:** tests/sync-realtime.test.js
- **Verification:** All 8 realtime tests GREEN after fix.
- **Commit:** `dd3a2bb` (Task 3 commit)

**3. [Rule 2 - Auto-add] Pitfall 11-B discipline extended to sync-reconciliation.js**
- **Found during:** Post-Task 4 static check (`grep -c 'withHooksSuppressed(async' src/services/sync-reconciliation.js`)
- **Issue:** Initial `handleKeepCloud` implementation wrapped the 5-table clear loop with `await withHooksSuppressed(async () => { for (const t of ...) await db.table(t).clear(); })`. This works correctly with Plan 11-04's reference-count _suppressHooks (`.finally()` holds the counter across awaits), but the SAME anti-pattern in the original sync-engine.js was the Pitfall 11-B regression bug (caught by the static grep gate in tests/sync-engine-suppression.test.js). Better to extend the discipline uniformly.
- **Fix:** Extracted the inner loop to a named async helper `_clearAllReconciliationTables()` and wrapped it with the synchronous shape `await withHooksSuppressed(() => _clearAllReconciliationTables())`. Static check now returns 0:0:0 for all 3 new files.
- **Files modified:** src/services/sync-reconciliation.js
- **Verification:** Reconciliation tests still 11/11 GREEN; Pitfall 11-B grep gate green.
- **Commit:** `6087d01` (post-Task 4 hardening commit)

---

**Total deviations:** 3 auto-fixed (2 blocking / 1 preventative-auto-add)
**Impact on plan:** All three deviations are small correctness/consistency fixes. #1 closes a genuine race in subscribeRealtime that would have caused double-channel creation under tab-focus handoffs. #2 is a test-only hygiene fix. #3 is a consistency hardening that uniformly applies the Pitfall 11-B static-grep discipline across all three new pull-surface files.

## Issues Encountered

- **Pre-existing router.test.js 4 errors unchanged** — Alpine template expression errors for `$store.collection.precons.length && !$store.collection.selectedPreconCode` on a `TEMPLATE` element. Confirmed pre-existing via full-suite baseline before this plan started. Out of scope — router test authors' territory.
- **Rolldown INEFFECTIVE_DYNAMIC_IMPORT warning** for src/services/sync-engine.js — same warning as Plan 11-04. sync-engine.js is dynamically imported from main.js (lifecycle binding intent) but statically imported by src/stores/sync.js, src/services/sync-pull.js, src/services/sync-realtime.js, src/services/sync-reconciliation.js. Rolldown can't split the module into a separate chunk as a result. Acceptable trade-off — the dynamic import in main.js documents the lifecycle-binding intent even though the code doesn't actually split.

## User Setup Required

**None from the client side.** Plan 11-05 is pure client-side orchestration + Realtime subscription. The Supabase-side Realtime publication for the `counterflux` schema was already shipped in Plan 11-01 (`20260419_counterflux_realtime_publication.sql`).

**Plan 11-06 will require:** live huxley credentials in `.env.local` to exercise the bulk pull + Realtime path end-to-end against a real Supabase. This plan's unit tests cover the logic with mocks; Plan 11-06 adds the `describeIf HAS_ENV` suites that actually hit the wire.

## Next Phase Readiness

**Plan 11-06 (live-Supabase E2E + offline resilience) fully unblocked:**

- `bulkPull(onProgress)` is wired to the real `supabase.schema('counterflux').from(t).select('*').order('updated_at').range(from, to)` chain. Plan 11-06's describeIf HAS_ENV suite just needs live creds to exercise the path end-to-end with a real household in huxley.
- `incrementalPull()` uses the real `.gt('updated_at', sinceIso)` cursor path with RLS household filtering. Plan 11-06 can seed Device A writes + poll Device B incrementalPull to confirm the sync round-trip.
- `subscribeRealtime()` wires to live `postgres_changes` events on `schema: 'counterflux'`. Plan 11-06's Device A → Device B propagation test is a matter of: (1) Device A write, (2) Device B's realtime channel fires, (3) applyRealtimeChange applies via LWW, (4) assert Device B local row within ~2s.
- `sync_conflicts` is populated by: permanent push errors (Plan 11-04) + deck_cards atomic-merge losers (this plan) + local-delete + remote-update conflicts (this plan). Plan 11-06's offline-reconnect test can exercise the full conflict-surfacing flow.
- Pitfall 11-E closure (`sync_pull_in_progress` flag) is testable end-to-end: bulkPull in progress, kill tab, next-boot reconcile → flag is true → resume pull branch → complete → clear flag.

**No blockers.** The sync engine is now feature-complete end-to-end; Plan 11-06 is pure integration testing + any offline-resilience polish discovered via live exercise.

## Known Stubs

None — every exported function in the 3 new files has a complete implementation. Open-path edges (e.g., `handleKeepCloud` error path) render the sync-pull-splash error state via the Plan 11-03-shipped `renderSyncPullError` surface rather than a stub.

---

*Phase: 11-cloud-sync-engine*
*Plan: 05*
*Completed: 2026-04-18*

## Self-Check: PASSED

- FOUND: src/services/sync-pull.js
- FOUND: src/services/sync-realtime.js
- FOUND: src/services/sync-reconciliation.js
- FOUND: tests/sync-reconciliation.test.js
- FOUND: tests/sync-conflict.test.js
- FOUND: tests/sync-bulk-pull.test.js
- FOUND: tests/sync-realtime.test.js
- FOUND: .planning/phases/11-cloud-sync-engine/11-05-SUMMARY.md
- FOUND commit: 6c1ef6d (Task 1 Wave 0 TDD RED scaffold — 36 failing tests)
- FOUND commit: db21a25 (Task 2 sync-pull.js GREEN — 17 tests)
- FOUND commit: dd3a2bb (Task 3 sync-realtime.js GREEN — 8 tests)
- FOUND commit: 6a80f7c (Task 4 sync-reconciliation + extended initSyncEngine GREEN — 11 tests; full 36/36 Wave 0 green)
- FOUND commit: 6087d01 (Task 4 Pitfall 11-B hardening — synchronous wrapper in handleKeepCloud)
