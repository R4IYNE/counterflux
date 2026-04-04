import Alpine from 'alpinejs';
import { getBulkMeta, setBulkMeta } from '../db/schema.js';
import { requestPersistentStorage } from '../utils/storage.js';

/**
 * Initialize the Alpine.store('bulkdata') for tracking bulk data download state.
 * Provides reactive properties for the splash screen UI.
 */
export function initBulkDataStore() {
  Alpine.store('bulkdata', {
    status: 'idle',       // idle | checking | downloading | parsing | ready | error
    downloaded: 0,        // bytes downloaded
    total: 0,             // expected total bytes (from Scryfall size field)
    parsed: 0,            // cards parsed so far
    totalCards: 0,        // total cards when complete
    error: null,          // error message string
    updatedAt: null,      // ISO timestamp of cached data

    get progress() {
      if (this.total === 0) return 0;
      return Math.round((this.downloaded / this.total) * 100);
    },

    get downloadedMB() {
      return (this.downloaded / 1048576).toFixed(1);
    },

    get totalMB() {
      return (this.total / 1048576).toFixed(0);
    },

    get isReady() {
      return this.status === 'ready';
    }
  });
}

/**
 * Start the bulk data pipeline: create Worker, check freshness, download if needed.
 * Wires Worker messages to Alpine.store('bulkdata') for reactive UI updates.
 */
export async function startBulkDataPipeline() {
  const store = Alpine.store('bulkdata');
  store.status = 'checking';

  // Request persistent storage (fire and forget)
  requestPersistentStorage().then(result => {
    console.log('[Counterflux] Persistent storage:', result);
  }).catch(() => {});

  // Get cached metadata
  const cachedMeta = await getBulkMeta();
  const cachedUpdatedAt = cachedMeta?.updatedAt ?? null;
  store.updatedAt = cachedUpdatedAt;

  // Create the Worker
  const worker = new Worker(
    new URL('../workers/bulk-data.worker.js', import.meta.url),
    { type: 'module' }
  );

  // Wire Worker messages to Alpine store
  worker.onmessage = async (e) => {
    const msg = e.data;

    switch (msg.type) {
      case 'check-result':
        if (msg.needsRefresh) {
          store.status = 'downloading';
          store.total = msg.expectedSize || 0;
          worker.postMessage({
            type: 'start',
            downloadUri: msg.downloadUri,
            expectedSize: msg.expectedSize
          });
        } else {
          // Data is fresh, load cached count
          store.status = 'ready';
          store.totalCards = cachedMeta?.totalCards ?? 0;
        }
        break;

      case 'progress':
        store.status = 'downloading';
        store.downloaded = msg.downloaded;
        store.total = msg.total;
        store.parsed = msg.parsed;
        break;

      case 'complete':
        store.status = 'ready';
        store.totalCards = msg.totalParsed;
        // Persist metadata for next refresh check
        const checkResult = store._lastCheckResult;
        await setBulkMeta({
          updatedAt: checkResult?.updatedAt ?? new Date().toISOString(),
          totalCards: msg.totalParsed
        });
        store.updatedAt = checkResult?.updatedAt ?? new Date().toISOString();
        break;

      case 'error':
        store.status = 'error';
        store.error = msg.message;
        break;
    }

    // Stash check-result for setBulkMeta on complete
    if (msg.type === 'check-result' && msg.needsRefresh) {
      store._lastCheckResult = msg;
    }
  };

  worker.onerror = (err) => {
    store.status = 'error';
    store.error = err.message || 'Worker crashed unexpectedly';
  };

  // Store worker reference for retry functionality
  store._worker = worker;
  store.retry = function () {
    this.status = 'checking';
    this.error = null;
    this.downloaded = 0;
    this.parsed = 0;
    worker.postMessage({ type: 'check', cachedUpdatedAt: null });
  };

  // Start the freshness check
  worker.postMessage({ type: 'check', cachedUpdatedAt });
}
