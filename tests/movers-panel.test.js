import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderMoversPanel } from '../src/components/movers-panel.js';

const src = readFileSync('src/components/movers-panel.js', 'utf-8');
const html = renderMoversPanel();

describe('movers panel — top losers fallback (POLISH-10)', () => {
  it('does not render scryfall_id as text fallback in either column', () => {
    // The dangerous `card.name || card.scryfall_id` x-text binding must be gone
    expect(src).not.toMatch(/x-text=["']card\.name\s*\|\|\s*card\.scryfall_id["']/);
    expect(html).not.toMatch(/x-text=["']card\.name\s*\|\|\s*card\.scryfall_id["']/);
  });

  it('filters nameless cards out of the displayed list', () => {
    // A filter call keyed on the `.name` field must be present
    expect(src).toMatch(/\.filter\([^)]*\.name/);
  });

  it('provides an empty-state message when no named movers exist', () => {
    expect(src).toMatch(/No movers data available/);
  });

  it('only remaining `scryfall_id` references are :key attributes (list identity)', () => {
    // Extract every line that mentions scryfall_id and ensure none is an x-text
    const lines = src.split('\n').filter(l => l.includes('scryfall_id'));
    for (const line of lines) {
      expect(line).not.toMatch(/x-text/);
    }
  });

  it('iterates over the filtered `gainersNamed` / `losersNamed` accessors', () => {
    expect(src).toMatch(/gainersNamed/);
    expect(src).toMatch(/losersNamed/);
  });
});
