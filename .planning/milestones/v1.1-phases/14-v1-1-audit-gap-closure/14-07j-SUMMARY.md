---
plan: 14-07j
phase: 14
status: complete
completed: 2026-04-27
type: gap_closure
---

# Plan 14-07j Summary — MTGJSON-sourced precon deck memberships

## What was built

Replaces the 14-07c-e color-identity heuristic (which produced wrong card counts: 101/87/43/54 for Final Fantasy instead of 100/100/100/100) with deterministic data from MTGJSON, the community-standard MTG database that publishes WotC-verified deck lists.

### `scripts/sync-precon-decks.mjs`

ESM Node script that:
1. Fetches `https://mtgjson.com/api/v5/DeckList.json` (the index of every published WotC deck).
2. Filters to `type: 'Commander Deck'`, drops "Collector's Edition" duplicates.
3. Groups by lowercased set code, keeps groups with 2+ decks (multi-deck bundles).
4. For each kept deck, fetches its individual file and extracts `commander[].identifiers.scryfallId` + `mainBoard[].identifiers.scryfallId` honouring `count`.
5. Writes `src/data/precon-deck-memberships.json` with stable key ordering (diff-friendly commits).

Run via `npm run sync:precons`.

### `src/data/precon-deck-memberships.json`

Generated artifact (committed). Shape:
```json
{
  "memberships": {
    "fic": {
      "Limit Break (FINAL FANTASY VII)": ["07b4e4f8-...", ... 100 IDs],
      "Revival Trance (FINAL FANTASY VI)": [...],
      "Counter Blitz (FINAL FANTASY X)": [...],
      "Scions & Spellcraft (FINAL FANTASY XIV)": [...]
    },
    "who": { ...4 decks... },
    ...45 bundles total
  }
}
```

168 decks across 45 bundles, 16,800 card entries, ~800KB serialized.

### Lazy-loaded splitter (`src/services/precons.js`)

The 800KB JSON eagerly imported would regress Phase 7's LCP baseline. Solution:
- New `loadPreconDeckMemberships()` async singleton (lazy dynamic import + cache).
- `splitPreconIntoDecks(precon)` reads the cache synchronously, returns `[]` if not yet loaded.
- `__setPreconDeckMembershipsForTests(value)` test escape hatch.
- `splitPreconIntoDecks` rewritten: O(1) `cardLookup` Map of decklist by scryfall_id, then for each `[deckName, scryfallIds]` in the membership map, pluck cards by exact-id match. Returns decks in MTGJSON-defined (== WotC product) order.

### Reactive lazy-load wiring

`src/stores/collection.js`:
- New `preconMembershipsLoaded: false` reactive state.
- `loadPrecons` kicks a parallel dynamic import + flips the flag when it resolves.

`src/components/precon-browser.js`:
- `manifestDecks` getter reads `$store.collection.preconMembershipsLoaded` BEFORE calling the splitter — Alpine recomputes the tile grid when the JSON arrives.

### Cleanup

- Dropped `src/data/precon-deck-manifests.js` (the 14-07e manual manifest stub — superseded by MTGJSON data).
- Replaced 14-07e's `Phase 14.07e:` describe in `tests/precons.test.js` with `Phase 14.07j:` describe (5 tests using `__setPreconDeckMembershipsForTests` for synthetic fixtures so tests don't depend on real WotC IDs).

## Status

**Complete.** 19/19 precons tests passing. 85/86 across all Phase 14 plan-targeted suites (1 pre-existing reconciliation cross-file flake — KEEP_LOCAL test, intermittent, unrelated to this work).

## Files touched

- `scripts/sync-precon-decks.mjs` — NEW (~140 lines)
- `src/data/precon-deck-memberships.json` — NEW (~800KB, lazy-loaded)
- `src/services/precons.js` — `loadPreconDeckMemberships` + rewritten splitter (~70 lines net)
- `src/stores/collection.js` — `preconMembershipsLoaded` flag + parallel kick on `loadPrecons`
- `src/components/precon-browser.js` — `manifestDecks` getter reads the reactive flag
- `tests/precons.test.js` — 14-07e describe replaced with 14-07j describe (5 tests)
- `package.json` — `sync:precons` script
- `src/data/precon-deck-manifests.js` — DELETED

## Self-Check

- [x] FIC has 4 decks (Limit Break / Revival Trance / Counter Blitz / Scions & Spellcraft) per MTGJSON
- [x] Each deck contains exactly 100 cards (1 commander + 99 mainBoard)
- [x] Membership JSON regeneratable via single command (`npm run sync:precons`)
- [x] Bundle perf preserved — 800KB JSON dynamic-imported on browser open, not eager
- [x] Reactive flag propagates lazy-load completion to Alpine getters
- [x] Tests use synthetic fixtures so they don't break when sync script reruns
- [x] 14-07e manual manifest deleted (no longer referenced anywhere)
- [x] Pre-existing flake (sync-reconciliation KEEP_LOCAL cross-file) is the only failure across the Phase 14 suite

## Deviations

- **45 bundles in initial sync.** MTGJSON returns every Commander Deck ever published. Filter trims to multi-deck bundles only (where the splitter is useful). Single-deck Commander products fall through to the 14-07d full-bundle banner path.
- **Counter Blitz, not Counter Blow.** I had the wrong deck name in 14-07e's manual manifest stub. MTGJSON delivers the actual WotC names — correct without manual updating.
- **800KB is large but acceptable as lazy-loaded.** It's only fetched when the user opens the precon browser (an explicit user action that already triggers fetching the precon list itself + each decklist). Subsequent opens hit the in-memory cache. No first-load impact.
