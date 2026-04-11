import './styles/main.css';
import './styles/utilities.css';
import 'mana-font/css/mana.min.css';
import 'keyrune/css/keyrune.min.css';
import 'material-symbols/outlined.css';

import Alpine from 'alpinejs';
import { initAppStore } from './stores/app.js';
import { initSearchStore } from './stores/search.js';
import { initCollectionStore } from './stores/collection.js';
import { initDeckStore } from './stores/deck.js';
import { initIntelligenceStore } from './stores/intelligence.js';
import { initMarketStore } from './stores/market.js';
import { initGameStore } from './stores/game.js';
import { initBulkDataStore, startBulkDataPipeline } from './stores/bulkdata.js';
import { initUndoStore } from './stores/undo.js';
import { initProfileStore } from './stores/profile.js';
import { openSettingsModal } from './components/settings-modal.js';
import { splashScreen } from './components/splash-screen.js';
import { toggleShortcutModal, isShortcutModalOpen, closeShortcutModal } from './components/shortcut-modal.js';
import { initRouter } from './router.js';
import { renderManaCost } from './utils/mana.js';
import { getEurToGbpRate, eurToGbp, eurToGbpValue } from './services/currency.js';

// Initialize stores before Alpine starts
initAppStore();
initProfileStore();
initUndoStore();
initSearchStore();
initCollectionStore();
initDeckStore();
initIntelligenceStore();
initMarketStore();
initGameStore();
initBulkDataStore();

// Expose renderManaCost globally for Alpine template usage
window.renderManaCost = renderManaCost;

// Expose shortcut modal functions globally for Alpine template usage
window.__toggleShortcutModal = toggleShortcutModal;
window.__shortcutModalOpen = isShortcutModalOpen;
window.__closeShortcutModal = closeShortcutModal;
window.__openSettingsModal = openSettingsModal;

// Expose db globally for Alpine inline expressions (flyout, etc.)
import { db } from './db/schema.js';
window.__cf_db = db;

// Expose currency converter globally for Alpine template usage
window.__cf_eurToGbp = eurToGbp;
window.__cf_eurToGbpValue = eurToGbpValue;

// Register Alpine components
Alpine.data('splashScreen', splashScreen);

// Make Alpine available globally for debugging
window.Alpine = Alpine;

// Start Alpine (must be called after stores and components are registered)
Alpine.start();

// Initialize router after Alpine is ready
initRouter();

// Fetch EUR→GBP exchange rate (once per session, cached 24h)
getEurToGbpRate().then(rate => {
  console.log(`[Counterflux] EUR→GBP rate: ${rate}`);
}).catch(() => {
  console.warn('[Counterflux] Using fallback EUR→GBP rate');
});

// Start the bulk data pipeline (runs after Alpine is ready)
startBulkDataPipeline().catch((err) => {
  console.error('[Counterflux] Bulk data pipeline failed to start:', err);
  const store = Alpine.store('bulkdata');
  if (store) {
    store.status = 'error';
    store.error = err.message || 'Failed to initialize bulk data pipeline';
  }
});

console.log('Counterflux -- The Aetheric Archive');
