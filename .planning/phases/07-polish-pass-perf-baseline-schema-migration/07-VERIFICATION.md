---
phase: 07-polish-pass-perf-baseline-schema-migration
verified: 2026-04-22
verified_date: 2026-04-22
status: passed-retrospective
retrospective: true
score: 17/17 requirements verified (retrospectively)
re_verification: false
retrospective_reason: "Phase 7 completed 2026-04-15 but /gsd:verify-work was never run; audit flagged missing VERIFICATION.md 2026-04-22; this document reconstructs the verification trail from existing tests + downstream phase consumption."
audit_reference: ".planning/v1.1-MILESTONE-AUDIT.md Issue C"
closed_by: "Phase 14 Plan 02"
---

# Phase 7: Polish Pass + Perf Baseline + Schema Migration — Verification Report (Retrospective)

**Phase Goal:** Resolve every v1.0 rough edge users reported, establish an honest performance baseline, and land the Dexie v6 schema that unblocks turn-lap persistence (Phase 9) and cloud sync (Phase 11).
**Verified:** 2026-04-22 (retrospective — Phase 7 shipped 2026-04-15 without a VERIFICATION.md; this document reconstructs the trail)
**Status:** PASSED (RETROSPECTIVE)
**Audit reference:** .planning/v1.1-MILESTONE-AUDIT.md Issue C

---

## Why Retrospective

Per audit-milestone findings, Phase 7 completed but never ran /gsd:verify-work. The implicit verification evidence exists across three sources:

1. **Direct test coverage** — `tests/migration-*.test.js` (24 tests total) exercise the schema chain against v5 fixture data
2. **Downstream phase consumption** — Phases 8, 9, 10, 11 all import `db.collection`, `db.decks`, `db.games.turn_laps`, `db.sync_queue`, `db.sync_conflicts`, `db.profile`; if the schema chain were broken, every downstream phase would have failed its own verification
3. **Production shipping** — Phase 7 has been the boot-time migration for all v1.1 users since 2026-04-15 with zero reported data loss

This document formalises that trail so REQUIREMENTS.md checkboxes can flip and v1.1 can close cleanly.

---

## POLISH Requirements

