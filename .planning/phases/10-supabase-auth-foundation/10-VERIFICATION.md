---
phase: 10-supabase-auth-foundation
verified: 2026-04-17T16:51:00Z
status: human_needed
score: 5/5 must-haves verified (all automated checks pass; 3 items require live credentials)
human_verification:
  - test: "Auth-01 bundle inspection — cold boot with no credentials"
    expected: "Network panel shows NO supabase chunk loaded on initial page render; only the main index chunk and vendor chunks load. The supabase-*.js chunk (187KB) must NOT appear until the user clicks SIGN IN."
    why_human: "Build output confirms supabase-FmGvI6hO.js is a separate chunk and createClient is absent from index chunk, but confirming zero network load requires actual browser DevTools observation."
  - test: "Email magic-link sign-in with PKCE — full round-trip"
    expected: "User enters email in auth-modal, clicks SEND MAGIC LINK, receives email, clicks link, browser lands on /#/auth-callback, spinner shows 'COMPLETING SIGN-IN...', 200ms SIGNED IN flash, navigates back to pre-auth route. Session persists on F5 reload."
    why_human: "Requires real Supabase credentials + email delivery. The .env.local must be populated and the migration SQL run against the huxley project per 10-AUTH-PREFLIGHT.md."
  - test: "Google OAuth sign-in — profile name and avatar populate"
    expected: "Clicking SIGN IN WITH GOOGLE opens Google consent screen, returns to /#/auth-callback, profile name (full_name from user_metadata) + avatar (avatar_url from user_metadata) appear in sidebar authed widget. Settings modal shows USE GOOGLE AVATAR button."
    why_human: "Requires real Google Cloud Console OAuth 2.0 client ID wired into Supabase huxley project."
  - test: "Sign-out preserves local Dexie data (AUTH-05 live confirmation)"
    expected: "User clicks SIGN OUT in settings modal, sees toast 'Signed out. Your data stays on this device.', sidebar flips to SIGN IN, and all collection/decks/games are still present in Treasure Cruise / Thousand-Year Storm / Vandalblast."
    why_human: "Static grep confirms no db.* references in settings-modal.js SIGN OUT handler (automated check passed), but end-to-end data preservation confirmation requires live session."
  - test: "RLS isolation — D-37 hard gate (live Supabase)"
    expected: "Running 'VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx vitest run tests/rls-isolation.test.js' against the deployed huxley project produces 9 tests passing: 6 cross-user SELECT returns empty array, 1 spoofed INSERT rejected, 1 UPDATE no-op, 1 own-user SELECT succeeds."
    why_human: "rls-isolation.test.js correctly skips when env vars are absent (confirmed: 9 skipped, 0 failed). Full pass requires live credentials + migration deployed."
---

# Phase 10: Supabase Auth Foundation Verification Report

**Phase Goal:** Users can create a Counterflux account, sign in on any device, and the local-first promise stays intact — without forcing account creation on anyone who doesn't want one
**Verified:** 2026-04-17T16:51:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Unauthenticated cold-boot does not load Supabase chunk | ✓ VERIFIED | `createClient` absent from `index-CAFHdFeQ.js` (96KB main); `supabase-FmGvI6hO.js` (187KB) exists as separate chunk. `tests/supabase-lazy-load.test.js` 4/4 passing. |
| 2 | Email magic-link sign-in with PKCE — `/#auth-callback` route + session persists | ✓ VERIFIED (code) / ? HUMAN | `/auth-callback` registered at position 1678, `screenLoaders` loop at 2187 — correct order. PKCE `flowType: 'pkce'` + `persistSession: true` in `src/services/supabase.js`. `exchangeCodeForSession` in `auth-callback-overlay.js`. End-to-end requires live Supabase. |
| 3 | Google OAuth — Google button with brand fidelity; profile populates from OAuth identity | ✓ VERIFIED (code) / ? HUMAN | `auth-modal.js` contains `#131314` bg, `#8E918F` border, `#E3E3E3` text, multi-colour G SVG. `profile.js` `effectiveAvatarUrl` reads `auth.user.user_metadata.avatar_url`. `tests/auth-modal.test.js` 10/10 passing. Live OAuth round-trip requires credentials. |
| 4 | Sign-out preserves local Dexie data | ✓ VERIFIED | `settings-modal.js` SIGN OUT handler contains zero `db.collection`, `db.decks`, `db.deck_cards`, `db.games`, `db.watchlist`, `db.profile` references (D-22 grep: NONE). Only `Alpine.store('auth').signOut()` called. `tests/settings-modal-auth.test.js` Test 8 confirms. |
| 5 | RLS policies enforce `auth.uid() = user_id` with `WITH CHECK` on all 6 tables; `user_id` indexes exist | ✓ VERIFIED (SQL) / ? HUMAN | Migration SQL: 6× `WITH CHECK (auth.uid() = user_id)`, 6× `ENABLE ROW LEVEL SECURITY`, 6× `CREATE INDEX IF NOT EXISTS idx_<table>_user_id`. `tests/rls-isolation.test.js` skips cleanly (9 skipped, 0 failed) without credentials. Live pass requires deployed migration. |

