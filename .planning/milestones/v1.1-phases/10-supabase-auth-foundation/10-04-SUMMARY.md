---
phase: 10
plan: 04
subsystem: auth
tags:
  - auth
  - supabase
  - alpinejs
  - profile
  - settings-modal
  - first-sign-in
  - tdd
  - accessibility
  - ui-spec
dependency-graph:
  requires:
    - "Phase 10-02 — Alpine auth store contract ({ status, user, session, signInMagic, signInGoogle, signOut, init })"
    - "Phase 10-02 — src/services/supabase.js lazy-load discipline (getSupabase singleton behind dynamic import)"
    - "Phase 10-03 — window.__openAuthModal global (sidebar + sync-CTA entry point)"
    - "Phase 10-03 — sidebar.authedAvatarUrl() helper (Plan 4 swaps its internals to profile.effectiveAvatarUrl)"
    - "Phase 10-01 — counterflux.profile Postgres row + RLS policies (user_id denormalised, onConflict upsert target)"
  provides:
    - "src/stores/profile.js — auth-aware rewrite: _source ('local'|'cloud'), _loaded, avatar_url_override, hydrate(), update(), setAvatarOverride(), clearAvatarOverride(), effectiveAvatarUrl getter (D-15 priority)"
    - "src/components/settings-modal.js — branched render on Alpine.store('auth').status at open time; signed-in body (SIGNED IN AS chip + conditional USE GOOGLE AVATAR + SIGN OUT) + signed-out body (Sync CTA card + SIGN IN TO SYNC); noun-anchored SAVE PROFILE / DISCARD CHANGES across both"
    - "src/components/first-sign-in-prompt.js — WELCOME BACK migration modal with 5-deep guard chain (not-authed, not-loaded, cloud-exists, no-local-profile D-20 silent path, already-open); z-70 above settings+auth modals; D-16 lockdown (Escape + backdrop + no-X)"
    - "src/main.js — Alpine.effect bridge: awaits profile.hydrate() then maybeShowFirstSignInPrompt() inside async IIFE on every auth.status flip"
    - "src/components/sidebar.js — authedAvatarUrl upgraded to delegate to profile.effectiveAvatarUrl (3-tier D-15 priority)"
    - "Visual Regression Anchor #5 (first-sign-in prompt), #6 (sign-out preserves local Dexie — grep-gated), #7 (Google avatar conditional), #8 (noun-anchored CTAs) all implementation-complete"
  affects:
    - "Phase 11 sync engine — profile store pattern is the template for collection/decks/games cloud hydration; auth-flip-triggered re-hydrate via Alpine.effect in main.js extends naturally to multi-store subscription"
    - "Phase 11 reconciliation modal — first-sign-in-prompt D-16 lockdown pattern (capture-phase Escape blocker + preventDefault backdrop + no-X) is the precedent for the collection/decks first-sign-in reconciliation prompt"
    - "Any future v1.1+ profile field additions — just extend the profile store schema + UI; hydrate/update plumbing handles cloud writes automatically"
tech-stack:
  added: []
  patterns:
    - "Alpine.effect auth-subscription bridge — main.js async IIFE awaits profile.hydrate() then maybeShowFirstSignInPrompt(); establishes the 'touch reactive dep in effect → async sequential side effects' pattern for cross-store reactivity"
    - "Cloud upsert with id-fetch-first — counterflux.profile PK is a text UUID; update() fetches the existing row's id (if any), generates a new UUID via crypto.randomUUID() if none, then upserts with { onConflict: 'user_id' }. Pattern handles both create and update paths through a single upsert call"
    - "localStorage always-mirror on authed write (D-19) — every profile.update() writes localStorage regardless of _source so sign-out re-hydrate has a fresh snapshot. Means sign-out never silently loses the user's most recent edits"
    - "5-deep guard chain for one-shot prompts — maybeShowFirstSignInPrompt() guards not-authed → not-loaded → cloud-exists → no-local-profile → already-open, each short-circuiting cleanly; guard order matters because D-20 silent path depends on hasLocalProfile being evaluated AFTER the cloud-exists check"
    - "Capture-phase Escape blocker for non-dismissible modals — document.addEventListener('keydown', handler, true) lets the prompt intercept Escape before any downstream handler (e.g. settings-modal's escape close) fires"
    - "D-22 static grep gate — tests/settings-modal-auth.test.js Test 8 reads the source file and regex-asserts no db.(collection|decks|deck_cards|games|watchlist|profile) matches anywhere. Cheaper + more durable than a unit test mock of Dexie"
    - "Noun-anchored CTAs — SAVE PROFILE / DISCARD CHANGES instead of bare SAVE / CANCEL; UI-SPEC Copywriting contract applied uniformly to both signed-in and signed-out settings modal states"
