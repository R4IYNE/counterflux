import { describe, it, expect } from 'vitest';
import { normalizeCondition, normalizeLanguage } from '../src/utils/card-conditions.js';
import { normaliseRow } from '../src/services/csv-import.js';

describe('normalizeCondition (M4)', () => {
  it('maps importer spellings to canonical codes', () => {
    expect(normalizeCondition('Near Mint')).toBe('NM');
    expect(normalizeCondition('mint')).toBe('NM');
    expect(normalizeCondition('lp')).toBe('LP');
    expect(normalizeCondition('Lightly Played')).toBe('LP');
    expect(normalizeCondition('Good')).toBe('LP');
    expect(normalizeCondition('moderately played')).toBe('MP');
    expect(normalizeCondition('Heavily Played')).toBe('HP');
    expect(normalizeCondition('Damaged')).toBe('DMG');
    expect(normalizeCondition('NM')).toBe('NM');
    expect(normalizeCondition('HP')).toBe('HP');
  });
  it('defaults to NM for empty/unknown', () => {
    expect(normalizeCondition('')).toBe('NM');
    expect(normalizeCondition(null)).toBe('NM');
    expect(normalizeCondition('???')).toBe('NM');
  });
});

describe('normalizeLanguage (M4)', () => {
  it('maps names + codes to language codes', () => {
    expect(normalizeLanguage('English')).toBe('en');
    expect(normalizeLanguage('de')).toBe('de');
    expect(normalizeLanguage('Japanese')).toBe('ja');
    expect(normalizeLanguage('JP')).toBe('ja');
    expect(normalizeLanguage('francais')).toBe('fr');
  });
  it('defaults to en for empty/unknown', () => {
    expect(normalizeLanguage('')).toBe('en');
    expect(normalizeLanguage(null)).toBe('en');
    expect(normalizeLanguage('klingon')).toBe('en');
  });
});

describe('normaliseRow carries condition/language (M4)', () => {
  it('reads deckbox Condition + Language columns', () => {
    const r = normaliseRow({ Name: 'Sol Ring', Count: '2', Edition: 'Commander 2021', Foil: '', Condition: 'Good', Language: 'English' }, 'deckbox');
    expect(r.condition).toBe('Good');
    expect(r.language).toBe('English');
  });
  it('reads moxfield Condition + Language columns', () => {
    const r = normaliseRow({ Name: 'Counterspell', Count: '1', Edition: 'mh2', 'Collector Number': '267', Foil: 'foil', Condition: 'NM', Language: 'en' }, 'moxfield');
    expect(r.condition).toBe('NM');
    expect(r.language).toBe('en');
  });
  it('generic falls back to lowercase headers', () => {
    const r = normaliseRow({ name: 'Llanowar Elves', qty: '4', condition: 'lp', language: 'de' }, 'generic');
    expect(r.condition).toBe('lp');
    expect(r.language).toBe('de');
  });
});
