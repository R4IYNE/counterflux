import { describe, it, expect } from 'vitest';
import { detectFormat, normaliseRow } from '../src/services/csv-import.js';

describe('detectFormat', () => {
  it('detects deckbox format from headers', () => {
    const headers = ['Count', 'Tradelist Count', 'Name', 'Edition', 'Condition', 'Language', 'Foil'];
    expect(detectFormat(headers)).toBe('deckbox');
  });

  it('detects moxfield format from headers (superset of deckbox)', () => {
    const headers = ['Count', 'Tradelist Count', 'Name', 'Edition', 'Condition', 'Language', 'Foil', 'Tags', 'Last Modified', 'Collector Number'];
    expect(detectFormat(headers)).toBe('moxfield');
  });

  it('detects archidekt format from headers', () => {
    const headers = ['export_type', 'scryfall_uuid', 'set_code', 'quantity', 'foil_quantity', 'card_name'];
    expect(detectFormat(headers)).toBe('archidekt');
  });

  it('falls back to generic for unknown headers', () => {
    const headers = ['Name', 'Quantity', 'Set'];
    expect(detectFormat(headers)).toBe('generic');
  });
});

describe('normaliseRow', () => {
  it('normalises deckbox row to internal shape', () => {
    const row = { Count: '4', Name: 'Lightning Bolt', Edition: 'Masters 25', Foil: '' };
    const result = normaliseRow(row, 'deckbox');
    expect(result).toEqual({
      name: 'Lightning Bolt',
      quantity: 4,
      setName: 'Masters 25',
      foil: false,
    });
  });

  it('normalises moxfield row with foil status', () => {
    const row = { Count: '2', Name: 'Sol Ring', Edition: 'cmr', Foil: 'foil', 'Collector Number': '472' };
    const result = normaliseRow(row, 'moxfield');
    expect(result).toEqual({
      name: 'Sol Ring',
      quantity: 2,
      setCode: 'cmr',
      collectorNumber: '472',
      foil: true,
    });
  });

  it('normalises archidekt row with foil_quantity', () => {
    const row = { card_name: 'Counterspell', quantity: '3', set_code: 'mh2', scryfall_uuid: 'abc-123', foil_quantity: '1' };
    const result = normaliseRow(row, 'archidekt');
    expect(result).toEqual({
      name: 'Counterspell',
      quantity: 3,
      setCode: 'mh2',
      scryfallId: 'abc-123',
      foil: true,
    });
  });

  it('normalises archidekt row with zero foil_quantity', () => {
    const row = { card_name: 'Counterspell', quantity: '3', set_code: 'mh2', scryfall_uuid: 'abc-123', foil_quantity: '0' };
    const result = normaliseRow(row, 'archidekt');
    expect(result.foil).toBe(false);
  });

  it('normalises generic row to internal shape', () => {
    const row = { Name: 'Lightning Bolt', Quantity: '4', Set: '2XM' };
    const result = normaliseRow(row, 'generic');
    expect(result.name).toBe('Lightning Bolt');
    expect(result.quantity).toBe(4);
    expect(result.foil).toBe(false);
  });

  it('handles generic row with alternative column names', () => {
    const row = { 'Card Name': 'Sol Ring', Count: '1' };
    const result = normaliseRow(row, 'generic');
    expect(result.name).toBe('Sol Ring');
    expect(result.quantity).toBe(1);
  });

  it('defaults quantity to 1 for missing or invalid values', () => {
    const row = { Name: 'Island', Count: 'abc', Edition: 'UST', Foil: '' };
    const result = normaliseRow(row, 'deckbox');
    expect(result.quantity).toBe(1);
  });
});
