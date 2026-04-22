import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Phase 13 Plan 6 — @lhci/cli soft-gate config contract.
 *
 * Locks the warn-level assertion grammar in lighthouserc.cjs so a future
 * refactor cannot silently drop the soft-gate (Research §Pitfall 4) or
 * escalate a Web Vital to error-level without the test flagging it.
 *
 * Thresholds are PERF-BASELINE.md §Targets verbatim:
 *   LCP <= 2500ms, CLS <= 0.1, FCP <= 1000ms, INP <= 200ms
 */
describe('Phase 13 Plan 6 — @lhci/cli soft-gate config', () => {
  const cfg = readFileSync(resolve(process.cwd(), 'lighthouserc.cjs'), 'utf-8');

  it('has an assert block with warn-level thresholds', () => {
    expect(cfg).toMatch(/assert\s*:/);
    expect(cfg).toMatch(/['"]warn['"]/);
    // Must NOT silently use 'error' for the core Web Vitals — soft gate per D-11
    const errorLevelBlocks = cfg.match(/['"]error['"]/g) || [];
    // Zero error-level assertions for Web Vitals metrics (only info/warn allowed for PERF-04)
    expect(errorLevelBlocks.length).toBe(0);
  });

  it('thresholds match PERF-BASELINE.md §Targets verbatim', () => {
    // LCP target < 2500ms, CLS < 0.1, FCP < 1000ms, INP < 200ms
    expect(cfg).toMatch(/largest-contentful-paint[\s\S]{0,100}2500/);
    expect(cfg).toMatch(/cumulative-layout-shift[\s\S]{0,100}0\.1/);
    expect(cfg).toMatch(/first-contentful-paint[\s\S]{0,100}1000/);
    expect(cfg).toMatch(/interaction-to-next-paint[\s\S]{0,100}200/);
  });

  it('preserves Phase 7 collect config (desktop preset + vite preview URL)', () => {
    // Regression guard — do NOT change collect section
    expect(cfg).toMatch(/preset\s*:\s*['"]desktop['"]/);
    expect(cfg).toMatch(/http:\/\/localhost:4173/);
  });
});
