# Phase 10: Supabase Auth Foundation - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the Supabase identity layer that unblocks Phase 11 sync. Scope is narrowly *identity + secrets + schema*, not sync logic.

**In-scope:**
- `@supabase/supabase-js` 2.103.x lazy-imported on first auth interaction (AUTH-01)
- Email magic-link sign-in with PKCE flow + `/#auth-callback` route (AUTH-02)
- Google OAuth desktop sign-in (AUTH-03)
- Auth-aware profile store + settings modal refactor (AUTH-04)
- Session persistence across reloads; explicit sign-out preserves local Dexie data (AUTH-05)
- Supabase Postgres schema + RLS policies on all 6 synced tables (AUTH-06)
- Pre-flight checklist for Supabase project + Google Console + Vercel env setup

**Out of scope (Phase 11):**
- Dexie sync hooks / `sync_queue` outbox enqueue
- First-sign-in *collection/decks/games* reconciliation modal
- Any bidirectional data sync

**Key boundary:** After Phase 10 ships, a user can sign in, see their name/avatar populate, sign out — **and zero user data moves between device and cloud yet**. The identity rails are laid; Phase 11 runs the trains.

</domain>

<decisions>
## Implementation Decisions

### Supabase project + secrets
- **D-01:** Host on **existing `huxley` Supabase project** (`hodnhjipurvjaskcsjvj`, eu-west-2) per `d:\Vibe Coding\CLAUDE.md` "all personal apps use huxley" convention. One Google OAuth app, one project, one billing surface. Matches Atlas/MWTA pattern.
- **D-02:** Counterflux tables live in a **dedicated `counterflux` Postgres schema** (`CREATE SCHEMA counterflux`), not `public`. Prevents name collision with Atlas/MWTA tables in the same project. Client uses `supabase.schema('counterflux').from(...)` at every call site. RLS policies are scoped inside the schema cleanly.
- **D-03:** Env var pattern:
  - `.env.example` committed at project root with `VITE_SUPABASE_URL=` + `VITE_SUPABASE_ANON_KEY=` as empty placeholders
  - `.env.local` (gitignored, already in `.gitignore`) for dev values
  - Vercel project env vars hold preview + production values (via Vercel UI, not committed)
  - `src/services/supabase.js` is the single `createClient()` call site; reads from `import.meta.env.VITE_SUPABASE_*`
- **D-04:** Anon key never hardcoded. RLS enforces all access, but leaking the key into git still triggers linter noise and confuses key-rotation stories. Always env-var-sourced.

### OAuth redirect URL allowlisting
- **D-05:** Three redirect URLs allowlisted in **both** Supabase Auth URL Configuration **and** Google Cloud Console OAuth 2.0 Client:
  - `http://localhost:5173` — local Vite dev
  - `https://counterflux-*.vercel.app` — Vercel preview deploys (wildcard pattern; Supabase and Google both support `*` subdomain wildcards)
  - `https://counterflux.vercel.app` — production (update if custom domain is added later)
- **D-06:** Magic-link callback path = **`/#auth-callback`** (already fixed by AUTH-02). PKCE flowType puts the code in the query string (`?code=...`) rather than the fragment, avoiding Navigo hash-fragment collision (PITFALLS §10). Navigo registers the `/auth-callback` route **first**, before any other route, so it matches before `notFound()` fires.
- **D-07:** PKCE flow mandatory — `createClient(..., { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })`. Not the deprecated implicit flow.

