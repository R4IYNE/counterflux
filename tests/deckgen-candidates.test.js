// Phase 17 (v1.3) — deckgen-candidates unit tests.
//
// Covers the pure logic in src/services/deckgen-candidates.js:
//   - buildCandidatePool filters correctly (commander, colour identity,
//     paper-legal, collection ownership, MAX_CANDIDATES cap)
//   - hashCollection is order-insensitive and content-addressable
//   - buildCacheKey is deterministic and sensitive to every input

import { describe, it, expect } from 'vitest';
import {
  buildCandidatePool,
  hashCollection,
  buildCacheKey,
} from '../src/services/deckgen-candidates.js';

// Helper — minimal Scryfall-shaped card factory
function card(overrides = {}) {
  return {
    id: 'card-' + Math.random().toString(36).slice(2, 8),
    name: 'Card',
    cmc: 2,
    mana_cost: '{1}{U}',
    type_line: 'Instant',
    color_identity: ['U'],
    legalities: { commander: 'legal' },
    games: ['paper'],
    ...overrides,
  };
}

describe('buildCandidatePool', () => {
  it('returns empty when synergies is empty', () => {
    const out = buildCandidatePool({
      synergies: [],
      cards: [],
      ownedIds: null,
      colorIdentity: ['U'],
      commander: card({ id: 'cmdr', color_identity: ['U'] }),
    });
    expect(out).toEqual([]);
  });

  it('excludes the commander from its own pool', () => {
    const commander = card({ id: 'cmdr-id', name: 'Brago', color_identity: ['W', 'U'] });
    const c1 = card({ id: 'cmdr-id', color_identity: ['W', 'U'] }); // matches commander id
    const c2 = card({ id: 'other-id', color_identity: ['U'] });
    const out = buildCandidatePool({
      synergies: [
        { scryfall_id: 'cmdr-id', name: 'Brago' },
        { scryfall_id: 'other-id', name: 'Other' },
      ],
      cards: [c1, c2],
      ownedIds: null,
      colorIdentity: ['W', 'U'],
      commander,
    });
    expect(out.map((c) => c.scryfall_id)).toEqual(['other-id']);
  });

  it('filters cards outside the commander colour identity', () => {
    const commander = card({ id: 'cmdr', color_identity: ['U'] });
    const inColour = card({ id: 'c1', color_identity: ['U'] });
    const outOfColour = card({ id: 'c2', color_identity: ['R'] });
    const colourless = card({ id: 'c3', color_identity: [] });
    const out = buildCandidatePool({
      synergies: [
        { scryfall_id: 'c1' }, { scryfall_id: 'c2' }, { scryfall_id: 'c3' },
      ],
      cards: [inColour, outOfColour, colourless],
      ownedIds: null,
      colorIdentity: ['U'],
      commander,
    });
    expect(out.map((c) => c.scryfall_id).sort()).toEqual(['c1', 'c3']);
  });

  it('filters paper-illegal / banned / memorabilia', () => {
    const commander = card({ id: 'cmdr', color_identity: ['U'] });
    const banned = card({ id: 'banned', legalities: { commander: 'banned' } });
    const mtgoOnly = card({ id: 'mtgo', games: ['mtgo', 'arena'] });
    const memorabilia = card({ id: 'mem', set_type: 'memorabilia' });
    const ok = card({ id: 'ok' });
    const out = buildCandidatePool({
      synergies: [
        { scryfall_id: 'banned' },
        { scryfall_id: 'mtgo' },
        { scryfall_id: 'mem' },
        { scryfall_id: 'ok' },
      ],
      cards: [banned, mtgoOnly, memorabilia, ok],
      ownedIds: null,
      colorIdentity: ['U'],
      commander,
    });
    expect(out.map((c) => c.scryfall_id)).toEqual(['ok']);
  });

  it('respects ownedIds filter when provided', () => {
    const commander = card({ id: 'cmdr', color_identity: ['U'] });
    const c1 = card({ id: 'c1' });
    const c2 = card({ id: 'c2' });
    const out = buildCandidatePool({
      synergies: [{ scryfall_id: 'c1' }, { scryfall_id: 'c2' }],
      cards: [c1, c2],
      ownedIds: new Set(['c1']),
      colorIdentity: ['U'],
      commander,
    });
    expect(out.map((c) => c.scryfall_id)).toEqual(['c1']);
  });

  it('ignores ownedIds filter when null', () => {
    const commander = card({ id: 'cmdr', color_identity: ['U'] });
    const c1 = card({ id: 'c1' });
    const out = buildCandidatePool({
      synergies: [{ scryfall_id: 'c1' }],
      cards: [c1],
      ownedIds: null,
      colorIdentity: ['U'],
      commander,
    });
    expect(out).toHaveLength(1);
  });

  it('caps output at 200 candidates', () => {
    const commander = card({ id: 'cmdr', color_identity: ['U'] });
    const synergies = Array.from({ length: 300 }, (_, i) => ({ scryfall_id: 'c' + i }));
    const cards = synergies.map((s) => card({ id: s.scryfall_id }));
    const out = buildCandidatePool({
      synergies, cards, ownedIds: null, colorIdentity: ['U'], commander,
    });
    expect(out).toHaveLength(200);
  });

  it('preserves synergy_score on output', () => {
    const commander = card({ id: 'cmdr', color_identity: ['U'] });
    const c1 = card({ id: 'c1' });
    const out = buildCandidatePool({
      synergies: [{ scryfall_id: 'c1', synergy_score: 0.87 }],
      cards: [c1],
      ownedIds: null,
      colorIdentity: ['U'],
      commander,
    });
    expect(out[0].synergy_score).toBe(0.87);
  });
});

