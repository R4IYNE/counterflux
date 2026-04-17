---
phase: 10
plan: 01
subsystem: supabase-auth-foundation
tags:
  - auth
  - supabase
  - rls
  - schema
  - migrations
  - testing
  - docs
dependency-graph:
  requires:
    - "Phase 07 Dexie v8 synced-table shape (src/db/schema.js:309-333) — Postgres columns mirror this"
    - "Shared huxley Supabase project (hodnhjipurvjaskcsjvj, eu-west-2)"
  provides:
    - "counterflux Postgres schema with 6 RLS-enforced synced tables (mirror of Dexie v8)"
    - "12 RLS policies (6 SELECT + 6 ALL with WITH CHECK) using auth.uid() = user_id"
    - "6 B-tree indexes on user_id columns (PITFALLS §2.4)"
    - ".env.example template for VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY"
    - "tests/rls-isolation.test.js — D-37 hard gate (skips cleanly without env vars)"
    - "10-AUTH-PREFLIGHT.md standalone provisioning runbook"
    - "README.md Auth Setup section linking to pre-flight"
  affects:
    - "Plan 10-02 consumes .env.example placeholders via src/services/supabase.js"
    - "Plan 10-04 consumes counterflux.profile table for settings modal upsert"
    - "Phase 11 sync engine reads/writes every one of the 6 synced tables; hard-depends on RLS being active"
tech-stack:
  added: []
  patterns:
    - "Denormalised user_id RLS pattern (no subqueries) — mirrors Dexie v8 user_id column on every synced row"
    - "WITH CHECK clause on every write policy — non-negotiable per PITFALLS §2.2"
    - "Skip-when-env-missing test pattern (describeIf = HAS_ENV ? describe : describe.skip) — keeps npm test green without credentials"
    - "Dynamic import inside beforeAll — test skips cleanly before @supabase/supabase-js is installed (Plan 10-02)"
key-files:
  created:
    - supabase/migrations/20260417_counterflux_auth_foundation.sql
    - .env.example
    - tests/rls-isolation.test.js
    - .planning/phases/10-supabase-auth-foundation/10-AUTH-PREFLIGHT.md
    - README.md
  modified: []
decisions:
  - "RLS test file uses dynamic import('@supabase/supabase-js') inside beforeAll rather than static import at top-level. Reason: the package is a Plan 10-02 dependency, not yet installed; Vitest resolves static imports at collection time regardless of describe.skip, which would break npm test. Dynamic import preserves the 'skip cleanly' contract without requiring the package to be present in Plan 10-01."
  - "README.md did not exist — created a minimal one with project intro, dev commands, Auth Setup (per D-35), tech stack table, and planning artifacts pointer. Plan 10-01 scope kept narrow; deeper README content is a follow-up if ever required."
  - "Migration file uses `IF NOT EXISTS` on schema + tables + indexes (idempotent) but CREATE POLICY is Postgres-non-idempotent by design. Pre-flight Section 1.1 documents the DROP POLICY IF EXISTS workaround for re-runs."
  - "Pre-flight Section 1.4 calls out the 'Confirm email' tension: production wants it ON, but the RLS isolation test needs it OFF (or pre-confirmed test users). Documented as a known trade-off rather than hard-coding a setting."
metrics:
  duration: "6m 0s (wall clock start 14:54Z → final commit ~15:00Z; duration measured by plan start-marker)"
  completed-date: "2026-04-17"
  tasks: 3
  files: 5
  commits: 3
---

# Phase 10 Plan 01: Supabase Auth Foundation Summary

Provisioned the cloud-side identity + RLS foundation for Phase 10 — SQL migration, secrets template, D-37 hard-gate test, and standalone pre-flight runbook — so Plan 10-02 can ship the Supabase client and Plan 11 can safely run the sync engine.

## What Shipped

### Task 1.1 — Supabase schema migration + .env.example (commit `da1af51`)

`supabase/migrations/20260417_counterflux_auth_foundation.sql` — a single canonical SQL file that sets up the cloud-side identity target for Counterflux:

- **`CREATE SCHEMA counterflux`** (D-02) scope-separator from Atlas/MWTA tables in the shared huxley project (D-01). Granted USAGE + ALL to `anon` + `authenticated` roles plus default-privileges so future tables inherit access.
- **6 synced tables** mirroring Dexie v8 shape (from `src/db/schema.js:309-333`): `collection`, `decks`, `deck_cards`, `games`, `watchlist`, `profile`. Every row has `user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE`.
- **6 B-tree indexes on user_id** (D-25) — non-negotiable per PITFALLS §2.4 (RLS on unindexed user_id times out at 1M rows).
- **RLS enabled on every table** (PITFALLS §2 — default is OFF).
- **12 policies** using the D-24 template verbatim:
  - 6 × `FOR SELECT USING (auth.uid() = user_id)`
  - 6 × `FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`
  - `WITH CHECK` on writes is non-negotiable per PITFALLS §2.2 — without it authenticated users can spoof `user_id` on INSERT/UPDATE.

