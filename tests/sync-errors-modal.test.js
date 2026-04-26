// @vitest-environment jsdom
// tests/sync-errors-modal.test.js
//
// Phase 11 Plan 3 — Sync-errors modal tests (D-09).
//
// Coverage (9 behaviours):
//   1. mounts with title 'SYNC ERRORS'
//   2. renders rows sorted newest first (descending by detected_at)
//   3. RETRY button click invokes Alpine.store('sync').retry(id)
//   4. DISCARD button click invokes Alpine.store('sync').discard(id)
//   5. empty state shows ALL CAUGHT UP when db.sync_conflicts empty
//   6. Escape closes
//   7. backdrop click closes
//   8. CLOSE button closes
//   9. error classification label mapping — error_code 403 → 'RLS rejected'

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

let openSyncErrorsModal;
let db;

const alpineStoreRegistry = {};
function resetAlpine() {
  for (const k of Object.keys(alpineStoreRegistry)) delete alpineStoreRegistry[k];
  const syncStub = {
    status: 'error',
    retry: vi.fn().mockResolvedValue(),
    discard: vi.fn().mockResolvedValue(),
  };
  alpineStoreRegistry.sync = syncStub;
  alpineStoreRegistry.toast = {
    info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn(),
    show: vi.fn(),
  };
  window.Alpine = {
    store: (name, value) => {
      if (value !== undefined) alpineStoreRegistry[name] = value;
      return alpineStoreRegistry[name];
    },
  };
  return syncStub;
}

beforeEach(async () => {
  document.body.innerHTML = '<div id="cf-sync-errors-root"></div>';
  resetAlpine();
  vi.resetModules();
  // Clear fake-indexeddb between tests
  const dbMod = await import('../src/db/schema.js');
  db = dbMod.db;
  try { await db.sync_conflicts.clear(); } catch {}
  const mod = await import('../src/components/sync-errors-modal.js');
  openSyncErrorsModal = mod.openSyncErrorsModal;
});

afterEach(async () => {
  document.body.innerHTML = '';
  try { await db.sync_conflicts.clear(); } catch {}
});

describe('sync-errors modal — structure + population', () => {
  test('Test 1: mounts with title SYNC ERRORS', async () => {
    await openSyncErrorsModal();
    await new Promise(r => setTimeout(r, 10));

    expect(document.body.textContent).toContain('SYNC ERRORS');
  });

  test('Test 2: rows sorted newest first (descending by detected_at)', async () => {
    const now = Date.now();
    await db.sync_conflicts.bulkAdd([
      { table_name: 'collection', detected_at: now - 20000, error_code: '409', op: 'update' },
      { table_name: 'decks',      detected_at: now - 10000, error_code: '403', op: 'update' },
      { table_name: 'deck_cards', detected_at: now,          error_code: '422', op: 'create' },
    ]);

    await openSyncErrorsModal();
    await new Promise(r => setTimeout(r, 10));

    const rows = Array.from(document.querySelectorAll('li[data-row-id]'));
    expect(rows.length).toBe(3);
    // Newest first: deck_cards (now), decks (now-10k), collection (now-20k)
    expect(rows[0].textContent).toContain('deck_cards');
    expect(rows[1].textContent).toContain('decks');
    expect(rows[2].textContent).toContain('collection');
  });

  test('Test 3: RETRY click invokes Alpine.store(sync).retry(id)', async () => {
    const syncStub = resetAlpine();
    const id = await db.sync_conflicts.add({
      table_name: 'decks', detected_at: Date.now(), error_code: '403', op: 'update',
    });

    await openSyncErrorsModal();
    await new Promise(r => setTimeout(r, 10));

    const retryBtn = document.querySelector('button[data-action="retry"]');
    expect(retryBtn).toBeTruthy();
    retryBtn.click();
    await new Promise(r => setTimeout(r, 10));

    expect(syncStub.retry).toHaveBeenCalled();
    const calledWith = syncStub.retry.mock.calls[0][0];
    expect(Number(calledWith)).toBe(Number(id));
  });

  test('Test 4: DISCARD click invokes Alpine.store(sync).discard(id)', async () => {
    const syncStub = resetAlpine();
    const id = await db.sync_conflicts.add({
      table_name: 'collection', detected_at: Date.now(), error_code: '422', op: 'create',
    });

    await openSyncErrorsModal();
    await new Promise(r => setTimeout(r, 10));

    const discardBtn = document.querySelector('button[data-action="discard"]');
    expect(discardBtn).toBeTruthy();
    discardBtn.click();
    await new Promise(r => setTimeout(r, 10));

    expect(syncStub.discard).toHaveBeenCalled();
    const calledWith = syncStub.discard.mock.calls[0][0];
    expect(Number(calledWith)).toBe(Number(id));
  });
});

describe('sync-errors modal — empty state', () => {
  test('Test 5: empty state shows ALL CAUGHT UP when db.sync_conflicts is empty', async () => {
    await openSyncErrorsModal();
    await new Promise(r => setTimeout(r, 10));

    expect(document.body.textContent).toContain('ALL CAUGHT UP');
    expect(document.body.textContent).toContain("Mila hasn't found any sync errors to review.");
  });
});

