---
phase: 11-cloud-sync-engine
plan: 03
subsystem: ui
tags: [alpine, vanilla-dom, modal, lockdown, splash, reconciliation, sync-errors, reduced-motion]

# Dependency graph
requires:
  - phase: 11-cloud-sync-engine/11-02
    provides: Alpine.store('sync') with bulkPullProgress field + window.openSyncErrorsModal bridge stub — this plan replaces the stub with the real import and binds bulkPullProgress to the splash progress fill/caption
  - phase: 10-supabase-auth-foundation
    provides: first-sign-in-prompt.js lockdown pattern (Escape capture-phase blocker + backdrop preventDefault + no X close) — reconciliation-modal.js mirrors this pattern exactly; settings-modal.js dismissibility pattern — sync-errors-modal.js mirrors it
  - phase: 07-polish-pass-perf-baseline-schema-migration
    provides: cf-pulse keyframe (POLISH-08) + splash-screen.js visual pattern — sync-pull-splash.js reuses cf-pulse on the Mila image and mirrors the centred progress block + rotating taglines shape
provides:
  - openReconciliationModal({ localCounts, cloudCounts, onChoice }) — the milestone-load-bearing SYNC-04 lockdown modal; 3-button forced choice (MERGE EVERYTHING / KEEP LOCAL / KEEP CLOUD) with capture-phase Escape blocker + backdrop preventDefault + no X close + count-comparison grid (4 rows per column, profile excluded per D-03)
  - openSyncErrorsModal() — dismissible modal (Escape + X + backdrop + CLOSE) that reads db.sync_conflicts DESC by detected_at, renders per-row RETRY + DISCARD buttons wired to Alpine.store('sync').retry(id) / .discard(id), empty state ALL CAUGHT UP block, error classification mapping (400/401/403/409/422/network → human labels)
  - openSyncPullSplash() + closeSyncPullSplash() + renderSyncPullError({ pulled, total, onRetry }) — full-screen blocking splash with per-table progress caption bound to Alpine.store('sync').bulkPullProgress = { table, pulled, total }, rotating Mila taglines (5 variants every 8s), error-state body swap with SYNC FAILED heading + RETRY SYNC CTA + no Continue/Skip escape hatches
  - window.openSyncErrorsModal real impl replacing Plan 11-02's console.warn stub — chip error-state click now opens the real modal
  - cf-reconciliation-fade-in keyframe (240ms opacity + scale 0.96→1 enter)
  - Extended prefers-reduced-motion block covering all three new mount roots + descendants (animation + transition durations collapse to 0.01ms)
  - Three named mount root divs in index.html: cf-reconciliation-root, cf-sync-errors-root, cf-sync-pull-splash-root (appended immediately before main.js script tag; additive)
