// Audit fix #6 — deck-diagnostics digest for AI prompts.

import { describe, it, expect } from 'vitest';
import { buildDeckDiagnostics } from '../src/services/deck-diagnostics.js';

const analytics = {
  typeBreakdown: { Land: 36, Creature: 18, Instant: 8 },
  colourPie: { W: 0, U: 24, B: 0, R: 18, G: 0, C: 6 },
  averageCmc: 3.14,
};

describe('buildDeckDiagnostics', () => {
  it('returns empty string when analytics is missing or the deck is empty', () => {
    expect(buildDeckDiagnostics({})).toBe('');
    expect(buildDeckDiagnostics({ analytics: { typeBreakdown: {} } })).toBe('');
    expect(buildDeckDiagnostics()).toBe('');
  });

  it('summarises totals, lands/creatures, avg CMC, and colour pips', () => {
    const out = buildDeckDiagnostics({ analytics });
    expect(out).toContain('Deck diagnostics');
    expect(out).toContain('Cards in list: 62 (lands: 36, creatures: 18)');
    expect(out).toContain('Average CMC (non-land): 3.14');
    expect(out).toContain('U:24 R:18 C:6');
    expect(out).not.toContain('W:'); // zero pips omitted
  });

  it('lists only the flagged (non-green) category gaps', () => {
    const gaps = [
      { category: 'Ramp', count: 4, threshold: 10, severity: 'red', suggestedAdd: 6 },
      { category: 'Card Draw', count: 7, threshold: 10, severity: 'amber', suggestedAdd: 3 },
      { category: 'Lands', count: 36, threshold: 36, severity: 'green', suggestedAdd: 0 },
    ];
    const out = buildDeckDiagnostics({ analytics, gaps });
    expect(out).toContain('Ramp 4/10 [red, wants +6]');
    expect(out).toContain('Card Draw 7/10 [amber, wants +3]');
    expect(out).not.toContain('Lands 36/36'); // green is omitted
  });

  it('reports full coverage when every category is green', () => {
    const gaps = [
      { category: 'Ramp', count: 11, threshold: 10, severity: 'green', suggestedAdd: 0 },
      { category: 'Lands', count: 37, threshold: 36, severity: 'green', suggestedAdd: 0 },
    ];
    const out = buildDeckDiagnostics({ analytics, gaps });
    expect(out).toMatch(/every functional category is at or above its target/);
  });
});
