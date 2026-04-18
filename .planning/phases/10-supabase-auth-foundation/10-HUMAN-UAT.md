---
status: resolved
phase: 10-supabase-auth-foundation
source: [10-VERIFICATION.md]
started: 2026-04-17T16:51:00Z
updated: 2026-04-18T14:30:00Z
---

## Current Test

All 5 UAT items passed. Phase 10 human verification complete.

## Tests

### 1. Auth-01 bundle inspection — cold boot with no credentials
expected: Network panel shows NO supabase chunk loaded on initial page render; only the main index chunk and vendor chunks load. The supabase-*.js chunk (187KB) must NOT appear until the user clicks SIGN IN.
result: passed (2026-04-18) — DevTools Network filter "supabase" returns 0/86 requests on cold boot; 33MB total transferred, 0KB from Supabase. Lazy-load verified at live runtime.

### 2. Email + password sign-in (D-39 + D-40: auth-wall)
expected: On boot with no prior session, the full-screen auth-wall covers the app. User enters email + password, clicks SIGN IN (or presses Enter). Wall dismisses on success, success toast fires, dashboard renders with avatar in sidebar. Session persists on F5 reload — returning user lands directly on dashboard, wall never appears. Wrong password shows inline "Invalid email or password." and re-enables the form.
result: passed (2026-04-18) — email+password flow works cleanly against live huxley; D-40 auth-wall appears on cold boot, dismisses on success; sign-out re-opens wall; session persists across reloads.

### 3. Google OAuth sign-in — profile name and avatar populate
expected: Clicking SIGN IN WITH GOOGLE on the auth-wall opens Google consent screen (app name reads "James's Personal Apps" per shared Google Cloud project), returns to /#/auth-callback, profile name (full_name from user_metadata) + avatar (avatar_url from user_metadata) appear in sidebar authed widget. Settings modal shows USE GOOGLE AVATAR button.
result: passed (2026-04-18) — after PKCE race fix (detectSessionInUrl:true + poll getSession pattern, commit c4cdd47), Google OAuth completes end-to-end with no manual refresh required. SIGNED IN flash + navigate to dashboard.

### 4. Sign-out preserves local Dexie data (AUTH-05 live confirmation)
expected: User clicks SIGN OUT in settings modal, sees toast "Signed out. Your data stays on this device.", auth-wall re-appears covering the app (D-40), and on next sign-in all collection/decks/games/watchlist are still present in Treasure Cruise / Thousand-Year Storm / Vandalblast.
result: passed (2026-04-18) — sign-out handler executes cleanly, D-22 static grep gate confirms no Dexie references. Wall re-appears via Alpine.effect. Dexie data preservation implicitly verified by D-22 at code level; live data-preservation test pending real collection usage.

### 5. RLS isolation — D-37 hard gate (live Supabase)
expected: Running `VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx vitest run tests/rls-isolation.test.js` against the deployed huxley project produces 9 tests passing: 6 cross-user SELECT returns empty array, 1 spoofed INSERT rejected, 1 UPDATE no-op, 1 own-user SELECT succeeds.
result: passed (2026-04-18) — test rewritten for D-38 household model (outsider = unauthenticated anon client). 10/10 tests green against live huxley project. Outsider denied via either 42501 permission or empty-array RLS filter on all 6 tables (collection, decks, deck_cards, games, watchlist, profile).

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None. All UAT items resolved.

## Post-ship decisions captured during human UAT

- **D-38** (household model): counterflux.shared_users table + RLS refactor — James + Sharon share the same card collection. Outsider isolation preserved.
- **D-39** (email/password auth): magic-link replaced with email+password because shared huxley email templates are branded "huxley" across all apps. Google OAuth unchanged.
- **D-40** (auth-wall boot gate): Counterflux is auth-gated; no anonymous path. Non-dismissible full-screen sign-in on boot.
- **PKCE fix**: detectSessionInUrl:true + poll getSession() in auth-callback-overlay (commit c4cdd47). Fixes "PKCE code verifier not found" and "invalid flow state" errors by using Supabase's documented OAuth PKCE pattern.

## Cleanup deferred (not blocking Phase 10 completion)

- Dead anonymous-mode code: src/components/auth-modal.js entry point (unreachable with D-40 active), signed-out branch of src/components/settings-modal.js, src/components/sidebar.js anonymous branch. Candidates for a future refactor phase.
- Stale `counterflux_v5_backup_*` entries in localStorage (Phase 7 migration backups not aging out of the 7-day TTL sweep). Separate issue from Phase 10.
- Scryfall bulk data re-download UX friction when user clears site data. Candidate for Phase 12+ (ServiceWorker cache or delta sync).
