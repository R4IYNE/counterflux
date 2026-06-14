// v1.3.x — Mila Brew Chat store tests.
//
// Covers conversation accumulation, API-message reconstruction, error
// rollback, change toggling, and atomic applyChanges. Mocks alpinejs +
// sendChatMessage; uses fake-indexeddb. Matches deckgen-store.test.js.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

const storeRegistry = {};
vi.mock('alpinejs', () => ({
  default: {
    store: (name, value) => {
      if (value !== undefined) storeRegistry[name] = value;
      return storeRegistry[name];
    },
  },
}));

vi.mock('../src/services/deckgen-chat.js', () => ({
  sendChatMessage: vi.fn(),
}));

import { db } from '../src/db/schema.js';
import { initDeckgenChatStore } from '../src/stores/deckgen-chat.js';
import { sendChatMessage } from '../src/services/deckgen-chat.js';

function setupMockStores() {
  storeRegistry.auth = { session: { access_token: 'mock-token' } };
  storeRegistry.toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
  storeRegistry.deck = {
    activeCards: [],
    loadDeck: vi.fn(),
  };
}

beforeEach(async () => {
  await db.deck_cards.clear();
  for (const k of Object.keys(storeRegistry)) delete storeRegistry[k];
  setupMockStores();
  initDeckgenChatStore();
  sendChatMessage.mockReset();
});

describe('deckgenChat store — initial + lifecycle', () => {
  it('starts idle and empty', () => {
    const s = storeRegistry.deckgenChat;
    expect(s.status).toBe('idle');
    expect(s.messages).toEqual([]);
    expect(s.panelOpen).toBe(false);
  });

  it('openChat sets context, opens the panel, and clears prior conversation', () => {
    const s = storeRegistry.deckgenChat;
    s.messages = [{ role: 'user', text: 'stale' }];
    s.openChat({ deckId: 'deck-1', commanderId: 'cmdr-1', powerLevel: 4, useCollectionOnly: true });
    expect(s.panelOpen).toBe(true);
    expect(s.activeDeckId).toBe('deck-1');
    expect(s.activeCommanderId).toBe('cmdr-1');
    expect(s.powerLevel).toBe(4);
    expect(s.useCollectionOnly).toBe(true);
    expect(s.messages).toEqual([]);
  });

  it('reset clears everything', () => {
    const s = storeRegistry.deckgenChat;
    s.openChat({ deckId: 'd', commanderId: 'c', powerLevel: 5 });
    s.messages = [{ role: 'user', text: 'hi' }];
    s.reset();
    expect(s.panelOpen).toBe(false);
    expect(s.messages).toEqual([]);
    expect(s.activeDeckId).toBeNull();
  });
});

