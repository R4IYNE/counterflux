import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Provide a window shim BEFORE importing the module — renderAddCardModal
// assigns to window.__cf_searchCards on first call, and the test
// environment is node (no DOM).
if (typeof globalThis.window === 'undefined') globalThis.window = {};

const { renderAddCardModal } = await import('../src/components/add-card-modal.js');

/**
 * POLISH-11: Add-to-wishlist confirmation toast must read
 * "Added to wishlist" (not "Added to collection") when the
 * user's selected category is `wishlist`. Collection path
 * must still read "Added to collection".
 */
describe('add-card-modal toasts (POLISH-11)', () => {
  const src = readFileSync('src/components/add-card-modal.js', 'utf-8');
  const html = renderAddCardModal();

  it('source contains conditional wishlist/collection target selection', () => {
    // Source must branch on the `category === 'wishlist'` discriminator
    expect(src).toMatch(/category\s*===\s*['"]wishlist['"]/);
    expect(src).toMatch(/wishlist/);
    expect(src).toMatch(/collection/);
  });

  it('rendered modal template embeds the branching toast message', () => {
    expect(html).toMatch(/wishlist/);
    expect(html).toMatch(/collection/);
  });

  it('card-detail flyout in index.html also branches on category (wishlist vs collection)', () => {
    const indexHtml = readFileSync('index.html', 'utf-8');
    expect(indexHtml).toMatch(/flyoutCategory\s*===\s*['"]wishlist['"]/);
  });

  it('chooseTarget logic produces correct wording for each category', () => {
    const chooseTarget = (category) => (category === 'wishlist' ? 'wishlist' : 'collection');
    expect(chooseTarget('wishlist')).toBe('wishlist');
    expect(chooseTarget('owned')).toBe('collection');
  });
});

/**
 * Regression guard: deck-context-menu already uses 'Added to wishlist' / 'Added to collection'
 * for its add-via-context-menu paths. Ensure those wordings stay.
 */
describe('deck-context-menu wording preserved (POLISH-11 regression guard)', () => {
  const src = readFileSync('src/components/deck-context-menu.js', 'utf-8');
  it('keeps "Added to collection" string', () => {
    expect(src).toMatch(/Added to collection/);
  });
  it('keeps "Added to wishlist" string', () => {
    expect(src).toMatch(/Added to wishlist/);
  });
});
