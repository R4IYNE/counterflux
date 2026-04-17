// tests/rls-isolation.test.js
// Phase 10 D-37 hard gate — single most load-bearing test in v1.1.
// Verifies RLS actually isolates users across the six synced tables in the
// counterflux Postgres schema. Drives the WITH CHECK requirement in D-24
// and the "empty array, not error" assertion from PITFALLS §2.7.
//
// Skips automatically if VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are
// absent (CI without secrets; collaborators without .env.local). The
// @supabase/supabase-js import is dynamic inside beforeAll, so the test
// stays skippable even before Plan 10-02 installs the package.
//
// To run locally against the live huxley project:
//   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx vitest run tests/rls-isolation.test.js
//
// Pre-requisites (see .planning/phases/10-supabase-auth-foundation/10-AUTH-PREFLIGHT.md):
//   1. Run supabase/migrations/20260417_counterflux_auth_foundation.sql in
//      the huxley SQL Editor.
//   2. Add `counterflux` to Database → API → Exposed schemas.
//   3. Disable "Confirm email" in Authentication → Providers → Email for
//      the duration of the test run (or allowlist counterflux-test.dev).
//   4. npm install @supabase/supabase-js (shipped in Plan 10-02).

import { describe, test, expect, beforeAll, afterAll } from 'vitest';

const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_ANON_KEY;
const HAS_ENV = !!(URL && KEY);

// Unique per-run test identities so parallel CI runs never collide.
const RUN = Date.now().toString(36);
const USER_A = { email: `rls-a-${RUN}@counterflux-test.dev`, password: `cf-rls-a-${RUN}-xyz` };
const USER_B = { email: `rls-b-${RUN}@counterflux-test.dev`, password: `cf-rls-b-${RUN}-xyz` };

const describeIf = HAS_ENV ? describe : describe.skip;

describeIf('RLS isolation — counterflux schema (D-37 hard gate)', () => {
  let clientA, clientB, userA_id, userB_id;
  const seeded = {
    collection: null,
    decks: null,
    deck_cards: null,
    games: null,
    watchlist: null,
    profile: null,
  };

  beforeAll(async () => {
    // Dynamic import so the static import doesn't resolve when the package
    // is absent (test still skips cleanly via describe.skip, but Vitest
    // resolves static imports at collection time regardless of skip state).
    const { createClient } = await import('@supabase/supabase-js');

    clientA = createClient(URL, KEY, { auth: { persistSession: false } });
    clientB = createClient(URL, KEY, { auth: { persistSession: false } });

    // Sign up + sign in both users. signUp auto-signs-in on success when
    // email confirmation is disabled (pre-flight step 3).
    const a = await clientA.auth.signUp(USER_A);
    if (a.error) throw new Error(`signUp A failed: ${a.error.message}`);
    userA_id = a.data.user.id;

    const b = await clientB.auth.signUp(USER_B);
    if (b.error) throw new Error(`signUp B failed: ${b.error.message}`);
    userB_id = b.data.user.id;

    // Seed one row in each of the six tables for User A.
    const now = new Date().toISOString();
    seeded.collection = {
      id: `rls-col-${RUN}`,
      user_id: userA_id,
      scryfall_id: 'test-scryfall-a',
      category: 'library',
      foil: false,
      updated_at: now,
    };
    seeded.decks = {
      id: `rls-dck-${RUN}`,
      user_id: userA_id,
      name: 'RLS Test Deck',
      format: 'commander',
      updated_at: now,
    };
    seeded.deck_cards = {
      id: `rls-dc-${RUN}`,
      user_id: userA_id,
      deck_id: seeded.decks.id,
      scryfall_id: 'test-scryfall-a',
      updated_at: now,
    };
    seeded.games = {
      id: `rls-gm-${RUN}`,
      user_id: userA_id,
      started_at: now,
      updated_at: now,
    };
    seeded.watchlist = {
      id: `rls-wl-${RUN}`,
      user_id: userA_id,
      scryfall_id: `test-scry-wl-${RUN}`,
      updated_at: now,
    };
    seeded.profile = {
      id: `rls-pf-${RUN}`,
      user_id: userA_id,
      name: 'RLS Test A',
      updated_at: now,
    };

    // Insertion order matters for deck_cards FK → decks.
    const seedOrder = ['collection', 'decks', 'deck_cards', 'games', 'watchlist', 'profile'];
    for (const table of seedOrder) {
      const row = seeded[table];
      const { error } = await clientA.schema('counterflux').from(table).insert(row);
      if (error) throw new Error(`seed ${table} for User A failed: ${error.message}`);
    }
  }, 30000);

  afterAll(async () => {
    // Clean up — User A deletes their own rows (RLS permits own-row delete).
    if (!clientA || !userA_id) return;
    // Reverse-FK order: games → deck_cards → decks; watchlist/collection/profile standalone.
    const order = ['games', 'deck_cards', 'decks', 'watchlist', 'collection', 'profile'];
    for (const table of order) {
      await clientA.schema('counterflux').from(table).delete().eq('user_id', userA_id);
    }
    await clientA.auth.signOut();
    await clientB.auth.signOut();
  }, 30000);

  test.each([
    'collection',
    'decks',
    'deck_cards',
    'games',
    'watchlist',
    'profile',
  ])('User B SELECT on counterflux.%s returns empty array for User A rows', async (table) => {
    const { data, error } = await clientB
      .schema('counterflux')
      .from(table)
      .select('*')
      .eq('user_id', userA_id);
    // PITFALLS §2.7 — RLS returns [] (empty), NOT 401/403, to unauthorised readers.
    expect(error).toBeFalsy();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(0);
  });

  test('User B INSERT with spoofed user_id is rejected by WITH CHECK', async () => {
    // Without WITH CHECK (D-24), an authenticated user could INSERT rows with
    // user_id = <victim>. This test proves the WITH CHECK clause is live.
    const spoofed = {
      id: `rls-spoof-${RUN}`,
      user_id: userA_id,
      scryfall_id: 'spoof',
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await clientB
      .schema('counterflux')
      .from('collection')
      .insert(spoofed)
      .select();
    expect(error).toBeTruthy();
    expect(data).toBeFalsy();
  });

  test('User B UPDATE of User A row affects zero rows (policy USING filters)', async () => {
    // The USING clause on the ALL policy filters User A's rows out of User B's
    // result set before the UPDATE can bind — so the UPDATE is a silent no-op
    // (no error, empty data array), not a 403.
    const { data, error } = await clientB
      .schema('counterflux')
      .from('collection')
      .update({ category: 'hijacked' })
      .eq('id', seeded.collection.id)
      .select();
    expect(error).toBeFalsy();
    expect(data).toEqual([]);
  });

  test('User A SELECT on own rows returns data (positive control)', async () => {
    // GREEN assertion — proves RLS isn't blocking the legitimate path.
    const { data, error } = await clientA
      .schema('counterflux')
      .from('collection')
      .select('*')
      .eq('id', seeded.collection.id);
    expect(error).toBeFalsy();
    expect(data.length).toBe(1);
    expect(data[0].user_id).toBe(userA_id);
  });
});
