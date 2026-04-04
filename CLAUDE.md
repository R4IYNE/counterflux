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