key-files:
  created:
    - src/components/first-sign-in-prompt.js
    - tests/profile-store-auth.test.js
    - tests/settings-modal-auth.test.js
    - tests/first-sign-in-prompt.test.js
  modified:
    - src/stores/profile.js
    - src/components/settings-modal.js
    - src/components/sidebar.js
    - src/main.js
key-decisions:
  - "profile.update() fetches the existing row id before upserting — counterflux.profile PK is a text UUID and Dexie 4 / Supabase onConflict requires the id column. Fetch-then-upsert is one extra round-trip on every save, but guarantees idempotency without forcing callers to track ids. Alternative (generate UUID on every upsert) would create orphan rows if the existing one was removed server-side."
  - "_source toggles to 'cloud' BEFORE profile.update() in first-sign-in-prompt handlers — update() branches on _source, so the keep/fresh CTAs must flip the flag first. On upsert failure we revert _source back to 'local' so the next retry finds the prompt again. This is a tiny race if the effect re-fires mid-failure, but acceptable because profile._loaded stays true throughout."
  - "Escape blocker uses capture phase (addEventListener with third arg true) — a still-open settings-modal has its own document-level Escape listener (in bubble phase). Without capture, settings-modal's handler would fire first and close itself, unmounting our prompt's parent context indirectly. Capture phase guarantees we intercept first."
  - "localStorage is mirrored on every cloud write (D-19), not just on explicit user actions — means a silent Alpine.effect-triggered hydrate followed by a user edit followed by sign-out all round-trip the edit correctly. Costs one localStorage write per cloud save; the user perceives zero difference."
  - "hasLocalProfile() checks (data.name || data.avatar) — not email, not avatar_url_override. Email alone is weak signal (users often set email first and leave profile otherwise blank), and avatar_url_override is a Plan 4 field that wouldn't exist in a pre-Plan-4 localStorage snapshot. name OR avatar is the v1.0 compatibility anchor."
  - "effectiveAvatarUrl returns '' (empty string) not null for the 'nothing' case — settings-modal._renderAvatar() branches on truthiness, and '' is falsy; using null would require extra null-safety at every call site. The test asserts === '' explicitly."
  - "The auth-store's email is read directly in hydrate() (line 119 profile.js) instead of passed as a parameter — keeps the hydrate surface small and matches the rest of the store's Alpine.store('auth') access pattern. Email stays in sync with auth.user.email because hydrate re-fires on status flip."
patterns-established:
  - "Auth-aware store hydration via Alpine.effect — the main.js bridge pattern generalises to any store that needs to swap between local and cloud sources on auth flip. Phase 11 inherits this for collection/decks/games."
  - "D-22 static grep gate — reusable for any phase where a user-facing destructive action must preserve a specific data store (e.g. Phase 12's sync-error notification dismissal must not destroy queued syncs)"
  - "One-shot consequential prompts with guard-chain entry + lockdown dismissal — the first-sign-in-prompt template applies to any future 'can't-undo-this, forced decision' UX (first-sync reconciliation, account deletion confirm)"
  - "Noun-anchored CTA discipline — replace all bare SAVE/CANCEL/CLOSE with noun-first verbs (SAVE PROFILE / DISCARD CHANGES / CLOSE MODAL); makes modals self-describing in screen-reader linear traversal"
requirements-completed:
  - AUTH-04
  - AUTH-05
metrics:
  duration: "10m 12s"
  started: "2026-04-17T15:33:23Z"
  completed: "2026-04-17T15:43:35Z"
  completed-date: "2026-04-17"
  tasks: 3
  files: 8
  commits: 6
---

