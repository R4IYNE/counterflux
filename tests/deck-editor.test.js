/**
 * @vitest-environment jsdom
 *
 * DECK-01: verify the deck-editor back button dispatches the
 * `deck-back-to-landing` CustomEvent. Per D-08 (CONTEXT) the existing
 * implementation at src/components/deck-editor.js:34-37 should already work;
 * this test locks the contract so a future regression is caught.
 *
 * deck-editor.js reads `window.Alpine.store('deck')` directly (no module
 * import of alpinejs), so the test stubs `window.Alpine` — no vi.mock needed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Stub the sub-panel renderers to keep the test focused on the back-button
// contract. The deck-editor mounts three sub-panels which each pull their own
// store data; we don't need them rendering a full DOM here.
vi.mock('../src/components/deck-search-panel.js', () => ({ renderDeckSearchPanel: vi.fn() }));
vi.mock('../src/components/deck-centre-panel.js', () => ({ renderDeckCentrePanel: vi.fn() }));
vi.mock('../src/components/deck-context-menu.js', () => ({ initDeckContextMenu: vi.fn(() => ({ cleanup: vi.fn() })) }));
vi.mock('../src/components/deck-analytics-panel.js', () => ({
  renderDeckAnalyticsPanel: vi.fn(),
  destroyDeckCharts: vi.fn(),
}));

import { renderDeckEditor } from '../src/components/deck-editor.js';

describe('deck-editor back button (DECK-01)', () => {
  let originalAlpine;

  beforeEach(() => {
    document.body.innerHTML = '';
    originalAlpine = window.Alpine;
    window.Alpine = {
      store: (name) => {
        if (name === 'deck') {
          return { activeDeck: { id: 'd1', name: 'Test Deck' } };
        }
        return null;
      },
    };
  });

  afterEach(() => {
    window.Alpine = originalAlpine;
  });

  it('dispatches deck-back-to-landing CustomEvent when back button is clicked', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    renderDeckEditor(container);

    // The first button rendered is the back button (it carries the deck name)
    const backBtn = container.querySelector('button');
    expect(backBtn).toBeTruthy();
    expect(backBtn.textContent).toMatch(/Test Deck|BACK TO ARCHIVE/);

    const events = [];
    document.addEventListener('deck-back-to-landing', (e) => events.push(e));

    backBtn.click();

    expect(events.length).toBe(1);
    expect(events[0].type).toBe('deck-back-to-landing');
  });

  it('back button still dispatches when activeDeck.name is missing (falls back to BACK TO ARCHIVE label)', () => {
    window.Alpine = {
      store: (name) => {
        if (name === 'deck') return { activeDeck: null };
        return null;
      },
    };

    const container = document.createElement('div');
    document.body.appendChild(container);
    renderDeckEditor(container);

    const backBtn = container.querySelector('button');
    expect(backBtn.textContent).toBe('BACK TO ARCHIVE');

    const events = [];
    document.addEventListener('deck-back-to-landing', (e) => events.push(e));
    backBtn.click();
    expect(events.length).toBe(1);
  });
});
