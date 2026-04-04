import { describe, it, expect, vi } from 'vitest';
import { parseBatchLine, parseBatchText, resolveBatchEntries } from '../src/services/mass-entry.js';

describe('parseBatchLine', () => {
  it('parses "4x Lightning Bolt [2XM] foil" with all fields', () => {
    const result = parseBatchLine('4x Lightning Bolt [2XM] foil');
    expect(result).toEqual({
      raw: '4x Lightning Bolt [2XM] foil',
      parsed: true,
      quantity: 4,
      name: 'Lightning Bolt',
      setCode: '2XM',
      foil: true,
    });
  });

  it('parses "2x Sol Ring" without set or foil', () => {
    const result = parseBatchLine('2x Sol Ring');
    expect(result).toEqual({
      raw: '2x Sol Ring',
      parsed: true,
      quantity: 2,
      name: 'Sol Ring',
      setCode: null,
      foil: false,
    });
  });

  it('parses "1x Counterspell [MH2]" without foil', () => {
    const result = parseBatchLine('1x Counterspell [MH2]');
    expect(result).toEqual({
      raw: '1x Counterspell [MH2]',
      parsed: true,
      quantity: 1,
      name: 'Counterspell',
      setCode: 'MH2',
      foil: false,
    });
  });

  it('returns parsed: false for "just some text"', () => {
    const result = parseBatchLine('just some text');
    expect(result).toEqual({
      raw: 'just some text',
      parsed: false,
    });
  });

  it('returns null for empty string', () => {
    expect(parseBatchLine('')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(parseBatchLine(null)).toBeNull();
  });

  it('handles double-digit qty "10x Arcane Signet [C21] foil"', () => {
    const result = parseBatchLine('10x Arcane Signet [C21] foil');
    expect(result).toEqual({
      raw: '10x Arcane Signet [C21] foil',
      parsed: true,
      quantity: 10,
      name: 'Arcane Signet',
      setCode: 'C21',
      foil: true,
    });
  });

  it('trims whitespace from input', () => {
    const result = parseBatchLine('  3x Swords to Plowshares  ');
    expect(result.parsed).toBe(true);
    expect(result.quantity).toBe(3);
    expect(result.name).toBe('Swords to Plowshares');
  });
});

describe('parseBatchText', () => {
  it('parses multiline text and skips empty lines', () => {
    const text = '4x Lightning Bolt\n2x Sol Ring\n\n1x Counterspell';
    const results = parseBatchText(text);
    expect(results).toHaveLength(3);
    expect(results[0].name).toBe('Lightning Bolt');
    expect(results[1].name).toBe('Sol Ring');
    expect(results[2].name).toBe('Counterspell');
  });

  it('returns empty array for empty text', () => {
    expect(parseBatchText('')).toEqual([]);
  });
});

describe('resolveBatchEntries', () => {
  it('resolves known cards using search function', async () => {
    const mockSearch = vi.fn()
      .mockResolvedValueOnce([{ id: 'bolt-001', name: 'Lightning Bolt', set: '2xm' }]);

    const parsed = [{ raw: '4x Lightning Bolt', parsed: true, quantity: 4, name: 'Lightning Bolt', setCode: null, foil: false }];
    const results = await resolveBatchEntries(parsed, mockSearch);

    expect(results).toHaveLength(1);
    expect(results[0].resolved).toBe(true);
    expect(results[0].card.id).toBe('bolt-001');
  });

  it('resolves to specific set when setCode provided', async () => {
    const mockSearch = vi.fn().mockResolvedValueOnce([
      { id: 'bolt-2xm', name: 'Lightning Bolt', set: '2xm' },
      { id: 'bolt-m21', name: 'Lightning Bolt', set: 'm21' },
    ]);

    const parsed = [{ raw: '4x Lightning Bolt [2XM]', parsed: true, quantity: 4, name: 'Lightning Bolt', setCode: '2XM', foil: false }];
    const results = await resolveBatchEntries(parsed, mockSearch);

    expect(results[0].resolved).toBe(true);
    expect(results[0].card.id).toBe('bolt-2xm');
  });

  it('flags unresolved entries when no cards found', async () => {
    const mockSearch = vi.fn().mockResolvedValueOnce([]);

    const parsed = [{ raw: 'Nonexistent Card', parsed: false }];
    const results = await resolveBatchEntries(parsed, mockSearch);

    expect(results[0].resolved).toBe(false);
    expect(results[0].candidates).toEqual([]);
  });

  it('provides candidates for unparsed lines', async () => {
    const parsed = [{ raw: 'just some text', parsed: false }];
    const results = await resolveBatchEntries(parsed, vi.fn());

    expect(results[0].resolved).toBe(false);
    expect(results[0].candidates).toEqual([]);
  });
});
