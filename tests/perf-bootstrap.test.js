import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

describe('perf bootstrap (PERF-01)', () => {
  it('imports onLCP, onINP, onCLS, onFCP, onTTFB from web-vitals (no onFID)', () => {
    expect(existsSync('src/services/perf.js')).toBe(true);
    const perfSrc = readFileSync('src/services/perf.js', 'utf-8');
    expect(perfSrc).toMatch(/from\s+['"]web-vitals['"]/);
    expect(perfSrc).toMatch(/onLCP/);
    expect(perfSrc).toMatch(/onINP/);
    expect(perfSrc).toMatch(/onCLS/);
    expect(perfSrc).toMatch(/onFCP/);
    expect(perfSrc).toMatch(/onTTFB/);
    expect(perfSrc).not.toMatch(/onFID/);
  });

  it('reports via console.table', () => {
    const perfSrc = readFileSync('src/services/perf.js', 'utf-8');
    expect(perfSrc).toMatch(/console\.table/);
  });

  it('guards on import.meta.env.DEV', () => {
    const perfSrc = readFileSync('src/services/perf.js', 'utf-8');
    expect(perfSrc).toMatch(/import\.meta\.env\.DEV/);
  });

  it('main.js lazy-imports perf via requestIdleCallback (Pitfall E)', () => {
    const mainSrc = readFileSync('src/main.js', 'utf-8');
    expect(mainSrc).toMatch(/requestIdleCallback/);
    expect(mainSrc).toMatch(/import\(['"]\.\/services\/perf\.js['"]\)/);
  });
});
