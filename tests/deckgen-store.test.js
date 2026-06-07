// Phase 18 (v1.3) — deckgen Alpine store tests.
//
// Covers state machine transitions, review-screen interactions, and
// commit-flow atomicity. Mocks alpinejs + generateDeck so tests stay
// deterministic — matches the auth-store.test.js convention.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

// --- Hoisted mocks ---------------------------------------------------------

const storeRegistry = {};
vi.mock('alpinejs', () => ({
  default: {
    store: (name, value) => {
      if (value !== undefined) storeRegistry[name] = value;
      return storeRegistry[name];
    },
  },
}));

vi.mock('../src/services/deckgen.js', () => ({
  generateDeck: vi.fn(),
}));

// --- Imports under test (after mocks) -------------------------------------

import { db } from '../src/db/schema.js';
import { initDeckgenStore } from '../src/stores/deckgen.js';
import { generateDeck } from '../src/services/deckgen.js';

// --- Mock stores the deckgen store reads from -----------------------------

function setupMockStores() {
  storeRegistry.auth = { session: { access_token: 'mock-token' } };
  storeRegistry.toast = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  };
  storeRegistry.deck = {
    activeDeck: null,
    activeCards: [],
    loadDeck: vi.fn(),
  };
}

beforeEach(async () => {
  await db.deck_cards.clear();
  await db.collection.clear();
  for (const k of Object.keys(storeRegistry)) delete storeRegistry[k];
  setupMockStores();
  initDeckgenStore();
  generateDeck.mockReset();
});

// --- Tests ----------------------------------------------------------------

describe('deckgen store — initial state', () => {
  it('starts idle', () => {
    const s = storeRegistry.deckgen;
    expect(s.status).toBe('idle');
    expect(s.error).toBeNull();
    expect(s.recommendations).toEqual([]);
    expect(s.brewModalOpen).toBe(false);
  });
});

describe('deckgen store — modal lifecycle', () => {
  it('openBrewModal opens the modal and clears prior state', () => {
    const s = storeRegistry.deckgen;
    s.error = { code: 'old_error', message: 'stale' };
    s.recommendations = [{ scryfall_id: 'stale' }];
    s.openBrewModal();
    expect(s.brewModalOpen).toBe(true);
    expect(s.status).toBe('idle');
    expect(s.error).toBeNull();
    expect(s.recommendations).toEqual([]);
  });

  it('closeBrewModal closes the modal without resetting other state', () => {
    const s = storeRegistry.deckgen;
    s.brewModalOpen = true;
    s.recommendations = [{ scryfall_id: 'keep' }];
    s.closeBrewModal();
    expect(s.brewModalOpen).toBe(false);
    expect(s.recommendations).toHaveLength(1);
  });

  it('reset clears everything including modal flag', () => {
    const s = storeRegistry.deckgen;
    s.brewModalOpen = true;
    s.status = 'reviewing';
    s.recommendations = [{ scryfall_id: 'c1' }];
    s.activeDeckId = 'deck-1';
    s.reset();
    expect(s.status).toBe('idle');
    expect(s.brewModalOpen).toBe(false);
    expect(s.recommendations).toEqual([]);
    expect(s.activeDeckId).toBeNull();
  });
});

