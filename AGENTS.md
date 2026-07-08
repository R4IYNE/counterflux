# AGENTS.md

This file mirrors `CLAUDE.md` for Codex and other agents. Keep the two in sync.

Desktop-first MTG (Magic: The Gathering) command centre — collection tracking, deckbuilding, market intel, spoilers, and game tracking with a "Neo-Occult Terminal" identity. **(personal)**

- **Stack:** Vite, Alpine.js, Dexie, Supabase, Anthropic, Tailwind, Vitest, Chart.js
- **Commands:** `npm run dev`, `npm run build`, `npm run build:check`, `npm run preview`, `npm test`, `npm run test:watch`, `npm run sync:precons`, `npm run perf`, `npm run perf:open`
- **Supabase:** huxley `hodnhjipurvjaskcsjvj`

## Notes
- Local-first: all user data in IndexedDB via Dexie; works offline after initial Scryfall bulk-data fetch. Stores in `src/stores/` (`Alpine.store()` per domain: collection, deck, game, search, notifications).
- Layout: `src/app.js` (Alpine init + router), `router.js` (Navigo, screens lazy-loaded), `services/` (db.js, scryfall.js, bulk-data.js), `workers/` (bulk JSON parse), `screens/`, `components/`, `utils/`.
- Scryfall pipeline: download bulk JSON → Web Worker stream-parse/trim → Dexie bulk insert; rate-limited 75ms API queue; custom vanilla virtual scrolling for 1000+ card grids.
- Dexie schema chains to v11 (`src/db/schema.js`): v6/v7/v8 migrate synced tables to UUID PKs via `*_next` temp-table shuffle (UUID `creating` hook auto-assigns ids); v9 adds `precons_cache`, v10 adds soft-delete `deleted_at`, v11 adds `deckgen_cache`. Orchestrated by `src/services/migration.js` (localStorage backup w/ round-trip validation + 7-day TTL, blocked-tab modal). Worker mirrors full chain.
- Scryfall API compliance (mandatory): set `User-Agent`, 50–100ms request spacing, no paywalling/cropping artist credit, must add value beyond raw data.
- Design: tokens + 4-tier type (Syne/Space Grotesk/JetBrains Mono), 8pt spacing, full spec in `.planning/phases/01-foundation-data-layer/01-UI-SPEC.md`. Screens named after MTG cards (Epic Experiment=Dashboard, Treasure Cruise=Collection, Thousand-Year Storm=Deck Builder, Preordain=Market, Vandalblast=Game Tracker; Mila = corgi familiar).
- Tailwind v4: CSS-first config (`@import "tailwindcss"`, `@theme` block, no `tailwind.config.js`).
- Planning artifacts in `.planning/` (PROJECT.md, ROADMAP.md, REQUIREMENTS.md, STATE.md, per-milestone dirs) are GSD-era history. Live workflow is the workspace pipeline: /idea → /spec → /build → /check → /land → /retro.
- Shipped: v1.0 (Aetheric Archive), v1.1 (cloud sync + auth), v1.2 (Vercel proxies), v1.3 (Brew with the Familiar — AI deck generation, Phases 17-20). v1.3 is built and deployed but was never formally tagged/archived.
