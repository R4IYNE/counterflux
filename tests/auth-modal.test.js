// @vitest-environment jsdom
// tests/auth-modal.test.js
// Phase 10 Plan 3 — auth modal component tests.
//
// Covers 9 behaviours specified in 10-03-PLAN.md Task 3.1:
//   1. Idle state scaffolding (heading, Google button, OR divider, EMAIL, SEND MAGIC LINK disabled)
//   2. Email validation (enable/disable on input, inline error on blur)
//   3. Magic-link flow (calls store, shows SENDING…, swaps to CHECK YOUR INBOX on success)
//   4. Magic-link-sent body copy (heading, email interpolation, CLOSE MODAL, RESEND IN {N}s)
//   5. Resend cooldown 30s wall-clock anchored — flips to RESEND MAGIC LINK when ready
//   6. Google button flow (calls signInGoogle, swaps label to OPENING GOOGLE…)
//   7. Google brand styling (#131314 bg + #8E918F border, NOT bg-primary)
//   8. Close interactions (Escape, X icon, backdrop)
//   9. Error toasts (rate-limited → warning, network error → error)

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// --- Mock alpinejs store registry ------------------------------------------
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
    signInMagic: vi.fn().mockResolvedValue({ error: null }),
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

// Mock the callback-overlay module so Task 3.1's import of
// captureCurrentPreAuthRoute resolves even if Task 3.2 hasn't shipped yet.
vi.mock('../src/components/auth-callback-overlay.js', () => ({
  captureCurrentPreAuthRoute: vi.fn(),
  handleAuthCallback: vi.fn(),
}));

let openAuthModal, closeAuthModal;

beforeEach(async () => {
  // Clean DOM
  document.body.innerHTML = '';
  // Reset mocks
  for (const k of Object.keys(storeRegistry)) delete storeRegistry[k];
  storeRegistry.auth = makeAuthStore();
  storeRegistry.toast = makeToastStore();
  toastCalls.info = [];
  toastCalls.success = [];
  toastCalls.warning = [];
  toastCalls.error = [];
  // Expose Alpine on window for the module to read (mirrors main.js bootApp)
  window.Alpine = {
    store: (name, value) => {
      if (value !== undefined) storeRegistry[name] = value;
      return storeRegistry[name];
    },
  };
  vi.resetModules();
  // Re-register mocks after resetModules
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
  test('openAuthModal mounts modal with SIGN IN heading, Google button, OR divider, EMAIL, SEND MAGIC LINK disabled', () => {
    openAuthModal();
    const modal = document.querySelector('#cf-auth-modal');
    expect(modal).toBeTruthy();
    expect(modal.textContent).toContain('SIGN IN');
    expect(modal.textContent).toContain('SIGN IN WITH GOOGLE');
    expect(modal.textContent).toContain('OR');
    expect(modal.textContent).toContain('EMAIL');
    expect(modal.textContent).toContain('SEND MAGIC LINK');
    const sendBtn = modal.querySelector('#cf-auth-send-magic');
    expect(sendBtn).toBeTruthy();
    // Disabled because email is blank
    expect(sendBtn.disabled).toBe(true);
  });
});

describe('auth-modal — email validation (Test 2)', () => {
  test('typing a valid email enables SEND MAGIC LINK; invalid keeps it disabled; blur on invalid shows inline error', () => {
    openAuthModal();
    const input = document.querySelector('#cf-auth-email');
    const sendBtn = document.querySelector('#cf-auth-send-magic');
    expect(input).toBeTruthy();

    // Invalid email
    input.value = 'notanemail';
    input.dispatchEvent(new Event('input'));
    expect(sendBtn.disabled).toBe(true);

    // Valid email
    input.value = 'user@example.com';
    input.dispatchEvent(new Event('input'));
    expect(sendBtn.disabled).toBe(false);

    // Invalid again, blur shows inline error
    input.value = 'oops@';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    const modal = document.querySelector('#cf-auth-modal');
    expect(modal.textContent).toContain('Enter a valid email address.');
  });
});

describe('auth-modal — magic-link flow (Test 3 + 4)', () => {
  test('clicking SEND MAGIC LINK with valid email calls signInMagic exactly once, shows SENDING…, then swaps to CHECK YOUR INBOX', async () => {
    let resolveStore;
    storeRegistry.auth.signInMagic = vi.fn(() => new Promise(res => { resolveStore = res; }));

    openAuthModal();
    const input = document.querySelector('#cf-auth-email');
    input.value = 'james@arnall.dev';
    input.dispatchEvent(new Event('input'));
    const sendBtn = document.querySelector('#cf-auth-send-magic');
    sendBtn.click();

    // Store called exactly once
    expect(storeRegistry.auth.signInMagic).toHaveBeenCalledTimes(1);
    expect(storeRegistry.auth.signInMagic).toHaveBeenCalledWith('james@arnall.dev');
    // SENDING label visible during the in-flight promise
    expect(document.querySelector('#cf-auth-modal').textContent).toContain('SENDING…');

    // Resolve
    resolveStore({ error: null });
    await new Promise(r => setTimeout(r, 0));

    const modal = document.querySelector('#cf-auth-modal');
    expect(modal.textContent).toContain('CHECK YOUR INBOX');
    expect(modal.textContent).toContain('We sent a link to james@arnall.dev. Click it to sign in.');
    expect(modal.textContent).toContain('CLOSE MODAL');
    expect(modal.textContent).toContain('RESEND IN 30s');
  });
});

