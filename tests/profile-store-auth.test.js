// tests/profile-store-auth.test.js
// Phase 10 Plan 4 — auth-aware profile store contract tests (D-15, D-19, D-28).
//
// Covers 7 behaviours:
//   1. Anonymous init: localStorage only, _source === 'local', no supabase call
//   2. Auth flip → hydrate queries counterflux.profile
//   3. Cloud row exists → populates + _source === 'cloud' + _loaded === true
//   4. Cloud row missing → keeps prior local values, _source stays 'local' (migration signal)
//   5. Auth flip back to anonymous → re-hydrates from localStorage, Dexie untouched
//   6. Update while _source === 'cloud' → upserts + writes localStorage backup (D-19)
//   7. setAvatarOverride + clearAvatarOverride → D-15 priority honoured

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

// Supabase chain mock: supabase.schema(...).from(...).select(...).eq(...).maybeSingle() / .upsert(...)
const profileRowStore = { row: null };
const selectChain = {
  eq: vi.fn(function () { return this; }),
  maybeSingle: vi.fn(async () => ({ data: profileRowStore.row, error: null })),
};
const fromChain = {
  select: vi.fn(() => selectChain),
  upsert: vi.fn(async (payload) => {
    profileRowStore.row = { ...payload };
    return { error: null };
  }),
};
const schemaChain = {
  from: vi.fn(() => fromChain),
};
const supabaseClient = {
  schema: vi.fn(() => schemaChain),
};
const getSupabaseMock = vi.fn(() => supabaseClient);
vi.mock('../src/services/supabase.js', () => ({
  getSupabase: getSupabaseMock,
  __resetSupabaseClient: vi.fn(),
}));

// --- Test environment shims ------------------------------------------------

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
  if (!globalThis.crypto) globalThis.crypto = {};
  if (!globalThis.crypto.randomUUID) globalThis.crypto.randomUUID = () => 'test-uuid-' + Math.random().toString(36).slice(2);
  return storage;
}

// --- Imports under test ----------------------------------------------------

let initProfileStore;

