/**
 * src/components/auth-wall.js
 *
 * Phase 10.3 (D-40, 2026-04-18) — boot-time auth gate.
 *
 * Counterflux is an auth-gated product (private during v1.1, permanently
 * gated thereafter — see 10-CONTEXT.md D-40). Anonymous users don't have a
 * use case; this wall blocks all app interaction until sign-in completes.
 *
 * Semantics:
 *   - Rendered by src/main.js via Alpine.effect when auth.status !== 'authed'
 *     AND the current route is not /auth-callback.
 *   - Non-dismissible: no X button, no Escape key, no backdrop click close.
 *   - On successful sign-in (either email+password or Google OAuth),
 *     auth.status flips to 'authed' → the Alpine.effect closes this wall.
 *   - On sign-out, auth.status flips to 'anonymous' → wall re-opens.
 *
 * AUTH-01 lazy-load preserved: this component is pure HTML/CSS on first
 * render. @supabase/supabase-js is only lazy-imported when the user clicks
 * SIGN IN or SIGN IN WITH GOOGLE (both paths go through the auth store's
 * dynamic import of services/supabase.js).
 *
 * Mount pattern mirrors migration-blocked-modal.js:
 *   - Module-scoped `let wallEl = null` singleton guard
 *   - document.createElement('div') + inline styles
 *   - Appended to document.body at z-index 90 (above sidebar 40, below
 *     auth-callback-overlay 80's successor — but not rendered concurrently)
 */

let wallEl = null;

// Strict email regex — matches auth-modal (D-39 parity)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Google brand "G" multi-colour SVG — same as auth-modal.js (D-10 brand fidelity)
const GOOGLE_G_SVG = `
<svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
  <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
  <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
  <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
</svg>
`.trim();

