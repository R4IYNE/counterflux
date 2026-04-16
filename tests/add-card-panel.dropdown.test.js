import { describe, it, expect } from 'vitest';

// Provide a window shim BEFORE importing the module — renderAddCardModal
// assigns to window.__cf_searchCards on first call.
if (typeof globalThis.window === 'undefined') globalThis.window = {};

const { renderAddCardPanel } = await import('../src/components/add-card-panel.js');
const renderAddCardModal = renderAddCardPanel; // Plan 2 rename; keep test body intact

/**
 * COLLECT-03 (D-19..D-21): search dropdown rows must render thumbnail +
 * name + set icon at 56px row height with a 40px-tall thumbnail bound to
 * `card.image_uris?.small`, using the shared `cf-card-img` utility class,
 * with graceful onerror fallback and lazy loading.
 */
describe('COLLECT-03: dropdown row thumbnail', () => {
  it('renders an img with cf-card-img class bound to image_uris.small', () => {
    const html = renderAddCardModal();
    expect(html).toMatch(/<img[^>]*class="cf-card-img"/);
    expect(html).toMatch(/:src="card\.image_uris\?\.small/);
  });

  it('img appears before the name span and set icon appears after', () => {
    const html = renderAddCardModal();
    // Match the dropdown row block specifically (x-for iterates searchResults)
    const rowMatch = html.match(/x-for="\(card, idx\) in searchResults"[\s\S]*?<\/template>/);
    expect(rowMatch).toBeTruthy();
    const row = rowMatch[0];
    const imgIdx = row.indexOf('<img');
    const nameIdx = row.search(/x-text="card\.name"/);
    const setIconIdx = row.indexOf('ss-');
    expect(imgIdx).toBeGreaterThan(-1);
    expect(nameIdx).toBeGreaterThan(imgIdx);
    expect(setIconIdx).toBeGreaterThan(nameIdx);
  });

  it('img has onerror fallback to hide broken images', () => {
    const html = renderAddCardModal();
    expect(html).toMatch(/onerror="this\.style\.display='none'"/);
  });

  it('row height is 56px', () => {
    const html = renderAddCardModal();
    expect(html).toMatch(/min-height:\s*56px/);
  });

  it('img height is 40px (D-19)', () => {
    const html = renderAddCardModal();
    expect(html).toMatch(/height:\s*40px/);
  });
});
