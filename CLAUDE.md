# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Counterflux: The Aetheric Archive**

A premium, desktop-first web application for Magic: The Gathering collectors and Commander players. Counterflux consolidates collection tracking, deckbuilding, market intelligence, spoiler browsing, and game tracking into a single command centre — with a distinctive "Neo-Occult Terminal" visual identity inspired by the Izzet guild.

**Core Value:** The deck builder knows what you own, and the collection knows what's in your decks — one interconnected data layer that eliminates tab-juggling across fragmented tools.
<!-- GSD:project-end -->

## Development Commands

```bash
npm run dev          # Vite dev server with HMR
npm run build        # Production build
npm run preview      # Preview production build locally
npm test             # Run Vitest test suite
npm run test:watch   # Vitest in watch mode
npm run lint         # Biome lint + format check (planned)
```

Run all commands from the `counterflux/` project root.

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Build | Vite (Rolldown) | 8.x |
| Reactivity | Alpine.js | 3.15.x |
| CSS | Tailwind CSS | 4.x |
| Database | Dexie.js (IndexedDB) | 4.x |
| Charts | Chart.js (tree-shaken) | 4.x |
| Drag & Drop | SortableJS | 1.15.x |
| Routing | Navigo | 8.11.x |
| Mana symbols | mana-font + keyrune | latest |

Stack rationale and alternatives considered are documented in `.planning/research/STACK.md`.

## Architecture

```
index.html
    |
  app.js ──── Navigo Router ──── Screen Modules (lazy loaded)
    |                                 |
  Alpine.js                  Dashboard | Collection | DeckBuilder | Market | Game
    |
  Alpine.store()  ──── Shared State (search, notifications, active deck)
    |
  Data Layer
  ├── Dexie.js ──── IndexedDB (user data: collection, decks, games)
  ├── ScryfallService ──── Scryfall REST API (card data, prices)
  └── BulkDataCache ──── IndexedDB (Scryfall bulk data, offline)
                              |
                         Web Worker (stream-parse bulk JSON without blocking main thread)
```

### Directory Layout

```
src/
├── app.js              # Alpine init, router setup, global stores
├── router.js           # Navigo configuration
├── styles.css          # Tailwind @theme + font imports
├── stores/             # Alpine.store() modules (collection, deck, game, search, notifications)
├── services/           # Data access: db.js (Dexie), scryfall.js, bulk-data.js, import-export.js
├── workers/            # Web Worker for bulk JSON parsing
├── screens/            # Screen-level Alpine components (one per screen)
├── components/         # Reusable Alpine component functions (card-grid, card-search, toast, etc.)
└── utils/              # Pure utilities (mana-parser, csv, debounce, format, keyboard)
```

### Key Patterns

- **Local-first**: All user data persists in IndexedDB via Dexie. App works offline after initial bulk data fetch.
- **Alpine stores as state layer**: Each domain (collection, deck, game, search) has its own `Alpine.store()`. Stores communicate through Alpine reactivity, not events.
- **Scryfall bulk data pipeline**: Download bulk JSON → Web Worker stream-parses and trims to essential fields → Dexie bulk insert → search queries hit local IndexedDB first, API as fallback.
- **Rate-limited API queue**: ScryfallService uses a 75ms-spaced queue for all Scryfall API calls.
- **Virtual scrolling**: Custom ~150-line vanilla JS implementation for card grids at 1000+ items. No library needed.
- **Screen lazy loading**: Navigo router loads screen modules on navigation, not at startup.

### Dexie Schema v6+v7 (Phase 7, v1.1)

The schema chain extends through v7. v6 and v7 ship in the same PR (Phase 7 Plan 3, per `07-CONTEXT.md` D-01a) — a v1.0 user experiences a single upgrade event on first boot of v1.1.

**What changed:**
- Synced tables (`collection`, `decks`, `deck_cards`, `games`, `watchlist`) migrated from `++id` autoincrement to text UUID PKs via a temp-table shuffle. Dexie 4.x cannot change a table's PK type in-place (see `.planning/research/PITFALLS.md` §1), so v6 creates `*_next` shadow tables with the final shape and copies rows with freshly-generated UUIDs + FK remap, then v7 null-drops the legacy autoincrement tables.
- **`*_next` is the canonical name consumed by Phases 9 and 11** — Dexie cannot rename within a single version, and the rename-spike test (`tests/schema-rename-spike.test.js` Test 3) confirmed a future v8 can collapse the suffix if desired.
- New tables created with final shape: `sync_queue` (`++id, table_name, user_id, created_at`), `sync_conflicts` (`++id, table_name, detected_at`), `profile` (`id, user_id, updated_at`). Phase 11 populates sync tables; Phase 10 populates profile.
- Backfilled fields on every migrated row: `updated_at` = `Date.now()` at migration time (D-07), `synced_at` = `null` (D-08), `user_id` = `null`; `games.turn_laps` defaults to `[]` when absent (D-09).
- `price_history.updated_at` column added (no PK change, straight `.modify()` backfill — D-11).
- `meta` table gets a `schema_version` row: `{ key: 'schema_version', version: 7, migrated_at: <ISO string> }` (D-12).