export function openAuthWall() {
  if (wallEl) return;

  const AlpineObj = (typeof window !== 'undefined' && window.Alpine) || null;

  // Phase 13 Plan 5 Task 6 — structural LCP fix.
  // index.html now ships a paint-critical #cf-auth-wall + <h1 class="cf-auth-wall-title">
  // directly in <body> so the h1 (LCP element) paints on HTML parse instead of
  // waiting ~6 s for the full JS boot chain. We detect the pre-existing DOM
  // here and DECORATE it (add tagline + sign-in card) rather than constructing
  // a fresh wall. Fallback path (createElement) preserved for pre-Task-6
  // test setups and any caller that mounts without the static markup — e.g.
  // tests/auth-wall.test.js wipes document.body between cases.
  const existing = typeof document !== 'undefined' ? document.getElementById('cf-auth-wall') : null;
  if (existing) {
    wallEl = existing;
    // Ensure ARIA wiring + role match the dynamic path (static markup already
    // ships the attributes, but re-apply idempotently so a consumer can strip
    // them in tests and still land in a valid state).
    wallEl.setAttribute('role', 'dialog');
    wallEl.setAttribute('aria-modal', 'true');
    wallEl.setAttribute('aria-labelledby', 'cf-auth-wall-heading');

    // The critical CSS in <head> already sizes/positions/backgrounds the wall
    // and fonts the .cf-auth-wall-title h1. No inline style.cssText needed —
    // applying it would be redundant (and could override the critical CSS in
    // ways that cause a one-frame flash before the style recalculates).

    // The paint-critical h1 already exists; if for some reason it was stripped
    // (test setup wipes it), reinstate it so downstream text-assertions hold.
    if (!wallEl.querySelector('.cf-auth-wall-title')) {
      const brand = document.createElement('h1');
      brand.className = 'cf-auth-wall-title';
      brand.textContent = 'COUNTERFLUX';
      wallEl.appendChild(brand);
    }
  } else {
    // Legacy fallback — construct from scratch (matches the pre-Task-6 path).
    wallEl = document.createElement('div');
    wallEl.id = 'cf-auth-wall';
    wallEl.setAttribute('role', 'dialog');
    wallEl.setAttribute('aria-modal', 'true');
    wallEl.setAttribute('aria-labelledby', 'cf-auth-wall-heading');
    wallEl.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:90',
      'background:#0B0C10',
      'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center',
      'padding:32px',
      'font-family:"Space Grotesk", system-ui, sans-serif',
    ].join(';');

    // Brand header (Syne, uppercase, primary accent) — anchors the wall visually
    const brand = document.createElement('h1');
    brand.className = 'cf-auth-wall-title';
    brand.style.cssText = "font-family:'Syne',sans-serif;font-size:48px;font-weight:700;color:#EAECEE;letter-spacing:0.01em;text-transform:uppercase;margin:0 0 8px 0;text-align:center;";
    brand.textContent = 'COUNTERFLUX';
    wallEl.appendChild(brand);
  }

  const tagline = document.createElement('p');
  tagline.style.cssText = "font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:400;letter-spacing:0.15em;color:#7A8498;text-transform:uppercase;margin:0 0 32px 0;text-align:center;";
  tagline.textContent = 'THE AETHERIC ARCHIVE';
  wallEl.appendChild(tagline);

  // Sign-in card (reuses auth-modal card dimensions for visual consistency)
  const card = document.createElement('div');
  card.id = 'cf-auth-wall-card';
  card.style.cssText = [
    'background:#14161C',
    'border:1px solid #2A2D3A',
    'padding:32px',
    'width:100%',
    'max-width:420px',
    'box-sizing:border-box',
  ].join(';');

  // Heading
  const heading = document.createElement('h2');
  heading.id = 'cf-auth-wall-heading';
  heading.style.cssText = "font-family:'Syne',sans-serif;font-size:20px;font-weight:700;color:#EAECEE;letter-spacing:0.01em;text-transform:uppercase;margin:0 0 24px 0;";
  heading.textContent = 'SIGN IN';
  card.appendChild(heading);

  // Body with form
  const body = document.createElement('div');
  body.id = 'cf-auth-wall-body';
  body.setAttribute('aria-live', 'polite');
  body.innerHTML = `
    <button id="cf-auth-wall-google" aria-label="Sign in with Google"
      style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:40px;background:#131314;color:#E3E3E3;border:1px solid #8E918F;cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;padding:0 16px;box-sizing:border-box;"
      onmouseover="this.style.background='#1F1F1F'"
      onmouseout="this.style.background='#131314'"
    >
      <span style="display:inline-flex;align-items:center;">${GOOGLE_G_SVG}</span>
      <span id="cf-auth-wall-google-label">SIGN IN WITH GOOGLE</span>
    </button>

    <div style="display:flex;align-items:center;margin:16px 0;height:32px;">
      <div style="flex:1;height:1px;background:#2A2D3A;"></div>
      <span style="padding:0 12px;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:400;letter-spacing:0.15em;color:#7A8498;text-transform:uppercase;">OR</span>
      <div style="flex:1;height:1px;background:#2A2D3A;"></div>
    </div>

    <label for="cf-auth-wall-email" style="display:block;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:0.15em;color:#0D52BD;text-transform:uppercase;margin-bottom:8px;">EMAIL</label>
    <input type="email" id="cf-auth-wall-email" placeholder="you@email.com" autocomplete="email"
      style="width:100%;height:40px;background:#0B0C10;border:1px solid #2A2D3A;color:#EAECEE;padding:0 12px;font-family:'Space Grotesk',sans-serif;font-size:14px;box-sizing:border-box;outline:none;"
      onfocus="this.style.borderColor='#0D52BD';this.style.boxShadow='0 0 12px rgba(13,82,189,0.3)';"
      onblur="this.style.borderColor='#2A2D3A';this.style.boxShadow='none';"
    >

    <label for="cf-auth-wall-password" style="display:block;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:0.15em;color:#0D52BD;text-transform:uppercase;margin-top:16px;margin-bottom:8px;">PASSWORD</label>
    <input type="password" id="cf-auth-wall-password" placeholder="••••••••" autocomplete="current-password"
      style="width:100%;height:40px;background:#0B0C10;border:1px solid #2A2D3A;color:#EAECEE;padding:0 12px;font-family:'Space Grotesk',sans-serif;font-size:14px;box-sizing:border-box;outline:none;"
      onfocus="this.style.borderColor='#0D52BD';this.style.boxShadow='0 0 12px rgba(13,82,189,0.3)';"
      onblur="this.style.borderColor='#2A2D3A';this.style.boxShadow='none';"
    >

    <div id="cf-auth-wall-error" style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:400;color:#E23838;min-height:0;margin-top:8px;"></div>

    <button id="cf-auth-wall-submit" disabled
      style="width:100%;height:40px;margin-top:16px;background:#1C1F28;color:#4A5064;border:none;cursor:not-allowed;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;"
    >SIGN IN</button>
  `;
  card.appendChild(body);
  wallEl.appendChild(card);

  // Mila caption below the card (brand voice anchor)
  const mila = document.createElement('p');
  mila.style.cssText = "font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:400;letter-spacing:0.05em;color:#7A8498;margin:24px 0 0 0;text-align:center;";
  mila.textContent = 'Mila only lets members through the gate.';
  wallEl.appendChild(mila);

  // Only attach if not already in the DOM. When the static markup from
  // index.html (Plan 5 Task 6) provided the wall, it's already a child of
  // document.body and re-appending would be a no-op reflow. When the legacy
  // fallback path created it fresh, we need to mount it.
  if (!wallEl.isConnected) {
    document.body.appendChild(wallEl);
  }

  // Autofocus email input
  const emailInput = card.querySelector('#cf-auth-wall-email');
  if (emailInput && typeof emailInput.focus === 'function') {
    try { emailInput.focus(); } catch { /* ignore */ }
  }

  _wireHandlers(AlpineObj);
}

export function closeAuthWall() {
  if (wallEl) {
    wallEl.remove();
    wallEl = null;
    return;
  }
  // Phase 14.06 — fast-path bug fix.
  // index.html ships a paint-critical static <div id="cf-auth-wall"> for LCP
  // (Phase 13 Plan 5 Task 6). If auth rehydrates to 'authed' BEFORE Alpine.effect
  // first invokes openAuthWall(), wallEl stays null and the static element is
  // never decorated nor removed — leaving it covering the app shell with the
  // bare COUNTERFLUX h1 visible and no other interaction possible.
  // Belt-and-braces: also strip the static element when wallEl is null.
  const stale = typeof document !== 'undefined' ? document.getElementById('cf-auth-wall') : null;
  if (stale) stale.remove();
}

