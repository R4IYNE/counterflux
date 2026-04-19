import { describe, it, expect } from 'vitest';
import { renderSpoilerSetFilter } from '../src/components/spoiler-set-filter.js';

describe('renderSpoilerSetFilter', () => {
  it('returns a string containing x-data with open flag', () => {
    const html = renderSpoilerSetFilter();
    expect(typeof html).toBe('string');
    expect(html).toContain('x-data="{ open: false');
  });

  it('includes @click.outside and @keydown.escape.window handlers', () => {
    const html = renderSpoilerSetFilter();
    expect(html).toContain('@click.outside="open = false"');
    expect(html).toContain('@keydown.escape.window="if (open) open = false"');
  });

  it('renders a keyrune icon element inside the option template', () => {
    const html = renderSpoilerSetFilter();
    // ss-fallback class always present for defensive icon rendering
    expect(html).toContain('class="ss ss-fallback"');
    // Dynamic lowercase set-code class binding
    expect(html).toContain(":class=\"'ss-' + set.code.toLowerCase()\"");
  });

  it('iterates $store.market.sets', () => {
    const html = renderSpoilerSetFilter();
    expect(html).toContain('x-for="set in $store.market.sets"');
    expect(html).toContain(':key="set.code"');
  });

  it('renders set.name and set.card_count in each option', () => {
    const html = renderSpoilerSetFilter();
    // Name binding
    expect(html).toContain('x-text="set.name"');
    // Card count appears inside a binding expression (wrapped "(N)" per D-11)
    expect(html).toMatch(/set\.card_count/);
  });

  it('option click calls $store.market.loadSpoilers(set.code) and closes the dropdown', () => {
    const html = renderSpoilerSetFilter();
    expect(html).toContain('$store.market.loadSpoilers(set.code)');
    // Same handler must close the dropdown
    expect(html).toMatch(/\$store\.market\.loadSpoilers\(set\.code\);\s*open\s*=\s*false/);
  });

  it('uses the Neo-Occult Terminal tokens', () => {
    const html = renderSpoilerSetFilter();
    // Surface background (either literal hex or CSS var)
    expect(html).toMatch(/#14161C|#1C1F28|var\(--color-surface\)/);
    // Ghost border colour
    expect(html).toMatch(/#2A2D3A|var\(--color-border-ghost\)/);
    // Muted text colour for card count
    expect(html).toMatch(/#7A8498|var\(--color-text-muted\)/);
  });

  it('uses x-cloak to prevent transition flash', () => {
    const html = renderSpoilerSetFilter();
    expect(html).toContain('x-cloak');
  });
});
