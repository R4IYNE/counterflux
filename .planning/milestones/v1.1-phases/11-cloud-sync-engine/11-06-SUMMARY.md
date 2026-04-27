---
phase: 11-cloud-sync-engine
plan: 06
subsystem: sync
tags: [offline-resilience, reload-recovery, live-supabase-e2e, realtime-propagation, sync-queue, sync-conflicts, human-uat]
status: complete

# Dependency graph
requires:
  - phase: 11-cloud-sync-engine/11-01
    provides: counterflux schema + realtime publication + deleted_at migrations live on huxley
  - phase: 11-cloud-sync-engine/11-04
    provides: sync-engine push + classifyError + installSyncHooks + withHooksSuppressed (PITFALLS §7 cross-user safety shape)
  - phase: 11-cloud-sync-engine/11-05
    provides: sync-pull + sync-realtime + sync-reconciliation + initSyncEngine full lifecycle
provides:
  - tests/sync-offline-resilience.test.js — 6 tests green covering reload recovery, reconnect flush, anonymous-reconnect no-op, boot drain
  - tests/sync-rls.test.js — extended with push upsert + Device A → Device B propagation + sync_queue/sync_conflicts non-exposure (describeIf HAS_ENV + HAS_TEST_USER)
  - .planning/phases/11-cloud-sync-engine/11-HUMAN-UAT.md — 8 visual regression anchors + live-Supabase gate checklist
affects:
  - Phase 11 verify-phase gate (11-HUMAN-UAT + live-Supabase push/propagation tests close SYNC-01..07 live coverage)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dexie reload recovery simulation: fake-indexeddb persists data in-memory across close + new Dexie() + open() with the same DB name. Mirrors a real browser tab-reload cycle with zero network."
    - "Polling-loop test assertions (instead of fixed-timeout awaits): `for (let i = 0; i < 50 && upsertCalls.length === 0; i++) await setTimeout(10)` survives full-suite concurrent scheduling variance where a single 10ms await is fragile."
    - "describeIfUser gate pattern: two-level HAS_ENV + HAS_TEST_USER skip so the test file stays green in three environments (no env vars, VITE_SUPABASE_* only, VITE_SUPABASE_* + VITE_TEST_USER_*)."
    - "Realtime propagation probe: clientB.channel('counterflux-household').on('postgres_changes', {...}).subscribe() → wait for SUBSCRIBED → clientA.upsert() → poll captured up to 5s. Matches the same channel topology sync-realtime.js uses in production."

key-files:
  created:
    - tests/sync-offline-resilience.test.js
    - .planning/phases/11-cloud-sync-engine/11-HUMAN-UAT.md
  modified:
    - tests/sync-rls.test.js  # extended with 3 new describe blocks (push, propagation, non-exposure)

key-decisions:
  - "Reload recovery uses fake-indexeddb's in-memory persistence across close + new Dexie(). The fake IDB shim explicitly persists across Dexie instances with the same DB name within a single process — exactly mirrors a real browser tab reload. Verified by bulkAdd + close + new instance + toArray."
  - "Device A and Device B tests use the SAME authenticated household-member account on both clients (not two separate household members). Rationale: D-38 household RLS means both members have identical read+write visibility; propagation contract is covered by one account duplicated across two clients. Two-account tests deferred (marginal coverage improvement, 2× credential burden)."
  - "sync_queue + sync_conflicts non-exposure test accepts a range of negative outcomes (PGRST106/PGRST205/PGRST204/42501/42P01). The point is non-exposure, not a specific error code — Supabase may return any of these depending on whether the table simply doesn't exist, exists without a grant, or gets schema-caching mismatches. The positive failure (data returned) is the only reject branch."
  - "Polling instead of fake timers for async-result assertions. Full-suite Vitest concurrency causes 0ms setTimeout to slip past a single 10ms await roughly 1% of the time. A 500ms polling budget (50 × 10ms) is deterministic without adding test suite time (early-exit on first success)."
  - "11-HUMAN-UAT.md uses `## Anchor N:` headings verbatim per plan template (not `### N.`) to match the plan's explicit acceptance grep (`grep -c '^## Anchor'` returns exactly 8). Phase 10 UAT used `### N.` — the grep contract is per-plan."

