# Counterflux: The Aetheric Archive

A premium, desktop-first web application for Magic: The Gathering collectors and Commander players. Counterflux consolidates collection tracking, deckbuilding, market intelligence, spoiler browsing, and game tracking into a single command centre — with a distinctive "Neo-Occult Terminal" visual identity inspired by the Izzet guild.

**Core value:** The deck builder knows what you own, and the collection knows what's in your decks — one interconnected data layer that eliminates tab-juggling across fragmented tools.

Full product definition: [`.planning/PROJECT.md`](.planning/PROJECT.md).

## Development Commands

```bash
npm run dev          # Vite dev server with HMR
npm run build        # Production build
npm run preview      # Preview production build locally
npm test             # Run Vitest test suite
npm run test:watch   # Vitest in watch mode
npm run perf         # Lighthouse CI collect
```

Run all commands from the `counterflux/` project root.

## Auth Setup (Phase 10+)

Counterflux uses Supabase (project `huxley`, schema `counterflux`) for identity + cloud sync.
Provisioning runbook: [.planning/phases/10-supabase-auth-foundation/10-AUTH-PREFLIGHT.md](.planning/phases/10-supabase-auth-foundation/10-AUTH-PREFLIGHT.md)

Quick-start (for returning devs):

1. `cp .env.example .env.local`
2. Paste `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` from Supabase Dashboard → huxley → Settings → API
3. `npm run dev` — cold-boot is anonymous; click **SIGN IN** in the sidebar to test the flow (once Plan 10-03 ships).
4. `VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx vitest run tests/rls-isolation.test.js` — D-37 hard gate.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Build | Vite (Rolldown) 8.x |
| Reactivity | Alpine.js 3.15.x |
| CSS | Tailwind CSS 4.x |
| Database | Dexie.js (IndexedDB) 4.x |
| Charts | Chart.js 4.x (tree-shaken) |
| Drag & Drop | SortableJS 1.15.x |
| Routing | Navigo 8.11.x |
| Identity | Supabase (@supabase/supabase-js, from Phase 10) |
| Mana symbols | mana-font + keyrune |

Architecture + conventions: see `CLAUDE.md` in the project root.

## Planning Artifacts

All project planning lives in `.planning/`:

- `PROJECT.md` — product definition, requirements, constraints
- `ROADMAP.md` — milestone-level delivery plan
- `REQUIREMENTS.md` — full requirement catalogue with IDs
- `STATE.md` — current progress tracker
- `phases/XX-*/` — per-phase context, research, UI-SPEC, plans, summaries
