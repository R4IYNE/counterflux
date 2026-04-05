import { renderDeckLanding } from '../components/deck-landing.js';
import { initDeckLandingContextMenu } from '../components/deck-landing-context-menu.js';

/**
 * Thousand-Year Storm -- Deck Builder screen.
 * Two modes: 'landing' (deck list grid) and 'editor' (three-panel, Plan 03).
 */
export function mount(container) {
  const Alpine = window.Alpine;
  const store = Alpine?.store('deck');

  let mode = 'landing';
  let cleanupFns = [];

  // Check if URL hash contains a deck ID for direct editor access
  const hashMatch = window.location.hash.match(/#\/decks\/edit\/(\d+)/);
  if (hashMatch) {
    const deckId = parseInt(hashMatch[1], 10);
    if (store && typeof store.loadDeck === 'function') {
      store.loadDeck(deckId);
    }
    mode = 'editor';
  }

  // Load decks list
  if (store && typeof store.loadDecks === 'function') {
    store.loadDecks();
  }

  function renderLanding() {
    mode = 'landing';
    renderDeckLanding(container);

    // Initialize context menu for deck cards
    const ctxCleanup = initDeckLandingContextMenu(container);
    cleanupFns.push(ctxCleanup);

    // Initialize Alpine on the container
    if (Alpine?.initTree) {
      Alpine.initTree(container);
    }
  }

  function renderEditor(deckId) {
    mode = 'editor';
    container.innerHTML = `
      <div x-data class="flex flex-col gap-[24px]">
        <div class="flex items-center gap-[8px]">
          <button
            id="deck-back-btn"
            style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; cursor: pointer; padding: 8px 16px; background: transparent; color: #7A8498; border: 1px solid #2A2D3A;"
          >BACK TO ARCHIVE</button>
          <span class="font-mono text-[11px] uppercase tracking-[0.15em]" style="color: #7A8498;">
            EDITING DECK
          </span>
        </div>
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 50vh; gap: 16px; text-align: center;">
          <span class="material-symbols-outlined" style="font-size: 48px; color: #4A5064;">construction</span>
          <h2 style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #EAECEE;">Editor Coming in Plan 03</h2>
          <p style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; color: #7A8498;">
            The three-panel deck editor will be built in the next plan. For now, your deck has been created and saved.
          </p>
        </div>
      </div>
    `;

    // Wire back button
    const backBtn = container.querySelector('#deck-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.location.hash = '#/decks';
        renderLanding();
      });
    }

    if (Alpine?.initTree) {
      Alpine.initTree(container);
    }
  }

  // Listen for deck-open events
  const handleDeckOpen = (e) => {
    const deckId = e.detail?.deckId;
    if (deckId && store) {
      store.loadDeck(deckId);
      window.location.hash = `#/decks/edit/${deckId}`;
      renderEditor(deckId);
    }
  };
  document.addEventListener('deck-open', handleDeckOpen);
  cleanupFns.push(() => document.removeEventListener('deck-open', handleDeckOpen));

  // Initial render based on mode
  if (mode === 'editor') {
    renderEditor(hashMatch ? parseInt(hashMatch[1], 10) : null);
  } else {
    renderLanding();
  }

  // Cleanup on unmount
  const prevCleanup = container._cleanup;
  container._cleanup = () => {
    for (const fn of cleanupFns) {
      if (typeof fn === 'function') fn();
      else if (fn && typeof fn.cleanup === 'function') fn.cleanup();
    }
    cleanupFns = [];
    // Remove modals
    document.getElementById('tys-modals')?.remove();
    if (prevCleanup) prevCleanup();
  };
}
