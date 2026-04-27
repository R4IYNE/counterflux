---
id: SEED-001
status: dormant
planted: 2026-04-27
planted_during: v1.1 Second Sunrise (milestone_ready_to_ship)
trigger_when: After Phase 11 Cloud Sync Engine has been live in production for a meaningful period without regressions — re-evaluate at v1.2 milestone planning
scope: Large
---

# SEED-001: Catalog-vs-userdata storage split — move static Scryfall catalog into MTGJSON AllPrintings.sqlite via wa-sqlite + OPFS

## Why This Matters

The current bulk-data pipeline (`src/workers/bulk-data.worker.js` + `src/workers/bulk-data-pipeline.js`) downloads Scryfall's multi-hundred-MB bulk JSON, stream-parses it in a Web Worker, trims to essential fields, and bulk-inserts into Dexie/IndexedDB. This is slow, RAM-heavy during parse, and contributes to IndexedDB quota pressure on top of growing user data.

MTGJSON publishes pre-compiled `AllPrintings.sqlite`. Loaded via wa-sqlite (SQLite compiled to WASM) and persisted to OPFS (Origin Private File System), the entire MTG catalog becomes queryable with native SQL in milliseconds — bypassing the parse/index step entirely.

**Critical architectural distinction:** the catalog is read-only static reference data; user data (collection, decks, deck_cards, games, watchlist, profile) is mutable, sync-coupled, and depends on the v6+v7+v8 UUID-PK schema, the `sync_queue` outbox, and the LWW conflict resolver shipped in Phase 11. User data **stays in Dexie**. This is a **split**, not a wholesale migration.

## When to Surface

**Trigger:** After Phase 11 (Cloud Sync Engine) has been live in production for a meaningful period without regressions. Touching the data layer mid-sync-engine is a non-starter — the sync engine just shipped (2026-04-18) and the milestone is only now ready to ship (2026-04-27).

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- v1.2+ milestone planning where data-layer or performance work is in scope
- Bulk-data parse time becomes a measured pain point (Phase 13 perf baseline regresses)
- IndexedDB quota errors appear in user reports
- A milestone explicitly themed around catalog freshness, search performance, or offline robustness
- MTGJSON-sourced features (e.g. backlog 999.2 historical price charts) are being planned and motivate a unified MTGJSON-as-catalog stance

## Scope Estimate

**Large** — full milestone effort. Touches:
- New WASM runtime dependency (wa-sqlite ~1MB gzipped) and OPFS storage layer
- Replacement of `src/workers/bulk-data.worker.js` and `src/workers/bulk-data-pipeline.js`
- Rewrite of every Scryfall-catalog query in `src/services/scryfall.js` and any service that hits `db.cards` / `db.sets`
- Update of `src/db/schema.js` to remove the catalog tables (`cards`, `sets`, etc.) from the Dexie chain — likely a v9+ migration that drops them on upgrade
- Cache-bust strategy for catalog updates (MTGJSON publishes daily; download-and-swap pattern in OPFS)
- Splash-screen UX for first-load SQLite download (file is ~80–150MB compressed)

User data layer (collection/decks/games/watchlist/profile/sync_queue/sync_conflicts) is **untouched**.

## Breadcrumbs

Related code and decisions in the current codebase:

- `src/workers/bulk-data.worker.js` — current bulk JSON stream-parser; the thing being replaced
- `src/workers/bulk-data-pipeline.js` — orchestrator for the parse pipeline
- `src/services/scryfall.js` — Scryfall API client; catalog queries hit Dexie first, API as fallback (this fallback pattern needs to migrate to wa-sqlite-first, API-as-fallback)
- `src/db/schema.js` — current Dexie chain v1..v8; the split would land as v9 dropping `cards`/`sets` tables
- `src/services/db.js` — Dexie instance, will retain user-data tables only post-split
- [.planning/research/STACK.md](.planning/research/STACK.md) — original stack rationale; documents why Dexie was chosen for v1.0 (offline-first, single-file deps, fast prototyping). The catalog-split rationale would be the v1.x revision: Dexie still wins for user data + sync, wa-sqlite wins for static read-only catalog.
- [.planning/research/PITFALLS.md](.planning/research/PITFALLS.md) — Pitfall §1 documents Dexie 4.x's inability to change PK types in-place (the reason v6+v7+v8 chain exists). Reinforces that further data-layer surgery is expensive — only worth it for a clear win.
- [.planning/phases/999.2-mtgjson-allprices-historical-price-charts-scoped/](.planning/phases/999.2-mtgjson-allprices-historical-price-charts-scoped/) — sibling backlog item; both share the MTGJSON-as-catalog-source thesis. If 999.2 is promoted, consider whether SEED-001 should be lifted alongside it (one MTGJSON download covers both use cases).
- [.planning/phases/14-v11-audit-gap-closure/](.planning/phases/14-v11-audit-gap-closure/) — Phase 14 already introduced MTGJSON as the source of truth for precon deck memberships (commit `103c3c7`). This is the first MTGJSON dependency; SEED-001 would extend that to the full catalog.

## Notes

- The "split" framing is load-bearing — earlier conversation considered a wholesale wa-sqlite migration; that was rejected because Dexie still earns its keep for write-heavy, sync-coupled user data. Don't lose this distinction when the seed surfaces.
- Phase 11 sync engine state to verify before promoting: zero `sync_conflicts` rows accumulating in production over a multi-week window; topbar chip stays `synced` for active users; no schema-drift incidents like the one closed in Plan 14-05.
- OPFS browser support: Chromium-based browsers fully supported; Firefox shipped in 111+; Safari 17+. Counterflux is desktop-first so this is fine, but confirm at promotion time.
- MTGJSON licensing: confirm AllPrintings.sqlite redistribution is permitted under their terms (it is at time of planting — CC-BY-4.0 — but re-verify).
