import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('favicon (POLISH-03)', () => {
  const html = readFileSync('index.html', 'utf-8');

  it('declares niv-mila.png as favicon', () => {
    expect(html).toMatch(/<link\s+rel="icon"[^>]*href="\/assets\/niv-mila\.png"/);
  });

  it('declares apple-touch-icon to same asset', () => {
    expect(html).toMatch(/rel="apple-touch-icon"[^>]*href="\/assets\/niv-mila\.png"/);
  });
});