beforeEach(async () => {
  installLocalStorage();
  for (const k of Object.keys(storeRegistry)) delete storeRegistry[k];
  profileRowStore.row = null;
  vi.clearAllMocks();

  // Seed an auth store (anonymous by default)
  storeRegistry.auth = {
    status: 'anonymous',
    user: null,
    session: null,
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
  vi.doMock('../src/services/supabase.js', () => ({
    getSupabase: getSupabaseMock,
    __resetSupabaseClient: vi.fn(),
  }));
  const mod = await import('../src/stores/profile.js');
  initProfileStore = mod.initProfileStore;
});

afterEach(() => {
  localStorage.clear();
});

describe('profile store — anonymous init (v1.0 parity)', () => {
  test('Test 1: anonymous init reads localStorage and _source === "local" with no supabase call', async () => {
    localStorage.setItem('cf_profile', JSON.stringify({ name: 'James', email: 'james@test.dev', avatar: 'data:image/png;base64,xxx' }));

    initProfileStore();
    const profile = storeRegistry.profile;

    expect(profile.name).toBe('James');
    expect(profile.email).toBe('james@test.dev');
    expect(profile.avatar).toBe('data:image/png;base64,xxx');
    expect(profile._source).toBe('local');

    // update() should write to localStorage, not supabase
    await profile.update({ name: 'James Arnall' });
    expect(profile.name).toBe('James Arnall');
    expect(JSON.parse(localStorage.getItem('cf_profile')).name).toBe('James Arnall');
    expect(getSupabaseMock).not.toHaveBeenCalled();
  });
});

describe('profile store — auth flip triggers hydrate (D-28)', () => {
  test('Test 2: auth flip anonymous → authed + hydrate dynamically imports supabase and queries counterflux.profile', async () => {
    initProfileStore();
    const profile = storeRegistry.profile;

    // Flip auth to authed
    storeRegistry.auth.status = 'authed';
    storeRegistry.auth.user = { id: 'user-abc', email: 'a@b.com', user_metadata: {} };

    // No cloud row yet (profileRowStore.row = null)
    await profile.hydrate();

    expect(getSupabaseMock).toHaveBeenCalled();
    expect(supabaseClient.schema).toHaveBeenCalledWith('counterflux');
    expect(schemaChain.from).toHaveBeenCalledWith('profile');
    expect(selectChain.eq).toHaveBeenCalledWith('user_id', 'user-abc');
    expect(selectChain.maybeSingle).toHaveBeenCalled();
  });

  test('Test 3: cloud profile exists → populates fields, _source === "cloud", _loaded === true', async () => {
    initProfileStore();
    const profile = storeRegistry.profile;

    storeRegistry.auth.status = 'authed';
    storeRegistry.auth.user = { id: 'user-xyz', email: 'cloud@test.dev', user_metadata: { avatar_url: 'https://google/pic.jpg' } };
    profileRowStore.row = {
      id: 'profile-uuid',
      user_id: 'user-xyz',
      name: 'Cloud James',
      avatar_url: 'data:image/png;base64,clouduploaded',
      updated_at: new Date().toISOString(),
    };

    await profile.hydrate();

    expect(profile.name).toBe('Cloud James');
    expect(profile.avatar_url_override).toBe('data:image/png;base64,clouduploaded');
    expect(profile.email).toBe('cloud@test.dev');
    expect(profile._source).toBe('cloud');
    expect(profile._loaded).toBe(true);
  });

  test('Test 4: cloud profile missing → keeps prior local values, _source stays "local" (migration signal)', async () => {
    localStorage.setItem('cf_profile', JSON.stringify({ name: 'Local James', avatar: '' }));

    initProfileStore();
    const profile = storeRegistry.profile;

    storeRegistry.auth.status = 'authed';
    storeRegistry.auth.user = { id: 'user-new', email: 'new@test.dev', user_metadata: {} };
    profileRowStore.row = null; // no cloud row yet

    await profile.hydrate();

    // Local values preserved so first-sign-in-prompt can offer "Keep local"
    expect(profile.name).toBe('Local James');
    expect(profile._source).toBe('local');
    expect(profile._loaded).toBe(true);
  });
});

describe('profile store — sign-out rehydrate (D-22 local preservation)', () => {
  test('Test 5: auth flip authed → anonymous re-hydrates from localStorage', async () => {
    localStorage.setItem('cf_profile', JSON.stringify({ name: 'Local Name', avatar: '', email: 'local@test.dev' }));

    initProfileStore();
    const profile = storeRegistry.profile;

    // Simulate signed-in state first
    storeRegistry.auth.status = 'authed';
    storeRegistry.auth.user = { id: 'user-1', email: 'cloud@test.dev', user_metadata: {} };
    profileRowStore.row = {
      id: 'p1',
      user_id: 'user-1',
      name: 'Cloud Name',
      avatar_url: '',
      updated_at: new Date().toISOString(),
    };
    await profile.hydrate();
    expect(profile._source).toBe('cloud');

    // Now sign out
    storeRegistry.auth.status = 'anonymous';
    storeRegistry.auth.user = null;
    await profile.hydrate();

    expect(profile.name).toBe('Local Name');
    expect(profile.email).toBe('local@test.dev');
    expect(profile._source).toBe('local');
  });
});

describe('profile store — authed update upserts to counterflux.profile', () => {
  test('Test 6: update while _source === "cloud" upserts + writes localStorage backup (D-19)', async () => {
    initProfileStore();
    const profile = storeRegistry.profile;

    storeRegistry.auth.status = 'authed';
    storeRegistry.auth.user = { id: 'user-save', email: 'save@test.dev', user_metadata: {} };
    profileRowStore.row = {
      id: 'profile-uuid',
      user_id: 'user-save',
      name: 'Old',
      avatar_url: '',
      updated_at: new Date().toISOString(),
    };
    await profile.hydrate();
    expect(profile._source).toBe('cloud');

    await profile.update({ name: 'New Name' });

    // Upsert called with user_id + name + onConflict
    expect(fromChain.upsert).toHaveBeenCalled();
    const [payload, options] = fromChain.upsert.mock.calls[0];
    expect(payload.user_id).toBe('user-save');
    expect(payload.name).toBe('New Name');
    expect(options).toEqual({ onConflict: 'user_id' });

    // localStorage backup written (D-19)
    const local = JSON.parse(localStorage.getItem('cf_profile'));
    expect(local.name).toBe('New Name');
  });
});

describe('profile store — avatar override D-15 priority', () => {
  test('Test 7: setAvatarOverride + clearAvatarOverride + effectiveAvatarUrl priority', async () => {
    initProfileStore();
    const profile = storeRegistry.profile;

    // Seed auth with Google avatar
    storeRegistry.auth.status = 'authed';
    storeRegistry.auth.user = { id: 'user-av', email: 'av@test.dev', user_metadata: { avatar_url: 'https://google/me.jpg' } };

    // No override → Google avatar wins
    expect(profile.effectiveAvatarUrl).toBe('https://google/me.jpg');

    // Set override
    profile._source = 'cloud';
    await profile.setAvatarOverride('data:image/png;base64,override');
    expect(profile.avatar_url_override).toBe('data:image/png;base64,override');
    expect(profile.effectiveAvatarUrl).toBe('data:image/png;base64,override');

    // Clear override → Google again
    await profile.clearAvatarOverride();
    expect(profile.avatar_url_override).toBe('');
    expect(profile.effectiveAvatarUrl).toBe('https://google/me.jpg');

    // Remove Google avatar → falls back to legacy profile.avatar
    storeRegistry.auth.user.user_metadata = {};
    profile.avatar = 'data:image/png;base64,legacy';
    expect(profile.effectiveAvatarUrl).toBe('data:image/png;base64,legacy');

    // Clear legacy → empty
    profile.avatar = '';
    expect(profile.effectiveAvatarUrl).toBe('');
  });
});
