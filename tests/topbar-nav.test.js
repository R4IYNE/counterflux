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
