---
phase: 01-foundation-data-layer
plan: 01
subsystem: database
tags: [vite, tailwind-v4, dexie, indexeddb, scryfall, vitest, alpine, woff2]

# Dependency graph
requires: []
provides:
  - "Vite 8 build system with Tailwind v4 CSS-first theme (13 Izzet colour tokens)"
  - "Dexie.js database schema (cards + meta tables) with compound indexes"
  - "Unified card accessor for all 9 Scryfall card layouts"
  - "Card search module with indexed prefix + contains fallback"
  - "Scryfall API helpers with User-Agent compliance"
  - "Persistent storage wrapper"
  - "Vitest test infrastructure with fake-indexeddb"
  - "Self-hosted variable fonts (Syne, Space Grotesk, JetBrains Mono, Crimson Pro)"
  - "Custom CSS utilities (ghost-border, glass-overlay, aether-glow, scanline)"
affects: [01-02, 01-03, 02-collection, 03-deckbuilder]

# Tech tracking
tech-stack:
  added: [vite@8.0.3, alpinejs@3.15.11, dexie@4.4.2, navigo@8.11.1, tailwindcss@4.x, "@tailwindcss/vite", vitest@4.1.2, fake-indexeddb, "@streamparser/json-whatwg", mana-font, keyrune, material-symbols, "@fontsource-variable/syne", "@fontsource-variable/space-grotesk", "@fontsource-variable/jetbrains-mono", "@fontsource-variable/crimson-pro"]
  patterns: [css-first-tailwind-theme, dexie-schema-versioning, dependency-injection-for-testability, fontsource-self-hosted-fonts]

key-files:
  created:
    - src/db/schema.js
    - src/db/card-accessor.js
    - src/db/search.js
    - src/utils/scryfall.js
    - src/utils/storage.js
    - src/styles/main.css
    - src/styles/utilities.css
    - vite.config.js
    - vitest.config.js
    - tests/fixtures/sample-cards.json
  modified: []

key-decisions:
  - "Used fontsource npm packages for self-hosted .woff2 fonts instead of manual download"
  - "Material Symbols imported as outlined-only variant to reduce bundle from 12.6MB to 3.9MB"
  - "Vite 8 manualChunks uses function form (not object) due to Rolldown compatibility"
  - "Storage utils use dependency injection for StorageManager to avoid Node.js navigator getter issues in tests"

patterns-established:
  - "CSS-first Tailwind v4 theme: all design tokens defined in @theme block in main.css"
  - "Dexie schema versioning: db.version(1).stores() pattern for migrations"
  - "Card accessor pattern: DOUBLE_SIDED_LAYOUTS array determines image source location"
  - "Test fixtures: sample-cards.json covers all major Scryfall layout types"
  - "Dependency injection: browser APIs (navigator.storage) accept optional override parameter for testability"

requirements-completed: [DATA-05, DATA-06, DATA-07, DATA-08, SHELL-05, SHELL-06, PERF-01]

# Metrics
duration: 8min
completed: 2026-04-04
---

# Phase 1 Plan 01: Foundation Scaffold Summary

**Vite 8 + Tailwind v4 project with Izzet colour theme, Dexie IndexedDB schema, unified Scryfall card accessor for 9 layouts, and 59 passing Vitest tests**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-04T07:49:58Z
- **Completed:** 2026-04-04T07:58:17Z
- **Tasks:** 2
- **Files modified:** 26

## Accomplishments
- Vite 8 project builds successfully with Tailwind v4 processing all 13 Izzet colour tokens and 0px border radius (Organic Brutalism)
- 4 self-hosted variable .woff2 fonts configured with @font-face (Syne, Space Grotesk, JetBrains Mono, Crimson Pro) -- zero CDN dependencies
- Dexie database schema with cards + meta tables, compound [set+collector_number] index, and getBulkMeta/setBulkMeta helpers
- Card accessor correctly normalises all 9 Scryfall card layouts (normal, transform, modal_dfc, split, adventure, flip, meld, saga, double_faced_token)
- Search module queries Dexie with startsWithIgnoreCase prefix matching plus contains fallback
- Scryfall API helpers enforce User-Agent compliance ("Counterflux/1.0") and support freshness checking
- 59 tests across 6 test files all passing green

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold project, install dependencies, configure Vite + Tailwind + fonts + test infra** - `81b90be` (feat)
2. **Task 2: Create data layer contracts -- Dexie schema, card accessor, search, Scryfall utils, storage, and all test scaffolds** - `9f5bfbf` (feat)

