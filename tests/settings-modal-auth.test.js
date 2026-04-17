// @vitest-environment jsdom
// tests/settings-modal-auth.test.js
// Phase 10 Plan 4 — auth-aware settings modal contract tests (D-13, D-14, D-22).
//
// Covers 10 behaviours:
//   1. Signed-out: Sync CTA card at top with SIGN IN TO SYNC → closes + opens auth-modal
//   2. Signed-out: action row uses SAVE PROFILE / DISCARD CHANGES (noun-anchored)
//   3. Signed-out: email field still editable
//   4. Signed-in: read-only SIGNED IN AS email chip
//   5. Signed-in (magic-link / no Google avatar): USE GOOGLE AVATAR button absent
//   6. Signed-in (Google user): USE GOOGLE AVATAR present; click → clearAvatarOverride + toast
//   7. Signed-in: SIGN OUT button present; click → auth.signOut + close modal + toast
//   8. D-22 regression: SIGN OUT handler does NOT touch Dexie db.*
//   9. Signed-in: SAVE PROFILE calls profile.update
//  10. Signed-in: DISCARD CHANGES reverts + closes

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// vi.mock prevents the settings-modal module from trying to resolve anything unusual.
// It uses window.Alpine at runtime so no module mocks needed.

let openSettingsModal, closeSettingsModal;

function installDOM() {
  if (typeof globalThis.document === 'undefined') {
    // jsdom env is configured via vitest.config — fall back to a minimal stub
    throw new Error('jsdom env required');
  }
}

function setAlpine({ authStatus = 'anonymous', user = null, profileFields = {}, googleAvatarUrl = null, toastCalls = null } = {}) {
  const profileBase = {
    name: '',
    email: '',
    avatar: '',
    avatar_url_override: '',
    _source: authStatus === 'authed' ? 'cloud' : 'local',
    _loaded: true,
    get initials() { return (this.name || '?').split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2); },
    get effectiveAvatarUrl() {
      if (this.avatar_url_override) return this.avatar_url_override;
      const u = window.Alpine.store('auth').user;
      if (u?.user_metadata?.avatar_url) return u.user_metadata.avatar_url;
      if (this.avatar) return this.avatar;
      return '';
    },
    update: vi.fn(async (fields) => {
      Object.assign(profileBase, fields);
      return { error: null };
    }),
    setAvatarOverride: vi.fn(async (v) => { profileBase.avatar_url_override = v; return { error: null }; }),
    clearAvatarOverride: vi.fn(async () => { profileBase.avatar_url_override = ''; return { error: null }; }),
    ...profileFields,
  };

  const authUser = user || (authStatus === 'authed'
    ? { id: 'u1', email: 'user@test.dev', user_metadata: googleAvatarUrl ? { avatar_url: googleAvatarUrl } : {} }
    : null);

  const authStub = {
    status: authStatus,
    user: authUser,
    signOut: vi.fn(async () => ({ error: null })),
  };

  const toastStub = {
    success: toastCalls?.success || vi.fn(),
    error: toastCalls?.error || vi.fn(),
    warning: toastCalls?.warning || vi.fn(),
    info: toastCalls?.info || vi.fn(),
  };

  const stores = { profile: profileBase, auth: authStub, toast: toastStub };

  window.Alpine = {
    store: (name, value) => {
      if (value !== undefined) stores[name] = value;
      return stores[name];
    },
  };

  return { stores, profileBase, authStub, toastStub };
}

beforeEach(async () => {
  installDOM();
  document.body.innerHTML = '';
  vi.resetModules();
  const mod = await import('../src/components/settings-modal.js');
  openSettingsModal = mod.openSettingsModal;
  closeSettingsModal = mod.closeSettingsModal;
  // Global window.__openAuthModal stub; individual tests can overwrite
  window.__openAuthModal = vi.fn();
});

afterEach(() => {
  if (closeSettingsModal) closeSettingsModal();
  document.body.innerHTML = '';
});

describe('settings modal — signed-out branch (D-14)', () => {
  test('Test 1: signed-out shows Sync CTA card at top; click SIGN IN TO SYNC closes + calls __openAuthModal', async () => {
    setAlpine({ authStatus: 'anonymous' });
    openSettingsModal();

    const modal = document.querySelector('#cf-settings-modal');
    expect(modal).toBeTruthy();
    expect(modal.textContent).toContain('Sign in to sync across devices');
    expect(modal.textContent).toContain('Your collection, decks, and games stay on this device');
    expect(modal.textContent).toContain('SIGN IN TO SYNC');

    const cta = modal.querySelector('#settings-sync-cta');
    expect(cta).toBeTruthy();
    cta.click();
    // Modal closed
    expect(document.querySelector('#cf-settings-modal')).toBeFalsy();
    // Auth modal opened
    expect(window.__openAuthModal).toHaveBeenCalled();
  });

  test('Test 2: signed-out uses SAVE PROFILE / DISCARD CHANGES (noun-anchored)', () => {
    setAlpine({ authStatus: 'anonymous' });
    openSettingsModal();

    const modal = document.querySelector('#cf-settings-modal');
    expect(modal.textContent).toContain('SAVE PROFILE');
    expect(modal.textContent).toContain('DISCARD CHANGES');
    // Make sure no bare SAVE or CANCEL button text remains
    const saveBtn = modal.querySelector('#settings-save');
    const cancelBtn = modal.querySelector('#settings-cancel');
    expect(saveBtn.textContent.trim()).toBe('SAVE PROFILE');
    expect(cancelBtn.textContent.trim()).toBe('DISCARD CHANGES');
  });

  test('Test 3: signed-out email field is editable', () => {
    setAlpine({ authStatus: 'anonymous' });
    openSettingsModal();

    const modal = document.querySelector('#cf-settings-modal');
    const emailInput = modal.querySelector('#settings-email');
    expect(emailInput).toBeTruthy();
    expect(emailInput.tagName).toBe('INPUT');
    expect(emailInput.type).toBe('text');
    expect(emailInput.readOnly).toBe(false);
    expect(emailInput.disabled).toBe(false);
  });
});

