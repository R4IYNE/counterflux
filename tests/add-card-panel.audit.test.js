import { describe, it, expect } from 'vitest';

// Provide a window shim BEFORE importing the module — renderAddCardModal
// assigns to window.__cf_searchCards on first call, and the test
// environment is node (no DOM by default).
if (typeof globalThis.window === 'undefined') globalThis.window = {};

const { renderAddCardPanel } = await import('../src/components/add-card-panel.js');
const renderAddCardModal = renderAddCardPanel; // Plan 2 rename; keep test body intact

/**
 * COLLECT-01 (D-22, audit-only): the add-card search results and selected-card
 * preview must render NO mana cost markup anywhere. This is a regression guard —
 * existing code is already compliant; this test ensures Plan 1's dropdown
 * rework (Task 2) does not sneak mana-cost rendering in.
 */
describe('COLLECT-01: add-card search renders no mana cost', () => {
  it('dropdown template contains no mana-cost markup', () => {
    const html = renderAddCardModal();
    expect(html).not.toMatch(/mana[_-]?cost/i);
    expect(html).not.toMatch(/class="ms ms-/);
    expect(html).not.toMatch(/card\.mana_cost/);
  });

  it('selected-card preview does not render mana cost symbols', () => {
    const html = renderAddCardModal();
    // selected-card preview block must not reference card.mana_cost
    const previewRegion = html.match(/selectedCard[\s\S]*?<\/template>/g)?.join('') || html;
    expect(previewRegion).not.toMatch(/mana_cost/);
    expect(previewRegion).not.toMatch(/class="[^"]*\bms\b/);
  });
});
