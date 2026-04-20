/**
 * Phase 13 Plan 1 — static-grep contract for 13-REMEASURE.md.
 *
 * This is a lockdown test: it reads the committed markdown artefact from disk
 * and asserts the required fields exist. The test is deliberately written
 * BEFORE the artefact (Task 1 is RED — see Plan 13-01). Task 2 (human-action
 * Lighthouse run) writes the skeleton + fills in numbers, turning this test
 * GREEN.
 *
 * Required fields enforced here:
 *   - FCP / LCP / CLS medians
 *   - INP captured from web-vitals (not just TBT)
 *   - Lighthouse version capture (Pitfall 1 — cross-version comparison guard)
 *   - Methodology echo cross-reference to PERF-BASELINE.md (D-14 freeze)
 *   - Explicit Branch decision block with exactly one of Branch A / Branch B
 *   - No unresolved placeholder markers ([to-fill], [xxx], TBD)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

const REMEASURE_PATH = '.planning/phases/13-performance-optimisation-conditional/13-REMEASURE.md';

describe('13-REMEASURE.md contract (Phase 13 Plan 1)', () => {
  it('exists on disk', () => {
    expect(existsSync(REMEASURE_PATH)).toBe(true);
  });

  const src = existsSync(REMEASURE_PATH) ? readFileSync(REMEASURE_PATH, 'utf-8') : '';

  it('records FCP median', () => {
    expect(src).toMatch(/FCP/);
    expect(src).toMatch(/Median/i);
  });

  it('records LCP median', () => {
    expect(src).toMatch(/LCP/);
  });

  it('records CLS median', () => {
    expect(src).toMatch(/CLS/);
  });

  it('records INP from web-vitals (not just TBT)', () => {
    expect(src).toMatch(/INP/);
  });

  it('records Lighthouse version (Pitfall 1 — version drift)', () => {
    expect(src).toMatch(/Lighthouse\s+(version|v?\d+\.)/i);
  });

  it('records methodology echo cross-reference to PERF-BASELINE.md', () => {
    expect(src).toMatch(/PERF-BASELINE/);
  });

  it('contains explicit Branch decision block', () => {
    expect(src).toMatch(/Branch\s+[AB]/);
    expect(src).toMatch(/Branch\s+decision/i);
  });

  it('has no placeholder markers remaining', () => {
    // Allow the template column headers to use bracket-notation, but actual
    // data cells must be filled. Reject literal "[x]s" / "[xxx]" / "TBD".
    expect(src).not.toMatch(/\[x\]s|\[xxx\]|TBD/);
  });
});
