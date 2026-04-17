---
phase: 10
plan: 03
subsystem: auth
tags:
  - auth
  - supabase
  - pkce
  - vanilla-dom-modal
  - tdd
  - ui-spec
  - reduced-motion
dependency-graph:
  requires:
    - "Phase 10-02 — Alpine auth store contract (signInMagic/signInGoogle/status/user), /auth-callback router route, overlay stub"
    - "10-UI-SPEC.md — APPROVED design contract (Component Anatomy §1–§3, §7)"
  provides:
    - "src/components/auth-modal.js — vanilla-DOM modal (openAuthModal, closeAuthModal) with idle / email-typing / magic-link-sent states per UI-SPEC §1 + §2"
    - "src/components/auth-callback-overlay.js — REAL PKCE callback overlay (handleAuthCallback, captureCurrentPreAuthRoute, __resetOverlay) per UI-SPEC §3"
    - "src/components/sidebar.js — profileWidgetClick / authedDisplayName / authedAvatarUrl helpers (D-09 single sign-in touchpoint)"
    - "window.__openAuthModal global — sidebar + future settings-modal sync-CTA entry point"
    - "cf_pre_auth_hash sessionStorage key — Visual Regression Anchor #4 pre-auth route preservation contract"
    - ".cf-auth-spin CSS utility — reusable 1s linear spinner + reduced-motion override"
  affects:
    - "Plan 10-04 settings-modal refactor consumes window.__openAuthModal for signed-out sync-CTA; extends sidebar authedAvatarUrl priority with profile.avatar_url_override; ships #cf-first-sign-in-prompt under the inherited reduced-motion selector list"
    - "Phase 11 sync engine — sign-in flow now lands users back on their pre-auth route so mid-session sync interruptions (prompting a re-auth) don't lose navigation context"
tech-stack:
  added:
    - "No new npm dependencies — Supabase client and alpinejs contracts consumed from Plan 10-02"
  patterns:
    - "Vanilla-DOM modal with singleton guard (mirror of settings-modal.js / migration-blocked-modal.js)"
    - "Wall-clock anchored countdown via Date.now snapshot + 1s setInterval display tick — immune to background-tab throttling (Phase 9 Vandalblast timer lineage)"
    - "Pre-auth route capture via sessionStorage — survives full-page navigations (Google OAuth) where regular JS state would be lost"
    - "Google brand-fidelity SVG inlining — 18×18 multi-colour G mark + #131314/#8E918F/#E3E3E3 hex trio treated as a single cross-cutting token exception"
    - "In-modal body swap for state transitions (magic-link-sent) — preserves header + X close, replaces only the body innerHTML + wires new listeners (D-12 no-screen-takeover)"
key-files:
  created:
    - src/components/auth-modal.js
    - tests/auth-modal.test.js
    - tests/auth-callback-overlay.test.js
  modified:
    - src/components/auth-callback-overlay.js
    - src/components/sidebar.js
    - index.html
    - src/styles/main.css
    - src/main.js
key-decisions:
  - "captureCurrentPreAuthRoute STATICALLY imported by auth-modal (not dynamically) — the route must be stashed BEFORE window.location navigates to Google/Supabase; a dynamic import at that moment would race the redirect. Rolldown emits an INEFFECTIVE_DYNAMIC_IMPORT warning because this pulls auth-callback-overlay into the main bundle (~200 LOC, <3KB gz); the @supabase/supabase-js chunk stays 100% code-split at 187KB (AUTH-01 preserved)."
  - "Resend countdown uses setInterval(tick, 1000) + Date.now snapshot rather than RAF — JetBrains Mono 11px tick granularity is 1 Hz, and setInterval guarantees exactly one paint per second without the 60 Hz waste RAF would incur. Wall-clock anchoring (compute remaining from Date.now - sentAt, not a counter) keeps backgrounded tabs accurate per Phase 9 Vandalblast precedent."
  - "Google button hover wired via inline onmouseover/onmouseout rather than CSS — matches the existing sidebar/search inline-style pattern and avoids adding a :hover rule that CSS specificity might fight with the dark-theme overrides. Acceptable per UI-SPEC Design System note ('inline-style parity with existing settings-modal is acceptable')."
  - "Magic-link-sent swap uses innerHTML replacement of #cf-auth-body rather than unmount/remount — preserves the already-wired X close button in the header and the escape handler, eliminating listener churn between the two states."
  - "Sidebar widget registered as Alpine.data('sidebarComponent', sidebarComponent) in main.js instead of per-template x-data inline instantiation — the profile widget's x-data declaration runs AFTER main.js's Alpine.data() registration, so the helper functions (profileWidgetClick, authedDisplayName, authedAvatarUrl) resolve via the component registry. Clean separation: template stays declarative, behaviour lives in sidebar.js."
  - "The helper authedAvatarUrl() ships the 2-tier priority (profile.avatar → Google) now; Plan 4 extends to 3-tier (profile.avatar_url_override → profile.avatar → Google). The 2-tier shape matches the v1.0 profile store shape so the sidebar keeps rendering correctly between Plan 10-03 and Plan 10-04 shipping."
  - "Reduced-motion selector list includes #cf-first-sign-in-prompt even though Plan 10-04 ships that component — cheaper to front-load the selector than to edit main.css twice, and invalid selectors for not-yet-mounted elements are a harmless no-op."
