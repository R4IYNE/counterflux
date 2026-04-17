// src/components/auth-callback-overlay.js
//
// Phase 10 Plan 2 — STUB. Plan 3 replaces this module with the real
// magic-link / OAuth callback overlay (PKCE exchangeCodeForSession flow,
// "Signing you in..." spinner, error toasts, pre-auth-route restoration
// per D-11).
//
// This stub exists so src/router.js can register the /auth-callback route
// via dynamic import without Vite/Rolldown failing at resolution time.
// When Plan 3 ships, this file will be overwritten with the full overlay.
//
// Contract Plan 3 must preserve (router calls this):
//   - Named export `handleAuthCallback(href: string): Promise<void>`
//   - Caller (router.js) awaits the result; on rejection falls back to
//     router.navigate('/')
//
// Until Plan 3 lands, the stub simply no-ops and relies on Supabase's
// `detectSessionInUrl: true` (set in src/services/supabase.js) to pick
// the PKCE code out of the query string on the next client construction.
// The user still lands on /#/auth-callback with a blank main pane — Plan 3
// replaces this with a proper "Signing you in..." visual.

/**
 * Stub — Plan 3 replaces with PKCE exchangeCodeForSession + pre-auth-route restoration.
 * @param {string} _href — window.location.href at callback time
 * @returns {Promise<void>}
 */
export async function handleAuthCallback(_href) {
  // No-op until Plan 3 ships.
  // Supabase `detectSessionInUrl: true` on the client handles the exchange
  // when the client is next instantiated (sign-in flow or prior-session probe).
  // Router falls through to its `router.navigate('/')` fallback in the
  // catch branch if this throws — we deliberately do not throw here.
  return;
}
