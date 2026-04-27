# Phase 13: Performance Optimisation (conditional) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 13-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 13-performance-optimisation-conditional
**Areas discussed:** Scope & sequencing, Bulk-data first-load strategy, CLS fix approach, CI gating & sign-off

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Scope & sequencing | Re-measure first vs tackle known gaps directly vs hybrid. Drives plan count. | ✓ |
| Bulk-data first-load strategy | Streaming UI vs chunked vs slimmer variant vs leave-as-is. | ✓ |
| CLS fix approach | Reserve dimensions vs rearchitect splash→dashboard. | ✓ |
| CI gating & sign-off | Add @lhci/cli assertions vs manual; sign-off artefact shape. | ✓ |

**User's choice:** All four areas.

---

## Scope & sequencing

### Q1: How should we structure the work given v1.1 added auth-wall, sync chip, notification bell, and spoiler-gallery rewrite since v1.0 baseline?

| Option | Description | Selected |
|--------|-------------|----------|
| Re-measure first, then scope (Recommended) | Plan 1 = fresh Lighthouse + web-vitals. Plans 2-N derived from new numbers. | |
| Known-gaps-first, measure after | Treat Phase 7 baseline as spec. Fix CLS + bulk-data directly, re-measure to verify. | |
| Hybrid: measure + parallel prep | Plan 1 re-measure. Plan 2 cheap fixes (CLS space-reservation + non-composited animation). Plans 3+ data-driven. | ✓ |

**User's choice:** Hybrid: measure + parallel prep.

### Q2: If re-measurement shows v1.1 already meets targets, what's the phase shape?

| Option | Description | Selected |
|--------|-------------|----------|
| Signoff + close, no code (Recommended) | PERF-SIGNOFF.md + 'v1.1 meets perf budget' verdict. Zero code. | ✓ |
| Signoff + cheap wins only | Still ship non-composited animation + bfcache freebies for headroom. | |
| No conditional exit — always ship fixes | Treat phase as guaranteed optimisation work regardless. | |

**User's choice:** Signoff + close, no code.
**Notes:** Interpreted as hybrid-when-needed: if ALL targets green, pure signoff; if ANY missed, fall back to the hybrid (cheap fixes + data-driven). Reconciled in 13-CONTEXT.md D-01/D-02/D-03.

---

## Bulk-data first-load strategy

### Q1: Bulk-data blocks UI ~5min (510MB default_cards). If Phase 13 needs to touch this, what's the approach?

| Option | Description | Selected |
|--------|-------------|----------|
| Streaming UI (shell-first) (Recommended) | Dashboard shell renders immediately; bulk populates in background; dependent screens show loading placeholder. | ✓ |
| Slimmer bulk variant | oracle_cards (~100MB) or client-side paper-only filter. | |
| Chunked download + resume | Break fetch into N chunks with IndexedDB checkpointing. | |
| Leave as-is, CLS-only scope | Lighthouse terminates before 5min block, targets may pass without touching this. | |

**User's choice:** Streaming UI (shell-first).

### Q2: Shell scope — which screens work, which show loading?

| Option | Description | Selected |
|--------|-------------|----------|
| Collection-only loading (Recommended) | Dashboard, Deck Builder, Market Intel, Game Tracker all work. Only Treasure Cruise add + card search show placeholder. | ✓ |
| Everything loads, search gracefully degrades | All screens render; card-search autocomplete falls back to Scryfall API only. | |
| You decide | Planner picks boundary from dependency graph. | |

**User's choice:** Collection-only loading.

### Q3: Where does the bulk-data progress signal live once splash is gone?

| Option | Description | Selected |
|--------|-------------|----------|
| Topbar toast/pill (Recommended) | Persistent pill adjacent to sync-chip / notification bell. Matches existing chip pattern. | ✓ |
| Sidebar footer progress bar | Thin bar anchored at sidebar bottom. | |
| First-visit splash only, then silent | Full splash for `idle`/`checking`, dismiss once `downloading` starts. | |
| You decide | Planner / UI-researcher picks. | |