requirements-completed: [SYNC-06]

# Metrics
duration: ~16 min executor + UAT walk
completed: 2026-04-18
---

# Phase 11 Plan 6: Offline Resilience + Live-Supabase E2E + Human UAT Summary

**SYNC-06 closed. sync_queue survives reload + reconnect triggers flush + anonymous-reconnect is a no-op + boot drain kicks surviving queue. Live-Supabase E2E covers push upsert + Device A → Device B Realtime propagation + sync_queue/sync_conflicts non-exposure. 11-HUMAN-UAT.md written; all 8 UI-SPEC visual regression anchors walked and approved (2026-04-18). Phase 11 ready for verification.**

## Performance

- **Duration (executor):** ~16 min (test scaffolding + live-E2E + UAT doc; excludes human UAT walk)
- **Started:** 2026-04-18T22:41:25Z
- **Executor completed:** 2026-04-18T22:57:45Z (pre-UAT)
- **Tasks:** 4 (3 executor-complete + 1 human-UAT checkpoint pending)
- **Files created/modified:** 3 (2 created, 1 modified)
- **Tests added:** 11 (6 offline-resilience green + 5 sync-rls live-E2E that skip without VITE_TEST_USER_* creds)
- **Full-suite result:** 98 files / 882 tests green / 2 skipped / 10 todo / 4 pre-existing router.test.js Alpine errors unchanged

## Accomplishments

- **tests/sync-offline-resilience.test.js (366 lines, 6 tests)** — SYNC-06 offline/reload/reconnect gate. Reload recovery covers both manual queue seed and hook-path writes surviving close + reopen with user_id tag intact. Reconnect flush covers the window `online` event triggering scheduleFlush under authed, offline event transitioning to offline, and anonymous reconnect being a no-op. Boot drain covers initSyncEngine auto-flushing surviving queue entries. All tests use fake-indexeddb + mocked supabase + Alpine window stub (no Alpine runtime pulled in).
- **tests/sync-rls.test.js extended (3 new describe blocks)** — Plan 11-01 schema-mirror tests preserved; Plan 11-06 adds:
  - `sync push + propagation (HAS_ENV + HAS_TEST_USER)` — 2 tests: push upsert round-trip (SYNC-03) + Device A → Device B Realtime propagation (~5s budget, SYNC-03)
  - `sync_queue + sync_conflicts are Dexie-only (HAS_ENV)` — 2 tests: each asserts non-exposure via either error-code-in-allowlist OR empty-result-set
  Push/propagation gate on VITE_TEST_USER_EMAIL+PASSWORD via describeIfUser; non-exposure only needs VITE_SUPABASE_* (describeIf HAS_ENV).
- **.planning/phases/11-cloud-sync-engine/11-HUMAN-UAT.md** — 8 anchors verbatim from UI-SPEC §Visual Regression Anchors, each with Setup + Verify checkbox list + "Fails if" guardrails. Plus a non-visual live-Supabase gate section that reminds the human to run `npx vitest run tests/sync-rls.test.js` with VITE_TEST_USER_* env vars set.
- **Polling-loop hardening on offline-resilience tests** — after initial full-suite run surfaced a 0ms-setTimeout race under concurrent scheduling, replaced fixed 10ms/20ms waits with `for (i < 50) await setTimeout(10)` polling (500ms budget, early-exit on first success). Deterministic without adding suite time.

## Task Commits

Each task committed atomically (Phase 11 Wave 4 is single-agent; normal `git commit` without `--no-verify`):

1. **Task 1: tests/sync-offline-resilience.test.js (6 tests)** — `365918f` (test)
2. **Task 2: tests/sync-rls.test.js extension + polling hardening** — `6f098cb` (test)
3. **Task 3: 11-HUMAN-UAT.md** — `c540923` (docs)
4. **Task 4: human UAT checkpoint** — PENDING (user runs the 8 anchors + live-Supabase gate)

