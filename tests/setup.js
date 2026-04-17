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

// Phase 09 Plan 3 — game-tracker tests need RAF / cancelAnimationFrame /
// matchMedia in the node test environment.
//   - first-player-spinner uses requestAnimationFrame for the deceleration loop
//   - prefers-reduced-motion bypass uses window.matchMedia
//   - turn-timer wall-clock display loop uses requestAnimationFrame
// Shape mirrors the WHATWG/CSSOM stubs that Phase 8 added for MutationObserver.
//
// For tests that need DETERMINISTIC RAF (e.g. tests/first-player-spinner.test.js),
// override per-test via:
//   vi.spyOn(global, 'requestAnimationFrame').mockImplementation(cb => {
//     cb(performance.now()); return 1;
//   });
//
// For tests that need matchMedia to RETURN matches:true (reduced-motion bypass),
// override per-test via:
//   vi.spyOn(window, 'matchMedia').mockReturnValue({
//     matches: true, addEventListener() {}, removeEventListener() {},
//   });
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
}
if (typeof globalThis.cancelAnimationFrame === 'undefined') {
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}
if (typeof globalThis.matchMedia === 'undefined') {
  globalThis.matchMedia = () => ({
    matches: false,
    media: '',
    addEventListener() {},
    removeEventListener() {},
    addListener() {},     // legacy API for older callers
    removeListener() {},  // legacy API
  });
}
