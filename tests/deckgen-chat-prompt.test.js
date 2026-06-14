// v1.3.x — Mila Brew Chat prompt module tests (pure, no SDK/network).

import { describe, it, expect } from 'vitest';
import {
  CHAT_SYSTEM_PROMPT,
  buildChatContextBlock,
  parseChatEnvelope,
  normalizeConversation,
} from '../src/services/deckgen-chat-prompt.js';
import { MILA_PERSONA } from '../src/services/deckgen-prompt.js';

describe('CHAT_SYSTEM_PROMPT', () => {
  it('opens with the shared Mila persona', () => {
    expect(CHAT_SYSTEM_PROMPT.startsWith(MILA_PERSONA)).toBe(true);
  });

  it('demands strict JSON with the reply/adds/cuts envelope', () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/STRICT JSON/);
    expect(CHAT_SYSTEM_PROMPT).toContain('"reply"');
    expect(CHAT_SYSTEM_PROMPT).toContain('"adds"');
    expect(CHAT_SYSTEM_PROMPT).toContain('"cuts"');
  });

  it('constrains adds to the pool and cuts to the current deck', () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/ADD must be a scryfall_id from the CANDIDATE POOL/);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/CUT must be a scryfall_id from the CURRENT DECK/);
  });

  it('lists the role buckets and forbids touching the commander', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain('WIN_CON');
    expect(CHAT_SYSTEM_PROMPT).toMatch(/Never add or cut the commander/);
  });
});

