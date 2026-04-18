---
status: partial
phase: 10-supabase-auth-foundation
source: [10-VERIFICATION.md]
started: 2026-04-17T16:51:00Z
updated: 2026-04-17T16:51:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Auth-01 bundle inspection — cold boot with no credentials
expected: Network panel shows NO supabase chunk loaded on initial page render; only the main index chunk and vendor chunks load. The supabase-*.js chunk (187KB) must NOT appear until the user clicks SIGN IN.
result: passed (2026-04-18) — DevTools Network filter "supabase" returns 0/86 requests on cold boot; 33MB total transferred, 0KB from Supabase. Lazy-load verified at live runtime.

### 2. Email + password sign-in (D-39 + D-40: auth-wall)
expected: On boot with no prior session, the full-screen auth-wall covers the app. User enters email + password, clicks SIGN IN (or presses Enter). Wall dismisses on success, success toast fires, dashboard renders with avatar in sidebar. Session persists on F5 reload — returning user lands directly on dashboard, wall never appears. Wrong password shows inline "Invalid email or password." and re-enables the form.
result: [pending]

### 3. Google OAuth sign-in — profile name and avatar populate
expected: Clicking SIGN IN WITH GOOGLE on the auth-wall opens Google consent screen (app name reads "James's Personal Apps" per shared Google Cloud project), returns to /#/auth-callback, profile name (full_name from user_metadata) + avatar (avatar_url from user_metadata) appear in sidebar authed widget. Settings modal shows USE GOOGLE AVATAR button.
result: [pending]

### 4. Sign-out preserves local Dexie data (AUTH-05 live confirmation)
expected: User clicks SIGN OUT in settings modal, sees toast "Signed out. Your data stays on this device.", auth-wall re-appears covering the app (D-40), and on next sign-in all collection/decks/games/watchlist are still present in Treasure Cruise / Thousand-Year Storm / Vandalblast.
result: [pending]

### 5. RLS isolation — D-37 hard gate (live Supabase)
expected: Running `VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx vitest run tests/rls-isolation.test.js` against the deployed huxley project produces 9 tests passing: 6 cross-user SELECT returns empty array, 1 spoofed INSERT rejected, 1 UPDATE no-op, 1 own-user SELECT succeeds.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
