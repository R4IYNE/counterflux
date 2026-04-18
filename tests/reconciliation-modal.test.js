// @vitest-environment jsdom
// tests/reconciliation-modal.test.js
//
// Phase 11 Plan 3 — Reconciliation lockdown modal tests (SYNC-04, D-01..D-04).
//
// Coverage (10 behaviours):
//   1. mounts with title 'DATA ON BOTH SIDES'
//   2. renders count-comparison grid (4 rows per column): cards/decks/games/watchlist
//   3. profile NOT in grid (D-03 — Phase 10 reconciled profile separately)
//   4. no X close button (D-04 lockdown — there is NO aria-label="Close" in modal)
//   5. Escape key blocked (D-04)
//   6. backdrop click blocked (D-04)
//   7. MERGE EVERYTHING click → onChoice('MERGE_EVERYTHING')
//   8. KEEP LOCAL / KEEP CLOUD dispatch correct values (MERGE_EVERYTHING / KEEP_LOCAL / KEEP_CLOUD)
//   9. autofocus lands on MERGE EVERYTHING
//  10. in-progress state during onChoice await (MERGING… + others disabled)

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

let openReconciliationModal;

const LOCAL_COUNTS = { collection: 45, decks: 3, deck_cards: 20, games: 10, watchlist: 8 };
const CLOUD_COUNTS = { collection: 120, decks: 8, deck_cards: 60, games: 15, watchlist: 12 };