patterns-established:
  - "Google brand-fidelity token exception pattern (#131314/#8E918F/#E3E3E3 + multi-colour G SVG) — reusable for any future external-brand OAuth button (Apple, GitHub) that requires visual brand compliance over design-system coherence"
  - "Pre-auth route capture pattern (sessionStorage + skip-self check) — reusable for any cross-navigation workflow (payment confirmation, OAuth with returnTo, auth refresh interrupting a deck edit)"
  - "Alpine.data(sidebarComponent) registration sequence — main.js imports + registers → template uses x-data='sidebarComponent()' without needing an import inside the template (matches splashScreen precedent)"
requirements-completed:
  - AUTH-02
  - AUTH-03
metrics:
  duration: "8m 30s"
  started: "2026-04-17T15:18:27Z"
  completed: "2026-04-17T15:26:57Z"
  completed-date: "2026-04-17"
  tasks: 4
  files: 7
  commits: 6
---

# Phase 10 Plan 03: Auth Modal + Callback Overlay + Sidebar Branch Summary

**Vanilla-DOM auth-modal (openAuthModal/closeAuthModal, ~408 LOC) shipping every UI-SPEC §1 + §2 requirement including brand-fidelity Google button, EMAIL validation, wall-clock 30s resend cooldown, and D-12 in-modal magic-link-sent swap; real PKCE callback overlay replacing Plan 2's stub (~211 LOC) with exchangeCodeForSession + 200ms success flash + pre-auth-route restoration; sidebar profile widget anonymous/authed branch (D-09 single sign-in touchpoint); extended @media (prefers-reduced-motion: reduce) block covering all three auth surfaces — Visual Regression Anchors #2, #3, #4 from 10-UI-SPEC.md now implementation-complete.**

## Performance

- **Duration:** 8m 30s
- **Started:** 2026-04-17T15:18:27Z
- **Completed:** 2026-04-17T15:26:57Z
- **Tasks:** 4 (two with TDD RED/GREEN pair → 6 task commits total)
- **Files created:** 3 | **Files modified:** 4

## Accomplishments

