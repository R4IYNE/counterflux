// tests/rls-isolation.test.js
// Phase 10 D-37 hard gate (revised for D-38 household model).
//
// Verifies outsider access to the counterflux household's data is denied.
// The denial can manifest as either of two equally-valid outcomes:
//
//   1. Postgres 42501 "permission denied for table" — the anon role has
//      no table-level privileges on counterflux.* (Supabase defaults
//      grant only the `authenticated` role when a schema is exposed).
//      This is the first line of defence — the request never reaches RLS.
//
//   2. Empty result array — the request reached the table but RLS filtered
//      out every row. This is the second line of defence, and is what the
//      test was originally designed to assert (PITFALLS §2.7).
//
// Both outcomes prove the same security property: an unauthenticated client
// with a valid anon key cannot read, write, or enumerate household data.
// The Lovable-class threat (leaked anon key → data exfiltration) is
// defeated regardless of which layer rejects the request.
//
// The test therefore asserts "denied by either layer" rather than picking one.
//
// Household semantics (D-38):
//   - James + Sharon are in counterflux.shared_users; they see each other's data.
//   - Anyone else is an outsider.
//   - `profile` stays per-user (each member has their own identity row).
//   - Positive-control test (member A sees member B's rows) is deferred to
//     manual UAT since it requires two authenticated sessions with known
//     credentials. SQL-level verification via MCP at deploy time already
//     confirmed policy expressions match the household model.
//
// Skips automatically if VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are absent.
//
// To run locally against the live huxley project:
//   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx vitest run tests/rls-isolation.test.js
//
// Pre-requisites:
//   1. Run supabase/migrations/20260417_counterflux_auth_foundation.sql
//   2. Run supabase/migrations/20260418_counterflux_shared_users_household.sql
//   3. Run supabase/migrations/20260418_counterflux_household_rls_fix_recursion.sql
//   4. Add `counterflux` to Database → API → Exposed schemas.
//   5. npm install @supabase/supabase-js (shipped in Plan 10-02).

import { describe, test, expect, beforeAll } from 'vitest';

const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_ANON_KEY;
const HAS_ENV = !!(URL && KEY);

const RUN = Date.now().toString(36);

const describeIf = HAS_ENV ? describe : describe.skip;

/**
 * Asserts a Supabase response represents a denied access, via either path:
 *   - error.code === '42501' (permission denied for table), OR
 *   - data is an empty array (RLS filtered all rows out).
 */
function expectDenied({ data, error }) {
  const permissionDenied = !!error && error.code === '42501';
  const rlsFiltered = !error && Array.isArray(data) && data.length === 0;
  expect(permissionDenied || rlsFiltered).toBe(true);
}

describeIf('RLS isolation — counterflux household (D-37 + D-38)', () => {
  let outsider;

  beforeAll(async () => {
    // Dynamic import so the static import doesn't resolve when the package
    // is absent (test still skips cleanly via describe.skip, but Vitest
    // resolves static imports at collection time regardless of skip state).
    const { createClient } = await import('@supabase/supabase-js');

    // Unauthenticated anon client — simulates "leaked anon key, no session"
    // which is the Lovable-class threat model.
    outsider = createClient(URL, KEY, { auth: { persistSession: false } });
  }, 30000);

  test.each([
    'collection',
    'decks',
    'deck_cards',
    'games',
    'watchlist',
    'profile',
  ])('Unauthenticated outsider SELECT on counterflux.%s is denied', async (table) => {
    const response = await outsider
      .schema('counterflux')
      .from(table)
      .select('*');
    expectDenied(response);
  });

  test('Outsider cannot enumerate shared_users membership list', async () => {
    // shared_users has RLS via is_household_member(auth.uid()). For an
    // unauthenticated client, auth.uid() is NULL and is_household_member
    // returns false, so the list filters to empty. anon also has no table
    // grant, so 42501 is the more likely outcome.
    const response = await outsider
      .schema('counterflux')
      .from('shared_users')
      .select('*');
    expectDenied(response);
  });

  test('Outsider INSERT with spoofed user_id is denied', async () => {
    // Without WITH CHECK (D-24), an attacker could INSERT rows on behalf
    // of a real household user. WITH CHECK verifies both the row's user_id
    // and auth.uid() are in shared_users. Outsiders fail both.
    const spoofed = {
      id: `rls-spoof-${RUN}`,
      user_id: 'ad4432fa-d1a8-44e6-9356-84bc42f04fe9',
      scryfall_id: 'spoof',
      updated_at: new Date().toISOString(),
    };
    const response = await outsider
      .schema('counterflux')
      .from('collection')
      .insert(spoofed)
      .select();
    expectDenied(response);
  });

  test('Outsider UPDATE of household rows is denied', async () => {
    // USING filters rows before binding, OR the table-level permission
    // check denies the request outright. Either way: denied.
    const response = await outsider
      .schema('counterflux')
      .from('collection')
      .update({ category: 'hijacked' })
      .eq('user_id', 'ad4432fa-d1a8-44e6-9356-84bc42f04fe9')
      .select();
    expectDenied(response);
  });

  test('Outsider DELETE of household rows is denied', async () => {
    const response = await outsider
      .schema('counterflux')
      .from('collection')
      .delete()
      .eq('user_id', 'ad4432fa-d1a8-44e6-9356-84bc42f04fe9')
      .select();
    expectDenied(response);
  });
});
