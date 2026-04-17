// src/components/first-sign-in-prompt.js
//
// Phase 10 Plan 4 — first-sign-in profile migration prompt (D-16..D-20).
//
// Triggered once per user, on the first authed + cloud-row-missing + non-empty
// local-profile case. This is the single moment when v1.0 local-profile data
// (name + avatar stored in localStorage) gets offered up to the freshly-created
// cloud row — or discarded in favour of the OAuth-derived identity.
//
// Non-dismissible by design (D-16):
//   - Escape key disabled
//   - Backdrop click disabled
//   - No X close button
// Two CTAs only:
//   KEEP LOCAL PROFILE → upsert localStorage values into counterflux.profile
//   START FRESH        → upsert a minimal row from OAuth identity (localStorage
//                        preserved either way — D-19 — so sign-out still reverts
//                        to the pre-existing local profile)
//
// Z-index 70 — sits ABOVE both settings-modal (60) and auth-modal (60) because
// the cascade of "first sign-in lands → callback overlay → this prompt" can
// potentially overlap the auth-callback-overlay z-80 at the tail end; we render
// below the overlay on purpose so the overlay's "SIGNED IN" flash stays visible
// during the 200ms the overlay unmounts before this prompt mounts.
//
// Accessibility contract: role="dialog", aria-modal="true",
// aria-labelledby="welcome-back-heading", aria-describedby="welcome-back-body".

let promptEl = null;

const STORAGE_KEY = 'cf_profile';

function hasLocalProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return !!(data.name || data.avatar);
  } catch { return false; }
}

function readLocalProfile() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

/**
 * Main entry point — called from src/main.js Alpine.effect hook after hydrate resolves.
 *
 * Returns a Promise that resolves when the prompt is dismissed OR when no prompt
 * was needed. Safe to call repeatedly; all guards are idempotent.
 *
 * Guards (order matters):
 *   1. Not authed → bail (effect will re-fire on auth.status flip)
 *   2. Profile not yet hydrated → bail (too early; effect will re-fire)
 *   3. Cloud row already exists (profile._source === 'cloud') → bail (user
 *      already migrated in a prior session)
 *   4. No local profile → silent upsert (D-20 — fresh user, no migration UI)
 *   5. Already open → bail (don't stack modals)
 */
export async function maybeShowFirstSignInPrompt() {
  const Alpine = window.Alpine;
  if (!Alpine) return;
  const auth = Alpine.store('auth');
  const profile = Alpine.store('profile');

  if (auth?.status !== 'authed') return;                  // Guard 1
  if (!profile?._loaded) return;                          // Guard 2
  if (profile?._source === 'cloud') return;               // Guard 3
  if (!hasLocalProfile()) {                               // Guard 4 — D-20
    await _silentFreshUpsert();
    return;
  }
  if (promptEl) return;                                    // Guard 5

  _mountPrompt();
}

async function _silentFreshUpsert() {
  const Alpine = window.Alpine;
  const auth = Alpine.store('auth');
  const profile = Alpine.store('profile');
  const u = auth?.user;
  if (!u) return;
  const derivedName = u.user_metadata?.given_name
    || u.user_metadata?.full_name
    || (u.email ? u.email.split('@')[0] : '');
  // Force _source to cloud so update() upserts to Supabase.
  profile._source = 'cloud';
  profile.name = derivedName;
  profile.avatar_url_override = '';
  profile.email = u.email || '';
  const res = await profile.update({ name: derivedName, avatar_url_override: '' });
  if (res?.error) {
    Alpine.store('toast')?.error("Couldn't save profile to cloud. Working locally for now.");
    profile._source = 'local';
  }
}