**User's choice:** Topbar toast/pill.

### Q4: More questions, or move to CLS?

**User's choice:** Move to CLS fix.

---

## CLS fix approach

### Q1: With streaming UI removing the splash→dashboard swap, what's the CLS scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Audit + target new hotspots (Recommended) | Re-measurement enumerates top-3 post-streaming CLS sources; fix whichever push CLS > 0.1. | ✓ |
| Also pre-emptively reserve placeholder dimensions | Ship streaming-UI placeholders with min-height + skeletons up front. | |
| CLS is a re-measure-first decision | Don't commit to CLS scope now; defer all CLS work to post-measurement. | |

**User's choice:** Audit + target new hotspots.

### Q2: Non-composited animation (LIVE pulse / splash bar) + bfcache disabled — in scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, bundle with CLS/perf work (Recommended) | Animation fix ~5min, bfcache ~30-60min. Near-zero regression risk. Ship regardless. | ✓ |
| Only the animation fix | Cheap and obvious; defer bfcache to v1.2. | |
| Defer both | Skip unless re-measurement flags them. | |

**User's choice:** Yes, bundle with CLS/perf work.

---

## CI gating & sign-off

### Q1: Add @lhci/cli CI assertions, or keep manual?

| Option | Description | Selected |
|--------|-------------|----------|
| Soft gate (warn, don't fail) (Recommended) | PR comment or build warning when targets regress. Catches regressions without blocking merges. | ✓ |
| Hard gate (fail on regression) | CI fails the build on any perf regression. Tightest bar, slowest feedback. | |
| No CI gate — keep manual npm run perf | Leave CI untouched; rely on discipline. | |
| You decide | Planner picks from existing CI structure. | |

**User's choice:** Soft gate (warn, don't fail).

### Q2: Sign-off artefact shape?

| Option | Description | Selected |
|--------|-------------|----------|
| New PERF-SIGNOFF.md (Recommended) | Separate artefact at `.planning/phases/13-.../13-PERF-SIGNOFF.md`. PERF-BASELINE.md stays frozen. | ✓ |
| Append to PERF-BASELINE.md | Add v1.1 Sign-off section to the existing Phase 7 artefact. | |
| PR description only, no artefact | Sign-off lives in commit/PR description. | |

**User's choice:** New PERF-SIGNOFF.md.

---

## Final close-out

### Q: Bundle splitting (1MB minify-JS savings) wasn't discussed. Fold into hybrid, or explore?

| Option | Description | Selected |
|--------|-------------|----------|
| Fold into data-driven scope (Recommended) | Treat as LCP candidate; planner investigates if re-measured LCP > 2.5s after streaming UI. | ✓ |
| Explore now as its own area | Dedicated discussion on chunk boundaries, mana-font/keyrune/Chart.js split. | |
| I'm ready for context | Captured enough; implicit coverage via hybrid approach. | |

**User's choice:** Fold into data-driven scope.

---

## Claude's Discretion

- Placeholder UX on Treasure Cruise add + card search (skeleton shape, empty-state wording)
- Topbar pill styling (border, progress animation, percentage formatting)
- Specific bfcache blocker to remove if investigation finds multiple
- @lhci/cli soft-gate mechanism (PR-comment Action vs non-failing build step vs check-only)
- Bundle-splitting boundaries if D-10 triggers
- Placeholder min-height values
- `will-change` selector placement for D-08

## Deferred Ideas

- Chunked download with resume
- Slimmer bulk variant (oracle_cards)
- Hard CI gate
- Lighthouse image-delivery fix (Scryfall-owned)
- Lighthouse minify-JS fix (third-party code; folded into D-10 bundle-splitting candidate)
- Splash flavour-text retention as a v1.2 polish easter-egg