export function isAuthWallOpen() {
  return wallEl !== null;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

function _wireHandlers(AlpineObj) {
  const emailInput = wallEl.querySelector('#cf-auth-wall-email');
  const passwordInput = wallEl.querySelector('#cf-auth-wall-password');
  const submitBtn = wallEl.querySelector('#cf-auth-wall-submit');
  const errorSlot = wallEl.querySelector('#cf-auth-wall-error');
  const googleBtn = wallEl.querySelector('#cf-auth-wall-google');
  const googleLabel = wallEl.querySelector('#cf-auth-wall-google-label');

  function setSubmitEnabled(enabled) {
    submitBtn.disabled = !enabled;
    if (enabled) {
      submitBtn.style.background = '#0D52BD';
      submitBtn.style.color = '#EAECEE';
      submitBtn.style.cursor = 'pointer';
    } else {
      submitBtn.style.background = '#1C1F28';
      submitBtn.style.color = '#4A5064';
      submitBtn.style.cursor = 'not-allowed';
    }
  }

  function refreshSubmitState() {
    const emailValid = EMAIL_RE.test(emailInput.value.trim());
    const passwordPresent = passwordInput.value.length > 0;
    setSubmitEnabled(emailValid && passwordPresent);
  }

  emailInput.addEventListener('input', () => {
    if (errorSlot) errorSlot.textContent = '';
    refreshSubmitState();
  });

  passwordInput.addEventListener('input', () => {
    if (errorSlot) errorSlot.textContent = '';
    refreshSubmitState();
  });

  emailInput.addEventListener('blur', () => {
    const email = emailInput.value.trim();
    if (email.length > 0 && !EMAIL_RE.test(email)) {
      if (errorSlot) errorSlot.textContent = 'Enter a valid email address.';
    }
  });

  async function submit() {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!EMAIL_RE.test(email) || password.length === 0) return;

    submitBtn.textContent = 'SIGNING IN…';
    submitBtn.disabled = true;
    emailInput.disabled = true;
    passwordInput.disabled = true;
    googleBtn.disabled = true;
    if (errorSlot) errorSlot.textContent = '';

    const auth = AlpineObj?.store?.('auth');
    const toast = AlpineObj?.store?.('toast');
    let result;
    try {
      result = await auth?.signInWithPassword(email, password);
    } catch (err) {
      result = { error: err };
    }

    if (result && result.error) {
      const msg = String(result.error?.message || result.error || '');
      if (/invalid.*credentials/i.test(msg) || /invalid.*login/i.test(msg)) {
        if (errorSlot) errorSlot.textContent = 'Invalid email or password.';
      } else if (/rate.?limit/i.test(msg)) {
        toast?.warning?.('Too many attempts. Wait a minute and try again.');
      } else {
        toast?.error?.("Couldn't sign in. Check your connection and try again.");
      }
      submitBtn.textContent = 'SIGN IN';
      emailInput.disabled = false;
      passwordInput.disabled = false;
      googleBtn.disabled = false;
      refreshSubmitState();
      return;
    }

    // Success — auth.status flip to 'authed' triggers the Alpine.effect in main.js
    // which calls closeAuthWall() automatically. No manual close here.
    toast?.success?.('Signed in.');
  }

  submitBtn.addEventListener('click', submit);

  // Enter key on either field submits when button is enabled
  [emailInput, passwordInput].forEach((el) => {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !submitBtn.disabled) {
        e.preventDefault();
        submit();
      }
    });
  });

  googleBtn.addEventListener('click', async () => {
    googleBtn.disabled = true;
    if (googleLabel) googleLabel.textContent = 'OPENING GOOGLE…';

    const auth = AlpineObj?.store?.('auth');
    const toast = AlpineObj?.store?.('toast');
    let result;
    try {
      result = await auth?.signInGoogle();
    } catch (err) {
      result = { error: err };
    }

    if (result && result.error) {
      toast?.error?.("Couldn't sign in with Google. Check your connection and try again.");
      googleBtn.disabled = false;
      if (googleLabel) googleLabel.textContent = 'SIGN IN WITH GOOGLE';
      return;
    }

    // OAuth redirects the browser immediately — wall stays mounted until
    // return. If status is still anonymous after 2s, popup was cancelled.
    if (auth?.status === 'anonymous') {
      setTimeout(() => {
        if (auth?.status === 'anonymous' && wallEl) {
          toast?.info?.('Google sign-in cancelled. Try again or use email + password.');
          if (googleLabel) googleLabel.textContent = 'SIGN IN WITH GOOGLE';
          googleBtn.disabled = false;
        }
      }, 2000);
    }
  });
}

// Expose globally for diagnostic convenience (parity with __openAuthModal).
if (typeof window !== 'undefined') {
  window.__openAuthWall = openAuthWall;
  window.__closeAuthWall = closeAuthWall;
}
