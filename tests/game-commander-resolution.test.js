// Audit fix #1 — Game Tracker resolves the selected deck's commander.
//
// Before: deck-based games logged commander=null, silently corrupting
// win-rate-by-commander / most-played / best-deck stats. resolveDeckIdentity
// turns a deck's commander_id/partner_id into the names the game record needs.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

// game.js imports alpinejs at module load (touches `window`); we only exercise
// the pure resolveDeckIdentity helper, so mock alpinejs to keep this a clean
// node-env unit test (same approach as deckgen-store.test.js).
vi.mock('alpinejs', () => ({ default: { store: () => ({}) } }));

import { db } from '../src/db/schema.js';
import { resolveDeckIdentity } from '../src/stores/game.js';

beforeEach(async () => {
  await db.decks.clear();
  await db.cards.clear();
});

describe('resolveDeckIdentity', () => {
  it('resolves the commander name from the deck commander_id', async () => {
    await db.cards.put({ id: 'cmdr-1', name: 'Breya, Etherium Shaper' });
    await db.decks.put({ id: 'deck-1', name: 'Breya', commander_id: 'cmdr-1' });
    const out = await resolveDeckIdentity('deck-1');
    expect(out.commander).toBe('Breya, Etherium Shaper');
    expect(out.partner).toBeNull();
  });

  it('resolves a partner commander too', async () => {
    await db.cards.bulkPut([
      { id: 'cmdr-a', name: 'Tana, the Bloodsower' },
      { id: 'cmdr-b', name: 'Tymna the Weaver' },
    ]);
    await db.decks.put({ id: 'deck-2', name: 'Partners', commander_id: 'cmdr-a', partner_id: 'cmdr-b' });
    const out = await resolveDeckIdentity('deck-2');
    expect(out.commander).toBe('Tana, the Bloodsower');
    expect(out.partner).toBe('Tymna the Weaver');
  });

  it('returns nulls when the deck has no commander_id', async () => {
    await db.decks.put({ id: 'deck-3', name: 'No commander' });
    const out = await resolveDeckIdentity('deck-3');
    expect(out).toEqual({ commander: null, partner: null });
  });

  it('returns nulls when the commander card is missing from the catalog', async () => {
    await db.decks.put({ id: 'deck-4', name: 'Dangling', commander_id: 'not-in-catalog' });
    const out = await resolveDeckIdentity('deck-4');
    expect(out.commander).toBeNull();
  });

  it('returns nulls for an unknown deck id / falsy input', async () => {
    expect(await resolveDeckIdentity('nope')).toEqual({ commander: null, partner: null });
    expect(await resolveDeckIdentity(null)).toEqual({ commander: null, partner: null });
  });
});
