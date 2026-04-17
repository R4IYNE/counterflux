# Phase 10 — Auth Pre-Flight Runbook

**Purpose:** Standalone provisioning guide for the Counterflux Supabase auth stack (D-34). Future-James (or any returning dev) runs this top-to-bottom when:

- Bootstrapping a fresh clone on a new machine
- Rotating Supabase anon keys
- Reconfiguring OAuth after a domain change
- Debugging why `.env.local` values are absent or stale

This doc is the canonical source. The README links here (D-35), not the other way around.

**Companion artifacts:**

- `supabase/migrations/20260417_counterflux_auth_foundation.sql` — the migration this runbook executes
- `tests/rls-isolation.test.js` — the verification test (D-37 hard gate) this runbook runs
- `.env.example` — the template for `.env.local`

---

## 1. Supabase Project Setup

Counterflux reuses the shared **huxley** Supabase project (`hodnhjipurvjaskcsjvj`, `eu-west-2`) per D-01. Counterflux-specific tables live in a dedicated `counterflux` Postgres schema (D-02) so they don't collide with Atlas/MWTA tables in the same project.

### 1.1 Run the counterflux schema migration

1. Open Supabase Dashboard → **huxley** project → **SQL Editor** → **New Query**.
2. Paste the full contents of `supabase/migrations/20260417_counterflux_auth_foundation.sql`.
3. Click **RUN**. Expected result: `Success. No rows returned.`

