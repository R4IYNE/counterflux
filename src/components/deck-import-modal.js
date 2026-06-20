/**
 * Deck import modal -- paste/drop a decklist, auto-detect format, resolve cards.
 *
 * Uses imperative DOM approach (same as deck centre panel pattern).
 * Creates a glass overlay with textarea, format badge, and resolution results.
 */

import { detectFormat, parseDecklist, resolveDecklist } from '../services/deck-import.js';
import { searchCards } from '../db/search.js';
import { validateDeck } from '../services/deck-legality.js';
import { mergeColorIdentity } from '../utils/commander-detection.js';
import { attachFocusTrap } from '../utils/focus-trap.js';

let activeModal = null;

/**
 * Open the deck import modal for the given deck.
 * @param {number} deckId - Active deck ID
 */
export function openDeckImportModal(deckId) {
  if (activeModal) closeModal();

  const Alpine = window.Alpine;
  const store = Alpine?.store('deck');
  const toast = Alpine?.store('toast');

  // Backdrop
  const backdrop = document.createElement('div');
  backdrop.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    z-index: 9999; display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.6);
  `;

  // Modal container
  const modal = document.createElement('div');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'deck-import-heading');
  modal.style.cssText = `
    position: relative; z-index: 10; width: 100%; max-width: 620px;
    background: #14161C; border: 1px solid #2A2D3A; padding: 24px;
    display: flex; flex-direction: column; gap: 16px;
  `;
  modal.addEventListener('click', e => e.stopPropagation());

  // Title
  const title = document.createElement('h2');
  title.id = 'deck-import-heading';
  title.textContent = 'Import Decklist';
  title.style.cssText = `
    font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700;
    color: #EAECEE; margin: 0;
  `;
  modal.appendChild(title);

  // Textarea
  const textarea = document.createElement('textarea');
  textarea.placeholder = 'PASTE DECKLIST OR DROP FILE...';
  textarea.style.cssText = `
    width: 100%; min-height: 200px; padding: 12px; resize: vertical;
    background: #0B0C10; border: 1px solid #2A2D3A; color: #EAECEE;
    font-family: 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.5;
  `;
  modal.appendChild(textarea);

  // Format badge
  const formatBadge = document.createElement('div');
  formatBadge.style.cssText = `
    display: none; align-items: center; gap: 8px;
    font-family: 'JetBrains Mono', monospace; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.15em; font-weight: 400;
  `;
  const formatLabel = document.createElement('span');
  formatLabel.textContent = 'DETECTED FORMAT:';
  formatLabel.style.color = '#7A8498';
  const formatValue = document.createElement('span');
  formatValue.style.cssText = 'color: var(--color-primary-text, #5B9BF5); font-weight: 700;';
  formatBadge.appendChild(formatLabel);
  formatBadge.appendChild(formatValue);
  modal.appendChild(formatBadge);

  // Results area (hidden initially)
  const resultsArea = document.createElement('div');
  resultsArea.style.cssText = 'display: none; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto;';
  modal.appendChild(resultsArea);

  // Loading indicator
  const loadingEl = document.createElement('div');
  loadingEl.textContent = 'RESOLVING CARDS...';
  loadingEl.style.cssText = `
    display: none; font-family: 'JetBrains Mono', monospace; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.15em; color: #7A8498;
  `;
  modal.appendChild(loadingEl);

  // Action buttons
  const actions = document.createElement('div');
  actions.style.cssText = 'display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'CANCEL';
  cancelBtn.style.cssText = `
    padding: 8px 16px; cursor: pointer;
    font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.15em; font-weight: 700; color: #7A8498;
    background: #1C1F28; border: 1px solid #2A2D3A;
  `;
  cancelBtn.addEventListener('click', closeModal);

  const importBtn = document.createElement('button');
  importBtn.textContent = 'IMPORT';
  importBtn.style.cssText = `
    padding: 8px 16px; cursor: pointer;
    font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.15em; font-weight: 700; background: #0D52BD;
    color: #EAECEE; border: none;
  `;

  actions.appendChild(cancelBtn);
  actions.appendChild(importBtn);
  modal.appendChild(actions);

  // Detect format on input
  textarea.addEventListener('input', () => {
    const text = textarea.value.trim();
    if (text.length > 5) {
      const format = detectFormat(text);
      formatValue.textContent = format.toUpperCase();
      formatBadge.style.display = 'flex';
    } else {
      formatBadge.style.display = 'none';
    }
  });

  // File drop support
  textarea.addEventListener('dragover', e => {
    e.preventDefault();
    textarea.style.borderColor = '#0D52BD';
  });
  textarea.addEventListener('dragleave', () => {
    textarea.style.borderColor = '#2A2D3A';
  });
  textarea.addEventListener('drop', async e => {
    e.preventDefault();
    textarea.style.borderColor = '#2A2D3A';
    const file = e.dataTransfer?.files?.[0];
    if (file && (file.name.endsWith('.txt') || file.name.endsWith('.dec') || file.name.endsWith('.csv'))) {
      const text = await file.text();
      textarea.value = text;
      textarea.dispatchEvent(new Event('input'));
    }
  });

  // Import action
  importBtn.addEventListener('click', async () => {
    const text = textarea.value.trim();
    if (!text) return;

    importBtn.disabled = true;
    importBtn.style.opacity = '0.5';
    loadingEl.style.display = 'block';

    try {
      const parsed = parseDecklist(text);
      const { resolved, unresolved } = await resolveDecklist(parsed, searchCards);

      // Partition the resolved list (audit M16): commander(s)/companion/sideboard
      // are not plain maindeck cards.
      const commanders = resolved.filter((e) => e.isCommander);
      const companionEntry = resolved.find((e) => e.isCompanion);
      const sideboard = resolved.filter((e) => e.isSideboard);
      const maindeck = resolved.filter((e) => !e.isCommander && !e.isCompanion && !e.isSideboard);

      // Commander (+ partner) — merge colour identity and persist partner_id +
      // companion_id (audit M29: import previously set CI to the first commander's
      // colours only and never wrote partner_id/companion_id).
      if (commanders.length && store?.activeDeck) {
        const [cmd, partner] = commanders;
        const ci = partner
          ? mergeColorIdentity(cmd.card?.color_identity || [], partner.card?.color_identity || [])
          : (cmd.card?.color_identity || []);
        await store.changeCommander(
          store.activeDeck.id,
          cmd.scryfallId,
          ci,
          partner?.scryfallId || null,
          companionEntry?.scryfallId || null,
        );
      }

      // Add commander(s) + companion + maindeck as deck_cards. Honor the parsed
      // per-line quantity (audit H1). Sideboard cards are NOT added to the 99 (M16).
      const toAdd = [...commanders, ...(companionEntry ? [companionEntry] : []), ...maindeck];
      for (const entry of toAdd) {
        const qty = Math.max(1, Math.floor(Number(entry.qty)) || 1);
        await store?.addCard(entry.scryfallId, [], qty);
      }

      // Legality summary on the resulting deck (audit H5).
      const deck = store?.activeDeck;
      const legality = validateDeck({
        format: deck?.format || 'commander',
        commanderColorIdentity: deck?.color_identity || [],
        deckSize: deck?.deck_size || 100,
        cards: store?.activeCards || [],
      });

      // Show results — legality warnings, skipped sideboard, and unresolved cards.
      const hasResults = legality.hasIssues || sideboard.length > 0 || unresolved.length > 0;
      if (hasResults) {
        resultsArea.innerHTML = '';
        resultsArea.style.display = 'flex';

        const section = (label, colour, lines) => {
          if (!lines.length) return;
          const h = document.createElement('span');
          h.textContent = label;
          h.style.cssText = `font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: ${colour};`;
          resultsArea.appendChild(h);
          for (const line of lines) {
            const row = document.createElement('div');
            row.style.cssText = `padding: 4px 8px; background: #1C1F28; border: 1px solid #2A2D3A; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #EAECEE;`;
            row.textContent = line;
            resultsArea.appendChild(row);
          }
        };

        section('DECK LEGALITY', '#E2A838', legality.warnings);
        section('SIDEBOARD (NOT ADDED)', '#7A8498', sideboard.map((s) => `${s.qty}x ${s.name}`));
        section('COULD NOT BE RESOLVED', '#E23838', unresolved.map((u) => `${u.qty}x ${u.name}`));
      }

      // Dispatch change event for centre panel refresh
      document.dispatchEvent(new CustomEvent('deck-cards-changed'));

      const added = resolved.length - sideboard.length;
      const msg = `Decklist imported. ${added} card${added === 1 ? '' : 's'} added, ${unresolved.length} need review.`;
      toast?.show(msg, (unresolved.length > 0 || legality.hasIssues) ? 'warning' : 'success');

      if (unresolved.length === 0 && !legality.hasIssues && sideboard.length === 0) {
        closeModal();
      }
    } catch (err) {
      console.error('[Counterflux] Import error:', err);
      toast?.show('Import failed: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      importBtn.disabled = false;
      importBtn.style.opacity = '1';
      loadingEl.style.display = 'none';
    }
  });

  // Click backdrop to close
  backdrop.addEventListener('click', closeModal);

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  // Focus trap + Escape + initial focus on the textarea (audit M7).
  const detachTrap = attachFocusTrap(modal, { onEscape: closeModal, initialFocus: textarea });
  activeModal = { backdrop, detachTrap };
}

function closeModal() {
  if (!activeModal) return;
  activeModal.detachTrap?.();
  activeModal.backdrop.remove();
  activeModal = null;
}
