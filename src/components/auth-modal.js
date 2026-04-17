/**
 * src/components/auth-modal.js
 *
 * Phase 10 Plan 3 — vanilla-DOM auth modal.
 * Phase 10.2 (D-39, 2026-04-18): magic-link replaced with email+password.
 *   - Shared Supabase project email templates are project-wide branded ("huxley"),
 *     which is confusing across multiple apps. Personal apps with known users
 *     (James + Sharon) prefer password sign-in anyway. Google OAuth stays.
 *
 * Mount pattern mirrors `src/components/settings-modal.js`:
 *   - Module-scoped `let modalEl = null` singleton guard
 *   - document.createElement('div') + inline styles (legacy pattern)
 *   - Appended to document.body
 *   - Escape key handler + backdrop click + X icon all close + cleanup
 *
 * Store contract:
 *   Alpine.store('auth'): { signInWithPassword(email, password), signInGoogle(), status, user, session, ... }
 *   Alpine.store('toast'): { info, success, warning, error }
 *
 * Pre-auth route capture (D-11) — Google OAuth only:
 *   captureCurrentPreAuthRoute() stashes window.location.hash into
 *   sessionStorage('cf_pre_auth_hash') BEFORE kicking off signInGoogle,
 *   so the auth-callback overlay can navigate back after the round trip.
 *   Email/password sign-in is synchronous and doesn't need the callback.
 *
 * D-10 Google-brand fidelity: the Google button uses the brand-compliant
 *   dark-theme hex values (#131314 bg, #8E918F border, #E3E3E3 text) and
 *   a multi-colour G SVG — NEVER tinted by bg-primary. Non-negotiable per
 *   Google Identity Services brand guidelines (10-UI-SPEC §Color).
 */

import { captureCurrentPreAuthRoute } from './auth-callback-overlay.js';

let modalEl = null;
let escHandler = null;

// Strict email regex per UI-SPEC (matches Task 3.1 acceptance criteria)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Google brand "G" multi-colour SVG — inlined (18×18). Per D-10 / UI-SPEC.
const GOOGLE_G_SVG = `
<svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
  <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
  <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
  <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
</svg>
`.trim();

export function openAuthModal() {
  // Singleton guard — second open() is a no-op.
  if (modalEl) return;

  const AlpineObj = (typeof window !== 'undefined' && window.Alpine) || null;

  modalEl = document.createElement('div');
  modalEl.id = 'cf-auth-modal';
  modalEl.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:60',
    'display:flex', 'align-items:center', 'justify-content:center',
    'background:rgba(11, 12, 16, 0.85)',
    'font-family:"Space Grotesk", system-ui, sans-serif',
  ].join(';');

  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeAuthModal();
  });

  const card = document.createElement('div');
  card.id = 'cf-auth-card';
  card.style.cssText = [
    'background:#14161C',
    'border:1px solid #2A2D3A',
    'padding:32px',
    'width:100%',
    'max-width:420px',
    'box-sizing:border-box',
  ].join(';');

  // Header ------------------------------------------------------------------
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;';
  header.innerHTML = `
    <h2 id="cf-auth-heading" style="font-family:'Syne',sans-serif;font-size:20px;font-weight:700;color:#EAECEE;letter-spacing:0.01em;text-transform:uppercase;margin:0;">SIGN IN</h2>
    <button id="cf-auth-close" aria-label="Close sign in" title="Close sign in" style="background:none;border:none;color:#7A8498;cursor:pointer;width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;">
      <span class="material-symbols-outlined" style="font-size:20px;">close</span>
    </button>
  `;
  card.appendChild(header);

  // Body --------------------------------------------------------------------
  const body = document.createElement('div');
  body.id = 'cf-auth-body';
  body.setAttribute('aria-live', 'polite');
  _renderBody(body);
  card.appendChild(body);

  modalEl.appendChild(card);
  document.body.appendChild(modalEl);

  // X close -----------------------------------------------------------------
  card.querySelector('#cf-auth-close').addEventListener('click', closeAuthModal);

  // Escape handler ----------------------------------------------------------
  escHandler = (e) => { if (e.key === 'Escape') closeAuthModal(); };
  document.addEventListener('keydown', escHandler);

  // Autofocus email input (keyboard-first user)
  const emailInput = card.querySelector('#cf-auth-email');
  if (emailInput && typeof emailInput.focus === 'function') {
    try { emailInput.focus(); } catch { /* ignore */ }
  }

  // Wire handlers
  _wireHandlers(AlpineObj);
}

