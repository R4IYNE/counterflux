---
plan: 14-07j
phase: 14
type: gap_closure
wave: 1
depends_on: [14-07e, 14-07i]
requirements: [COLLECT-02]
files_modified:
  - scripts/sync-precon-decks.mjs
  - src/data/precon-deck-memberships.json
  - src/services/precons.js
  - src/stores/collection.js
  - src/components/precon-browser.js
  - tests/precons.test.js
  - package.json
files_deleted:
  - src/data/precon-deck-manifests.js
autonomous: true
gap_closure: true
must_haves:
  - splitPreconIntoDecks consumes MTGJSON-sourced WotC-verified deck membership data, not a heuristic
  - Each multi-deck Commander bundle's per-deck card list contains exactly the WotC-published 100 cards (1 commander + 99 mainBoard)
  - The 800KB membership JSON is dynamic-imported on precon-browser open, NOT eager-imported in the main bundle (preserves Phase 7 perf baseline)
  - npm run sync:precons regenerates the JSON from MTGJSON in one command — no manual data entry required
---

# Plan 14-07j: MTGJSON-sourced precon deck memberships (replaces 14-07e heuristic)

## Context

User feedback after 14-07e/i shipped showed the color-identity heuristic produced wrong card counts (Limit Break 101, Revival Trance 87, Counter Blow 43, Scions & Spellcraft 54 — should have been 100/100/100/100). Cards that fit multiple decks fell into whichever was iterated first; cards beyond the 99-supporter cap were dropped. The user correctly asked "where are you getting these decklists from?" — answer: nowhere authoritative.

The Antigravity-agent suggestion was to use **MTGJSON** as the data source via build-time generation. MTGJSON is the community-standard MTG database, publishes WotC-verified deck lists with Scryfall IDs, and is freely consumable.

This plan implements the suggestion.

## Tasks

<task id="1" type="auto">
  <name>Build script + generated JSON</name>
  <read_first>
    <file>src/services/precons.js</file>
    <file>package.json</file>
  </read_first>
  <action>
    Create `scripts/sync-precon-decks.mjs` (ESM Node script):
    - Fetch `https://mtgjson.com/api/v5/DeckList.json` (the index of every published deck).
    - Filter to `type: 'Commander Deck'`, drop "Collector's Edition" duplicates (same card list, foil/alt-art reprints).
    - Group by lowercased set code, keep groups with 2+ decks (multi-deck bundles are the only ones that need splitting).
    - For each kept deck, fetch its individual file `https://mtgjson.com/api/v5/decks/{fileName}.json` and extract `commander[].identifiers.scryfallId` + `mainBoard[].identifiers.scryfallId` honouring `count`.
    - Write to `src/data/precon-deck-memberships.json` with stable key ordering for diff-friendly commits.

    Add `npm run sync:precons` to `package.json` scripts.

    Run it once to populate the JSON.
  </action>
  <verify>
    <automated>
      node -e "const j=require('./src/data/precon-deck-memberships.json'); console.log('FIC decks:', Object.keys(j.memberships.fic).length, 'first deck cards:', j.memberships.fic[Object.keys(j.memberships.fic)[0]].length);"
    </automated>
    <expected>FIC has 4 decks, first deck has exactly 100 cards.</expected>
  </verify>
  <done>
    The membership data is committed and regeneratable via `npm run sync:precons`.
  </done>
  <acceptance_criteria>
    - `test -f scripts/sync-precon-decks.mjs`
    - `test -f src/data/precon-deck-memberships.json`
    - `grep -c "sync:precons" package.json` returns at least 1
    - `node -e "const j=require('./src/data/precon-deck-memberships.json'); for (const code of Object.keys(j.memberships)) for (const name of Object.keys(j.memberships[code])) if (j.memberships[code][name].length !== 100) throw new Error(code + ' ' + name + ' has ' + j.memberships[code][name].length + ' cards');"` exits 0 (every deck is exactly 100)
  </acceptance_criteria>
</task>

