// @vitest-environment jsdom
// tests/auth-wall.test.js
// Phase 10.3 Plan — auth-wall boot gate tests (D-40).
//
// Covers:
//   1. openAuthWall mounts full-screen non-dismissible sign-in with COUNTERFLUX brand
//   2. Non-dismissible: Escape key does NOT close; no X icon; no backdrop click close
//   3. Email + password validation (same rules as auth-modal; D-39 parity)
//   4. signInWithPassword flow — successful sign-in triggers closeAuthWall via caller
//      (the wall itself just calls the store method; main.js's Alpine.effect closes)
//   5. Invalid credentials surface inline error, form re-enables
//   6. Google button wires to signInGoogle

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

const storeRegistry = {};

const toastCalls = { info: [], success: [], warning: [], error: [] };
function makeToastStore() {
  return {
    info: vi.fn(msg => { toastCalls.info.push(msg); }),
    success: vi.fn(msg => { toastCalls.success.push(msg); }),
    warning: vi.fn(msg => { toastCalls.warning.push(msg); }),
    error: vi.fn(msg => { toastCalls.error.push(msg); }),
  };
}

function makeAuthStore(overrides = {}) {
  return {
    status: 'anonymous',
    user: null,
    session: null,
    signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    signInGoogle: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    init: vi.fn(),
    ...overrides,
  };
}

let openAuthWall, closeAuthWall, isAuthWallOpen;

beforeEach(async () => {
  document.body.innerHTML = '';
  for (const k of Object.keys(storeRegistry)) delete storeRegistry[k];
  storeRegistry.auth = makeAuthStore();
  storeRegistry.toast = makeToastStore();
  toastCalls.info = [];
  toastCalls.success = [];
  toastCalls.warning = [];
  toastCalls.error = [];
  window.Alpine = {
    store: (name, value) => {
      if (value !== undefined) storeRegistry[name] = value;
      return storeRegistry[name];
    },
  };
  vi.resetModules();
  const mod = await import('../src/components/auth-wall.js');
  openAuthWall = mod.openAuthWall;
  closeAuthWall = mod.closeAuthWall;
  isAuthWallOpen = mod.isAuthWallOpen;
});

afterEach(() => {
  try { closeAuthWall?.(); } catch { /* ignore */ }
  document.body.innerHTML = '';
});

describe('auth-wall — scaffolding', () => {
  test('openAuthWall mounts full-screen wall with COUNTERFLUX brand, SIGN IN, Google button, email + password', () => {
    openAuthWall();
    const wall = document.querySelector('#cf-auth-wall');
    expect(wall).toBeTruthy();
    expect(wall.textContent).toContain('COUNTERFLUX');
    expect(wall.textContent).toContain('THE AETHERIC ARCHIVE');
    expect(wall.textContent).toContain('SIGN IN');
    expect(wall.textContent).toContain('SIGN IN WITH GOOGLE');
    expect(wall.textContent).toContain('EMAIL');
    expect(wall.textContent).toContain('PASSWORD');
    expect(wall.textContent).toContain('Mila only lets members through the gate');

    // Non-dismissible: no X close button
    expect(document.querySelector('#cf-auth-close')).toBeNull();

    // ARIA wiring for screen readers
    expect(wall.getAttribute('role')).toBe('dialog');
    expect(wall.getAttribute('aria-modal')).toBe('true');

    expect(isAuthWallOpen()).toBe(true);
  });

  test('second openAuthWall is a no-op (singleton guard)', () => {
    openAuthWall();
    openAuthWall();
    const walls = document.querySelectorAll('#cf-auth-wall');
    expect(walls.length).toBe(1);
  });
});

describe('auth-wall — non-dismissible (D-40)', () => {
  test('Escape key does NOT close the wall', () => {
    openAuthWall();
    expect(isAuthWallOpen()).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(isAuthWallOpen()).toBe(true);
    expect(document.querySelector('#cf-auth-wall')).toBeTruthy();
  });

  test('clicking the wall background does NOT close it', () => {
    openAuthWall();
    const wall = document.querySelector('#cf-auth-wall');
    const evt = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(evt, 'target', { value: wall });
    wall.dispatchEvent(evt);
    expect(isAuthWallOpen()).toBe(true);
  });
});

describe('auth-wall — form validation (D-39 parity)', () => {
  test('SIGN IN only enables when email is valid AND password is non-empty', () => {
    openAuthWall();
    const emailInput = document.querySelector('#cf-auth-wall-email');
    const passwordInput = document.querySelector('#cf-auth-wall-password');
    const submitBtn = document.querySelector('#cf-auth-wall-submit');

    expect(submitBtn.disabled).toBe(true);

    emailInput.value = 'notanemail';
    emailInput.dispatchEvent(new Event('input'));
    expect(submitBtn.disabled).toBe(true);

    emailInput.value = 'user@example.com';
    emailInput.dispatchEvent(new Event('input'));
    expect(submitBtn.disabled).toBe(true);  // still no password

    passwordInput.value = 'secret123';
    passwordInput.dispatchEvent(new Event('input'));
    expect(submitBtn.disabled).toBe(false);
  });

  test('invalid email on blur shows inline error', () => {
    openAuthWall();
    const emailInput = document.querySelector('#cf-auth-wall-email');
    emailInput.value = 'bad@';
    emailInput.dispatchEvent(new Event('input'));
    emailInput.dispatchEvent(new Event('blur'));
    expect(document.querySelector('#cf-auth-wall').textContent).toContain('Enter a valid email address.');
  });
});

