---
plan: 14-07d
phase: 14
type: gap_closure
wave: 1
depends_on: [14-07c]
requirements: [COLLECT-02]
files_modified:
  - src/stores/collection.js
  - src/components/precon-browser.js
  - tests/collection.precon.test.js
autonomous: true
gap_closure: true
must_haves:
  - addAllFromPrecon() commits the full decklist for every precon, including multi-deck bundles
  - Multi-deck status surfaces as an inline informational banner above the decklist (no longer gates ADD ALL)
  - The legacy MULTI-DECK PRODUCT empty-state template (warning + Scryfall link) is removed; its purpose was to gate the action, which is no longer correct
  - Tests assert the new behaviour: bundle ADD ALL writes all rows, fires the success toast, registers one undo, calls loadEntries once, and closes the browser
---

# Plan 14-07d: Revert the multi-deck bundle gate; let ADD ALL import the whole boxed product

## Context

Three iterations on the multi-deck bundle UX (Doctor Who, Final Fantasy, Tales of Middle-earth, Warhammer 40K, Fallout, Commander Masters):

- **08.1 FOLLOWUP-4B** — original guard. ADD ALL silently no-op'd on bundles, browser surfaced a "MULTI-DECK PRODUCT" warning. Reasoning: a user with one deck shouldn't accidentally add all 1178 Doctor Who cards.
- **14-07c** — bundle splitter. Tried to break a bundle into virtual decks via the commander-color-identity heuristic. Tile grid in VIEW B; click a tile → see that deck's cards → ADD ALL adds only that deck.
- **User feedback after 14-07c shipped:** "Browse precons feature is to import ENTIRE card selection from commander precons into collection — if I own a precon I can mark it as owned and those cards are now correctly listed in my collection." Plus visible UX bugs from the splitter (Final Fantasy split into 19 tiny tiles labelled by every legendary creature in the set instead of the 4 actual decks).

The user intent for browse-precons is "I own this boxed product → mark it owned." For Final Fantasy Commander, that means all ~486 cards land. Splitting is hostile to that flow because Scryfall doesn't expose deck-membership metadata — every heuristic is approximate, and approximate is worse than full-fidelity for the "I own the box" use case.

## Tasks

<task id="1" type="auto">
  <name>Drop the bundle guard from addAllFromPrecon</name>
  <read_first>
    <file>src/stores/collection.js</file>
    <file>tests/collection.precon.test.js</file>
  </read_first>
  <action>
    `src/stores/collection.js`:
    - Remove the `if (isMultiDeckBundle(precon)) return;` early-return block from `addAllFromPrecon`.
    - Remove `isMultiDeckBundle` from the import list (the helper is still exported from `precons.js` and used by the precon-browser banner condition).
    - Replace the deleted block with a comment pointer to this plan so future readers see the rationale.

    Tests in `tests/collection.precon.test.js`:
    - Replace the FOLLOWUP-4B describe (5 tests asserting the early-return semantics) with a 14-07d describe asserting the inverse: bundle ADD ALL writes all 250 rows, fires the success toast with the full count, registers one undo entry, calls loadEntries exactly once, and closes the browser.
  </action>
  <verify>
    <automated>
      npx vitest run tests/collection.precon.test.js
    </automated>
    <expected>12 passed (was 13; net -1 — replaces 5 4B-guard tests with 5 14-07d post-revert tests, plus the banner-render assertion).</expected>
  </verify>
  <done>
    Multi-deck bundles add their full decklist via ADD ALL.
  </done>
  <acceptance_criteria>
    - `grep -c "isMultiDeckBundle" src/stores/collection.js` returns 0
    - `grep -c "Phase 14.07d" src/stores/collection.js` returns at least 1 (rationale comment)
    - 5 tests under `Phase 14.07d: addAllFromPrecon multi-deck bundle (post-revert behaviour)`
  </acceptance_criteria>
</task>

<task id="2" type="auto">
  <name>Replace the gate UI with an informational banner</name>
  <read_first>
    <file>src/components/precon-browser.js</file>
  </read_first>
  <action>
    `src/components/precon-browser.js`:
    - Revert VIEW B's x-data scope to the pre-14-07c shape (`precon`, `isBundle`, `sortedDecklist`, `cardName`). Drop the virtual-deck state (`selectedVirtualDeckKey`, `virtualDecks`, `effectiveDecklist`, etc.).
    - Replace the virtual-deck tile grid template with a small info banner that fires when `isBundle`: "MULTI-DECK PRODUCT — This boxed set bundles multiple decks. ADD ALL imports every card from every deck — only do this if you own the whole product." Banner sits above the decklist render.
    - Remove the legacy MULTI-DECK PRODUCT empty-state template (the centred warning + Scryfall link block that replaced the decklist).
    - The decklist render reverts to using `precon?.decklist` (no more `effectiveDecklist`); ADD ALL button reverts to calling `addAllFromPrecon` directly.
    - Banner-render test in `tests/collection.precon.test.js` asserts the banner copy is present.
  </action>
  <verify>
    <automated>
      grep -c "selectedVirtualDeckKey\|virtualDecks\|effectiveDecklist" src/components/precon-browser.js
    </automated>
    <expected>0 (all virtual-deck state removed).</expected>
  </verify>
  <done>
    Browse Precons shows a single decklist preview per product, with a banner on bundles. ADD ALL works on every product.
  </done>
  <acceptance_criteria>
    - `grep -c "MULTI-DECK PRODUCT" src/components/precon-browser.js` returns at least 1 (banner header)
    - `grep -c "bundles multiple decks" src/components/precon-browser.js` returns at least 1 (banner body)
    - `grep -c "selectedVirtualDeckKey" src/components/precon-browser.js` returns 0 (no tile-grid state left)
    - Banner-render test passes
  </acceptance_criteria>
</task>

## Verification

The revert is purely subtractive. The bundle splitter helper (`splitPreconIntoDecks`) and the per-card-id add helper (`addCardsFromIds`) stay in place — they're well-tested and may be useful for v1.2 features (per-deck filtering, deck builder import, etc.) — but they're not wired anywhere in the live UI.

## Deviations

- **`splitPreconIntoDecks` and `addCardsFromIds` left in tree but unused.** Both are still exported and tested. Keeping them makes the v1.2 "filter to one deck inside a bundle" follow-up a 1-template-add rather than a 1-feature-rebuild.
- **`isMultiDeckBundle` still imported by precon-browser.js** (for the banner condition). Removed only from `collection.js` since the gate is gone there.
