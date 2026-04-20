// @vitest-environment node
/**
 * D-08 animation composability regression test (Phase 13 Plan 2).
 *
 * Locks down the rule that @keyframes blocks in production CSS either:
 *   (a) animate only transform / opacity (the two natively-composited props), OR
 *   (b) are allowlisted with a documented rationale below.
 *
 * Static-grep only — no DOM, no runtime. Reads main.css + utilities.css from
 * disk and extracts every @keyframes body, then checks that no keyframe step
 * animates width / height / left / top / background-position.
 *
 * Separately checks the flagged-from-Plan-1 context:
 *   - The splash progress bar animates `width` via an INLINE x-style transition
 *     on index.html line 49-50 (NOT a @keyframes block). Plan 3 (D-04) deletes
 *     the splash entirely, so the Lighthouse flag resolves organically.
 *   - `scanline-sweep` animates `top` but is NOT consumed by any shipped
 *     selector (its only mount is in an assets/ prototype HTML). Allowlisted
 *     because it cannot fire in production.
 *   - `shimmer` was converted from background-position animation → transform:
 *     translateX() per Research §Example 4, with will-change: transform on the
 *     ::before pseudo layer. Verified green by Test 2.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const main = readFileSync('src/styles/main.css', 'utf-8');
const utils = readFileSync('src/styles/utilities.css', 'utf-8');
const combined = main + '\n' + utils;

// Extract every @keyframes block's body. CSS @keyframes bodies contain nested
// {} blocks (one per step like 0% { ... }), so the inner regex matches those.
const keyframesRegex = /@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\}[^{}]*)*)\}/g;

function extractKeyframesBodies(src) {
  const bodies = [];
  let match;
  // fresh lastIndex per call
  keyframesRegex.lastIndex = 0;
  while ((match = keyframesRegex.exec(src)) !== null) {
    bodies.push({ name: match[1], body: match[2] });
  }
  return bodies;
}

// Allowlist — keyframes that animate layout-triggering properties but are
// safe because the selector is either (a) not mounted in v1.1 production, or
// (b) scheduled for deletion in a later plan.
const ALLOWLIST = new Set([
  // scanline-sweep animates `top:` but `.scanline` is only referenced in
  // assets/stitch/.../code.html (a non-shipped prototype). No shipped
  // template mounts it, so the keyframe never fires in production. Kept
  // as dead CSS because removing it is out of Plan 2 scope.
  'scanline-sweep',
]);

describe('D-08 animation composability (static grep)', () => {
  const bodies = extractKeyframesBodies(combined);

  it('Test 1: main.css still defines cf-pulse, cf-spin, cf-auth-spin, cf-reconciliation-fade-in (regression guard)', () => {
    expect(main).toMatch(/@keyframes\s+cf-pulse\b/);
    expect(main).toMatch(/@keyframes\s+cf-spin\b/);
    expect(main).toMatch(/@keyframes\s+cf-auth-spin\b/);
    expect(main).toMatch(/@keyframes\s+cf-reconciliation-fade-in\b/);
  });

  it('Test 2: no keyframe body animates width/height/left/top/background-position (outside allowlist)', () => {
    const offenders = [];
    for (const { name, body } of bodies) {
      if (ALLOWLIST.has(name)) continue;
      // Match these properties as declarations inside a keyframe step.
      // Example offender: `0% { width: 100px; }` contains `width:`.
      if (/(?:^|\s|;|\{)(width|height|left|top|background-position)\s*:/m.test(body)) {
        offenders.push(name);
      }
    }
    expect(offenders, `Non-composited keyframes found: ${offenders.join(', ')}`).toEqual([]);
  });

  it('Test 3: utilities.css uses will-change: transform on at least one animated element (composited hint)', () => {
    // We expect at least one consumer of a transform-based keyframe to declare
    // will-change. The shimmer skeleton (Phase 13 Plan 2 D-08 conversion) is
    // the primary consumer — its ::before pseudo ships will-change: transform.
    expect(utils).toMatch(/will-change\s*:\s*transform/);
  });

  it('Test 4: shimmer keyframe uses transform-only (D-08 conversion from background-position)', () => {
    const shimmer = bodies.find(b => b.name === 'shimmer');
    expect(shimmer, 'shimmer keyframe must exist').toBeDefined();
    // Should NOT animate background-position any more (pre-conversion shape).
    expect(shimmer.body).not.toMatch(/background-position\s*:/);
    // Should animate transform (post-conversion shape).
    expect(shimmer.body).toMatch(/transform\s*:/);
  });
});
