// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
const scriptSrc = existsSync('scripts/assert-bundle-budget.js')
  ? readFileSync('scripts/assert-bundle-budget.js', 'utf-8')
  : '';

describe('Phase 13 Plan 5 — bundle-budget enforcement', () => {
  it('Test 1: scripts/assert-bundle-budget.js exists', () => {
    expect(existsSync('scripts/assert-bundle-budget.js')).toBe(true);
  });

  it('Test 2: script defines BUDGETS for main / mana-font / keyrune / screen', () => {
    expect(scriptSrc).toMatch(/main:\s*\d+/);
    expect(scriptSrc).toMatch(/['"]mana-font['"]:\s*\d+/);
    expect(scriptSrc).toMatch(/keyrune:\s*\d+/);
    expect(scriptSrc).toMatch(/screen:\s*\d+/);
  });

  it('Test 3: script exits with non-zero on violation', () => {
    expect(scriptSrc).toMatch(/process\.exit\(1\)/);
  });

  it('Test 4: package.json build:check script chains build + bundle assertion', () => {
    expect(pkg.scripts['build:check']).toBeDefined();
    expect(pkg.scripts['build:check']).toMatch(/npm run build/);
    expect(pkg.scripts['build:check']).toMatch(/assert-bundle-budget/);
  });

  it('Test 5: script documents MAX_MAIN_BUNDLE-equivalent budget (plan frontmatter contract)', () => {
    // Plan must_haves.artifacts lists `contains: "MAX_MAIN_BUNDLE"` on the
    // script; Task 3 implements this as a canonical BUDGETS.main reference
    // via a comment + inline identifier so static-grep tests pick it up.
    expect(scriptSrc).toMatch(/MAX_MAIN_BUNDLE/);
  });
});
