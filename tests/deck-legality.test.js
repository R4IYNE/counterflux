import { describe, it, expect } from 'vitest';
import { validateDeck, isBasicLand, isAnyNumberCard } from '../src/services/deck-legality.js';

const card = (over = {}) => ({
  name: 'Test Card',
  color_identity: [],
  type_line: 'Creature',
  legalities: { commander: 'legal', modern: 'legal', pauper: 'legal' },
  oracle_text: '',
  ...over,
});
const entry = (over = {}, qty = 1) => ({ card: card(over), quantity: qty });

describe('deck-legality helpers', () => {
  it('detects basic lands by name and type line', () => {
    expect(isBasicLand(card({ name: 'Island', type_line: 'Basic Land — Island' }))).toBe(true);
    expect(isBasicLand(card({ name: 'Snow-Covered Forest', type_line: 'Basic Snow Land — Forest' }))).toBe(true);
    expect(isBasicLand(card({ name: 'Llanowar Elves', type_line: 'Creature — Elf Druid' }))).toBe(false);
  });

  it('detects "any number" cards from oracle text', () => {
    expect(isAnyNumberCard(card({ oracle_text: 'A deck can have any number of cards named Relentless Rats.' }))).toBe(true);
    expect(isAnyNumberCard(card({ oracle_text: 'Flying' }))).toBe(false);
  });
});

describe('validateDeck — colour identity (commander)', () => {
  it('flags cards outside the commander identity', () => {
    const res = validateDeck({
      format: 'commander',
      commanderColorIdentity: ['U'],
      deckSize: 2,
      cards: [entry({ color_identity: ['U'] }), entry({ name: 'Doom Blade', color_identity: ['B'] })],
    });
    expect(res.offColor).toHaveLength(1);
    expect(res.offColor[0].name).toBe('Doom Blade');
    expect(res.offColor[0].colors).toEqual(['B']);
  });

  it('does not check colour identity for constructed formats', () => {
    const res = validateDeck({
      format: 'modern',
      commanderColorIdentity: [],
      deckSize: 1,
      cards: [entry({ color_identity: ['B', 'R'] })],
    });
    expect(res.offColor).toHaveLength(0);
  });
});

describe('validateDeck — legality / banlist', () => {
  it('flags banned and not_legal cards for the format', () => {
    const res = validateDeck({
      format: 'modern',
      deckSize: 2,
      cards: [
        entry({ name: 'Banned Card', legalities: { modern: 'banned' } }),
        entry({ name: 'Not Legal', legalities: { modern: 'not_legal' } }),
      ],
    });
    expect(res.illegal.map((c) => c.name).sort()).toEqual(['Banned Card', 'Not Legal']);
    expect(res.warnings.some((w) => /1 banned/.test(w))).toBe(true);
  });

  it('treats restricted as allowed (not an issue)', () => {
    const res = validateDeck({
      format: 'vintage',
      deckSize: 1,
      cards: [entry({ legalities: { vintage: 'restricted' } })],
    });
    expect(res.illegal).toHaveLength(0);
  });
});

describe('validateDeck — copy limits', () => {
  it('singleton (commander): any non-basic > 1 is flagged, basics exempt', () => {
    const res = validateDeck({
      format: 'commander',
      commanderColorIdentity: ['G'],
      deckSize: 3,
      cards: [
        entry({ name: 'Sol Ring', color_identity: [] }, 2),
        entry({ name: 'Forest', type_line: 'Basic Land — Forest' }, 40),
      ],
    });
    expect(res.overCopies.map((c) => c.name)).toEqual(['Sol Ring']);
  });

  it('constructed: > 4 copies flagged, "any number" cards exempt', () => {
    const res = validateDeck({
      format: 'modern',
      deckSize: 5,
      cards: [
        entry({ name: 'Lightning Bolt' }, 5),
        entry({ name: 'Relentless Rats', oracle_text: 'A deck can have any number of cards named Relentless Rats.' }, 12),
      ],
    });
    expect(res.overCopies.map((c) => c.name)).toEqual(['Lightning Bolt']);
    expect(res.overCopies[0].limit).toBe(4);
  });
});

describe('validateDeck — size', () => {
  it('commander: flags over and under the exact target', () => {
    const over = validateDeck({ format: 'commander', commanderColorIdentity: [], deckSize: 2, cards: [entry(), entry(), entry()] });
    expect(over.warnings.some((w) => /over the 2-card limit/.test(w))).toBe(true);
    const under = validateDeck({ format: 'commander', commanderColorIdentity: [], deckSize: 5, cards: [entry()] });
    expect(under.warnings.some((w) => /more card/.test(w))).toBe(true);
  });

  it('constructed: only flags below the minimum', () => {
    const res = validateDeck({ format: 'modern', deckSize: 60, cards: [entry()] });
    expect(res.warnings.some((w) => /minimum/.test(w))).toBe(true);
  });

  it('a clean legal commander deck has no issues', () => {
    const cards = Array.from({ length: 5 }, (_, i) => entry({ name: `Card ${i}`, color_identity: ['U'] }));
    const res = validateDeck({ format: 'commander', commanderColorIdentity: ['U'], deckSize: 5, cards });
    expect(res.hasIssues).toBe(false);
    expect(res.warnings).toEqual([]);
  });
});
