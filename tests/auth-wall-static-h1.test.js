// @vitest-environment jsdom
// tests/auth-wall-static-h1.test.js
//
// Phase 13 Plan 5 Task 6 — structural LCP fix contract.
//
// Post-Task-5 Lighthouse proved the LCP remained at 6.13s despite the Syne
// preload + manualChunks split. 13-BUNDLE-DELTA.md §"Why the LCP didn't move"
// identified the structural root cause: the LCP element (body > #cf-auth-wall > h1)
// is constructed in JavaScript via document.createElement() inside
// src/components/auth-wall.js. The browser cannot paint it until the full JS
// boot chain completes (~6 s).
//
// Task 6 fixes this by rendering the paint-critical h1 + its container
// directly in index.html so the browser paints it on HTML parse, independent
// of Alpine / migration / store init. The auth-wall JS is modified to detect
// the pre-existing DOM and decorate it (add tagline + sign-in card) rather
// than creating a new div from scratch.
//
// This file locks three contracts:
//   1. Static grep over index.html: the #cf-auth-wall + paint-critical h1
//      must exist in initial HTML (so Lighthouse / real browsers paint it
//      on HTML parse).
//   2. Critical CSS: the h1 must ship styling in index.html <head> that
//      matches the Syne 48px/700 contract so the first paint doesn't flash
//      the wrong font/size and then layout-shift when the external CSS
//      parses. (Stops a CLS regression.)
//   3. No-duplicate integration: when auth-wall.js mounts over a pre-existing
//      #cf-auth-wall, it must decorate — not duplicate — the h1. Exactly one
//      "COUNTERFLUX" h1 must exist after openAuthWall() runs.
//
// If any of these regress, the LCP fix is undone.

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const indexHtml = readFileSync('index.html', 'utf-8');

