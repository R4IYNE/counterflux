// @vitest-environment jsdom
// tests/auth-callback-overlay.test.js
// Phase 10 Plan 3 + D-40 — auth-callback overlay tests.
//
// D-40 behavior: the overlay polls supabase.auth.getSession() after mount
// (supabase-js performs the PKCE exchange internally via detectSessionInUrl).
// No more manual exchangeCodeForSession call — that approach races with
// supabase-js's internal exchange.
//
// Covers:
//   1. Pending overlay mounts with spinner + COMPLETING SIGN-IN… heading
//   2. Session becomes available → 200ms flash + navigate to captured route
//   3. Fallback to '/' when no captured route
//   4. Timeout with no session → COULDN'T FINISH SIGN-IN
//   5. BACK TO COUNTERFLUX CTA navigates + info toast (auth-wall reappears via main.js effect)
//   6. captureCurrentPreAuthRoute stashes hash / skips /auth-callback

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

const getSessionMock = vi.fn();
const supabaseMock = { auth: { getSession: getSessionMock } };

vi.mock('../src/services/supabase.js', () => ({
  getSupabase: () => supabaseMock,
  __resetSupabaseClient: vi.fn(),
}));

let handleAuthCallback, captureCurrentPreAuthRoute, __resetOverlay;

beforeEach(async () => {
  document.body.innerHTML = '';
  sessionStorage.clear();
  getSessionMock.mockReset();
  window.__counterflux_router = { navigate: vi.fn() };
  const toastStore = { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() };
  const authStore = { status: 'anonymous', user: null, session: null };
  window.Alpine = {
    store: vi.fn().mockImplementation((name) => {
      if (name === 'toast') return toastStore;
      if (name === 'auth') return authStore;
      return null;
    }),
  };
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
    // Mock getSession to never resolve so we stay in pending state
    getSessionMock.mockImplementation(() => new Promise(() => {}));
    handleAuthCallback('https://counterflux.vercel.app/#auth-callback?code=xyz');
    const overlay = document.querySelector('#cf-auth-callback-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay.textContent).toContain('COMPLETING SIGN-IN');
    expect(overlay.textContent).toContain("Mila's recalibrating the sigils");
  });

  test('session appears → 200ms flash + navigate to captured pre-auth route', async () => {
    sessionStorage.setItem('cf_pre_auth_hash', '#/thousand-year-storm/abc');
    getSessionMock.mockResolvedValue({
      data: { session: { user: { email: 'j@arnall.dev', user_metadata: { full_name: 'James' } } } },
      error: null,
    });
    await handleAuthCallback('...#auth-callback?code=xyz');
    expect(window.__counterflux_router.navigate).toHaveBeenCalledWith('/thousand-year-storm/abc');
  });

  test('session appears → navigates to / when no captured route', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { user: { email: 'x@y.z', user_metadata: {} } } },
      error: null,
    });
    await handleAuthCallback('...#auth-callback?code=xyz');
    expect(window.__counterflux_router.navigate).toHaveBeenCalledWith('/');
  });

  test('session appears → auth store is synced to authed state', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { user: { id: 'u1', email: 'x@y.z', user_metadata: {} } } },
      error: null,
    });
    await handleAuthCallback('...#auth-callback?code=xyz');
    const authStore = window.Alpine.store('auth');
    expect(authStore.status).toBe('authed');
    expect(authStore.user.id).toBe('u1');
  });

  test('timeout (no session within deadline) renders COULDN\'T FINISH SIGN-IN', async () => {
    // Mock every poll to return null session — overlay should time out
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });

    vi.useFakeTimers();
    const promise = handleAuthCallback('...#auth-callback?code=xyz');
    // Advance past the 10s deadline
    await vi.advanceTimersByTimeAsync(11_000);
    vi.useRealTimers();
    await promise;

    const overlay = document.querySelector('#cf-auth-callback-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay.textContent).toContain("COULDN'T FINISH SIGN-IN");
    expect(overlay.querySelector('#cf-auth-callback-back')).toBeTruthy();
  }, 15_000);

  test('BACK TO COUNTERFLUX CTA navigates to captured route + info toast (auth-wall auto-reappears)', async () => {
    sessionStorage.setItem('cf_pre_auth_hash', '#/preordain');
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });

    vi.useFakeTimers();
    const promise = handleAuthCallback('...#auth-callback?code=xyz');
    await vi.advanceTimersByTimeAsync(11_000);
    vi.useRealTimers();
    await promise;

    const btn = document.querySelector('#cf-auth-callback-back');
    expect(btn).toBeTruthy();
    btn.click();
    expect(window.__counterflux_router.navigate).toHaveBeenCalledWith('/preordain');
    // D-40: no __openAuthModal call — auth-wall handles re-entry via Alpine.effect
    const toast = window.Alpine.store('toast');
    expect(toast.info).toHaveBeenCalled();
  }, 15_000);

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