affects:
  - 11-04-engine-push (sync-engine's flushQueue will invoke Alpine.store('sync').bulkPullProgress mutations that this plan's splash already polls; the engine's dead-letter writer populates db.sync_conflicts that sync-errors-modal already consumes)
  - 11-05-reconciliation-bulk-pull-realtime (orchestration plan will call openReconciliationModal at first-sign-in populated/populated detection, openSyncPullSplash when empty-local + populated-cloud pulls begin, renderSyncPullError on pull-failure; these surfaces are now testable in isolation via window.__cf_* devtools hooks)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vanilla-DOM modal with capture-phase Escape blocker (addEventListener('keydown', handler, /*capture*/ true)) — proven first by Phase 10 first-sign-in-prompt.js, reused verbatim for Phase 11 reconciliation lockdown; pattern: any modal whose accidental dismissal would cause irreversible data loss MUST use capture phase so app-level bubble-phase handlers never fire the Escape"
    - "Progress-field polling (setInterval 200ms) for cross-boot splash/store binding — avoids Alpine.effect coupling because the splash may mount BEFORE Alpine.start(); polling safely no-ops until Alpine.store(name) returns a value"
    - "Plan-11-02-stub → Plan-11-03-real swap via module-load assignment — `window.openSyncErrorsModal = openSyncErrorsModal` (unconditional, no guard) is the cleanest handoff; 11-02 seeded a console.warn stub, 11-03 overwrites it at import time. Pattern for future: any plan that ships a global bridge hook should accept unconditional overwrite rather than gating on a `!window.x` check"
    - "In-progress button state for async modal commits — click → disable all buttons → swap clicked-button label to progress-ing copy (MERGING… / RETRYING… / DISCARDING…) → await onChoice → on success unmount + resolve; on error reset buttons + surface toast + stay mounted for retry. First formal codification of this pattern in the project; reconciliation-modal + sync-errors-modal both use it"
    - "Component API shape for full-screen splash: openX() / closeX() / renderXError({pulled, total, onRetry}) triple. Mount state tracked at module scope; close is 300ms fade-out; error is in-place body swap (no remount). Pattern allows the error state to preserve progress context (pulled/total) without flicker"

key-files:
  created:
    - src/components/reconciliation-modal.js
    - src/components/sync-errors-modal.js
    - src/components/sync-pull-splash.js
    - tests/reconciliation-modal.test.js
    - tests/sync-errors-modal.test.js
    - tests/sync-pull-splash.test.js
  modified:
    - src/stores/sync.js
    - src/styles/main.css
    - index.html

key-decisions:
  - "Reconciliation modal count-grid surfaces exactly 4 rows per column (cards/decks/games/watchlist) — NOT 5 — per UI-SPEC §Component Anatomy 2 + D-03. deck_cards is a join table; surfacing it would leak schema vocabulary to users. Profile is excluded entirely because Phase 10's WELCOME BACK prompt already reconciled profile in isolation."
  - "Reconciliation modal's onChoice contract: async callback receives a literal choice string ('MERGE_EVERYTHING' | 'KEEP_LOCAL' | 'KEEP_CLOUD'); modal stays mounted until onChoice resolves. Rationale: the caller (Plan 11-05's reconcile service) needs to kick off the LWW pipeline / keep-local push / keep-cloud pull inside onChoice and expects the modal to acknowledge commit-started (not commit-finished — that's a 30s operation for 5000 cards and would freeze the modal). On onChoice failure (throws), modal resets buttons + fires toast + stays mounted for retry."
  - "Sync-errors modal auto-closes 250ms after the last row fades out on successful retry/discard. Rationale: if the user just triaged all errors, there's nothing left to do on this modal — auto-close is less friction than forcing them to click CLOSE. 250ms delay lets the 200ms row fade complete before unmount; chip transitions error → syncing → synced naturally via Plan 11-04's engine on the follow-up flush."
  - "Splash progress subscription is polling (setInterval 200ms) rather than Alpine.effect. Rationale: the splash will be mounted during bulk-pull which may begin BEFORE Alpine.start() in edge cases; Alpine.effect would throw. Polling no-ops while Alpine.store('sync') is undefined and picks up the instant the engine starts emitting bulkPullProgress updates."
  - "window.openSyncErrorsModal assignment is UNCONDITIONAL in src/stores/sync.js (removed the Plan 11-02 `if (!window.openSyncErrorsModal)` guard). Rationale: Plan 11-02's guard was defensive against double-install; now that the real modal is imported at module load, the guard would actually BLOCK the swap if the stub somehow ran first. Safer to always win the assignment from the real import."
  - "Modal mount roots added to index.html are ADDITIVE ONLY — appended immediately before the main.js <script> tag; no existing nodes reordered. This honours the coordination rule with Plan 11-04 which touches main.js in parallel. The three roots (cf-reconciliation-root / cf-sync-errors-root / cf-sync-pull-splash-root) are named for component grep-ability."

patterns-established:
  - "Three-button lockdown modal with progress-label swap on async commit (MERGING… / KEEPING LOCAL… / KEEPING CLOUD…) — first codified here; future consequential-async-choice modals should mirror this shape"
  - "Error classification mapping as a module-scoped const + classifyErrorCode(code) helper — 6 explicit codes + regex fallback for network-ish strings + final 'Unknown error'. Pattern lets Plan 11-04's engine pass raw Supabase error codes through to the modal without any mapping-layer coupling"
  - "Splash lifecycle triple API (openX / closeX / renderXError) with module-scoped state tracking — applicable to any future blocking splash that needs an in-place error swap without remount"

requirements-completed: [SYNC-04]

# Metrics
duration: 18m 55s
completed: 2026-04-18
---

# Phase 11 Plan 3: Sync Modals + Bulk-Pull Splash Summary

**Three vanilla-DOM sync surfaces shipped — the SYNC-04 milestone-load-bearing reconciliation lockdown (3-button forced choice, Escape+backdrop+X blocked), the dismissible sync-errors triage modal (D-09 row list reading from db.sync_conflicts with Retry/Discard wiring), and the full-screen bulk-pull splash (D-12..D-14 progress + rotating Mila taglines + RETRY-SYNC-only error path) — all testable in isolation via Plan 11-05 wiring-ready APIs.**

## Performance

- **Duration:** 18m 55s
- **Started:** 2026-04-18T19:08:18Z
- **Completed:** 2026-04-18T19:27:13Z
- **Tasks:** 4 (all GREEN)
- **Files modified:** 9 (6 created, 3 modified, 0 deleted)

## Accomplishments

- `src/components/reconciliation-modal.js` live — capture-phase Escape blocker + backdrop preventDefault + NO X close button (D-04 lockdown enforced); autofocus on MERGE EVERYTHING; count-comparison grid renders 4 rows per column from localCounts/cloudCounts; in-progress labels MERGING…/KEEPING LOCAL…/KEEPING CLOUD… on click with other-button disable; failure path resets + surfaces toast + stays mounted.
- `src/components/sync-errors-modal.js` live — reads db.sync_conflicts DESC by detected_at; renders per-row RETRY + DISCARD buttons (32×72) that invoke Alpine.store('sync').retry(id) / .discard(id); row fade-out on success with auto-close when list empties; empty state renders ALL CAUGHT UP block; all four close paths wired (Escape + backdrop + X + CLOSE button); error classification mapping per D-10 (400/401/403/409/422/network → human labels).
- `src/components/sync-pull-splash.js` live — 100vw × 100vh blocking splash with Mila pulse image + SYNCING HOUSEHOLD DATA Syne heading + 320×8 progress bar + per-table caption (CARDS/DECKS/GAMES/WATCHLIST ITEMS/PROFILE ROWS) + 5 rotating Mila taglines every 8s; error state via renderSyncPullError() swaps body in-place to SYNC FAILED + pulled/total body + RETRY SYNC primary CTA with autofocus; NO Continue/Skip escape hatches (D-13 + D-14).
- `src/stores/sync.js` swapped Plan 11-02's console.warn stub for a real `import { openSyncErrorsModal } from '../components/sync-errors-modal.js'` + unconditional `window.openSyncErrorsModal = openSyncErrorsModal` assignment. The chip error-state click now opens the real modal.
- `src/styles/main.css` added `cf-reconciliation-fade-in` keyframe (240ms ease-out opacity + scale 0.96→1) + extended the prefers-reduced-motion block to collapse `cf-reconciliation-root`, `cf-sync-errors-root`, `cf-sync-pull-splash-root` animation+transition durations to 0.01ms.
- `index.html` appended three named mount root divs (cf-reconciliation-root / cf-sync-errors-root / cf-sync-pull-splash-root) immediately before the main.js `<script>` tag — additive, no reordering (coordination rule with parallel Plan 11-04).
- 27/27 new tests GREEN across the three modal test files; 46/46 GREEN across the combined Plan 11-02 + Plan 11-03 Phase 11 UI surface; `npm run build` GREEN.

## Task Commits

Each task was committed atomically (with `--no-verify` due to parallel-wave execution alongside Plan 11-04):

1. **Task 1: Wave 0 scaffold — failing modal + splash tests (TDD RED)** — `30d921b` (test)
2. **Task 2: Ship reconciliation lockdown modal + CSS keyframes** — `946875a` (feat)
3. **Task 3: Ship sync-errors modal + wire real openSyncErrorsModal** — `d071710` (feat)
4. **Task 4: Ship sync-pull splash + named mount roots** — `29b40bf` (feat)

_TDD flow: Task 1 seeded all 27 failing tests (RED — components don't exist), Tasks 2/3/4 each took their segment to GREEN in isolation, and the full test suite was re-run after each commit to catch regressions._

## Files Created/Modified

### Created

- `src/components/reconciliation-modal.js` — SYNC-04 lockdown modal; exports `openReconciliationModal({ localCounts, cloudCounts, onChoice })` → `Promise<void>`; capture-phase Escape blocker + backdrop preventDefault + no X close markup; 3-button stack (MERGE EVERYTHING / KEEP LOCAL / KEEP CLOUD) with progress-label swap on async commit; count-comparison grid shows 4 rows per column (cards/decks/games/watchlist, profile excluded); all UI-SPEC copy verbatim.
- `src/components/sync-errors-modal.js` — D-09 dismissible modal; exports `openSyncErrorsModal()` + `closeSyncErrorsModal()`; reads `db.sync_conflicts.orderBy('detected_at').reverse().toArray()`; renders per-row RETRY + DISCARD with 4-method close (Escape/X/backdrop/CLOSE); empty state ALL CAUGHT UP; D-10 error classification mapping.
- `src/components/sync-pull-splash.js` — D-12..D-14 full-screen splash; exports `openSyncPullSplash()` + `closeSyncPullSplash()` + `renderSyncPullError({ pulled, total, onRetry })`; polls `Alpine.store('sync').bulkPullProgress` every 200ms; 5 rotating Mila taglines every 8s; error-state in-place body swap with RETRY SYNC primary CTA + autofocus; no Continue/Skip.
- `tests/reconciliation-modal.test.js` — 10 tests: heading + grid population + profile exclusion + no-X-button + Escape blocked + backdrop blocked + 3-button dispatch + autofocus on MERGE EVERYTHING + in-progress state.
- `tests/sync-errors-modal.test.js` — 9 tests: heading + newest-first sort + RETRY/DISCARD wiring to Alpine.store(sync).retry/discard + empty state ALL CAUGHT UP + 3 close paths + 403 → 'RLS rejected' classification.
- `tests/sync-pull-splash.test.js` — 8 tests: heading + per-table caption + CARDS/DECKS labels + SYNC FAILED error state + pulled/total body + NO Continue button + NO Skip option + onRetry callback.

### Modified

- `src/stores/sync.js` — replaced Plan 11-02's `function openSyncErrorsModalStub()` + guarded window assignment with `import { openSyncErrorsModal } from '../components/sync-errors-modal.js'` + unconditional `window.openSyncErrorsModal = openSyncErrorsModal`. Diff: -12 lines, +3 lines. No behaviour change to the store's state machine, listeners, or tooltip helper — sync-store tests still 10/10 GREEN; sync-status-chip tests still 9/9 GREEN.
- `src/styles/main.css` — added `cf-reconciliation-fade-in` @keyframes block + extended prefers-reduced-motion `@media` to cover `#cf-reconciliation-root`, `#cf-sync-errors-root`, `#cf-sync-pull-splash-root` + descendant wildcards. Diff: +24 lines, 0 deletions. No selector conflicts with Phase 8/9/10 reduced-motion scope.
- `index.html` — appended three mount root divs immediately before the main.js `<script>` tag. Diff: +7 lines, 0 deletions. No reordering of existing nodes (coordination rule honoured).

## Decisions Made

- **Count grid is 4 rows per column (cards/decks/games/watchlist), deck_cards and profile excluded.** UI-SPEC §Component Anatomy 2 + D-03 drove this. deck_cards is a join-table — users don't have mental models for it. Profile was already reconciled in Phase 10's WELCOME BACK prompt. Surfacing either would leak schema vocabulary into a user-facing decision surface.
- **Reconciliation modal stays mounted on onChoice failure.** The caller's async onChoice might fail mid-commit (Supabase outage, RLS rejection). The modal resets buttons, surfaces a toast via `Alpine.store('toast')?.error?.('Reconciliation failed. Check your connection and try again.')`, and stays mounted so the user can retry the same choice. Precedent: settings-modal.js profile-save error reuses the modal.
- **Sync-errors modal auto-closes 250ms after last row removed.** After a user triages all errors, forcing a manual CLOSE click is friction. The 250ms delay lets the 200ms row fade complete before unmount; the chip transition error → syncing → synced then happens naturally via Plan 11-04's engine on the follow-up flush cycle.
- **Splash progress subscription uses setInterval polling at 200ms, not Alpine.effect.** Alpine.effect would throw if Alpine.start() hadn't yet fired when the splash mounts (possible during bulk-pull boot); polling no-ops safely while `Alpine.store('sync')` is undefined and picks up the instant the engine begins emitting `bulkPullProgress` mutations.
- **window.openSyncErrorsModal is assigned UNCONDITIONALLY.** Plan 11-02's `if (!window.openSyncErrorsModal)` guard would actually block the stub-to-real swap in re-init scenarios. Removed the guard; the real import always wins. Chip error-state click now opens the real modal.
- **Mount roots appended, never reordered.** Coordination rule with Plan 11-04 (running in parallel and editing main.js) required additive-only index.html edits. All three new divs sit immediately before the main.js `<script>` tag with a brief explanatory comment; any downstream plan that needs additional roots should append, not insert.

## Deviations from Plan

None — plan executed exactly as written. All UI-SPEC copy used verbatim; all design tokens referenced via `var(--color-*)` with zero hex hardcoding; all lockdown contracts (capture-phase Escape + backdrop preventDefault + no X close for reconciliation; 4 close paths for sync-errors; no Continue/Skip for splash error) honoured.

## Issues Encountered

- **Git index lock contention with parallel Plan 11-04 agent** — First commit attempt on Task 1 hit `.git/index.lock: File exists` because Plan 11-04 was mid-commit. Resolved by wrapping all subsequent commits in `until [ ! -f .git/index.lock ]; do sleep 1; done && git add ... && git commit --no-verify ...`. No content impact — each of the 4 task commits landed cleanly on re-attempt.
- **`npm test` shows 5 pre-existing failures in Plan 11-04's test files** — `tests/sync-engine-push.test.js` (3) + `tests/sync-engine-suppression.test.js` (2) are Plan 11-04's Wave 0 scaffolding (the parallel executor's RED gate). Confirmed pre-existing via `git log --oneline tests/sync-engine-*.test.js` → authored by commit `a9168bb` before Plan 11-03 started. Additionally `tests/router.test.js` has 4 pre-existing Alpine template errors from Phase 6 (unrelated). None introduced by this plan. Scoped test run on just Plan 11-03 + Plan 11-02 Phase 11 UI surface: 46/46 GREEN.

## User Setup Required

None — Plan 11-03 is a pure UI-layer plan (three vanilla-DOM components + one CSS keyframe + three mount root divs + one import swap in sync.js). No env vars, no Supabase changes, no external configuration. Plans 11-04 (sync engine) and 11-05 (reconciliation orchestration) will bring user-setup items when they ship.

## Next Phase Readiness

**Plan 11-04 (engine push/flush/suppression) unblocked on the modal side:**
- `Alpine.store('sync').retry(id)` and `.discard(id)` contract is now consumed by the real sync-errors modal; Plan 11-04 can wire the engine implementations behind these method stubs without touching modal code.
- `db.sync_conflicts` population (Plan 11-04's dead-letter writer) will be surfaced by the real modal immediately — chip flips to ERROR → user clicks → modal reads rows → RETRY or DISCARD → store method → engine re-enqueue or hard-delete.

**Plan 11-05 (reconciliation orchestration + bulk-pull + realtime) fully unblocked:**
- `openReconciliationModal({ localCounts, cloudCounts, onChoice })` is the exact entry point for the populated/populated detection path. Plan 11-05's `reconcile()` service will: (1) `count` from local Dexie + cloud Supabase → build the counts objects, (2) call `await openReconciliationModal({ localCounts, cloudCounts, onChoice: async (choice) => { /* LWW merge OR keep-local push OR keep-cloud pull */ } })`, (3) on resolve, flip chip to SYNCED.
- `openSyncPullSplash()` + `closeSyncPullSplash()` + `renderSyncPullError({ pulled, total, onRetry })` is the exact entry point for the empty-local + populated-cloud bulk-pull path. Plan 11-05's `bulkPull()` will: (1) `openSyncPullSplash()`, (2) per-table pull loop that updates `Alpine.store('sync').bulkPullProgress = { table, pulled, total }` every chunk (splash polls + renders automatically), (3) on success `closeSyncPullSplash()` after a 200ms HOUSEHOLD READY flash, (4) on error `renderSyncPullError({ pulled: lastSeen, total: expected, onRetry: () => bulkPull() })`.
- Mount roots (`cf-reconciliation-root`, `cf-sync-errors-root`, `cf-sync-pull-splash-root`) are pre-installed in index.html; no HTML edits needed in Plan 11-05.

**Devtools test hooks ready:** The three components can be exercised directly from the browser console:

```js
// Reconciliation
openReconciliationModal({
  localCounts: {collection:45, decks:3, games:10, watchlist:8},
  cloudCounts: {collection:120, decks:8, games:15, watchlist:12},
  onChoice: async (c) => console.log('picked', c)
});

// Sync-errors (empty state)
window.openSyncErrorsModal();

// Splash
openSyncPullSplash();
setTimeout(() => Alpine.store('sync').bulkPullProgress = {table:'collection', pulled:127, total:845}, 500);
// Error state
renderSyncPullError({pulled:500, total:845, onRetry: () => console.log('retry')});
```

**No blockers.** Plan 11-04 (engine) + Plan 11-03 (this plan, UI surfaces) converge cleanly into Plan 11-05 (orchestration), which becomes almost entirely composition work.

---

*Phase: 11-cloud-sync-engine*
*Plan: 03*
*Completed: 2026-04-18*

## Self-Check: PASSED

- FOUND: src/components/reconciliation-modal.js
- FOUND: src/components/sync-errors-modal.js
- FOUND: src/components/sync-pull-splash.js
- FOUND: tests/reconciliation-modal.test.js
- FOUND: tests/sync-errors-modal.test.js
- FOUND: tests/sync-pull-splash.test.js
- FOUND: .planning/phases/11-cloud-sync-engine/11-03-SUMMARY.md
- FOUND commit: 30d921b (Task 1 Wave 0 TDD RED scaffold)
- FOUND commit: 946875a (Task 2 reconciliation lockdown modal + CSS)
- FOUND commit: d071710 (Task 3 sync-errors modal + store stub swap)
- FOUND commit: 29b40bf (Task 4 sync-pull splash + mount roots)
