// tests/auth-store.test.js
// Phase 10 Plan 2 — auth store contract tests (D-29, D-30).
//
// Covers:
//   1. Fresh user with NO prior session → status 'anonymous', no supabase-js load (D-29)
//   2. Prior session token in localStorage → lazy-imports supabase.js + getSession
//   3. Prior token but getSession returns null → falls back to anonymous
//   4. signInWithPassword calls supabase.auth.signInWithPassword({ email, password })
//   5. signInGoogle calls signInWithOAuth with provider google
//   6. signOut clears user/session/status
//   7. onAuthStateChange registered exactly once across multiple lazy-loads
//   8. Subscription callback flips status on SIGNED_IN / SIGNED_OUT events

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// --- Hoisted mocks ---------------------------------------------------------

const storeRegistry = {};
vi.mock('alpinejs', () => ({
  default: {
    store: (name, value) => {
      if (value !== undefined) storeRegistry[name] = value;
      return storeRegistry[name];
    },
  },
}));

const supabaseAuthMock = {
  getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
  onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
  signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
  signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
  signOut: vi.fn().mockResolvedValue({ error: null }),
};

const getSupabaseMock = vi.fn(() => ({ auth: supabaseAuthMock }));
vi.mock('../src/services/supabase.js', () => ({
  getSupabase: getSupabaseMock,
  __resetSupabaseClient: vi.fn(),
}));

// --- Test environment shims (node env has no window/localStorage) ----------

function installLocalStorage(initial = {}) {
  const data = { ...initial };
  const storage = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem(k, v) { data[k] = String(v); },
    removeItem(k) { delete data[k]; },
    clear() { Object.keys(data).forEach(k => delete data[k]); },
    get length() { return Object.keys(data).length; },
    key(i) { return Object.keys(data)[i] ?? null; },
    __data: data,
  };
  globalThis.localStorage = storage;
  if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
  globalThis.window.localStorage = storage;
  globalThis.window.location = globalThis.window.location || { origin: 'http://localhost:5173' };
  return storage;
}

// --- Imports under test ----------------------------------------------------

let initAuthStore, __resetAuthStoreSubscription;

beforeEach(async () => {
  installLocalStorage();
  for (const k of Object.keys(storeRegistry)) delete storeRegistry[k];
  vi.clearAllMocks();
  // Reset the Supabase mock auth default responses.
  supabaseAuthMock.getSession.mockResolvedValue({ data: { session: null }, error: null });
  supabaseAuthMock.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  supabaseAuthMock.signInWithPassword.mockResolvedValue({ error: null });
  supabaseAuthMock.signInWithOAuth.mockResolvedValue({ error: null });
  supabaseAuthMock.signOut.mockResolvedValue({ error: null });
  getSupabaseMock.mockImplementation(() => ({ auth: supabaseAuthMock }));

  // Re-import to get a fresh module with reset internal state.
  vi.resetModules();
  // Re-register the mocks since vi.resetModules clears them.
  vi.doMock('alpinejs', () => ({
    default: {
      store: (name, value) => {
        if (value !== undefined) storeRegistry[name] = value;
        return storeRegistry[name];
      },
    },
  }));
  vi.doMock('../src/services/supabase.js', () => ({
    getSupabase: getSupabaseMock,
    __resetSupabaseClient: vi.fn(),
  }));
  const mod = await import('../src/stores/auth.js');
  initAuthStore = mod.initAuthStore;
  __resetAuthStoreSubscription = mod.__resetAuthStoreSubscription;
  __resetAuthStoreSubscription();
});

afterEach(() => {
  if (__resetAuthStoreSubscription) __resetAuthStoreSubscription();
});

