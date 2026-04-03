# Counterflux: The Aetheric Archive

## What This Is

A premium, desktop-first web application for Magic: The Gathering collectors and Commander players. Counterflux consolidates collection tracking, deckbuilding, market intelligence, spoiler browsing, and game tracking into a single command centre — with a distinctive "Neo-Occult Terminal" visual identity inspired by the Izzet guild. No other MTG tool offers this combination of unified data and aesthetic identity.

## Core Value

The deck builder knows what you own, and the collection knows what's in your decks — one interconnected data layer that eliminates tab-juggling across fragmented tools.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Scryfall API integration with bulk data caching and rate-limit compliance
- [ ] IndexedDB local-first persistence for all user data (collection, decks, games)
- [ ] Global navigation shell with Izzet-themed sidebar and top app bar
- [ ] Dashboard (Epic Experiment) — portfolio summary, quick add, price alerts, Mila's insights, deck quick-launch
- [ ] Collection Manager (Treasure Cruise) — gallery/table/set-completion views, mass entry terminal, CSV import/export, inventory categories, analytics
- [ ] Deck Builder (Thousand-Year Storm) — three-panel editor with search, the 99 (grid/list), live analytics sidebar, collection-aware owned/missing, import/export
- [ ] EDHREC synergy recommendations and Commander Spellbook combo detection in Deck Builder
- [ ] Market Intel (Preordain) — spoiler browser, price watchlist with alerts, market trends, release calendar
- [ ] Game Tracker (Vandalblast) — life totals, commander damage, poison/counters, dice, turn tracking, post-game summary, game history and stats
- [ ] Full visual identity — colour palette, typography (Crimson Pro / Space Grotesk / JetBrains Mono), ghost borders, active glow, aether gradient
- [ ] Mila (System Familiar) — Corgi mascot in sidebar, insights, empty states, loading states
- [ ] Keyboard-first interaction patterns, right-click context menus, undo support
- [ ] Offline capability for collection, decks, and game tracking

### Out of Scope

- Supabase cloud sync / user accounts — deferred to Phase 5 (future milestone)
- Firemind (Personal Analytics) — deferred to Phase 5
- Trade binder matching with other users — future consideration
- Mobile companion app — future consideration (Vandalblast responsive layout is in scope)
- Real-time pricing / marketplace integration — Scryfall daily prices sufficient for v1
- OAuth / social login — no accounts in v1

## Context

**Target users:** Spike/Johnny Commander players who own 500+ cards, maintain multiple Commander decks, and play weekly. Four personas: The Archivist (collection-focused), The Brewer (deckbuilding-focused), The Speculator (price-tracking), The Pod Leader (game-tracking).

**Data architecture:** Scryfall is the canonical card data source (free, comprehensive, community-standard). User data is local-first via IndexedDB. Secondary sources: Commander Spellbook API (combos), EDHREC (synergy/recommendations), Scryfall prices (daily).

**Visual identity:** "Neo-Occult Terminal" — dark, immersive, information-dense. Izzet guild colour palette (blue #0D52BD + red #E23838 on deep void #0B0C10). All screen names reference real MTG card names (Epic Experiment, Thousand-Year Storm, Treasure Cruise, Preordain, Vandalblast). Mila the Corgi is the System Familiar mascot.

**Existing assets:** HTML mockup of Collection Manager (Treasure Cruise) with Tailwind CDN styling, Mila corgi illustration, Izzet guild logo.

**Competitive landscape:** Replaces the need to juggle Moxfield (deckbuilding) + Deckbox (collection) + EDHREC (recommendations) + TCGPlayer (pricing) + MythicSpoiler (spoilers) + Commander Spellbook (combos) + Lifetap (game tracking).

## Constraints

- **Scryfall API compliance**: User-Agent header required, 50-100ms delay between requests, must not paywall Scryfall data, must not crop artist credits, must not repackage without adding value
- **Local-first**: Must work without account creation or internet (after initial data fetch). IndexedDB for persistence, bulk data cache for offline card lookup
- **Desktop-first**: Optimised for desktop viewports. Only Vandalblast (Game Tracker) requires mobile-responsive layout
- **Performance**: Initial load < 3s, autocomplete < 200ms, collection scroll virtualised at 1,000+ cards, deck analytics recalc < 100ms
- **Stack**: Lightweight — no heavy SPA framework. Vite build, Tailwind CSS, vanilla JS or lightweight reactivity layer (Alpine.js/Petite Vue/Lit). Final choice pending research
- **Bulk data**: Scryfall bulk exports can be ~300MB+ — need efficient caching and storage strategy

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Scryfall as canonical data source | Free, comprehensive, community-standard, well-documented API. No other source has complete card data + imagery + pricing | — Pending |
| Local-first with IndexedDB | No account required to start, offline-capable, fast. Cloud sync deferred to future phase | — Pending |
| Izzet "Neo-Occult Terminal" visual identity | No competing tool has a distinctive aesthetic. The look is a feature, not a skin. Creates emotional attachment | — Pending |
| Lightweight stack (no React/Vue/Angular) | Keeps build simple for iterative development. Card data is read-heavy, not interaction-heavy. Avoid framework overhead | — Pending |
| Phased delivery matching PRD structure | Foundation → Deckbuilding → Intelligence → Game Night. Each phase delivers standalone value | — Pending |
| Mila as System Familiar | Warm personality touchpoint in a data-dense app. Corgi with Izzet goggles — memorable, unique, endearing | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-03 after initialization*