<task id="2" type="auto">
  <name>Lazy-load membership JSON; rewrite splitPreconIntoDecks</name>
  <read_first>
    <file>src/services/precons.js</file>
    <file>src/stores/collection.js</file>
    <file>src/components/precon-browser.js</file>
    <file>tests/precons.test.js</file>
  </read_first>
  <action>
    `src/services/precons.js`:
    - Drop the eager `import preconDeckMemberships from '../data/precon-deck-memberships.json'` (would add 800KB to the main bundle).
    - Add `loadPreconDeckMemberships()` async — singleton lazy-import + cache.
    - Add `__setPreconDeckMembershipsForTests(value)` test escape hatch.
    - Rewrite `splitPreconIntoDecks` to use the cached membership map:
      - Build `cardLookup = new Map(decklist.map(c => [c.scryfall_id, c]))`.
      - For each `[deckName, scryfallIds]` in `memberships[code]`: pluck cards by exact-id lookup. Skip decks with 0 matched cards.
      - Return decks in MTGJSON-defined (== WotC) order.
    - Drop the obsolete `src/data/precon-deck-manifests.js` (the manifest stub — replaced by JSON data).

    `src/stores/collection.js`:
    - Add `preconMembershipsLoaded: false` to the store state.
    - In `loadPrecons`, kick a parallel dynamic import of the memberships and flip `preconMembershipsLoaded = true` when it resolves. Alpine reactivity propagates the flip to the precon-browser getter.

    `src/components/precon-browser.js`:
    - `manifestDecks` getter checks `$store.collection.preconMembershipsLoaded` (reactive read) before calling the splitter — without the read, Alpine wouldn't recompute the tile grid when the JSON arrives.

    `tests/precons.test.js`:
    - Replace the 14-07e describe block with a 14-07j describe (5 tests).
    - Use `__setPreconDeckMembershipsForTests` to inject synthetic membership data (avoids depending on real WotC IDs that change when the sync script reruns).
    - Cover: empty/missing decklist → []; unknown set code → []; exact-id match builds N decks; missing-from-cache decks gracefully skipped; cards must exist in BOTH membership AND decklist.
  </action>
  <verify>
    <automated>
      npx vitest run tests/precons.test.js
    </automated>
    <expected>19 passed (14 prior + 5 14-07j regressions).</expected>
  </verify>
  <done>
    User opens Final Fantasy Commander → tiles show Limit Break / Revival Trance / Counter Blitz / Scions & Spellcraft, each with exactly 100 cards.
  </done>
  <acceptance_criteria>
    - `grep -c "loadPreconDeckMemberships" src/services/precons.js` returns at least 2
    - `grep -c "preconMembershipsLoaded" src/stores/collection.js` returns at least 2
    - `grep -c "preconMembershipsLoaded" src/components/precon-browser.js` returns at least 1
    - `! test -f src/data/precon-deck-manifests.js`
    - 5 tests under `Phase 14.07j: splitPreconIntoDecks (MTGJSON membership-driven)`
  </acceptance_criteria>
</task>

## Verification

The membership JSON is regenerated by running `npm run sync:precons` against MTGJSON whenever a new multi-deck Commander product releases. No manual data entry, no runtime network calls, no heuristic. Each deck's card list is exactly what WotC published.

## Deviations

- **Bundle size 800KB.** Eagerly importing the JSON would have shipped 800KB on first load, regressing Phase 7's LCP target. Resolved by dynamic-importing on precon-browser open + a reactive flag that triggers re-render once the load resolves.
- **Real WotC deck names from MTGJSON include the source product** (e.g. "Limit Break (FINAL FANTASY VII)"). Kept verbatim so identical deck names from different products don't collide. The user sees "Limit Break (FINAL FANTASY VII)" on the tile, which is more informative than just "Limit Break".
- **45 multi-deck bundles supported as of generation date** (FIC, WHO, LTC, 40K, PIP, CMM, OTC, SCD, SLD, SOC, TDC, VOC, WOC, ZNC, etc.). Single-deck Commander products and 1-deck Secret Lairs are excluded — the splitter only fires on bundles.