function _mountPrompt() {
  const Alpine = window.Alpine;
  const auth = Alpine.store('auth');
  const local = readLocalProfile();

  promptEl = document.createElement('div');
  promptEl.id = 'cf-first-sign-in-prompt';
  promptEl.style.cssText = 'position:fixed;inset:0;background:rgba(11,12,16,0.95);z-index:70;display:flex;align-items:center;justify-content:center;font-family:"Space Grotesk",system-ui,sans-serif;color:#EAECEE;';
  // D-16 lockdown: backdrop click is a no-op. We still install the handler so
  // we explicitly prevent the default (in case another listener would close us)
  // and to make the lockdown intent obvious in source.
  promptEl.addEventListener('click', (e) => { if (e.target === promptEl) e.preventDefault(); });

  promptEl.setAttribute('role', 'dialog');
  promptEl.setAttribute('aria-modal', 'true');
  promptEl.setAttribute('aria-labelledby', 'welcome-back-heading');
  promptEl.setAttribute('aria-describedby', 'welcome-back-body');

  const card = document.createElement('div');
  card.style.cssText = 'max-width:440px;width:100%;padding:32px;background:#14161C;border:1px solid #2A2D3A;box-shadow:0 8px 32px rgba(0,0,0,0.5);';

  const email = auth.user?.email || '';
  const initialsLetters = (local.name || '?').split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2);
  const avatarHtml = local.avatar
    ? `<img src="${_attr(local.avatar)}" style="width:56px;height:56px;object-fit:cover;border:1px solid #2A2D3A;">`
    : `<div style="width:56px;height:56px;background:#1C1F28;border:1px solid #2A2D3A;display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-size:20px;font-weight:700;color:#7A8498;">${_escape(initialsLetters)}</div>`;

  card.innerHTML = `
    <h2 id="welcome-back-heading" style="font-family:'Syne',sans-serif;font-size:20px;font-weight:700;letter-spacing:0.01em;text-transform:uppercase;margin:0 0 24px 0;color:#EAECEE;">WELCOME BACK</h2>

    <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">
      ${avatarHtml}
      <div style="display:flex;flex-direction:column;min-width:0;">
        <span style="font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:700;color:#EAECEE;">${_escape(local.name || 'Unnamed')}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:400;letter-spacing:0.15em;text-transform:uppercase;color:#7A8498;">SIGNED IN AS</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#7A8498;">${_escape(email)}</span>
      </div>
    </div>

    <p id="welcome-back-body" style="font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:400;color:#EAECEE;margin:0 0 24px 0;line-height:1.5;">You had a local profile before signing in. Keep using it for your new account, or start fresh?</p>

    <button id="first-signin-keep" style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;background:#0D52BD;color:#EAECEE;border:none;width:100%;height:40px;cursor:pointer;margin-bottom:16px;">KEEP LOCAL PROFILE</button>

    <button id="first-signin-fresh" style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;background:#1C1F28;color:#EAECEE;border:1px solid #2A2D3A;width:100%;height:40px;cursor:pointer;margin-bottom:24px;">START FRESH</button>

    <p style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:400;letter-spacing:0.15em;text-transform:uppercase;color:#7A8498;margin:0;line-height:1.3;">Mila will keep your local profile either way — you can still sign out and revert.</p>
  `;

  promptEl.appendChild(card);
  document.body.appendChild(promptEl);

  // D-16 lockdown: Escape is a no-op. Capture-phase listener so we can block
  // any downstream Escape handlers (e.g. a still-open settings-modal escape
  // binding) from firing while the prompt is up.
  const escBlocker = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  document.addEventListener('keydown', escBlocker, /* capture */ true);
  promptEl._escBlocker = escBlocker;

  // Wire CTAs
  card.querySelector('#first-signin-keep').addEventListener('click', async () => {
    const profile = Alpine.store('profile');
    profile._source = 'cloud';
    const res = await profile.update({
      name: local.name || '',
      avatar_url_override: local.avatar || '',
    });
    if (res?.error) {
      Alpine.store('toast')?.error("Couldn't save profile to cloud. Working locally for now.");
      profile._source = 'local';
    } else {
      Alpine.store('toast')?.success('Profile synced to cloud.');
    }
    _unmountPrompt();
  });

  card.querySelector('#first-signin-fresh').addEventListener('click', async () => {
    const profile = Alpine.store('profile');
    const u = auth.user;
    const derivedName = u.user_metadata?.given_name
      || u.user_metadata?.full_name
      || (u.email ? u.email.split('@')[0] : '');
    profile._source = 'cloud';
    profile.name = derivedName;
    profile.avatar_url_override = '';
    const res = await profile.update({ name: derivedName, avatar_url_override: '' });
    if (res?.error) {
      Alpine.store('toast')?.error("Couldn't save profile to cloud. Working locally for now.");
      profile._source = 'local';
    } else {
      Alpine.store('toast')?.success('Cloud profile created.');
    }
    _unmountPrompt();
  });
}

function _unmountPrompt() {
  if (!promptEl) return;
  if (promptEl._escBlocker) document.removeEventListener('keydown', promptEl._escBlocker, /* capture */ true);
  promptEl.remove();
  promptEl = null;
}

/** Test-only reset. Ensures a clean slate between tests. */
export function __resetFirstSignInPrompt() {
  _unmountPrompt();
}

function _escape(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function _attr(s) { return _escape(s); }