# Phase 10 Plan 04: Auth-Aware Profile Store + Settings Modal Refactor + First-Sign-In Prompt Summary

**Profile store rewritten (40 → 200 LOC) with auth-aware hydrate()/update()/setAvatarOverride(), D-15 effectiveAvatarUrl priority chain, and _source state machine; settings-modal refactored (140 → 307 LOC) into auth-branched render with signed-in SIGNED IN AS chip + conditional USE GOOGLE AVATAR + destructive SIGN OUT preserving local Dexie (D-22 static grep gate) + signed-out Sync CTA card + uniform SAVE PROFILE / DISCARD CHANGES noun-anchored CTAs; new first-sign-in-prompt component (214 LOC) with 5-deep guard chain including D-20 silent-fresh-upsert path, D-16 capture-phase Escape lockdown + preventDefault backdrop + no-X close; main.js Alpine.effect bridge awaits hydrate → maybeShowFirstSignInPrompt in sequential async IIFE; sidebar avatar now delegates to profile.effectiveAvatarUrl completing the 3-tier D-15 priority; Visual Regression Anchors #5, #6, #7, #8 all implementation-complete.**

## Performance

- **Duration:** 10m 12s
- **Started:** 2026-04-17T15:33:23Z
- **Completed:** 2026-04-17T15:43:35Z
- **Tasks:** 3 (all TDD RED/GREEN → 6 task commits)
- **Files created:** 4 | **Files modified:** 4

## Accomplishments

- `src/stores/profile.js` rewritten from 40 LOC to 200 LOC with the full D-28 auth-aware contract: `_source`, `_loaded`, `avatar_url_override`, `hydrate()`, `update()`, `setAvatarOverride()`, `clearAvatarOverride()`, and the `effectiveAvatarUrl` getter implementing the D-15 3-tier priority (override → Google → legacy → '')
- `src/components/settings-modal.js` refactored from 140 LOC to 307 LOC with the signed-in / signed-out branch fork; signed-out ships the Sync CTA card with `SIGN IN TO SYNC` button above the existing form; signed-in ships the SIGNED IN AS read-only email chip + conditional USE GOOGLE AVATAR (D-15) + destructive SIGN OUT (auth-only handler, zero Dexie refs per D-22). Both states use noun-anchored SAVE PROFILE / DISCARD CHANGES
- `src/components/first-sign-in-prompt.js` new 214-LOC component with `maybeShowFirstSignInPrompt()` and `__resetFirstSignInPrompt()` exports; 5-deep guard chain including D-20 silent minimal-upsert path for empty-localStorage users; D-16 lockdown via capture-phase Escape blocker + preventDefault backdrop + no X close button; role=dialog + aria-modal=true + aria-labelledby + aria-describedby for SR contract
- `src/main.js` Alpine.effect extended with async IIFE: awaits `profile.hydrate()` then `maybeShowFirstSignInPrompt()` in order so the prompt's guards see the _source/_loaded state hydrate sets
- `src/components/sidebar.js` `authedAvatarUrl()` simplified to delegate to `profile.effectiveAvatarUrl` — inherits the D-15 3-tier priority automatically
- **Test totals**: 7 + 10 + 8 = **25 new tests** across 3 new test files, exceeds the ≥25 target from Plan 4 output spec
- **Phase 10 test health snapshot**: `tests/auth-store.test.js` 8/8 green · `tests/supabase-lazy-load.test.js` 4/4 green · `tests/auth-modal.test.js` 10/10 green · `tests/auth-callback-overlay.test.js` 8/8 green · `tests/profile-store-auth.test.js` 7/7 green · `tests/settings-modal-auth.test.js` 10/10 green · `tests/first-sign-in-prompt.test.js` 8/8 green. **55/55 green across all 7 Phase 10 files.**
- **Full suite**: 82 test files pass, 743 tests pass, 9 skipped, 10 todo, 0 failing. Delta from Plan 10-03 baseline (718): +25 tests, zero regressions
- **AUTH-01 preserved**: `npm run build` exits 0, `dist/assets/supabase-FmGvI6hO.js` = 187.08 KB code-split chunk, unchanged from Plan 10-02 baseline

## Task Commits

