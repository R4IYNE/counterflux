import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { splashScreen, FLAVOUR_TEXTS } from '../src/components/splash-screen.js';

describe('splash screen (POLISH-01, D-17a)', () => {
  beforeEach(() => {
    // Provide a minimal global Alpine shim so component init() can safely introspect stores
    globalThis.Alpine = { store: vi.fn(() => ({ migrationProgress: null })) };
  });

  it('FLAVOUR_TEXTS entries are { quote, attribution } objects', () => {
    expect(Array.isArray(FLAVOUR_TEXTS)).toBe(true);
    expect(FLAVOUR_TEXTS.length).toBeGreaterThanOrEqual(5);
    for (const entry of FLAVOUR_TEXTS) {
      expect(typeof entry.quote).toBe('string');
      expect(typeof entry.attribution).toBe('string');
      expect(entry.quote.length).toBeGreaterThan(0);
      expect(entry.attribution.length).toBeGreaterThan(0);
    }
  });

  it('component exposes flavourText as an object with quote and attribution', () => {
    const cmp = splashScreen();
    expect(typeof cmp.flavourText.quote).toBe('string');
    expect(typeof cmp.flavourText.attribution).toBe('string');
  });

  it('flavour data contains no "--" separators inline', () => {
    for (const entry of FLAVOUR_TEXTS) {
      expect(entry.quote).not.toMatch(/--/);
      expect(entry.attribution).not.toMatch(/--/);
      // Em-dashes should be template-rendered, not in the data
      expect(entry.quote).not.toMatch(/—/);
      expect(entry.attribution).not.toMatch(/^—/);
    }
  });

  it('exposes migrationProgress accessor (D-17a hook)', () => {
    const cmp = splashScreen();
    expect('migrationProgress' in cmp).toBe(true);
    // Should be readable without throwing
    const v = cmp.migrationProgress;
    // Null or a number until Plan 3 populates the store
    expect(v === null || typeof v === 'number').toBe(true);
  });

  it('source references migrationProgress (D-17a hook present in file)', () => {
    const src = readFileSync('src/components/splash-screen.js', 'utf-8');
    expect(src).toMatch(/migrationProgress/);
  });
});