export function closeAuthModal() {
  if (!modalEl) return;
  if (escHandler) {
    document.removeEventListener('keydown', escHandler);
    escHandler = null;
  }
  modalEl.remove();
  modalEl = null;

  // Focus restoration: return focus to the sidebar SIGN IN CTA if present.
  try {
    const sidebarCta = document.getElementById('cf-sidebar-signin-cta');
    if (sidebarCta && typeof sidebarCta.focus === 'function') sidebarCta.focus();
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function _renderBody(body) {
  body.innerHTML = `
    <!-- Google button — brand-compliant dark theme (D-10). -->
    <button id="cf-auth-google" aria-label="Sign in with Google"
      style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:40px;background:#131314;color:#E3E3E3;border:1px solid #8E918F;cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;padding:0 16px;box-sizing:border-box;"
      onmouseover="this.style.background='#1F1F1F'"
      onmouseout="this.style.background='#131314'"
    >
      <span style="display:inline-flex;align-items:center;">${GOOGLE_G_SVG}</span>
      <span id="cf-auth-google-label">SIGN IN WITH GOOGLE</span>
    </button>

    <!-- OR divider: two 1px rules + centred 11px mono muted label -->
    <div style="display:flex;align-items:center;margin:16px 0;height:32px;">
      <div style="flex:1;height:1px;background:#2A2D3A;"></div>
      <span style="padding:0 12px;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:400;letter-spacing:0.15em;color:#7A8498;text-transform:uppercase;">OR</span>
      <div style="flex:1;height:1px;background:#2A2D3A;"></div>
    </div>

    <!-- EMAIL field -->
    <label for="cf-auth-email" style="display:block;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:0.15em;color:#0D52BD;text-transform:uppercase;margin-bottom:8px;">EMAIL</label>
    <input type="email" id="cf-auth-email" placeholder="you@email.com" autocomplete="email"
      style="width:100%;height:40px;background:#0B0C10;border:1px solid #2A2D3A;color:#EAECEE;padding:0 12px;font-family:'Space Grotesk',sans-serif;font-size:14px;box-sizing:border-box;outline:none;"
      onfocus="this.style.borderColor='#0D52BD';this.style.boxShadow='0 0 12px rgba(13,82,189,0.3)';"
      onblur="this.style.borderColor='#2A2D3A';this.style.boxShadow='none';"
    >

    <!-- PASSWORD field -->
    <label for="cf-auth-password" style="display:block;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:0.15em;color:#0D52BD;text-transform:uppercase;margin-top:16px;margin-bottom:8px;">PASSWORD</label>
    <input type="password" id="cf-auth-password" placeholder="••••••••" autocomplete="current-password"
      style="width:100%;height:40px;background:#0B0C10;border:1px solid #2A2D3A;color:#EAECEE;padding:0 12px;font-family:'Space Grotesk',sans-serif;font-size:14px;box-sizing:border-box;outline:none;"
      onfocus="this.style.borderColor='#0D52BD';this.style.boxShadow='0 0 12px rgba(13,82,189,0.3)';"
      onblur="this.style.borderColor='#2A2D3A';this.style.boxShadow='none';"
    >

    <!-- Inline validation / credential error slot -->
    <div id="cf-auth-error" style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:400;color:#E23838;min-height:0;margin-top:8px;"></div>

    <!-- SIGN IN button -->
    <button id="cf-auth-submit" disabled
      style="width:100%;height:40px;margin-top:16px;background:#1C1F28;color:#4A5064;border:none;cursor:not-allowed;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;"
    >SIGN IN</button>
  `;
}

function _wireHandlers(AlpineObj) {
  const emailInput = modalEl.querySelector('#cf-auth-email');
  const passwordInput = modalEl.querySelector('#cf-auth-password');
  const submitBtn = modalEl.querySelector('#cf-auth-submit');
  const errorSlot = modalEl.querySelector('#cf-auth-error');
  const googleBtn = modalEl.querySelector('#cf-auth-google');
  const googleLabel = modalEl.querySelector('#cf-auth-google-label');

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

    // Success — onAuthStateChange fires SIGNED_IN, status flips to 'authed',
    // profile hydrates via Alpine.effect bridge. Close the modal directly.
    toast?.success?.('Signed in.');
    closeAuthModal();
  }

  submitBtn.addEventListener('click', submit);

  // Enter key on either field submits (when enabled).
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
    else googleBtn.textContent = 'OPENING GOOGLE…';

    try { captureCurrentPreAuthRoute(); } catch { /* ignore */ }

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

    // After await: if status is still anonymous (popup likely cancelled), re-enable + info toast.
    if (auth?.status === 'anonymous') {
      setTimeout(() => {
        if (auth?.status === 'anonymous' && modalEl) {
          toast?.info?.('Google sign-in cancelled. Try again or use email + password.');
          if (googleLabel) googleLabel.textContent = 'SIGN IN WITH GOOGLE';
          googleBtn.disabled = false;
        }
      }, 2000);
    }
    // On success, the browser navigates to Google — modal stays open until
    // the callback overlay takes over on return. We do NOT close here.
  });
}

// Expose globally so sidebar + settings templates can invoke via
// `@click="window.__openAuthModal && window.__openAuthModal()"` (pattern
// matches existing `window.__openSettingsModal`).
if (typeof window !== 'undefined') {
  window.__openAuthModal = openAuthModal;
}
