---
plan: 14-07d
phase: 14
status: complete
completed: 2026-04-27
type: gap_closure
---

# Plan 14-07d Summary — Revert the multi-deck bundle gate

## What was done

Three changes:

1. **`src/stores/collection.js`** — removed the `if (isMultiDeckBundle(precon)) return;` early-return from `addAllFromPrecon`. Multi-deck Commander products (Doctor Who, Final Fantasy, Tales of Middle-earth, Warhammer 40K, Fallout, Commander Masters) now add their entire decklist when the user clicks ADD ALL. Comment block replaced with a pointer to this plan's rationale. `isMultiDeckBundle` removed from the import list since the gate is the only thing that referenced it here.

2. **`src/components/precon-browser.js`** — reverted VIEW B to the pre-14-07c shape: single x-data scope (`precon`, `isBundle`, `sortedDecklist`, `cardName`), single decklist preview, single ADD ALL button. Removed:
   - All 14-07c virtual-deck state (`selectedVirtualDeckKey`, `virtualDecks`, `selectedVirtualDeck`, `effectiveDecklist`, `effectiveTitle`, `effectiveAddAllEnabled`, `addAllEffective`).
   - The 14-07c virtual-deck tile grid template.
   - The legacy 4B MULTI-DECK PRODUCT centred-warning template (with the Scryfall link).
   Replaced with a small inline informational banner above the decklist that fires when `isBundle`: "MULTI-DECK PRODUCT — This boxed set bundles multiple decks. ADD ALL imports every card from every deck — only do this if you own the whole product." The banner is informational, not a gate.

3. **`tests/collection.precon.test.js`** — replaced the 5-test FOLLOWUP-4B describe (which asserted bundle ADD ALL was a no-op) with a 5-test 14-07d describe asserting the inverse: bundle ADD ALL writes all 250 fixture rows, fires the exact success toast with the full count, registers one undo entry, calls `loadEntries` exactly once, and closes the browser. Banner-render assertion updated for the new banner copy ("bundles multiple decks").

## Why

Three iterations on the multi-deck bundle UX failed to land the user's actual intent. The user clarified after seeing 14-07c's tile grid: "Browse precons feature is to import ENTIRE card selection from commander precons into collection — if I own a precon I can mark it as owned and those cards are now correctly listed in my collection."

Splitting was hostile to that flow because Scryfall doesn't expose deck-membership metadata. The 14-07c heuristic produced 19 tiny tiles for Final Fantasy Commander (one per legendary creature in the set, not the 4 actual decks). Worse, it labelled them "8 commanders / 25 commanders" — those numbers were card counts mis-rendered as commander counts.

Full ADD ALL is the right primitive: the user owns the boxed product → all cards in the box land. The banner makes the "this is a bundle" warning explicit so accidental bulk adds aren't unsignalled.

## Status

**Complete.** 12/12 collection-precon tests passing. 86/86 across all Phase 14 plan-targeted suites.

## Files touched

- `src/stores/collection.js` — guard removed (-15 lines for guard, +6 lines for new comment), `isMultiDeckBundle` import dropped
- `src/components/precon-browser.js` — VIEW B reverted (-95 lines virtual-deck state, -22 lines legacy gate, +9 lines banner)
- `tests/collection.precon.test.js` — FOLLOWUP-4B describe replaced with 14-07d describe (5 tests, inverted semantics) + banner-render assertion updated

## Self-Check

- [x] Bundle ADD ALL adds full decklist (verified by Test D1 — 250 rows for the bundle fixture)
- [x] Toast count is honest (Test D2 asserts "Added 250 cards from Multi-Deck Bundle Product to collection.")
- [x] Single undo entry covers the whole batch (Test D3)
- [x] `loadEntries` called once (Pitfall 2 still honoured, Test D4)
- [x] Browser closes after add (Test D5 — same UX as non-bundle precons)
- [x] Banner still informs the user that this is a multi-deck product
- [x] 14-07c helpers (`splitPreconIntoDecks`, `addCardsFromIds`) preserved + tested in case v1.2 wants per-deck filtering as an opt-in

## Deviations

- **`splitPreconIntoDecks` + `addCardsFromIds` kept in tree, unused.** Adding both took ~150 lines. Removing them means re-deriving them later if v1.2 wants per-deck filtering. Keeping them as dead code with tests makes that a 1-template-add follow-up rather than a 1-feature-rebuild.
- **No live UAT against a real bundle product.** The user can verify by REFRESHing the precon cache, opening Final Fantasy Commander, and clicking ADD ALL — should see the full ~486 cards land. Banner above decklist makes the bundle status visible.
