import { describe, it, expect } from 'vitest';

// Provide a window shim BEFORE importing the module — renderMassEntryPanel
// assigns to window.__cf_searchCards etc. on first call.
if (typeof globalThis.window === 'undefined') globalThis.window = {};

const { renderMassEntryPanel } = await import('../src/components/mass-entry-panel.js');

/**
 * COLLECT-05 (D-23): the MASS ENTRY TERMINAL header must contain a visible
 * X close icon button (32×32 hit target, 20px Material Symbols `close` glyph)
 * wired to the existing `discard()` method so the `confirm()` guard for
 * unparsed entries is preserved.
 */
describe('COLLECT-05: mass-entry X close button', () => {
  it('renders a button with aria-label "Close mass entry"', () => {
    const html = renderMassEntryPanel();
    expect(html).toMatch(/aria-label="Close mass entry"/);
  });

  it('button is 32x32 with material-symbols close glyph', () => {
    const html = renderMassEntryPanel();
    expect(html).toMatch(/<button[^>]*aria-label="Close mass entry"[^>]*>[\s\S]*?<span class="material-symbols-outlined"[^>]*>close<\/span>/);
    expect(html).toMatch(/width:\s*32px[;\s][^<]*height:\s*32px/);
  });

  it('button click fires discard() (not close())', () => {
    const html = renderMassEntryPanel();
    // locate the aria-label'd button and check its @click
    const btnMatch = html.match(/<button[^>]*@click="([^"]*)"[^>]*aria-label="Close mass entry"/)
      || html.match(/<button[^>]*aria-label="Close mass entry"[^>]*@click="([^"]*)"/);
    expect(btnMatch).toBeTruthy();
    expect(btnMatch[1]).toMatch(/^discard\(\)/);
  });
});
