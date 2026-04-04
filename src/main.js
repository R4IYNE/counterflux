import './styles/main.css';
import './styles/utilities.css';
import 'mana-font/css/mana.min.css';
import 'keyrune/css/keyrune.min.css';
import 'material-symbols/outlined.css';

import Alpine from 'alpinejs';
import { initAppStore } from './stores/app.js';
import { initSearchStore } from './stores/search.js';
import { initBulkDataStore, startBulkDataPipeline } from './stores/bulkdata.js';
import { splashScreen } from './components/splash-screen.js';
import { initRouter } from './router.js';
import { renderManaCost } from './utils/mana.js';

// Initialize stores before Alpine starts
initAppStore();
initSearchStore();
initBulkDataStore();

// Expose renderManaCost globally for Alpine template usage
window.renderManaCost = renderManaCost;

// Register Alpine components
Alpine.data('splashScreen', splashScreen);

// Make Alpine available globally for debugging
window.Alpine = Alpine;

// Start Alpine (must be called after stores and components are registered)
Alpine.start();

// Initialize router after Alpine is ready
initRouter();

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
