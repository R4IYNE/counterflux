/**
 * src/components/auth-modal.js
 *
 * Phase 10 Plan 3 — vanilla-DOM auth modal shipping every UI-SPEC §1 + §2
 * requirement (AUTH-02 magic-link + AUTH-03 Google OAuth + D-08 sibling-of-
 * settings-modal + D-10 Google-prominent + D-12 in-modal swap).
 *
 * Mount pattern mirrors `src/components/settings-modal.js`:
 *   - Module-scoped `let modalEl = null` singleton guard
 *   - document.createElement('div') + inline styles (legacy pattern)
 *   - Appended to document.body
 *   - Escape key handler + backdrop click + X icon all close + cleanup
 *
 * Store contract (from Plan 10-02):
 *   Alpine.store('auth'): { signInMagic(email), signInGoogle(), status, user, session, ... }
 *   Alpine.store('toast'): { info, success, warning, error }
 *
 * Pre-auth route capture (D-11):
 *   captureCurrentPreAuthRoute() stashes window.location.hash into
 *   sessionStorage('cf_pre_auth_hash') BEFORE kicking off signInMagic /
 *   signInGoogle, so the auth-callback overlay can navigate back after the
 *   round trip.
 *
 * D-10 Google-brand fidelity: the Google button uses the brand-compliant
 *   dark-theme hex values (#131314 bg, #8E918F border, #E3E3E3 text) and
 *   a multi-colour G SVG — NEVER tinted by bg-primary. Non-negotiable per
 *   Google Identity Services brand guidelines (10-UI-SPEC §Color).
 */

import { captureCurrentPreAuthRoute } from './auth-callback-overlay.js';

let modalEl = null;
let escHandler = null;
let resendIntervalId = null;

// 30-second cooldown between magic-link sends (D-12, UI-SPEC §2)
const RESEND_COOLDOWN_MS = 30_000;

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

  // Body (idle state) -------------------------------------------------------
  const body = document.createElement('div');
  body.id = 'cf-auth-body';
  body.setAttribute('aria-live', 'polite');
  _renderIdleBody(body);
  card.appendChild(body);

  modalEl.appendChild(card);
  document.body.appendChild(modalEl);

  // X close -----------------------------------------------------------------
  card.querySelector('#cf-auth-close').addEventListener('click', closeAuthModal);

  // Escape handler ----------------------------------------------------------
  escHandler = (e) => { if (e.key === 'Escape') closeAuthModal(); };
  document.addEventListener('keydown', escHandler);

  // Autofocus email input (D-08 UX — keyboard-first user is always email-flow)
  const emailInput = card.querySelector('#cf-auth-email');
  if (emailInput && typeof emailInput.focus === 'function') {
    try { emailInput.focus(); } catch { /* ignore */ }
  }

  // Wire idle-state handlers
  _wireIdleHandlers(AlpineObj);
}

