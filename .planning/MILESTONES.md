# Milestones

## v1.1 Second Sunrise (Shipped: 2026-04-27)

**Phases completed:** 8 phases (7-14), 47 plans, 14-day timeline (2026-04-14 → 2026-04-27)
**Tag:** `v1.1` · **Release:** https://github.com/R4IYNE/counterflux/releases/tag/v1.1
**Archive:** [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) · [milestones/v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md) · [milestones/v1.1-MILESTONE-AUDIT.md](milestones/v1.1-MILESTONE-AUDIT.md) · [milestones/v1.1-phases/](milestones/v1.1-phases/)

**Key accomplishments:**

- **Cloud sync GA** — Supabase Postgres + Realtime backing Dexie via hook-outbox + batched upsert. Last-write-wins conflict resolution at field level, `deck_cards` atomic merge for join rows, 4-state topbar chip (synced/syncing/offline/error). Reconciliation lockdown modal on first sign-in surfaces all 4 local/remote × empty/populated states without ever silently destroying data
- **Supabase auth** — email magic-link + Google OAuth via PKCE. Lazy-loaded client (anonymous boot has zero Supabase chunk in bundle, gated by `tests/auth-bundle.test.js`). RLS-enforced `auth.uid() = user_id` on every synced table with `WITH CHECK` on writes. Sign-out preserves local Dexie data
- **Schema migration v5 → v6+v7+v8** — UUID-PK migration on every synced table via temp-table shuffle (worked around Dexie 4.x's inability to change PK type in-place). New `sync_queue` outbox + `sync_conflicts` + `profile` tables. Pre-migration localStorage backup with 7-day TTL sweep. Blocking modal for cross-tab upgrade conflicts
- **Performance optimisation** — LCP 6.1s → 2.49s (−59%). All Web Vitals `Good`, Lighthouse perf 86. The actual win: static paint-critical `<h1>` in initial HTML with auth-wall decorating pre-existing DOM (instead of creating at runtime)
- **Treasure Cruise rapid entry** — LHS persistent 360px add-card workbench panel replacing modal. Paper-printings picker with set icons. MTGJSON-sourced Commander precon browser (45 bundles, 168 decks, exactly 100 cards each, lazy-loaded, weekly GitHub Action sync). Multi-deck bundle warning + ADD ALL guard for products with `decklist.length > 200`
- **Vandalblast pod-play polish** — Slot-machine first-player spinner (ease-out-expo deceleration). T-shape 3-player grid spotlighting player 1. RAG colouring on life/poison/commander-damage. Material Symbols glyphs (skull for poison, paid for tax, shield_with_heart for commander damage). Real Fullscreen API (replacing dead store boolean). Persisted `turn_laps` with wall-clock anchor immune to background-tab throttling (proven by `vi.spyOn(Date, 'now')` 30-min jump test)
- **Thousand-Year Storm accuracy** — Mana curve + colour distribution validated against three hand-calculated reference fixtures. EDHREC bulk Top-100 salt endpoint replacing the broken per-card slug query. Commander rendered as own type category. RAG severity badges on gap warnings (`[RED|AMBER] +N`)
- **Notification bell + Preordain spoiler refresh** — Unified notification inbox combining sync errors (deduplicated) with watchlist price alerts. Custom Keyrune set-icon dropdown. Sectioned spoiler grid with day/section headers, NEW badges (last 48 hours), hover preview, quick add-to-watchlist
- **11 cross-app polish fixes** (POLISH-01..11) — splash quotes, favicon, rounded card corners, opaque toast icons, sidebar collapse toggle, "Brew a new storm" rename, red-accent coverage, top-losers name resolution, additional-counters `+` icon, add-to-wishlist toast wording
- **Audit gap closure (Phase 14)** — Closed audit Issues A/C/D + 2 latent v1.1 bugs (Phase 11 schema drift on `counterflux.*` columns, Phase 13 auth-wall stale-static race) + 4 quality items pulled forward (Preordain dropdown sort, sync-errors bulk RETRY/DISCARD, reconcile one-shot guard with per-user keying, release calendar newest-first)

**Codebase growth:** 222 → 541 commits · 104 → 127 source files · 15,367 → 24,296 source LOC · 45 → 119 test files
**Audit:** Re-verified `passed` 2026-04-26 after Phase 14 close-out

---

## v1.0 The Aetheric Archive (Shipped: 2026-04-13)

**Phases completed:** 6 phases, 31 plans, 56 tasks

**Key accomplishments:**

- Debounced autocomplete with rich results (thumbnail, set icon, mana cost) and slide-in card detail flyout with Oracle text, pricing, format legalities, and keyboard navigation
- 4-format decklist import (Moxfield/Archidekt/Arena/plaintext) with auto-detection and card resolution, plus 4-format export (Plain Text/MTGO/Arena/CSV) with clipboard and download
- Alpine intelligence store orchestrating EDHREC synergies, Spellbook combos, salt scoring, and gap detection with Mila daily insight generation service
- Salt gauge, EDHREC synergy suggestions, combo badges with popover, gap warnings, and near-miss combos wired into deck builder analytics panel
- Preordain market intel screen with release calendar timeline, three-tab navigation, and filterable spoiler gallery with NEW badges
- Wired watchlist, movers, post-game overlay, and game history into Preordain/Vandalblast screens with sidebar navigation unlocked
- GitHub-style keyboard shortcut cheat sheet modal with Escape priority chain, Ctrl+Z undo handler, and ? key toggle

---
