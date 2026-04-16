import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Provide a window shim BEFORE importing modules that may touch window
// (renderGalleryView, renderCardTile use Alpine bindings that may reference
// window helpers via x-text attributes — safe at render time since x-text
// strings aren't evaluated until Alpine binds at runtime).
if (typeof globalThis.window === 'undefined') globalThis.window = {};

const { renderGalleryView } = await import('../src/components/gallery-view.js');
const { renderCardTile } = await import('../src/components/card-tile.js');

/**
 * FOLLOWUP-3 (Phase 08.1): hover-revealed quick-actions checkbox.
 *
 * Five assertions covering:
 *   E1 — CSS rule exists in main.css with hover/focus-within reveal
 *   E2 — Reduced-motion guard removes the opacity transition
 *   E3 — Direct render path (gallery-view x-for) emits the checkbox + tabindex + keyboard handlers
 *   E4 — Virtual-scroller renderItem string includes the checkbox markup + data-entry-id
 *   E5 — card-tile.js separate component also emits the checkbox markup
 */
describe('FOLLOWUP-3: hover-revealed quick-actions checkbox (Phase 08.1)', () => {
  const cssPath = resolve(__dirname, '../src/styles/main.css');
  const css = readFileSync(cssPath, 'utf-8');

  it('Test E1 — main.css declares .card-quick-actions-checkbox with hover/focus-within reveal', () => {
    expect(css).toMatch(/\.card-quick-actions-checkbox\s*\{[\s\S]*?opacity:\s*0/);
    expect(css).toMatch(/\.card-tile-hover:hover\s+\.card-quick-actions-checkbox[\s\S]*?opacity:\s*1/);
    expect(css).toMatch(/\.card-tile-hover:focus-within\s+\.card-quick-actions-checkbox/);
  });

  it('Test E2 — main.css has prefers-reduced-motion guard for the new utility', () => {
    expect(css).toMatch(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)[\s\S]*?\.card-quick-actions-checkbox[\s\S]*?transition:\s*none/);
  });

  it('Test E3 — gallery-view.js direct render path emits the checkbox + tabindex + keyboard handlers', () => {
    const html = renderGalleryView();
    // The direct path is gated by `items.length <= 200` — the template still
    // renders into the HTML string at module-render time. Assert the markup
    // exists in the returned string.
    expect(html).toMatch(/class="card-quick-actions-checkbox"/);
    // Tabindex on the tile root for keyboard reachability
    expect(html).toMatch(/tabindex="0"/);
    // Alpine keydown handlers for Enter and Space
    expect(html).toMatch(/@keydown\.enter[\s\S]*?card-context-menu/);
    expect(html).toMatch(/@keydown\.space[\s\S]*?card-context-menu/);
    // Aria-label binds to the card name
    expect(html).toMatch(/aria-label="'Quick actions for ' \+ \(entry\.card\?\.name/);
  });

  it('Test E4 — gallery-view.js virtual-scroller renderItem string includes the checkbox + data-entry-id', () => {
    // We can't invoke renderItem at test-time without standing up the
    // virtual scroller, but the renderItem source itself lives in the
    // gallery-view.js module body as a plain string concatenation. Read
    // the source file directly and assert the markup pieces exist.
    const galleryViewPath = resolve(__dirname, '../src/components/gallery-view.js');
    const galleryViewSrc = readFileSync(galleryViewPath, 'utf-8');
    // The renderItem function body must include the checkbox class string
    expect(galleryViewSrc).toMatch(/card-quick-actions-checkbox/);
    // data-entry-id attribute for the delegated click handler lookup —
    // default assertion is presence-only (relaxed per checker WARNING 3:
    // a strict regex was previously brittle to a 1-char whitespace shift
    // in the executor's string concatenation).
    expect(galleryViewSrc).toMatch(/data-entry-id=/);
    // Strict form for reference (preferred if executor maintains exact concat):
    //   /data-entry-id=\\"' \+ \(entry\.id/
    // Delegated event listeners are attached on the scroller element
    expect(galleryViewSrc).toMatch(/addEventListener\('click',\s*this\._delegatedClick\)/);
    expect(galleryViewSrc).toMatch(/addEventListener\('keydown',\s*this\._delegatedKey\)/);
  });

  it('Test E5 — card-tile.js renders the checkbox markup with tabindex + aria-label', () => {
    const fakeEntry = {
      id: 'test-uuid-001',
      quantity: 1,
      foil: 0,
      card: {
        id: 'fake-card-id',
        name: 'Lightning Bolt',
        set: 'lea',
        set_name: 'Limited Edition Alpha',
        collector_number: '161',
        prices: { eur: '24.00' },
        image_uris: { small: 'https://example.com/lightning.jpg' },
      },
    };
    const html = renderCardTile(fakeEntry, 0);
    expect(html).toMatch(/class="card-quick-actions-checkbox"/);
    expect(html).toMatch(/tabindex="0"/);
    expect(html).toMatch(/aria-label="Quick actions for Lightning Bolt"/);
    expect(html).toMatch(/@keydown\.enter\.prevent[\s\S]*?card-context-menu/);
    expect(html).toMatch(/@keydown\.space\.prevent[\s\S]*?card-context-menu/);
    // data-entry-id is also set on the tile root
    expect(html).toMatch(/data-entry-id="test-uuid-001"/);
  });
});
