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
import { initAuthStore } from './stores/auth.js';
import { openSettingsModal } from './components/settings-modal.js';
import { splashScreen } from './components/splash-screen.js';
import { toggleShortcutModal, isShortcutModalOpen, closeShortcutModal } from './components/shortcut-modal.js';
import { initRouter } from './router.js';
import { renderManaCost } from './utils/mana.js';
import { getEurToGbpRate, eurToGbp, eurToGbpValue } from './services/currency.js';
import { runMigration } from './services/migration.js';
import { db } from './db/schema.js';

// Phase 7 Plan 3: gate all store init + Alpine on successful v5→v7 migration.
// runMigration() sweeps stale backups, writes a new localStorage backup with
// round-trip validation, registers onblocked/versionchange handlers, and then
// opens the Dexie singleton — triggering the v6 + v7 upgrade callbacks.
// If migration fails, the blocking modal stays up and Alpine never starts.
async function bootApp() {
  // Bulk data store must be initialised BEFORE migration runs so the
  // v6 upgrade's progress events have an Alpine.store('bulkdata') to write
  // migrationProgress into. The other stores remain gated on migration success.
  // NOTE: initBulkDataStore currently requires Alpine to be available for
  // Alpine.store(...) registration. We register bulkdata first and remove
  // the implicit Alpine bootstrapping below.
  window.Alpine = Alpine;
  initBulkDataStore();

  try {
    await runMigration();
  } catch (e) {
    console.error('[Counterflux] migration failed; aborting boot', e);
    return; // blocking modal already rendered by migration.js
  }

  // Initialize remaining stores AFTER migration completes
  initAppStore();
  initProfileStore();
  initAuthStore();            // Phase 10 Plan 2 — slots AFTER profile so Plan 4's Alpine.effect has both stores available at init time
  initUndoStore();
  initSearchStore();
  initCollectionStore();
  initDeckStore();
  initIntelligenceStore();
  initMarketStore();
  initGameStore();

  // Expose renderManaCost globally for Alpine template usage
  window.renderManaCost = renderManaCost;

  // Expose shortcut modal functions globally for Alpine template usage
  window.__toggleShortcutModal = toggleShortcutModal;
  window.__shortcutModalOpen = isShortcutModalOpen;
  window.__closeShortcutModal = closeShortcutModal;
  window.__openSettingsModal = openSettingsModal;

  // Expose db globally for Alpine inline expressions (flyout, etc.)
  window.__cf_db = db;

  // Expose currency converter globally for Alpine template usage
  window.__cf_eurToGbp = eurToGbp;
  window.__cf_eurToGbpValue = eurToGbpValue;

  // Register Alpine components
  Alpine.data('splashScreen', splashScreen);

  // Start Alpine (must be called after stores and components are registered)
  Alpine.start();

  // Initialize router after Alpine is ready
  initRouter();

  // Phase 10 Plan 2 — kick off auth init AFTER router resolve so the /auth-callback
  // handler (if this is a magic-link return) runs first with a fresh anonymous state.
  // init() is async but fire-and-forget; it transitions status → authed when getSession resolves.
  Alpine.store('auth').init();

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

  // PERF-01 — Web Vitals dev-mode reporter (lazy-loaded via requestIdleCallback per Pitfall E)
  // The lazy import + idle scheduling ensures this instrumentation cannot regress the LCP it measures.
  // Production builds skip the body of bootPerfMetrics() via the import.meta.env.DEV guard inside perf.js.
  if (import.meta.env.DEV) {
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));
    idle(() => {
      import('./services/perf.js').then(m => m.bootPerfMetrics()).catch(err => {
        console.warn('[Counterflux] perf bootstrap failed:', err);
      });
    });
  }

  console.log('Counterflux -- The Aetheric Archive');
}

bootApp();