- `src/components/auth-modal.js` (408 LOC) ships the full idle-state DOM scaffold (SIGN IN heading + X close + Google button + OR divider + EMAIL + SEND MAGIC LINK + helper text), email validation (enable/disable on input, inline `Enter a valid email address.` error on blur), magic-link flow (SENDING… → D-12 in-modal swap to CHECK YOUR INBOX with `{email}` interpolation), wall-clock anchored 30s RESEND IN {N}s countdown (flips to RESEND MAGIC LINK + click-to-resend), Google button flow (OPENING GOOGLE… + status-based popup-cancel detection), and three close paths (Escape, X icon, backdrop click) with focus restoration to `#cf-sidebar-signin-cta`
- `src/components/auth-callback-overlay.js` (211 LOC) REPLACES Plan 2's 35-LOC stub with the real splash-style overlay: spinner → `supabase.auth.exchangeCodeForSession(href)` → (success: 200ms SIGNED IN flash + router.navigate to captured route + `Welcome, {name}.` toast) / (expired: SIGN-IN LINK EXPIRED + BACK TO COUNTERFLUX re-opens auth-modal) / (generic: COULDN'T FINISH SIGN-IN). `captureCurrentPreAuthRoute` export wired into auth-modal's signIn call-sites
- `src/components/sidebar.js` gained `profileWidgetClick()` / `authedDisplayName()` / `authedAvatarUrl()` methods; `index.html` profile widget block branches on `$store.auth?.status` — anonymous 36px primary-blue SIGN IN CTA with `id="cf-sidebar-signin-cta"` + collapsed login-glyph tooltip, authed avatar+name+email row with aria-label `Open settings — signed in as {name}`
- `src/styles/main.css` extended — exactly ONE `@media (prefers-reduced-motion: reduce)` block now covers Phase 7 + 8 + 8.1 + 9 + 10 selectors including `#cf-auth-modal *`, `#cf-auth-callback-overlay *`, `#cf-first-sign-in-prompt *` (Plan 4 inheritance), plus `.cf-auth-spin { animation: none !important }`; @keyframes cf-auth-spin declared outside the block (1s linear infinite 360deg rotation)
- `src/main.js` registers `window.__openAuthModal = openAuthModal` alongside the existing `__openSettingsModal` and `Alpine.data('sidebarComponent', sidebarComponent)` alongside `splashScreen`
- **AUTH-01 preserved**: production bundle still code-splits `supabase-js` as its own 187KB chunk (`dist/assets/supabase-FmGvI6hO.js`); the overlay went into the main bundle due to auth-modal's static import of `captureCurrentPreAuthRoute`, but this costs <3KB gz and is the correct trade-off (see Decisions)
- **Test suite**: 10 auth-modal tests + 8 auth-callback-overlay tests = 18 new tests; full suite 79 files pass / 718 tests pass / 9 skipped / 10 todo / 0 failing — +18 tests over Plan 10-02's 700 baseline, zero regressions

## Task Commits

1. **Task 3.1 RED:** Failing auth-modal tests (9 behaviours) — `724424b`
2. **Task 3.1 GREEN:** auth-modal.js + main.js wiring — `9025807`
3. **Task 3.2 RED:** Failing auth-callback-overlay tests (8 behaviours) — `6bddecb`
4. **Task 3.2 GREEN:** Overwrote stub with real PKCE overlay — `cde097d`
5. **Task 3.3:** Sidebar profile widget branch + index.html — `8cf8ea3`
6. **Task 3.4:** Reduced-motion CSS extension — `4484471`

**Plan metadata commit:** (appended after this SUMMARY ships)

## Files Created/Modified

**Created:**

- `src/components/auth-modal.js` (408 LOC) — singleton-guarded vanilla-DOM modal with idle + magic-link-sent states; inline-style 420px card, `rgba(11,12,16,0.85)` backdrop at z-60; brand-fidelity 18×18 multi-colour G SVG; `EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/`; `RESEND_COOLDOWN_MS = 30_000`; sets `window.__openAuthModal` at module bottom for pre-main.js-execution availability
- `tests/auth-modal.test.js` (309 LOC) — 10 tests under 8 describe blocks: idle state (1) + email validation (1) + magic-link flow (1) + resend cooldown (1) + Google button flow (2: call + brand styling) + close interactions (3: Escape + X + backdrop) + error toasts (1 with rate-limit + network error sub-cases)
- `tests/auth-callback-overlay.test.js` (131 LOC) — 8 tests covering pending overlay mount, success with captured route (fake-timers + 200ms flash), fallback to `/`, expired-link error, generic error, BACK CTA round-trip (re-opens auth-modal + navigates + info toast), captureCurrentPreAuthRoute basic + recursion-skip

**Modified:**

