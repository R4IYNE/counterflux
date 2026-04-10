import Navigo from 'navigo';
import Alpine from 'alpinejs';

let router;

/**
 * Route-to-screen ID mapping. Exported for testing.
 */
export const ROUTE_MAP = {
  '/': 'epic-experiment',
  '/epic-experiment': 'epic-experiment',
  '/treasure-cruise': 'treasure-cruise',
  '/thousand-year-storm': 'thousand-year-storm',
  '/preordain': 'preordain',
  '/vandalblast': 'vandalblast',
};

/**
 * Screen loaders -- lazy import for each screen module.
 */
const screenLoaders = {
  '/': () => import('./screens/epic-experiment.js'),
  '/epic-experiment': () => import('./screens/epic-experiment.js'),
  '/treasure-cruise': () => import('./screens/treasure-cruise.js'),
  '/thousand-year-storm': () => import('./screens/thousand-year.js'),
  '/preordain': () => import('./screens/preordain.js'),
  '/vandalblast': () => import('./screens/vandalblast.js'),
};

/**
 * Initialise Navigo hash router with all screen routes.
 * Must be called after Alpine.start() and initAppStore().
 * @returns {Navigo} The router instance
 */
export function initRouter() {
  router = new Navigo('/', { hash: true });

  // Expose router globally for sidebar navigation
  window.__counterflux_router = router;

  Object.entries(screenLoaders).forEach(([path, loader]) => {
    router.on(path, async () => {
      const screenId = ROUTE_MAP[path];
      Alpine.store('app').currentScreen = screenId;

      const module = await loader();
      const container = document.getElementById('main-content');
      if (container) {
        // Clean up previous screen's resources (event listeners, body-level modals)
        if (typeof container._cleanup === 'function') {
          container._cleanup();
          container._cleanup = null;
        }
        container.innerHTML = '';
        module.mount(container);
        window.scrollTo(0, 0);
      }
    });
  });

  router.notFound(() => router.navigate('/'));
  router.resolve();

  return router;
}

export { router };