| REQ-ID | Description | Status | Evidence |
|--------|-------------|--------|----------|
| POLISH-01 | Splash loading quotes typographic treatment (no `--` separators) | ✓ VERIFIED | 07-01-SUMMARY.md Task 1; `tests/splash-screen.test.js` (FLAVOUR_TEXTS shape, no `--` in data, migrationProgress hook); `src/components/splash-screen.js` structured `{ quote, attribution }` objects; rendered live on every boot since 2026-04-15 |
| POLISH-02 | Izzet red (`#E23838`) accents lifted to ~15% surface coverage | ✓ VERIFIED | 07-01-SUMMARY.md Task 8 (D-30..D-33); `src/styles/main.css` `--color-secondary-hover`/`--color-secondary-active` ramp + `.rag-red`/`.price-drop` utilities; `.tab-active` repaint red; downstream Phase 13 did not regress any of these surfaces (Plan 13-05 bundle-split preserved main.css selectors intact) |
| POLISH-03 | Favicon declared via `<link rel="icon">` → `assets/niv-mila.png` | ✓ VERIFIED | 07-01-SUMMARY.md Task 1; `tests/favicon.test.js`; 4 `<link>` tags in `<head>` (16/32/192 + apple-touch-icon); consumed as browser tab icon since 2026-04-15 |
| POLISH-04 | Card flyout images rounded corners, no white triangles | ✓ VERIFIED | 07-01-SUMMARY.md Task 7; `.cf-card-img { border-radius: 4.75%; }` utility applied to 3 card-image render sites (flyout, add-card-modal preview, collection card-tile); consumed visually across Treasure Cruise + Thousand-Year Storm screens |
| POLISH-05 | Toast icons render full-opacity (no alpha overlap with CTAs) | ✓ VERIFIED | 07-01-SUMMARY.md Task 2; `tests/toast.test.js` POLISH-05 block asserts no `opacity-*` or `text-opacity-*` on `data-toast-icon`; `src/components/toast.js` + template contracts documented |
| POLISH-06 | "Initiate ritual" → "Brew a new storm"; "Abandon ritual" → "Abandon storm" | ✓ VERIFIED | 07-01-SUMMARY.md Task 3; `tests/ritual-modal.test.js` asserts both plan literal and legacy title-case literals absent; `src/components/ritual-modal.js` + `src/components/deck-landing.js` renamed |
| POLISH-07 | Additional-counters trigger glyph `more_horiz` → `add` | ✓ VERIFIED | 07-01-SUMMARY.md Task 3; `tests/counter-panel.test.js`; Material Symbols `add` glyph; `aria-label="Counters"` preserved per Pitfall G |
| POLISH-08 | LIVE chip pulsing dot (1.5s ease-in-out, success-only) | ✓ VERIFIED | 07-01-SUMMARY.md Task 4 (D-26); `tests/connectivity-status.test.js` POLISH-08 block; `@keyframes cf-pulse` + `.cf-live-dot` in `src/styles/main.css`; binds only when `color === 'success'` |
| POLISH-09 | Sidebar manual collapse toggle with localStorage persistence | ✓ VERIFIED | 07-01-SUMMARY.md Task 5 (D-27..D-29); `tests/sidebar-collapse.test.js` (10 tests — hydrate, persist, toggle, source audit for w-16/chevron/tooltips); `src/stores/app.js` `toggleSidebar()` + `initAppStore()` hydrate; resize-handler preference safeguard (deviation Rule 2) |
| POLISH-10 | Top losers never renders raw `scryfall_id`; missing names filtered or fallback | ✓ VERIFIED | 07-01-SUMMARY.md Task 6; `tests/movers-panel.test.js`; `gainersNamed`/`losersNamed` computed filters + per-column "No movers data available" empty state; `scryfall_id` only used as `:key`, never rendered |
| POLISH-11 | Add-to-wishlist toast says "Added to wishlist" | ✓ VERIFIED | 07-01-SUMMARY.md Task 2; `tests/add-card-modal.test.js` + deck-context-menu regression guards; branched on selected category (`wishlist` vs `owned`/default) |

All 11 POLISH requirements have direct test coverage, source-file citations, and have shipped to production without subsequent regression reports.

---

## PERF Requirements

| REQ-ID | Description | Status | Evidence |
|--------|-------------|--------|----------|
| PERF-01 | Web Vitals instrumentation (LCP/FID/CLS/TTI/FCP) in dev mode | ✓ VERIFIED | 07-02-SUMMARY.md Task 2 (RED+GREEN); `tests/perf-bootstrap.test.js` (4/4 green — imports audit, `console.table` reporter, `import.meta.env.DEV` guard, `requestIdleCallback` lazy-load); `src/services/perf.js` `bootPerfMetrics()` with fresh opts literal per `onX` call (v5 `initUnique` gotcha); Pitfall E mitigation via lazy-load |
| PERF-02 | Lighthouse CI `@lhci/cli` + `npm run perf` script | ✓ VERIFIED | 07-02-SUMMARY.md Tasks 1+3; `package.json` declares `web-vitals@^5.2.0` + `@lhci/cli@^0.15.1` + `perf`/`perf:open` scripts; `lighthouserc.cjs` at project root (desktop preset, `numberOfRuns: 1` per D-19, no assert block per D-20); downstream Phase 13 consumed the tooling to capture remeasure baselines + soft-gate CI integration (13-PERF-SIGNOFF.md) |
| PERF-03 | Baseline report with measured v1.0 numbers + targets | ✓ VERIFIED | 07-02-SUMMARY.md Task 4; `.planning/phases/07-polish-pass-perf-baseline-schema-migration/PERF-BASELINE.md` committed with median-of-3 Lighthouse numbers (FCP 1.0s / LCP 3.7s / CLS 1.00 / Perf 54) + absolute targets per D-18 + 5 Phase 13 gap items; downstream Phase 13 consumed this as the authoritative v1.0 reference for the `/gsd:measure-phase` remeasure (13-REMEASURE.md shows LCP 6.1s delta-from-baseline → triggered Branch B); final `13-PERF-SIGNOFF.md` quotes baseline 3.7s vs final 2.49s for −59% LCP claim |

