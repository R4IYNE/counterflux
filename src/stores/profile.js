import Alpine from 'alpinejs';

const STORAGE_KEY = 'cf_profile';

function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveProfile(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function initProfileStore() {
  const saved = loadProfile();

  Alpine.store('profile', {
    name: saved.name || '',
    email: saved.email || '',
    avatar: saved.avatar || '',

    get displayName() {
      return this.name || 'Set up profile';
    },

    get initials() {
      if (!this.name) return '?';
      return this.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    },

    update(fields) {
      if (fields.name !== undefined) this.name = fields.name;
      if (fields.email !== undefined) this.email = fields.email;
      if (fields.avatar !== undefined) this.avatar = fields.avatar;
      saveProfile({ name: this.name, email: this.email, avatar: this.avatar });
    },
  });
}