describe('buildChatContextBlock', () => {
  const commander = {
    name: 'Breya, Etherium Shaper',
    color_identity: ['W', 'U', 'B', 'R'],
    type_line: 'Legendary Creature — Human Artificer',
    oracle_text: 'When Breya enters...',
  };
  const candidates = [
    { scryfall_id: 'pool-1', name: 'Sol Ring', cmc: 1, mana_cost: '{1}', type_line: 'Artifact', color_identity: [] },
    { scryfall_id: 'pool-2', name: 'Arcane Signet', cmc: 2, mana_cost: '{2}', type_line: 'Artifact', color_identity: [] },
  ];
  const deckCards = [
    { scryfall_id: 'deck-1', name: 'Diabolic Tutor' },
    { scryfall_id: 'deck-2', name: 'Divination' },
  ];

  it('injects the commander, power level, current deck, and pool', () => {
    const block = buildChatContextBlock({ commander, candidates, deckCards, powerLevel: 4 });
    expect(block).toContain('Breya, Etherium Shaper');
    expect(block).toContain('4/10');
    // deck cards listed under the cut-only section, keyed by id
    expect(block).toContain('[deck-1] Diabolic Tutor');
    expect(block).toContain('[deck-2] Divination');
    // pool cards listed under the add-only section, compact format
    expect(block).toContain('[pool-1] Sol Ring · CMC 1');
    expect(block).toContain('[pool-2] Arcane Signet · CMC 2');
  });

  it('labels the deck section as cut-only and the pool as add-only', () => {
    const block = buildChatContextBlock({ commander, candidates, deckCards, powerLevel: 5 });
    expect(block).toMatch(/Current deck \(2 cards — you may CUT only/);
    expect(block).toMatch(/Candidate pool \(2 cards — you may ADD only/);
  });

  it('handles an empty deck without crashing', () => {
    const block = buildChatContextBlock({ commander, candidates, deckCards: [], powerLevel: 5 });
    expect(block).toContain('Current deck (0 cards');
    expect(block).toContain('(empty — nothing to cut yet)');
  });

  it('handles an empty candidate pool without crashing', () => {
    const block = buildChatContextBlock({ commander, candidates: [], deckCards, powerLevel: 5 });
    expect(block).toContain('Candidate pool (0 cards');
    expect(block).toContain('(no candidates available)');
  });

  it('drops card subtypes from the pool format to save tokens', () => {
    const block = buildChatContextBlock({
      commander,
      candidates: [{ scryfall_id: 'p', name: 'Mox', cmc: 0, type_line: 'Artifact — Treasure', color_identity: [] }],
      deckCards: [],
      powerLevel: 5,
    });
    // subtype after " — " is dropped
    expect(block).toContain('[p] Mox · CMC 0 · C · Artifact');
    expect(block).not.toContain('Treasure');
  });
});

describe('parseChatEnvelope', () => {
  const poolIds = new Set(['pool-1', 'pool-2']);
  const deckIds = new Set(['deck-1', 'deck-2']);

  it('parses a clean envelope with reply, adds, and cuts', () => {
    const raw = JSON.stringify({
      reply: 'Added a couple of mana rocks and trimmed the slow tutor.',
      adds: [{ scryfall_id: 'pool-1', role: 'RAMP', reasoning: 'cheap rock' }],
      cuts: [{ scryfall_id: 'deck-1', reasoning: 'too slow' }],
    });
    const out = parseChatEnvelope(raw, { poolIds, deckIds });
    expect(out.reply).toMatch(/mana rocks/);
    expect(out.adds).toHaveLength(1);
    expect(out.adds[0].scryfall_id).toBe('pool-1');
    expect(out.cuts).toHaveLength(1);
    expect(out.cuts[0].scryfall_id).toBe('deck-1');
    expect(out.dropped).toEqual({ adds: 0, cuts: 0 });
  });

  it('strips markdown fences before parsing', () => {
    const raw = '```json\n{"reply":"hi","adds":[],"cuts":[]}\n```';
    const out = parseChatEnvelope(raw, { poolIds, deckIds });
    expect(out.reply).toBe('hi');
  });

  it('drops adds whose scryfall_id is not in the candidate pool (hallucination guard)', () => {
    const raw = JSON.stringify({
      reply: 'here',
      adds: [
        { scryfall_id: 'pool-1', role: 'RAMP', reasoning: 'ok' },
        { scryfall_id: 'HALLUCINATED', role: 'WIN_CON', reasoning: 'nope' },
      ],
      cuts: [],
    });
    const out = parseChatEnvelope(raw, { poolIds, deckIds });
    expect(out.adds).toHaveLength(1);
    expect(out.adds[0].scryfall_id).toBe('pool-1');
    expect(out.dropped.adds).toBe(1);
  });

  it('drops cuts whose scryfall_id is not in the current deck', () => {
    const raw = JSON.stringify({
      reply: 'here',
      adds: [],
      cuts: [
        { scryfall_id: 'deck-2', reasoning: 'ok' },
        { scryfall_id: 'not-in-deck', reasoning: 'nope' },
      ],
    });
    const out = parseChatEnvelope(raw, { poolIds, deckIds });
    expect(out.cuts).toHaveLength(1);
    expect(out.cuts[0].scryfall_id).toBe('deck-2');
    expect(out.dropped.cuts).toBe(1);
  });

  it('defaults a missing role to SUPPORT and missing reasoning to empty', () => {
    const raw = JSON.stringify({ reply: 'r', adds: [{ scryfall_id: 'pool-2' }], cuts: [] });
    const out = parseChatEnvelope(raw, { poolIds, deckIds });
    expect(out.adds[0].role).toBe('SUPPORT');
    expect(out.adds[0].reasoning).toBe('');
  });

  it('treats missing adds/cuts arrays as empty (pure-conversation turn)', () => {
    const raw = JSON.stringify({ reply: 'Sol Ring is mandatory ramp — it powers your whole curve.' });
    const out = parseChatEnvelope(raw, { poolIds, deckIds });
    expect(out.adds).toEqual([]);
    expect(out.cuts).toEqual([]);
    expect(out.reply).toMatch(/Sol Ring/);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseChatEnvelope('not json at all', { poolIds, deckIds })).toThrow(/invalid JSON/);
  });

  it('throws when the reply field is missing', () => {
    const raw = JSON.stringify({ adds: [], cuts: [] });
    expect(() => parseChatEnvelope(raw, { poolIds, deckIds })).toThrow(/missing reply/);
  });

  it('skips id validation when pool/deck sets are omitted', () => {
    const raw = JSON.stringify({
      reply: 'r',
      adds: [{ scryfall_id: 'anything', role: 'RAMP', reasoning: 'x' }],
      cuts: [{ scryfall_id: 'whatever', reasoning: 'y' }],
    });
    const out = parseChatEnvelope(raw);
    expect(out.adds).toHaveLength(1);
    expect(out.cuts).toHaveLength(1);
  });
});

describe('normalizeConversation', () => {
  it('keeps a valid alternating conversation intact', () => {
    const msgs = [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
    ];
    expect(normalizeConversation(msgs)).toEqual(msgs);
  });

  it('drops malformed entries (missing/blank content, bad role)', () => {
    const out = normalizeConversation([
      { role: 'user', content: 'keep' },
      { role: 'system', content: 'nope' },
      { role: 'assistant', content: '   ' },
      { role: 'assistant', content: 'kept' },
      { role: 'user', content: '' },
    ]);
    expect(out).toEqual([
      { role: 'user', content: 'keep' },
      { role: 'assistant', content: 'kept' },
    ]);
  });

  it('bounds the conversation to the most recent maxMessages turns', () => {
    const msgs = [];
    for (let i = 0; i < 30; i++) {
      msgs.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: String(i) });
    }
    const out = normalizeConversation(msgs, { maxMessages: 10 });
    expect(out.length).toBeLessThanOrEqual(10);
  });

  it('drops a leading assistant turn after slicing so the array starts with user (Anthropic invariant)', () => {
    // 25 alternating msgs (idx 0=user ... idx 24=user). slice(-24) starts at
    // idx 1 = assistant — which the API rejects. normalize must drop it.
    const msgs = [];
    for (let i = 0; i < 25; i++) {
      msgs.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: String(i) });
    }
    const out = normalizeConversation(msgs, { maxMessages: 24 });
    expect(out[0].role).toBe('user');
    expect(out[out.length - 1].role).toBe('user');
  });

  it('returns [] for non-array / empty input', () => {
    expect(normalizeConversation(undefined)).toEqual([]);
    expect(normalizeConversation([])).toEqual([]);
    expect(normalizeConversation([{ role: 'assistant', content: 'only assistant' }])).toEqual([]);
  });
});