describe('settings modal — signed-in branch (D-13)', () => {
  test('Test 4: signed-in renders read-only SIGNED IN AS chip with user email', () => {
    setAlpine({ authStatus: 'authed' });
    openSettingsModal();

    const modal = document.querySelector('#cf-settings-modal');
    expect(modal.textContent).toContain('SIGNED IN AS');
    expect(modal.textContent).toContain('user@test.dev');

    // No editable email input in signed-in mode
    const emailInput = modal.querySelector('#settings-email');
    expect(emailInput).toBeFalsy();
  });

  test('Test 5 (D-15): magic-link user sees UPLOAD PHOTO + REMOVE only, NO USE GOOGLE AVATAR', () => {
    // magic-link user has user_metadata without avatar_url
    setAlpine({
      authStatus: 'authed',
      user: { id: 'u1', email: 'magic@test.dev', user_metadata: {} },
    });
    openSettingsModal();

    const modal = document.querySelector('#cf-settings-modal');
    expect(modal.textContent).toContain('UPLOAD PHOTO');
    expect(modal.textContent).toContain('REMOVE');
    expect(modal.textContent).not.toContain('USE GOOGLE AVATAR');

    const googleBtn = modal.querySelector('#settings-use-google-avatar');
    expect(googleBtn).toBeFalsy();
  });

  test('Test 6 (D-15): Google user sees USE GOOGLE AVATAR button; click calls clearAvatarOverride + fires toast', async () => {
    const toastSuccess = vi.fn();
    const { profileBase } = setAlpine({
      authStatus: 'authed',
      googleAvatarUrl: 'https://lh3.googleusercontent.com/me.jpg',
      toastCalls: { success: toastSuccess },
    });

    openSettingsModal();
    const modal = document.querySelector('#cf-settings-modal');
    const googleBtn = modal.querySelector('#settings-use-google-avatar');
    expect(googleBtn).toBeTruthy();
    expect(googleBtn.textContent.trim()).toBe('USE GOOGLE AVATAR');

    googleBtn.click();
    // Wait for any async work in the click handler
    await new Promise(r => setTimeout(r, 10));
    expect(profileBase.clearAvatarOverride).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith('Google avatar applied.');
  });

  test('Test 7: SIGN OUT button exists; click calls auth.signOut + closes modal + fires toast', async () => {
    const toastSuccess = vi.fn();
    const { authStub } = setAlpine({
      authStatus: 'authed',
      toastCalls: { success: toastSuccess },
    });

    openSettingsModal();
    const modal = document.querySelector('#cf-settings-modal');
    const signOutBtn = modal.querySelector('#settings-signout');
    expect(signOutBtn).toBeTruthy();
    expect(signOutBtn.textContent.trim()).toBe('SIGN OUT');

    signOutBtn.click();
    await new Promise(r => setTimeout(r, 10));

    expect(authStub.signOut).toHaveBeenCalled();
    expect(document.querySelector('#cf-settings-modal')).toBeFalsy();
    expect(toastSuccess).toHaveBeenCalledWith('Signed out. Your data stays on this device.');
  });

  test('Test 8 (D-22): SIGN OUT handler does NOT reference Dexie db.*', () => {
    // Static code inspection — walk settings-modal.js source and scan around the
    // SIGN OUT button wire-up for any db.collection|db.decks|etc references.
    const here = fileURLToPath(import.meta.url);
    const src = readFileSync(
      resolve(dirname(here), '..', 'src', 'components', 'settings-modal.js'),
      'utf8'
    );
    // Must not contain any Dexie table reads/writes anywhere in the file.
    const dexiePattern = /db\.(collection|decks|deck_cards|games|watchlist|profile)/;
    expect(dexiePattern.test(src)).toBe(false);
  });

  test('Test 9: SAVE PROFILE calls profile.update with DISPLAY NAME value', async () => {
    const { profileBase } = setAlpine({ authStatus: 'authed' });
    profileBase.name = 'Old';
    openSettingsModal();
    const modal = document.querySelector('#cf-settings-modal');
    const nameInput = modal.querySelector('#settings-name');
    nameInput.value = 'New Name';

    // The save button gets wired inside a setTimeout(..., 0); flush it first.
    await new Promise(r => setTimeout(r, 10));
    const saveBtn = modal.querySelector('#settings-save');
    saveBtn.click();
    await new Promise(r => setTimeout(r, 10));

    expect(profileBase.update).toHaveBeenCalled();
    const [fields] = profileBase.update.mock.calls[0];
    expect(fields.name).toBe('New Name');
  });

  test('Test 10: DISCARD CHANGES reverts the input to prior value AND closes modal', async () => {
    const { profileBase } = setAlpine({ authStatus: 'authed' });
    profileBase.name = 'Prior Name';
    openSettingsModal();

    const modal = document.querySelector('#cf-settings-modal');
    const nameInput = modal.querySelector('#settings-name');
    expect(nameInput.value).toBe('Prior Name');
    nameInput.value = 'Unsaved';

    // Flush setTimeout(0) wire-ups
    await new Promise(r => setTimeout(r, 10));
    const cancelBtn = modal.querySelector('#settings-cancel');
    cancelBtn.click();

    expect(document.querySelector('#cf-settings-modal')).toBeFalsy();
    // profileBase.name should NOT have been updated
    expect(profileBase.name).toBe('Prior Name');
  });
});