describe('deckgen store — startBrew success path', () => {
  it('transitions idle → brewing → reviewing on success', async () => {
    generateDeck.mockResolvedValue({
      ok: true,
      cacheHit: false,
      response: {
        recommended: [
          { scryfall_id: 'c1', role: 'RAMP', reasoning: 'cheap mana rock' },
          { scryfall_id: 'c2', role: 'DRAW', reasoning: 'card advantage' },
        ],
        budget_remaining: 19,
        cache_hit: false,
      },
    });

    const s = storeRegistry.deckgen;
    await s.startBrew({
      deckId: 'deck-1',
      commanderId: 'cmdr-1',
      powerLevel: 5,
      mode: 'build',
      useCollectionOnly: false,
      archetypeHint: '',
      partialCardIds: [],
    });

    expect(s.status).toBe('reviewing');
    expect(s.recommendations).toHaveLength(2);
    expect(s.recommendations[0].approved).toBe(true);
    expect(s.recommendations[1].approved).toBe(true);
    expect(s.budgetRemaining).toBe(19);
    expect(s.activeDeckId).toBe('deck-1');
    expect(s.activeCommanderId).toBe('cmdr-1');
  });

  it('passes the supabase access token via getAccessToken', async () => {
    generateDeck.mockResolvedValue({ ok: true, response: { recommended: [] } });
    const s = storeRegistry.deckgen;
    await s.startBrew({
      deckId: 'deck-1', commanderId: 'cmdr-1', powerLevel: 5, mode: 'build',
      useCollectionOnly: false, archetypeHint: '', partialCardIds: [],
    });
    const call = generateDeck.mock.calls[0][0];
    const token = await call.getAccessToken();
    expect(token).toBe('mock-token');
  });

  it('computes a collection hash from local Dexie when useCollectionOnly is true', async () => {
    await db.collection.bulkAdd([
      { id: 'col-1', scryfall_id: 's1', category: 'owned', foil: 0, quantity: 1, added_at: '2026-06-07', updated_at: '2026-06-07' },
      { id: 'col-2', scryfall_id: 's2', category: 'owned', foil: 0, quantity: 1, added_at: '2026-06-07', updated_at: '2026-06-07' },
    ]);
    generateDeck.mockResolvedValue({ ok: true, response: { recommended: [] } });
    const s = storeRegistry.deckgen;
    await s.startBrew({
      deckId: 'deck-1', commanderId: 'cmdr-1', powerLevel: 5, mode: 'build',
      useCollectionOnly: true, archetypeHint: '', partialCardIds: [],
    });
    const call = generateDeck.mock.calls[0][0];
    expect(call.collectionHash).not.toBe('no-collection');
    expect(call.collectionHash).toContain(':2');
  });
});

describe('deckgen store — startBrew error path', () => {
  it('flips to error on budget exhaustion', async () => {
    generateDeck.mockResolvedValue({
      ok: false,
      code: 'budget_exhausted',
      message: 'Mila needs a break.',
    });
    const s = storeRegistry.deckgen;
    await s.startBrew({
      deckId: 'deck-1', commanderId: 'cmdr-1', powerLevel: 5, mode: 'build',
      useCollectionOnly: false, archetypeHint: '', partialCardIds: [],
    });
    expect(s.status).toBe('error');
    expect(s.error.code).toBe('budget_exhausted');
    expect(s.budgetExhausted).toBe(true);
    expect(s.budgetRemaining).toBe(0);
  });

  it('flips to error on AI provider failure', async () => {
    generateDeck.mockResolvedValue({
      ok: false,
      code: 'ai_provider_error',
      message: 'Mila got distracted.',
    });
    const s = storeRegistry.deckgen;
    await s.startBrew({
      deckId: 'deck-1', commanderId: 'cmdr-1', powerLevel: 5, mode: 'build',
      useCollectionOnly: false, archetypeHint: '', partialCardIds: [],
    });
    expect(s.status).toBe('error');
    expect(s.error.code).toBe('ai_provider_error');
    expect(s.budgetExhausted).toBe(false);
  });
});

