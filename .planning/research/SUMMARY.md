# Research Summary: Counterflux — The Aetheric Archive

**Domain:** MTG Collection/Deckbuilding/Game Tracking Command Centre
**Researched:** 2026-04-03
**Overall confidence:** HIGH

## Executive Summary

Counterflux is a local-first, desktop-first web application for Magic: The Gathering Commander players. The research confirms that a lightweight, framework-free-ish stack is not only viable but optimal for this use case. The app is fundamentally read-heavy (browsing cards, viewing decks, checking prices) with focused interaction points (deck editing, game tracking), which means a heavyweight SPA framework like React or Vue would add bundle size and complexity without proportional benefit.

The recommended stack centres on **Alpine.js** for declarative reactivity (~17KB), **Dexie.js** for IndexedDB persistence (~30KB), **Chart.js** for analytics charts (~35KB tree-shaken), and **Vite 8** for builds (Rolldown-powered, 10-30x faster than Vite 6). Total JavaScript bundle is estimated at ~99KB gzipped — extraordinarily lean for a full-featured SPA. The critical innovation is the "data layer as single source of truth" pattern: Alpine stores wrap Dexie queries, so the collection knows about decks and decks know about the collection. This is the core differentiator versus fragmented tools like Moxfield + Deckbox + EDHREC.

The highest-risk technical decision is **Scryfall bulk data handling**. The bulk export is ~300MB JSON and must be streamed, parsed in a Web Worker, and batch-inserted into IndexedDB. Getting this wrong crashes the app on first load. This should be tackled in Phase 1 and validated immediately.

**Petite Vue was eliminated** from consideration. It has not had a release in four years (stuck at v0.4.1) and is effectively abandoned. **Lit** was the runner-up but its Shadow DOM creates friction with Tailwind CSS. Alpine.js wins on DX, ecosystem, and maintenance activity.

## Key Findings

**Stack:** Vite 8 + Alpine.js 3.15 + Tailwind CSS v4 + Dexie.js 4 + Chart.js 4 + SortableJS + Navigo + mana-font. ~99KB JS gzipped total.

**Architecture:** Alpine stores as service layer wrapping Dexie.js. Screens lazy-loaded via Navigo router. Virtual scrolling custom-built (~150 lines). Scryfall API accessed through rate-limited queue service.

**Critical pitfall:** Scryfall bulk data (300MB JSON) must be stream-parsed in a Web Worker. `JSON.parse()` on the full string will crash the tab.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Foundation + Data Layer** — Validate the hardest technical risk first
   - Addresses: Scryfall API integration, bulk data caching, IndexedDB schema, navigation shell, basic card search
   - Avoids: Bulk data memory explosion (Pitfall #1), rate limit violations (Pitfall #2), storage eviction (Pitfall #3)
   - Ship: Working card search, basic collection add/view, Izzet-themed shell

2. **Collection Manager (Treasure Cruise)** — First user-facing value
   - Addresses: Gallery/table/set-completion views, filtering, sorting, CSV import/export, mass entry
   - Avoids: Alpine reactivity with large arrays (Pitfall #6), virtual scroll perf
   - Ship: Full collection management with offline support

3. **Deck Builder (Thousand-Year Storm)** — Core differentiator
   - Addresses: Three-panel editor, SortableJS drag-and-drop, Chart.js analytics, collection-aware owned/missing
   - Avoids: Collection cross-reference perf (Pitfall #4), SortableJS + Alpine sync (Pitfall #8), Chart.js cleanup (Pitfall #11)
   - Ship: Complete deck building with live analytics

4. **Market Intel + Game Tracker** — Polish and completeness
   - Addresses: Price watchlist, spoiler browser, life totals, commander damage, game history
   - Avoids: Rate limits on price checks (Pitfall #2)
   - Ship: Full app feature set

**Phase ordering rationale:**
- Phase 1 must validate bulk data handling and IndexedDB persistence — everything else depends on a working data layer
- Collection before Deck Builder because the "owned/missing" differentiator requires a populated collection
- Market Intel and Game Tracker are independent of each other and lower risk — combine into one phase
- Dashboard (Epic Experiment) can be built incrementally as data sources come online across phases

**Research flags for phases:**
- Phase 1: Needs deep research on Scryfall bulk data streaming approaches and Web Worker IndexedDB access
- Phase 2: Standard patterns, unlikely to need research
- Phase 3: May need research on SortableJS + Alpine.js integration patterns (no established best practice)
- Phase 4: EDHREC API access may need research (no official public API documented)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All libraries verified current, actively maintained, well-documented |
| Features | HIGH | Feature landscape well-understood from competitive analysis |
| Architecture | HIGH | Alpine stores + Dexie pattern is straightforward and well-supported |
| Pitfalls | HIGH | Scryfall constraints are well-documented. IndexedDB pitfalls are known |
| Navigo router | MEDIUM | Last updated ~5 years ago. API is stable but consider custom fallback |
| Virtual scrolling | MEDIUM | Custom implementation recommended. May need iteration |
| Bulk data streaming | MEDIUM | Approach is sound but needs Phase 1 validation with real data |

## Gaps to Address

- **EDHREC API:** No official public API documented. May require scraping or finding community wrapper. Research needed when Phase 4 approaches.
- **Commander Spellbook API:** Exists but documentation quality unknown. Research when implementing combo detection.
- **Web Worker + Dexie.js:** Dexie can be used in Web Workers but there are nuances with version management. Validate in Phase 1.
- **PWA/Service Worker:** Not researched yet. Needed for offline support beyond IndexedDB. Defer to Phase 2+.
- **Scryfall bulk data format changes:** Scryfall may change bulk data schema. Build parser defensively with fallbacks.
