// src/stores/profile.js
//
// Phase 10 Plan 4 — auth-aware profile store (D-15, D-19, D-22, D-28, ARCHITECTURE.md Pattern 1).
//
// Modes:
//   anonymous → _source='local', localStorage persistence (v1.0 behaviour preserved)
//   authed    → _source='cloud', counterflux.profile row via Supabase
//
// Auth-flip re-hydration is driven by Alpine.effect in src/main.js — hydrate() is
// invoked whenever auth.status changes. On authed the store queries the cloud row;
// on anonymous (sign-out path) it re-reads localStorage so the profile reverts
// seamlessly. Dexie tables are NEVER touched (D-22 / AUTH-05 local-first contract).

import Alpine from 'alpinejs';

const STORAGE_KEY = 'cf_profile';

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveLocal(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* quota or denied — silently swallow, next tick will retry */ }
}

export function initProfileStore() {
  const saved = loadLocal();

  Alpine.store('profile', {
    // User-visible fields. Writable in anonymous mode; mirrored to both
    // localStorage and counterflux.profile in authed mode.
    name: saved.name || '',
    email: saved.email || '',                             // Local-only preference when signed-out; overridden by auth.user.email in signed-in views (but kept in localStorage so sign-out restores it — D-19).
    avatar: saved.avatar || '',                           // v1.0 legacy field — retained for back-compat with sidebar + settings-modal wiring that predates Plan 4.
    avatar_url_override: saved.avatar_url_override || '', // D-15: user-uploaded URL that takes priority over Google avatar.

    _source: 'local',                                     // 'local' | 'cloud'
    _loaded: false,                                       // true after first hydrate completes; used by first-sign-in-prompt to avoid racing with store init.

    get displayName() {
      if (this.name) return this.name;
      const auth = Alpine.store('auth');
      const u = auth?.user;
      return u?.user_metadata?.full_name
          || u?.user_metadata?.given_name
          || (u?.email ? u.email.split('@')[0] : '')
          || 'Set up profile';
    },

    get initials() {
      const source = this.name || this.displayName;
      if (!source || source === 'Set up profile') return '?';
      return source.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2);
    },

    // D-15 avatar priority: uploaded override → Google avatar → legacy profile.avatar → ''
    get effectiveAvatarUrl() {
      if (this.avatar_url_override) return this.avatar_url_override;
      const auth = Alpine.store('auth');
      const googleUrl = auth?.user?.user_metadata?.avatar_url;
      if (googleUrl) return googleUrl;
      if (this.avatar) return this.avatar;
      return '';
    },

    /**
     * Re-fetch profile state based on current auth status.
     * Called by the Alpine.effect bridge in src/main.js on every auth.status transition
     * AND proactively by first-sign-in-prompt after its upsert resolves.
     */
    async hydrate() {
      const auth = Alpine.store('auth');
      const status = auth?.status || 'anonymous';

      if (status !== 'authed') {
        // Re-hydrate from localStorage (sign-out path or cold boot anonymous).
        // Dexie is intentionally NOT touched — D-22 / AUTH-05.
        const local = loadLocal();
        this.name = local.name || '';
        this.email = local.email || '';
        this.avatar = local.avatar || '';
        this.avatar_url_override = local.avatar_url_override || '';
        this._source = 'local';
        this._loaded = true;
        return;
      }

      // Authed path — query counterflux.profile row via lazy-loaded Supabase.
      try {
        const { getSupabase } = await import('../services/supabase.js');
        const supabase = getSupabase();
        const { data, error } = await supabase
          .schema('counterflux')
          .from('profile')
          .select('*')
          .eq('user_id', auth.user.id)
          .maybeSingle();

        if (error) {
          console.warn('[Counterflux] profile hydrate failed:', error);
          this._source = 'local';    // fall back — first-sign-in-prompt will handle
          this._loaded = true;
          return;
        }

        if (!data) {
          // No cloud row yet — this is the first-sign-in case. Keep local values
          // intact so first-sign-in-prompt can offer "Keep local profile" with
          // the user's existing v1.0 data.
          this._source = 'local';
          this._loaded = true;
          return;
        }

        // Cloud row exists — populate.
        this.name = data.name || '';
        this.avatar_url_override = data.avatar_url || '';
        // Email field tracks auth.user.email in authed view (read-only).
        this.email = auth.user.email || '';
        this._source = 'cloud';
        this._loaded = true;
      } catch (err) {
        console.warn('[Counterflux] profile hydrate exception:', err);
        this._source = 'local';
        this._loaded = true;
      }
    },

    /**
     * Update profile fields. In anonymous mode persists to localStorage only.
     * In cloud mode upserts counterflux.profile AND writes localStorage as a
     * backup so sign-out round-trips cleanly (D-19).
     *
     * Returns { error: null } on success, { error: <err> } on cloud failure.
     * Anonymous updates always succeed (localStorage writes swallow quota errors).
     */
    async update(fields) {
      if (fields.name !== undefined) this.name = fields.name;
      if (fields.email !== undefined) this.email = fields.email;
      if (fields.avatar !== undefined) this.avatar = fields.avatar;
      if (fields.avatar_url_override !== undefined) this.avatar_url_override = fields.avatar_url_override;

      // Always mirror to localStorage so sign-out round-trips cleanly (D-19).
      saveLocal({
        name: this.name,
        email: this.email,
        avatar: this.avatar,
        avatar_url_override: this.avatar_url_override,
      });

      if (this._source === 'cloud') {
        try {
          const auth = Alpine.store('auth');
          if (!auth?.user?.id) return { error: new Error('No auth user') };
          const { getSupabase } = await import('../services/supabase.js');
          const supabase = getSupabase();

          // counterflux.profile PK is a text UUID; callers commonly omit id.
          // Fetch the existing row id if any, else generate one.
          const { data: existing } = await supabase
            .schema('counterflux')
            .from('profile')
            .select('id')
            .eq('user_id', auth.user.id)
            .maybeSingle();

          const payload = {
            id: existing?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'p-' + Math.random().toString(36).slice(2)),
            user_id: auth.user.id,
            name: this.name,
            avatar_url: this.avatar_url_override || null,
            updated_at: new Date().toISOString(),
          };

          const { error } = await supabase
            .schema('counterflux')
            .from('profile')
            .upsert(payload, { onConflict: 'user_id' });
          return { error };
        } catch (err) {
          return { error: err };
        }
      }
      return { error: null };
    },

    async setAvatarOverride(dataUrl) {
      return this.update({ avatar_url_override: dataUrl });
    },

    async clearAvatarOverride() {
      return this.update({ avatar_url_override: '' });
    },
  });
}
