// Guard against the x-data truncation bug class (260614).
//
// The deckgen review screen ships a large Alpine component as the value of a
// double-quoted x-data="..." attribute. The HTML parser ends that attribute at
// the FIRST ASCII double-quote inside it — so a single stray " (in a string OR
// a comment) silently truncates the whole object, Alpine fails to compile it,
// and every getter (titleText, approvedCount, groupedByRole, ...) becomes
// "not defined" at runtime. This has bitten twice. This test fails fast if any
// ASCII double-quote ever creeps back into the x-data object.

import { describe, it, expect } from 'vitest';
import { renderDeckgenReviewScreen } from '../src/components/deckgen-review-screen.js';

describe('deckgen review screen — x-data integrity', () => {
  const html = renderDeckgenReviewScreen();

  // Capture the x-data value with [^"]* — the capture STOPS at the first stray
  // double-quote, exactly like the browser's attribute parser does.
  const match = html.match(/x-data="([^"]*)"/);

  it('has an x-data attribute', () => {
    expect(match).toBeTruthy();
  });

  it('x-data is not truncated by a stray double-quote', () => {
    const xdata = match[1];
    // Getters/methods that live near the END of the object. If a stray " cut
    // the attribute short, these are missing from the captured value.
    for (const token of [
      'get isSwapMode()',
      'get titleText()',
      'get commitButtonText()',
      'get groupedByRole()',
      'get approvedCount()',
      'get rejectedCount()',
      'async commit()',
    ]) {
      expect(xdata).toContain(token);
    }
    // The full object literal must be captured intact (ends on its closing brace).
    expect(xdata.trim().endsWith('}')).toBe(true);
  });
});
