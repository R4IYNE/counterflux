import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync('src/components/counter-panel.js', 'utf-8');

describe('counter panel glyph (POLISH-07)', () => {
  it('uses material-symbols `add` glyph for additional-counters trigger', () => {
    expect(src).toMatch(/>add</);
  });

  it('does not use legacy `more_horiz` glyph', () => {
    expect(src).not.toMatch(/>more_horiz</);
    expect(src).not.toMatch(/more_horiz/);
  });

  it('preserves aria-label="Counters" on the trigger button (Pitfall G)', () => {
    expect(src).toMatch(/aria-label="Counters"/);
  });
});
