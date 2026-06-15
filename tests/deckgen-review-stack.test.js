/**
 * @vitest-environment jsdom
 */
// Card-stack review body (retune/upgrade swap mode). Mirrors the Alpine/jsdom
// bootstrap from deckgen-review-screen.test.js: Alpine.start() once, then
// Alpine.initTree(document.body) for subsequent mounts.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Alpine from 'alpinejs';
import { renderBrewReviewStack } from '../src/components/brew-review-stack.js';

describe('brew review stack — swap-mode card stack', () => {
  function mount() {
    if (!window.__alpineStarted) {
      Alpine.start();
      window.__alpineStarted = true;
    } else {
      Alpine.initTree(document.body);
    }
  }

  function bootStore(overrides = {}) {
    Alpine.store('deckgen', {
      mode: 'retune',
      status: 'reviewing',
      streamComplete: true,
      recommendations: [],
      setApproval(scryfallId, approved) {
        this.recommendations = this.recommendations.map((r) =>
          r.scryfall_id === scryfallId ? { ...r, approved: !!approved } : r
        );
      },
      async commitApproved() { return { ok: true }; },
      reset() {},
      ...overrides,
    });
  }

  beforeEach(() => {
    document.body.innerHTML = '';
    delete window.__alpineStarted;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows one card at a time with apply/skip and an n/total counter', () => {
    bootStore({
      recommendations: [
        { scryfall_id: 'a1', swap_out: 'x1', role: 'RAMP', approved: false },
        { scryfall_id: 'b2', swap_out: 'x2', role: 'DRAW', approved: false },
      ],
    });
    const store = Alpine.store('deckgen');
    store.mode = 'retune';
    store.streamComplete = true;
    store.status = 'reviewing';
    document.body.innerHTML = renderBrewReviewStack();
    mount();
    expect(document.body.textContent).toMatch(/1\s*\/\s*2/);
    expect(document.body.textContent).toMatch(/apply/i);
    expect(document.body.textContent).toMatch(/skip/i);
  });

  it('right-arrow applies the current card and advances', () => {
    bootStore({
      recommendations: [{ scryfall_id: 'a1', swap_out: 'x1', approved: false }],
    });
    const store = Alpine.store('deckgen');
    store.mode = 'retune';
    store.streamComplete = true;
    store.status = 'reviewing';
    document.body.innerHTML = renderBrewReviewStack();
    mount();
    document.querySelector('[data-stack-root]')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(store.recommendations[0].approved).toBe(true);
  });
});