describe('auth store — initial state (D-29 zero-latency anonymous)', () => {
  test('fresh user starts anonymous, does NOT load supabase.js (D-29 lazy-import)', async () => {
    initAuthStore();
    await storeRegistry.auth.init();
    expect(storeRegistry.auth.status).toBe('anonymous');
    expect(storeRegistry.auth.user).toBeNull();
    expect(storeRegistry.auth.session).toBeNull();
    expect(getSupabaseMock).not.toHaveBeenCalled();
  });

  test('prior session token triggers lazy-import + getSession → authed', async () => {
    localStorage.setItem('sb-hodnhjipurvjaskcsjvj-auth-token', JSON.stringify({ fake: 'token' }));
    supabaseAuthMock.getSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: 'u1', email: 'a@b.com', user_metadata: {} },
          access_token: 'x',
        },
      },
      error: null,
    });

    initAuthStore();
    await storeRegistry.auth.init();

    expect(getSupabaseMock).toHaveBeenCalledTimes(1);
    expect(supabaseAuthMock.getSession).toHaveBeenCalledTimes(1);
    expect(storeRegistry.auth.status).toBe('authed');
    expect(storeRegistry.auth.user.id).toBe('u1');
  });

  test('prior token but getSession returns no session → falls back to anonymous', async () => {
    localStorage.setItem('sb-hodnhjipurvjaskcsjvj-auth-token', 'x');
    supabaseAuthMock.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });

    initAuthStore();
    await storeRegistry.auth.init();

    expect(storeRegistry.auth.status).toBe('anonymous');
    expect(storeRegistry.auth.user).toBeNull();
  });
});

describe('auth store — sign-in flows (D-30 contract)', () => {
  test('signInWithPassword calls supabase.auth.signInWithPassword with { email, password }', async () => {
    initAuthStore();
    const res = await storeRegistry.auth.signInWithPassword('a@b.com', 'secret123');
    expect(supabaseAuthMock.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'secret123',
    });
    expect(res.error).toBeFalsy();
  });

  test('signInGoogle calls signInWithOAuth with provider google and redirectTo callback', async () => {
    initAuthStore();
    await storeRegistry.auth.signInGoogle();
    expect(supabaseAuthMock.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: expect.stringMatching(/\/#\/auth-callback$/) },
    });
  });

  test('signOut clears user/session/status', async () => {
    initAuthStore();
    storeRegistry.auth.user = { id: 'u1' };
    storeRegistry.auth.session = { access_token: 'x' };
    storeRegistry.auth.status = 'authed';
    await storeRegistry.auth.signOut();
    expect(supabaseAuthMock.signOut).toHaveBeenCalled();
    expect(storeRegistry.auth.status).toBe('anonymous');
    expect(storeRegistry.auth.user).toBeNull();
    expect(storeRegistry.auth.session).toBeNull();
  });
});

describe('auth store — onAuthStateChange (single subscription)', () => {
  test('registers onAuthStateChange exactly once across multiple lazy-loads', async () => {
    initAuthStore();
    await storeRegistry.auth.signInWithPassword('a@b.com', 'pw1');
    await storeRegistry.auth.signInWithPassword('b@c.com', 'pw2');
    await storeRegistry.auth.signInGoogle();
    expect(supabaseAuthMock.onAuthStateChange).toHaveBeenCalledTimes(1);
  });

  test('subscription callback flips status on SIGNED_IN / SIGNED_OUT', async () => {
    initAuthStore();
    await storeRegistry.auth.signInWithPassword('a@b.com', 'pw');
    const cb = supabaseAuthMock.onAuthStateChange.mock.calls[0][0];

    cb('SIGNED_IN', { user: { id: 'u9', email: 'u9@test.dev', user_metadata: {} }, access_token: 'x' });
    expect(storeRegistry.auth.status).toBe('authed');
    expect(storeRegistry.auth.user.id).toBe('u9');

    cb('SIGNED_OUT', null);
    expect(storeRegistry.auth.status).toBe('anonymous');
    expect(storeRegistry.auth.user).toBeNull();
    expect(storeRegistry.auth.session).toBeNull();
  });
});
