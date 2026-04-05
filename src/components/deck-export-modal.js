/**
 * Deck export modal -- select format, preview, copy/download.
 *
 * Uses imperative DOM approach with glass overlay.
 */

import { exportPlaintext, exportMTGO, exportArena, exportCSV } from '../services/deck-export.js';
import { db } from '../db/schema.js';

let activeModal = null;

/**
 * Open the deck export modal for the active deck.
 */
export async function openDeckExportModal() {
  if (activeModal) closeModal();

  const Alpine = window.Alpine;
  const store = Alpine?.store('deck');
  const toast = Alpine?.store('toast');

  if (!store?.activeDeck) {
    toast?.show('No active deck to export.', 'warning');
    return;
  }

  // Resolve commander card data
  let commanderCard = null;
  if (store.activeDeck.commander_id) {
    commanderCard = await db.cards.get(store.activeDeck.commander_id);
  }

  const formats = [
    { key: 'plaintext', label: 'Plain Text', ext: '.txt' },
    { key: 'mtgo', label: 'MTGO', ext: '.dec' },
    { key: 'arena', label: 'Arena', ext: '.txt' },
    { key: 'csv', label: 'CSV', ext: '.csv' },
  ];
  let selectedFormat = 'plaintext';

  // Backdrop
  const backdrop = document.createElement('div');
  backdrop.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    z-index: 9999; display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.6);
  `;

  // Modal container
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: relative; z-index: 10; width: 100%; max-width: 620px;
    background: #14161C; border: 1px solid #2A2D3A; padding: 24px;
    display: flex; flex-direction: column; gap: 16px;
  `;
  modal.addEventListener('click', e => e.stopPropagation());

  // Title
  const title = document.createElement('h2');
  title.textContent = 'Export Decklist';
  title.style.cssText = `
    font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700;
    color: #EAECEE; margin: 0;
  `;
  modal.appendChild(title);

  // Format selection row
  const formatRow = document.createElement('div');
  formatRow.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';

  const formatButtons = {};
  for (const fmt of formats) {
    const btn = document.createElement('button');
    btn.textContent = fmt.label;
    btn.dataset.format = fmt.key;
    btn.style.cssText = `
      padding: 6px 12px; cursor: pointer;
      font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
      letter-spacing: 0.15em; font-weight: 700;
    `;
    btn.addEventListener('click', () => {
      selectedFormat = fmt.key;
      updateFormatButtons();
      updatePreview();
    });
    formatRow.appendChild(btn);
    formatButtons[fmt.key] = btn;
  }
  modal.appendChild(formatRow);

  // Preview textarea (readonly)
  const preview = document.createElement('textarea');
  preview.readOnly = true;
  preview.style.cssText = `
    width: 100%; min-height: 200px; padding: 12px; resize: vertical;
    background: #0B0C10; border: 1px solid #2A2D3A; color: #EAECEE;
    font-family: 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.5;
  `;
  modal.appendChild(preview);

  // Action buttons
  const actions = document.createElement('div');
  actions.style.cssText = 'display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'CLOSE';
  closeBtn.style.cssText = `
    padding: 8px 16px; cursor: pointer;
    font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.15em; font-weight: 700; color: #7A8498;
    background: #1C1F28; border: 1px solid #2A2D3A;
  `;
  closeBtn.addEventListener('click', closeModal);

  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'COPY TO CLIPBOARD';
  copyBtn.style.cssText = `
    padding: 8px 16px; cursor: pointer;
    font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.15em; font-weight: 700; background: #1C1F28;
    color: #EAECEE; border: 1px solid #2A2D3A;
  `;
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(preview.value);
      toast?.show('Decklist copied to clipboard.', 'success');
    } catch {
      toast?.show('Could not copy to clipboard.', 'error');
    }
  });

  const downloadBtn = document.createElement('button');
  downloadBtn.textContent = 'DOWNLOAD';
  downloadBtn.style.cssText = `
    padding: 8px 16px; cursor: pointer;
    font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.15em; font-weight: 700; background: #0D52BD;
    color: #EAECEE; border: none;
  `;
  downloadBtn.addEventListener('click', () => {
    const fmt = formats.find(f => f.key === selectedFormat);
    const blob = new Blob([preview.value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${store.activeDeck.name || 'deck'}${fmt?.ext || '.txt'}`;
    a.click();
    URL.revokeObjectURL(url);
    toast?.show('Decklist downloaded.', 'success');
  });

  actions.appendChild(closeBtn);
  actions.appendChild(copyBtn);
  actions.appendChild(downloadBtn);
  modal.appendChild(actions);

  function updateFormatButtons() {
    for (const [key, btn] of Object.entries(formatButtons)) {
      if (key === selectedFormat) {
        btn.style.background = 'var(--color-primary, #0D52BD)';
        btn.style.color = 'var(--color-text-primary, #EAECEE)';
        btn.style.border = 'none';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--color-text-muted, #7A8498)';
        btn.style.border = '1px solid var(--color-border-ghost, #2A2D3A)';
      }
    }
  }

  function updatePreview() {
    const cards = store.activeCards || [];
    const deck = store.activeDeck;

    switch (selectedFormat) {
      case 'plaintext':
        preview.value = exportPlaintext(cards, deck, commanderCard);
        break;
      case 'mtgo':
        preview.value = exportMTGO(cards, deck, commanderCard);
        break;
      case 'arena':
        preview.value = exportArena(cards, deck, commanderCard);
        break;
      case 'csv':
        preview.value = exportCSV(cards, deck, commanderCard);
        break;
    }
  }

  // Escape to close
  const handleEscape = e => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', handleEscape);
  backdrop.addEventListener('click', closeModal);

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  activeModal = { backdrop, handleEscape };

  // Initial state
  updateFormatButtons();
  updatePreview();
}

function closeModal() {
  if (!activeModal) return;
  document.removeEventListener('keydown', activeModal.handleEscape);
  activeModal.backdrop.remove();
  activeModal = null;
}
