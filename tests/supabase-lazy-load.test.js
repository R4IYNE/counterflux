// tests/supabase-lazy-load.test.js
// Phase 10 Plan 2 — AUTH-01 proof.
//
// Walks the static-import graph rooted at src/main.js. Asserts that:
//   (a) '@supabase/supabase-js' is NEVER imported statically from any file in
//       the graph (it may only appear behind an `await import(...)`).
//   (b) 'src/services/supabase.js' is NEVER imported statically from src/main.js,
//       src/app.js, or any store init — only from src/stores/auth.js via dynamic import.
//
// This is the automatable proof for Visual Regression Anchor #1 in UI-SPEC.md
// ("Lazy-load discipline"). It runs fast (file reads only, no build step) and
// catches regressions the moment someone adds a static `import ... from
// '@supabase/supabase-js'` at the top of a store, component, or service.

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname, join } from 'path';

const ROOT = resolve(__dirname, '..');
const ENTRY = join(ROOT, 'src/main.js');

function walkStaticImports(entryPath, visited = new Set()) {
  if (visited.has(entryPath)) return visited;
  visited.add(entryPath);

  let src;
  try { src = readFileSync(entryPath, 'utf8'); } catch { return visited; }

  // Match only STATIC imports (top-level `import ... from '...'` or
  // bare `import '...'` for side-effects like CSS). Deliberately skip
  // `await import(...)` and `import(...)` expressions — those are dynamic.
  const staticRe = /^\s*import\s+(?:[\w*{}\s,]+from\s+)?['"]([^'"]+)['"]/gm;
  let m;
  while ((m = staticRe.exec(src)) !== null) {
    const spec = m[1];
    if (spec.startsWith('.')) {
      // Relative — resolve and recurse.
      let abs = resolve(dirname(entryPath), spec);
      if (!abs.endsWith('.js') && !abs.endsWith('.mjs') && !abs.endsWith('.css')) {
        abs = abs + '.js';
      }
      walkStaticImports(abs, visited);
    } else {
      // Package import — record as-is (prefixed so we can distinguish from files).
      visited.add(`pkg:${spec}`);
    }
  }
  return visited;
}

describe('AUTH-01 lazy-load discipline', () => {
  test('@supabase/supabase-js is NOT in the static-import graph of src/main.js', () => {
    const graph = walkStaticImports(ENTRY);
    const pkgs = [...graph].filter(x => x.startsWith('pkg:'));
    expect(pkgs).not.toContain('pkg:@supabase/supabase-js');
    expect(pkgs).not.toContain('pkg:@supabase/auth-js');
    expect(pkgs).not.toContain('pkg:@supabase/realtime-js');
  });

  test('src/services/supabase.js is NOT statically imported from anywhere (only dynamic)', () => {
    const graph = walkStaticImports(ENTRY);
    const paths = [...graph].filter(x => !x.startsWith('pkg:'));
    const hits = paths.filter(p => p.replace(/\\/g, '/').endsWith('src/services/supabase.js'));
    expect(hits).toEqual([]);
  });

  test('src/stores/auth.js IS in the static-import graph (store init path)', () => {
    const graph = walkStaticImports(ENTRY);
    const paths = [...graph].filter(x => !x.startsWith('pkg:'));
    const hits = paths.filter(p => p.replace(/\\/g, '/').endsWith('src/stores/auth.js'));
    expect(hits.length).toBeGreaterThan(0);
  });

  test('src/stores/auth.js contains a dynamic import of the supabase service', () => {
    const src = readFileSync(resolve(ROOT, 'src/stores/auth.js'), 'utf8');
    expect(src).toMatch(/await\s+import\(['"][^'"]*services\/supabase(?:\.js)?['"]\)/);
  });
});
