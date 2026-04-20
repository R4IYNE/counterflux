# Counterflux v1.1 — Performance Sign-Off (PERF-04)

**Status:** STUB — awaiting Plan 6 Task 6b fill-in after Plans 2/3/5 complete.
**Branch:** B (Plan 1 re-measurement identified an LCP gap — see [13-REMEASURE.md](./13-REMEASURE.md))

## Final Re-Measurement

*To be completed by Plan 6 Task 6b after Plans 2/3/5 ship. Stub placeholder below — rows filled in from a post-all-plans Lighthouse run.*

| Metric | Phase 7 baseline (v1.0) | Plan 1 pre-optimisation (v1.1 initial) | Final v1.1 | Target | Verdict |
|--------|-------------------------|----------------------------------------|------------|--------|---------|
| LCP    | 3.7s                    | 6.1s                                   | [pending]  | < 2.5s | [pending] |
| CLS    | 1.00                    | 0.023                                  | [pending]  | < 0.1  | [pending] |
| FCP    | 1.0s                    | 0.4s                                   | [pending]  | < 1.0s | [pending] |
| INP    | n/a (Lighthouse 13)     | n/a (lab-only)                         | [pending]  | < 200ms | [pending] |
| Perf score | 54                  | 76                                     | [pending]  | —       | —       |

## Optimisations Shipped

*To be completed by Plan 6 Task 6b. Expected activations based on Plan 1 Branch B verdict:*

- **Plan 2 (D-08 + D-09 freebies):** expected to ship — always-in-scope on Branch B per D-03. **Pivoted scope:** bfcache fix is NOT the Dexie `db.close()` pattern research predicted; actual blocker is the in-flight Scryfall bulk-data fetch (see 13-REMEASURE.md §Lighthouse Insights).
- **Plan 3 (D-04 streaming UI + D-05 placeholders + D-06 topbar pill):** expected to ship — LCP > 2.5s threshold crossed.
- **Plan 4 (CLS targeted fixes):** **NOT triggered** — CLS 0.023 already under 0.1 target at re-measurement.
- **Plan 5 (Bundle splitting):** likely to ship — LCP element is `#cf-auth-wall > h1` (Syne font-blocked render); bundle split / font-display: swap is the expected fix.
- **Plan 6 (@lhci/cli soft-gate):** unconditional closer; writes this file's final version.

## Methodology (frozen per D-14)

- **Re-measurement methodology:** see [13-REMEASURE.md §Methodology](./13-REMEASURE.md). Single-run pragmatic fallback from the Phase 7 median-of-3 DevTools protocol (user-elected 2026-04-20) — acceptable for Branch verdict because LCP gap exceeds any reasonable variance envelope.
- **Cross-version note:** Lighthouse 12.6.1 vs Phase 7's 13.0.2 (MAJOR drift), headless vs DevTools GUI. Delta values labelled `cross-version` in the measurement table. Verdict robustness is not affected.

## Cross-reference

- Phase 7 v1.0 baseline anchor: [`PERF-BASELINE.md`](../07-polish-pass-perf-baseline-schema-migration/PERF-BASELINE.md) — frozen per D-14
- Plan 1 re-measurement: [`13-REMEASURE.md`](./13-REMEASURE.md)
- Per-plan summaries (as Plans 2/3/5 complete): `13-0{2,3,5}-SUMMARY.md`

---

**Phase 13 closed:** *pending — Plan 6 Task 6b fills this line when final re-measurement completes.*
