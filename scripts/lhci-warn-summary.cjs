#!/usr/bin/env node
/**
 * Phase 13 Plan 6 — @lhci/cli warn-level summary formatter.
 *
 * Reads the assertion results that `lhci assert` emits to
 * .lighthouseci/assertion-results.json after `lhci autorun`, formats a
 * markdown table, and writes to $GITHUB_STEP_SUMMARY so the GitHub
 * Actions UI renders it inline on the run page.
 *
 * Invariants (soft-gate discipline):
 *   - exits 0 always (even on missing results, parse errors, or all-pass runs)
 *   - never mutates non-summary state; pure read + write to $GITHUB_STEP_SUMMARY
 *   - falls back to stdout when GITHUB_STEP_SUMMARY is unset (local dev runs)
 *
 * Why this module exists: Research §Pitfall 4 — silent warnings are
 * ignored warnings. `lhci autorun` with warn-level assertions exits 0
 * on assertion failures, so the CI green-check alone hides regressions.
 * This script surfaces the warning rows on every PR.
 */
const fs = require('node:fs');
const path = require('node:path');

const RESULTS_PATH = path.resolve(process.cwd(), '.lighthouseci/assertion-results.json');
const SUMMARY_PATH = process.env.GITHUB_STEP_SUMMARY;

// Web Vitals audit-id → display label map. Anything unmapped falls
// through to the raw auditId so the summary still renders something.
const TARGETS = {
  'largest-contentful-paint': 'LCP',
  'cumulative-layout-shift': 'CLS',
  'first-contentful-paint': 'FCP',
  'interaction-to-next-paint': 'INP',
};

function formatActual(auditId, actual) {
  if (typeof actual !== 'number') return String(actual);
  // CLS is a unit-less score reported to 3 decimals; timings are ms ints
  if (auditId === 'cumulative-layout-shift') return actual.toFixed(3);
  return `${actual.toFixed(0)}ms`;
}

function formatTarget(auditId, expected) {
  if (expected === undefined || expected === null) return '—';
  if (auditId === 'cumulative-layout-shift') return String(expected);
  return `${expected}ms`;
}

function loadResults() {
  if (!fs.existsSync(RESULTS_PATH)) return null;
  try {
    const raw = fs.readFileSync(RESULTS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.log(`[lhci-warn-summary] Failed to parse ${RESULTS_PATH}: ${err.message}`);
    return null;
  }
}

const results = loadResults();

const lines = ['## Lighthouse soft-gate (Phase 13 Plan 6)', ''];

if (results === null) {
  lines.push('No `.lighthouseci/assertion-results.json` — nothing to report.');
  lines.push('');
  lines.push(
    'If `lhci autorun` succeeded but this file is missing, verify the `assert` block in `lighthouserc.cjs` is present and the run reached the assertion stage.',
  );
} else {
  const warnings = results.filter((r) => r.level === 'warn' && !r.passed);

  if (warnings.length === 0) {
    lines.push('All Web Vitals within Phase 7 targets. PERF-04 budget met.');
  } else {
    lines.push('| Metric | Actual | Target | Status |');
    lines.push('|--------|--------|--------|--------|');
    for (const w of warnings) {
      const metric = TARGETS[w.auditId] || w.auditId;
      const actual = formatActual(w.auditId, w.actual);
      const target = formatTarget(w.auditId, w.expected);
      lines.push(`| ${metric} | ${actual} | ${target} | warn (soft) |`);
    }
    lines.push('');
    lines.push(
      '**Soft gate — merge NOT blocked.** Investigate whether this regression is intentional. See `.planning/phases/13-performance-optimisation-conditional/13-PERF-SIGNOFF.md` for v1.1 targets and methodology.',
    );
  }
}

const output = `${lines.join('\n')}\n`;
console.log(output);

if (SUMMARY_PATH) {
  try {
    fs.appendFileSync(SUMMARY_PATH, output);
    console.log('[lhci-warn-summary] Wrote summary to $GITHUB_STEP_SUMMARY');
  } catch (err) {
    console.log(`[lhci-warn-summary] Failed to append to $GITHUB_STEP_SUMMARY: ${err.message}`);
  }
} else {
  console.log('[lhci-warn-summary] No GITHUB_STEP_SUMMARY env — local run; stdout only.');
}

// Soft-gate invariant: never exit non-zero. Any parsing error or missing
// file is reported above and we continue.
process.exit(0);