**Score:** 5/5 truths verified at code level. 3 truths additionally require live credential confirmation.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260417_counterflux_auth_foundation.sql` | 6 tables + 12 RLS policies + 6 indexes | ✓ VERIFIED | CREATE SCHEMA counterflux, all 6 tables mirror Dexie v8 shape, 6× WITH CHECK, 6× ENABLE RLS, 6× user_id B-tree index |
| `src/services/supabase.js` | Singleton `getSupabase()` with PKCE config | ✓ VERIFIED | Exports `getSupabase`, `__resetSupabaseClient`. `flowType:'pkce'`, `persistSession:true`, `autoRefreshToken:true`, `detectSessionInUrl:true`. No static import in main.js. |
| `src/stores/auth.js` | Alpine store D-30 shape + lazy-load discipline | ✓ VERIFIED | `initAuthStore` + `__resetAuthStoreSubscription` exported. `hasPriorSession()` localStorage probe. Dynamic `await import('../services/supabase.js')`. `tests/auth-store.test.js` 8/8 pass. |
| `src/router.js` | `/auth-callback` registered before screen routes | ✓ VERIFIED | `/auth-callback` at char 1678, `screenLoaders` loop at char 2187 — correct. Dynamic import of `auth-callback-overlay.js`. |
| `src/main.js` | `initAuthStore()` after `initProfileStore()`, before `initUndoStore()`; `Alpine.effect` bridge; no static supabase import | ✓ VERIFIED | Correct store init order confirmed. `Alpine.effect` calls `profile.hydrate()` then `maybeShowFirstSignInPrompt()`. No `from './services/supabase'` anywhere. |
| `src/components/auth-modal.js` | Vanilla-DOM modal: Google button (brand hex) + email field + magic-link sent state | ✓ VERIFIED | `openAuthModal`, `closeAuthModal` exported. Contains `#131314`, `#8E918F`, `#E3E3E3`, `#0D52BD`, `#2A2D3A`, `#F39C12`. All UI-SPEC copy present. `tests/auth-modal.test.js` 10/10 pass. |
| `src/components/auth-callback-overlay.js` | PKCE overlay: `handleAuthCallback(href)`, pre-auth route capture | ✓ VERIFIED | `handleAuthCallback`, `captureCurrentPreAuthRoute`, `__resetOverlay` exported. `exchangeCodeForSession(href)` called. All UI-SPEC copy present. `tests/auth-callback-overlay.test.js` 8/8 pass. |
| `src/components/settings-modal.js` | Branched signed-in/signed-out; SIGN OUT auth-only; D-22 | ✓ VERIFIED | `SAVE PROFILE`, `DISCARD CHANGES`, `SIGNED IN AS`, `SIGN IN TO SYNC`, `USE GOOGLE AVATAR`, `SIGN OUT`, `Signed out. Your data stays on this device.` all present. D-22 grep: zero db.* refs. `tests/settings-modal-auth.test.js` 10/10 pass. |
| `src/stores/profile.js` | Auth-aware with `hydrate()`, `effectiveAvatarUrl`, `_source`, D-15 priority | ✓ VERIFIED | `_source:'local'`, `_loaded`, `avatar_url_override`, `effectiveAvatarUrl` getter (D-15 priority), `hydrate()` async, Supabase `schema('counterflux').from('profile')` query, `upsert(onConflict:'user_id')`, localStorage mirror. `tests/profile-store-auth.test.js` 7/7 pass. |
| `src/components/first-sign-in-prompt.js` | First-sign-in migration prompt, lockdown, D-16..D-20 | ✓ VERIFIED | `maybeShowFirstSignInPrompt`, `__resetFirstSignInPrompt` exported. `WELCOME BACK`, `KEEP LOCAL PROFILE`, `START FRESH`, `Mila will keep your local profile either way`. z-index:70, rgba(11,12,16,0.95). No X close. escBlocker installed. `tests/first-sign-in-prompt.test.js` 8/8 pass. |
| `src/components/sidebar.js` | `profileWidgetClick()`, `authedDisplayName()`, `authedAvatarUrl()` | ✓ VERIFIED | All three methods present. `profileWidgetClick` branches on `this.$store.auth.status`. `authedAvatarUrl` reads `profile.effectiveAvatarUrl`. |
| `index.html` | Sidebar anonymous/authed branch with `cf-sidebar-signin-cta` | ✓ VERIFIED | `x-if="$store.auth?.status !== 'authed'"` and `x-if="$store.auth?.status === 'authed'"` blocks present. `id="cf-sidebar-signin-cta"`. SIGN IN text present. |
| `.env.example` | Empty placeholder template | ✓ VERIFIED | `VITE_SUPABASE_URL=` and `VITE_SUPABASE_ANON_KEY=` with empty values. No real key committed. |
| `tests/rls-isolation.test.js` | D-37 hard gate — skips cleanly without env vars | ✓ VERIFIED | 9 tests skip cleanly (0 failures). `describeIf` pattern. References all 6 `counterflux` tables. `schema('counterflux')` pattern present. |
| `tests/supabase-lazy-load.test.js` | AUTH-01 bundle-inspection proof | ✓ VERIFIED | 4/4 pass. Confirms `@supabase/supabase-js` not in static import graph. Confirms `src/services/supabase.js` not statically imported. Confirms dynamic import pattern in `auth.js`. |
| `.planning/phases/10-supabase-auth-foundation/10-AUTH-PREFLIGHT.md` | Provisioning runbook (D-34) | ✓ VERIFIED | Contains `huxley`, `hodnhjipurvjaskcsjvj`, `counterflux-*.vercel.app`, `/auth/v1/callback`, `VITE_SUPABASE_URL`, `rls-isolation.test.js`, `Exposed schemas`, `20260417_counterflux_auth_foundation.sql`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/stores/auth.js` | `src/services/supabase.js` | `await import('../services/supabase.js')` | ✓ WIRED | Dynamic import only — never static. Used in `init()`, `signInMagic()`, `signInGoogle()`, `signOut()`. |
| `src/router.js` `/auth-callback` | `auth-callback-overlay.js handleAuthCallback()` | Dynamic import inside route handler | ✓ WIRED | `router.on('/auth-callback', async () => { const m = await import('./components/auth-callback-overlay.js'); ... })` |
| `src/main.js` | `initAuthStore()` | Called after `initProfileStore()`, before `initUndoStore()` | ✓ WIRED | Confirmed by source read and position check. |
| `src/main.js` | `Alpine.store('auth').init()` | Called after `initRouter()` | ✓ WIRED | Fire-and-forget after router resolve. |
| `src/main.js` Alpine.effect | `profile.hydrate()` then `maybeShowFirstSignInPrompt()` | `Alpine.effect(() => { ... await profile.hydrate(); await maybeShowFirstSignInPrompt() })` | ✓ WIRED | Reactive dep on `auth.status`. |
| Sidebar anonymous CTA | `openAuthModal()` | `profileWidgetClick()` → `window.__openAuthModal()` | ✓ WIRED | `sidebar.js profileWidgetClick` checks `auth.status !== 'authed'` then calls `window.__openAuthModal`. |
| `auth-modal.js` Google button | `Alpine.store('auth').signInGoogle()` | `googleBtn.addEventListener('click', ...)` | ✓ WIRED | Direct call in click handler. |
| `auth-modal.js` magic-link form | `Alpine.store('auth').signInMagic(email)` | `sendBtn.addEventListener('click', ...)` | ✓ WIRED | Direct call after `captureCurrentPreAuthRoute()`. |
| Settings modal SIGN OUT | `Alpine.store('auth').signOut()` | `signOutBtn.addEventListener('click', ...)` | ✓ WIRED | Async click handler calls only `signOut()`, no Dexie. |
| `src/stores/profile.js hydrate()` | `supabase.schema('counterflux').from('profile')` | `await import('../services/supabase.js')` | ✓ WIRED | Query includes `.eq('user_id', auth.user.id).maybeSingle()`. |
| `first-sign-in-prompt.js` KEEP CTA | `counterflux.profile upsert` | `profile._source = 'cloud'; await profile.update(...)` | ✓ WIRED | Forces `_source` to `'cloud'` so `update()` routes to Supabase upsert. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `src/stores/profile.js` | `this.name`, `this.avatar_url_override`, `this._source` | `supabase.schema('counterflux').from('profile').select('*').eq('user_id', auth.user.id).maybeSingle()` | Yes — live DB query (skips on anonymous, returns real row when authed) | ✓ FLOWING |
| `src/components/settings-modal.js` signed-in branch | `auth.user.email`, `googleAvatar` | `Alpine.store('auth').user.user_metadata.avatar_url` | Yes — populated by Supabase `onAuthStateChange` session | ✓ FLOWING |
| `src/components/sidebar.js` authed widget | `authedDisplayName()`, `authedAvatarUrl()` | `this.$store.profile.effectiveAvatarUrl` → D-15 priority chain | Yes — reactive to profile store | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Supabase chunk absent from main bundle | `node -e "...createClient in main chunk..."` | `false` | ✓ PASS |
| Supabase chunk exists as separate artifact | Build output `dist/assets/supabase-*.js` | 187KB chunk present | ✓ PASS |
| `/auth-callback` before screenLoaders | Position check (1678 vs 2187) | Correct order | ✓ PASS |
| D-22: SIGN OUT handler zero Dexie refs | Grep `db\.(collection|decks|...)` in settings-modal | NONE | ✓ PASS |
| SQL: 6 WITH CHECK clauses | Node grep on migration SQL | 6 found | ✓ PASS |
| SQL: 6 ENABLE RLS | Node grep on migration SQL | 6 found | ✓ PASS |
| SQL: 6 user_id B-tree indexes | Node grep on migration SQL | 6 found | ✓ PASS |
| All 8 Phase 10 test files | `npm test -- tests/auth-*.test.js tests/supabase-*.test.js tests/profile-*.test.js tests/settings-modal-auth.test.js tests/first-sign-in-prompt.test.js tests/rls-isolation.test.js` | 8 files pass (rls-isolation skips cleanly) | ✓ PASS |
| npm run build | Vite build | 0 errors, supabase chunk split | ✓ PASS |
| RLS isolation live | Requires `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` | 9 tests skipped (no creds) | ? SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUTH-01 | 10-02 | Supabase JS lazy-imported only on auth initiation | ✓ SATISFIED | `createClient` absent from `index-*.js`. `tests/supabase-lazy-load.test.js` 4/4 pass. |
| AUTH-02 | 10-02, 10-03 | Email magic-link sign-in with PKCE | ✓ SATISFIED (code) | PKCE configured, `/auth-callback` first, `exchangeCodeForSession`, `tests/auth-callback-overlay.test.js` 8/8. Live end-to-end is human_verification item. |
| AUTH-03 | 10-03 | Google OAuth sign-in (desktop) | ✓ SATISFIED (code) | Google button with brand-compliant hex values, `signInWithOAuth({provider:'google'})`, `user_metadata.avatar_url` priority in `effectiveAvatarUrl`. Live OAuth is human_verification item. |
| AUTH-04 | 10-04 | Auth-aware profile; settings modal refactor | ✓ SATISFIED | `profile.js` with `hydrate()`, `_source`, `effectiveAvatarUrl`. Settings modal branches on `auth.status`. Signed-in: SIGNED IN AS chip, DISPLAY NAME, conditional USE GOOGLE AVATAR, SIGN OUT. Signed-out: SYNC CTA card, email editable. `tests/settings-modal-auth.test.js` 10/10. |
| AUTH-05 | 10-02, 10-04 | Session persists across reloads; sign-out preserves Dexie data | ✓ SATISFIED | `persistSession:true`, `hasPriorSession()` probe, `getSession()` on returning user. D-22 grep: zero Dexie refs in SIGN OUT handler. `tests/settings-modal-auth.test.js` Test 8 confirms static. |
| AUTH-06 | 10-01 | RLS policies on 6 tables with WITH CHECK; isolation test | ✓ SATISFIED (SQL + test) | 6 WITH CHECK clauses, 6 ENABLE RLS, 6 B-tree indexes. `tests/rls-isolation.test.js` skips cleanly. Live pass requires deployed migration + credentials (human_verification item). |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/auth-callback-overlay.js` | — | Statically imported by `auth-modal.js` (for `captureCurrentPreAuthRoute`), triggers Vite build warning about ineffective dynamic import in `router.js` | ⚠️ Warning | `auth-callback-overlay.js` itself lands in the main bundle, but its internal dynamic `import('../services/supabase.js')` still defers `createClient` to the separate chunk. AUTH-01 is not violated. The warning is cosmetic — overlay logic in main bundle adds ~4KB before first auth click. Acceptable trade-off for synchronous `captureCurrentPreAuthRoute()` access in `auth-modal.js`. |

