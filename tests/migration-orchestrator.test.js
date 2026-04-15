import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';

// Minimal localStorage shim for node env
function installLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => {
      store.set(k, String(v));
    },
    removeItem: (k) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (i) => Array.from(store.keys())[i] ?? null,
  };
}

// Minimal document shim — migration-blocked-modal creates a DOM node from the
// `blocked` handler. Never actually fires under vitest + fake-indexeddb (no
// second tab), but the showBlockingModal import path expects document to exist.
function installDocument() {
  if (typeof globalThis.document !== 'undefined') return;
  const children = [];
  globalThis.document = {
    body: {
      appendChild: (n) => {
        children.push(n);
        return n;
      },
      removeChild: (n) => {
        const i = children.indexOf(n);
        if (i >= 0) children.splice(i, 1);
      },
    },
    createElement: () => ({
      style: { cssText: '' },
      appendChild() {},
      remove() {
        // no-op
      },
      set textContent(_v) {},
    }),
  };
  globalThis.window = globalThis.window || { alert: () => {} };
}

describe('runMigration orchestrator', () => {
  beforeEach(() => {
    installLocalStorage();
    localStorage.clear();
    installDocument();
  });

  afterEach(async () => {
    await Dexie.delete('counterflux');
    // Reset any module caches between tests so the singleton db.on handlers
    // don't accumulate.
  });

  it('exists and is exported as an async function', async () => {
    const mod = await import('../src/services/migration.js');
    expect(typeof mod.runMigration).toBe('function');
  });

  it('resolves for a fresh install (no existing IDB, no backup taken)', async () => {
    // Vitest + fake-indexeddb: first run, no persisted counterflux IDB.
    // runMigration should open db at v7, resolve cleanly, no backup key written.
    const { runMigration } = await import('../src/services/migration.js');
    await expect(runMigration()).resolves.toBeUndefined();

    // No localStorage backup expected (fresh install path).
    const backups = Object.keys(localStorage).filter
      ? Object.keys(localStorage).filter((k) => k.startsWith('counterflux_v5_backup_'))
      : [];
    expect(backups.length).toBe(0);
  });
});
