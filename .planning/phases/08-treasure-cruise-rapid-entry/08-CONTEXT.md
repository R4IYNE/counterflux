# Phase 8: Treasure Cruise Rapid Entry - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Four distinct collection-entry UX shifts, shipped together so Treasure Cruise goes from "add a card, modal dismisses, add another, modal dismisses again" in v1.0 to a persistent rapid-entry workspace:

1. **LHS persistent add panel (COLLECT-06)** — the centred add-card modal converts to a permanent left-hand-side pop-out; collection grid reflows to the right; adding a card does not dismiss the panel
2. **Commander precon browser (COLLECT-02)** — launch a full-screen browser from the panel, pick a preconstructed product, preview the decklist, one click adds every card to the collection
3. **Paper-printings picker (COLLECT-04)** — selected cards render with a horizontal strip of clickable keyrune set icons; clicking one switches the selected printing; price and identity update live
4. **Polish fixes** — mana cost never renders in the search dropdown (COLLECT-01), thumbnail preview appears in each dropdown row (COLLECT-03), mass-entry terminal gets a visible X close button (COLLECT-05)

**Out of scope:**
- Redesigning the mass-entry terminal beyond the close button (stays modal)
- Moving CSV import into the LHS panel (stays modal)
- Precon products beyond `set_type: commander` and `set_type: duel_deck`
- MTGO/Arena-only printings (paper-only per `games: paper` filter)
- Per-card foil/category toggles during precon add-all
- Any Phase 9+ work (deck editor, Vandalblast, auth, sync)

</domain>

<decisions>
## Implementation Decisions

### LHS persistent add panel (COLLECT-06)
- **D-01:** Panel **pushes** the grid right (no overlay, no splitter). Dedicated workspace feel — the grid reflows into the remaining width. Keeps the "the panel IS the entry surface" mental model.
- **D-02:** Panel width = **360px fixed**. Big enough for thumbnail + name + price + printing strip + QTY/foil/category controls without cramping. Leaves 1200px+ for the grid on a standard 1600px desktop.
- **D-03:** Panel is **open by default** when the user navigates to Treasure Cruise. First-boot open; subsequent state persisted to `localStorage` key `tc_panel_open` (boolean). The panel is the primary entry surface for the screen, so defaulting open matches "rapid entry."
- **D-04:** Mass-entry terminal and CSV import **stay as modals**. COLLECT-06 explicitly moves only the single-card add flow. Both modals are focused task workspaces and don't belong in the persistent side panel. Their launch buttons continue to live in the screen's empty-state + (see D-05) in the LHS panel header.
- **D-04a:** Existing `renderAddCardModal` becomes `renderAddCardPanel` — same state machine, same Alpine x-data, swapped container chrome (drop backdrop, drop fixed-center positioning, add LHS column styling). Collection grid wrapper becomes a flex row: `[panel | grid]`.

### Precon browser (COLLECT-02)
- **D-05:** Launch entry = **button in the LHS panel header** labelled "BROWSE PRECONS". Sits alongside the panel's other affordances (search input at top, mass-entry + CSV shortcuts next to it). Discoverable where users are already looking.
- **D-06:** Browser renders as a **full-screen drawer/modal** (mounted to `document.body` like the existing csv-import-modal pattern). Product tile grid on the left/top, selected decklist on the right/below. Closes to return to Treasure Cruise with the add panel still open.
- **D-07:** Caching strategy = **new Dexie `precons_cache` table + 7-day TTL**. Ship as **Dexie v9** — additive-only schema bump (no PK changes, no data migrations). Shape: `{ code (PK), name, set_type, released_at, image_url, decklist: [{scryfall_id, quantity, is_commander}], updated_at }`. The worker schema (`src/workers/bulk-data.worker.js`) must mirror this declaration even though the worker doesn't touch the table (schema-match requirement).
- **D-08:** "Add all" commits **every card as `category: 'owned'`, `foil: false`**, merging quantities via the existing `addCard` path (`[scryfall_id+foil+category]` composite key already does the right thing). Single undo step covers the whole batch — register one `collection_add_batch` undo entry that inverts the entire set. Toast: `Added {N} cards from {Precon Name} to collection.`
- **D-09:** Precon browser includes `set_type: 'commander'` **AND** `set_type: 'duel_deck'`. Explicitly **excludes** `set_type: 'starter'`. This reverses the STATE.md 2026-04-14 scope call that said "commander only" — the user upgraded the decision during this phase's discussion.
- **D-10:** Decklist **preview is required** before commit. Clicking a precon tile shows the full decklist (scrollable list with thumbnail + name + qty + commander badge) and a single `ADD ALL {N} CARDS` button. No blind add. Cancel returns to the tile grid.
- **D-11:** Cache has **7-day TTL + manual refresh button** in the browser header. "REFRESH" link triggers a forced re-fetch of the precons list (not per-decklist). Escape hatch for users who know a new Commander release just dropped.
- **D-12:** Product tiles sorted by `released_at` **descending** (newest first). Matches "what's new to grab" mental model. Ties broken by product `name` ascending.

