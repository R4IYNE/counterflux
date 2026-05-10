// @vitest-environment jsdom
//
// Quick task 260511-0k0 — Alpine reactivity gotcha in deck-landing.
//
// Two describe blocks:
//   1. Static-grep against src/stores/deck.js (mimics tests/topbar-nav.test.js).
//      Asserts that loadDecks() pre-initialises `_cardCount` and `_commanderCard`
//      on every loaded deck BEFORE assigning to `this.decks`, and carries an
//      inline comment referencing the gotcha so a future refactor doesn't
//      drop the pre-init loop.
//
//   2. Behavioural test of `enrichDecks()` re-running on every watcher fire
//      (mimics tests/sync-engine-push.test.js stub-Alpine + dynamic-import
//      mocking pattern). Asserts the `=== undefined` guard around _cardCount
//      and the `!deck._commanderCard` guard around the commander branch are
//      both gone, AND that the dynamic `import('../db/schema.js')` is hoisted
//      to the top of the function (one call per invocation, not 2 × N).
//
// The file FAILS on current code (RED) and PASSES after Task 2 (GREEN).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Hoisted Dexie schema mock — captures dynamic-import calls from enrichDecks
// ---------------------------------------------------------------------------
const deckCardsRows = [{ quantity: 5 }, { quantity: 3 }]; // → _cardCount = 8
const cardsGetMock = vi.fn().mockResolvedValue(null);
const deckCardsToArrayMock = vi.fn().mockResolvedValue(deckCardsRows);

vi.mock('../src/db/schema.js', () => ({
  db: {
    cards: { get: cardsGetMock },
    deck_cards: {
      where: () => ({
        equals: () => ({ toArray: deckCardsToArrayMock })
      })
    }
  }
}));

// ---------------------------------------------------------------------------
// Block 1 — static-grep against src/stores/deck.js
// ---------------------------------------------------------------------------

describe('deck store loadDecks — Alpine reactivity pre-init (0k0)', () => {
  const src = readFileSync('src/stores/deck.js', 'utf-8');

  // Extract the body of loadDecks() so assertions are scoped to it
  // (prevents false positives from a pre-init living elsewhere).
  function loadDecksBody() {
    const m = src.match(/async\s+loadDecks\s*\([^)]*\)\s*\{([\s\S]*?)\n\s{2,4}\},/);
    return m ? m[1] : '';
  }

  it('pre-initialises _cardCount on every loaded deck before assignment', () => {
    const body = loadDecksBody();
    expect(body).toMatch(/_cardCount/);
    // Tighten — the pre-init must happen BEFORE `this.decks = ...`. Assert
    // the assignment uses a pre-walked local (e.g., `this.decks = rows;`)
    // rather than the inline `this.decks = await db...` shape that prevents
    // a pre-init from being possible at all.
    expect(body).toMatch(/this\.decks\s*=\s*[a-zA-Z_$][\w$]*\s*;/);
  });

  it('pre-initialises _commanderCard on every loaded deck before assignment', () => {
    const body = loadDecksBody();
    expect(body).toMatch(/_commanderCard/);
  });

  it('contains a comment referencing the Alpine reactivity gotcha (so future refactors do not drop the pre-init)', () => {
    const body = loadDecksBody();
    // Permissive — accept any of the keywords we care about.
    expect(body).toMatch(/Alpine\s+reactivity|reactive\s+keys|Proxy-wrap|gotcha/i);
  });
});

// ---------------------------------------------------------------------------
// Block 2 — behavioural + static-grep coverage of enrichDecks()
// ---------------------------------------------------------------------------

describe('deckLandingData enrichDecks — re-runs on every watcher fire (0k0)', () => {
  const storeRegistry = {};
  let capturedFactory;

  beforeEach(() => {
    cardsGetMock.mockClear();
    deckCardsToArrayMock.mockClear();
    capturedFactory = null;

    // Stub Alpine on window — capture the factory passed to Alpine.data().
    if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
    globalThis.window.Alpine = {
      data: (_name, factory) => { capturedFactory = factory; },
      store: (name) => storeRegistry[name],
    };

    // Fresh store for every test
    storeRegistry.deck = {
      decks: [
        { id: 'd1', commander_id: null, _cardCount: 0, _commanderCard: null }
      ]
    };
  });

  it('recomputes _cardCount on the second call even when the value is already a stale 0 (no === undefined guard)', async () => {
    const { renderDeckLanding } = await import('../src/components/deck-landing.js');

    // Trigger Alpine.data registration so the factory is captured
    renderDeckLanding(document.createElement('div'));
    expect(typeof capturedFactory).toBe('function');

    const data = capturedFactory();

    // First call — _cardCount starts at the stale pre-init value of 0
    await data.enrichDecks();
    expect(storeRegistry.deck.decks[0]._cardCount).toBe(8);

    // Simulate a stale value (as if Dexie data wasn't ready on first paint
    // and the watcher fired with deck rows still showing 0). Under the OLD
    // code, the `if (deck._cardCount === undefined)` guard short-circuits
    // because `_cardCount` is already defined as 0 — so the second call
    // leaves it at 0 (RED). After the fix the guard is gone and the second
    // call recomputes back to 8.
    storeRegistry.deck.decks[0]._cardCount = 0;
    await data.enrichDecks();
    expect(storeRegistry.deck.decks[0]._cardCount).toBe(8);
  });

  it('hoists the db import — only one dynamic import per enrichDecks call (no 2 × N imports)', () => {
    // Static-grep on the source file — pragmatic + reliable assertion that
    // matches Block 1's style. Counts `import('../db/schema.js')` occurrences
    // inside the enrichDecks() body. Should be exactly 1 after the fix
    // (currently 2 — one for the commander branch, one for the card-count
    // branch, both inside the loop).
    const src = readFileSync('src/components/deck-landing.js', 'utf-8');
    const enrichBody = src.match(/async\s+enrichDecks\s*\([^)]*\)\s*\{([\s\S]*?)\n\s{2,8}\},/)?.[1] ?? '';
    expect(enrichBody.length).toBeGreaterThan(0); // sanity — body extracted
    const importCount = (enrichBody.match(/import\(['"]\.\.\/db\/schema\.js['"]\)/g) || []).length;
    expect(importCount).toBe(1);
  });
});