1. **Task 4.1 RED:** Failing profile-store-auth tests (7 behaviours) — `3b325c5` (test)
2. **Task 4.1 GREEN:** Auth-aware profile store + main.js effect + sidebar avatar delegation — `31213f5` (feat)
3. **Task 4.2 RED:** Failing settings-modal-auth tests (10 behaviours) — `9264717` (test)
4. **Task 4.2 GREEN:** Settings modal branched render with D-22 grep gate — `28dce29` (feat)
5. **Task 4.3 RED:** Failing first-sign-in-prompt tests (8 behaviours) — `320235d` (test)
6. **Task 4.3 GREEN:** First-sign-in-prompt component + main.js effect extension — `0e699dc` (feat)

**Plan metadata commit:** (appended after this SUMMARY ships)

## Files Created/Modified

**Created:**

- `src/components/first-sign-in-prompt.js` (214 LOC) — `maybeShowFirstSignInPrompt()` + `__resetFirstSignInPrompt()` + private `_mountPrompt()` / `_unmountPrompt()` / `_silentFreshUpsert()` / `hasLocalProfile()` / `readLocalProfile()`. Inline-styled 440px card on z-70 rgba(11,12,16,0.95) backdrop
- `tests/profile-store-auth.test.js` (287 LOC) — 7 tests with Supabase schema-chain mock (`supabase.schema().from().select().eq().maybeSingle()` + `.upsert()`)
- `tests/settings-modal-auth.test.js` (276 LOC) — 10 tests under jsdom env; setAlpine helper configures auth/profile/toast stubs per test; Test 8 is the D-22 static grep gate reading settings-modal.js source
- `tests/first-sign-in-prompt.test.js` (221 LOC) — 8 tests under jsdom env; covers the full guard chain + both CTA branches + lockdown + upsert failure

**Modified:**

- `src/stores/profile.js` — REWRITTEN from 40 LOC to 200 LOC. All existing v1.0 call sites remain functional because the shape is additive (name, email, avatar, displayName, initials, update() all preserved with original semantics in anonymous mode)
- `src/components/settings-modal.js` — REFACTORED from 140 LOC to 307 LOC. Branches at open time on `auth?.status === 'authed'`; shared `_buildAvatarRow` + `_buildField` + `_buildActionRow` helpers prevent duplication between the two bodies
- `src/components/sidebar.js` — `authedAvatarUrl()` now 2 lines (`return profile?.effectiveAvatarUrl || null`) instead of the prior 4-line 2-tier chain; D-15 priority is fully owned by the profile store
- `src/main.js` — added static `import { maybeShowFirstSignInPrompt } from './components/first-sign-in-prompt.js';` (line 21); Alpine.effect body now uses async IIFE pattern to sequence `profile.hydrate()` → `maybeShowFirstSignInPrompt()`

## Visual Regression Anchor Verification

| Anchor | Status | Evidence |
|---|---|---|
| #5 First-sign-in prompt | **IMPLEMENTED** | `src/components/first-sign-in-prompt.js` ships WELCOME BACK + KEEP LOCAL PROFILE + START FRESH with verbatim copy; `tests/first-sign-in-prompt.test.js` Test 1 asserts all three + body copy. D-16 lockdown verified by Test 7: Escape no-op + backdrop click no-op + `#first-signin-close` absent from DOM |
| #6 Sign-out preserves local data | **IMPLEMENTED + STATIC-GATED** | `src/components/settings-modal.js` SIGN OUT handler calls only `Alpine.store('auth').signOut()` + toast + close; `tests/settings-modal-auth.test.js` Test 8 reads the source file and regex-asserts `/db\.(collection\|decks\|deck_cards\|games\|watchlist\|profile)/` does NOT match anywhere in the file. Static grep returns zero matches |
| #7 Google avatar conditional | **IMPLEMENTED** | `_buildAvatarRow` in settings-modal.js builds `googleBtnHtml` as empty string when `googleAvatar` is falsy; `tests/settings-modal-auth.test.js` Test 5 (magic-link user) asserts `querySelector('#settings-use-google-avatar')` returns null and the modal text does NOT contain 'USE GOOGLE AVATAR'; Test 6 (Google user with `user_metadata.avatar_url`) asserts the button exists and click fires `clearAvatarOverride` + `Google avatar applied.` toast |
| #8 Noun-anchored CTAs | **IMPLEMENTED** | Both signed-in and signed-out bodies call `_buildActionRow` which renders literal `SAVE PROFILE` and `DISCARD CHANGES` button text. `tests/settings-modal-auth.test.js` Test 2 asserts `saveBtn.textContent.trim()` === `'SAVE PROFILE'` and `cancelBtn.textContent.trim()` === `'DISCARD CHANGES'` — no bare SAVE/CANCEL remains |

