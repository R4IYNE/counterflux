/**
 * Delete deck confirmation modal.
 * Shows a destructive action confirmation dialog for removing a deck.
 */

import { attachFocusTrap } from '../utils/focus-trap.js';

/**
 * Open the delete deck confirmation modal.
 * @param {number} deckId - ID of the deck to delete
 * @param {string} deckName - Name of the deck (for display)
 * @param {{ afterDelete?: Function }} [options] - afterDelete runs once the
 *   deck is removed (used by the editor to navigate back to the landing).
 */
export function openDeleteDeckModal(deckId, deckName, options = {}) {
  // Remove existing modal if present — detach its focus trap first so the
  // capture-phase keydown listener doesn't leak on a re-open (audit M7 follow-up).
  const _existingDeleteDeck = document.getElementById('delete-deck-modal');
  _existingDeleteDeck?.__cfTrapDetach?.();
  _existingDeleteDeck?.remove();

  const Alpine = window.Alpine;
  const store = Alpine?.store('deck');

  const overlay = document.createElement('div');
  overlay.id = 'delete-deck-modal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'delete-deck-heading');
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    z-index: 9999; display: flex; align-items: center; justify-content: center;
  `;

  overlay.innerHTML = `
    <!-- Glass backdrop -->
    <div id="delete-deck-backdrop" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6);"></div>

    <!-- Modal panel -->
    <div style="position: relative; z-index: 10; width: 100%; max-width: 400px; background: #14161C; border: 1px solid #2A2D3A; padding: 24px; display: flex; flex-direction: column; gap: 16px;">
      <!-- Heading — deckName is user-authored (rename prompt / brew) and syncs
           across the household account, so it MUST be escaped before innerHTML. -->
      <h3 id="delete-deck-heading" style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; line-height: 1.2; letter-spacing: 0.01em; color: #EAECEE; margin: 0;">
        Delete "${_escape(deckName)}"?
      </h3>

      <!-- Confirmation text -->
      <p style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; line-height: 1.5; color: #EAECEE; margin: 0;">
        This removes the deck and all its cards from your archive. You'll have a few seconds to undo it afterwards.
      </p>

      <!-- Action buttons -->
      <div style="display: flex; gap: 8px; padding-top: 8px;">
        <button
          id="delete-deck-confirm"
          style="flex: 1; padding: 8px 16px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; background: #E23838; color: #EAECEE; border: none; cursor: pointer;"
          onmouseenter="this.style.opacity='0.8'"
          onmouseleave="this.style.opacity='1'"
        >
          DELETE DECK
        </button>
        <button
          id="delete-deck-cancel"
          style="flex: 1; padding: 8px 16px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; background: #1C1F28; color: #EAECEE; border: 1px solid #2A2D3A; cursor: pointer;"
        >
          KEEP DECK
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  function closeModal() {
    detachTrap();
    overlay.remove();
  }

  // Wire event handlers
  overlay.querySelector('#delete-deck-backdrop').addEventListener('click', closeModal);
  overlay.querySelector('#delete-deck-cancel').addEventListener('click', closeModal);
  overlay.querySelector('#delete-deck-confirm').addEventListener('click', () => {
    // deleteDeck removes the deck from the UI synchronously and shows its own
    // undo toast (10s window). It's fired WITHOUT await so the modal closes
    // instantly — awaiting its background snapshot reads (which can stall behind
    // a busy Dexie) is what made delete feel slow. No success toast here; the
    // undo toast is the single notification.
    store?.deleteDeck(deckId);
    closeModal();
    options.afterDelete?.();
  });

  // Focus trap + Escape (audit M7). Default focus to CANCEL, not the destructive
  // DELETE. Also fixes the L5 leak: the old Escape listener only detached when
  // Escape fired, so closing via button/backdrop leaked it — closeModal() now
  // always tears the trap down, and the singleton guard above detaches a prior
  // instance via overlay.__cfTrapDetach before replacing it.
  const detachTrap = attachFocusTrap(overlay, { onEscape: closeModal, initialFocus: '#delete-deck-cancel' });
  overlay.__cfTrapDetach = detachTrap;
}

// Escape user-authored strings before interpolating into innerHTML (matches the
// helper used in settings-modal.js / sync-errors-modal.js / sync-pull-splash.js).
function _escape(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
