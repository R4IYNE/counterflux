// @vitest-environment jsdom
// tests/sync-pull-splash.test.js
//
// Phase 11 Plan 3 — Sync-pull splash tests (D-12..D-14).
//
// Coverage (8 behaviours):
//   1. mounts with heading 'SYNCING HOUSEHOLD DATA'
//   2. progress caption 'SYNCED 127 / 845 CARDS' when bulkPullProgress = { table:'collection', pulled:127, total:845 }
//   3. caption per table — { table:'decks', pulled:2, total:8 } → 'SYNCED 2 / 8 DECKS'
//   4. error state shows 'SYNC FAILED' + 'RETRY SYNC' via renderSyncPullError({...})
//   5. error body shows pulled/total count
//   6. no 'Continue with partial data' button anywhere (D-13 decline)
//   7. no 'Skip' option anywhere (D-14)
//   8. RETRY SYNC click invokes onRetry callback

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

let openSyncPullSplash, closeSyncPullSplash, renderSyncPullError;

const alpineStoreRegistry = {};
function setAlpine(progress = null) {
  for (const k of Object.keys(alpineStoreRegistry)) delete alpineStoreRegistry[k];
  alpineStoreRegistry.sync = { bulkPullProgress: progress };
  window.Alpine = {
    store: (name, value) => {
      if (value !== undefined) alpineStoreRegistry[name] = value;
      return alpineStoreRegistry[name];
    },
  };
}

beforeEach(async () => {
  document.body.innerHTML = '<div id="cf-sync-pull-splash-root"></div>';
  setAlpine();
  vi.resetModules();
  const mod = await import('../src/components/sync-pull-splash.js');
  openSyncPullSplash = mod.openSyncPullSplash;
  closeSyncPullSplash = mod.closeSyncPullSplash;
  renderSyncPullError = mod.renderSyncPullError;
});

afterEach(() => {
  try { closeSyncPullSplash?.(); } catch {}
  document.body.innerHTML = '';
});

describe('sync-pull splash — structure', () => {
  test('Test 1: mounts with heading SYNCING HOUSEHOLD DATA', () => {
    openSyncPullSplash();
    expect(document.body.textContent).toContain('SYNCING HOUSEHOLD DATA');
    expect(document.body.textContent).toContain('Grabbing your household archive');
  });
});

describe('sync-pull splash — progress caption', () => {
  test('Test 2: caption = SYNCED 127 / 845 CARDS when bulkPullProgress = { table:"collection", pulled:127, total:845 }', async () => {
    setAlpine({ table: 'collection', pulled: 127, total: 845 });
    openSyncPullSplash();
    // allow polling update to fire
    await new Promise(r => setTimeout(r, 250));

    const caption = document.querySelector('[data-role="caption"]');
    expect(caption).toBeTruthy();
    expect(caption.textContent).toBe('SYNCED 127 / 845 CARDS');
  });

  test('Test 3: caption per-table — table:"decks", pulled:2, total:8 → "SYNCED 2 / 8 DECKS"', async () => {
    setAlpine({ table: 'decks', pulled: 2, total: 8 });
    openSyncPullSplash();
    await new Promise(r => setTimeout(r, 250));

    const caption = document.querySelector('[data-role="caption"]');
    expect(caption.textContent).toBe('SYNCED 2 / 8 DECKS');
  });
});

describe('sync-pull splash — error state (D-13)', () => {
  test('Test 4: error state shows SYNC FAILED + RETRY SYNC CTA', () => {
    openSyncPullSplash();
    renderSyncPullError({ pulled: 500, total: 845, onRetry: vi.fn() });

    expect(document.body.textContent).toContain('SYNC FAILED');
    expect(document.body.textContent).toContain('RETRY SYNC');
  });

  test('Test 5: error body includes pulled/total count ("500 of 845 cards")', () => {
    openSyncPullSplash();
    renderSyncPullError({ pulled: 500, total: 845, onRetry: vi.fn() });

    expect(document.body.textContent).toContain('500 of 845 cards');
  });
});

describe('sync-pull splash — lockdown (no escape hatches)', () => {
  test('Test 6: no "Continue with partial data" button anywhere (D-13 decline)', () => {
    openSyncPullSplash();
    renderSyncPullError({ pulled: 100, total: 845, onRetry: vi.fn() });

    const text = document.body.textContent;
    expect(text).not.toContain('Continue');
    expect(text).not.toContain('continue with partial');
  });

  test('Test 7: no "Skip" option anywhere (D-14)', () => {
    openSyncPullSplash();
    renderSyncPullError({ pulled: 100, total: 845, onRetry: vi.fn() });

    const text = document.body.textContent;
    expect(text).not.toContain('Skip');
    expect(text).not.toContain('SKIP');
  });
});

describe('sync-pull splash — retry callback', () => {
  test('Test 8: RETRY SYNC click invokes onRetry callback', async () => {
    const onRetry = vi.fn();
    openSyncPullSplash();
    renderSyncPullError({ pulled: 500, total: 845, onRetry });

    const retryBtn = document.querySelector('[data-role="retry"]');
    expect(retryBtn).toBeTruthy();
    expect(retryBtn.textContent).toContain('RETRY SYNC');
    retryBtn.click();
    await new Promise(r => setTimeout(r, 10));

    expect(onRetry).toHaveBeenCalled();
  });
});
