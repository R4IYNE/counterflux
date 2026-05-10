// @vitest-environment node
// Static-grep + factory contract tests for the topbar nav refactor
// (2026-05-10 topbar-nav). Follows the pattern from
// tests/topbar-bulkdata-pill.test.js (readFileSync + regex + dynamic import
// of the component factory).

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf-8');

// Helper: extract the <header>...</header> block from the topbar.
// Returns '' if not found — the test will fail meaningfully.
function topbarMarkup() {
  const start = html.indexOf('<header');
  if (start === -1) return '';
  const end = html.indexOf('</header>', start);
  return end === -1 ? html.slice(start) : html.slice(start, end + '</header>'.length);
}

describe('topbar brand block', () => {
  const topbar = topbarMarkup();

  it('renders the cyclone Material Symbol inside the topbar', () => {
    expect(topbar).toMatch(/cyclone/);
  });

  it('renders the COUNTERFLUX wordmark inside the topbar', () => {
    expect(topbar).toMatch(/COUNTERFLUX/);
  });

  it('uses JetBrains Mono treatment for the wordmark (matches transplanted sidebar brand)', () => {
    expect(topbar).toMatch(/font-mono[\s\S]*?COUNTERFLUX|COUNTERFLUX[\s\S]*?font-mono/);
    expect(topbar).toMatch(/tracking-\[0\.3em\]/);
  });
});

describe('topbar nav links', () => {
  const topbar = topbarMarkup();

  const plainLabels = ['Dashboard', 'Collection', 'Decks', 'Market', 'Game'];

  it('uses an x-for loop driven by $store.app.screens', () => {
    expect(topbar).toMatch(/x-for="screen in \$store\.app\.screens"/);
  });

  it('binds each link to screen.route', () => {
    expect(topbar).toMatch(/'#' \+ screen\.route|"#" \+ screen\.route/);
  });

  it('renders the topbarLabel field, not the card-name label', () => {
    expect(topbar).toMatch(/x-text="screen\.topbarLabel"/);
  });
});

describe('app store — topbarLabel field (static grep against source)', () => {
  // src/stores/app.js imports Alpine from 'alpinejs', so we can't stub it cleanly
  // in a node test. Static grep against the source file is reliable and matches
  // the pattern used by tests/topbar-bulkdata-pill.test.js (readFileSync + regex).
  const appJs = readFileSync('src/stores/app.js', 'utf-8');

  const expected = {
    'epic-experiment': 'Dashboard',
    'treasure-cruise': 'Collection',
    'thousand-year-storm': 'Decks',
    'preordain': 'Market',
    'vandalblast': 'Game',
  };

  for (const [id, topbarLabel] of Object.entries(expected)) {
    it(`screen "${id}" has topbarLabel "${topbarLabel}"`, () => {
      // Find the screen entry by id, then assert topbarLabel appears in the
      // same { ... } block.
      const idMatch = appJs.match(new RegExp(`\\{[^}]*id:\\s*'${id}'[^}]*\\}`));
      expect(idMatch).toBeTruthy();
      expect(idMatch[0]).toMatch(new RegExp(`topbarLabel:\\s*'${topbarLabel}'`));
    });
  }
});
