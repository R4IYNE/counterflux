// @vitest-environment jsdom
// tests/auth-modal.test.js
// Phase 10 Plan 3 — auth modal component tests.
// Phase 10.2 (D-39): magic-link replaced with email+password.
//
// Covers:
//   1. Idle state scaffolding (heading, Google button, OR divider, EMAIL, PASSWORD, SIGN IN disabled)
//   2. Email + password validation (SIGN IN only enabled when both present and email is valid;
//      blur on invalid email shows inline error)
//   3. Sign-in flow (calls signInWithPassword, shows SIGNING IN…, modal closes on success)
//   4. Invalid credentials → inline error message
//   5. Enter key on either field submits
//   6. Google button flow (calls signInGoogle, swaps label to OPENING GOOGLE…)
//   7. Google brand styling (#131314 bg + #8E918F border, NOT bg-primary)
//   8. Close interactions (Escape, X icon, backdrop)
//   9. Error toasts (rate-limited → warning, non-credential failure → error)

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

vi.mock('alpinejs', () => ({
  default: {
    store: (name, value) => {
      if (value !== undefined) storeRegistry[name] = value;
      return storeRegistry[name];
    },
  },
}));

vi.mock('../src/components/auth-callback-overlay.js', () => ({
  captureCurrentPreAuthRoute: vi.fn(),
  handleAuthCallback: vi.fn(),
}));

let openAuthModal, closeAuthModal;

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
  vi.doMock('alpinejs', () => ({
    default: {
      store: (name, value) => {
        if (value !== undefined) storeRegistry[name] = value;
        return storeRegistry[name];
      },
    },
  }));
  vi.doMock('../src/components/auth-callback-overlay.js', () => ({
    captureCurrentPreAuthRoute: vi.fn(),
    handleAuthCallback: vi.fn(),
  }));
  const mod = await import('../src/components/auth-modal.js');
  openAuthModal = mod.openAuthModal;
  closeAuthModal = mod.closeAuthModal;
});

afterEach(() => {
  try { closeAuthModal?.(); } catch { /* ignore */ }
  document.body.innerHTML = '';
});

describe('auth-modal — idle state (Test 1)', () => {
  test('openAuthModal mounts modal with SIGN IN heading, Google, OR, EMAIL, PASSWORD, SIGN IN disabled', () => {
    openAuthModal();
    const modal = document.querySelector('#cf-auth-modal');
    expect(modal).toBeTruthy();
    expect(modal.textContent).toContain('SIGN IN');
    expect(modal.textContent).toContain('SIGN IN WITH GOOGLE');
    expect(modal.textContent).toContain('OR');
    expect(modal.textContent).toContain('EMAIL');
    expect(modal.textContent).toContain('PASSWORD');
    const submitBtn = modal.querySelector('#cf-auth-submit');
    const emailInput = modal.querySelector('#cf-auth-email');
    const passwordInput = modal.querySelector('#cf-auth-password');
    expect(submitBtn).toBeTruthy();
    expect(emailInput).toBeTruthy();
    expect(passwordInput).toBeTruthy();
    expect(passwordInput.type).toBe('password');
    // Disabled because both fields empty
    expect(submitBtn.disabled).toBe(true);
  });
});

describe('auth-modal — form validation (Test 2)', () => {
  test('SIGN IN only enables when email is valid AND password is non-empty', () => {
    openAuthModal();
    const emailInput = document.querySelector('#cf-auth-email');
    const passwordInput = document.querySelector('#cf-auth-password');
    const submitBtn = document.querySelector('#cf-auth-submit');

    // Just email (invalid): disabled
    emailInput.value = 'notanemail';
    emailInput.dispatchEvent(new Event('input'));
    expect(submitBtn.disabled).toBe(true);

    // Valid email, empty password: disabled
    emailInput.value = 'user@example.com';
    emailInput.dispatchEvent(new Event('input'));
    expect(submitBtn.disabled).toBe(true);

    // Valid email + password: enabled
    passwordInput.value = 'secret123';
    passwordInput.dispatchEvent(new Event('input'));
    expect(submitBtn.disabled).toBe(false);

    // Invalid email + password: disabled again
    emailInput.value = 'bad@';
    emailInput.dispatchEvent(new Event('input'));
    expect(submitBtn.disabled).toBe(true);

    // Blur on invalid email shows inline error
    emailInput.dispatchEvent(new Event('blur'));
    expect(document.querySelector('#cf-auth-modal').textContent).toContain('Enter a valid email address.');
  });
});

