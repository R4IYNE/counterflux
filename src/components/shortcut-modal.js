/**
 * Keyboard shortcut cheat sheet modal.
 * Opened via ? key, closed via Escape/? or backdrop click.
 */

const SHORTCUT_SECTIONS = [
  {
    title: 'NAVIGATION',
    shortcuts: [
      { key: '/', description: 'Focus global search' },
      { key: 'Escape', description: 'Close modal, flyout, or menu' },
    ],
  },
  {
    title: 'ACTIONS',
    shortcuts: [
      { key: 'Ctrl+Z', description: 'Undo last destructive action' },
      { key: '?', description: 'Toggle keyboard shortcuts' },
    ],
  },
];

let modalEl = null;
let isOpen = false;

export function toggleShortcutModal() {
  if (isOpen) {
    closeShortcutModal();
    return;
  }
  openShortcutModal();
}

function openShortcutModal() {
  if (modalEl) return;
  isOpen = true;

  // Backdrop
  modalEl = document.createElement('div');
  modalEl.className = 'fixed inset-0 z-50 flex items-center justify-center';
  modalEl.style.backgroundColor = 'rgba(11, 12, 16, 0.8)';
  modalEl.style.backdropFilter = 'blur(8px)';
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeShortcutModal();
  });

  // Modal box
  const box = document.createElement('div');
  box.className = 'bg-surface border border-border-ghost p-lg';
  box.style.width = '480px';
  box.style.maxHeight = '80vh';
  box.style.overflowY = 'auto';

  // Title
  const title = document.createElement('h2');
  title.className =
    'syne-header text-text-primary text-[20px] font-bold leading-[1.2] tracking-[0.01em] mb-lg';
  title.textContent = 'KEYBOARD SHORTCUTS';
  box.appendChild(title);

  // Sections
  for (const section of SHORTCUT_SECTIONS) {
    const sectionTitle = document.createElement('p');
    sectionTitle.className =
      'mono-data text-[11px] font-bold uppercase tracking-[0.15em] text-primary mb-sm mt-md';
    sectionTitle.textContent = section.title;
    box.appendChild(sectionTitle);

    for (const shortcut of section.shortcuts) {
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between py-xs';

      const kbd = document.createElement('kbd');
      kbd.className =
        'bg-surface-hover border border-border-ghost px-sm py-xs font-mono text-[11px] text-text-primary';
      kbd.textContent = shortcut.key;

      const desc = document.createElement('span');
      desc.className = 'font-body text-text-primary text-sm';
      desc.style.fontSize = '14px';
      desc.style.lineHeight = '1.5';
      desc.textContent = shortcut.description;

      row.appendChild(kbd);
      row.appendChild(desc);
      box.appendChild(row);
    }
  }

  // Close hint
  const hint = document.createElement('p');
  hint.className = 'font-body text-text-muted text-sm mt-lg';
  hint.style.fontSize = '14px';
  hint.textContent = 'Press Escape or ? to close';
  box.appendChild(hint);

  modalEl.appendChild(box);
  document.body.appendChild(modalEl);
}

export function closeShortcutModal() {
  if (modalEl) {
    modalEl.remove();
    modalEl = null;
  }
  isOpen = false;
}

export function isShortcutModalOpen() {
  return isOpen;
}
