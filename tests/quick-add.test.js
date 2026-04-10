import { describe, it, expect } from 'vitest';
import { parseBatchLine } from '../src/services/mass-entry.js';

/**
 * Quick Add syntax parsing tests.
 * Tests the parseBatchLine function used by the dashboard Quick Add bar.
 */

describe('Quick Add -- parseBatchLine', () => {
  it('parses standard syntax: 4x Lightning Bolt [2XM]', () => {
    const result = parseBatchLine('4x Lightning Bolt [2XM]');
    expect(result).toMatchObject({
      parsed: true,
      quantity: 4,
      name: 'Lightning Bolt',
      setCode: '2XM',
      foil: false,
    });
  });

  it('parses foil flag: 1x Sol Ring foil', () => {
    const result = parseBatchLine('1x Sol Ring foil');
    expect(result).toMatchObject({
      parsed: true,
      quantity: 1,
      name: 'Sol Ring',
      foil: true,
    });
  });

  it('parses without set code: 2x Sol Ring', () => {
    const result = parseBatchLine('2x Sol Ring');
    expect(result).toMatchObject({
      parsed: true,
      quantity: 2,
      name: 'Sol Ring',
      setCode: null,
      foil: false,
    });
  });

  it('parses set code + foil: 3x Mana Crypt [2XM] foil', () => {
    const result = parseBatchLine('3x Mana Crypt [2XM] foil');
    expect(result).toMatchObject({
      parsed: true,
      quantity: 3,
      name: 'Mana Crypt',
      setCode: '2XM',
      foil: true,
    });
  });

  it('returns parsed false for unparseable input', () => {
    const result = parseBatchLine('just some text');
    expect(result).toMatchObject({
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

  it('returns null for undefined input', () => {
    expect(parseBatchLine(undefined)).toBeNull();
  });

  it('trims whitespace before parsing', () => {
    const result = parseBatchLine('  1x Counterspell  ');
    expect(result).toMatchObject({
      parsed: true,
      quantity: 1,
      name: 'Counterspell',
    });
  });

  it('handles single digit quantity without x', () => {
    const result = parseBatchLine('2 Sol Ring');
    expect(result).toMatchObject({
      parsed: true,
      quantity: 2,
      name: 'Sol Ring',
    });
  });
});