`.env.example` — blank-placeholder template (`VITE_SUPABASE_URL=`, `VITE_SUPABASE_ANON_KEY=`) per D-03 + D-04. `.gitignore`'s existing `*.local` rule covers `.env.local` — no `.gitignore` change needed.

### Task 1.2 — RLS isolation test (commit `2780f68`)

`tests/rls-isolation.test.js` — the D-37 hard gate. Single most load-bearing test in v1.1. Coverage:

| Assertion | Count | PITFALLS anchor |
|-----------|-------|-----------------|
| User B SELECT on User A rows → empty array (not 401/403) | 6 (test.each across all 6 tables) | §2.7 |
| User B INSERT with spoofed `user_id` → rejected by WITH CHECK | 1 | §2.2 |
| User B UPDATE of User A row → 0 rows affected (USING filters silently) | 1 | §2.2 |
| User A SELECT own rows → positive control (RLS isn't over-blocking) | 1 | §2.7 |

**Skip-when-env-missing** (`describeIf = HAS_ENV ? describe : describe.skip`) keeps `npm test` green for CI without secrets and collaborators without `.env.local`. **Dynamic import** of `@supabase/supabase-js` inside `beforeAll` means the test also skips cleanly *before* Plan 10-02 installs the package — Vitest resolves static imports at collection time regardless of skip state, which would break `npm test` in Plan 10-01. This is a deliberate deviation from the plan's literal `import { createClient } from '@supabase/supabase-js'` at the top of the file (see Deviations below).

### Task 1.3 — Pre-flight runbook + README (commit `a3c98df`)

`10-AUTH-PREFLIGHT.md` — standalone provisioning runbook (D-34) covering:

1. **Supabase project setup** — run migration, expose `counterflux` schema to PostgREST (via Database → API → Exposed schemas), allowlist 3 redirect URLs (localhost + preview wildcard + production), email provider Confirm-email tension, Google provider wiring, API key copy.
2. **Google Cloud Console OAuth 2.0 Client** — web-app type, 3 JavaScript origins matching the Supabase allowlist, 1 redirect URI pointing at `https://hodnhjipurvjaskcsjvj.supabase.co/auth/v1/callback`.
3. **Vercel env vars** — both vars across Production + Preview + Development scopes, redeploy trigger.
4. **Local `.env.local` bootstrap** — 4-command sequence with `git check-ignore` verification.
5. **Verification** — anonymous `curl` returns `[]` (proves RLS active), full vitest hard-gate invocation, post-sign-in SQL editor smoke test.
6. **Rotation + future-James notes** — 24-hour anon-key grace period, new-domain additions, nuclear-option `DROP SCHEMA counterflux CASCADE`.

`README.md` — created (did not exist before). Minimal intro + dev commands + **Auth Setup** section (D-35) linking to the pre-flight + tech stack table + planning artifacts pointer.

## Decisions Made

1. **Dynamic import inside `beforeAll` instead of static top-of-file import** — the plan's literal code has `import { createClient } from '@supabase/supabase-js'` at the top. This would fail at Vitest collection time because `@supabase/supabase-js` isn't installed in Plan 10-01 (ships Plan 10-02). Dynamic import keeps the "skip cleanly" contract intact. The acceptance criterion `t.includes('@supabase/supabase-js')` still matches.
2. **Created README.md** — plan assumed one existed for the "EDIT — add Auth setup section" step. Created a minimal root README covering the essentials: project intro, dev commands, Auth Setup (the required D-35 link), tech stack, planning artifacts pointer. Kept intentionally minimal; the deep product documentation stays in `.planning/PROJECT.md`.
3. **Plan acceptance-criterion "12 uid matches" is arithmetically wrong** — the D-24 template is `FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`, which contains the literal string `auth.uid() = user_id` **twice** per ALL policy. With 6 ALL + 6 SELECT policies, the actual count is **18**, not 12. The SQL matches D-24 verbatim; I verified with a split `FOR SELECT USING` / `FOR ALL USING` regex both returning 6 exactly (plus 6 `WITH CHECK` matching the non-negotiable D-24 requirement). See `## Deviations` below.

## Deviations from Plan

### Rule 3 (blocking-issue auto-fix) — Dynamic import for @supabase/supabase-js

- **Found during:** Task 1.2 pre-flight check (before running `npx vitest`).
- **Issue:** The plan's literal test code imports `createClient` from `@supabase/supabase-js` at the top of the file. But this package is a Plan 10-02 dependency and is not yet in `package.json`. Vitest resolves all static imports at **collection time**, even for files whose `describe` blocks are skipped. Running `npm test` with the plan's literal code would fail `npm test` with `Cannot find module '@supabase/supabase-js'`, violating the hard acceptance criterion "`npm test` exits 0... (skipping... OR passing green)".
- **Fix:** Moved the import inside `beforeAll`:
  ```javascript
  beforeAll(async () => {
    const { createClient } = await import('@supabase/supabase-js');
    // ...
  });
  ```
  Combined with the existing `describeIf = HAS_ENV ? describe : describe.skip` gate, the dynamic import is never reached when env vars are absent. `npm test` stays green; the acceptance-criterion regex `t.includes('@supabase/supabase-js')` still matches the literal string inside the `await import(...)` call.
- **Files modified:** `tests/rls-isolation.test.js`.
- **Commit:** `2780f68` (Task 1.2).

### Rule 2 (missing critical functionality) — Created README.md

- **Found during:** Task 1.3 read-first step.
- **Issue:** The plan's Task 1.3 `<files>` lists `README.md (EDIT — add Auth setup section linking to pre-flight)` but the file doesn't exist. Without it, D-35 ("Link 10-AUTH-PREFLIGHT.md from README.md") can't be satisfied.
- **Fix:** Created a minimal README with project intro, dev commands, the required Auth Setup section (linking to the pre-flight per D-35), tech stack table, and planning artifacts pointer. Kept intentionally shallow — deep product docs stay in `.planning/PROJECT.md` — because a multi-section README is outside Plan 10-01 scope.
- **Files modified:** `README.md` (created).
- **Commit:** `a3c98df` (Task 1.3).

### Note — Plan acceptance-criterion arithmetic

- **Found during:** Task 1.1 verification.
- **Issue:** Plan acceptance criterion 5 says "SQL file contains literal string `auth.uid() = user_id` exactly 12 times total (6 SELECT USING + 6 ALL USING)". But the D-24 template `FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` contains the literal string **twice** per ALL policy. Actual count: 6 SELECT + 12 ALL = **18**.
- **Action:** SQL matches D-24 template verbatim — verified: 6 `FOR SELECT USING`, 6 `FOR ALL    USING`, 6 `WITH CHECK` — all at exactly 6 each. The plan's criterion was arithmetically wrong; the SQL is correct. No code change needed.

## Authentication Gates

None encountered during Plan 10-01 execution. The Supabase operations documented in `10-AUTH-PREFLIGHT.md` are **forward-facing** — they describe what the user (or executor with authenticated supabase CLI) needs to do in the huxley project SQL Editor before Plan 10-02's client code can authenticate. None of those steps run inside this plan's task execution; Plan 10-01 ships only the cloud-target artifacts and the test that will verify them once they're live.

## Outstanding Follow-ups (for Plan 10-02+)

- **Run the migration in Supabase SQL Editor** — `supabase/migrations/20260417_counterflux_auth_foundation.sql` must be pasted + run against the huxley project SQL Editor before any client code can read/write the counterflux schema. Pre-flight Section 1.1 documents this.
- **Expose `counterflux` in PostgREST** — Database → API → Exposed schemas → `public, counterflux`. Until done, any `supabase.schema('counterflux').from(...)` call returns `PGRST106`.
- **Populate `.env.local`** — collaborators need real VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY values before `npm run dev` can authenticate or before the D-37 hard-gate test runs green.
- **Install `@supabase/supabase-js`** — Plan 10-02 ships `src/services/supabase.js` which `npm install`s the package. Until then, the RLS isolation test skips via the dynamic-import gate.
- **Toggle "Confirm email" OFF for the RLS test run** — Supabase Auth → Providers → Email → Confirm email. Required for `signUp` to auto-sign-in inside `beforeAll`, otherwise `signUp A failed: Email not confirmed` throws. Alternative: pre-provision the two test users.

## Self-Check: PASSED

File existence:
- `supabase/migrations/20260417_counterflux_auth_foundation.sql` — FOUND
- `.env.example` — FOUND
- `tests/rls-isolation.test.js` — FOUND
- `.planning/phases/10-supabase-auth-foundation/10-AUTH-PREFLIGHT.md` — FOUND
- `README.md` — FOUND

Commits:
- `da1af51` (Task 1.1) — FOUND
- `2780f68` (Task 1.2) — FOUND
- `a3c98df` (Task 1.3) — FOUND

Test suite:
- `npm test` — 75 files pass, 688 tests pass, 9 skipped, 10 todo (no regressions).
- `npx vitest run tests/rls-isolation.test.js` — 1 file skipped, 9 tests skipped (clean skip without env vars).