The migration is idempotent (`CREATE SCHEMA IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) — safe to re-run. However, `CREATE POLICY` statements are **not** idempotent in Postgres; if policies already exist from a previous run, drop them first:

```sql
-- Only run if re-applying the migration after partial success:
DROP POLICY IF EXISTS "users see own collection"    ON counterflux.collection;
DROP POLICY IF EXISTS "users modify own collection" ON counterflux.collection;
-- ... repeat for all 12 policies
```

### 1.2 Expose the counterflux schema to PostgREST

PostgREST only serves schemas listed in its exposed-schemas config. By default, only `public` is exposed.

1. Supabase Dashboard → **huxley** → **Database** → **API**.
2. Find the **Exposed schemas** field.
3. Set it to: `public, counterflux`
4. Click **Save**. Wait ~5 seconds for PostgREST to reload.

**Verification:** If PostgREST is still returning `PGRST106` (Schema Cache) errors when the client calls `supabase.schema('counterflux').from(...)`, the schema isn't yet exposed. Restart may be required; give it ~30 seconds.

### 1.3 Allowlist redirect URLs

1. Supabase Dashboard → **huxley** → **Authentication** → **URL Configuration**.
2. Under **Redirect URLs**, add all three (D-05):
   - `http://localhost:5173`
   - `https://counterflux-*.vercel.app` (wildcard for Vercel preview deploys)
   - `https://counterflux.vercel.app` (production)
3. **Site URL**: `https://counterflux.vercel.app` (used as the fallback redirect).
4. Click **Save**.

Supabase supports `*` subdomain wildcards natively, so `counterflux-*.vercel.app` matches every `counterflux-abc123.vercel.app` preview deploy without per-deploy configuration.

### 1.4 Email provider (magic-link)

1. Supabase Dashboard → **huxley** → **Authentication** → **Providers** → **Email**.
2. Ensure **Enable email signups** is ON.
3. **Confirm email** — note the current setting:
   - If ON (default): email confirmation is required before sign-in. The RLS isolation test (`tests/rls-isolation.test.js`) needs this OFF for the duration of the test run, OR you need to pre-provision the two test users.
   - If OFF: signUp auto-signs-in on success. Required for the hard-gate test to run unattended.
4. Click **Save** if anything changed.

**Recommendation:** Leave **Confirm email** ON for production. Temporarily disable it when running the RLS isolation test locally, or maintain two dedicated test users with pre-confirmed emails.

### 1.5 Google provider setup

Complete Section 2 (Google Cloud Console) first to get a client ID + secret, then:

1. Supabase Dashboard → **huxley** → **Authentication** → **Providers** → **Google**.
2. Toggle **Enable Google provider** ON.
3. Paste the **Client ID** and **Client Secret** from the Google OAuth 2.0 Client.
4. Click **Save**.

### 1.6 Copy API keys

1. Supabase Dashboard → **huxley** → **Settings** → **API**.
2. Copy **Project URL** (e.g., `https://hodnhjipurvjaskcsjvj.supabase.co`).
3. Copy **anon public** key (the row labelled `anon` / `public` — NOT `service_role`).

You'll paste these into `.env.local` in Section 4 and into Vercel env vars in Section 3.

**Do not copy the `service_role` key into any client-side config.** It bypasses RLS and belongs in serverless functions only. Counterflux has no serverless functions — the `service_role` key should never leave the dashboard.

---

## 2. Google Cloud Console OAuth 2.0 Client

### 2.1 Create or reuse the OAuth 2.0 Client

1. Google Cloud Console → **APIs & Services** → **Credentials**.
2. If a "Counterflux" (or shared huxley) OAuth 2.0 Client already exists, reuse it. Otherwise: **Create Credentials** → **OAuth client ID** → **Web application**.
3. Name: `Counterflux` (or `Huxley Shared OAuth` if reusing).

### 2.2 Authorised JavaScript origins

Add all three (matching D-05):

- `http://localhost:5173`
- `https://counterflux-*.vercel.app`
- `https://counterflux.vercel.app`

Google Cloud Console supports `*` wildcards in origins, same as Supabase.

### 2.3 Authorised redirect URIs

Add exactly one:

- `https://hodnhjipurvjaskcsjvj.supabase.co/auth/v1/callback`

This is the Supabase-managed callback endpoint. Supabase forwards the OAuth code exchange back to your app via the Redirect URLs from Section 1.3.

### 2.4 Copy client ID + secret to Supabase

1. Click **Save** on the OAuth Client.
2. Copy the **Client ID** and **Client secret**.
3. Paste into Supabase Dashboard → **huxley** → **Authentication** → **Providers** → **Google** (Section 1.5).

---

## 3. Vercel Environment Variables

### 3.1 Add Supabase vars to Vercel

1. Vercel Dashboard → **counterflux** project → **Settings** → **Environment Variables**.
2. Add `VITE_SUPABASE_URL`:
   - Value: `https://hodnhjipurvjaskcsjvj.supabase.co`
   - Environments: **Production** ✓ **Preview** ✓ **Development** ✓
3. Add `VITE_SUPABASE_ANON_KEY`:
   - Value: (the anon key from Section 1.6)
   - Environments: **Production** ✓ **Preview** ✓ **Development** ✓
4. Click **Save** for each.

### 3.2 Redeploy

Env vars are picked up at build time for Vite's `import.meta.env`. Trigger a redeploy to hydrate:

1. Vercel Dashboard → **counterflux** → **Deployments** → latest → **⋯** → **Redeploy**.
2. Or: push a new commit to `master`, which auto-redeploys.

Verify the deployed app can sign in by visiting the preview/prod URL and clicking the Sign-in CTA (once Plan 10-03 ships the auth modal).

---

## 4. Local `.env.local` Bootstrap

### 4.1 Copy the template

```bash
cd /path/to/counterflux
cp .env.example .env.local
```

### 4.2 Fill in the values

Open `.env.local` and paste the values from Section 1.6:

```
VITE_SUPABASE_URL=https://hodnhjipurvjaskcsjvj.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...(long anon key here)
```

### 4.3 Verify gitignored

```bash
git check-ignore .env.local
# Expected output: .env.local
```

If this prints nothing, the file is NOT ignored and you must add `.env.local` or `*.local` to `.gitignore` immediately. The existing `.gitignore` already covers `*.local` via the catch-all rule.

### 4.4 Restart dev server

Vite reads env vars at dev-server start. Kill and restart:

```bash
npm run dev
```

---

## 5. Verification Steps

### 5.1 Anonymous REST call returns `[]` (not an error)

Proves RLS is blocking unauthorised reads while keeping the endpoint responsive:

```bash
curl "https://hodnhjipurvjaskcsjvj.supabase.co/rest/v1/collection?select=*" \
  -H "apikey: <VITE_SUPABASE_ANON_KEY>" \
  -H "Authorization: Bearer <VITE_SUPABASE_ANON_KEY>" \
  -H "Accept-Profile: counterflux"
```

Expected response: `[]` (an empty JSON array). A 401/403 is **also** acceptable-but-less-clean per PITFALLS §2.7; the empty array is the canonical RLS-active response.

If you get `PGRST106 ("The schema must be one of the following: public")`, Section 1.2 wasn't completed — go back and expose the `counterflux` schema.

### 5.2 Run the RLS isolation test (D-37 hard gate)

This is the single most load-bearing verification in the milestone:

```bash
VITE_SUPABASE_URL=https://hodnhjipurvjaskcsjvj.supabase.co \
VITE_SUPABASE_ANON_KEY=eyJ... \
npx vitest run tests/rls-isolation.test.js
```

Expected result: **9 tests pass** (6 cross-user SELECTs + 1 spoofed-INSERT + 1 cross-user UPDATE + 1 positive control).

Pre-requisites:

- Sections 1.1 + 1.2 complete (migration run, schema exposed).
- Section 1.4: Confirm email OFF, OR the test run is expected to throw `signUp A failed: Email not confirmed` (manually pre-confirm test users in that case).
- `@supabase/supabase-js` installed (ships in Plan 10-02). Until then the test skips cleanly via the dynamic import inside `beforeAll` + the `describeIf` gate.

### 5.3 Sign-in smoke test (once Plan 10-03 ships)

1. `npm run dev` → visit `http://localhost:5173`.
2. Click **SIGN IN** in the sidebar.
3. Send magic link to a real inbox → click the link → land back on the app.
4. In the SQL Editor, run:

   ```sql
   SELECT * FROM counterflux.profile WHERE user_id = auth.uid();
   ```

   Expected: 0 rows before first settings save, 1 row after.

---

## 6. Rotation + Future-James Notes

### 6.1 Rotate the anon key

1. Supabase Dashboard → **huxley** → **Settings** → **API** → **Generate new API keys**.
2. Old keys continue to work for a 24-hour grace period (Supabase-documented behaviour).
3. Update `VITE_SUPABASE_ANON_KEY` in:
   - Vercel env vars (Section 3.1) — for Production, Preview, Development.
   - `.env.local` on every dev machine (Section 4.2).
4. Redeploy Vercel Production + Preview so the new key propagates.
5. After 24 hours, confirm nothing still uses the old key (check Vercel deployment env, local `.env.local`, CI secrets).

### 6.2 Add a new Vercel domain

If Counterflux ever gets a custom domain (e.g., `counterflux.app`):

1. Add the domain to Supabase Dashboard → **huxley** → **Authentication** → **URL Configuration** → **Redirect URLs**.
2. Add the domain to Google Cloud Console → **OAuth 2.0 Client** → **Authorised JavaScript origins**.
3. The existing `https://hodnhjipurvjaskcsjvj.supabase.co/auth/v1/callback` redirect URI stays unchanged — Supabase handles the domain mapping internally.

### 6.3 Drop & re-apply the migration

Nuclear option for a clean slate:

```sql
-- Run in SQL Editor. DESTROYS ALL COUNTERFLUX DATA. Use only in dev.
DROP SCHEMA IF EXISTS counterflux CASCADE;
```

Then re-run `supabase/migrations/20260417_counterflux_auth_foundation.sql` from Section 1.1.

---

*Last updated: 2026-04-17 — Plan 10-01 ship (da1af51 + 2780f68).*