describe('hashCollection', () => {
  it('returns "no-collection" for null', () => {
    expect(hashCollection(null)).toBe('no-collection');
  });

  it('returns "empty" for empty set', () => {
    expect(hashCollection(new Set())).toBe('empty');
    expect(hashCollection([])).toBe('empty');
  });

  it('is order-insensitive', () => {
    const a = hashCollection(new Set(['a', 'b', 'c']));
    const b = hashCollection(new Set(['c', 'b', 'a']));
    expect(a).toBe(b);
  });

  it('changes when content changes', () => {
    const a = hashCollection(new Set(['a', 'b']));
    const b = hashCollection(new Set(['a', 'b', 'c']));
    expect(a).not.toBe(b);
  });

  it('accepts arrays too', () => {
    const a = hashCollection(['a', 'b']);
    const b = hashCollection(new Set(['a', 'b']));
    expect(a).toBe(b);
  });
});

describe('buildCacheKey', () => {
  const base = {
    commanderId: 'cmdr-1',
    powerLevel: 5,
    mode: 'build',
    archetypeHint: 'tokens',
    collectionHash: 'abc123:50',
  };

  it('is deterministic', () => {
    const a = buildCacheKey(base);
    const b = buildCacheKey(base);
    expect(a).toBe(b);
  });

  it('changes when commanderId changes', () => {
    const a = buildCacheKey(base);
    const b = buildCacheKey({ ...base, commanderId: 'cmdr-2' });
    expect(a).not.toBe(b);
  });

  it('changes when power level changes', () => {
    const a = buildCacheKey(base);
    const b = buildCacheKey({ ...base, powerLevel: 8 });
    expect(a).not.toBe(b);
  });

  it('changes when mode changes', () => {
    const a = buildCacheKey(base);
    const b = buildCacheKey({ ...base, mode: 'fill' });
    expect(a).not.toBe(b);
  });

  it('changes when archetype changes', () => {
    const a = buildCacheKey(base);
    const b = buildCacheKey({ ...base, archetypeHint: 'aristocrats' });
    expect(a).not.toBe(b);
  });

  it('treats archetype hint case-insensitively', () => {
    const a = buildCacheKey({ ...base, archetypeHint: 'tokens' });
    const b = buildCacheKey({ ...base, archetypeHint: 'TOKENS' });
    expect(a).toBe(b);
  });

  it('changes when collection hash changes', () => {
    const a = buildCacheKey(base);
    const b = buildCacheKey({ ...base, collectionHash: 'xyz789:100' });
    expect(a).not.toBe(b);
  });
});
