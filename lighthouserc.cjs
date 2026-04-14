/**
 * Lighthouse CI config (PERF-02).
 * Per D-19: single desktop-preset run against `vite preview`, HTML report to ./lighthouse-report/.
 * Per D-20: no `assert` block — CI gating deferred to Phase 13.
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
  },
};