## Files Created/Modified
- `package.json` - Project manifest with all dependencies
- `vite.config.js` - Vite 8 + Tailwind v4 plugin, function-form manualChunks for vendor splitting
- `vitest.config.js` - Vitest configured with fake-indexeddb setup
- `index.html` - Root HTML skeleton with font preloads, no CDN links
- `src/main.js` - Entry point importing CSS, mana-font, keyrune, Material Symbols Outlined
- `src/styles/main.css` - Tailwind v4 @theme with 13 colour tokens, 4 font families, 0px radii, spacing scale
- `src/styles/utilities.css` - Custom CSS utilities: ghost-border, mono-data, syne-header, glass-overlay, aether-glow, scanline
- `src/styles/fonts/*.woff2` - 4 self-hosted variable font files
- `src/db/schema.js` - Dexie database definition with cards and meta stores
- `src/db/card-accessor.js` - Unified card data accessor for all Scryfall layouts
- `src/db/search.js` - Autocomplete search with indexed prefix + contains fallback
- `src/utils/scryfall.js` - Scryfall API helpers (fetchBulkDataMeta, shouldRefresh, USER_AGENT)
- `src/utils/storage.js` - Persistent storage wrapper with DI for testability
- `tests/fixtures/sample-cards.json` - 8 sample cards covering all major Scryfall layout types
- `tests/task1-scaffold.test.js` - 9 tests for project scaffold verification
- `tests/schema.test.js` - 5 tests for Dexie schema and CRUD operations
- `tests/card-accessor.test.js` - 25 tests covering all layout types and accessor functions
- `tests/search.test.js` - 7 tests for search module
- `tests/scryfall.test.js` - 7 tests for Scryfall utils and User-Agent compliance
- `tests/storage.test.js` - 6 tests for persistent storage wrapper

## Decisions Made
- **fontsource for fonts**: Used `@fontsource-variable/*` npm packages to source .woff2 files rather than manual download from Google Fonts -- reliable, versioned, no build step needed
- **Material Symbols Outlined only**: Imported `material-symbols/outlined.css` instead of the full package to reduce font bundle from ~12.6MB (3 variants) to ~3.9MB (1 variant) per UI-SPEC spec
- **Function-form manualChunks**: Vite 8 uses Rolldown which requires function-form `manualChunks`, not the object-form supported by Rollup -- adapted config accordingly
- **Dependency injection for storage**: Node.js `navigator` is a read-only getter, so storage utils accept optional `StorageManager` parameter for testing while defaulting to `navigator.storage` in browser

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vite create template cancelled on existing directory**
- **Found during:** Task 1
- **Issue:** `npm create vite@latest .` cancelled due to existing CLAUDE.md in directory
- **Fix:** Created package.json and project structure manually instead of using Vite template
- **Files modified:** package.json
- **Verification:** npm run build succeeds
- **Committed in:** 81b90be

**2. [Rule 1 - Bug] Rolldown incompatible manualChunks object format**
- **Found during:** Task 1
- **Issue:** Vite 8 with Rolldown does not support object-form `manualChunks` -- TypeError thrown during build
- **Fix:** Changed to function-form `manualChunks(id)` that checks `node_modules` path
- **Files modified:** vite.config.js
- **Verification:** npm run build exits code 0
- **Committed in:** 81b90be

**3. [Rule 2 - Missing Critical] Material Symbols importing all 3 variants**
- **Found during:** Task 1
- **Issue:** `import 'material-symbols'` pulled in Sharp, Outlined, AND Rounded variants (~12.6MB of font files)
- **Fix:** Changed to `import 'material-symbols/outlined.css'` per UI-SPEC which specifies Outlined only
- **Files modified:** src/main.js
- **Verification:** Build output shows single 3.9MB font file instead of 3 totalling 12.6MB
- **Committed in:** 81b90be

**4. [Rule 1 - Bug] Node.js navigator getter prevents globalThis assignment in tests**
- **Found during:** Task 2
- **Issue:** `globalThis.navigator = {...}` throws TypeError in Node.js because navigator is a read-only getter
- **Fix:** Refactored storage utils to accept optional StorageManager parameter (dependency injection)
- **Files modified:** src/utils/storage.js, tests/storage.test.js
- **Verification:** All 6 storage tests pass
- **Committed in:** 9f5bfbf

---

**Total deviations:** 4 auto-fixed (2 bugs, 1 missing critical, 1 blocking)
**Impact on plan:** All auto-fixes necessary for correctness and build functionality. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## Known Stubs
None -- all modules export functional implementations with passing tests.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Build system, design tokens, and data layer contracts are ready for Plan 02 (bulk data pipeline) and Plan 03 (navigation shell)
- All test infrastructure in place with fake-indexeddb for Dexie testing
- Sample card fixtures cover all layout types needed for future UI component testing

## Self-Check: PASSED

- All 15 key files verified present on disk
- Both task commits (81b90be, 9f5bfbf) verified in git history
- 59/59 tests passing
- Build exits code 0

---
*Phase: 01-foundation-data-layer*
*Completed: 2026-04-04*