### Auth UI surface + flow
- **D-08:** New component `src/components/auth-modal.js` — **not** embedded in settings-modal. Matches `.planning/research/ARCHITECTURE.md` §"stores/auth.js separate from stores/profile.js" rationale: identity layer is a separate concern from presentation.
- **D-09:** Sign-in CTA lives in the **sidebar profile widget** (replaces today's "Set up profile" CTA). Signed-out → "Sign in" opens auth-modal; signed-in → user name + avatar opens settings-modal. One touchpoint, constant position. No topbar button.
- **D-10:** Auth modal layout — Google button prominent at top, OR divider, magic-link email field + "SEND MAGIC LINK" button below. Matches Notion/Vercel/Supabase UI patterns. Google gets the primary visual weight because FEATURES.md projects ~60-70% OAuth adoption.
- **D-11:** Post-callback redirect — **capture `window.location.hash` (pre-auth route) before redirect, navigate back there** after `exchangeCodeForSession` resolves. Fallback to dashboard (`/#/epic-experiment`) if no prior route. Critical for preserving mid-Vandalblast-game and mid-deckbuild context.
- **D-12:** Magic-link post-submit state — **in-modal swap** to "Check your inbox — we sent a link to you@email.com. Close this to keep using Counterflux (your session will activate automatically)." with Close + Resend (30s cooldown). User can dismiss and keep working; `onAuthStateChange` handles the session transparently when they click the email link. No screen-takeover.

### Settings modal refactor (AUTH-04)
- **D-13:** Signed-in settings modal fields:
  - EMAIL — **read-only** text (from `auth.user.email`). Source of truth is the auth provider.
  - DISPLAY NAME — editable input, cloud-synced to `counterflux.profile.name`
  - AVATAR — upload button AND "Use Google avatar" button (if `user_metadata.avatar_url` exists)
  - Sign out button at bottom
- **D-14:** Signed-out settings modal fields — today's behaviour (local name/email/avatar editable) **plus** a prominent "Sign in to sync across devices" CTA above the form that opens auth-modal. Email field stays for signed-out users (it's local-only preference data, no auth identity yet).
- **D-15:** Avatar source priority: **user-uploaded override > Google `user_metadata.avatar_url` > initials fallback**. On first sign-in with Google, `profile.avatar_url` hydrates from Google identity but the upload button remains wired so users can replace it with a custom image.

### First-sign-in profile migration
- **D-16:** On first sign-in, before creating the `counterflux.profile` row, **prompt the user**: "You have a local profile ({name}, {avatar status}). Use it for your new account, or start fresh?" with `[Keep local profile]` / `[Start fresh]` buttons.
- **D-17:** "Keep local profile" → upsert `counterflux.profile` row with `{user_id, name: localStorage.name, avatar_url: localStorage.avatar, updated_at: now()}`.
- **D-18:** "Start fresh" → upsert minimal row with just `user_id` + OAuth-derived `name` (Google `given_name` or email localpart) + OAuth avatar if available.
- **D-19:** localStorage profile is **not deleted** on sign-in — preserved so sign-out reverts to local profile seamlessly. This is the anchor pattern Phase 11 inherits for collection/decks reconciliation: "never destroy local data silently" (PITFALLS §3).
- **D-20:** If localStorage profile is empty (new user who never set a local profile), skip the prompt entirely — create a fresh cloud row silently.

### Sign-out behaviour (AUTH-05)
- **D-21:** Sign-out preserves current screen — no navigation. Auth state flips to anonymous; `profile._source` swaps from `'cloud'` to `'local'`; profile store re-hydrates from localStorage. Settings modal closes (if open) and on next open shows the signed-out view.
- **D-22:** All Dexie tables (collection, decks, deck_cards, games, watchlist, profile rows if they exist locally) are **untouched** on sign-out. Local-first promise intact.

### RLS policy shape (AUTH-06)
- **D-23:** All six synced tables in the `counterflux` schema get **denormalised `user_id` columns** — mirroring Dexie v8 which already has `user_id` on every synced row (`src/db/schema.js:311-315`). No subquery policies.
- **D-24:** Standard policy template per table:
  ```sql
  ALTER TABLE counterflux.<table> ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "users see own <table>" ON counterflux.<table>
    FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "users modify own <table>" ON counterflux.<table>
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  ```
  `WITH CHECK` on writes is **non-negotiable** (PITFALLS §2.2) — without it authenticated users can spoof `user_id` on INSERT/UPDATE.
