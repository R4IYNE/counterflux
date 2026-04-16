import 'fake-indexeddb/auto';

// Phase 8 Plan 2: Alpine.js' module entrypoint touches MutationObserver at
// import time (not a runtime lookup). Our node-only test environment does
// not provide it, so we install a no-op stub BEFORE any test imports
// alpinejs. The stub is only required for tests that import store modules
// which in turn `import Alpine from 'alpinejs'`.
if (typeof globalThis.MutationObserver === 'undefined') {
  globalThis.MutationObserver = class MutationObserver {
    constructor(_cb) {}
    observe() {}
    disconnect() {}
    takeRecords() { return []; }
  };
}

// Minimal CustomEvent polyfill for node (Alpine's module + our printing
// event-dispatch path both rely on it).
if (typeof globalThis.CustomEvent === 'undefined') {
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
      this.bubbles = !!init.bubbles;
      this.cancelable = !!init.cancelable;
    }
  };
}
