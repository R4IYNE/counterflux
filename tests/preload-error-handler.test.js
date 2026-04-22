// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

const mainSrc = readFileSync('src/main.js', 'utf-8');
const vercelRaw = existsSync('vercel.json') ? readFileSync('vercel.json', 'utf-8') : '{}';
const vercel = JSON.parse(vercelRaw);

describe('Phase 13 Plan 5 — cache-bust recovery (Pitfall 15)', () => {
  it('Test 1: main.js registers vite:preloadError handler', () => {
    expect(mainSrc).toMatch(/window\.addEventListener\(\s*['"]vite:preloadError['"]/);
  });

  it('Test 2: handler calls event.preventDefault()', () => {
    const handlerBlock = mainSrc.split(/vite:preloadError['"]/)[1] || '';
    expect(handlerBlock.slice(0, 400)).toMatch(/event\.preventDefault\(\)/);
  });

  it('Test 3: handler reloads via setTimeout with 500ms delay', () => {
    const handlerBlock = mainSrc.split(/vite:preloadError['"]/)[1] || '';
    expect(handlerBlock.slice(0, 400)).toMatch(/setTimeout\(\s*\(\)\s*=>\s*window\.location\.reload/);
    expect(handlerBlock.slice(0, 400)).toMatch(/500/);
  });

  it('Test 4: handler registered BEFORE Alpine.start()', () => {
    const preloadIdx = mainSrc.indexOf('vite:preloadError');
    const alpineStartIdx = mainSrc.indexOf('Alpine.start()');
    expect(preloadIdx).toBeGreaterThan(0);
    expect(alpineStartIdx).toBeGreaterThan(0);
    expect(preloadIdx).toBeLessThan(alpineStartIdx);
  });

  it('Test 5: vercel.json sets Cache-Control: no-cache on /index.html', () => {
    expect(vercel.headers).toBeInstanceOf(Array);
    const indexRule = vercel.headers.find(h => h.source === '/index.html');
    expect(indexRule).toBeDefined();
    const cc = indexRule.headers.find(h => h.key === 'Cache-Control');
    expect(cc).toBeDefined();
    expect(cc.value).toMatch(/no-cache/);
  });

  it('Test 6: vercel.json sets Cache-Control: no-cache on /', () => {
    const rootRule = vercel.headers.find(h => h.source === '/');
    expect(rootRule).toBeDefined();
    const cc = rootRule.headers.find(h => h.key === 'Cache-Control');
    expect(cc.value).toMatch(/no-cache/);
  });
});
