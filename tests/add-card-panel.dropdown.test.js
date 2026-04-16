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

/**
 * FOLLOWUP-1 (Phase 08.1 Plan 1): the dropdown's scroll boundary lives on
 * the dropdown container itself, NOT on the parent <aside class="tc-panel-column">.
 * The aside must declare `overflow: visible` so absolutely-positioned dropdowns
 * can escape its content box; the body content scrolls inside an inner
 * `.tc-panel-body` wrapper that owns its own `overflow-y: auto`.
 */
describe('FOLLOWUP-1: dropdown scroll containment', () => {
  it('dropdown wrapper declares max-height: 280px and overflow-y: auto in the same style', () => {
    const html = renderAddCardModal();
    // Find the substring containing the dropdown wrapper opening tag.
    const dropdownMatch = html.match(/<div[^>]*x-show="searchResults\.length > 0"[^>]*>/);
    expect(dropdownMatch).toBeTruthy();
    const dropdownTag = dropdownMatch[0];
    expect(dropdownTag).toMatch(/max-height:\s*280px/);
    expect(dropdownTag).toMatch(/overflow-y:\s*auto/);
    expect(dropdownTag).toMatch(/position:\s*absolute/);
  });

  it('parent <aside class="tc-panel-column"> has overflow: visible (NOT overflow-y: auto, NOT overflow: hidden)', () => {
    const html = renderAddCardModal();
    const asideMatch = html.match(/<aside[\s\S]*?class="tc-panel-column"[\s\S]*?style="[^"]*"/);
    expect(asideMatch).toBeTruthy();
    const asideOpen = asideMatch[0];
    expect(asideOpen).toMatch(/overflow:\s*visible/);
    expect(asideOpen).not.toMatch(/overflow-y:\s*auto/);
    expect(asideOpen).not.toMatch(/overflow:\s*hidden/);
  });

  it('inner .tc-panel-body wrapper exists with overflow-y: auto + flex:1 + min-height:0 so the panel body still scrolls', () => {
    const html = renderAddCardModal();
    const bodyMatch = html.match(/class="tc-panel-body"[^>]*style="[^"]*"/);
    expect(bodyMatch).toBeTruthy();
    const bodyTag = bodyMatch[0];
    expect(bodyTag).toMatch(/overflow-y:\s*auto/);
    expect(bodyTag).toMatch(/flex:\s*1/);
    expect(bodyTag).toMatch(/min-height:\s*0/);
  });

  it('panel body wrapper opens before the header row and closes before </aside>', () => {
    const html = renderAddCardModal();
    const bodyOpenIdx = html.search(/<div\s+class="tc-panel-body"/);
    const headerIdx = html.indexOf('ADD TO COLLECTION');
    const closeAsideIdx = html.indexOf('</aside>');
    expect(bodyOpenIdx).toBeGreaterThan(-1);
    expect(headerIdx).toBeGreaterThan(bodyOpenIdx);
    expect(closeAsideIdx).toBeGreaterThan(headerIdx);
  });
});
