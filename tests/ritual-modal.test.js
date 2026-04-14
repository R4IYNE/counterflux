import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync('src/components/ritual-modal.js', 'utf-8');
const landing = readFileSync('src/components/deck-landing.js', 'utf-8');

describe('ritual modal copy (POLISH-06)', () => {
  it('uses "Brew a new storm" and "Abandon storm"', () => {
    expect(src).toMatch(/Brew a new storm/);
    expect(src).toMatch(/Abandon storm/);
  });

  it('contains no legacy "Initiate ritual" or "Abandon ritual" user-visible strings', () => {
    // Plan 07-01 Test 2: literal exclusion (case-sensitive lowercase variants)
    expect(src).not.toMatch(/Initiate ritual/);
    expect(src).not.toMatch(/Abandon ritual/);
  });

  it('no longer uses the older "Initialize Ritual" / "Begin Ritual" button labels', () => {
    // Module still has a docstring referring to the rename; guard only button labels.
    // Buttons are rendered inside template literals; a visible label check is OK here.
    const withoutComments = src.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(withoutComments).not.toMatch(/>Initialize Ritual</);
    expect(withoutComments).not.toMatch(/>Begin Ritual</);
    expect(withoutComments).not.toMatch(/>Abandon Ritual</);
  });

  it('deck-landing triggers use "Brew a new storm" button copy', () => {
    expect(landing).toMatch(/>Brew a new storm</);
    expect(landing).not.toMatch(/>Initialize Ritual</);
    expect(landing).not.toMatch(/Initiate ritual/);
  });
});