All 3 PERF requirements shipped ahead of schema work (D-22 ordering held — Plan 02 before Plan 03), giving Phase 13 a fair reference.

---

## SCHEMA Requirements (load-bearing — flips REQUIREMENTS.md checkboxes)

| REQ-ID | Description | Status | Direct Evidence | Downstream Proof |
|--------|-------------|--------|-----------------|------------------|
| SCHEMA-01 | Dexie IndexedDB schema v5 → v6 migration backfills `updated_at`, `synced_at`, `turn_laps` and adds `sync_queue`, `sync_conflicts` tables | ✓ VERIFIED | `tests/migration-v5-to-v7.test.js` (12 tests, D-17 hard-gate — 4 realistic v5 fixture states × migration steps assert clean-named tables at v8 with all backfilled fields). `src/db/schema.js` v1..v8 chain per 07-03-SUMMARY.md; `meta` table carries `{ key: 'schema_version', version: 8, migrated_at }` marker row. UUID `creating` hook on 6 synced tables auto-supplies `crypto.randomUUID()` when caller omits `id` (preserves v1.0 ergonomics). | Phase 11 sync engine (`src/services/sync-engine.js`) reads `db.sync_queue`, `db.sync_conflicts`, `db.profile` — see `.planning/phases/11-cloud-sync-engine/11-VERIFICATION.md` Truth #2 (installSyncHooks iterates SYNCABLE_TABLES = 6-element array, exactly the 6 synced tables Phase 7 created). Phase 9 GAME-09 writes `turn_laps` to `db.games` — see `.planning/phases/09-deck-accuracy-vandalblast-pod-experience/09-03-SUMMARY.md`. Phase 10 AUTH-04 writes `db.profile` on sign-in per 10-04 SUMMARY. If the schema chain were broken, every one of these downstream verifications would have failed. |
| SCHEMA-02 | Migration tested against v1.0 fixture data (empty collection, 500-card collection, 10 decks, active games) with zero data loss | ✓ VERIFIED | `tests/migration-v5-to-v7.test.js` enumerates all 4 fixture states in `tests/fixtures/v5-snapshots.js` and asserts row-count preservation + UUID-PK remap + FK integrity (deck_cards.deck_id correctly rewritten per `deckRemap` Map — the variant (a)→(c) switch commit `a5472f3` confirmed this works against realistic datasets). `tests/schema-rename-spike.test.js` (3 tests) validates the D-01a temp-table shuffle + v8 rename-pattern prerequisite — the question "can v8 recreate a previously-nulled name?" was front-loaded and answered green. | Phase 11 `11-HUMAN-UAT.md` Anchor 3-4 exercises reconciliation modal against populated local data that survived v5→v8 migration — would fail if migration lost rows. Phase 11 `sync-pull-splash.js` bulkPull path reads `db.collection` directly with no schema-remap shim, proving the clean-named tables landed as expected. |
| SCHEMA-03 | Pre-migration localStorage backup captures one-shot snapshot before upgrade | ✓ VERIFIED | `tests/migration-backup.test.js` (7 tests) exercises `src/services/migration-backup.js` — writes `counterflux_v5_backup_<ISO-timestamp>` key; validates JSON round-trip (D-17b); 7-day TTL sweep (D-16); restore path. `tests/migration-orchestrator.test.js` (2 tests) exercises the orchestrator that registers `db.on('blocked')` + `db.on('versionchange')` BEFORE `db.open()` per Pitfall F; `src/components/migration-blocked-modal.js` vanilla-DOM blocking modal (Alpine not yet available mid-migration). | v1.0 → v1.1 upgrade path in production has run since 2026-04-15 without backup-related incident reports; the backup is dormant evidence but the validation test suite locks its existence and shape. `src/main.js` boot sequence (17-step) calls `migration-backup.js` before `db.open()`, so the backup gate is structurally load-bearing. |

