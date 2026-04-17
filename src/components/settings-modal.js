/**
 * Settings modal — profile management.
 *
 * Phase 10 Plan 4 refactor (D-13, D-14, D-22):
 *   Branches on Alpine.store('auth').status at open time:
 *     'anonymous' → signed-out body (today's form + new Sync CTA card at top + noun-anchored CTAs)
 *     'authed'    → signed-in body (SIGNED IN AS email chip + avatar + DISPLAY NAME
 *                   + SAVE PROFILE/DISCARD CHANGES + SIGN OUT)
 *
 * Noun-anchored CTAs (UI-SPEC Copywriting contract): SAVE PROFILE / DISCARD CHANGES
 * instead of bare SAVE / CANCEL across both states.
 *
 * D-22 (sign-out preserves local Dexie data): the SIGN OUT handler MUST NOT
 * touch any Dexie table (collection, decks, deck_cards, games, watchlist,
 * profile). Only Alpine.store('auth').signOut() is called. This file is
 * grep-gated by tests/settings-modal-auth.test.js Test 8 — the pattern
 * `db\.(collection|decks|deck_cards|games|watchlist|profile)` must NOT
 * match anywhere in this source.
 *
 * Accessible from the sidebar profile widget (Alpine.data sidebarComponent
 * profileWidgetClick — anonymous state opens auth-modal, authed state opens
 * this settings modal).
 */

let modalEl = null;

export function openSettingsModal() {
  if (modalEl) return;
  const Alpine = window.Alpine;
  const profile = Alpine.store('profile');
  const auth = Alpine.store('auth');
  const authed = auth?.status === 'authed';

  modalEl = document.createElement('div');
  modalEl.id = 'cf-settings-modal';
  modalEl.style.cssText = 'position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:rgba(11,12,16,0.85);';
  modalEl.addEventListener('click', (e) => { if (e.target === modalEl) closeSettingsModal(); });

  const card = document.createElement('div');
  card.style.cssText = 'background:#14161C;border:1px solid #2A2D3A;padding:32px;width:100%;max-width:420px;';

  // Header (identical in both states)
  card.appendChild(_buildHeader());

  if (authed) {
    _buildSignedInBody(card, profile, auth);
  } else {
    _buildSignedOutBody(card, profile);
  }

  modalEl.appendChild(card);
  document.body.appendChild(modalEl);

  card.querySelector('#settings-close').addEventListener('click', closeSettingsModal);

  // Escape to close
  const escHandler = (e) => { if (e.key === 'Escape') closeSettingsModal(); };
  document.addEventListener('keydown', escHandler);
  modalEl._escHandler = escHandler;
}

export function closeSettingsModal() {
  if (!modalEl) return;
  if (modalEl._escHandler) document.removeEventListener('keydown', modalEl._escHandler);
  modalEl.remove();
  modalEl = null;
}

// --- Header (shared) ---
function _buildHeader() {
  const h = document.createElement('div');
  h.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;';
  h.innerHTML = `
    <h2 style="font-family:'Syne',sans-serif;font-size:20px;font-weight:700;color:#EAECEE;letter-spacing:0.01em;text-transform:uppercase;">SETTINGS</h2>
    <button id="settings-close" aria-label="Close settings" style="background:none;border:none;color:#7A8498;cursor:pointer;font-size:24px;">
      <span class="material-symbols-outlined">close</span>
    </button>
  `;
  return h;
}

// --- Signed-out body (D-14) ---
function _buildSignedOutBody(card, profile) {
  // 1. Sync CTA card at top
  const syncCard = document.createElement('div');
  syncCard.style.cssText = 'background:#1C1F28;border:1px solid #0D52BD;padding:24px;margin-bottom:24px;';
  syncCard.innerHTML = `
    <h3 style="font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:700;color:#EAECEE;margin:0 0 8px 0;">Sign in to sync across devices</h3>
    <p style="font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:400;color:#7A8498;margin:0 0 16px 0;line-height:1.5;">Your collection, decks, and games stay on this device — but you can sync them to the cloud.</p>
    <button id="settings-sync-cta" style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;background:#0D52BD;color:#EAECEE;border:none;width:100%;height:40px;cursor:pointer;">SIGN IN TO SYNC</button>
  `;
  card.appendChild(syncCard);

  // 2. Avatar row
  card.appendChild(_buildAvatarRow(profile, /* authed */ false, null));

  // 3. Display name + email inputs
  card.appendChild(_buildField('DISPLAY NAME', 'settings-name', profile.name, 'Your name'));
  card.appendChild(_buildField('EMAIL', 'settings-email', profile.email, 'your@email.com'));

  // 4. Action row (noun-anchored: SAVE PROFILE / DISCARD CHANGES)
  card.appendChild(_buildActionRow(profile, /* authed */ false));

  // Wire Sync CTA
  card.querySelector('#settings-sync-cta').addEventListener('click', () => {
    closeSettingsModal();
    if (typeof window.__openAuthModal === 'function') window.__openAuthModal();
  });
}

