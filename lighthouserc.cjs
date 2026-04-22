/**
 * Lighthouse CI config (PERF-02 + PERF-04).
 *
 * Phase 7 Plan 2 (D-19): single desktop-preset run against `vite preview`,
 * HTML report to ./lighthouse-report/.
 *
 * Phase 13 Plan 6 (D-11): warn-level `assert` block for LCP/CLS/FCP/INP.
 * Thresholds match PERF-BASELINE.md §Targets verbatim (LCP 2500, CLS 0.1,
 * FCP 1000, INP 200). @lhci/cli 0.15.1 supports the three-level grammar
 * (off | warn | error) natively — no wrapper script required.
 *
 * `warn` is non-blocking: @lhci/cli prints the failing assertion summary
 * to stderr but exits 0. Paired with `.github/workflows/perf-soft-gate.yml`
 * + `scripts/lhci-warn-summary.cjs` so warnings surface via
 * GITHUB_STEP_SUMMARY on every PR (Research §Pitfall 4 — silent warnings
 * are ignored warnings).
 *
 * `npm run perf` (D-12) behaviour is UNCHANGED by the assert block —
 * dev-local one-shot Lighthouse still runs; the soft-gate is a net-new
 * pipeline invocation, not a replacement for manual inspection.
 */
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run preview',
      startServerReadyPattern: 'Local:.*http://localhost:4173',
      startServerReadyTimeout: 15000,
      url: ['http://localhost:4173/'],
      numberOfRuns: 1, // D-19 single run
      settings: {
        preset: 'desktop',
        output: 'html',
        outputPath: './lighthouse-report/report.html',
      },
    },
    assert: {
      // D-11 soft-gate — warn-level only on Web Vitals. Error-level
      // assertions on these metrics would hard-block PRs, contradicting
      // the solo-developer tradeoff documented in 13-CONTEXT.md D-11.
      assertions: {
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 1000 }],
        'interaction-to-next-paint': ['warn', { maxNumericValue: 200 }],
      },
    },
  },
};