- `src/components/auth-callback-overlay.js` — REPLACED Plan 2's 35-LOC stub with 211-LOC real implementation; dynamic import of `../services/supabase.js` (preserves AUTH-01 lazy-load); mounts `<div id="cf-auth-callback-overlay">` to body at z-80; `PRE_AUTH_KEY = 'cf_pre_auth_hash'` sessionStorage contract; exports `handleAuthCallback`, `captureCurrentPreAuthRoute`, `__resetOverlay`
- `src/components/sidebar.js` — added `profileWidgetClick()`, `authedDisplayName()`, `authedAvatarUrl()` methods to the `sidebarComponent()` return object; preserves all existing methods (handleNavClick, hasAlertBadge, navItemClasses, toggleSidebar)
- `index.html` — replaced the single hover-bg-surface-hover profile div (lines 176–205) with an `x-data="sidebarComponent()"` wrapper containing two `<template x-if>` branches keyed on `$store.auth?.status`; anonymous branch has `id="cf-sidebar-signin-cta"` (matches auth-modal focus-restoration target), authed branch reads `authedAvatarUrl()` / `authedDisplayName()` / `$store.auth.user?.email`
- `src/styles/main.css` — extended the single `@media (prefers-reduced-motion: reduce)` block with `#cf-auth-modal *`, `#cf-auth-callback-overlay *`, `#cf-first-sign-in-prompt *` (Plan 4 inheritance) + `.cf-auth-spin { animation: none !important }`; added `@keyframes cf-auth-spin` + `.cf-auth-spin { animation: cf-auth-spin 1s linear infinite; display: inline-block; }` outside the block
- `src/main.js` — added `import { openAuthModal } from './components/auth-modal.js';` + `import { sidebarComponent } from './components/sidebar.js';`; `window.__openAuthModal = openAuthModal;` alongside `__openSettingsModal`; `Alpine.data('sidebarComponent', sidebarComponent);` alongside `splashScreen`

## Visual Regression Anchor Verification

| Anchor | Status | Evidence |
|---|---|---|
| #1 Lazy-load discipline (AUTH-01) | **STILL GREEN** | `dist/assets/supabase-FmGvI6hO.js` = 187.08 KB code-split chunk; `tests/supabase-lazy-load.test.js` 4/4 pass |
| #2 Google button brand fidelity | **IMPLEMENTED** | `src/components/auth-modal.js` hard-codes `#131314` bg / `#8E918F` border / `#E3E3E3` text / inlined 48×48 multi-colour G SVG; test `Google button brand styling` asserts no `#0D52BD` leakage |
| #3 In-modal swap (no screen takeover) | **IMPLEMENTED** | `_swapToSentState()` replaces only `#cf-auth-body` innerHTML; header + X close stay mounted; CLOSE MODAL + RESEND buttons live inside the same card; test `magic-link flow` asserts `CHECK YOUR INBOX` + `We sent a link to {email}` + `CLOSE MODAL` + `RESEND IN 30s` all in the same modal |
| #4 Pre-auth route preservation | **IMPLEMENTED** | `captureCurrentPreAuthRoute()` stashes `window.location.hash` to `sessionStorage['cf_pre_auth_hash']` at every signIn call-site; callback overlay `consumeCapturedRoute()` + `router.navigate(route.replace(/^#/, ''))` restores; test `success navigates to captured pre-auth route` asserts round-trip with `#/thousand-year-storm/abc` → `/thousand-year-storm/abc` |

Anchors #5 (first-sign-in prompt), #6 (sign-out preserves local data), #7 (Google avatar conditional button), #8 (noun-anchored settings CTAs) are Plan 10-04 territory — this plan's scope ends at the sidebar sign-in entry + PKCE round trip.

## Decisions Made

1. **captureCurrentPreAuthRoute shipped as a STATIC import from auth-modal.js** — the route must be captured BEFORE `window.location` navigates to Google / Supabase's magic-link domain; a dynamic import at that moment would race the redirect. Rolldown emits an `INEFFECTIVE_DYNAMIC_IMPORT` warning because this pulls auth-callback-overlay.js into the auth-modal's module graph (and therefore the main bundle), but the cost is <3KB gz and the 187KB `@supabase/supabase-js` chunk — the thing AUTH-01 actually guards — stays 100% code-split.
2. **Resend countdown uses setInterval(tick, 1000) anchored to Date.now**, not RAF. Tick granularity is 1 Hz (one paint per second) and `setInterval` guarantees exactly that without the 60 Hz churn RAF would incur. Wall-clock anchoring (compute `remaining = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - sentAt)) / 1000)`) keeps backgrounded tabs accurate per the Phase 9 Vandalblast turn-timer precedent.
3. **Magic-link-sent swap via innerHTML replacement of `#cf-auth-body`** — preserves the already-wired X close button and escape handler in the header, eliminating listener churn between idle and sent states. The alternative (full unmount + remount) would need escape/backdrop re-wiring on every state flip.
4. **Google button hover via inline `onmouseover`/`onmouseout`** — matches the existing sidebar + search inline-style pattern; avoids adding a `:hover` CSS rule that specificity might fight with the dark-theme inline overrides. Acceptable per UI-SPEC Design System note.
5. **Sidebar widget registered as `Alpine.data('sidebarComponent', sidebarComponent)` in main.js** — the profile widget template declares `x-data="sidebarComponent()"` inline, and Alpine's data registry resolves the helper functions (profileWidgetClick, authedDisplayName, authedAvatarUrl) without needing an import inside the template (which HTML doesn't support). Mirrors the `splashScreen` precedent.
6. **authedAvatarUrl() ships 2-tier priority now** (`profile.avatar` → Google); Plan 10-04 will extend to 3-tier (`profile.avatar_url_override` → `profile.avatar` → Google). The 2-tier shape matches the v1.0 profile store so the sidebar keeps rendering correctly between the two plans.
7. **Reduced-motion selector list includes `#cf-first-sign-in-prompt`** even though Plan 10-04 ships that component — cheaper to front-load the selector than to edit main.css twice; invalid selectors for not-yet-mounted elements are a harmless no-op.