describe('deckgenChat store — sendMessage success', () => {
  beforeEach(() => {
    const s = storeRegistry.deckgenChat;
    s.openChat({ deckId: 'deck-1', commanderId: 'cmdr-1', powerLevel: 5 });
  });

  it('appends user + assistant turns and defaults changes to approved', async () => {
    sendChatMessage.mockResolvedValue({
      ok: true,
      reply: 'Added a rock, cut the slow tutor.',
      adds: [{ scryfall_id: 'a1', name: 'Sol Ring', role: 'RAMP', reasoning: 'fast mana' }],
      cuts: [{ scryfall_id: 'c1', name: 'Diabolic Tutor', reasoning: 'too slow' }],
      budgetRemaining: 18,
    });

    const s = storeRegistry.deckgenChat;
    s.input = 'more ramp, less durdle';
    await s.sendMessage();

    expect(s.messages).toHaveLength(2);
    expect(s.messages[0]).toEqual({ role: 'user', text: 'more ramp, less durdle' });
    const asst = s.messages[1];
    expect(asst.role).toBe('assistant');
    expect(asst.reply).toMatch(/Added a rock/);
    expect(asst.adds[0].approved).toBe(true);
    expect(asst.cuts[0].approved).toBe(true);
    expect(asst.applied).toBe(false);
    expect(s.budgetRemaining).toBe(18);
    expect(s.status).toBe('idle');
    expect(s.input).toBe('');
  });

  it('reconstructs the API messages array (user→text, assistant→raw) and sends deck cards', async () => {
    storeRegistry.deck.activeCards = [
      { scryfall_id: 'd1', card: { name: 'Divination' } },
      { scryfall_id: 'cmdr-1', card: { name: 'Breya' } }, // commander excluded
    ];
    sendChatMessage
      .mockResolvedValueOnce({ ok: true, reply: 'first', adds: [], cuts: [], budgetRemaining: 19 })
      .mockResolvedValueOnce({ ok: true, reply: 'second', adds: [], cuts: [], budgetRemaining: 18 });

    const s = storeRegistry.deckgenChat;
    s.input = 'hello';
    await s.sendMessage();
    s.input = 'again';
    await s.sendMessage();

    const secondCall = sendChatMessage.mock.calls[1][0];
    // history is user/assistant/user (the just-sent turn)
    expect(secondCall.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(secondCall.messages[0].content).toBe('hello');
    expect(secondCall.messages[1].content).toContain('"reply":"first"');
    expect(secondCall.messages[2].content).toBe('again');
    // deck cards exclude the commander
    expect(secondCall.deckCards).toEqual([{ scryfall_id: 'd1', name: 'Divination' }]);

    const token = await secondCall.getAccessToken();
    expect(token).toBe('mock-token');
  });

  it('ignores empty input and sends nothing', async () => {
    const s = storeRegistry.deckgenChat;
    s.input = '   ';
    await s.sendMessage();
    expect(sendChatMessage).not.toHaveBeenCalled();
    expect(s.messages).toHaveLength(0);
  });
});

describe('deckgenChat store — sendMessage error rollback', () => {
  beforeEach(() => {
    storeRegistry.deckgenChat.openChat({ deckId: 'deck-1', commanderId: 'cmdr-1', powerLevel: 5 });
  });

  it('rolls back the user turn and restores input on failure', async () => {
    sendChatMessage.mockResolvedValue({ ok: false, code: 'ai_provider_error', message: 'distracted' });
    const s = storeRegistry.deckgenChat;
    s.input = 'try this';
    await s.sendMessage();
    expect(s.messages).toHaveLength(0);      // user turn rolled back
    expect(s.input).toBe('try this');         // input restored for retry
    expect(s.status).toBe('error');
    expect(s.error.code).toBe('ai_provider_error');
  });

  it('flags budget exhaustion', async () => {
    sendChatMessage.mockResolvedValue({ ok: false, code: 'budget_exhausted', message: 'break' });
    const s = storeRegistry.deckgenChat;
    s.input = 'go';
    await s.sendMessage();
    expect(s.budgetExhausted).toBe(true);
    expect(s.budgetRemaining).toBe(0);
  });
});

describe('deckgenChat store — toggleChange', () => {
  beforeEach(async () => {
    sendChatMessage.mockResolvedValue({
      ok: true,
      reply: 'r',
      adds: [{ scryfall_id: 'a1', name: 'Sol Ring', role: 'RAMP', reasoning: '' }],
      cuts: [{ scryfall_id: 'c1', name: 'Slow', reasoning: '' }],
      budgetRemaining: 19,
    });
    const s = storeRegistry.deckgenChat;
    s.openChat({ deckId: 'deck-1', commanderId: 'cmdr-1', powerLevel: 5 });
    s.input = 'x';
    await s.sendMessage();
  });

  it('flips an add and a cut independently', () => {
    const s = storeRegistry.deckgenChat;
    expect(s.approvedCount(1)).toBe(2);
    s.toggleChange(1, 'adds', 'a1');
    expect(s.messages[1].adds[0].approved).toBe(false);
    expect(s.approvedCount(1)).toBe(1);
    s.toggleChange(1, 'cuts', 'c1');
    expect(s.approvedCount(1)).toBe(0);
  });
});

describe('deckgenChat store — applyChanges (atomic)', () => {
  beforeEach(async () => {
    // Pre-seed the deck with the card that will be cut.
    await db.deck_cards.bulkAdd([
      { deck_id: 'deck-1', scryfall_id: 'c1', quantity: 1, tags: [], sort_order: 0 },
    ]);
    sendChatMessage.mockResolvedValue({
      ok: true,
      reply: 'swap',
      adds: [{ scryfall_id: 'a1', name: 'Sol Ring', role: 'RAMP', reasoning: '' }],
      cuts: [{ scryfall_id: 'c1', name: 'Slow', reasoning: '' }],
      budgetRemaining: 19,
    });
    const s = storeRegistry.deckgenChat;
    s.openChat({ deckId: 'deck-1', commanderId: 'cmdr-1', powerLevel: 5 });
    s.input = 'x';
    await s.sendMessage();
  });

  it('adds approved adds and removes approved cuts in one transaction', async () => {
    const s = storeRegistry.deckgenChat;
    const result = await s.applyChanges(1);
    expect(result.ok).toBe(true);
    expect(result.addedCount).toBe(1);
    expect(result.cutCount).toBe(1);

    const a1 = await db.deck_cards.where('scryfall_id').equals('a1').toArray();
    const c1 = await db.deck_cards.where('scryfall_id').equals('c1').toArray();
    expect(a1).toHaveLength(1);
    expect(c1).toHaveLength(0);
    expect(s.messages[1].applied).toBe(true);
    expect(storeRegistry.deck.loadDeck).toHaveBeenCalledWith('deck-1');
  });

  it('skips rejected changes', async () => {
    const s = storeRegistry.deckgenChat;
    s.toggleChange(1, 'cuts', 'c1');   // reject the cut
    const result = await s.applyChanges(1);
    expect(result.ok).toBe(true);
    expect(result.cutCount).toBe(0);
    const c1 = await db.deck_cards.where('scryfall_id').equals('c1').toArray();
    expect(c1).toHaveLength(1);        // still present
  });

  it('does not duplicate a card already in the deck', async () => {
    await db.deck_cards.add({ deck_id: 'deck-1', scryfall_id: 'a1', quantity: 1, tags: [], sort_order: 0 });
    const s = storeRegistry.deckgenChat;
    const result = await s.applyChanges(1);
    expect(result.ok).toBe(true);
    const a1 = await db.deck_cards.where('scryfall_id').equals('a1').toArray();
    expect(a1).toHaveLength(1);        // not duplicated
  });

  it('returns ok=false when nothing is approved', async () => {
    const s = storeRegistry.deckgenChat;
    s.toggleChange(1, 'adds', 'a1');
    s.toggleChange(1, 'cuts', 'c1');
    const result = await s.applyChanges(1);
    expect(result.ok).toBe(false);
  });

  it('is a no-op on an already-applied message', async () => {
    const s = storeRegistry.deckgenChat;
    await s.applyChanges(1);
    const result = await s.applyChanges(1);
    expect(result.ok).toBe(false);
  });
});
