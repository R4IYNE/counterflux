// src/components/auth-callback-overlay.js
//
// Phase 10 Plan 3 — PKCE callback transition overlay (D-06, D-11).
//
// Mounted by src/router.js on the /auth-callback route. Responsibilities:
//   1. Show a full-screen pending overlay (spinner + COMPLETING SIGN-IN…
//      + Mila caption per 10-UI-SPEC §3).
//   2. Call supabase.auth.exchangeCodeForSession(href) to complete the PKCE
//      handshake (D-07 requires explicit exchange for PKCE flow — Supabase's
//      detectSessionInUrl:true alone does NOT hydrate a session in PKCE mode).
//   3. On success: 200ms SIGNED IN flash + navigate to the pre-auth route
//      (captured in sessionStorage by auth-modal.js before redirect) or to
//      '/' as fallback.
//   4. On failure: swap to error state (expired vs generic) with a
//      BACK TO COUNTERFLUX CTA that re-opens auth-modal.
//
// Lazy-load contract: this component is itself lazy-loaded by the router,
// and it dynamically imports the Supabase service the same way
// src/stores/auth.js does — keeping the @supabase/supabase-js chunk out of
// the main bundle (AUTH-01 lazy-load discipline, Plan 2 invariant).

let overlayEl = null;

const PRE_AUTH_KEY = 'cf_pre_auth_hash';

// ---------------------------------------------------------------------------
// Pre-auth-route capture (D-11)
// ---------------------------------------------------------------------------

/**
 * Called from auth-modal.js BEFORE kicking off signInMagic / signInGoogle.
 * Stashes the current hash in sessionStorage so the post-callback navigate
 * lands the user back where they started (Visual Regression Anchor #4).
 *
 * Silently skips the /auth-callback hash itself to prevent navigation
 * recursion if the user is already on the callback URL for some reason.
 */
export function captureCurrentPreAuthRoute() {
  try {
    const hash = (typeof window !== 'undefined' && window.location && window.location.hash) || '';
    if (hash && !hash.startsWith('#/auth-callback')) {
      sessionStorage.setItem(PRE_AUTH_KEY, hash);
    }
  } catch {
    /* private mode / storage denied — fall through to '/' on consume */
  }
}