export function closeAuthModal() {
  if (!modalEl) return;
  if (escHandler) {
    document.removeEventListener('keydown', escHandler);
    escHandler = null;
  }
  if (resendIntervalId) {
    clearInterval(resendIntervalId);
    resendIntervalId = null;
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
// Idle-state rendering
// ---------------------------------------------------------------------------

function _renderIdleBody(body) {
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

    <!-- Inline validation error slot -->
    <div id="cf-auth-email-error" style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:400;color:#E23838;min-height:0;margin-top:4px;"></div>

    <!-- SEND MAGIC LINK button -->
    <button id="cf-auth-send-magic" disabled
      style="width:100%;height:40px;margin-top:16px;background:#1C1F28;color:#4A5064;border:none;cursor:not-allowed;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;"
    >SEND MAGIC LINK</button>

    <!-- Helper text -->
    <p style="margin:12px 0 0 0;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:400;letter-spacing:0.05em;color:#7A8498;">We'll send you a one-time link. No password needed.</p>
  `;
}

function _wireIdleHandlers(AlpineObj) {
  const input = modalEl.querySelector('#cf-auth-email');
  const sendBtn = modalEl.querySelector('#cf-auth-send-magic');
  const errorSlot = modalEl.querySelector('#cf-auth-email-error');
  const googleBtn = modalEl.querySelector('#cf-auth-google');
  const googleLabel = modalEl.querySelector('#cf-auth-google-label');

  function setSendEnabled(enabled) {
    sendBtn.disabled = !enabled;
    if (enabled) {
      sendBtn.style.background = '#0D52BD';
      sendBtn.style.color = '#EAECEE';
      sendBtn.style.cursor = 'pointer';
    } else {
      sendBtn.style.background = '#1C1F28';
      sendBtn.style.color = '#4A5064';
      sendBtn.style.cursor = 'not-allowed';
    }
  }

  input.addEventListener('input', () => {
    const email = input.value.trim();
    const valid = EMAIL_RE.test(email);
    setSendEnabled(valid);
    // Clear inline error on any input
    if (errorSlot) errorSlot.textContent = '';
  });

  input.addEventListener('blur', () => {
    const email = input.value.trim();
    if (email.length > 0 && !EMAIL_RE.test(email)) {
      if (errorSlot) errorSlot.textContent = 'Enter a valid email address.';
    }
  });

  sendBtn.addEventListener('click', async () => {
    const email = input.value.trim();
    if (!EMAIL_RE.test(email)) return;

    sendBtn.textContent = 'SENDING…';
    sendBtn.disabled = true;
    input.disabled = true;
    googleBtn.disabled = true;

    // Capture pre-auth route BEFORE triggering signInMagic (D-11).
    try { captureCurrentPreAuthRoute(); } catch { /* ignore */ }

    const auth = AlpineObj?.store?.('auth');
    const toast = AlpineObj?.store?.('toast');
    let result;
    try {
      result = await auth?.signInMagic(email);
    } catch (err) {
      result = { error: err };
    }

    if (result && result.error) {
      const msg = String(result.error?.message || result.error || '');
      if (/rate.?limit/i.test(msg)) {
        toast?.warning?.('Magic link blocked — too many attempts. Wait a minute and try again.');
      } else {
        toast?.error?.("Couldn't send magic link. Check your connection and try again.");
      }
      // Re-enable idle form
      sendBtn.textContent = 'SEND MAGIC LINK';
      input.disabled = false;
      googleBtn.disabled = false;
      setSendEnabled(EMAIL_RE.test(input.value.trim()));
      return;
    }

    // Success — swap body to CHECK YOUR INBOX state (D-12).
    toast?.info?.('Magic link sent. Check your inbox.');
    _swapToSentState(email, AlpineObj);
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
      // Brief grace window — the OAuth popup may legitimately take >2s on slow networks.
      setTimeout(() => {
        if (auth?.status === 'anonymous' && modalEl) {
          toast?.info?.('Google sign-in cancelled. Try again or use a magic link.');
          if (googleLabel) googleLabel.textContent = 'SIGN IN WITH GOOGLE';
          googleBtn.disabled = false;
        }
      }, 2000);
    }
    // On success, the browser navigates to Google — modal stays open until
    // the callback overlay takes over on return. We do NOT close here.
  });
}

// ---------------------------------------------------------------------------
// Magic-link sent state (D-12)
// ---------------------------------------------------------------------------

function _swapToSentState(email, AlpineObj) {
  const body = modalEl.querySelector('#cf-auth-body');
  if (!body) return;

  body.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;padding-top:16px;">
      <span class="material-symbols-outlined" style="font-size:48px;color:#F39C12;margin-bottom:24px;">mail</span>
      <h3 style="font-family:'Syne',sans-serif;font-size:20px;font-weight:700;color:#EAECEE;letter-spacing:0.01em;text-transform:uppercase;margin:0 0 16px 0;text-align:center;">CHECK YOUR INBOX</h3>
      <p style="font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:400;color:#EAECEE;line-height:1.5;margin:0 0 16px 0;text-align:center;">We sent a link to ${_escapeHtml(email)}. Click it to sign in.</p>
      <p style="font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:400;color:#7A8498;line-height:1.5;margin:0 0 24px 0;text-align:center;">Close this modal and keep working — your session will activate automatically when you click the link.</p>
      <div style="display:flex;gap:8px;width:100%;">
        <button id="cf-auth-close-modal" style="flex:1;height:40px;background:#1C1F28;color:#EAECEE;border:1px solid #2A2D3A;cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;">CLOSE MODAL</button>
        <button id="cf-auth-resend" aria-disabled="true" style="flex:1;height:40px;background:#1C1F28;color:#7A8498;border:1px solid #2A2D3A;cursor:not-allowed;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:400;letter-spacing:0.15em;text-transform:uppercase;">RESEND IN 30s</button>
      </div>
    </div>
  `;

  body.querySelector('#cf-auth-close-modal').addEventListener('click', closeAuthModal);

  // Wall-clock anchored 30s cooldown (UI-SPEC §Motion — immune to background-tab throttling).
  const sentAt = Date.now();
  _startResendCountdown(sentAt, email, AlpineObj);
}

function _startResendCountdown(sentAt, email, AlpineObj) {
  if (resendIntervalId) clearInterval(resendIntervalId);

  const tick = () => {
    const btn = modalEl?.querySelector('#cf-auth-resend');
    if (!btn) return;
    const elapsedMs = Date.now() - sentAt;
    const remaining = Math.max(0, Math.ceil((RESEND_COOLDOWN_MS - elapsedMs) / 1000));

    if (remaining > 0) {
      btn.textContent = `RESEND IN ${remaining}s`;
      btn.setAttribute('aria-disabled', 'true');
      btn.setAttribute('aria-label', `Resend magic link — available in ${remaining} seconds`);
      btn.style.cursor = 'not-allowed';
      btn.style.color = '#7A8498';
    } else {
      btn.textContent = 'RESEND MAGIC LINK';
      btn.removeAttribute('aria-disabled');
      btn.setAttribute('aria-label', 'Resend magic link');
      btn.style.cursor = 'pointer';
      btn.style.color = '#EAECEE';
      // Wire click once (idempotent — replaceWith clone resets listeners on each transition)
      btn.onclick = async () => {
        btn.textContent = 'SENDING…';
        btn.setAttribute('aria-disabled', 'true');
        btn.style.cursor = 'not-allowed';
        const auth = AlpineObj?.store?.('auth');
        const toast = AlpineObj?.store?.('toast');
        let result;
        try {
          result = await auth?.signInMagic(email);
        } catch (err) {
          result = { error: err };
        }
        if (result && result.error) {
          const msg = String(result.error?.message || result.error || '');
          if (/rate.?limit/i.test(msg)) {
            toast?.warning?.('Magic link blocked — too many attempts. Wait a minute and try again.');
          } else {
            toast?.error?.("Couldn't send magic link. Check your connection and try again.");
          }
          btn.textContent = 'RESEND MAGIC LINK';
          btn.removeAttribute('aria-disabled');
          btn.style.cursor = 'pointer';
          return;
        }
        toast?.info?.('Fresh magic link on the way.');
        // Restart countdown
        _startResendCountdown(Date.now(), email, AlpineObj);
      };
      // Stop ticking — next restart is driven by click.
      if (resendIntervalId) {
        clearInterval(resendIntervalId);
        resendIntervalId = null;
      }
    }
  };

  // Immediate paint + 1s polling (wall-clock anchored via Date.now snapshot).
  tick();
  resendIntervalId = setInterval(tick, 1000);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function _escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Expose globally so sidebar + settings templates can invoke via
// `@click="window.__openAuthModal && window.__openAuthModal()"` (pattern
// matches existing `window.__openSettingsModal`).
if (typeof window !== 'undefined') {
  window.__openAuthModal = openAuthModal;
}