// --- Signed-in body (D-13) ---
function _buildSignedInBody(card, profile, auth) {
  const googleAvatar = auth.user?.user_metadata?.avatar_url || null;

  // 1. SIGNED IN AS chip (read-only email)
  const email = auth.user?.email || '';
  const chipWrap = document.createElement('div');
  chipWrap.style.cssText = 'margin-bottom:24px;';
  chipWrap.innerHTML = `
    <label style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#7A8498;display:block;margin-bottom:8px;">SIGNED IN AS</label>
    <div id="settings-email-chip" style="font-family:'Space Grotesk',sans-serif;font-size:14px;color:#EAECEE;background:#0B0C10;border:1px solid #2A2D3A;padding:8px 12px;height:32px;display:flex;align-items:center;">${_escape(email)}</div>
  `;
  card.appendChild(chipWrap);

  // 2. Avatar row (with conditional USE GOOGLE AVATAR button — D-15)
  card.appendChild(_buildAvatarRow(profile, /* authed */ true, googleAvatar));

  // 3. DISPLAY NAME
  card.appendChild(_buildField('DISPLAY NAME', 'settings-name', profile.name, 'Your name'));

  // 4. Action row (SAVE PROFILE / DISCARD CHANGES — noun-anchored)
  card.appendChild(_buildActionRow(profile, /* authed */ true));

  // 5. Separator rule
  const sep = document.createElement('div');
  sep.style.cssText = 'border-top:1px solid #2A2D3A;margin:24px 0;';
  card.appendChild(sep);

  // 6. SIGN OUT button (D-22 — handler is auth-only, touches NO Dexie tables)
  const signOutBtn = document.createElement('button');
  signOutBtn.id = 'settings-signout';
  signOutBtn.textContent = 'SIGN OUT';
  signOutBtn.setAttribute('aria-label', 'Sign out');
  signOutBtn.style.cssText = "font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;background:transparent;color:#E23838;border:1px solid #2A2D3A;width:100%;height:40px;cursor:pointer;transition:box-shadow 120ms ease-out,background 120ms ease-out;";
  signOutBtn.addEventListener('mouseenter', () => {
    signOutBtn.style.boxShadow = '0 0 8px rgba(226,56,56,0.25)';
    signOutBtn.style.background = 'rgba(226,56,56,0.1)';
  });
  signOutBtn.addEventListener('mouseleave', () => {
    signOutBtn.style.boxShadow = '';
    signOutBtn.style.background = 'transparent';
  });
  signOutBtn.addEventListener('click', async () => {
    // D-22: auth-only. Do NOT touch any Dexie table here. Sign-out preserves
    // all local collection/decks/games data so the user can keep working and
    // sign back in later with zero data loss.
    const Alpine = window.Alpine;
    const res = await Alpine.store('auth').signOut();
    closeSettingsModal();
    if (res?.error) {
      Alpine.store('toast')?.error("Couldn't sign out. Check your connection and try again.");
    } else {
      Alpine.store('toast')?.success('Signed out. Your data stays on this device.');
    }
  });
  card.appendChild(signOutBtn);

  // Wire USE GOOGLE AVATAR button (if present — D-15)
  const useGoogleBtn = card.querySelector('#settings-use-google-avatar');
  if (useGoogleBtn) {
    useGoogleBtn.addEventListener('click', async () => {
      const Alpine = window.Alpine;
      await profile.clearAvatarOverride();
      _renderAvatar(card.querySelector('#settings-avatar-preview'), profile);
      Alpine.store('toast')?.success('Google avatar applied.');
    });
  }
}

