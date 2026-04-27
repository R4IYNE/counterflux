---
plan: 14-07e
phase: 14
status: complete
completed: 2026-04-27
type: gap_closure
---

# Plan 14-07e Summary — Manifest-driven multi-deck precon split

## What was built

### 1. `src/data/precon-deck-manifests.js`

New module with two exports:

- `PRECON_DECK_MANIFESTS` — object keyed by Scryfall set code (lowercase). Each value is `[{ name, commanderNames }]` listing the WotC product's individual decks + their face commander names.
- `getDeckManifest(code)` — case-insensitive lookup helper.

Final Fantasy ('fin') manifest populated with 4 decks based on public WotC product info:
- **Limit Break** — Cloud, Ex-SOLDIER + Tifa, Martial Artist
- **Revival Trance** — Aerith, Last Ancient + Sephiroth, Fabled SOLDIER
- **Counter Blow** — Tidus, Yuna's Guardian + Yuna, Grand Summoner
- **Scions & Spellcraft** — Y'shtola, Night's Blessed + G'raha Tia, Scion Reborn

Doctor Who ('who') manifest populated with deck names only (4 entries with empty `commanderNames` arrays — needs commander names populated against the actual Scryfall card set).

### 2. `splitPreconIntoDecks` rewrite

Now manifest-driven instead of pure-heuristic (the 14-07c approach that produced 19 tiny mis-titled tiles for Final Fantasy because every legendary creature got grouped by color identity).

Flow:
1. Bail with `[]` if decklist lacks `color_identity` metadata (legacy cache).
2. Bail with `[]` if no manifest entry for `precon.code` (caller falls back to the 14-07d full-bundle banner).
3. For each manifest entry: find commanders by `name` (case-insensitive, smart-quote tolerant — "Y'shtola" matches "Y’shtola"). Compute union color identity.
4. Skip entries whose commanders aren't in the cache yet (graceful degradation when cache is partial).
5. Pass 2: assign non-commander cards to the FIRST manifest entry whose union identity is a superset of the card's color identity. Cap 99 supporters per deck (Commander format).
6. Return decks in manifest-defined order (matches the WotC product ordering).

### 3. Precon-browser tile grid

VIEW B in `src/components/precon-browser.js`:
- New x-data state: `selectedDeckKey` + 8 getters/methods (`manifestDecks`, `hasManifest`, `selectedDeck`, `effectiveDecklist`, `effectiveTitle`, `addAllEffective`, `addButtonLabel`, `addButtonEnabled`).
- Manifest-backed bundles render a tile grid: 1 tile per WotC deck, showing deck name + identity badge + card count + face commanders.
- Drill-in: click a tile → preview filters to that deck → ADD ALL adds only that deck via `addCardsFromIds(ids, { label })`.
- Bundles WITHOUT a manifest entry keep the 14-07d informational banner + full-bundle ADD ALL flow.
- Back button label flips: "BACK TO DECKS" when a deck is drilled into; "BACK TO PRECONS" otherwise.

## Status

**Complete.** 32/32 precon-related tests passing (20 precons + 12 collection-precon). 87/87 across all Phase 14 plan-targeted suites.

## Files touched

- `src/data/precon-deck-manifests.js` — NEW (~70 lines incl. usage docs + 2 stubbed manifests)
- `src/services/precons.js` — `splitPreconIntoDecks` rewritten manifest-first (~95 lines net change)
- `src/components/precon-browser.js` — VIEW B re-introduces tile grid + drill-in state (~90 lines incl. fallback banner)
- `tests/precons.test.js` — 14-07c describe replaced with 14-07e describe (6 tests covering the manifest path, smart-quote tolerance, graceful degradation, 99-cap)

## Self-Check

- [x] FF manifest entries match the user's screenshot commanders
- [x] Smart-quote tolerance (curly apostrophe ↔ straight) verified by test
- [x] Graceful degradation when cache lacks some commanders (deck skipped, others rendered)
- [x] 99-supporter cap honoured (Commander format)
- [x] Manifest-defined deck order preserved in output
- [x] Bundles without a manifest still get the 14-07d banner + full ADD ALL
- [x] addCardsFromIds wires the per-deck add path (label = "FF Commander — Limit Break")
- [x] 87/87 plan-targeted Phase 14 tests passing across 8 test files

## Deviations

- **FF deck-to-commander pairings are best-guess from public product info.** I don't have access to the WotC product page that lists exact pairings. If any pairing is wrong, fix the entry in `precon-deck-manifests.js` and the tile grid updates without other code changes.
- **5 of 6 known multi-deck products lack `commanderNames`.** Only FF is fully populated. Doctor Who has deck names but empty commander arrays — needs follow-up to verify against the Scryfall card data. CMM / LTC / 40K / Fallout / TOtME aren't listed in the manifest yet — they fall back to the 14-07d full-bundle banner path until added.
- **No live UAT.** Verification is via test fixtures. Live UAT requires hitting REFRESH on the FF cache (so the new metadata fields populate) and clicking through the tile grid.