describe('auth-modal — sign-in flow (Test 3)', () => {
  test('clicking SIGN IN with valid credentials calls signInWithPassword once, shows SIGNING IN…, then closes modal', async () => {
    let resolveStore;
    storeRegistry.auth.signInWithPassword = vi.fn(() => new Promise(res => { resolveStore = res; }));

    openAuthModal();
    const emailInput = document.querySelector('#cf-auth-email');
    const passwordInput = document.querySelector('#cf-auth-password');
    emailInput.value = 'james@arnall.dev';
    passwordInput.value = 'supersecret';
    emailInput.dispatchEvent(new Event('input'));
    passwordInput.dispatchEvent(new Event('input'));
    document.querySelector('#cf-auth-submit').click();

    expect(storeRegistry.auth.signInWithPassword).toHaveBeenCalledTimes(1);
    expect(storeRegistry.auth.signInWithPassword).toHaveBeenCalledWith('james@arnall.dev', 'supersecret');
    expect(document.querySelector('#cf-auth-modal').textContent).toContain('SIGNING IN…');

    resolveStore({ error: null });
    await new Promise(r => setTimeout(r, 0));

    // Success: modal closes, success toast fired
    expect(document.querySelector('#cf-auth-modal')).toBeNull();
    expect(toastCalls.success.length).toBeGreaterThanOrEqual(1);
  });
});

describe('auth-modal — invalid credentials (Test 4)', () => {
  test('invalid_credentials error shows inline message and re-enables form', async () => {
    storeRegistry.auth.signInWithPassword = vi.fn().mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    });

    openAuthModal();
    const emailInput = document.querySelector('#cf-auth-email');
    const passwordInput = document.querySelector('#cf-auth-password');
    emailInput.value = 'test@example.com';
    passwordInput.value = 'wrongpass';
    emailInput.dispatchEvent(new Event('input'));
    passwordInput.dispatchEvent(new Event('input'));
    document.querySelector('#cf-auth-submit').click();
    await new Promise(r => setTimeout(r, 0));

    const modal = document.querySelector('#cf-auth-modal');
    expect(modal).toBeTruthy();
    expect(modal.textContent).toContain('Invalid email or password.');
    // Form re-enabled for retry
    expect(document.querySelector('#cf-auth-submit').disabled).toBe(false);
    expect(emailInput.disabled).toBe(false);
    expect(passwordInput.disabled).toBe(false);
  });
});

describe('auth-modal — Enter key submits (Test 5)', () => {
  test('pressing Enter in either field submits when button is enabled', async () => {
    openAuthModal();
    const emailInput = document.querySelector('#cf-auth-email');
    const passwordInput = document.querySelector('#cf-auth-password');
    emailInput.value = 'test@example.com';
    passwordInput.value = 'pass';
    emailInput.dispatchEvent(new Event('input'));
    passwordInput.dispatchEvent(new Event('input'));

    passwordInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise(r => setTimeout(r, 0));

    expect(storeRegistry.auth.signInWithPassword).toHaveBeenCalledTimes(1);
    expect(storeRegistry.auth.signInWithPassword).toHaveBeenCalledWith('test@example.com', 'pass');
  });
});

