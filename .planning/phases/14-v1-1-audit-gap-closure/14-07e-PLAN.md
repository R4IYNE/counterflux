---
plan: 14-07e
phase: 14
type: gap_closure
wave: 1
depends_on: [14-07d]
requirements: [COLLECT-02]
files_modified:
  - src/data/precon-deck-manifests.js
  - src/services/precons.js
  - src/components/precon-browser.js
  - tests/precons.test.js
autonomous: true
gap_closure: true
must_haves:
  - Multi-deck Commander products with a curated WotC deck-name manifest (Final Fantasy "fin" at minimum) render an individual-deck tile grid in the precon-browser drill view
  - Each tile shows the WotC deck name (Limit Break / Revival Trance / Counter Blow / Scions & Spellcraft for Final Fantasy) + face commanders + card count
  - Clicking a tile drills into that deck's preview; ADD ALL imports only that deck's ~100 cards via the existing addCardsFromIds helper
  - Bundles WITHOUT a manifest entry keep the 14-07d full-bundle banner + ADD ALL flow
  - splitPreconIntoDecks no longer relies on the 14-07c heuristic that produced 19 mis-labelled tiles for Final Fantasy
---

# Plan 14-07e: Manifest-driven multi-deck precon split

## Context

User feedback after 14-07d shipped: "I want to be able to import all cards from one or more deck — i.e. if I chose the 'Revival Trance' deck it will show/import 100 cards and then if I chose 'Limit Break' it will show/import another 100." The 14-07d revert removed both the original 4B gate (no-op on bundle) AND the 14-07c tile grid (heuristic-split based on color identity).

The user wants the tile grid back — but with the WotC deck names ("Revival Trance", "Limit Break"), not the heuristic groups ("8 commanders", "25 commanders" — those were card counts mis-rendered as commander counts because every legendary creature in Final Fantasy got grouped by color identity, producing 19 micro-tiles instead of 4 deck-tiles).

Scryfall doesn't expose deck-membership metadata. The fix is a curated manifest mapping `setCode → [{ name, commanderNames }]` shipped in `src/data/precon-deck-manifests.js`. Final Fantasy 'fin' gets a stub manifest based on public WotC product info; other 5 known multi-deck products (Doctor Who, Tales of Middle-earth, Warhammer 40K, Fallout, Commander Masters) start with placeholder entries that downstream PRs can fill in.

## Tasks

<task id="1" type="auto">
  <name>Create the precon deck manifest module</name>
  <read_first>
    <file>src/services/precons.js</file>
  </read_first>
  <action>
    Create `src/data/precon-deck-manifests.js` exporting `PRECON_DECK_MANIFESTS` (object keyed by Scryfall set code, lowercase) and `getDeckManifest(code)` helper. Each value is `[{ name: 'Limit Break', commanderNames: ['Cloud, Ex-SOLDIER', 'Tifa, Martial Artist'] }, ...]`.

    Final Fantasy ('fin') manifest: 4 entries with best-guess commander pairings based on the user's screenshot (Cloud/Tifa, Aerith/Sephiroth, Tidus/Yuna, Y'shtola/G'raha).

    Doctor Who ('who') manifest: 4 entries with deck names only (commanderNames empty arrays — populated when verified against the Scryfall card set).

    Document at the top how to add a new product manifest in 4 lines.
  </action>
  <verify>
    <automated>
      grep -c "^export" src/data/precon-deck-manifests.js
    </automated>
    <expected>2 exports (PRECON_DECK_MANIFESTS + getDeckManifest).</expected>
  </verify>
  <done>
    Manifest infrastructure shipped; FF manifest populated with stub data; future products can be added by appending entries.
  </done>
  <acceptance_criteria>
    - File exists at `src/data/precon-deck-manifests.js`
    - `getDeckManifest('fin')` returns 4 entries
    - `getDeckManifest('UNKNOWN')` returns null
  </acceptance_criteria>
</task>