beforeEach(async () => {
  document.body.innerHTML = '<div id="cf-reconciliation-root"></div>';
  vi.resetModules();
  const mod = await import('../src/components/reconciliation-modal.js');
  openReconciliationModal = mod.openReconciliationModal;
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('reconciliation modal — structure + copy', () => {
  test('Test 1: mounts with title DATA ON BOTH SIDES', () => {
    const onChoice = vi.fn().mockResolvedValue();
    openReconciliationModal({ localCounts: LOCAL_COUNTS, cloudCounts: CLOUD_COUNTS, onChoice });

    const heading = document.body.textContent;
    expect(heading).toContain('DATA ON BOTH SIDES');
    expect(heading).toContain('Mila found data on both sides. Which should she keep?');
  });

  test('Test 2: renders count-comparison grid (4 rows per column) — cards/decks/games/watchlist', () => {
    const onChoice = vi.fn().mockResolvedValue();
    openReconciliationModal({ localCounts: LOCAL_COUNTS, cloudCounts: CLOUD_COUNTS, onChoice });

    const text = document.body.textContent;
    // Local column
    expect(text).toContain('45 cards');
    expect(text).toContain('3 decks');
    expect(text).toContain('10 games');
    expect(text).toContain('8 watchlist');
    // Cloud column
    expect(text).toContain('120 cards');
    expect(text).toContain('8 decks');
    expect(text).toContain('15 games');
    expect(text).toContain('12 watchlist');
    // Overlines
    expect(text).toContain('LOCAL');
    expect(text).toContain('HOUSEHOLD (CLOUD)');
  });

  test('Test 3: profile NOT surfaced in count grid (D-03)', () => {
    const onChoice = vi.fn().mockResolvedValue();
    openReconciliationModal({ localCounts: LOCAL_COUNTS, cloudCounts: CLOUD_COUNTS, onChoice });

    const text = document.body.textContent;
    expect(text).not.toContain('profile row');
    // "profile" as a standalone count label should not appear — we look for patterns like "1 profile" or "N profile"
    expect(/\b\d+\s+profile\b/.test(text)).toBe(false);
  });

  test('Test 4: no X close button (D-04 lockdown — no aria-label="Close")', () => {
    const onChoice = vi.fn().mockResolvedValue();
    openReconciliationModal({ localCounts: LOCAL_COUNTS, cloudCounts: CLOUD_COUNTS, onChoice });

    // No X close button in the reconciliation modal
    const root = document.getElementById('cf-reconciliation-root');
    expect(root.querySelector('[aria-label="Close"]')).toBeNull();
    expect(root.querySelector('[aria-label="Close reconciliation"]')).toBeNull();
    // Also assert no raw X glyph as a clickable button header
    const closeBtns = root.querySelectorAll('button[data-close]');
    expect(closeBtns.length).toBe(0);
  });
});

describe('reconciliation modal — lockdown (D-04)', () => {
  test('Test 5: Escape key blocked — modal stays mounted + no onChoice call', () => {
    const onChoice = vi.fn().mockResolvedValue();
    openReconciliationModal({ localCounts: LOCAL_COUNTS, cloudCounts: CLOUD_COUNTS, onChoice });

    const overlayBefore = document.querySelector('#cf-reconciliation-root > [role="dialog"]');
    expect(overlayBefore).toBeTruthy();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    const overlayAfter = document.querySelector('#cf-reconciliation-root > [role="dialog"]');
    expect(overlayAfter).toBeTruthy();
    expect(onChoice).not.toHaveBeenCalled();
  });

  test('Test 6: backdrop click blocked — modal stays mounted', () => {
    const onChoice = vi.fn().mockResolvedValue();
    openReconciliationModal({ localCounts: LOCAL_COUNTS, cloudCounts: CLOUD_COUNTS, onChoice });

    const overlay = document.querySelector('#cf-reconciliation-root > [role="dialog"]');
    expect(overlay).toBeTruthy();

    // Click directly on the overlay (not a child button) — should NOT unmount
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    const stillThere = document.querySelector('#cf-reconciliation-root > [role="dialog"]');
    expect(stillThere).toBeTruthy();
    expect(onChoice).not.toHaveBeenCalled();
  });
});

describe('reconciliation modal — button semantics (D-01)', () => {
  test('Test 7: MERGE EVERYTHING click → onChoice(MERGE_EVERYTHING)', async () => {
    const onChoice = vi.fn().mockResolvedValue();
    openReconciliationModal({ localCounts: LOCAL_COUNTS, cloudCounts: CLOUD_COUNTS, onChoice });

    const btn = document.querySelector('button[data-choice="MERGE_EVERYTHING"]');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('MERGE EVERYTHING');
    btn.click();
    await new Promise(r => setTimeout(r, 20));

    expect(onChoice).toHaveBeenCalledWith('MERGE_EVERYTHING');
  });

  test('Test 8: KEEP LOCAL and KEEP CLOUD dispatch correct values', async () => {
    const onChoice = vi.fn().mockResolvedValue();
    openReconciliationModal({ localCounts: LOCAL_COUNTS, cloudCounts: CLOUD_COUNTS, onChoice });

    const keepLocal = document.querySelector('button[data-choice="KEEP_LOCAL"]');
    const keepCloud = document.querySelector('button[data-choice="KEEP_CLOUD"]');
    expect(keepLocal).toBeTruthy();
    expect(keepCloud).toBeTruthy();
    expect(keepLocal.textContent).toContain('KEEP LOCAL');
    expect(keepCloud.textContent).toContain('KEEP CLOUD');

    keepLocal.click();
    await new Promise(r => setTimeout(r, 20));
    expect(onChoice).toHaveBeenCalledWith('KEEP_LOCAL');

    // second modal for KEEP_CLOUD (modal unmounted after KEEP_LOCAL resolved)
    const onChoice2 = vi.fn().mockResolvedValue();
    openReconciliationModal({ localCounts: LOCAL_COUNTS, cloudCounts: CLOUD_COUNTS, onChoice: onChoice2 });
    const keepCloud2 = document.querySelector('button[data-choice="KEEP_CLOUD"]');
    keepCloud2.click();
    await new Promise(r => setTimeout(r, 20));
    expect(onChoice2).toHaveBeenCalledWith('KEEP_CLOUD');
  });

  test('Test 9: autofocus lands on MERGE EVERYTHING', async () => {
    const onChoice = vi.fn().mockResolvedValue();
    openReconciliationModal({ localCounts: LOCAL_COUNTS, cloudCounts: CLOUD_COUNTS, onChoice });

    // setTimeout(0) for focus — yield
    await new Promise(r => setTimeout(r, 10));
    const mergeBtn = document.querySelector('button[data-choice="MERGE_EVERYTHING"]');
    expect(document.activeElement).toBe(mergeBtn);
  });

  test('Test 10: in-progress state during onChoice await — label MERGING… + other buttons disabled', async () => {
    let resolveChoice;
    const slowChoice = new Promise(r => { resolveChoice = r; });
    const onChoice = vi.fn().mockImplementation(() => slowChoice);
    openReconciliationModal({ localCounts: LOCAL_COUNTS, cloudCounts: CLOUD_COUNTS, onChoice });

    const mergeBtn = document.querySelector('button[data-choice="MERGE_EVERYTHING"]');
    const keepLocal = document.querySelector('button[data-choice="KEEP_LOCAL"]');
    const keepCloud = document.querySelector('button[data-choice="KEEP_CLOUD"]');

    mergeBtn.click();
    // Allow microtasks to flush — the in-progress UI should apply before the promise resolves
    await new Promise(r => setTimeout(r, 10));

    expect(mergeBtn.textContent).toContain('MERGING…');
    expect(keepLocal.disabled).toBe(true);
    expect(keepCloud.disabled).toBe(true);

    // Resolve to close the modal cleanly
    resolveChoice();
    await new Promise(r => setTimeout(r, 20));
  });
});