- **D-25:** Every `user_id` column gets a B-tree index. Non-negotiable per PITFALLS §2.4 — "RLS on unindexed user_id times out at 1M rows". Adds ~6 single-column indexes at schema creation time.
- **D-26:** `counterflux.deck_cards` inherits the same shape — direct `user_id` column, direct policy. Phase 11's sync hook is responsible for populating `user_id` on every `db.deck_cards.add()` call (matches parent deck's `user_id`). Phase 10 locks the schema; Phase 11 wires the writer.
- **D-27:** **Automated RLS audit test** required per PITFALLS §2.7 — signs in as User A, writes a row, signs in as User B, queries. Asserts empty result (not an error). Ships as `tests/rls-isolation.test.js` and is a hard gate for Phase 10 completion.

### Boot order + store init (PITFALLS §8)
- **D-28:** **Local-first init, lazy-rehydrate on auth flip.** Stores init synchronously on `alpine:init` with localStorage/Dexie state (today's behaviour — zero regression for anonymous users). `supabase.auth.getSession()` runs async; when it resolves, `profile.hydrate()` swaps to cloud data via `Alpine.effect` subscription on `auth.status`. Matches ARCHITECTURE.md §Pattern 1.
- **D-29:** Anonymous users **never pay `getSession()` latency** — if no stored session exists in localStorage, skip the network check. Lazy `import('./services/supabase.js')` stays deferred until the user clicks Sign in.
- **D-30:** Auth store shape: `{ status: 'anonymous'|'pending'|'authed', user: null|{id,email,user_metadata}, session: null|Session, signInMagic(email), signInGoogle(), signOut(), init() }`. Status transitions: `anonymous → pending → authed` on sign-in; `authed → anonymous` on sign-out. `pending` covers the brief async window during OAuth redirect + magic-link callback.
- **D-31:** No UI flash on page load for signed-in users — splash screen stays up until `getSession()` resolves IF localStorage indicates a prior session. This is a micro-optimisation inside the existing splash-screen lifecycle; no new blocking mechanism.

### Dexie sync hook timing
- **D-32:** **Phase 10 ships zero Dexie hooks.** No `table.hook('creating'|'updating'|'deleting')` registrations, no `sync_queue` writes. Scope stays pure identity + schema + UI. Phase 11 activates the outbox.
- **D-33:** `counterflux.profile` writes ARE wired in Phase 10 (direct upsert via supabase-js on profile save) because profile is part of AUTH-04 scope. These are the ONLY cloud writes Phase 10 ships. The hook-based outbox pattern begins Phase 11.

### Pre-flight checklist artifact
- **D-34:** Create a standalone `10-AUTH-PREFLIGHT.md` in the phase directory covering:
  - Supabase project setup steps (create `counterflux` schema, allowlist URLs in Auth settings)
  - Google Cloud Console OAuth 2.0 Client setup (authorized JavaScript origins + redirect URIs)
  - Vercel env var configuration (preview + prod)
  - Local `.env.local` bootstrap
  - Verification steps (curl anon endpoint, cross-user RLS test)
- **D-35:** Link `10-AUTH-PREFLIGHT.md` from README.md "Auth setup" section so future-James (or any returning dev) can re-provision quickly without re-reading the plan.

### Household sharing model (added post-ship)
- **D-38 (2026-04-18, post-ship):** RLS replaced from per-user (`auth.uid() = user_id`) to household-scoped via a `counterflux.shared_users` whitelist table. James and Sharon share the same physical card collection; both sign in with their own Google identity but see and edit the same data. Specific changes:
  - New table `counterflux.shared_users(user_id uuid PK → auth.users.id, added_at timestamptz)`. RLS-gated so only existing members can enumerate the list.
  - Seeded with James (`jamesarnall87@gmail.com`) + Sharon (`sharon.strom10@gmail.com`).
  - 5 data tables (collection, decks, deck_cards, games, watchlist) use household RLS: `user_id IN (SELECT user_id FROM counterflux.shared_users) AND auth.uid() IN (SELECT user_id FROM counterflux.shared_users)` on both USING and WITH CHECK.
  - `profile` table **unchanged** — per-user RLS (each user has their own name, avatar, Google identity).
  - `user_id` column stays denormalised on every row (D-23 intact) for attribution/audit.
  - Outsider isolation preserved at household boundary (same Lovable-class protection, different granularity).
  - Migration file: `supabase/migrations/20260418_counterflux_shared_users_household.sql`.
  - INSERT/UPDATE/DELETE of `shared_users` membership is admin-only via Supabase SQL Editor — intentional, prevents self-promotion attacks.
  - Forward migration path to multi-household (future): add `counterflux.household` + `household_members` tables, copy shared_users rows, add `household_id` to 5 data tables, swap RLS. Client code unaffected.

### Auth method pivot (added post-ship)
- **D-39 (2026-04-18, post-ship):** Magic-link sign-in removed; replaced with email + password sign-in. Google OAuth unchanged. Reason: the shared huxley Supabase project sends magic-link emails branded as "huxley" across all apps (Atlas, MWTA, loaf-lift, Counterflux). Per-app email-template branding isn't available on a shared project. Password auth doesn't traverse email, avoiding the branding conflict. Acceptable for a personal app with 2 known users who both have Supabase accounts with passwords set at user creation time. Changes:
  - `src/components/auth-modal.js` replaces magic-link form with email+password form (PASSWORD field after EMAIL, `SIGN IN` button).
  - In-modal `CHECK YOUR INBOX` swap state removed. 30s resend cooldown removed. `RESEND MAGIC LINK` removed.
  - On successful sign-in: modal closes directly (no callback round-trip; `signInWithPassword` is synchronous).
  - `src/stores/auth.js`: `signInMagic(email)` → `signInWithPassword(email, password)`. Calls `supabase.auth.signInWithPassword({ email, password })`.
  - `/#/auth-callback` route stays — Google OAuth still uses it for PKCE exchange.
  - Sign-ups stay disabled project-wide (D-household-policy). Passwords can only be set via Supabase Dashboard → Authentication → Users → Send recovery link OR direct admin action. For v1.1 the 2 existing users already have passwords; add-a-user flow is admin-only via MCP/dashboard.
  - Inline credential error (`Invalid email or password.`) shown on bad password; rate-limit errors → warning toast; other errors → error toast.
  - Enter key on either field submits.
  - UI-SPEC section §2 magic-link flow is obsolete; see revised auth-modal section.

### Auth gate (added post-ship)
- **D-40 (2026-04-18, post-ship — permanent):** Counterflux is an auth-gated product. Anonymous users do NOT have a usage path. Replaces Phase 10's original "anonymous-users-pay-zero-cost, sign-in-is-optional" design (which came from the original public-launch framing).
  - Reason 1: private app for James + Sharon only in v1.1 — anonymous mode has no user
  - Reason 2: permanent future stance — even on commercial expansion (v2.0+), new users must sign in. No unauthenticated read path is planned.
  - Implementation: new `src/components/auth-wall.js` — full-screen, non-dismissible sign-in (Counterflux brand heading + card + Mila tagline). Mounted/unmounted via `Alpine.effect` in `src/main.js` that subscribes to `auth.status` + `hashchange`. Wall opens when status is `anonymous` AND route is not `/auth-callback`. Wall closes when status is `pending` or `authed` (or on callback route).
  - AUTH-01 lazy-load preserved: wall is pure HTML/CSS on first render; `@supabase/supabase-js` only loads when user clicks `SIGN IN` or `SIGN IN WITH GOOGLE` (same lazy path as auth-modal).
  - Dead code left in place (post-ship cleanup deferred): `src/components/auth-modal.js` (sidebar CTA entry — unreachable with wall active), signed-out branch of `src/components/settings-modal.js` (unreachable), `src/components/sidebar.js` anonymous branch (unreachable). A later refactor phase can prune these; they don't affect runtime behavior.
  - UX note: on sign-out, wall re-appears automatically because the Alpine.effect detects `auth.status → 'anonymous'`. Sign-out toast `"Signed out. Your data stays on this device."` is still fired, then wall covers the screen.

### Delivery sequencing
- **D-36:** Phase 10 ships as multiple plans (TBD count — planner decides). Logical groupings:
  1. Supabase project + schema provisioning + RLS policies + RLS isolation test (SQL + pre-flight doc)
  2. `src/services/supabase.js` + `src/stores/auth.js` + lazy-load wiring
  3. `src/components/auth-modal.js` + sidebar CTA + callback route
  4. Settings-modal refactor + `stores/profile.js` auth-aware rewrite + first-sign-in prompt
- **D-37:** RLS isolation test (D-27) is a hard gate — Phase 10 does not complete until it runs green. This is the single most load-bearing test in the milestone for avoiding the Lovable-style public-data-leak failure mode.

### Claude's Discretion
- Magic-link "check your email" 30s resend cooldown visual (countdown vs disabled button)
- Error states (magic-link expired, Google popup cancelled, network failure during OAuth) — surface via existing toast store
- Keyboard shortcut binding for auth modal open (or none — sidebar click is sufficient)
- Exact visual shade of the sign-in CTA button in sidebar (existing primary-accent is fine)
- Google avatar URL cache-busting if user changes Google profile pic
- Sidebar widget transition animation between anonymous/authed states
- Auth modal focus management (email field focus on open)
- `schema_version` addition for the 'counterflux' Postgres schema tracking
- Whether to ship a `supabase/migrations/` directory pattern in-repo for reproducible schema setup (vs manual SQL Editor pastes documented in pre-flight)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §Authentication — AUTH-01…AUTH-06 full acceptance criteria
- `.planning/ROADMAP.md` §Phase 10 — goal, depends-on, success criteria (5 items)
- `.planning/PROJECT.md` — v1.1 scope decisions, "auth + cloud sync is largest scope addition"
- `.planning/STATE.md` §Blockers/Concerns — Vercel preview allowlisting decision, pre-flight checklist ask

### Research (v1.1 Second Sunrise)
- `.planning/research/STACK.md` §1 — `@supabase/supabase-js` 2.103.x config, Alpine integration pattern, lazy-load rationale
- `.planning/research/STACK.md` §Sync engine — explains why UUID PKs matter, why rolling-own sync is preferred (Phase 11 context)
- `.planning/research/PITFALLS.md` §2 — Supabase RLS misconfiguration (mandatory read; drives D-23…D-27)
- `.planning/research/PITFALLS.md` §8 — Auth state race with store init (drives D-28…D-31)
- `.planning/research/PITFALLS.md` §10 — Magic link hash fragment collision with Navigo (drives D-06, D-07)
- `.planning/research/PITFALLS.md` §3 — First-sync wipe pattern (establishes "never destroy local data" precedent, applied to profile in D-19)
- `.planning/research/ARCHITECTURE.md` §Pattern 1 — Auth-aware store hydration (drives D-28, profile store rewrite)
- `.planning/research/ARCHITECTURE.md` §Auth flow diagram — signInMagic → PKCE → onAuthStateChange → profile.hydrate
- `.planning/research/ARCHITECTURE.md` §Module map — `stores/auth.js [NEW]`, `components/auth-modal.js [NEW]`, `stores/profile.js [MODIFIED]`
- `.planning/research/FEATURES.md` §Authentication — magic-link + Google OAuth rationale, ~60-70% Google adoption projection
- `.planning/research/SUMMARY.md` — cross-reference synthesis

### Prior phase context
- `.planning/phases/07-polish-pass-perf-baseline-schema-migration/07-CONTEXT.md` §D-10 — profile table shape reserved in Dexie v6+v7+v8, matches what Supabase schema now mirrors
- `.planning/phases/07-polish-pass-perf-baseline-schema-migration/07-CONTEXT.md` §D-01, D-07, D-08 — UUID PK + user_id + updated_at backfill on all synced tables (identity-ready schema already in Dexie)

### Existing code references (v1.0 + Phase 7/8/9)
- `src/db/schema.js:311-315, 394-398` — Dexie v8 clean table shapes with `user_id` column on all 6 synced tables (mirror target for Supabase)
- `src/db/schema.js:427` — `UUID_TABLES` list + creating-hook source of truth
- `src/stores/profile.js` — current localStorage-only profile store (target for auth-aware rewrite per D-28)
- `src/components/settings-modal.js` — current modal (target for refactor per D-13, D-14)
- `src/components/sidebar.js` — profile widget target (D-09 CTA location)
- `src/router.js:4-14` — Navigo config (add `/auth-callback` route registration per D-06)
- `src/main.js` — app entry; auth store init ordering (D-28, D-30)
- `vite.config.js` — no changes needed for auth; confirm no dev-proxy conflict with Supabase
- `package.json:14-29` — dependency list; `@supabase/supabase-js` adds here post-Plan 1

### External docs
- Supabase Auth Email Passwordless — https://supabase.com/docs/guides/auth/auth-email-passwordless
- Supabase Auth Google OAuth — https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase PKCE Flow — https://supabase.com/docs/guides/auth/sessions/pkce-flow
- Supabase Redirect URL config — https://supabase.com/docs/guides/auth/redirect-urls
- Supabase RLS + schemas — https://supabase.com/docs/guides/database/postgres/row-level-security

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/db/schema.js` UUID-PK tables** — all 6 synced tables already carry `user_id` column (nullable, backfilled to null in Phase 7). Zero Dexie schema work needed for Phase 10 — just populate `user_id` on writes (Phase 11 concern).
- **`src/stores/profile.js`** — small (40 LOC), easy to refactor to auth-aware pattern. Pattern: add `_source: 'local'|'cloud'`, add `hydrate()`, subscribe to auth store via `Alpine.effect`.
- **`src/components/settings-modal.js`** — vanilla-DOM modal (140 LOC), not Alpine template. Adding a "Sign in" CTA above the form for signed-out users is a ~20-line diff. Signed-in conditional branch swaps email field to read-only + adds Sign out button (~30 lines).
- **`src/components/toast.js`** — existing notification surface for auth errors (magic-link expired, Google cancelled). No new toast infrastructure needed.
- **`src/components/splash-screen.js`** — existing splash lifecycle handles "wait for something before showing app". Natural hook point for `getSession()` await if prior session detected (D-31).
- **`src/router.js`** — Navigo already hash-based; `/auth-callback` route registers cleanly before other routes (D-06).
- **`src/services/migration.js`** pattern — localStorage backup + blocking modal lifecycle is a reusable template for the "first-sign-in profile prompt" UI (D-16).

### Established Patterns
- **Lazy imports via dynamic `import()`** — STACK.md §1 pattern. Auth module loads only on Sign-in click. `src/main.js` does not import `src/services/supabase.js` at boot; the sidebar CTA click triggers it.
- **Alpine store with `init()`** — matches every existing store (collection, deck, game, etc.). `stores/auth.js` slots into the existing registration pattern in `src/main.js`.
- **`Alpine.effect` for cross-store reactivity** — profile store subscribes to auth store status, re-hydrates on flip. Pattern used in market/notifications store cross-refs.
- **Service pattern under `src/services/`** — one module per domain concern. `supabase.js` + (Phase 11) `sync.js` slot alongside `scryfall.js`, `edhrec.js`, etc.
- **User-facing modals in `src/components/`** — `migration-blocked-modal.js`, `csv-import-modal.js`, `ritual-modal.js`. New `auth-modal.js` follows this directory convention.

### Integration Points
- **`src/main.js`** — adds `initAuthStore()` after other stores, before router resolve. Triggers `auth.init()` which checks `supabase.auth.getSession()` if a prior session token exists in localStorage.
- **`src/router.js`** — `/auth-callback` route registered first, calls `exchangeCodeForSession(window.location.href)` then navigates to captured pre-auth route.
- **`src/components/sidebar.js`** — profile widget click handler branches on `auth.status`: anonymous → open auth-modal; authed → open settings-modal.
- **`src/components/settings-modal.js`** — reads `auth.status` at render time to branch between signed-in (read-only email) and signed-out (today's form + Sign-in CTA) layouts.
- **Vercel project settings** — env vars added manually via Vercel UI; pre-flight doc (D-34) references the exact variable names.
- **Supabase Auth URL config + Google Cloud Console** — out-of-repo configuration; pre-flight doc is the canonical source.

### Not Reusable (anti-patterns to avoid)
- **Don't embed supabase-js in settings-modal.js** — keep the identity client in `src/services/supabase.js` with a single `createClient()` instance. Re-creating the client per modal open leaks Realtime subscriptions (PITFALLS §Integration gotchas).
- **Don't install Dexie hooks in Phase 10** (D-32) — tempting because `src/db/schema.js:427` already exports the UUID_TABLES list, but keeping Phase 10 free of hooks preserves the clean identity-only scope.

</code_context>

<specifics>
## Specific Ideas

- **"Reuse huxley, schema-scope Counterflux inside it"** — user wants the consolidation benefit of one Supabase per personal-app cluster, without the cross-app collision risk. The `counterflux` schema is the separator.
- **"Wildcard preview URLs, not per-deploy"** — solo dev, preview deploys are fire-and-forget. Wildcard `counterflux-*.vercel.app` in both Supabase and Google Console is the lowest-friction correct answer.
- **"Dedicated auth-modal, sidebar CTA"** — architecture-consistent. Settings modal stays about profile presentation, auth-modal is about identity.
- **"Google prominent, magic-link secondary"** — matches the projected 60-70% Google user base without hiding magic-link for purists.
- **"Preserve the pre-auth route through the callback"** — Counterflux users sign in mid-flow (Vandalblast game, deck editing). Losing context mid-game is UX malpractice.
- **"Prompt on first-sign-in profile migration"** — sets the precedent Phase 11 inherits for collection/decks. Never silently destroy local data.
- **"Denormalised user_id, not subquery RLS"** — Dexie already has user_id on every row (Phase 7 backfill). Mirror exactly for 1:1 sync semantics. Index every user_id column.
- **"No Dexie hooks in Phase 10"** — preserve clean phase boundary. Auth-only scope. Phase 11 owns the outbox.
- **"Pre-flight as a standalone doc"** — future-James needs to re-provision Supabase or rotate keys. Don't bury setup steps inside a plan file nobody reads later.
- **"RLS isolation test is the milestone's load-bearing guardrail"** — the single test that catches the Lovable-class failure mode.

</specifics>

<deferred>
## Deferred Ideas

- **Dexie sync hooks / `sync_queue` outbox enqueue** — Phase 11 scope (explicit D-32).
- **First-sign-in collection/decks/games reconciliation modal** — Phase 11 (SYNC-04).
- **Realtime postgres_changes subscription** — Phase 11.
- **Notification bell wire-up for sync errors** — Phase 12 (SYNC-08).
- **OAuth providers beyond Google** (Apple, GitHub, etc.) — v1.2+ if user demand appears.
- **Email/password auth alongside magic-link** — FEATURES.md explicitly rejected; not revisiting.
- **Custom domain on Vercel + redirect URL update** — handled when/if `counterflux.vercel.app` gets swapped for a real domain; operational, not phase-scope.
- **Supabase Edge Functions for server-side auth checks** — not needed for AUTH-01…AUTH-06; revisit if cross-user features ever land.
- **Magic-link expired error recovery flow** — Claude's Discretion during planning; toast + "Resend link" is the default.
- **Keyboard shortcut to open auth modal** — Claude's Discretion; not a gray area the user cared to lock.
- **`schema_version` row for the Postgres `counterflux` schema** — Claude's Discretion; only useful if schema evolves mid-milestone.
- **In-repo `supabase/migrations/` directory for reproducible SQL setup** — Claude's Discretion; pre-flight doc may link here if the planner chooses to go that route.
- **Sign-in analytics / telemetry** — out of scope for v1.1; PostHog/similar is a v1.2+ decision.

### Reviewed Todos (not folded)
_None — `todo match-phase 10` returned zero matches._

</deferred>

---

*Phase: 10-supabase-auth-foundation*
*Context gathered: 2026-04-17*
