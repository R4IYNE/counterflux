/**
 * @vitest-environment jsdom
 */
// Guard against the x-data truncation bug class (260614).
//
// The deckgen review screen ships a large Alpine component as the value of a
// double-quoted x-data="..." attribute. The HTML parser ends that attribute at
// the FIRST ASCII double-quote inside it — so a single stray " (in a string OR
// a comment) silently truncates the whole object, Alpine fails to compile it,
// and every getter (titleText, approvedCount, groupedByRole, ...) becomes
// "not defined" at runtime. This has bitten twice. This test fails fast if any
// ASCII double-quote ever creeps back into the x-data object.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Alpine from 'alpinejs';
import { renderDeckgenReviewScreen } from '../src/components/deckgen-review-screen.js';

describe('deckgen review screen — x-data integrity', () => {
  const html = renderDeckgenReviewScreen();

  // Capture the x-data value with [^"]* — the capture STOPS at the first stray
  // double-quote, exactly like the browser's attribute parser does.
  const match = html.match(/x-data="([^"]*)"/);

  it('has an x-data attribute', () => {
    expect(match).toBeTruthy();
  });

  it('x-data is not truncated by a stray double-quote', () => {
    const xdata = match[1];
    // Getters/methods that live near the END of the object. If a stray " cut
    // the attribute short, these are missing from the captured value.
    for (const token of [
      'get isSwapMode()',
      'get titleText()',
      'get commitButtonText()',
      'get groupedByRole()',
      'get approvedCount()',
      'get rejectedCount()',
      'async commit()',
    ]) {
      expect(xdata).toContain(token);
    }
    // The full object literal must be captured intact (ends on its closing brace).
    expect(xdata.trim().endsWith('}')).toBe(true);
  });
});

describe('deckgen review screen — streaming-list body', () => {
  function bootStore(overrides = {}) {
    Alpine.store('deckgen', {
      mode: 'build',
      status: 'reviewing',
      streamComplete: false,
      cacheHit: false,
      recommendations: [],
      setApproval() {},
      approveAll() {},
      rejectAll() {},
      reset() {},
      async commitApproved() { return { ok: true }; },
      ...overrides,
    });
    if (!window.__alpineStarted) {
      Alpine.start();
      window.__alpineStarted = true;
    } else {
      Alpine.initTree(document.body);
    }
  }

  beforeEach(() => {
    document.body.innerHTML = '';
    delete window.__alpineStarted;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('build mode shows the streaming list, a brewing footer until complete, and Add/Skip per rec', () => {
    Alpine.store('deckgen', {
      mode: 'build',
      status: 'reviewing',
      streamComplete: false,
      cacheHit: false,
      recommendations: [{ scryfall_id: 'a1', role: 'RAMP', approved: true }],
      setApproval() {},
      approveAll() {},
      rejectAll() {},
      reset() {},
      async commitApproved() { return { ok: true }; },
    });
    document.body.innerHTML = renderDeckgenReviewScreen();
    if (!window.__alpineStarted) {
      Alpine.start();
      window.__alpineStarted = true;
    } else {
      Alpine.initTree(document.body);
    }
    expect(document.body.textContent.toLowerCase()).toContain('brewing');
    expect(document.body.textContent).toMatch(/add/i);
    expect(document.body.textContent).toMatch(/skip/i);
  });

  it('scroll container declares min-height:0 so overflow scrolls', () => {
    document.body.innerHTML = renderDeckgenReviewScreen();
    expect(document.body.innerHTML).toMatch(/overflow-y:\s*auto/);
    expect(document.body.innerHTML).toMatch(/min-height:\s*0/);
  });

  it('tapping a card row dispatches card-flyout', () => {
    document.body.innerHTML = renderDeckgenReviewScreen();
    Alpine.store('deckgen', {
      mode: 'build',
      status: 'reviewing',
      streamComplete: true,
      cacheHit: false,
      recommendations: [{ scryfall_id: 'a1', role: 'RAMP', approved: true }],
      setApproval() {},
      approveAll() {},
      rejectAll() {},
      reset() {},
      async commitApproved() { return { ok: true }; },
    });
    if (!window.__alpineStarted) {
      Alpine.start();
      window.__alpineStarted = true;
    } else {
      Alpine.initTree(document.body);
    }
    let fired = false;
    document.addEventListener('card-flyout', () => { fired = true; });
    document.querySelector('[data-brew-card="a1"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(fired).toBe(true);
  });
});