No blocker anti-patterns found. No `TODO/FIXME/placeholder` comments, no empty implementations, no hardcoded empty data arrays in rendering paths, no `console.log`-only implementations.

### Human Verification Required

#### 1. Cold-boot Supabase lazy-load confirmation

**Test:** Open `npm run dev` or `npm run preview` in a browser with no `.env.local` (or empty values). Open DevTools Network tab. Reload the page. Check that no `supabase-*.js` chunk appears in the waterfall.
**Expected:** Only `index-*.js`, `vendor-*.js`, and CSS chunks load. The 187KB `supabase-*.js` chunk is absent from the initial waterfall.
**Why human:** Build output confirms the chunk split is correct, but confirming zero network load requires actual browser DevTools observation.

#### 2. Email magic-link sign-in — full round-trip

**Test:** Populate `.env.local` with real `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the huxley project. Run the SQL migration per `10-AUTH-PREFLIGHT.md`. Open `npm run dev`. Click SIGN IN in the sidebar. Enter a real email. Click SEND MAGIC LINK. Open the email and click the link.
**Expected:** Browser lands on `/#/auth-callback`, spinner shows `COMPLETING SIGN-IN…` with Mila caption, flashes `SIGNED IN`, navigates back to the pre-auth route. Toast `Welcome, {name}.`. Reload (F5) — sidebar still shows authed state with name/avatar.
**Why human:** Requires real Supabase credentials and email delivery. `tests/auth-callback-overlay.test.js` proves the code path but not email delivery.

