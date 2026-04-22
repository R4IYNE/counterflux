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
import { initSyncStore } from './stores/sync.js';
import { openSettingsModal } from './components/settings-modal.js';
import { openAuthModal } from './components/auth-modal.js';
import { openAuthWall, closeAuthWall } from './components/auth-wall.js';
import { maybeShowFirstSignInPrompt } from './components/first-sign-in-prompt.js';
import { splashScreen } from './components/splash-screen.js';
import { sidebarComponent } from './components/sidebar.js';
import { topbarBulkdataPill } from './components/topbar-bulkdata-pill.js';
import { renderNotificationBellPopover } from './components/notification-bell-popover.js';
import { toggleShortcutModal, isShortcutModalOpen, closeShortcutModal } from './components/shortcut-modal.js';
import { initRouter } from './router.js';
import { renderManaCost } from './utils/mana.js';
import { getEurToGbpRate, eurToGbp, eurToGbpValue } from './services/currency.js';
import { runMigration } from './services/migration.js';
import { bindBfcacheHandlers } from './services/bfcache.js';
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

  // Phase 13 Plan 5 — vite:preloadError recovery (Pitfall 15).
  // When a deploy replaces chunk hashes, long-lived sessions reference stale
  // chunks and fail with ChunkLoadError. Catch via the native vite:preloadError
  // event, suppress the default uncaught error, and soft-reload to fetch a
  // fresh index.html (which Vercel serves with Cache-Control: no-cache, see
  // vercel.json). Registered early (before Alpine boot) so it catches errors
  // during any dynamic import() inside the auth-wall / sync-engine / screen
  // loaders.
  if (typeof window !== 'undefined') {
    window.addEventListener('vite:preloadError', (event) => {
      event.preventDefault();
      console.warn('[Counterflux] chunk preload failed — app was updated, reloading');
      setTimeout(() => window.location.reload(), 500);
    });
  }

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
  initSyncStore();            // Phase 11 Plan 2 — sync-status store + 4-state machine; chip and modals bind here
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
  window.__openAuthModal = openAuthModal;

  // Expose db globally for Alpine inline expressions (flyout, etc.)
  window.__cf_db = db;

  // Expose currency converter globally for Alpine template usage
  window.__cf_eurToGbp = eurToGbp;
  window.__cf_eurToGbpValue = eurToGbpValue;

  // Register Alpine components
  Alpine.data('splashScreen', splashScreen);
  Alpine.data('sidebarComponent', sidebarComponent);
  Alpine.data('topbarBulkdataPill', topbarBulkdataPill);   // Phase 13 Plan 3 — D-06 topbar pill

  // Phase 12 SYNC-08 — inject the notification bell popover template into its
  // topbar mount point BEFORE Alpine.start() so Alpine binds every directive
  // inside the injected HTML in its initial walk.
  const bellMount = document.getElementById('cf-notification-bell-mount');
  if (bellMount) {
    bellMount.innerHTML = renderNotificationBellPopover();
  }

  // Start Alpine (must be called after stores and components are registered)
  Alpine.start();
  bindBfcacheHandlers();   // Phase 13 Plan 2 — D-09 bfcache eligibility (pure event-listener registration)

  // Initialize router after Alpine is ready
  initRouter();

  // Phase 10 Plan 2 — kick off auth init AFTER router resolve so the /auth-callback
  // handler (if this is a magic-link return) runs first with a fresh anonymous state.
  // init() is async but fire-and-forget; it transitions status → authed when getSession resolves.
  Alpine.store('auth').init();

  // Phase 10.3 (D-40) — auth-wall boot gate. Counterflux is an auth-gated
  // product; anonymous users don't have a use case. When status is anything
  // other than 'authed' (or we're mid-OAuth-callback), render the non-dismissible
  // auth-wall. closes automatically when status flips to 'authed' or 'pending'.
  const syncAuthWall = () => {
    const status = Alpine.store('auth').status;
    const hash = (typeof window !== 'undefined' && window.location && window.location.hash) || '';
    const onCallback = hash.startsWith('#/auth-callback');
    if (onCallback || status === 'authed' || status === 'pending') {
      closeAuthWall();
    } else {
      openAuthWall();
    }
  };
  Alpine.effect(() => {
    Alpine.store('auth').status;   // reactive subscription
    syncAuthWall();
  });
  if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', syncAuthWall);
  }

  // Phase 10 Plan 4 — profile store re-hydrates whenever auth.status flips,
  // and after hydrate resolves we poll the first-sign-in migration prompt.
  // Touching the reactive dep inside the effect subscribes us to it. The
  // async IIFE keeps effect body synchronous while awaiting the two async
  // steps in order (hydrate, then maybeShowFirstSignInPrompt — the prompt
  // inspects profile._source/_loaded set by hydrate).
  Alpine.effect(() => {
    const status = Alpine.store('auth').status;   // reactive dep
    const profile = Alpine.store('profile');
    if (profile && typeof profile.hydrate === 'function') {
      (async () => {
        await profile.hydrate();
        await maybeShowFirstSignInPrompt();
      })();
    }
    void status;
  });

  // Phase 11 Plan 4 — sync engine lifecycle bound to auth.status.
  // On authed → initSyncEngine installs Dexie hooks + drains surviving queue;
  // on anonymous → teardownSyncEngine cancels debounce timer. Both are
  // dynamically imported so pre-auth boot never touches sync-engine.js
  // (keeping AUTH-01 lazy-load discipline + matching the auth store's own
  // discipline for supabase-js).
  Alpine.effect(() => {
    const status = Alpine.store('auth').status;   // reactive dep
    if (status === 'authed') {
      (async () => {
        const { initSyncEngine } = await import('./services/sync-engine.js');
        await initSyncEngine();
      })();
    } else if (status === 'anonymous') {
      (async () => {
        const { teardownSyncEngine } = await import('./services/sync-engine.js');
        await teardownSyncEngine();
      })();
    }
  });

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
