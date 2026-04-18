---
phase: 11
slug: cloud-sync-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-18
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from RESEARCH.md §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 + fake-indexeddb 6.2.5 (already installed) |
| **Config file** | `vitest.config.js` (existing) |
| **Quick run command** | `npx vitest run tests/sync-*.test.js` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15s full suite post-Phase 11 (currently ~4s; +7 files) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/<changed-area>.test.js -x` — fast feedback per commit (<10s).
- **After every plan wave:** Run `npm test` — full suite (~15s post-Phase 11).
- **Before `/gsd:verify-work`:** `npm test` green AND `tests/sync-rls.test.js` green (requires HAS_ENV — huxley credentials via env vars; same pattern as Phase 10 Plan 1 hard gate).
- **Max feedback latency:** 15 seconds (full suite).

---

## Per-Task Verification Map

> Task IDs are finalised by the planner; this table shows the Requirement → Test File mapping so every plan wires `automated.command` to the correct file.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| SYNC-01 | `counterflux` schema + RLS policies match Dexie v10 shape; `deleted_at` column exists + indexed | integration (live-Supabase, describeIf HAS_ENV) | `npx vitest run tests/sync-rls.test.js -t "schema mirror"` | ❌ W0 | ⬜ pending |
| SYNC-01 | Dexie v9→v10 migration adds `deleted_at` field on synced tables without data loss | unit (fake-indexeddb) | `npx vitest run tests/sync-schema-v10.test.js` | ❌ W0 | ⬜ pending |
| SYNC-02 | Dexie `creating/updating/deleting` hooks enqueue into `sync_queue` with `user_id`, `op`, `row_id`, `payload`; `cards`/`meta`/`*_cache` excluded | unit | `npx vitest run tests/sync-engine-push.test.js -t "outbox hook"` | ❌ W0 | ⬜ pending |
| SYNC-02 | `_suppressHooks = true` (synchronous) causes hooks to skip enqueue — loop-break for realtime-applied writes | unit | `npx vitest run tests/sync-engine-suppression.test.js` | ❌ W0 | ⬜ pending |
| SYNC-03 | Batched upsert flushes `sync_queue` to Supabase; success path deletes queue rows + stamps `synced_at` on source row | integration (live-Supabase) | `npx vitest run tests/sync-rls.test.js -t "push upsert"` | ❌ W0 | ⬜ pending |
| SYNC-03 | Error classification: 429/5xx/network → transient (retry w/ exponential backoff); 400/403/409/422 → permanent (dead-letter to `sync_conflicts`) | unit | `npx vitest run tests/sync-engine-push.test.js -t "classifyError"` | ❌ W0 | ⬜ pending |
| SYNC-03 | Realtime INSERT/UPDATE event applies LWW-correctly and does NOT re-enqueue via hooks (suppression verified) | unit (mock channel) | `npx vitest run tests/sync-realtime.test.js -t "realtime apply"` | ❌ W0 | ⬜ pending |
| SYNC-04 | `classifyState()` returns correct state for 4 fixtures: empty/empty, empty/populated, populated/empty, populated/populated | unit (mock Supabase count responses) | `npx vitest run tests/sync-reconciliation.test.js -t "classifyState"` | ❌ W0 | ⬜ pending |
| SYNC-04 | Populated-populated triggers non-dismissible reconciliation modal; 3 buttons execute correct semantics (MERGE_EVERYTHING → LWW pull+push; KEEP_LOCAL → server delete + push local; KEEP_CLOUD → local clear + full pull) | integration (live-Supabase + Dexie) | `npx vitest run tests/sync-reconciliation.test.js -t "three-button"` | ❌ W0 | ⬜ pending |
| SYNC-04 | Reconciliation modal lockdown: Escape key, backdrop click, and absence of X button all blocked | unit (DOM) | `npx vitest run tests/reconciliation-modal.test.js -t "lockdown"` | ❌ W0 | ⬜ pending |
| SYNC-04 | Bulk-pull uses `sync_pull_in_progress` meta flag to prevent partial-pull from misclassifying as populated-populated on next boot | unit | `npx vitest run tests/sync-bulk-pull.test.js -t "pull-in-progress flag"` | ❌ W0 | ⬜ pending |
| SYNC-05 | LWW resolver (row-level per D-02): remote-newer wins; local-newer wins; tie → cloud wins; deck_cards atomic merge by composite key; local-delete+remote-update → `sync_conflicts` entry | unit | `npx vitest run tests/sync-conflict.test.js` | ❌ W0 | ⬜ pending |
| SYNC-06 | Offline queue survives page reload (persisted in Dexie) | unit (fake-indexeddb reload simulation) | `npx vitest run tests/sync-offline-resilience.test.js -t "reload recovery"` | ❌ W0 | ⬜ pending |
| SYNC-06 | `window.online` event triggers flushQueue on reconnect | unit (dispatch synthetic online event) | `npx vitest run tests/sync-offline-resilience.test.js -t "reconnect flush"` | ❌ W0 | ⬜ pending |
| SYNC-06 | Cross-user safety: queue rows tagged with User A's `user_id` remain in queue when User B signs in; never flush under User B's auth | unit | `npx vitest run tests/sync-engine-cross-user.test.js` | ❌ W0 | ⬜ pending |
| SYNC-07 | Sync store exposes 4 states (synced/syncing/offline/error); topbar chip DOM binds to each; error state chip is clickable and opens sync-errors modal | unit (DOM + store) | `npx vitest run tests/sync-status-chip.test.js` | ❌ W0 | ⬜ pending |
| D-09 | Sync-errors modal displays permanent-failure rows from `sync_conflicts` with retry/discard actions | unit (DOM) | `npx vitest run tests/sync-errors-modal.test.js` | ❌ W0 | ⬜ pending |
| D-12..D-14 | Sync-pull splash shows bulk progress + error recovery path | unit (DOM) | `npx vitest run tests/sync-pull-splash.test.js` | ❌ W0 | ⬜ pending |
| SYNC-07 | Store state transitions: syncing ↔ synced ↔ offline ↔ error — no invalid transitions, debounced to avoid chip thrash | unit | `npx vitest run tests/sync-store.test.js` | ❌ W0 | ⬜ pending |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All Phase 11 test files need creation (no framework install needed — Vitest + fake-indexeddb are in devDependencies):

- [ ] `tests/sync-schema-v10.test.js` — SYNC-01 Dexie v9→v10 migration
- [ ] `tests/sync-engine-push.test.js` — SYNC-02 + SYNC-03 (hooks + push + error classification)
- [ ] `tests/sync-engine-suppression.test.js` — SYNC-02 loop-break via synchronous `_suppressHooks`
- [ ] `tests/sync-engine-cross-user.test.js` — SYNC-06 `user_id` tag safety gate
- [ ] `tests/sync-reconciliation.test.js` — SYNC-04 + SYNC-05 (4-state classify + three-button semantics)
- [ ] `tests/sync-conflict.test.js` — SYNC-05 LWW matrix
- [ ] `tests/sync-bulk-pull.test.js` — SYNC-04 populated-cloud bulk pull + `sync_pull_in_progress` flag
- [ ] `tests/sync-realtime.test.js` — SYNC-03 pull half (realtime apply with suppression)
- [ ] `tests/sync-offline-resilience.test.js` — SYNC-06 reload recovery + reconnect flush
- [ ] `tests/sync-store.test.js` — SYNC-07 state machine
- [ ] `tests/sync-status-chip.test.js` — SYNC-07 chip DOM binding
- [ ] `tests/reconciliation-modal.test.js` — SYNC-04 modal lockdown + state counts
- [ ] `tests/sync-errors-modal.test.js` — D-09 dead-letter UI
- [ ] `tests/sync-pull-splash.test.js` — D-12..D-14 splash progress + error recovery
- [ ] `tests/sync-rls.test.js` — SYNC-01 + SYNC-03 live-Supabase integration (describeIf HAS_ENV, pattern matches Phase 10 `tests/rls-isolation.test.js`)

Suggested **Plan ownership** (planner to finalise in PLAN.md files):
- Plan 11-01 (Supabase schema + RLS + Realtime publication + optional pg_cron): `sync-schema-v10.test.js`, `sync-rls.test.js`
- Plan 11-02/11-03 (UI scaffold — sync store, chip, modals): `sync-store.test.js`, `sync-status-chip.test.js`, `sync-errors-modal.test.js`, `sync-pull-splash.test.js`
- Plan 11-04 (Outbox + push + suppression + cross-user): `sync-engine-push.test.js`, `sync-engine-suppression.test.js`, `sync-engine-cross-user.test.js`
- Plan 11-05 (Reconciliation + bulk-pull + realtime apply + LWW): `sync-reconciliation.test.js`, `sync-conflict.test.js`, `sync-bulk-pull.test.js`, `sync-realtime.test.js`, `reconciliation-modal.test.js`
- Plan 11-06 (E2E live-Supabase + offline resilience): `sync-offline-resilience.test.js` + extends `sync-rls.test.js`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Device A → Device B propagation within one sync cycle (visual) | SYNC-03 | Requires two real browser profiles with distinct IndexedDB stores hitting live-huxley Supabase | 1) Sign in as test user in browser profile A; edit a deck name. 2) Sign in as same user in browser profile B (separate profile, not incognito). 3) Within 5s of Device A save, confirm Device B shows the updated deck name without reload. Log result in verification report. |
| 4-state reconciliation modal visual correctness | SYNC-04 | Modal copy, layout, and lockdown feel (non-dismissible) need human eyeball against UI-SPEC | 1) Seed a local collection via `npm run dev` import. 2) Sign in as a user with remote data. 3) Verify populated-populated modal renders matching UI-SPEC; all 3 buttons work; Escape/backdrop/X do not dismiss. |
| Sync-status chip visual transitions | SYNC-07 | Animation timing and colour shifts must match Neo-Occult Terminal tokens | 1) Open app online → chip reads "synced" (green). 2) Toggle DevTools offline → chip reads "offline" (amber) within 2s. 3) Trigger a 500 via network throttling to sync endpoint → chip reads "error" (red) + click opens errors modal. |
| Bulk-pull progress splash visual | D-12..D-14 | Progress percentage cadence and splash-screen aesthetic need human review | 1) Seed remote with 2000+ cards. 2) Fresh local install signs in. 3) Confirm splash shows "Pulling your archive — N%" with ~10% increments and no flicker. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify command OR Wave 0 test-file dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references above (15 new test files)
- [ ] No watch-mode flags in automated commands (all use `vitest run`, not `vitest` or `--watch`)
- [ ] Feedback latency < 15s (full suite)
- [ ] `nyquist_compliant: true` set in frontmatter once planner wires all plan tasks to the file manifest above

**Approval:** pending