describe('deckgen store — review interactions', () => {
  beforeEach(async () => {
    generateDeck.mockResolvedValue({
      ok: true,
      response: {
        recommended: [
          { scryfall_id: 'c1', role: 'RAMP', reasoning: 'r1' },
          { scryfall_id: 'c2', role: 'DRAW', reasoning: 'r2' },
          { scryfall_id: 'c3', role: 'WIN_CON', reasoning: 'r3' },
        ],
      },
    });
    const s = storeRegistry.deckgen;
    await s.startBrew({
      deckId: 'deck-1', commanderId: 'cmdr-1', powerLevel: 5, mode: 'build',
      useCollectionOnly: false, archetypeHint: '', partialCardIds: [],
    });
  });

  it('toggleApproval flips a single card', () => {
    const s = storeRegistry.deckgen;
    expect(s.recommendations.find(r => r.scryfall_id === 'c2').approved).toBe(true);
    s.toggleApproval('c2');
    expect(s.recommendations.find(r => r.scryfall_id === 'c2').approved).toBe(false);
    s.toggleApproval('c2');
    expect(s.recommendations.find(r => r.scryfall_id === 'c2').approved).toBe(true);
  });

  it('toggleApproval does nothing for unknown ids', () => {
    const s = storeRegistry.deckgen;
    const before = s.recommendations.map(r => r.approved);
    s.toggleApproval('does-not-exist');
    const after = s.recommendations.map(r => r.approved);
    expect(after).toEqual(before);
  });

  it('approveAll flips every card to approved', () => {
    const s = storeRegistry.deckgen;
    s.rejectAll();
    expect(s.approvedCount).toBe(0);
    s.approveAll();
    expect(s.approvedCount).toBe(3);
  });

  it('rejectAll flips every card to rejected', () => {
    const s = storeRegistry.deckgen;
    s.rejectAll();
    expect(s.approvedCount).toBe(0);
    expect(s.recommendations.every(r => !r.approved)).toBe(true);
  });
});

describe('deckgen store — commitApproved', () => {
  beforeEach(async () => {
    generateDeck.mockResolvedValue({
      ok: true,
      response: {
        recommended: [
          { scryfall_id: 'c1', role: 'RAMP', reasoning: 'r1' },
          { scryfall_id: 'c2', role: 'DRAW', reasoning: 'r2' },
        ],
      },
    });
    const s = storeRegistry.deckgen;
    await s.startBrew({
      deckId: 'deck-1', commanderId: 'cmdr-1', powerLevel: 5, mode: 'build',
      useCollectionOnly: false, archetypeHint: '', partialCardIds: [],
    });
  });

  it('writes approved cards to db.deck_cards', async () => {
    const s = storeRegistry.deckgen;
    const result = await s.commitApproved();
    expect(result.ok).toBe(true);
    const rows = await db.deck_cards.toArray();
    expect(rows).toHaveLength(2);
    expect(rows.map(r => r.scryfall_id).sort()).toEqual(['c1', 'c2']);
    expect(rows.every(r => r.deck_id === 'deck-1')).toBe(true);
  });

  it('skips rejected cards', async () => {
    const s = storeRegistry.deckgen;
    s.toggleApproval('c2');
    const result = await s.commitApproved();
    expect(result.ok).toBe(true);
    const rows = await db.deck_cards.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].scryfall_id).toBe('c1');
  });

  it('skips cards already in the deck (singleton guard)', async () => {
    await db.deck_cards.add({
      deck_id: 'deck-1',
      scryfall_id: 'c1',
      quantity: 1,
      tags: [],
      sort_order: 0,
    });
    const s = storeRegistry.deckgen;
    const result = await s.commitApproved();
    expect(result.ok).toBe(true);
    const c1Rows = await db.deck_cards.where('scryfall_id').equals('c1').toArray();
    expect(c1Rows).toHaveLength(1); // not duplicated
    const c2Rows = await db.deck_cards.where('scryfall_id').equals('c2').toArray();
    expect(c2Rows).toHaveLength(1); // added fresh
  });

  it('returns ok=false when there are no approved cards', async () => {
    const s = storeRegistry.deckgen;
    s.rejectAll();
    const result = await s.commitApproved();
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/no cards approved/i);
  });

  it('returns ok=false when no active deck is set', async () => {
    const s = storeRegistry.deckgen;
    s.activeDeckId = null;
    const result = await s.commitApproved();
    expect(result.ok).toBe(false);
  });

  it('resets store after successful commit', async () => {
    const s = storeRegistry.deckgen;
    await s.commitApproved();
    expect(s.status).toBe('idle');
    expect(s.recommendations).toEqual([]);
    expect(s.activeDeckId).toBeNull();
  });

  it('fires a success toast after commit', async () => {
    const s = storeRegistry.deckgen;
    await s.commitApproved();
    const toast = storeRegistry.toast;
    expect(toast.success).toHaveBeenCalled();
    expect(toast.success.mock.calls[0][0]).toMatch(/Added 2 cards/i);
  });
});