**Migration safety:** `src/services/migration.js` orchestrates the upgrade — sweeps stale backups (7-day TTL, D-16), writes a pre-migration localStorage backup keyed `counterflux_v5_backup_<ISO-timestamp>` with JSON round-trip validation (D-17b), registers `db.on('blocked')` and `db.on('versionchange')` handlers BEFORE `db.open()` (Pitfall F), and surfaces failure via a blocking modal that stays up until the user acts. If another tab holds an old connection, `src/components/migration-blocked-modal.js` renders a "Counterflux is upgrading — please close other Counterflux tabs" overlay that auto-closes when the upgrade proceeds.

**Progress UX (D-17a):** The v6 upgrade callback counts total rows first, then emits `Alpine.store('bulkdata').migrationProgress` updates at ~10% increments. The splash screen (`src/components/splash-screen.js`, wired in Plan 1) renders "Migrating your archive — N%" so 5000+ card collections don't appear frozen.

**Phases 9 and 11** consume the new schema directly: Phase 9 persists `games_next.turn_laps`, Phase 11 populates `sync_queue` as the outbox, Phase 10 writes `profile` rows on auth.

**Files of interest:**
- `src/db/schema.js` — v1..v7 chain with v6 upgrade callback (UUID remap + backfills + schema_version)
- `src/services/migration.js` — orchestrator; probe-at-v5 snapshot before production `db.open`
- `src/services/migration-backup.js` — localStorage backup with round-trip validation + 7-day TTL sweep
- `src/components/migration-blocked-modal.js` — vanilla-DOM blocking modal (Alpine not yet available mid-migration)
- `src/workers/bulk-data.worker.js` — mirrors v6+v7 declarations (worker only touches `cards`+`meta` but must declare the full chain for schema-match)
- `tests/migration-v5-to-v7.test.js` — D-17 hard-gate suite (12 tests covering v1..v5 fixtures × 4 realistic states)
- `tests/schema-rename-spike.test.js` — documents the rename pattern chosen for this migration

## Constraints

### Scryfall API Compliance (mandatory)
- Set `User-Agent` header on every request (e.g., `Counterflux/1.0`)
- Minimum 50-100ms delay between API requests
- Must not paywall Scryfall data
- Must not crop or remove artist credit from card images
- Must add value beyond raw Scryfall data repackaging

### Performance Targets
- Initial page load: < 3 seconds on broadband
- Search autocomplete: < 200ms response
- Collection scroll: virtualised at 1,000+ cards
- Deck analytics recalc: < 100ms

### Desktop-First
- Optimised for desktop viewports
- Only Vandalblast (Game Tracker) requires mobile-responsive layout

## Visual Identity — "Neo-Occult Terminal"

### Design System (from UI-SPEC)

| Token | Value |
|-------|-------|
| Background | `#0B0C10` |
| Surface | `#14161C` |
| Surface hover | `#1C1F28` |
| Ghost border | `#2A2D3A` |
| Text primary | `#E8E6E3` |
| Text secondary | `#8A8F98` |
| Primary accent (blue) | `#0D52BD` |
| Secondary accent (red) | `#E23838` |
| Success | `#22C55E` |
| Warning | `#F59E0B` |

**Typography:** 4-tier scale — Syne 48px display, Space Grotesk 20px heading, Space Grotesk 14px body, JetBrains Mono 11px label. Two weights only: 400 and 700.

**Spacing:** 8-point scale (4/8/16/24/32/48/64px). No exceptions.

**Colour distribution:** 60% background/surface, 30% text/ghost-border, 10% accent.

Full design contract: `.planning/phases/01-foundation-data-layer/01-UI-SPEC.md`

### Screen Names (all real MTG card names)
- **Epic Experiment** — Dashboard
- **Treasure Cruise** — Collection Manager
- **Thousand-Year Storm** — Deck Builder
- **Preordain** — Market Intel
- **Vandalblast** — Game Tracker
- **Mila** — Corgi system familiar (sidebar, empty states, tips)

## Tailwind v4 Notes

Tailwind v4 uses CSS-first configuration, different from v3:
- `@import "tailwindcss"` replaces `@tailwind` directives
- `@theme` block in CSS replaces `tailwind.config.js`
- `border-*` no longer defaults to gray-200
- Container queries are built-in (no plugin)

## Planning Artifacts

All project planning lives in `.planning/`:
- `PROJECT.md` — product definition, requirements, constraints
- `ROADMAP.md` — 6-phase delivery plan
- `REQUIREMENTS.md` — full requirement catalogue with IDs
- `STATE.md` — current progress tracker
- `phases/01-*/` — per-phase context, research, UI-SPEC, plans

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