## Deviations from Plan

**None — plan executed exactly as written.**

All four tasks completed with the exact contracts specified in 10-03-PLAN.md (test counts matched: 10 auth-modal tests ≥ 9 required; 8 auth-callback-overlay tests ≥ 7 required). All UI-SPEC copy strings verbatim (SIGN IN WITH GOOGLE, SEND MAGIC LINK, CHECK YOUR INBOX, CLOSE MODAL, RESEND IN 30s, RESEND MAGIC LINK, COMPLETING SIGN-IN…, Mila's recalibrating the sigils. One second., SIGNED IN, SIGN-IN LINK EXPIRED, COULDN'T FINISH SIGN-IN, BACK TO COUNTERFLUX). All brand hexes verbatim (#131314, #8E918F, #E3E3E3 for Google; #0D52BD, #2A2D3A, #F39C12 for Counterflux). TDD RED/GREEN discipline observed on Tasks 3.1 and 3.2.

## Issues Encountered

**1. Rolldown INEFFECTIVE_DYNAMIC_IMPORT warning on auth-callback-overlay.js** — during `npm run build` Rolldown emits:

```
[INEFFECTIVE_DYNAMIC_IMPORT] src/components/auth-callback-overlay.js is dynamically imported by src/router.js but also statically imported by src/components/auth-modal.js, dynamic import will not move module into another chunk.
```

Root cause: auth-modal.js statically imports `captureCurrentPreAuthRoute` from auth-callback-overlay.js. Rolldown therefore pulls the overlay module into the same chunk as auth-modal, which is itself statically imported by main.js — so the overlay lands in the main bundle despite router.js's `await import(...)`. The resulting `dist/assets/auth-callback-overlay-*.js` chunk is only 138 bytes (the router's lazy-import shim).