<task id="2" type="auto">
  <name>Rewrite splitPreconIntoDecks to consume the manifest</name>
  <read_first>
    <file>src/services/precons.js</file>
    <file>tests/precons.test.js</file>
  </read_first>
  <action>
    Import `getDeckManifest` from the manifest module. Rewrite `splitPreconIntoDecks(precon)`:
    - If decklist lacks `color_identity` metadata → return [] (legacy cache).
    - If `getDeckManifest(precon.code)` returns null → return [].
    - For each manifest entry: find commanders in `decklist` whose `name` matches one of `commanderNames` (case-insensitive + smart-quote tolerant — "Y'shtola" must match "Y’shtola").
    - Skip entries with no matched commanders (graceful degradation when cache is partial).
    - Compute union color identity across matched commanders.
    - Pass 2: assign non-commander cards to the FIRST manifest entry whose union identity is a superset of the card's color identity. Cap 99 supporters per deck.
    - Preserve manifest-defined order in the return array.

    Tests in `tests/precons.test.js`:
    - Replace 14-07c describe with 14-07e describe.
    - Cover: legacy cache → []; no manifest → []; manifest matches no commanders → []; full FF stub matches 4 decks; smart-quote tolerance; partial-cache graceful degradation; 99-supporter cap.
  </action>
  <verify>
    <automated>
      npx vitest run tests/precons.test.js
    </automated>
    <expected>20 passed (was 19, +1 due to net difference between 14-07c's 5 tests and 14-07e's 6).</expected>
  </verify>
  <done>
    splitPreconIntoDecks returns the actual WotC decks for Final Fantasy when the cache has metadata. No more 19-mistitled-tiles output.
  </done>
  <acceptance_criteria>
    - `grep -c "getDeckManifest" src/services/precons.js` returns at least 2 (import + call)
    - 6 tests under `Phase 14.07e: splitPreconIntoDecks (manifest-driven)`
    - Smart-quote tolerance test passes
  </acceptance_criteria>
</task>

<task id="3" type="auto">
  <name>Re-add the deck tile grid in precon-browser, keyed on the manifest</name>
  <read_first>
    <file>src/components/precon-browser.js</file>
  </read_first>
  <action>
    `src/components/precon-browser.js` VIEW B:
    - Re-introduce `selectedDeckKey` Alpine state.
    - Re-introduce `manifestDecks`, `hasManifest`, `selectedDeck`, `effectiveDecklist`, `effectiveTitle`, `addAllEffective`, `addButtonLabel`, `addButtonEnabled` getters/methods.
    - When `isBundle && hasManifest && !selectedDeck`: render the tile grid (one tile per manifest deck — name + face commanders + identity badge + card count).
    - Drill-in: click a tile → `selectedDeckKey = deck.key` → decklist preview filters to that deck's cards → ADD ALL adds only that deck via `addCardsFromIds(ids, { label })`.
    - When `isBundle && !hasManifest`: render the 14-07d informational banner + full-bundle ADD ALL flow.
    - Decklist rows template: render unless on a manifest-backed bundle with no deck selected.
    - Back button: when a virtual deck is selected, "BACK TO DECKS" returns to the tile grid; otherwise "BACK TO PRECONS".
  </action>
  <verify>
    <automated>
      grep -nE "selectedDeckKey|manifestDecks|hasManifest|effectiveDecklist|addAllEffective" src/components/precon-browser.js | head
    </automated>
    <expected>Multiple matches; tile-grid template + drill-in state restored.</expected>
  </verify>
  <done>
    Open Final Fantasy Commander → tile grid shows 4 named decks. Click "Revival Trance" → decklist preview filters to that deck's cards. ADD ALL imports only that deck.
  </done>
  <acceptance_criteria>
    - `grep -c "manifestDecks" src/components/precon-browser.js` returns at least 3
    - `grep -c "Pick one of the" src/components/precon-browser.js` returns at least 1 (tile-grid intro copy)
    - `grep -c "MULTI-DECK PRODUCT" src/components/precon-browser.js` returns at least 1 (legacy-fallback banner)
  </acceptance_criteria>
</task>

## Verification

Manifest-backed products (FF) get the per-deck UX the user described. Manifest-empty products (CMM, LTC, AFR, etc. — anything without a deck-name → commanders mapping) keep the 14-07d full-bundle banner + ADD ALL primitive. Adding a new product is appending one entry to `PRECON_DECK_MANIFESTS` — no other code changes needed.

## Deviations

- **FF deck-to-commander mapping is best-guess.** I don't have access to the WotC product page that lists which 2 commanders go with which deck name. The manifest stub puts plausible pairings (Cloud/Tifa = Limit Break; Aerith/Sephiroth = Revival Trance; etc.) — if any pairing is wrong, fix the entry in `precon-deck-manifests.js` and the tile grid updates without other code changes.
- **5 of 6 known multi-deck products have empty `commanderNames` arrays.** Doctor Who, Tales of Middle-earth, Warhammer 40K, Fallout, and Commander Masters need their commander names filled in. Until they're populated, those products stay on the 14-07d full-bundle banner path (graceful degradation: the splitter returns [] when no commanders match).
- **No live UAT for the FF tile grid.** The test asserts the manifest plumbing works against synthetic fixtures. Live verification requires opening the precon browser, hitting REFRESH (which re-fetches the FF cache with 14-07c's metadata fields), and clicking through the tiles.