describe('Phase 13 Plan 5 Task 6 — static h1 LCP contract (index.html)', () => {
  test('Test 1: index.html contains a #cf-auth-wall div in <body>', () => {
    // The wall div itself must exist in initial HTML so its h1 child can paint.
    const wallRe = /<div[^>]*id=["']cf-auth-wall["'][^>]*>/i;
    expect(indexHtml).toMatch(wallRe);
  });

  test('Test 2: index.html contains a paint-critical COUNTERFLUX h1 inside #cf-auth-wall', () => {
    // Scope the match to the portion of the document BETWEEN the static
    // #cf-auth-wall open tag and its closing </div> / next top-level sibling.
    // Simpler safe approximation: the string COUNTERFLUX must appear inside
    // an <h1> tag somewhere in the body (not just inline text in a comment).
    const h1Re = /<h1[^>]*>[^<]*COUNTERFLUX[^<]*<\/h1>/i;
    expect(indexHtml).toMatch(h1Re);

    // And it must sit textually after the <div id="cf-auth-wall"> open tag.
    const wallOpenIdx = indexHtml.search(/<div[^>]*id=["']cf-auth-wall["']/i);
    const h1Idx = indexHtml.search(h1Re);
    expect(wallOpenIdx).toBeGreaterThan(0);
    expect(h1Idx).toBeGreaterThan(wallOpenIdx);
  });

  test('Test 3: static #cf-auth-wall sits BEFORE the app entry <script> tag (so it parses + paints before JS boot)', () => {
    const wallIdx = indexHtml.search(/<div[^>]*id=["']cf-auth-wall["']/i);
    const scriptIdx = indexHtml.indexOf('/src/main.js');
    expect(wallIdx).toBeGreaterThan(0);
    expect(scriptIdx).toBeGreaterThan(0);
    expect(wallIdx).toBeLessThan(scriptIdx);
  });

  test('Test 4: index.html ships critical CSS for the paint-critical h1 in <style> inside <head>', () => {
    // The external stylesheet loads late; for LCP < 1 s we need the Syne
    // 48px/700 rule available on HTML parse. Look for a <style> block in
    // <head> that defines the h1 sizing/font so the first paint is correct.
    const headEndIdx = indexHtml.indexOf('</head>');
    expect(headEndIdx).toBeGreaterThan(0);
    const headSection = indexHtml.slice(0, headEndIdx);
    // Must include a <style>...</style> block that mentions cf-auth-wall
    // (either the container or a cf-auth-wall-title class) with font-size
    // 48px or font-family Syne.
    const styleBlockRe = /<style\b[^>]*>[\s\S]*?cf-auth-wall[\s\S]*?<\/style>/i;
    expect(headSection).toMatch(styleBlockRe);

    // Extract the matched block to assert it carries the typography contract.
    const m = headSection.match(styleBlockRe);
    expect(m).toBeTruthy();
    const block = m[0];
    expect(block).toMatch(/font-size\s*:\s*48px/i);
    expect(block).toMatch(/font-weight\s*:\s*700/i);
    expect(block).toMatch(/['"]?Syne['"]?/i);
  });

  test('Test 5: static #cf-auth-wall renders as a full-viewport overlay (so the h1 is the LCP element, not layout-shifted)', () => {
    // Match critical CSS covering the container: position fixed + inset 0
    // (or top/left/right/bottom zeros) + z-index so it overlays everything
    // else. Without this the static h1 paints in document flow, not where
    // the JS-mounted version will land, and we get a layout shift.
    const headEndIdx = indexHtml.indexOf('</head>');
    const headSection = indexHtml.slice(0, headEndIdx);
    const styleBlockRe = /<style\b[^>]*>[\s\S]*?cf-auth-wall[\s\S]*?<\/style>/i;
    const m = headSection.match(styleBlockRe);
    const block = m[0];
    // Accept either `inset: 0` OR `top:0;left:0;right:0;bottom:0` style declarations.
    const hasInset =
      /inset\s*:\s*0/i.test(block) ||
      (/top\s*:\s*0/.test(block) && /left\s*:\s*0/.test(block) && /right\s*:\s*0/.test(block) && /bottom\s*:\s*0/.test(block));
    expect(hasInset).toBe(true);
    expect(block).toMatch(/position\s*:\s*fixed/i);
  });
});

// ---------------------------------------------------------------------------
// Integration: no-duplicate h1 when auth-wall.js mounts over pre-existing DOM
// ---------------------------------------------------------------------------

describe('Phase 13 Plan 5 Task 6 — auth-wall.js decorates pre-existing #cf-auth-wall (no duplicate h1)', () => {
  const storeRegistry = {};
  let openAuthWall, closeAuthWall;

  beforeEach(async () => {
    // Simulate the production boot sequence: index.html has already painted
    // the static #cf-auth-wall + h1 before Alpine runs. We prime jsdom with
    // the same initial DOM so the test mirrors the real boot.
    document.body.innerHTML = `
      <div id="cf-auth-wall" class="cf-auth-wall-initial" role="dialog" aria-modal="true" aria-labelledby="cf-auth-wall-heading">
        <h1 class="cf-auth-wall-title">COUNTERFLUX</h1>
      </div>
    `;

    for (const k of Object.keys(storeRegistry)) delete storeRegistry[k];
    storeRegistry.auth = {
      status: 'anonymous',
      user: null,
      session: null,
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signInGoogle: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      init: vi.fn(),
    };
    storeRegistry.toast = {
      info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn(),
    };
    window.Alpine = {
      store: (name, value) => {
        if (value !== undefined) storeRegistry[name] = value;
        return storeRegistry[name];
      },
    };
    vi.resetModules();
    const mod = await import('../src/components/auth-wall.js');
    openAuthWall = mod.openAuthWall;
    closeAuthWall = mod.closeAuthWall;
  });

  afterEach(() => {
    try { closeAuthWall?.(); } catch { /* ignore */ }
    document.body.innerHTML = '';
  });

  test('Test 6: openAuthWall over pre-existing #cf-auth-wall yields exactly ONE COUNTERFLUX h1 (no duplicate)', () => {
    // Sanity: the static h1 is present before openAuthWall runs
    const h1sBefore = document.querySelectorAll('h1');
    const counterfluxBefore = [...h1sBefore].filter(h => h.textContent.includes('COUNTERFLUX'));
    expect(counterfluxBefore.length).toBe(1);

    openAuthWall();

    // After mount, still exactly one COUNTERFLUX h1 — the JS reused the static one.
    const h1sAfter = document.querySelectorAll('h1');
    const counterfluxAfter = [...h1sAfter].filter(h => h.textContent.includes('COUNTERFLUX'));
    expect(counterfluxAfter.length).toBe(1);
  });

  test('Test 7: openAuthWall over pre-existing #cf-auth-wall yields exactly ONE #cf-auth-wall element', () => {
    openAuthWall();
    const walls = document.querySelectorAll('#cf-auth-wall');
    expect(walls.length).toBe(1);
  });

  test('Test 8: openAuthWall over pre-existing #cf-auth-wall decorates with sign-in UI (card + Google button + email/password inputs)', () => {
    openAuthWall();
    // The decoration must ship the full sign-in surface
    expect(document.querySelector('#cf-auth-wall-card')).toBeTruthy();
    expect(document.querySelector('#cf-auth-wall-google')).toBeTruthy();
    expect(document.querySelector('#cf-auth-wall-email')).toBeTruthy();
    expect(document.querySelector('#cf-auth-wall-password')).toBeTruthy();
    expect(document.querySelector('#cf-auth-wall-submit')).toBeTruthy();
  });

  test('Test 9: closeAuthWall removes the wall (including the static h1) so post-auth the brand does not linger', () => {
    openAuthWall();
    expect(document.querySelector('#cf-auth-wall')).toBeTruthy();
    closeAuthWall();
    // Wall fully gone — static or dynamic, the wall is a boot-gate, not a layout anchor.
    expect(document.querySelector('#cf-auth-wall')).toBeNull();
  });
});
