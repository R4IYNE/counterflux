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
result: [pending]

### 2. Email magic-link sign-in with PKCE — full round-trip
expected: User enters email in auth-modal, clicks SEND MAGIC LINK, receives email, clicks link, browser lands on /#/auth-callback, spinner shows "COMPLETING SIGN-IN...", ~200ms SIGNED IN flash, navigates back to pre-auth route. Session persists on F5 reload.
result: [pending]

### 3. Google OAuth sign-in — profile name and avatar populate
expected: Clicking SIGN IN WITH GOOGLE opens Google consent screen, returns to /#/auth-callback, profile name (full_name from user_metadata) + avatar (avatar_url from user_metadata) appear in sidebar authed widget. Settings modal shows USE GOOGLE AVATAR button.
result: [pending]

### 4. Sign-out preserves local Dexie data (AUTH-05 live confirmation)
expected: User clicks SIGN OUT in settings modal, sees toast "Signed out. Your data stays on this device.", sidebar flips to SIGN IN, and all collection/decks/games are still present in Treasure Cruise / Thousand-Year Storm / Vandalblast.
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