// --- Shared avatar row (D-15 conditional Google button) ---
function _buildAvatarRow(profile, authed, googleAvatar) {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:16px;margin-bottom:24px;';

  const preview = document.createElement('div');
  preview.id = 'settings-avatar-preview';
  _renderAvatar(preview, profile);
  row.appendChild(preview);

  const controls = document.createElement('div');
  // D-15: USE GOOGLE AVATAR button is conditionally rendered — ONLY when the
  // authed user has a Google-provided avatar_url in user_metadata. Magic-link
  // users never see this button (not disabled, not hidden — physically absent).
  const googleBtnHtml = (authed && googleAvatar) ? `
    <button id="settings-use-google-avatar" style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;background:#1C1F28;color:#EAECEE;border:1px solid #2A2D3A;padding:4px 8px;cursor:pointer;margin-left:8px;">USE GOOGLE AVATAR</button>
  ` : '';
  controls.innerHTML = `
    <label style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#0D52BD;cursor:pointer;display:inline-block;padding:4px 8px;border:1px solid #2A2D3A;background:#1C1F28;">
      UPLOAD PHOTO
      <input type="file" id="settings-avatar-input" accept="image/*" style="display:none;">
    </label>
    ${googleBtnHtml}
    <button id="settings-avatar-clear" style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:400;letter-spacing:0.15em;text-transform:uppercase;color:#7A8498;cursor:pointer;background:none;border:none;margin-left:8px;">REMOVE</button>
  `;
  row.appendChild(controls);

  // Wire file-input + remove (deferred so DOM is attached)
  setTimeout(() => {
    const input = row.querySelector('#settings-avatar-input');
    const clear = row.querySelector('#settings-avatar-clear');
    if (input) {
      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 500000) {
          window.Alpine.store('toast')?.warning('Image too large — max 500KB.');
          return;
        }
        const reader = new FileReader();
        reader.onload = async () => {
          await profile.setAvatarOverride(reader.result);
          _renderAvatar(row.querySelector('#settings-avatar-preview'), profile);
        };
        reader.readAsDataURL(file);
      });
    }
    if (clear) {
      clear.addEventListener('click', async () => {
        await profile.setAvatarOverride('');
        // In v1.0 this also cleared profile.avatar; keep that for back-compat.
        await profile.update({ avatar: '' });
        _renderAvatar(row.querySelector('#settings-avatar-preview'), profile);
      });
    }
  }, 0);

  return row;
}

function _buildField(label, id, value, placeholder) {
  const group = document.createElement('div');
  group.style.cssText = 'margin-bottom:16px;';
  group.innerHTML = `
    <label for="${id}" style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#0D52BD;display:block;margin-bottom:8px;">${label}</label>
    <input type="text" id="${id}" value="${value ? String(value).replace(/"/g, '&quot;') : ''}" placeholder="${placeholder}"
      style="width:100%;box-sizing:border-box;font-family:'Space Grotesk',sans-serif;font-size:14px;background:#0B0C10;border:1px solid #2A2D3A;color:#EAECEE;padding:8px 12px;height:40px;">
  `;
  return group;
}

function _buildActionRow(profile, authed) {
  const row = document.createElement('div');
  row.style.cssText = 'margin-top:24px;display:flex;gap:8px;';
  row.innerHTML = `
    <button id="settings-save" style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;background:#0D52BD;color:#EAECEE;border:none;padding:8px 24px;cursor:pointer;height:40px;flex:1;">SAVE PROFILE</button>
    <button id="settings-cancel" style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;background:#1C1F28;color:#EAECEE;border:1px solid #2A2D3A;padding:8px 24px;cursor:pointer;height:40px;flex:1;">DISCARD CHANGES</button>
  `;
  const priorName = profile.name;
  const priorEmail = profile.email;
  setTimeout(() => {
    const saveBtn = row.querySelector('#settings-save');
    const cancelBtn = row.querySelector('#settings-cancel');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const Alpine = window.Alpine;
        const nameInput = document.getElementById('settings-name');
        const emailInput = document.getElementById('settings-email');
        const fields = { name: (nameInput?.value || '').trim() };
        if (!authed && emailInput) fields.email = emailInput.value.trim();
        const res = await profile.update(fields);
        if (res?.error) {
          Alpine.store('toast')?.error("Couldn't save profile. Check your connection and try again.");
        } else {
          Alpine.store('toast')?.success('Profile updated.');
          closeSettingsModal();
        }
      });
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        const nameInput = document.getElementById('settings-name');
        const emailInput = document.getElementById('settings-email');
        if (nameInput) nameInput.value = priorName || '';
        if (emailInput) emailInput.value = priorEmail || '';
        closeSettingsModal();
      });
    }
  }, 0);
  return row;
}

function _renderAvatar(container, profile) {
  const url = profile.effectiveAvatarUrl;
  if (url) {
    container.innerHTML = `<img src="${url}" style="width:56px;height:56px;object-fit:cover;border:1px solid #2A2D3A;">`;
  } else {
    container.innerHTML = `
      <div style="width:56px;height:56px;background:#1C1F28;border:1px solid #2A2D3A;display:flex;align-items:center;justify-content:center;">
        <span style="font-family:'Syne',sans-serif;font-size:20px;font-weight:700;color:#7A8498;">${profile.initials}</span>
      </div>
    `;
  }
}

function _escape(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
