// @vitest-environment jsdom
// tests/first-sign-in-prompt.test.js
// Phase 10 Plan 4 — first-sign-in profile migration prompt tests (D-16..D-20).
//
// 8 behaviours:
//   1. Trigger: authed + local profile present + cloud missing → WELCOME BACK + two CTAs
//   2. Trigger skipped — no local profile (D-20 silent upsert path)
//   3. Trigger skipped — cloud row already exists (_source === 'cloud')
//   4. Trigger skipped — anonymous
//   5. KEEP LOCAL PROFILE → profile.update + toast 'Profile synced to cloud.'
//   6. START FRESH → profile.update with derived identity + toast 'Cloud profile created.' + localStorage preserved (D-19)
//   7. Lockdown (D-16) — Escape disabled, backdrop disabled, no X close
//   8. Upsert failure → error toast + close prompt + _source stays 'local'

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

let maybeShowFirstSignInPrompt, __resetFirstSignInPrompt;

function setAlpine({ authStatus = 'anonymous', user = null, profileFields = {}, toastCalls = null, updateResult = { error: null } } = {}) {
  const profileBase = {
    name: '',
    email: '',
    avatar: '',
    avatar_url_override: '',
    _source: authStatus === 'authed' ? 'local' : 'local',  // first-sign-in: still 'local' because cloud row is missing
    _loaded: true,
    update: vi.fn(async (fields) => {
      Object.assign(profileBase, fields);
      return updateResult;
    }),
    ...profileFields,
  };

  const authUser = user || (authStatus === 'authed'
    ? { id: 'u1', email: 'user@test.dev', user_metadata: {} }
    : null);
  const authStub = { status: authStatus, user: authUser };
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
  document.body.innerHTML = '';
  localStorage.clear();
  vi.resetModules();
  const mod = await import('../src/components/first-sign-in-prompt.js');
  maybeShowFirstSignInPrompt = mod.maybeShowFirstSignInPrompt;
  __resetFirstSignInPrompt = mod.__resetFirstSignInPrompt;
});

afterEach(() => {
  if (__resetFirstSignInPrompt) __resetFirstSignInPrompt();
  document.body.innerHTML = '';
  localStorage.clear();
});

describe('first-sign-in prompt — trigger conditions', () => {
  test('Test 1: authed + local profile + cloud-missing → WELCOME BACK modal with KEEP + START FRESH', async () => {
    localStorage.setItem('cf_profile', JSON.stringify({ name: 'James', avatar: '', email: 'james@test.dev' }));
    setAlpine({ authStatus: 'authed' });

    await maybeShowFirstSignInPrompt();

    const prompt = document.querySelector('#cf-first-sign-in-prompt');
    expect(prompt).toBeTruthy();
    expect(prompt.textContent).toContain('WELCOME BACK');
    expect(prompt.textContent).toContain('KEEP LOCAL PROFILE');
    expect(prompt.textContent).toContain('START FRESH');
    expect(prompt.textContent).toContain('You had a local profile before signing in');
    expect(prompt.textContent).toContain('Mila will keep your local profile either way');
  });

  test('Test 2 (D-20): no local profile → no prompt; silent upsert fires profile.update', async () => {
    // localStorage has no cf_profile
    const { profileBase } = setAlpine({
      authStatus: 'authed',
      user: { id: 'u1', email: 'fresh@test.dev', user_metadata: { given_name: 'Fresh' } },
    });

    await maybeShowFirstSignInPrompt();

    // No modal mounted
    expect(document.querySelector('#cf-first-sign-in-prompt')).toBeFalsy();
    // Silent upsert: update called with derived name
    expect(profileBase.update).toHaveBeenCalled();
    const [fields] = profileBase.update.mock.calls[0];
    expect(fields.name).toBe('Fresh');
  });

  test('Test 3: cloud row already exists (_source === "cloud") → no prompt', async () => {
    localStorage.setItem('cf_profile', JSON.stringify({ name: 'James', avatar: '' }));
    const { profileBase } = setAlpine({
      authStatus: 'authed',
      profileFields: { _source: 'cloud' },
    });

    await maybeShowFirstSignInPrompt();

    expect(document.querySelector('#cf-first-sign-in-prompt')).toBeFalsy();
    expect(profileBase.update).not.toHaveBeenCalled();
  });

  test('Test 4: anonymous → no prompt', async () => {
    localStorage.setItem('cf_profile', JSON.stringify({ name: 'James' }));
    setAlpine({ authStatus: 'anonymous' });

    await maybeShowFirstSignInPrompt();

    expect(document.querySelector('#cf-first-sign-in-prompt')).toBeFalsy();
  });
});

