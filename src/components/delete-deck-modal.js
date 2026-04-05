/**
 * Delete deck confirmation modal.
 * Shows a destructive action confirmation dialog for removing a deck.
 */

/**
 * Open the delete deck confirmation modal.
 * @param {number} deckId - ID of the deck to delete
 * @param {string} deckName - Name of the deck (for display)
 */
export function openDeleteDeckModal(deckId, deckName) {
  // Remove existing modal if present
  document.getElementById('delete-deck-modal')?.remove();

  const Alpine = window.Alpine;
  const store = Alpine?.store('deck');
  const toast = Alpine?.store('toast');

  const overlay = document.createElement('div');
  overlay.id = 'delete-deck-modal';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    z-index: 9999; display: flex; align-items: center; justify-content: center;
  `;

  overlay.innerHTML = `
    <!-- Glass backdrop -->
    <div id="delete-deck-backdrop" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6);"></div>

    <!-- Modal panel -->
    <div style="position: relative; z-index: 10; width: 100%; max-width: 400px; background: #14161C; border: 1px solid #2A2D3A; padding: 24px; display: flex; flex-direction: column; gap: 16px;">
      <!-- Heading -->
      <h3 style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; line-height: 1.2; letter-spacing: 0.01em; color: #EAECEE; margin: 0;">
        Delete "${deckName}"?
      </h3>

      <!-- Confirmation text -->
      <p style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; line-height: 1.5; color: #EAECEE; margin: 0;">
        This will permanently remove this deck and all its cards. This cannot be undone.
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
    overlay.remove();
  }

  // Wire event handlers
  overlay.querySelector('#delete-deck-backdrop').addEventListener('click', closeModal);
  overlay.querySelector('#delete-deck-cancel').addEventListener('click', closeModal);
  overlay.querySelector('#delete-deck-confirm').addEventListener('click', async () => {
    if (store) {
      await store.deleteDeck(deckId);
      toast?.success('Deck deleted.');
    }
    closeModal();
  });

  // Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}