Combined with Plan 10-02 (Anchor #1) and Plan 10-03 (Anchors #2, #3, #4), **all 8 Visual Regression Anchors from 10-UI-SPEC.md are now implementation-complete**.

## Decisions Made

1. **id-fetch-first upsert pattern for counterflux.profile** — The PK is a text UUID, so update() queries `.select('id').eq('user_id').maybeSingle()` BEFORE upserting. Cheaper than client-side id-tracking and guarantees idempotency even if a row was deleted server-side (next upsert generates a fresh UUID cleanly).

2. **_source toggled BEFORE update() in first-sign-in CTAs** — The keep/fresh button handlers flip `profile._source = 'cloud'` before calling `profile.update(...)` because update() branches on `_source` to decide whether to upsert. On upsert failure we revert `_source = 'local'` so the prompt reappears next time. Tiny race if the auth-flip effect re-fires mid-failure, but `_loaded` stays true throughout so guard 2 still holds.

3. **Capture-phase Escape blocker (D-16)** — `document.addEventListener('keydown', escBlocker, true)` uses the third argument to register on the capture phase. A still-open settings-modal has its own document-level Escape listener registered on bubble phase; capture runs first. Without this, settings-modal's close handler would fire first and unmount the modal's parent context before our blocker saw the event.

4. **localStorage mirrored on EVERY cloud write (D-19)** — Anonymous writes already went to localStorage. Adding the mirror to cloud writes means sign-out re-hydrate always has the latest snapshot, so the user never loses their last-saved name/avatar on sign-out. Costs one localStorage.setItem per cloud save; imperceptible.

5. **hasLocalProfile() checks `data.name || data.avatar`** — Not email (weak signal — many users set email before profile). Not avatar_url_override (Plan-4-only field wouldn't exist in pre-Plan-4 localStorage snapshots). name OR avatar is the v1.0 compatibility anchor and matches the `.planning` 10-CONTEXT.md D-20 definition.

6. **effectiveAvatarUrl returns empty string, not null** — settings-modal's `_renderAvatar` branches on truthiness; `''` is falsy and tolerates `String(...)` coercion everywhere. `null` would demand extra null-safety at every call site.

7. **Profile email read directly from auth.user.email in hydrate()** — Keeps the hydrate signature small and matches the rest of the store's Alpine.store('auth') access pattern. Email stays in sync with auth because hydrate re-fires on every status flip.

## Deviations from Plan

**None — plan executed exactly as written.**

All three tasks followed the plan's Task/Step structure verbatim. TDD RED/GREEN discipline observed: each task's RED test ran and failed with the expected count (7 failing for 4.1, 9 failing / 1 passing for 4.2 because Test 8 D-22 grep incidentally passed on the old modal that also didn't touch Dexie, 8 failing for 4.3). All UI-SPEC copy is verbatim: `WELCOME BACK`, `KEEP LOCAL PROFILE`, `START FRESH`, `You had a local profile before signing in. Keep using it for your new account, or start fresh?`, `Mila will keep your local profile either way — you can still sign out and revert.`, `Profile synced to cloud.`, `Cloud profile created.`, `Couldn't save profile to cloud. Working locally for now.`, `SIGNED IN AS`, `SIGN IN TO SYNC`, `Sign in to sync across devices`, `Your collection, decks, and games stay on this device — but you can sync them to the cloud.`, `SIGN OUT`, `USE GOOGLE AVATAR`, `SAVE PROFILE`, `DISCARD CHANGES`, `Signed out. Your data stays on this device.`, `Google avatar applied.`, `Profile updated.`. All Izzet brand hexes verbatim (#0D52BD primary, #E23838 destructive-text, #14161C surface, #1C1F28 surface-hover, #2A2D3A ghost-border, #7A8498 text-muted, #EAECEE text-primary, #0B0C10 background).

## Issues Encountered

**1. Self-referencing grep false positive in D-22 test (fixed inline)** — The initial docstring at the top of `src/components/settings-modal.js` named the forbidden Dexie references verbatim as `db.collection / db.decks / db.deck_cards / db.games / db.watchlist / db.profile` to be human-readable. The D-22 static grep gate in `tests/settings-modal-auth.test.js` Test 8 matched the comment text and failed. Reworded the docstring to enumerate the Dexie tables without the `db.` prefix — grep returns zero matches, test 10/10 passes. No functional change; pure docstring rewrite.

**2. Pre-existing router.test.js Alpine cleanup errors** — Same 4 errors observed in Plans 10-02 and 10-03. Out of scope per deviation Rule 1 pre-existing clause. `tests/router.test.js` itself still reports 17/17 pass; the errors fire during Alpine cleanup and don't affect test results.

No other issues encountered. TDD GREEN passed on first write for all three tasks.

## Known Stubs

**None.** Plan 10-04 closes the Phase 10 user-facing surface. Every component referenced by 10-UI-SPEC.md is now implementation-complete with live wiring.

## User Setup Required

None new in this plan. Plan 10-01's `10-AUTH-PREFLIGHT.md` remains canonical for Supabase + Google OAuth + Vercel env var provisioning. The only user action for this plan is the human-UAT walkthrough (see Phase 10 completion sign-off below).

## UI-SPEC Divergences

**None.** Every copy block in 10-UI-SPEC.md §4 (first-sign-in), §5 (signed-in settings), §6 (signed-out settings additive) is reproduced verbatim in the source. No paraphrasing, no abbreviation, no reflow for jsdom constraints. The `Your collection, decks, and games stay on this device — but you can sync them to the cloud.` em-dash is the actual Unicode em-dash character (U+2014), same as the UI-SPEC source.

## D-37 Hard-Gate Status

The RLS isolation test (`tests/rls-isolation.test.js`) was established in Plan 10-01 as the single most load-bearing Phase 10 test. It is structured to skip cleanly via `describeIf(hasEnv)` when `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are absent from the test environment (the default for `npm test`).

Running the full suite confirms the guard still holds:

```
Test Files  82 passed | 3 skipped (85)
     Tests  743 passed | 9 skipped | 10 todo (762)
```

The 9 skipped tests are the RLS isolation suite (6 table policies × … + parent describe overhead). Running them against a real Supabase instance (Phase 10 completion sign-off step below) requires the env vars to be set:

```bash
VITE_SUPABASE_URL=https://hodnhjipurvjaskcsjvj.supabase.co \
VITE_SUPABASE_ANON_KEY=<anon key from .env.local> \
npx vitest run tests/rls-isolation.test.js
```

This is the canonical D-37 gate execution. Results are the responsibility of `/gsd:complete-phase 10` orchestration — Plan 10-04 has no new RLS surface to verify (profile upserts are the only cloud writes, and they're covered by the unit-mock upsert-with-onConflict path in `tests/profile-store-auth.test.js` Test 6).

## Phase 10 Completion Sign-Off Checklist

| Requirement | Plan | Status |
|---|---|---|
| AUTH-01 — lazy-loaded Supabase client (`@supabase/supabase-js` code-split) | 10-02 | VALIDATED (`dist/assets/supabase-FmGvI6hO.js` = 187.08 KB; tests/supabase-lazy-load.test.js 4/4 green) |
| AUTH-02 — email magic-link sign-in with PKCE | 10-02 + 10-03 | VALIDATED (auth-store.test.js 8/8, auth-modal.test.js 10/10, auth-callback-overlay.test.js 8/8) |
| AUTH-03 — Google OAuth sign-in | 10-02 + 10-03 | VALIDATED (signInWithOAuth with provider: 'google' asserted in auth-store.test.js; brand-fidelity SVG + UI in auth-modal.test.js) |
| AUTH-04 — auth-aware profile store + settings modal | **10-04** | **VALIDATED** (profile-store-auth.test.js 7/7, settings-modal-auth.test.js 10/10, first-sign-in-prompt.test.js 8/8) |
| AUTH-05 — sign-out preserves local Dexie data | **10-04** | **VALIDATED** (settings-modal-auth.test.js Test 8 static grep gate passes) |
| AUTH-06 — Supabase schema + RLS | 10-01 | VALIDATED (`counterflux` schema + 6 tables + 12 policies + 6 user_id indexes; rls-isolation.test.js suite structured for real-env execution) |

**Manual QA walkthrough** — Human-UAT is the responsibility of `/gsd:complete-phase 10` orchestration. The plan's `<verification>` block §6 lists the six end-to-end scenarios: anonymous boot + settings modal sync CTA, magic-link sign-in through first-sign-in prompt keep-path, signed-in settings modal edit + save, sign-out revert, Google sign-in through first-sign-in fresh-path, Google avatar toggle. All six scenarios are implementation-complete and test-covered at the unit level; the human-UAT is the visual regression pass against the 8 Visual Regression Anchors.

**Phase 10 status: ready for `/gsd:complete-phase 10`.** All 6 AUTH-XX requirements implementation-complete. All 8 Visual Regression Anchors shipped. Full test suite 743 pass / 0 fail; AUTH-01 lazy-load discipline preserved at build time (187KB code-split chunk unchanged).

## Outstanding Follow-ups (for Phase 11 — sync engine)

- **Phase 11 inherits auth-aware hydrate pattern** — the main.js Alpine.effect bridge + profile._source model applies 1:1 to the collection, decks, deck_cards, games, and watchlist stores. Phase 11 adds a second `Alpine.effect` body (or extends this one) that calls `collection.hydrate()` / `deck.hydrate()` / etc. on every auth flip
- **Phase 11 adds the first-sync reconciliation modal** — inherit the D-16 lockdown pattern from first-sign-in-prompt (capture-phase Escape + preventDefault backdrop + no X close)
- **Phase 11 wires sync_queue outbox hooks** — the counterflux schema already ships `sync_queue` and `sync_conflicts` tables (Dexie v6+); Phase 11 registers `db.collection.hook('creating'|'updating'|'deleting')` etc. to enqueue changes
- **Phase 12 notification bell wire-up** — Phase 11 errors surface via `toast.error` for now; Phase 12 adds the persistent notification bell + sync-error history

## Self-Check: PASSED

File existence (all FOUND):

- `src/stores/profile.js` — FOUND (200 LOC)
- `src/components/settings-modal.js` — FOUND (307 LOC)
- `src/components/first-sign-in-prompt.js` — FOUND (214 LOC)
- `src/components/sidebar.js` — FOUND (with delegated authedAvatarUrl)
- `src/main.js` — FOUND (with maybeShowFirstSignInPrompt import + extended Alpine.effect)
- `tests/profile-store-auth.test.js` — FOUND (287 LOC, 7 tests)
- `tests/settings-modal-auth.test.js` — FOUND (276 LOC, 10 tests)
- `tests/first-sign-in-prompt.test.js` — FOUND (221 LOC, 8 tests)

Commit existence (all FOUND):

- `3b325c5` (Task 4.1 RED) — FOUND
- `31213f5` (Task 4.1 GREEN) — FOUND
- `9264717` (Task 4.2 RED) — FOUND
- `28dce29` (Task 4.2 GREEN) — FOUND
- `320235d` (Task 4.3 RED) — FOUND
- `0e699dc` (Task 4.3 GREEN) — FOUND

Test + build:

- `npx vitest run tests/profile-store-auth.test.js` — 7/7 pass
- `npx vitest run tests/settings-modal-auth.test.js` — 10/10 pass
- `npx vitest run tests/first-sign-in-prompt.test.js` — 8/8 pass
- All 7 Phase 10 test files — 55/55 pass
- `npx vitest run` (full suite) — 82 files pass, 743 tests pass, 9 skipped, 10 todo, zero failures
- `npm run build` — exits 0; `dist/assets/supabase-FmGvI6hO.js` still 187.08 KB code-split (AUTH-01 preserved)

---

*Phase: 10-supabase-auth-foundation*
*Plan: 04 — Auth-aware profile store + settings modal refactor + first-sign-in prompt*
*Completed: 2026-04-17*