**Why this is NOT a blocker:** AUTH-01 is the lazy-load constraint that matters — it requires `@supabase/supabase-js` (187KB) to be code-split, not every router-loaded component. The supabase chunk remains code-split (`dist/assets/supabase-FmGvI6hO.js` = 187KB exactly the same size as Plan 10-02's proof). The overlay itself is ~3KB gz; pulling it into the main bundle costs negligibly and is required for the pre-auth route capture to fire BEFORE the redirect (if overlay were lazy-loaded on callback, by the time it loaded the pre-auth hash would already be gone — `window.location.hash` would be `#/auth-callback?code=...`).

**Plan 4 follow-up consideration:** If the auth-callback-overlay ever grows large enough (~>20KB) for the static-import to cost real bytes, extract `captureCurrentPreAuthRoute` to a new file `src/utils/auth-route-capture.js` that auth-modal statically imports while the overlay stays dynamic-only. Current size (~3KB gz) doesn't justify the refactor.

**2. Router.test.js 4 pre-existing Alpine cleanup errors** — confirmed pre-existing (verified by `git stash && npm test`; same 4 errors fire on master before Plan 10-03). Out of scope per deviation Rule 1 pre-existing clause. Tests still report 17/17 pass.

## Known Stubs

None introduced by this plan. Plan 10-02's `src/components/auth-callback-overlay.js` stub (documented in 10-02-SUMMARY.md Known Stubs table) is now fully resolved — the real implementation lands in this plan's Task 3.2 GREEN commit.

## User Setup Required

None new in this plan. Plan 10-01's `10-AUTH-PREFLIGHT.md` remains the canonical runbook (Supabase + Google OAuth + Vercel env vars). Collaborators need `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in `.env.local` before the Google button and magic-link form will reach a real server, but anonymous-mode boot + clicking SIGN IN + closing the modal all work with empty env vars — verified by auth-modal tests.

## Final Test Suite Snapshot

```
Test Files  79 passed | 3 skipped (82)
     Tests  718 passed | 9 skipped | 10 todo (737)
    Errors  4 errors  ← pre-existing router.test.js Alpine cleanup warnings
  Start at  16:25:34
  Duration  3.27s
```

**Delta from Plan 10-02 baseline (700 pass):** +18 tests (10 auth-modal + 8 auth-callback-overlay). Zero regressions.

**AUTH-01 lazy-load proof:** `npx vitest run tests/supabase-lazy-load.test.js` → 4/4 pass.

**Production build:** `npm run build` → exits 0, `dist/assets/supabase-FmGvI6hO.js` = 187.08 KB code-split chunk verified.

## Hand-off Note for Plan 10-04

**1. The sidebar widget reads v1.0 profile shape** (`profile.avatar` + `profile.initials`). Plan 10-04's profile store refactor introduces `profile.avatar_url_override`; update `authedAvatarUrl()` in `src/components/sidebar.js` to prefer `avatar_url_override → profile.avatar → Google avatar_url → null`. Tests in `tests/sidebar-collapse.test.js` pass with the current 2-tier shape; Plan 4 should add a coverage test for the 3-tier priority.

**2. `window.__openAuthModal` is already wired globally** — Plan 4's signed-out settings-modal sync-CTA (`SIGN IN TO SYNC` button) can call `window.__openAuthModal()` directly after `closeSettingsModal()` per UI-SPEC §6. No new import needed.

**3. `#cf-sidebar-signin-cta` is the focus-restoration target** — auth-modal's `closeAuthModal()` returns focus to this id. Plan 4's settings-modal refactor should NOT change this id.

**4. Reduced-motion selector list already includes `#cf-first-sign-in-prompt *`** — Plan 4 can mount the first-sign-in prompt with that id and inherit the reduced-motion contract without touching main.css. If Plan 4 adds additional animated surfaces (first-sign-in prompt uses `scale 0.96 → 1` per UI-SPEC §4 Motion), extend the same `@media` block — do NOT add a duplicate.

**5. `captureCurrentPreAuthRoute` export is the public capture contract.** Plan 4's settings-modal sync-CTA should call it before `window.__openAuthModal()`, matching auth-modal's existing pattern.

## Self-Check: PASSED

File existence (all FOUND):

- `src/components/auth-modal.js` — FOUND (408 LOC)
- `src/components/auth-callback-overlay.js` — FOUND (211 LOC, REPLACED stub)
- `src/components/sidebar.js` — FOUND (with new methods)
- `index.html` — FOUND (with branched profile widget)
- `src/styles/main.css` — FOUND (with extended reduced-motion block)
- `src/main.js` — FOUND (with openAuthModal + sidebarComponent imports)
- `tests/auth-modal.test.js` — FOUND (309 LOC)
- `tests/auth-callback-overlay.test.js` — FOUND (131 LOC)

Commit existence (all FOUND via `git log --oneline`):

- `724424b` (Task 3.1 RED) — FOUND
- `9025807` (Task 3.1 GREEN) — FOUND
- `6bddecb` (Task 3.2 RED) — FOUND
- `cde097d` (Task 3.2 GREEN) — FOUND
- `8cf8ea3` (Task 3.3 sidebar) — FOUND
- `4484471` (Task 3.4 reduced-motion CSS) — FOUND

Test + build:

- `npx vitest run tests/auth-modal.test.js` — 10/10 pass
- `npx vitest run tests/auth-callback-overlay.test.js` — 8/8 pass
- `npx vitest run tests/supabase-lazy-load.test.js` — 4/4 pass (AUTH-01 preserved)
- `npx vitest run` (full suite) — 79 files pass, 718 tests pass, 9 skipped, 10 todo, zero failures
- `npm run build` — exits 0; supabase chunk still code-split at 187.08 KB

---

*Phase: 10-supabase-auth-foundation*
*Plan: 03 — Auth modal + callback overlay + sidebar branch*
*Completed: 2026-04-17*
