// src/stores/auth.js
//
// Phase 10 Plan 2 — Alpine auth store wrapping Supabase identity.
// Phase 10.2 (D-39, 2026-04-18) — magic-link replaced with email+password.
//
// Store shape:
//   { status, user, session, signInWithPassword, signInGoogle, signOut, init }
//
// Status transitions:
//   anonymous → pending (during sign-in call + OAuth redirect)
//   pending → authed (SIGNED_IN event delivered by onAuthStateChange)
//   authed → anonymous (SIGNED_OUT event)
//
// Lazy-load discipline (D-29):
//   - Fresh user with no Supabase localStorage token → init() does NOT load supabase.js
//   - Returning user with a prior session token → init() lazy-imports supabase.js and
//     eager-calls getSession() to hydrate the session before Alpine.effect fires
//     (prevents a one-frame "anonymous flash" on reload for signed-in users; PITFALLS §8)

import Alpine from 'alpinejs';

let _supabaseModule = null;
let _stateChangeSubscribed = false;

async function loadSupabase() {
  if (_supabaseModule) return _supabaseModule;
  _supabaseModule = await import('../services/supabase.js');
  return _supabaseModule;
}

/**
 * Detects a prior Supabase session by scanning localStorage for any key
 * matching `sb-<project-ref>-auth-token`. Supabase prefixes all session
 * storage with `sb-` by default, so this probe is provider-agnostic
 * and survives project-ref rotation.
 *
 * Returns false silently if localStorage is unavailable (private mode,
 * storage-denied) — treat as "no prior session".
 */
function hasPriorSession() {
  try {
    if (typeof localStorage === 'undefined') return false;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && /^sb-.*-auth-token$/.test(key)) return true;
    }
  } catch { /* private-mode or storage-denied: treat as no prior session */ }
  return false;
}

function currentOrigin() {
  if (typeof window === 'undefined' || !window.location) return '';
  return window.location.origin || '';
}

/**
 * Redirect target Supabase hands to Google OAuth. PKCE flow (D-07) puts the
 * ?code in the query string, so Navigo's hash-based router can safely register
 * /auth-callback (D-06, PITFALLS §10). Email/password (D-39) does not use
 * this callback — the signInWithPassword response is synchronous.
 */
function callbackUrl() {
  return `${currentOrigin()}/#/auth-callback`;
}

export function initAuthStore() {
  Alpine.store('auth', {
    status: 'anonymous',
    user: null,
    session: null,

    async init() {
      // D-29: Only load supabase-js if there's a prior session token in localStorage.
      // Anonymous users pay zero latency here (no dynamic import, no network call).
      if (!hasPriorSession()) {
        this.status = 'anonymous';
        return;
      }

      this.status = 'pending';

      try {
        const { getSupabase } = await loadSupabase();
        const supabase = getSupabase();

        this._subscribeToStateChanges(supabase);

        const { data, error } = await supabase.auth.getSession();
        if (error || !data?.session) {
          this.status = 'anonymous';
          this.user = null;
          this.session = null;
          return;
        }

        this.session = data.session;
        this.user = data.session.user;
        this.status = 'authed';
      } catch (err) {
        console.warn('[Counterflux] auth init failed:', err);
        this.status = 'anonymous';
        this.user = null;
        this.session = null;
      }
    },

    _subscribeToStateChanges(supabase) {
      if (_stateChangeSubscribed) return;
      _stateChangeSubscribed = true;
      supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          this.session = session;
          this.user = session.user;
          this.status = 'authed';
        } else {
          this.session = null;
          this.user = null;
          this.status = 'anonymous';
        }
      });
    },

    async signInWithPassword(email, password) {
      this.status = 'pending';
      try {
        const { getSupabase } = await loadSupabase();
        const supabase = getSupabase();
        this._subscribeToStateChanges(supabase);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) this.status = 'anonymous';
        // On success, onAuthStateChange fires SIGNED_IN and flips status to authed.
        // Return { error } so UI can surface credential failures.
        return { error };
      } catch (err) {
        this.status = 'anonymous';
        return { error: err };
      }
    },

    async signInGoogle() {
      this.status = 'pending';
      try {
        const { getSupabase } = await loadSupabase();
        const supabase = getSupabase();
        this._subscribeToStateChanges(supabase);
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: callbackUrl() },
        });
        if (error) this.status = 'anonymous';
        return { error };
      } catch (err) {
        this.status = 'anonymous';
        return { error: err };
      }
    },

    async signOut() {
      try {
        const { getSupabase } = await loadSupabase();
        const supabase = getSupabase();
        const { error } = await supabase.auth.signOut();
        // onAuthStateChange will flip status to anonymous + clear user/session.
        // Also clear synchronously so callers that read status immediately after await get the right value.
        this.session = null;
        this.user = null;
        this.status = 'anonymous';
        return { error };
      } catch (err) {
        return { error: err };
      }
    },
  });
}

/**
 * Test-only reset — clears module-level caches so that subsequent
 * initAuthStore() calls inside the same process start fresh.
 * Mirror of __resetSupabaseClient() in the service.
 */
export function __resetAuthStoreSubscription() {
  _supabaseModule = null;
  _stateChangeSubscribed = false;
}
