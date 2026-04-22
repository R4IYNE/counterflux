// @vitest-environment node
//
// Phase 13 Plan 5 — Syne font-loading contract.
//
// Two regression assertions against the LCP root cause identified in
// 13-REMEASURE-POST-PLAN3.md:
//   1. `font-display: swap` MUST stay on the Syne @font-face declaration so
//      the browser renders the h1 in fallback before the Syne woff2 arrives.
//      (Already set in main.css when this plan started — this locks it.)
//   2. `<link rel="preload" as="font" crossorigin>` MUST point at the Syne
//      woff2 in index.html so the font file fetches in parallel with CSS
//      parse rather than serially after it.
//
// If either assertion breaks, the auth-wall LCP regresses back to the
// 5,962 ms Render Delay range.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const mainCss = readFileSync('src/styles/main.css', 'utf-8');
const indexHtml = readFileSync('index.html', 'utf-8');

describe('Phase 13 Plan 5 — Syne font loading contract (LCP root cause)', () => {
  it('Test 1: main.css declares @font-face for Syne', () => {
    // Capture any whitespace layout — regex matches the declaration block.
    const block = mainCss.match(/@font-face\s*\{[^}]*font-family:\s*['"]?Syne['"]?[^}]*\}/);
    expect(block).toBeTruthy();
  });

  it('Test 2: Syne @font-face uses font-display: swap', () => {
    const block = mainCss.match(/@font-face\s*\{[^}]*font-family:\s*['"]?Syne['"]?[^}]*\}/);
    expect(block).toBeTruthy();
    expect(block[0]).toMatch(/font-display:\s*swap/);
  });

  it('Test 3: index.html preloads the Syne woff2 with crossorigin', () => {
    // Must be a <link rel="preload" as="font"> pointing at a Syne woff2,
    // with crossorigin (CORS required for woff2 preload to be honoured).
    const syneRe = /<link[^>]+rel=["']preload["'][^>]*(?:Syne|syne)[^>]*>/;
    const match = indexHtml.match(syneRe);
    expect(match).toBeTruthy();
    expect(match[0]).toMatch(/as=["']font["']/);
    expect(match[0]).toMatch(/crossorigin/);
    expect(match[0]).toMatch(/\.woff2/);
  });

  it('Test 4: Syne preload sits BEFORE the app entry <script> tag', () => {
    const syneIdx = indexHtml.search(/<link[^>]+rel=["']preload["'][^>]*Syne/);
    const scriptIdx = indexHtml.indexOf('/src/main.js');
    expect(syneIdx).toBeGreaterThan(0);
    expect(scriptIdx).toBeGreaterThan(0);
    expect(syneIdx).toBeLessThan(scriptIdx);
  });
});
