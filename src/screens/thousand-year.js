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
  const screenCleanups = [];

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

    // Signal that the editor is mounted so the "Brew a new storm" modal can
    // drop its loading cover without flashing the deck list (260616).
    document.dispatchEvent(new CustomEvent('deck-editor-ready', { detail: { deckId } }));
  }

  // Listen for deck-open events
  const handleDeckOpen = (e) => {
    const deckId = e.detail?.deckId;
    if (deckId && store) {
      // Render the editor once the deck DATA has loaded (loadDeck no longer
      // blocks on the background EDHREC intelligence fetch). `.catch` first so
      // a load failure still opens the editor rather than stranding the user.
      store.loadDeck(deckId).catch((err) => console.warn('[tys] loadDeck failed', err)).then(() => {
        renderEditor(deckId);
      });
    }
  };
  document.addEventListener('deck-open', handleDeckOpen);
  screenCleanups.push(() => document.removeEventListener('deck-open', handleDeckOpen));

  // Listen for deck-back-to-landing events
  const handleBackToLanding = () => {
    renderLanding();
  };
  document.addEventListener('deck-back-to-landing', handleBackToLanding);
  screenCleanups.push(() => document.removeEventListener('deck-back-to-landing', handleBackToLanding));

  // 260608: deep-link from dashboard widget / Preordain section. If the
  // deckgen store carries a pendingDeckId, open that deck immediately
  // and the editor will consume pendingAction on mount to auto-open the
  // brew modal in upgrade/retune mode.
  const deckgen = Alpine?.store('deckgen');
  if (deckgen?.pendingDeckId && store) {
    const targetId = deckgen.pendingDeckId;
    store.loadDeck(targetId).then(() => {
      renderEditor(targetId);
    });
  } else {
    // Initial render — landing grid
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
    for (const fn of screenCleanups) { try { fn(); } catch {} }
    // Remove modals
    document.getElementById('tys-modals')?.remove();
    // Editor cleanup
    if (container._editorCleanup) {
      container._editorCleanup();
    }
    if (prevCleanup) prevCleanup();
  };
}
