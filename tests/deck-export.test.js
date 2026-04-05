import { describe, it, expect } from 'vitest';
import { exportPlaintext, exportMTGO, exportArena, exportCSV } from '../src/services/deck-export.js';

const makeDeckData = (overrides = {}) => ({
  activeDeck: { name: 'Test Deck', commander_id: 'cmd-001', partner_id: null, ...overrides.deck },
  activeCards: overrides.cards || [
    {
      quantity: 1,
      scryfall_id: 'sr-001',
      card: { name: 'Sol Ring', set: '2xm', collector_number: '274', mana_cost: '{1}', type_line: 'Artifact' },
    },
    {
      quantity: 1,
      scryfall_id: 'lb-001',
      card: { name: 'Lightning Bolt', set: 'sta', collector_number: '42', mana_cost: '{R}', type_line: 'Instant' },
    },
  ],
  commanderCard: overrides.commanderCard || { name: 'Krark, the Thumbless', set: 'cmr', collector_number: '123', mana_cost: '{1}{R}', type_line: 'Legendary Creature' },
});

describe('exportPlaintext', () => {
  it('generates plaintext with commander section', () => {
    const data = makeDeckData();
    const result = exportPlaintext(data.activeCards, data.activeDeck, data.commanderCard);
    expect(result).toContain('// Commander');
    expect(result).toContain('1 Krark, the Thumbless');
    expect(result).toContain('// The 99');
    expect(result).toContain('1 Sol Ring');
    expect(result).toContain('1 Lightning Bolt');
  });

  it('omits commander section when no commander', () => {
    const data = makeDeckData({ deck: { commander_id: null }, commanderCard: null });
    const result = exportPlaintext(data.activeCards, data.activeDeck, null);
    expect(result).not.toContain('// Commander');
    expect(result).toContain('1 Sol Ring');
  });

  it('returns empty string for empty deck', () => {
    const data = makeDeckData({ cards: [], commanderCard: null, deck: { commander_id: null } });
    const result = exportPlaintext(data.activeCards, data.activeDeck, null);
    expect(result.trim()).toBe('');
  });
});

describe('exportMTGO', () => {
  it('generates MTGO format (same as plaintext for Commander)', () => {
    const data = makeDeckData();
    const result = exportMTGO(data.activeCards, data.activeDeck, data.commanderCard);
    expect(result).toContain('1 Sol Ring');
    expect(result).toContain('1 Lightning Bolt');
  });
});

describe('exportArena', () => {
  it('generates arena format with set code and collector number', () => {
    const data = makeDeckData();
    const result = exportArena(data.activeCards, data.activeDeck, data.commanderCard);
    expect(result).toContain('1 Sol Ring (2XM) 274');
    expect(result).toContain('1 Lightning Bolt (STA) 42');
  });

  it('returns empty string for empty deck', () => {
    const data = makeDeckData({ cards: [], commanderCard: null, deck: { commander_id: null } });
    const result = exportArena(data.activeCards, data.activeDeck, null);
    expect(result.trim()).toBe('');
  });
});

describe('exportCSV', () => {
  it('generates CSV with correct headers', () => {
    const data = makeDeckData();
    const result = exportCSV(data.activeCards, data.activeDeck, data.commanderCard);
    const lines = result.trim().split(/\r?\n/);
    expect(lines[0]).toBe('Name,Quantity,Set,Collector Number,Mana Cost,Type');
  });

  it('includes card data rows', () => {
    const data = makeDeckData();
    const result = exportCSV(data.activeCards, data.activeDeck, data.commanderCard);
    expect(result).toContain('Sol Ring');
    expect(result).toContain('Lightning Bolt');
    expect(result).toContain('Krark, the Thumbless');
  });

  it('returns headers only for empty deck', () => {
    const data = makeDeckData({ cards: [], commanderCard: null, deck: { commander_id: null } });
    const result = exportCSV(data.activeCards, data.activeDeck, null);
    const lines = result.trim().split(/\r?\n/);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('Name,Quantity,Set,Collector Number,Mana Cost,Type');
  });
});