describe('auth-modal — Google button (Test 6 + 7)', () => {
  test('clicking Google button calls signInGoogle exactly once and swaps label to OPENING GOOGLE…', async () => {
    let resolveGoogle;
    storeRegistry.auth.signInGoogle = vi.fn(() => new Promise(res => { resolveGoogle = res; }));

    openAuthModal();
    const googleBtn = document.querySelector('#cf-auth-google');
    expect(googleBtn).toBeTruthy();
    googleBtn.click();

    expect(storeRegistry.auth.signInGoogle).toHaveBeenCalledTimes(1);
    expect(googleBtn.textContent).toContain('OPENING GOOGLE…');

    resolveGoogle({ error: null });
    await new Promise(r => setTimeout(r, 0));
  });

  test('Google button brand styling uses #131314 background and #8E918F border — NOT bg-primary', () => {
    openAuthModal();
    const googleBtn = document.querySelector('#cf-auth-google');
    const style = googleBtn.getAttribute('style') || '';
    expect(style.toLowerCase()).toMatch(/#131314/);
    expect(style.toLowerCase()).toMatch(/#8e918f/);
    // Must NOT use the Counterflux primary colour (Google brand fidelity is mandatory)
    expect(style).not.toMatch(/#0D52BD/i);
  });
});

describe('auth-modal — close interactions (Test 8)', () => {
  test('Escape key closes the modal and removes the keydown listener', () => {
    openAuthModal();
    expect(document.querySelector('#cf-auth-modal')).toBeTruthy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('#cf-auth-modal')).toBeNull();
    expect(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))).not.toThrow();
  });

  test('clicking the X close icon dismisses the modal', () => {
    openAuthModal();
    const closeBtn = document.querySelector('#cf-auth-close');
    expect(closeBtn).toBeTruthy();
    closeBtn.click();
    expect(document.querySelector('#cf-auth-modal')).toBeNull();
  });

  test('clicking the backdrop (event target === modal root) closes the modal', () => {
    openAuthModal();
    const modal = document.querySelector('#cf-auth-modal');
    const evt = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(evt, 'target', { value: modal });
    modal.dispatchEvent(evt);
    expect(document.querySelector('#cf-auth-modal')).toBeNull();
  });
});

describe('auth-modal — error toasts (Test 9)', () => {
  test('rate-limit error fires WARNING toast; non-credential network error fires ERROR toast', async () => {
    storeRegistry.auth.signInWithPassword = vi.fn().mockResolvedValue({
      error: { message: 'For security purposes, rate limited. Try again in 60 seconds.' },
    });

    openAuthModal();
    let emailInput = document.querySelector('#cf-auth-email');
    let passwordInput = document.querySelector('#cf-auth-password');
    emailInput.value = 'test@example.com';
    passwordInput.value = 'pass';
    emailInput.dispatchEvent(new Event('input'));
    passwordInput.dispatchEvent(new Event('input'));
    document.querySelector('#cf-auth-submit').click();
    await new Promise(r => setTimeout(r, 0));

    expect(toastCalls.warning.length).toBeGreaterThanOrEqual(1);
    expect(toastCalls.warning[0]).toMatch(/Too many attempts/i);

    // Reset, try network error
    toastCalls.warning.length = 0;
    toastCalls.error.length = 0;
    closeAuthModal();

    storeRegistry.auth.signInWithPassword = vi.fn().mockResolvedValue({
      error: { message: 'fetch failed' },
    });
    openAuthModal();
    emailInput = document.querySelector('#cf-auth-email');
    passwordInput = document.querySelector('#cf-auth-password');
    emailInput.value = 'test@example.com';
    passwordInput.value = 'pass';
    emailInput.dispatchEvent(new Event('input'));
    passwordInput.dispatchEvent(new Event('input'));
    document.querySelector('#cf-auth-submit').click();
    await new Promise(r => setTimeout(r, 0));

    expect(toastCalls.error.length).toBeGreaterThanOrEqual(1);
    expect(toastCalls.error[0]).toMatch(/Couldn't sign in/i);
  });
});
