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

describe('deckgen store — deep-link queue', () => {
  it('queueAction sets pendingDeckId and pendingAction', () => {
    const s = storeRegistry.deckgen;
    s.queueAction({ deckId: 'deck-1', action: 'upgrade' });
    expect(s.pendingDeckId).toBe('deck-1');
    expect(s.pendingAction).toBe('upgrade');
  });

  it('consumePendingAction returns the action and clears the queue', () => {
    const s = storeRegistry.deckgen;
    s.queueAction({ deckId: 'deck-1', action: 'retune' });
    const result = s.consumePendingAction('deck-1');
    expect(result).toBe('retune');
    expect(s.pendingDeckId).toBeNull();
    expect(s.pendingAction).toBeNull();
  });

  it('consumePendingAction returns null when the deck id does not match', () => {
    const s = storeRegistry.deckgen;
    s.queueAction({ deckId: 'deck-1', action: 'upgrade' });
    const result = s.consumePendingAction('deck-2');
    expect(result).toBeNull();
    // Queue still set
    expect(s.pendingDeckId).toBe('deck-1');
    expect(s.pendingAction).toBe('upgrade');
  });

  it('consumePendingAction returns null when nothing is queued', () => {
    const s = storeRegistry.deckgen;
    const result = s.consumePendingAction('deck-1');
    expect(result).toBeNull();
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

  it('openBrewModal accepts retune mode', () => {
    const s = storeRegistry.deckgen;
    s.openBrewModal('retune');
    expect(s.modalMode).toBe('retune');
    expect(s.brewModalOpen).toBe(true);
  });

  it('openBrewModal accepts upgrade mode', () => {
    const s = storeRegistry.deckgen;
    s.openBrewModal('upgrade');
    expect(s.modalMode).toBe('upgrade');
  });

  it('openBrewModal defaults to build mode for unknown values', () => {
    const s = storeRegistry.deckgen;
    s.openBrewModal('nonsense');
    expect(s.modalMode).toBe('build');
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

// 260608-swp — swap mode (retune / upgrade) commits
describe('deckgen store — commitApproved swap mode', () => {
  beforeEach(async () => {
    // Pre-seed the deck with the cards that will be swapped OUT
    await db.deck_cards.bulkAdd([
      { deck_id: 'deck-1', scryfall_id: 'old-1', quantity: 1, tags: [], sort_order: 0 },
      { deck_id: 'deck-1', scryfall_id: 'old-2', quantity: 1, tags: [], sort_order: 0 },
    ]);

    generateDeck.mockResolvedValue({
      ok: true,
      response: {
        recommended: [
          { scryfall_id: 'new-1', role: 'RAMP', reasoning: 'better mana rock', swap_out: 'old-1' },
          { scryfall_id: 'new-2', role: 'DRAW', reasoning: 'better card draw', swap_out: 'old-2' },
        ],
      },
    });
    const s = storeRegistry.deckgen;
    await s.startBrew({
      deckId: 'deck-1', commanderId: 'cmdr-1', powerLevel: 5, mode: 'retune',
      useCollectionOnly: false, archetypeHint: '', partialCardIds: [],
    });
  });

  it('removes swap_out card AND adds new card in one transaction', async () => {
    const s = storeRegistry.deckgen;
    const result = await s.commitApproved();
    expect(result.ok).toBe(true);
    expect(result.swappedCount).toBe(2);

    // Old cards gone
    const oldRows = await db.deck_cards.where('scryfall_id').anyOf(['old-1', 'old-2']).toArray();
    expect(oldRows).toHaveLength(0);

    // New cards added
    const newRows = await db.deck_cards.where('scryfall_id').anyOf(['new-1', 'new-2']).toArray();
    expect(newRows).toHaveLength(2);
  });

  it('rejected swaps leave the original card in place', async () => {
    const s = storeRegistry.deckgen;
    s.toggleApproval('new-2'); // reject the second swap

    const result = await s.commitApproved();
    expect(result.ok).toBe(true);
    expect(result.swappedCount).toBe(1);

    // old-1 swapped out, old-2 remains
    const old1 = await db.deck_cards.where('scryfall_id').equals('old-1').toArray();
    const old2 = await db.deck_cards.where('scryfall_id').equals('old-2').toArray();
    expect(old1).toHaveLength(0);
    expect(old2).toHaveLength(1);

    // new-1 added, new-2 not
    const new1 = await db.deck_cards.where('scryfall_id').equals('new-1').toArray();
    const new2 = await db.deck_cards.where('scryfall_id').equals('new-2').toArray();
    expect(new1).toHaveLength(1);
    expect(new2).toHaveLength(0);
  });

  it('handles swap_out card not in deck gracefully (idempotent)', async () => {
    // Manually delete one of the cards before commit — simulate a
    // user who edited the deck after the recommendations were generated.
    await db.deck_cards.where('scryfall_id').equals('old-1').delete();

    const s = storeRegistry.deckgen;
    const result = await s.commitApproved();
    expect(result.ok).toBe(true);

    // new-1 still added even though old-1 was already gone
    const new1 = await db.deck_cards.where('scryfall_id').equals('new-1').toArray();
    expect(new1).toHaveLength(1);
  });

  it('toast message reflects swap count', async () => {
    const s = storeRegistry.deckgen;
    await s.commitApproved();
    const toast = storeRegistry.toast;
    expect(toast.success.mock.calls[0][0]).toMatch(/Swapped 2 cards/i);
  });
});