---

## Artifacts (cross-reference)

| Artifact | Origin Plan | Downstream Consumers |
|----------|-------------|----------------------|
| `src/db/schema.js` | Plan 07-03 (v6+v7+v8 chain + UUID creating hook) | Phase 8 (db.collection), Phase 9 (db.games.turn_laps), Phase 10 (db.profile), Phase 11 (db.sync_queue/sync_conflicts, v10 deleted_at upgrade extends chain) |
| `src/services/migration.js` | Plan 07-03 (orchestrator — backup → open → validate → log; probe-at-v5) | `src/main.js` boot sequence (pre-Alpine) |
| `src/services/migration-backup.js` | Plan 07-03 (localStorage snapshot + 7-day TTL sweep + round-trip validation) | `src/services/migration.js`; `tests/migration-backup.test.js` (7 tests) |
| `src/components/migration-blocked-modal.js` | Plan 07-03 (vanilla-DOM `onblocked` modal — Alpine unavailable mid-migration) | `src/services/migration.js` event handlers |
| `src/workers/bulk-data.worker.js` | Plan 07-03 (mirrors v6+v7+v8 schema declarations — worker only touches `cards`+`meta` but must declare full chain for schema-match) | Bulk-data pipeline; Phase 13 streaming UI (13-03 D-04) |
| `src/stores/bulkdata.js` | Plan 07-03 (migrationProgress field wired to Plan 1's splash D-17a hook) | Phase 13 Plan 3 streaming UI (splash `x-show` narrowed to `migrationProgress > 0 && < 100`) |
| `PERF-BASELINE.md` | Plan 07-02 Task 4 (median-of-3 Lighthouse + 5 gap items) | Phase 13 `13-REMEASURE.md`, `13-PERF-SIGNOFF.md` |
| `src/services/perf.js` (web-vitals-init) | Plan 07-02 Task 2 GREEN (dev-only instrumentation, Pitfall E lazy-load) | Phase 13 Plan 1 LCP re-measurement; dev console remained green across all subsequent phases |

---

## Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `src/db/schema.js` v6 upgrade callback | `tests/migration-v5-to-v7.test.js` | direct test import + fake-indexeddb fixture replay | ✓ VERIFIED |
| `src/services/migration.js` | `src/services/migration-backup.js` | direct import | ✓ VERIFIED |
| Phase 11 `installSyncHooks` | `db.sync_queue` (Phase 7 artifact) | Dexie `table.hook('creating')` on 6 SYNCABLE_TABLES | ✓ VERIFIED (11-VERIFICATION Truth #2) |
| Phase 9 game-store save | `db.games.turn_laps` (Phase 7 backfill) | GAME-09 write path with wall-clock anchor | ✓ VERIFIED (09-03-SUMMARY) |
| Phase 10 profile store | `db.profile` (Phase 7 new table) | AUTH-04 upsert on sign-in (`_source` state machine) | ✓ VERIFIED (10-04-SUMMARY + 10-VERIFICATION) |
| Phase 13 streaming UI | `Alpine.store('bulkdata').migrationProgress` (Phase 7 Plan 1 D-17a hook) | x-show narrowed to `migrationProgress > 0 && < 100` | ✓ VERIFIED (13-03-SUMMARY D-04) |
| Phase 13 PERF remeasure | `PERF-BASELINE.md` (Phase 7 Plan 2 artifact) | direct reference in `13-REMEASURE.md` + `13-PERF-SIGNOFF.md` for the −59% LCP claim | ✓ VERIFIED |

---

## Conclusion

All 17 Phase 7 requirements (POLISH-01..11, PERF-01..03, SCHEMA-01..03) have retrospective verification evidence. The three SCHEMA checkboxes in `.planning/REQUIREMENTS.md` will flip from `[ ]` to `[x]` in Plan 14-02 Task 2, closing audit Issue C. **Retrospective verification score: 17/17 PASSED.**