function consumeCapturedRoute() {
  try {
    const v = sessionStorage.getItem(PRE_AUTH_KEY);
    sessionStorage.removeItem(PRE_AUTH_KEY);
    return v;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// DOM rendering — splash-style full-screen overlay
// ---------------------------------------------------------------------------

function mountOverlay() {
  if (overlayEl) return overlayEl;
  overlayEl = document.createElement('div');
  overlayEl.id = 'cf-auth-callback-overlay';
  overlayEl.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:80',
    'background:#0B0C10',
    'display:flex', 'flex-direction:column',
    'align-items:center', 'justify-content:center',
    'font-family:"Space Grotesk",system-ui,sans-serif',
    'color:#EAECEE',
  ].join(';');
  document.body.appendChild(overlayEl);
  renderPending();
  return overlayEl;
}

function renderPending() {
  if (!overlayEl) return;
  overlayEl.innerHTML = `
    <span class="material-symbols-outlined cf-auth-spin" style="font-size:48px;color:#0D52BD;margin-bottom:24px;">progress_activity</span>
    <h2 style="font-family:'Syne',sans-serif;font-size:20px;font-weight:700;letter-spacing:0.01em;text-transform:uppercase;margin:0 0 16px 0;color:#EAECEE;">COMPLETING SIGN-IN…</h2>
    <p style="font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:400;color:#7A8498;margin:0;">Mila's recalibrating the sigils. One second.</p>
  `;
}

function renderSuccess() {
  if (!overlayEl) return;
  overlayEl.innerHTML = `
    <span class="material-symbols-outlined" style="font-size:48px;color:#2ECC71;margin-bottom:24px;">check_circle</span>
    <h2 style="font-family:'Syne',sans-serif;font-size:20px;font-weight:700;letter-spacing:0.01em;text-transform:uppercase;margin:0;color:#EAECEE;">SIGNED IN</h2>
  `;
}

function renderError({ heading, body }) {
  if (!overlayEl) return;
  overlayEl.innerHTML = `
    <span class="material-symbols-outlined" style="font-size:48px;color:#E23838;margin-bottom:24px;">close</span>
    <h2 style="font-family:'Syne',sans-serif;font-size:20px;font-weight:700;letter-spacing:0.01em;text-transform:uppercase;margin:0 0 16px 0;color:#EAECEE;">${heading}</h2>
    <p style="font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:400;color:#EAECEE;max-width:420px;text-align:center;margin:0 0 24px 0;line-height:1.5;">${body}</p>
    <button id="cf-auth-callback-back" style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;background:#0D52BD;color:#EAECEE;border:none;padding:12px 32px;cursor:pointer;width:280px;height:40px;">BACK TO COUNTERFLUX</button>
  `;
  const btn = overlayEl.querySelector('#cf-auth-callback-back');
  if (btn) {
    btn.addEventListener('click', () => {
      const route = consumeCapturedRoute() || '#/';
      unmountOverlay();
      if (window.__counterflux_router) {
        window.__counterflux_router.navigate(route.replace(/^#/, ''));
      }
      // D-40: auth-wall auto-opens via Alpine.effect when auth.status is
      // anonymous and the route is not /auth-callback. No need to open
      // auth-modal manually — the wall will appear the moment we navigate away.
      const AlpineObj = window.Alpine;
      AlpineObj?.store?.('toast')?.info?.('Try signing in again.');
    });
  }
}

function unmountOverlay() {
  if (!overlayEl) return;
  overlayEl.remove();
  overlayEl = null;
}

function displayName(user) {
  if (!user) return 'traveller';
  return (user.user_metadata?.full_name)
    || (user.user_metadata?.given_name)
    || (user.email ? user.email.split('@')[0] : 'traveller');
}

// ---------------------------------------------------------------------------
// Router entry point
// ---------------------------------------------------------------------------

/**
 * Router entry point. `href` is typically `window.location.href` containing
 * the `?code=<pkce>` query parameter that Supabase appends after the Google
 * OAuth round trip.
 *
 * D-40 implementation: supabase-js auto-exchanges the code internally because
 * the client is configured with `detectSessionInUrl: true` + `flowType: 'pkce'`
 * (see src/services/supabase.js). We don't call exchangeCodeForSession here —
 * manual exchange races with the auto-exchange and fails with either
 * "PKCE code verifier not found" OR "invalid flow state" depending on ordering.
 *
 * Our job here is to OBSERVE the auto-exchange result. We poll supabase.auth.
 * getSession() until a session appears (success) or we time out (error).
 *
 * @param {string} _href — window.location.href at callback time (reserved for future use)
 * @returns {Promise<void>}
 */
export async function handleAuthCallback(_href) {
  mountOverlay();

  let mod;
  try {
    mod = await import('../services/supabase.js');
  } catch (err) {
    console.error('[Counterflux] callback: failed to load supabase service', err);
    renderError({
      heading: "COULDN'T FINISH SIGN-IN",
      body: 'Something went wrong routing your session back. Go back and try again.',
    });
    return;
  }

  const supabase = mod.getSupabase();

  // Poll getSession() up to 10 seconds. The first call may return null if the
  // auto-exchange (kicked off by detectSessionInUrl:true during createClient)
  // hasn't completed yet. Subsequent calls will pick it up once it lands.
  const DEADLINE_MS = 10_000;
  const POLL_MS = 100;
  const start = Date.now();
  let lastError = null;

  while (Date.now() - start < DEADLINE_MS) {
    let result;
    try {
      result = await supabase.auth.getSession();
    } catch (err) {
      lastError = err;
      await new Promise(r => setTimeout(r, POLL_MS));
      continue;
    }
    const { data, error } = result || {};
    if (error) {
      lastError = error;
      await new Promise(r => setTimeout(r, POLL_MS));
      continue;
    }
    if (data?.session) {
      // Auto-exchange succeeded — session is in storage.
      // Sync the Alpine auth store so reactive consumers (auth-wall,
      // profile hydrator) pick it up immediately rather than waiting for
      // onAuthStateChange to fire.
      const AlpineObj = window.Alpine;
      const authStore = AlpineObj?.store?.('auth');
      if (authStore) {
        authStore.session = data.session;
        authStore.user = data.session.user;
        authStore.status = 'authed';
      }
      renderSuccess();
      AlpineObj?.store?.('toast')?.success?.(`Welcome, ${displayName(data.session.user)}.`);

      await new Promise(resolve => setTimeout(resolve, 200));

      const capturedHash = consumeCapturedRoute() || '#/';
      const route = capturedHash.replace(/^#/, '') || '/';
      unmountOverlay();
      if (window.__counterflux_router) {
        window.__counterflux_router.navigate(route);
      }
      return;
    }
    await new Promise(r => setTimeout(r, POLL_MS));
  }

  // Timeout — auto-exchange didn't produce a session within the deadline.
  console.warn('[Counterflux] auth-callback timed out waiting for session after 10s.', {
    lastError,
  });
  renderError({
    heading: "COULDN'T FINISH SIGN-IN",
    body: 'Something went wrong routing your session back. Go back and try again.',
  });
}

// ---------------------------------------------------------------------------
// Test-only helper
// ---------------------------------------------------------------------------

/** Test-only reset — tears down any mounted overlay. */
export function __resetOverlay() {
  unmountOverlay();
}