describe('auth-wall — sign-in flow', () => {
  test('clicking SIGN IN with valid credentials calls signInWithPassword once, shows SIGNING IN…', async () => {
    let resolveStore;
    storeRegistry.auth.signInWithPassword = vi.fn(() => new Promise(res => { resolveStore = res; }));

    openAuthWall();
    const emailInput = document.querySelector('#cf-auth-wall-email');
    const passwordInput = document.querySelector('#cf-auth-wall-password');
    emailInput.value = 'james@arnall.dev';
    passwordInput.value = 'supersecret';
    emailInput.dispatchEvent(new Event('input'));
    passwordInput.dispatchEvent(new Event('input'));
    document.querySelector('#cf-auth-wall-submit').click();

    expect(storeRegistry.auth.signInWithPassword).toHaveBeenCalledTimes(1);
    expect(storeRegistry.auth.signInWithPassword).toHaveBeenCalledWith('james@arnall.dev', 'supersecret');
    expect(document.querySelector('#cf-auth-wall').textContent).toContain('SIGNING IN…');

    resolveStore({ error: null });
    await new Promise(r => setTimeout(r, 0));

    // Wall does NOT self-close — main.js Alpine.effect handles that when
    // auth.status flips to 'authed'. We assert the success toast fired.
    expect(toastCalls.success.length).toBeGreaterThanOrEqual(1);
  });

  test('invalid credentials show inline error and re-enable form', async () => {
    storeRegistry.auth.signInWithPassword = vi.fn().mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    });

    openAuthWall();
    const emailInput = document.querySelector('#cf-auth-wall-email');
    const passwordInput = document.querySelector('#cf-auth-wall-password');
    emailInput.value = 'test@example.com';
    passwordInput.value = 'wrongpass';
    emailInput.dispatchEvent(new Event('input'));
    passwordInput.dispatchEvent(new Event('input'));
    document.querySelector('#cf-auth-wall-submit').click();
    await new Promise(r => setTimeout(r, 0));

    expect(document.querySelector('#cf-auth-wall').textContent).toContain('Invalid email or password.');
    expect(document.querySelector('#cf-auth-wall-submit').disabled).toBe(false);
    expect(emailInput.disabled).toBe(false);
    expect(passwordInput.disabled).toBe(false);
  });

  test('Enter key in either field submits when enabled', async () => {
    openAuthWall();
    const emailInput = document.querySelector('#cf-auth-wall-email');
    const passwordInput = document.querySelector('#cf-auth-wall-password');
    emailInput.value = 'test@example.com';
    passwordInput.value = 'pass';
    emailInput.dispatchEvent(new Event('input'));
    passwordInput.dispatchEvent(new Event('input'));

    passwordInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise(r => setTimeout(r, 0));

    expect(storeRegistry.auth.signInWithPassword).toHaveBeenCalledTimes(1);
  });
});

describe('auth-wall — Google button', () => {
  test('clicking SIGN IN WITH GOOGLE calls signInGoogle and swaps label', async () => {
    let resolveGoogle;
    storeRegistry.auth.signInGoogle = vi.fn(() => new Promise(res => { resolveGoogle = res; }));

    openAuthWall();
    const googleBtn = document.querySelector('#cf-auth-wall-google');
    googleBtn.click();

    expect(storeRegistry.auth.signInGoogle).toHaveBeenCalledTimes(1);
    expect(googleBtn.textContent).toContain('OPENING GOOGLE…');

    resolveGoogle({ error: null });
    await new Promise(r => setTimeout(r, 0));
  });
});

describe('auth-wall — closeAuthWall', () => {
  test('closeAuthWall removes the wall from the DOM', () => {
    openAuthWall();
    expect(document.querySelector('#cf-auth-wall')).toBeTruthy();
    closeAuthWall();
    expect(document.querySelector('#cf-auth-wall')).toBeNull();
    expect(isAuthWallOpen()).toBe(false);
  });

  test('closeAuthWall is a no-op when wall not open', () => {
    expect(() => closeAuthWall()).not.toThrow();
  });

  // Phase 14.06 — regression test for the stale static element bug.
  // Repro: index.html ships <div id="cf-auth-wall"> for paint-critical LCP.
  // If auth rehydrates to 'authed' BEFORE openAuthWall() ever runs, the
  // module-local wallEl stays null and closeAuthWall() used to early-return
  // without removing the static element — leaving the bare COUNTERFLUX h1
  // covering the entire viewport with no way to dismiss.
  test('closeAuthWall removes the static #cf-auth-wall from index.html when wallEl is null', () => {
    // Seed the static paint-critical element as index.html ships it,
    // WITHOUT calling openAuthWall first (mirrors the fast-rehydrate race).
    const stale = document.createElement('div');
    stale.id = 'cf-auth-wall';
    stale.innerHTML = '<h1 class="cf-auth-wall-title">COUNTERFLUX</h1>';
    document.body.appendChild(stale);
    expect(document.getElementById('cf-auth-wall')).toBeTruthy();

    // closeAuthWall() with wallEl null should still strip the static node.
    closeAuthWall();
    expect(document.getElementById('cf-auth-wall')).toBeNull();
  });
});
