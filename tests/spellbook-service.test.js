import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fixtureData from './fixtures/spellbook-combos.json';

describe('spellbook service', () => {
  let findDeckCombos;
  let fetchSpy;

  beforeEach(async () => {
    fetchSpy = vi.fn();
    global.fetch = fetchSpy;
    // Dynamic import to ensure fresh module per test
    const mod = await import('../src/services/spellbook.js');
    findDeckCombos = mod.findDeckCombos;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('wraps card names as { card: "Name" } objects in request body', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fixtureData),
    });

    await findDeckCombos(['Prossh, Skyraider of Kher'], ['Sol Ring', 'Food Chain']);

    const callArgs = fetchSpy.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.commanders).toEqual([{ card: 'Prossh, Skyraider of Kher' }]);
    expect(body.main).toEqual([{ card: 'Sol Ring' }, { card: 'Food Chain' }]);
  });

  it('returns included combos mapped with pieces, produces, description', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fixtureData),
    });

    const result = await findDeckCombos(['Prossh'], ['Squee, the Immortal', 'Food Chain']);

    expect(result.included).toHaveLength(1);
    const combo = result.included[0];
    expect(combo.id).toBe('3519-3705');
    expect(combo.pieces).toHaveLength(2);
    expect(combo.pieces[0]).toEqual({
      name: 'Squee, the Immortal',
      cardId: 3705,
      zoneLocations: ['B'],
    });
    expect(combo.produces).toEqual(['Infinite colored mana', 'Infinite ETB']);
    expect(combo.description).toContain('Food Chain');
  });

  it('returns almostIncluded combos mapped correctly', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fixtureData),
    });

    const result = await findDeckCombos(['Prossh'], ['Peregrine Drake']);

    expect(result.almostIncluded).toHaveLength(1);
    const nearMiss = result.almostIncluded[0];
    expect(nearMiss.id).toBe('1234-5678');
    expect(nearMiss.pieces[0].name).toBe('Peregrine Drake');
    expect(nearMiss.pieces[0].cardId).toBe(1234);
    expect(nearMiss.produces).toEqual(['Infinite mana']);
  });

  it('each combo piece has name, cardId, and zoneLocations fields', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fixtureData),
    });

    const result = await findDeckCombos(['Prossh'], ['Squee, the Immortal']);
    const piece = result.included[0].pieces[0];
    expect(piece).toHaveProperty('name');
    expect(piece).toHaveProperty('cardId');
    expect(piece).toHaveProperty('zoneLocations');
    expect(Array.isArray(piece.zoneLocations)).toBe(true);
  });

  it('each combo produces entry is a feature name string', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fixtureData),
    });

    const result = await findDeckCombos(['Prossh'], ['Squee, the Immortal']);
    for (const feature of result.included[0].produces) {
      expect(typeof feature).toBe('string');
    }
  });

  it('returns safe fallback on network failure', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await findDeckCombos(['Prossh'], ['Sol Ring']);

    expect(result.included).toEqual([]);
    expect(result.almostIncluded).toEqual([]);
    expect(result.error).toBe(true);
  });
});