describe('first-sign-in prompt — CTA handling', () => {
  test('Test 5: KEEP LOCAL PROFILE → profile.update with local values + toast + prompt closes', async () => {
    localStorage.setItem('cf_profile', JSON.stringify({ name: 'James', avatar: 'data:image/png;base64,abc' }));
    const toastSuccess = vi.fn();
    const { profileBase } = setAlpine({
      authStatus: 'authed',
      toastCalls: { success: toastSuccess },
    });

    await maybeShowFirstSignInPrompt();
    const keepBtn = document.querySelector('#first-signin-keep');
    expect(keepBtn).toBeTruthy();
    keepBtn.click();
    await new Promise(r => setTimeout(r, 10));

    expect(profileBase.update).toHaveBeenCalled();
    const [fields] = profileBase.update.mock.calls[0];
    expect(fields.name).toBe('James');
    expect(fields.avatar_url_override).toBe('data:image/png;base64,abc');
    expect(toastSuccess).toHaveBeenCalledWith('Profile synced to cloud.');
    expect(document.querySelector('#cf-first-sign-in-prompt')).toBeFalsy();
  });

  test('Test 6: START FRESH → upsert with OAuth-derived identity + toast + localStorage preserved (D-19)', async () => {
    const localData = { name: 'LocalName', avatar: 'data:image/png;base64,old' };
    localStorage.setItem('cf_profile', JSON.stringify(localData));
    const toastSuccess = vi.fn();
    const { profileBase } = setAlpine({
      authStatus: 'authed',
      user: { id: 'u1', email: 'james@test.dev', user_metadata: { given_name: 'James' } },
      toastCalls: { success: toastSuccess },
    });

    await maybeShowFirstSignInPrompt();
    const freshBtn = document.querySelector('#first-signin-fresh');
    expect(freshBtn).toBeTruthy();
    freshBtn.click();
    await new Promise(r => setTimeout(r, 10));

    expect(profileBase.update).toHaveBeenCalled();
    const [fields] = profileBase.update.mock.calls[0];
    expect(fields.name).toBe('James');             // given_name derivation
    expect(fields.avatar_url_override).toBe('');   // fresh = no local avatar
    expect(toastSuccess).toHaveBeenCalledWith('Cloud profile created.');

    // D-19: localStorage profile NOT deleted
    const stillThere = JSON.parse(localStorage.getItem('cf_profile'));
    expect(stillThere.name).toBe('LocalName');
    expect(stillThere.avatar).toBe('data:image/png;base64,old');
  });
});

describe('first-sign-in prompt — lockdown + error handling', () => {
  test('Test 7 (D-16): Escape disabled + backdrop disabled + no X close button', async () => {
    localStorage.setItem('cf_profile', JSON.stringify({ name: 'James' }));
    setAlpine({ authStatus: 'authed' });

    await maybeShowFirstSignInPrompt();
    const prompt = document.querySelector('#cf-first-sign-in-prompt');
    expect(prompt).toBeTruthy();

    // No X close button
    expect(document.querySelector('#first-signin-close')).toBeFalsy();

    // Escape is a no-op
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('#cf-first-sign-in-prompt')).toBeTruthy();

    // Backdrop click is a no-op (clicking the prompt itself, not the inner card)
    prompt.click();
    expect(document.querySelector('#cf-first-sign-in-prompt')).toBeTruthy();

    // Role / aria
    expect(prompt.getAttribute('role')).toBe('dialog');
    expect(prompt.getAttribute('aria-modal')).toBe('true');
  });

  test('Test 8: upsert failure → error toast + prompt closes + _source stays "local"', async () => {
    localStorage.setItem('cf_profile', JSON.stringify({ name: 'James' }));
    const toastError = vi.fn();
    const { profileBase } = setAlpine({
      authStatus: 'authed',
      toastCalls: { error: toastError },
      updateResult: { error: new Error('network') },
    });

    await maybeShowFirstSignInPrompt();
    const keepBtn = document.querySelector('#first-signin-keep');
    keepBtn.click();
    await new Promise(r => setTimeout(r, 10));

    expect(toastError).toHaveBeenCalledWith("Couldn't save profile to cloud. Working locally for now.");
    expect(document.querySelector('#cf-first-sign-in-prompt')).toBeFalsy();
    expect(profileBase._source).toBe('local');
  });
});
