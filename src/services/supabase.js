// src/services/supabase.js
//
// Phase 10 Plan 2 — Supabase client singleton with PKCE flow (D-07).
//
// CRITICAL: This module MUST NOT be statically imported from src/main.js,
// src/app.js, any store init, or any screen root. It is loaded via a dynamic
// import() from src/stores/auth.js when (and only when) the user initiates
// an auth interaction OR the auth store detects a prior session token in
// localStorage (D-29). This preserves AUTH-01's lazy-load promise.
//
// Env vars are read from import.meta.env (Vite convention). If either is
// missing the client still instantiates — Supabase client throws on the
// first network call, surfaced as a toast by the auth store. We deliberately
// do NOT hard-crash on missing env so that local dev without a .env.local
// still boots the app (anonymous mode works with no creds).

import { createClient } from '@supabase/supabase-js';

let _client = null;

/**
 * Returns the singleton Supabase client, creating it on first call.
 * Subsequent calls return the cached instance — never re-create.
 * Re-creating leaks Realtime subscriptions (PITFALLS integration gotchas).
 *
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function getSupabase() {
  if (_client) return _client;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn('[Counterflux] Supabase env vars missing — auth will fail on first network call. See .planning/phases/10-supabase-auth-foundation/10-AUTH-PREFLIGHT.md');
  }

  _client = createClient(url || 'https://missing.supabase.co', key || 'missing-anon-key', {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      // D-39 fix: we call exchangeCodeForSession explicitly in auth-callback-overlay.
      // Setting this to true causes a race where auto-exchange consumes the PKCE
      // verifier from localStorage before our handler fires, leading to
      // "PKCE code verifier not found in storage" on our explicit exchange call.
      detectSessionInUrl: false,
    },
  });

  return _client;
}

/**
 * Test-only reset — clears the cached client so the next getSupabase() call
 * rebuilds it. Do NOT call from production code.
 */
export function __resetSupabaseClient() {
  _client = null;
}