### Printing picker (COLLECT-04)
- **D-13:** Renders as a **horizontal strip of keyrune set icons** directly below the selected-card preview (inside the LHS panel). Each icon is a button; clicking switches the selected printing. Icons use existing `<i class="ss ss-{code}"></i>` CSS font pattern already used in the dropdown.
- **D-14:** Default printing on card selection = **most recent paper printing** — highest `released_at` where `games` includes `paper`. Matches "what you'd pull from a pack today." Almost always the cheapest for modern reprints; aligns with the general "rapid, sensible defaults" theme.
- **D-15:** **Show all paper printings, wrap to multiple rows** within the 360px panel width. No truncation, no "More…" link, no horizontal scroll. Old-border staples (Lightning Bolt has 40+ paper printings) display honestly — the user sees the full surface area.
- **D-16:** Icon order = **newest first** (leftmost icon matches the default-pick logic from D-14). Consistent with product sort in D-12.
- **D-17:** Clicking an icon updates the selected-card preview in place — image swaps to the new printing's `image_uris.small`, GBP price recomputes via `currency.eurToGbp`, identity (set code + collector number) re-renders. No modal, no confirmation.
- **D-18:** Printings data source = Scryfall `prints_search_uri` on the selected card, filtered to `games: paper`. Fetched via the existing 75ms-spaced Scryfall queue. Cached in-memory per selected card for the lifetime of the panel (recomputed on card change). No IndexedDB persistence — printings lists are cheap enough to re-fetch.

### Thumbnail in search dropdown (COLLECT-03)
- **D-19:** Thumbnail size = **40px tall** (auto width maintaining card aspect ratio — so ~28.6px wide since Scryfall card aspect is 0.7:1). Row height = 56px (40 + 16 vertical padding). Dropdown max-height stays 280px, so ~5 rows visible before scroll.
- **D-20:** Thumbnail position = **left of the card name**, set icon remains far right. Matches selected-card preview layout (image left, meta right). Row structure: `[thumb] [name] ··· [set icon]`.
- **D-21:** Image source = `image_uris.small` (146×204 PNG). Already present in bulk-data cards. Uses `cf-card-img` utility class for rounded corners (POLISH-04 shared utility).

