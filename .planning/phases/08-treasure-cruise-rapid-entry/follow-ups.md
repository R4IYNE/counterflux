# Phase 8 — Follow-up Polish Items

User-reported items from the Phase 8 human-UAT walkthrough on 2026-04-16. Phase 8 itself is **complete and approved** — these items are out-of-scope refinements captured for a future polish phase (suggested: `/gsd:add-phase` as Phase 8.1, or fold into Phase 9).

## Items

### 1. Add-card panel — search results dropdown scroll cutoff
**Reported:** 2026-04-16 (with screenshot showing LIGHTNING search)
**Symptom:** Dropdown shows results (e.g. Lightning Angel, Lightning Axe) plus a vertical scrollbar, but content below the visible rows is clipped by the LHS panel's bounding box. The scrollbar suggests more results exist but they're inaccessible.
**Likely fix area:** `src/components/add-card-panel.js` dropdown container CSS — needs `max-height` + `overflow-y: auto` scoped to the dropdown itself rather than relying on the panel-level scroll.
**Risk:** Low — pure CSS / layout fix.

### 2. Collapsed-state expand affordance too subtle
**Reported:** 2026-04-16
**Symptom:** When the LHS panel is collapsed, the `chevron_right` re-open button at the top-left of the grid is hard to find. Users may not realise the panel can be re-opened.
**Likely fix area:** `src/screens/treasure-cruise.js` re-open button styling — make it brighter (primary accent vs ghost), larger (32px → 48px), or pair with a label like "OPEN PANEL".
**Risk:** Low — styling change only.

### 3. Collection grid — hover-checkbox edit affordance
**Reported:** 2026-04-16
**Symptom:** The collection grid currently exposes quick-actions only via right-click context menu. User wants a hover-revealed checkbox on each card tile that opens the same quick-action menu.
**Likely fix area:** Card-tile component in the collection grid (Treasure Cruise screen). Needs the existing context-menu to be wired to a checkbox click handler too.
**Risk:** Medium — touches the card-tile rendering across the collection grid; needs care for keyboard / a11y.

### 4. Precon browser — specific commander decks not pulling in
**Reported:** 2026-04-16
**Symptom:** Certain commander precons are either missing from the tile grid or fail to load their decklists when clicked.
**Status:** DIAGNOSED — see debug session at [.planning/debug/precon-browser-missing-commander-decks.md](../../debug/precon-browser-missing-commander-decks.md)

**Two compounding root causes confirmed:**

**Cause 1 — whitelist too narrow.** `PRECON_SET_TYPES = ['commander', 'duel_deck']` at `src/services/precons.js:23` silently excludes 9+ set_types that contain real WotC Commander products: `masters` (Commander Masters `cmm`), `draft_innovation` (Commander Legends `cmr`/`clb`), `planechase`, `archenemy`, `premium_deck`, `arsenal`, `box` (Game Night), `from_the_vault`, `promo`.

**Cause 2 — Scryfall `set` ≠ "one decklist".** Modern multi-deck Commander products (Doctor Who 4-deck bundle, Fallout, Warhammer 40K, Tales of Middle-earth, all C20+ Commander products) load as 400–1000+ card "decklists" mixing all bundled decks. Scryfall has no deck-membership metadata.

**Recommended fix path (3 tiers, full detail in debug file):**
- **Tier A** — minimal code-level allowlist of confirmed-precon set codes (~30 min, low risk)
- **Tier B** — A + decklist size guard renders "multi-deck product, open in Scryfall" instead of dumping 1000-card list (~2-3 hr, medium risk)
- **Tier C** — hand-curated `src/data/precon-decks.js` deck-membership map (~6-10 hr, warrants its own phase)

**Recommendation:** Land **A+B together** in Phase 8.1 polish (do NOT land A alone — exposes the multi-deck UX problem more visibly). Defer Tier C to its own future phase (Phase 8.2 or a Treasure Cruise polish phase). RESEARCH.md §5 already deferred curated deck membership to v1.2.

### 5. Add-to-collection — browse by set + faceted filtering
**Reported:** 2026-04-16
**Scope:** Extend the LHS panel with two browsing modes:
- **Browse by set:** Tile grid of all sets (similar to precon browser), click → filter dropdown to that set's cards.
- **Faceted filters:** Mana cost, card type, colour identity, rarity. Could also include CMC range and keyword filters.
**Likely fix area:** New tab in the LHS panel header (alongside BROWSE PRECONS / MASS ENTRY), new component `src/components/browse-by-set.js`, store extension in `src/stores/collection.js`.
**Risk:** Medium-high — net-new feature with its own UI surface; warrants its own plan.

## Suggested next step

`/gsd:add-phase` to insert a Phase 8.1 polish pass (low-risk items 1+2 land first, then items 3-5 as additional plans), OR fold into Phase 9 scope discussion via `/gsd:discuss-phase 9`.