describe('auth-modal — resend cooldown (Test 5)', () => {
  test('30s wall-clock countdown flips RESEND IN {N}s → RESEND MAGIC LINK when elapsed', async () => {
    const t0 = 1_000_000;
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(t0);

    storeRegistry.auth.signInMagic = vi.fn().mockResolvedValue({ error: null });
    openAuthModal();
    const input = document.querySelector('#cf-auth-email');
    input.value = 'a@b.com';
    input.dispatchEvent(new Event('input'));
    document.querySelector('#cf-auth-send-magic').click();
    await new Promise(r => setTimeout(r, 0));

    // Initial countdown
    let resendBtn = document.querySelector('#cf-auth-resend');
    expect(resendBtn).toBeTruthy();
    expect(resendBtn.textContent).toContain('RESEND IN 30s');
    expect(resendBtn.getAttribute('aria-disabled')).toBe('true');

    // Jump clock 31s and manually tick the interval
    nowSpy.mockReturnValue(t0 + 31_000);
    // Simulate interval tick — module uses setInterval, we force the tick by time advance:
    vi.useFakeTimers({ shouldAdvanceTime: false });
    // The interval was scheduled with real timers, so manually invoke the tick fn via DOM update.
    // Strategy: the module exports no tick hook, so rely on setInterval being called and advance timers.
    // Because we used spyOn(Date, 'now'), the next tick the interval fires will pick up t+31s.
    // Bypass: directly call a short synchronous tick window.
    vi.useRealTimers();
    // Wait slightly longer than 1s — the interval will fire and see t+31s.
    await new Promise(r => setTimeout(r, 1100));

    resendBtn = document.querySelector('#cf-auth-resend');
    expect(resendBtn.textContent).toContain('RESEND MAGIC LINK');
    expect(resendBtn.hasAttribute('aria-disabled') && resendBtn.getAttribute('aria-disabled') === 'true').toBe(false);

    nowSpy.mockRestore();
  }, 5000);
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
    // Look for the brand hexes (case-insensitive)
    expect(style.toLowerCase()).toMatch(/#131314/);
    expect(style.toLowerCase()).toMatch(/#8e918f/);
    // Must NOT be the Counterflux primary colour (Google brand fidelity is mandatory)
    expect(style).not.toMatch(/#0D52BD/i);
  });
});

describe('auth-modal — close interactions (Test 8)', () => {
  test('Escape key closes the modal and removes the keydown listener', () => {
    openAuthModal();
    expect(document.querySelector('#cf-auth-modal')).toBeTruthy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('#cf-auth-modal')).toBeNull();

    // Re-dispatching Escape on a now-closed modal should NOT throw
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
    // Simulate a click whose target is the backdrop itself
    const evt = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(evt, 'target', { value: modal });
    modal.dispatchEvent(evt);
    expect(document.querySelector('#cf-auth-modal')).toBeNull();
  });
});

describe('auth-modal — error toasts (Test 9)', () => {
  test('rate-limit error fires WARNING toast; non-rate-limit error fires ERROR toast', async () => {
    storeRegistry.auth.signInMagic = vi.fn().mockResolvedValue({
      error: { message: 'For security purposes, rate limited. Try again in 60 seconds.' },
    });

    openAuthModal();
    const input = document.querySelector('#cf-auth-email');
    input.value = 'test@example.com';
    input.dispatchEvent(new Event('input'));
    document.querySelector('#cf-auth-send-magic').click();
    await new Promise(r => setTimeout(r, 0));

    expect(toastCalls.warning.length).toBeGreaterThanOrEqual(1);
    expect(toastCalls.warning[0]).toMatch(/Magic link blocked/i);

    // Reset, try generic network error
    toastCalls.warning.length = 0;
    toastCalls.error.length = 0;
    closeAuthModal();

    storeRegistry.auth.signInMagic = vi.fn().mockResolvedValue({
      error: { message: 'fetch failed' },
    });
    openAuthModal();
    const input2 = document.querySelector('#cf-auth-email');
    input2.value = 'test@example.com';
    input2.dispatchEvent(new Event('input'));
    document.querySelector('#cf-auth-send-magic').click();
    await new Promise(r => setTimeout(r, 0));

    expect(toastCalls.error.length).toBeGreaterThanOrEqual(1);
    expect(toastCalls.error[0]).toMatch(/Couldn't send magic link/i);
  });
});