### Audits (COLLECT-01, COLLECT-05)
- **D-22:** **COLLECT-01** is audit-only. Scout confirmed `renderAddCardModal` lines 147–163 render only `name` + `price` in the selected-card preview (no mana cost) and the search results row renders only `name + set icon` (no mana cost). The audit step in planning re-verifies, and if any mana-cost render sneaks in through the new printing-picker work, it's removed on the spot.
- **D-23:** **COLLECT-05** adds a visible X close button to the `MASS ENTRY TERMINAL` header, wired to the existing `discard()` method (mass-entry-panel.js:80). Icon: Material Symbols `close`. Placement: right-aligned in the header row (mirrors the LHS panel's own close-chevron pattern — D-27). Does not change existing Escape/backdrop-click behaviour.

### Schema migration (Dexie v9)
- **D-24:** Phase 8 introduces **Dexie v9**, additive-only. Declaration:
  ```js
  db.version(9).stores({
    precons_cache: 'code, set_type, released_at, updated_at',
  });
  ```
  No `.upgrade()` callback needed — adding a table with no backfill requirement. Follows PITFALLS.md §1 guidance (always keep prior version declarations, explicit `.stores()` for the new version).
- **D-25:** Migration safety = **reuse Phase 7's pattern** (`src/services/migration.js` `db.on('blocked')` + `db.on('versionchange')` handlers, migration-blocked-modal). No new backup step — v9 is additive; if it fails, no user data is at risk because no existing table is modified. The migration-blocked modal already handles cross-tab coordination.
- **D-26:** Worker schema (`src/workers/bulk-data.worker.js`) bumped to v9 with a matching `precons_cache` declaration even though the worker only touches `cards`/`meta` — schema-match is mandatory per PITFALLS §1.

### Panel header + close affordance
- **D-27:** LHS panel header contains: title (`ADD TO COLLECTION`), `BROWSE PRECONS` button, a chevron (`‹`) close button, and either a `MASS ENTRY` shortcut or a `...` overflow menu for mass/CSV launches (Claude's discretion during planning).
- **D-28:** Closing the panel via the chevron persists `tc_panel_open: false` to localStorage. The collection grid re-expands to full width with CSS transition. A small re-open affordance (icon button) appears at the top-left of the grid when panel is closed.

### Delivery sequencing
- **D-29:** Phase 8 ships as **three plans**, ordered smallest→largest:
  - **Plan 1 — Polish batch** (COLLECT-01 audit + COLLECT-03 thumb + COLLECT-05 X button). Low-risk, land first to warm up.
  - **Plan 2 — LHS panel conversion** (COLLECT-06 + COLLECT-04 printing picker, since the picker lives inside the panel and they share state). Biggest user-facing change.
  - **Plan 3 — Precon browser** (COLLECT-02 + Dexie v9 schema bump + `src/services/precons.js`). Largest net-new code; ships on top of the established LHS panel from Plan 2.

### Claude's Discretion
- Keyboard shortcut for toggling the LHS panel (suggestion: none — the panel's default-open nature means a shortcut is low-value)
- Exact empty-state copy when panel is open but no card selected (Mila line, welcome prompt, etc.)
- Loading skeleton shape for the thumbnail while search debounce + DB lookup run
- Foil-toggle placement inside the panel (keep current checkbox, or relocate near printing strip)
- Hover tooltip wording on printing-strip set icons ("Commander Masters (2023)" vs `CMM • 2023 • £2.40`)
- Decklist-preview layout inside the precon browser (vertical list with inline thumbnails vs compact grid of deck-card-tile components)
- Precon product tile design (box art source: Scryfall product image vs commander art vs set symbol)
- Precon browser close interaction (X button + backdrop + Escape — all three acceptable)
- Panel open/close transition timing (suggestion: 200ms ease-out; match existing sidebar collapse from Phase 7)
- Re-open affordance when panel is collapsed (floating button, persistent edge handle, etc.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §Treasure Cruise — COLLECT-01 through COLLECT-06 full acceptance criteria
- `.planning/ROADMAP.md` §Phase 8 — goal, dependencies, 5 success criteria
- `.planning/PROJECT.md` — v1.1 scope decisions (local-first, Scryfall compliance, Izzet identity)
- `.planning/STATE.md` §Accumulated Context — v1.1 scope + roadmap decisions (note: "commander only" call from 2026-04-14 is superseded by D-09 in this CONTEXT)

### Prior phase (Phase 7 — schema/polish)
- `.planning/phases/07-polish-pass-perf-baseline-schema-migration/07-CONTEXT.md` — v6+v7+v8 schema chain, UUID PK strategy, `cf-card-img` utility, red-accent guidance, migration safety net patterns (reused for v9)
- `.planning/phases/07-polish-pass-perf-baseline-schema-migration/07-03-PLAN.md` — migration orchestrator pattern (reference for v9 additive bump)

### Research (v1.1 Second Sunrise)
- `.planning/research/STACK.md` — Scryfall API patterns (75ms queue, `User-Agent` header), keyrune font usage
- `.planning/research/PITFALLS.md` §1 — Dexie version chain rules (always keep prior declarations, worker mirror requirement, `onblocked`/`versionchange` handlers)
- `.planning/research/FEATURES.md` — v1.1 feature catalogue
- `.planning/research/SUMMARY.md` — synthesis of research docs

### Existing code (v1.0 baseline)
- `src/components/add-card-modal.js` — becomes the LHS panel; 220-line Alpine x-data state machine is retained, container chrome is replaced
- `src/components/mass-entry-panel.js` — COLLECT-05 X close button target; line 80 `discard()` is the wiring point
- `src/screens/treasure-cruise.js` — `mount()` adds LHS column wrapper; lines 31–155 are the screen template that hosts the panel + grid
- `src/stores/collection.js` — `addCard` merge logic (lines 109–135) already handles precon add-all quantity incrementing; `addBatch` (lines 168–180) is the batch primitive
- `src/services/sets.js` — blueprint for `src/services/precons.js` (24h TTL → 7d TTL, `meta` table → dedicated `precons_cache` table)
- `src/db/schema.js` — v1..v8 chain; v9 appends `precons_cache` with no `.upgrade()` callback
- `src/db/search.js` — dropdown source; returns Scryfall-shaped objects with `image_uris.small` already populated
- `src/db/card-accessor.js` — `getCardThumbnail`, `getCardImage`, `getCardName` helpers used by the dropdown
- `src/services/currency.js` — `eurToGbp` used for live price updates on printing change (D-17)
- `src/services/migration.js` — reused for v9 blocked/versionchange handling (no new backup needed)
- `src/workers/bulk-data.worker.js` — v9 mirror declaration required
- `src/components/csv-import-modal.js` — reference for full-screen drawer mount pattern (treasure-cruise.js:157–169)
- `src/components/migration-blocked-modal.js` — reference vanilla-DOM modal pattern
- `src/components/toast.js` — toast pattern for "Added N cards from {Precon}"
- `src/utils/connectivity.js` + `src/components/topbar.js` — unaffected but consulted for LIVE chip coexistence

### External documentation
- Scryfall API — `/sets` endpoint with `set_type: commander` + `set_type: duel_deck` filter (https://scryfall.com/docs/api/sets)
- Scryfall API — product decklist endpoint (https://scryfall.com/docs/api/decks) — exact shape to be confirmed by researcher; fallback is `search?q=set:{code}` if product decklists aren't directly exposed
- Scryfall API — `prints_search_uri` field on Card objects, filtered by `game:paper` query param (https://scryfall.com/docs/api/cards)
- keyrune CSS font — set icon class convention (`ss ss-{code}`) already in use throughout the app

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/components/add-card-modal.js`** — Alpine x-data state machine (searchQuery, searchResults, selectedCard, quantity, foil, category, doSearch, selectCard, addToCollection, reset, close) ports directly to the LHS panel. Only chrome changes.
- **`src/stores/collection.js` `addCard`** — already merges on `[scryfall_id+foil+category]` composite; precon add-all gets free quantity merging with zero new logic. `addBatch` wraps it for the batch flow.
- **`src/services/sets.js`** — perfect blueprint for `src/services/precons.js`: `fetchSets()` pattern with IndexedDB cache, TTL check, fallback to stale cache on 4xx/5xx, memory cache layer. Copy the shape, swap the TTL (24h → 7d) and the target table.
- **`src/components/csv-import-modal.js` + treasure-cruise.js mount pattern** — full-screen modal mounted to `document.body` with Alpine `initTree` is the template for the precon browser.
- **keyrune CSS font** — already loaded; `ss ss-{code}` works out of the box for printing-picker icons and precon product tiles.
- **`cf-card-img` utility class** — rounded-corner card image styling (Phase 7 POLISH-04). Reuse on dropdown thumbs + selected-card preview.
- **`src/services/currency.js` `eurToGbp`** — live price recomputation on printing change. Exposed via `window.__cf_eurToGbp` in the add-card-modal today.
- **`meta` key/value table** — available for any small precons-related pointers (e.g., `precons_last_refresh`) if the dedicated table feels too heavy for a top-level TTL stamp.
- **Toast system** (`$store.toast.success`) — already used on add/remove; extends cleanly to batch-add messaging.

### Established Patterns
- **Dexie additive version bump** — PITFALLS §1: always keep all prior `version()` declarations, explicit `.stores()` for the new version. No `.upgrade()` callback needed when adding a table with no backfill.
- **Worker schema mirror** — every schema change must also update `src/workers/bulk-data.worker.js` even if the worker doesn't touch the new table.
- **Alpine store-per-domain** — Phase 8 extends the existing `collection` store with new state (`panelOpen`, `preconBrowserOpen`, `selectedPrintingsByCard`, etc.) rather than spinning up a new store.
- **75ms-spaced Scryfall queue** — `prints_search_uri` fetches go through the existing queue; precon list + decklist fetches use the same rate limit to stay compliant.
- **localStorage for UI prefs** — `sidebar_collapsed` (Phase 7) established the pattern; `tc_panel_open` follows the same shape.
- **Modal-mount-to-body** — `treasure-cruise.js:157` appends a `#tc-modals` container with `Alpine.initTree`; precon browser gets the same treatment.
- **Optimistic + undo** — `collection.deleteEntry` pushes an undo; precon add-all batch follows the same pattern (one undo entry inverts the full batch).

### Integration Points
- **`src/screens/treasure-cruise.js` `mount()`** — the screen template becomes a horizontal flex: `[LHS panel column | collection grid column]`. The existing empty-state + modals stay in the grid column.
- **`src/stores/collection.js`** — new state fields; no new methods needed for COLLECT-06 (the panel reuses `addCard`). New methods required for precon flow: `loadPrecons()`, `selectPrecon(code)`, `addAllFromPrecon(code, category='owned')`.
- **`src/db/schema.js`** — v9 declaration appended at the bottom; creating-hook chain untouched (precons_cache uses string PK `code`, no hook needed).
- **`src/workers/bulk-data.worker.js`** — v9 mirror declaration.
- **`src/services/precons.js`** — new file. Public API: `fetchPrecons(options)`, `fetchPreconDecklist(code)`, `getCachedPrecons()`, `invalidatePreconsCache()`.
- **`src/components/add-card-panel.js`** — replaces `add-card-modal.js` (file rename + chrome swap; state machine intact). The treasure-cruise.js import site updates.
- **`src/components/precon-browser.js`** — new file, mirror csv-import-modal.js pattern.
- **`src/components/printing-picker.js`** — new file, or inlined x-template within `add-card-panel.js` (Claude's discretion — if <80 lines, inline; else extract).
- **`index.html` / `src/app.js`** — no changes expected.
- **`package.json`** — no new dependencies (keyrune, mana-font, Alpine, Dexie all installed).

</code_context>

<specifics>
## Specific Ideas

- **The panel *is* the entry surface** — panel open by default, persists across adds, grid reflows around it. User wants collection entry to feel like a dedicated workbench, not a task popup.
- **One-time decision reversal on set_type scope** — user upgraded precon scope from "commander only" (STATE.md 2026-04-14) to "commander + duel_deck" (D-09 here). Starter decks stay deferred to v1.2+. Planner + researcher should treat D-09 as authoritative.
- **Precon cache gets its own table, not the meta bucket** — keeps decklists structured and queryable (e.g., "show me all commander precons containing Sol Ring"). The extra schema bump is cheap; meta-table blob storage would throw that optionality away.
- **Show all printings, don't truncate** — honest UX beats tidy. User sees the full surface area of a card's printing history; that IS the value of the feature.
- **Newest-first everywhere** — default printing pick, printing icon order, precon product order all agree. One mental model.
- **Audit-only + small-polish items ship first** — Plan 1 is the "warm up the area" pass; biggest change (LHS panel) lands in Plan 2 on a thoroughly-touched file set.
- **Dexie v9 is additive-only** — no migration drama, no backup pattern needed. Frees the researcher + planner to focus on the feature surface.
- **Preview before commit on add-all** — 100 cards is too many to blind-add; the decklist preview is the "are you sure" step disguised as a useful view.
- **Reuse the Phase 7 pattern for printing strip UX** — red-accent surfaces, Syne/Space Grotesk/JetBrains Mono tiering, 8-point spacing, keyrune icons are all already in flight.

</specifics>

<deferred>
## Deferred Ideas

- **Split-pane resizable LHS panel** — considered, rejected in favour of fixed 360px for v1.1. Revisit if users report the width feels wrong.
- **Overlay-style LHS panel with glass backdrop** — rejected; push-grid feels more like a workbench than a floating accessory.
- **Tabbed LHS panel with mass-entry + CSV nested inside** — rejected; those flows are focused tasks that earn a modal. Reconsider if the three entry surfaces start to feel fragmented.
- **Per-card foil/category toggles during precon add-all** — rejected; fights "rapid entry." Users who want precise control can mass-entry the decklist after.
- **Fetch-on-demand precon data (no cache)** — rejected; decklists are expensive to re-fetch, and the rate-limited queue would stutter on browse.
- **Full-size card hover-preview on dropdown thumbs** — rejected for this phase; nice-to-have that earns its own discussion if users ask.
- **Starter-deck (`set_type: starter`) precons** — deferred to v1.2+ (pre-1999 fixed products have inconsistent decklist data on Scryfall).
- **MTGO/Arena printings in the picker** — out of scope per `games: paper` filter; v1.2+ if ever.
- **Keyboard shortcut for panel toggle** — left to Claude's discretion in planning; user didn't want to lock this.
- **Grouped-by-parent-set precon layout** — rejected; newest-first flat grid is simpler and matches user mental model.
- **Commander-identity extraction from precon decklist for post-add deck auto-build** — not requested; precon add populates the collection, not a deck. User may ask for this later as a dedicated phase.

</deferred>

---

*Phase: 08-treasure-cruise-rapid-entry*
*Context gathered: 2026-04-15*
