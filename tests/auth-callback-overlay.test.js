// @vitest-environment jsdom
// tests/auth-callback-overlay.test.js
// Phase 10 Plan 3 — auth-callback overlay tests (D-06 + D-11).
//
// Covers:
//   1. Pending overlay with spinner + COMPLETING SIGN-IN… heading
//   2. Success: 200ms flash + navigate to captured pre-auth route
//   3. Fallback to '/' when no captured route
//   4. Expired link error → SIGN-IN LINK EXPIRED heading
//   5. Generic error → COULDN'T FINISH SIGN-IN heading
//   6. BACK TO COUNTERFLUX CTA re-opens auth-modal + navigates + toast
//   7. captureCurrentPreAuthRoute stashes hash / skips /auth-callback

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

const exchangeMock = vi.fn();
const supabaseMock = { auth: { exchangeCodeForSession: exchangeMock } };

vi.mock('../src/services/supabase.js', () => ({
  getSupabase: () => supabaseMock,
  __resetSupabaseClient: vi.fn(),
}));

let handleAuthCallback, captureCurrentPreAuthRoute, __resetOverlay;

beforeEach(async () => {
  document.body.innerHTML = '';
  sessionStorage.clear();
  exchangeMock.mockReset();
  window.__counterflux_router = { navigate: vi.fn() };
  window.__openAuthModal = vi.fn();
  const toastStore = { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() };
  window.Alpine = { store: vi.fn().mockReturnValue(toastStore) };
  vi.resetModules();
  vi.doMock('../src/services/supabase.js', () => ({
    getSupabase: () => supabaseMock,
    __resetSupabaseClient: vi.fn(),
  }));
  const mod = await import('../src/components/auth-callback-overlay.js');
  handleAuthCallback = mod.handleAuthCallback;
  captureCurrentPreAuthRoute = mod.captureCurrentPreAuthRoute;
  __resetOverlay = mod.__resetOverlay;
});

afterEach(() => {
  try { __resetOverlay?.(); } catch { /* ignore */ }
});

describe('auth-callback-overlay', () => {
  test('pending overlay mounts with spinner + COMPLETING SIGN-IN… heading', () => {
    exchangeMock.mockImplementation(() => new Promise(() => {})); // never resolve
    handleAuthCallback('https://counterflux.vercel.app/#auth-callback?code=xyz');
    const overlay = document.querySelector('#cf-auth-callback-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay.textContent).toContain('COMPLETING SIGN-IN');
    expect(overlay.textContent).toContain("Mila's recalibrating the sigils");
  });

  test('success navigates to captured pre-auth route after 200ms flash', async () => {
    vi.useFakeTimers();
    sessionStorage.setItem('cf_pre_auth_hash', '#/thousand-year-storm/abc');
    exchangeMock.mockResolvedValue({
      data: { session: { user: { email: 'j@arnall.dev', user_metadata: { full_name: 'James' } } } },
      error: null,
    });
    const promise = handleAuthCallback('...#auth-callback?code=xyz');
    await vi.runAllTimersAsync();
    await promise;
    expect(window.__counterflux_router.navigate).toHaveBeenCalledWith('/thousand-year-storm/abc');
    vi.useRealTimers();
  });

  test('success falls back to / when no captured route', async () => {
    vi.useFakeTimers();
    exchangeMock.mockResolvedValue({
      data: { session: { user: { email: 'x@y.z', user_metadata: {} } } },
      error: null,
    });
    const promise = handleAuthCallback('...#auth-callback?code=xyz');
    await vi.runAllTimersAsync();
    await promise;
    expect(window.__counterflux_router.navigate).toHaveBeenCalledWith('/');
    vi.useRealTimers();
  });

  test('expired link error renders SIGN-IN LINK EXPIRED heading', async () => {
    exchangeMock.mockResolvedValue({ data: null, error: { message: 'Token has expired' } });
    await handleAuthCallback('...#auth-callback?code=xyz');
    const overlay = document.querySelector('#cf-auth-callback-overlay');
    expect(overlay.textContent).toContain('SIGN-IN LINK EXPIRED');
    expect(overlay.textContent).toContain('older than 60 minutes');
    expect(overlay.querySelector('#cf-auth-callback-back')).toBeTruthy();
  });

  test('generic error renders COULDN\'T FINISH SIGN-IN', async () => {
    exchangeMock.mockResolvedValue({ data: null, error: { message: 'network down' } });
    await handleAuthCallback('...#auth-callback?code=xyz');
    const overlay = document.querySelector('#cf-auth-callback-overlay');
    expect(overlay.textContent).toContain("COULDN'T FINISH SIGN-IN");
  });

  test('BACK TO COUNTERFLUX CTA re-opens auth-modal and navigates to captured route', async () => {
    sessionStorage.setItem('cf_pre_auth_hash', '#/preordain');
    exchangeMock.mockResolvedValue({ data: null, error: { message: 'expired' } });
    await handleAuthCallback('...#auth-callback?code=xyz');
    const btn = document.querySelector('#cf-auth-callback-back');
    btn.click();
    expect(window.__counterflux_router.navigate).toHaveBeenCalledWith('/preordain');
    expect(window.__openAuthModal).toHaveBeenCalled();
  });

  test('captureCurrentPreAuthRoute stashes window.location.hash', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: { ...window.location, hash: '#/treasure-cruise' },
    });
    captureCurrentPreAuthRoute();
    expect(sessionStorage.getItem('cf_pre_auth_hash')).toBe('#/treasure-cruise');
  });

  test('captureCurrentPreAuthRoute skips the auth-callback hash itself (no recursion)', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: { ...window.location, hash: '#/auth-callback?code=x' },
    });
    captureCurrentPreAuthRoute();
    expect(sessionStorage.getItem('cf_pre_auth_hash')).toBeNull();
  });
});