describe('sync-errors modal — close paths', () => {
  test('Test 6: Escape key closes modal', async () => {
    await openSyncErrorsModal();
    await new Promise(r => setTimeout(r, 10));

    expect(document.querySelector('#cf-sync-errors-root > [role="dialog"]')).toBeTruthy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise(r => setTimeout(r, 10));

    expect(document.querySelector('#cf-sync-errors-root > [role="dialog"]')).toBeFalsy();
  });

  test('Test 7: backdrop click closes modal', async () => {
    await openSyncErrorsModal();
    await new Promise(r => setTimeout(r, 10));

    const overlay = document.querySelector('#cf-sync-errors-root > [role="dialog"]');
    expect(overlay).toBeTruthy();
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 10));

    expect(document.querySelector('#cf-sync-errors-root > [role="dialog"]')).toBeFalsy();
  });

  test('Test 8: CLOSE button closes modal', async () => {
    await openSyncErrorsModal();
    await new Promise(r => setTimeout(r, 10));

    const closeBtn = document.querySelector('button[data-close="true"]');
    expect(closeBtn).toBeTruthy();
    closeBtn.click();
    await new Promise(r => setTimeout(r, 10));

    expect(document.querySelector('#cf-sync-errors-root > [role="dialog"]')).toBeFalsy();
  });
});

describe('sync-errors modal — error classification mapping (D-10)', () => {
  test('Test 9: error_code 403 renders meta label "RLS rejected"', async () => {
    await db.sync_conflicts.add({
      table_name: 'decks', detected_at: Date.now(), error_code: '403', op: 'update',
    });

    await openSyncErrorsModal();
    await new Promise(r => setTimeout(r, 10));

    const row = document.querySelector('li[data-row-id]');
    expect(row).toBeTruthy();
    expect(row.textContent).toContain('RLS rejected');
  });
});

// Phase 14.07 — bulk RETRY ALL / DISCARD ALL row.
// Per-row UI is unusable when sync_conflicts has hundreds of entries
// (real case during 14-05 UAT: 848 dead-letters from the column-drift era).
describe('sync-errors modal — bulk actions (Phase 14.07)', () => {
  test('Test 10: RETRY ALL invokes store.retry once per row sequentially', async () => {
    const syncStub = resetAlpine();
    await db.sync_conflicts.bulkAdd([
      { table_name: 'decks',      detected_at: Date.now() - 2000, error_code: '403', op: 'update' },
      { table_name: 'collection', detected_at: Date.now() - 1000, error_code: '422', op: 'create' },
      { table_name: 'deck_cards', detected_at: Date.now(),         error_code: 'PGRST204', op: 'create' },
    ]);

    await openSyncErrorsModal();
    await new Promise(r => setTimeout(r, 10));

    const bulkRetry = document.querySelector('button[data-bulk-action="retry-all"]');
    expect(bulkRetry).toBeTruthy();
    expect(bulkRetry.textContent).toMatch(/RETRY ALL \(3\)/);
    bulkRetry.click();
    await new Promise(r => setTimeout(r, 50));

    expect(syncStub.retry).toHaveBeenCalledTimes(3);
  });

  test('Test 11: DISCARD ALL prompts confirm; cancel aborts', async () => {
    const syncStub = resetAlpine();
    await db.sync_conflicts.bulkAdd([
      { table_name: 'decks',      detected_at: Date.now() - 1000, error_code: '403', op: 'update' },
      { table_name: 'collection', detected_at: Date.now(),         error_code: '422', op: 'create' },
    ]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    await openSyncErrorsModal();
    await new Promise(r => setTimeout(r, 10));

    const bulkDiscard = document.querySelector('button[data-bulk-action="discard-all"]');
    expect(bulkDiscard).toBeTruthy();
    bulkDiscard.click();
    await new Promise(r => setTimeout(r, 10));

    expect(confirmSpy).toHaveBeenCalled();
    expect(syncStub.discard).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  test('Test 12: DISCARD ALL with confirm → invokes store.discard once per row', async () => {
    const syncStub = resetAlpine();
    await db.sync_conflicts.bulkAdd([
      { table_name: 'decks',      detected_at: Date.now() - 1000, error_code: '403', op: 'update' },
      { table_name: 'collection', detected_at: Date.now(),         error_code: '422', op: 'create' },
    ]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    await openSyncErrorsModal();
    await new Promise(r => setTimeout(r, 10));

    document.querySelector('button[data-bulk-action="discard-all"]').click();
    await new Promise(r => setTimeout(r, 50));

    expect(syncStub.discard).toHaveBeenCalledTimes(2);
    confirmSpy.mockRestore();
  });

  test('Test 13: bulk bar is hidden when only 1 row (per-row buttons sufficient)', async () => {
    await db.sync_conflicts.add({
      table_name: 'decks', detected_at: Date.now(), error_code: '403', op: 'update',
    });

    await openSyncErrorsModal();
    await new Promise(r => setTimeout(r, 10));

    expect(document.querySelector('button[data-bulk-action="retry-all"]')).toBeFalsy();
    expect(document.querySelector('button[data-bulk-action="discard-all"]')).toBeFalsy();
  });
});
