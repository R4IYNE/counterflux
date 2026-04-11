/**
 * Settings modal — profile management.
 * Accessible from sidebar profile widget.
 */

let modalEl = null;

export function openSettingsModal() {
  if (modalEl) return;

  const Alpine = window.Alpine;
  const profile = Alpine.store('profile');

  modalEl = document.createElement('div');
  modalEl.style.cssText = 'position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; background: rgba(11, 12, 16, 0.85);';
  modalEl.addEventListener('click', (e) => { if (e.target === modalEl) closeSettingsModal(); });

  const card = document.createElement('div');
  card.style.cssText = 'background: #14161C; border: 1px solid #2A2D3A; padding: 32px; width: 100%; max-width: 420px;';

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;';
  header.innerHTML = `
    <h2 style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #EAECEE; letter-spacing: 0.01em;">Settings</h2>
    <button id="settings-close" style="background: none; border: none; color: #7A8498; cursor: pointer; font-size: 24px;">
      <span class="material-symbols-outlined">close</span>
    </button>
  `;
  card.appendChild(header);

  // Avatar section
  const avatarSection = document.createElement('div');
  avatarSection.style.cssText = 'display: flex; align-items: center; gap: 16px; margin-bottom: 24px;';

  const avatarPreview = document.createElement('div');
  avatarPreview.id = 'settings-avatar-preview';
  _renderAvatar(avatarPreview, profile);

  const avatarControls = document.createElement('div');
  avatarControls.innerHTML = `
    <label style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #0D52BD; cursor: pointer; display: inline-block; padding: 4px 8px; border: 1px solid #2A2D3A; background: #1C1F28;">
      UPLOAD PHOTO
      <input type="file" id="settings-avatar-input" accept="image/*" style="display: none;">
    </label>
    <button id="settings-avatar-clear" style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 400; text-transform: uppercase; letter-spacing: 0.15em; color: #7A8498; cursor: pointer; background: none; border: none; margin-left: 8px;">REMOVE</button>
  `;
  avatarSection.appendChild(avatarPreview);
  avatarSection.appendChild(avatarControls);
  card.appendChild(avatarSection);

  // Name field
  card.appendChild(_buildField('DISPLAY NAME', 'settings-name', profile.name, 'Your name'));

  // Email field
  card.appendChild(_buildField('EMAIL', 'settings-email', profile.email, 'your@email.com'));

  // Save button
  const actions = document.createElement('div');
  actions.style.cssText = 'margin-top: 24px; display: flex; gap: 8px;';
  actions.innerHTML = `
    <button id="settings-save" style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; background: #0D52BD; color: #EAECEE; border: none; padding: 8px 24px; cursor: pointer;">
      SAVE
    </button>
    <button id="settings-cancel" style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; background: #1C1F28; color: #EAECEE; border: 1px solid #2A2D3A; padding: 8px 24px; cursor: pointer;">
      CANCEL
    </button>
  `;
  card.appendChild(actions);

  modalEl.appendChild(card);
  document.body.appendChild(modalEl);

  // Wire events
  card.querySelector('#settings-close').addEventListener('click', closeSettingsModal);
  card.querySelector('#settings-cancel').addEventListener('click', closeSettingsModal);

  card.querySelector('#settings-save').addEventListener('click', () => {
    const name = card.querySelector('#settings-name').value.trim();
    const email = card.querySelector('#settings-email').value.trim();
    profile.update({ name, email });
    Alpine.store('toast')?.success('Profile updated.');
    closeSettingsModal();
  });

  card.querySelector('#settings-avatar-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500000) {
      Alpine.store('toast')?.warning('Image too large — max 500KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      profile.update({ avatar: reader.result });
      _renderAvatar(card.querySelector('#settings-avatar-preview'), profile);
    };
    reader.readAsDataURL(file);
  });

  card.querySelector('#settings-avatar-clear').addEventListener('click', () => {
    profile.update({ avatar: '' });
    _renderAvatar(card.querySelector('#settings-avatar-preview'), profile);
  });

  // Escape to close
  const escHandler = (e) => { if (e.key === 'Escape') closeSettingsModal(); };
  document.addEventListener('keydown', escHandler);
  modalEl._escHandler = escHandler;
}

export function closeSettingsModal() {
  if (!modalEl) return;
  if (modalEl._escHandler) document.removeEventListener('keydown', modalEl._escHandler);
  modalEl.remove();
  modalEl = null;
}

function _buildField(label, id, value, placeholder) {
  const group = document.createElement('div');
  group.style.cssText = 'margin-bottom: 16px;';
  group.innerHTML = `
    <label for="${id}" style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #0D52BD; display: block; margin-bottom: 8px;">${label}</label>
    <input type="text" id="${id}" value="${value || ''}" placeholder="${placeholder}"
      style="width: 100%; box-sizing: border-box; font-family: 'Space Grotesk', sans-serif; font-size: 14px; background: #0B0C10; border: 1px solid #2A2D3A; color: #EAECEE; padding: 8px 12px;">
  `;
  return group;
}

function _renderAvatar(container, profile) {
  if (profile.avatar) {
    container.innerHTML = `<img src="${profile.avatar}" style="width: 56px; height: 56px; object-fit: cover; border: 1px solid #2A2D3A;">`;
  } else {
    container.innerHTML = `
      <div style="width: 56px; height: 56px; background: #1C1F28; border: 1px solid #2A2D3A; display: flex; align-items: center; justify-content: center;">
        <span style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #7A8498;">${profile.initials}</span>
      </div>
    `;
  }
}