#### 3. Google OAuth sign-in — profile populate

**Test:** With Google provider configured in Supabase huxley project (per `10-AUTH-PREFLIGHT.md`). Click SIGN IN, click SIGN IN WITH GOOGLE. Complete Google consent. Return to app.
**Expected:** Sidebar authed widget shows Google profile name and avatar. Settings modal opens showing `SIGNED IN AS` chip with email, `USE GOOGLE AVATAR` button visible (because `user_metadata.avatar_url` is set), SIGN OUT at bottom.
**Why human:** Requires Google Cloud Console OAuth 2.0 client ID + Supabase Google provider configuration.

#### 4. Sign-out preserves local Dexie data (live confirmation)

**Test:** While signed in, navigate to Treasure Cruise and verify existing collection cards are visible. Open settings and click SIGN OUT.
**Expected:** Toast `Signed out. Your data stays on this device.`. Sidebar flips to SIGN IN CTA. Navigate to Treasure Cruise — all collection cards still present. Navigate to Thousand-Year Storm — all decks still present.
**Why human:** Static D-22 grep confirms the handler has no Dexie references; confirming actual data survival requires a live session with populated data.

#### 5. RLS isolation — D-37 hard gate (live Supabase)

**Test:** With credentials and deployed migration: `VITE_SUPABASE_URL=<url> VITE_SUPABASE_ANON_KEY=<key> npx vitest run tests/rls-isolation.test.js`
**Expected:** 9 tests pass: 6 cross-user SELECT assertions return empty array, 1 spoofed INSERT rejected, 1 UPDATE no-op, 1 own-user positive control.
**Why human:** RLS is a server-side Postgres feature. Without live Supabase the test skips. This is D-37 — the single most load-bearing guardrail for the milestone.

### Gaps Summary

No gaps found at code level. All 5 success criteria are satisfied by the implementation. The `human_needed` status reflects that AUTH-02, AUTH-03, AUTH-05 (end-to-end), and AUTH-06 (RLS live) require live Supabase credentials to fully exercise — this is expected for Phase 10 per the verification brief ("items that are code-complete but need real Supabase credentials ... classify as human_verification items").

The one build warning (Vite `[INEFFECTIVE_DYNAMIC_IMPORT]` for `auth-callback-overlay.js`) is non-blocking: the `@supabase/supabase-js` SDK correctly stays in the separate chunk. The overlay module itself (~4KB) landing in the main bundle is an acceptable trade-off for the synchronous `captureCurrentPreAuthRoute()` export.

---

_Verified: 2026-04-17T16:51:00Z_
_Verifier: Claude (gsd-verifier)_