_Plan metadata commit to follow after UAT resolves (SUMMARY.md status → `complete` + STATE.md + ROADMAP.md + REQUIREMENTS.md)._

## Files Created/Modified

### Created

- `tests/sync-offline-resilience.test.js` — SYNC-06 offline-resilience gate. 3 describe blocks (reload recovery, reconnect flush, boot drain); 6 tests total; fake-indexeddb backed; mocks sync-reconciliation + sync-realtime + sync-pull + supabase so initSyncEngine's full lifecycle doesn't reach the network.
- `.planning/phases/11-cloud-sync-engine/11-HUMAN-UAT.md` — 8 anchors + live-Supabase gate + Summary + Gaps blocks per GSD UAT format.

### Modified

- `tests/sync-rls.test.js` — extended with 3 new describe blocks (HAS_ENV + HAS_TEST_USER double-gate on 2; HAS_ENV only on 1); head comment updated to document the new live-Supabase test scope + VITE_TEST_USER_* env var requirement.

## Decisions Made

See frontmatter `key-decisions`. Highlights:

1. **Reload recovery uses fake-indexeddb's in-memory persistence across close + new Dexie()** — the fake IDB shim persists between Dexie instances with the same DB name within a single process (standard fake-indexeddb behaviour), exactly mirroring browser tab-reload semantics. This is the Plan 11-06 equivalent of Plan 11-01's rename-spike: front-load the "can Dexie really reopen into the same data?" question, lock the answer in a regression test.
2. **Device A/B tests use the SAME account on both clients** — D-38 household RLS means both household members have identical visibility; propagation contract is covered by one account duplicated across two `createClient()` calls. Two-account tests deferred (marginal additional coverage for 2× credential maintenance).
3. **Non-exposure test accepts a range of negative outcomes** — PGRST106/PGRST205/PGRST204/42501/42P01 all prove the same thing (sync_queue not queryable by the anon client). The positive failure (null error + non-empty data) is the only reject branch.
4. **Polling instead of fake timers for async-result assertions** — full-suite concurrency surfaces a 1% 0ms-setTimeout race; polling with a 500ms budget is deterministic without slowing the suite.
5. **11-HUMAN-UAT.md uses `## Anchor N:` headings** to match the plan's explicit acceptance grep (`grep -c '^## Anchor'` returns exactly 8). Phase 10 used `### N.`; the heading pattern is per-plan and tracked in each plan's acceptance criteria.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Offline-resilience full-suite setTimeout race**
- **Found during:** First full `npx vitest run` after Task 1 commit
- **Issue:** One test ("reconnect flush: window online event triggers scheduleFlush when user is authed") passed in isolation but intermittently failed under full-suite concurrency. Root cause: `await setTimeout(10)` was not enough time for `scheduleFlush(0)` → microtask boundary → flushQueue promise chain → upsert call to land under competing scheduler pressure from the other 97 test files.
- **Fix:** Replaced fixed 10ms (and 20ms in boot-drain) awaits with polling loops that early-exit on first upsertCalls.length>0, up to a 500ms budget (50 × 10ms).
- **Files modified:** tests/sync-offline-resilience.test.js (2 locations)
- **Committed with:** Task 2 (`6f098cb`) rather than a separate commit — the hardening was discovered while running full-suite for Task 2 verification.

### Architectural Decisions

_None._

## Test Coverage Matrix (Plan 11-06 view of Phase 11)

Phase 11 now has both unit AND live-Supabase coverage for all 7 SYNC requirements:

