import { renderDeckLanding } from '../components/deck-landing.js';
import { initDeckLandingContextMenu } from '../components/deck-landing-context-menu.js';
import { renderDeckEditor } from '../components/deck-editor.js';

/**
 * Thousand-Year Storm -- Deck Builder screen.
 * Two modes: 'landing' (deck list grid) and 'editor' (three-panel).
 */
export function mount(container) {
  const Alpine = window.Alpine;
  const store = Alpine?.store('deck');

  let mode = 'landing';
  let cleanupFns = [];

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
    // Clean up previous
    for (const fn of cleanupFns) {
      if (typeof fn === 'function') fn();
      else if (fn && typeof fn.cleanup === 'function') fn.cleanup();
    }
    cleanupFns = [];

    renderDeckEditor(container);

    if (Alpine?.initTree) {
      Alpine.initTree(container);
    }
  }

  // Listen for deck-open events
  const handleDeckOpen = (e) => {
    const deckId = e.detail?.deckId;
    if (deckId && store) {
      store.loadDeck(deckId).then(() => {
        renderEditor(deckId);
      });
    }
  };
  document.addEventListener('deck-open', handleDeckOpen);
  cleanupFns.push(() => document.removeEventListener('deck-open', handleDeckOpen));

  // Listen for deck-back-to-landing events
  const handleBackToLanding = () => {
    renderLanding();
  };
  document.addEventListener('deck-back-to-landing', handleBackToLanding);
  cleanupFns.push(() => document.removeEventListener('deck-back-to-landing', handleBackToLanding));

  // Initial render
  renderLanding();

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
    // Editor cleanup
    if (container._editorCleanup) {
      container._editorCleanup();
    }
    if (prevCleanup) prevCleanup();
  };
}
