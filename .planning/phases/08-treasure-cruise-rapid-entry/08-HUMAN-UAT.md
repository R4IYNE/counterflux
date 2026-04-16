---
status: partial
phase: 08-treasure-cruise-rapid-entry
source: [08-VERIFICATION.md]
started: 2026-04-16T10:45:00Z
updated: 2026-04-16T10:45:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Visual layout — LHS panel pushes grid, not overlay
expected: Navigate to Treasure Cruise in `npm run dev`. Collection grid content starts at x=360px (not obscured by a floating overlay). Panel is a permanent left-hand column with border-right; grid fills the remaining width.
result: [pending]

### 2. Panel stays open after adding a card
expected: Open Treasure Cruise, type a card name in the LHS panel search, select a result, click ADD CARD. Panel remains visible, search input refocuses, QTY resets to 1, selectedCard clears, toast appears. Panel DOES NOT close. Repeat add 2-3 cards without dismissing the panel.
result: [pending]

### 3. Chevron close + re-open affordance + grid reflow animation
expected: Click the chevron_left close button in the panel header. Panel slides out with ~200ms ease-out transition; grid reflows to full width. A chevron_right button appears at the top-left of the grid. Click that chevron_right button; panel slides back in. Reload the page; panel-open state persists per `localStorage.tc_panel_open`.
result: [pending]

### 4. Precon browser full-screen drawer + decklist preview + one-click add-all
expected: Click BROWSE PRECONS in the panel header. A full-screen drawer (90vw × 90vh) with dark scrim opens. Tile grid shows commander + duel_deck products, newest-first, each tile ≈240×336 with SET TYPE badge top-left and NAME/CODE/YEAR strip bottom. Click a tile; decklist preview loads (commander row sorted to top with workspace_premium badge). Click ADD ALL {N} CARDS; one toast fires with exact string `Added {N} cards from {Precon Name} to collection.`; drawer closes and panel remains open.
result: [pending]

### 5. Printing strip live-swap on click
expected: Select a heavily-reprinted card (e.g. 'Lightning Bolt'). A horizontal strip of keyrune set icons appears below the selected-card preview, wrapping into multiple rows within the 360px panel. Newest printing is leftmost and active (bg-primary + blue glow). Click a different icon: selected-card image, set code, collector number, and GBP price all update in place with no page reload. No mana cost is rendered anywhere in the panel.
result: [pending]

### 6. Mass entry X close button visible and wired to discard()
expected: Click MASS ENTRY in the panel. Header 'MASS ENTRY TERMINAL' is visible; a 32×32 X icon is right-aligned in the header. Type some rubbish into the textarea; click the X. The existing `confirm('Discard N unparsed entries?')` browser prompt appears. Click OK; the modal closes without committing to the collection.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