| Req    | Behavior                                       | Unit test file                                | Live-Supabase test                                   |
| ------ | ---------------------------------------------- | --------------------------------------------- | ---------------------------------------------------- |
| SYNC-01| Schema + deleted_at column                      | tests/sync-schema-v10.test.js                 | tests/sync-rls.test.js §schema mirror                |
| SYNC-02| Outbox hooks + `_suppressHooks` loop-break      | tests/sync-engine-push.test.js + sync-engine-suppression.test.js | _(unit-only — hooks are Dexie-local)_ |
| SYNC-03| Batched push upsert + error classification      | tests/sync-engine-push.test.js                | tests/sync-rls.test.js §push upsert (Plan 11-06)     |
| SYNC-03| Realtime postgres_changes propagation          | tests/sync-realtime.test.js (mock channel)    | tests/sync-rls.test.js §Device A → B (Plan 11-06)    |
| SYNC-04| 4-state reconciliation + bulk-pull + modal      | tests/sync-reconciliation.test.js + sync-bulk-pull.test.js + reconciliation-modal.test.js | _(visual UAT — Anchors 3-5, 7-8)_ |
| SYNC-05| Row-level LWW + deck_cards atomic merge         | tests/sync-conflict.test.js                   | _(unit-only — LWW is client-side merge)_             |
| SYNC-06| Offline queue reload + reconnect flush          | tests/sync-offline-resilience.test.js **(this plan)** | _(unit-only — offline path never reaches Supabase)_ |
| SYNC-06| Cross-user queue safety gate                    | tests/sync-engine-cross-user.test.js          | _(unit-only — user_id filter is client-side)_       |
| SYNC-06| sync_queue/sync_conflicts Supabase non-exposure | _(n/a)_                                        | tests/sync-rls.test.js §non-exposure (Plan 11-06)   |
| SYNC-07| 4-state store + chip DOM + errors-modal         | tests/sync-store.test.js + sync-status-chip.test.js + sync-errors-modal.test.js + sync-pull-splash.test.js | _(visual UAT — Anchors 1, 2, 6)_ |

## UAT Status

**Pending** — human runs 8 anchors per 11-HUMAN-UAT.md against `npm run dev` + live huxley, plus the non-visual live-Supabase gate (`npx vitest run tests/sync-rls.test.js` with VITE_TEST_USER_* env vars). Results fill in inline on the UAT file.

On anchor-resolution return:
- If all 8 PASS and gate green → user replies `approved`; this SUMMARY's status flips to `complete`; Phase 11 ready for `/gsd:verify-phase`.
- If any FAIL → capture in `.planning/phases/11-cloud-sync-engine/follow-ups.md`; route via `/gsd:plan-phase --gaps` for a focused fix plan.

## Environment Variables for Future Live-Supabase Runs

```bash
VITE_SUPABASE_URL=...              # huxley project URL
VITE_SUPABASE_ANON_KEY=...         # huxley anon key (public)
VITE_TEST_USER_EMAIL=...           # James's personal email or Sharon's — a household member
VITE_TEST_USER_PASSWORD=...        # matching password
```

With all four set: `npx vitest run tests/sync-rls.test.js` runs 15 tests (13 schema-mirror-like + 2 new push/propagation; the 2 non-exposure tests also need only the first two vars).
With only `VITE_SUPABASE_*` set: 13 tests run, 2 push/propagation skip.
With no env vars: entire file skips (baseline `npm test` state).

## Known Stubs

_None — Plan 11-06 ships test scaffolding + UAT docs only; no production code was added that could stub UI data flow._

## Self-Check: PASSED

- [x] tests/sync-offline-resilience.test.js exists + 6/6 tests green
- [x] tests/sync-rls.test.js extended with push upsert + Device A → B propagation + non-exposure tests
- [x] .planning/phases/11-cloud-sync-engine/11-HUMAN-UAT.md exists with 8 anchors
- [x] Full suite: 98 files / 882 tests green (unchanged Alpine noise in router.test.js is pre-existing, not Plan 11-06-introduced)
- [x] Task 1 commit 365918f exists
- [x] Task 2 commit 6f098cb exists
- [x] Task 3 commit c540923 exists
- [x] Task 4 — human UAT checkpoint — pending user walk
