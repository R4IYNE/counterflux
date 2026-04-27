# Phase 8: Treasure Cruise Rapid Entry - Research

**Researched:** 2026-04-15
**Domain:** Scryfall precon/printings integration, Alpine panel conversion, additive Dexie v9 bump, keyrune icon coverage
**Confidence:** HIGH (Scryfall endpoints, Dexie pattern, existing code paths) / MEDIUM (keyrune fallback coverage, Scryfall decklist endpoint absence)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**LHS persistent add panel (COLLECT-06)**
- **D-01:** Panel pushes the grid right (no overlay, no splitter). Dedicated workspace feel.
- **D-02:** Panel width = 360px fixed.
- **D-03:** Panel is open by default when user navigates to Treasure Cruise. First-boot open; subsequent state persisted to `localStorage` key `tc_panel_open` (boolean).
- **D-04:** Mass-entry terminal and CSV import stay as modals.
- **D-04a:** Existing `renderAddCardModal` becomes `renderAddCardPanel` — same state machine, same Alpine x-data, swapped container chrome. Collection grid wrapper becomes a flex row: `[panel | grid]`.

**Precon browser (COLLECT-02)**
- **D-05:** Launch entry = button in the LHS panel header labelled "BROWSE PRECONS".
- **D-06:** Browser renders as a full-screen drawer/modal (mounted to `document.body` like existing csv-import-modal pattern). Product tile grid on left/top, selected decklist on right/below. Closes to return to Treasure Cruise with the add panel still open.
- **D-07:** Caching = new Dexie `precons_cache` table + 7-day TTL. Ships as Dexie v9 — additive-only schema bump (no PK changes, no data migrations). Shape: `{ code (PK), name, set_type, released_at, image_url, decklist: [{scryfall_id, quantity, is_commander}], updated_at }`. Worker schema must mirror.
- **D-08:** "Add all" commits every card as `category: 'owned'`, `foil: false`, merging quantities via existing `addCard` path. Single undo step covers whole batch — register one `collection_add_batch` undo entry that inverts the entire set. Toast: `Added {N} cards from {Precon Name} to collection.`
- **D-09:** Precon browser includes `set_type: 'commander'` AND `set_type: 'duel_deck'`. Explicitly excludes `set_type: 'starter'`. Reverses STATE.md 2026-04-14 call (commander only) — user upgraded decision during this phase's discussion.
- **D-10:** Decklist preview is required before commit. Clicking a precon tile shows full decklist (scrollable list with thumbnail + name + qty + commander badge) and a single `ADD ALL {N} CARDS` button. No blind add. Cancel returns to tile grid.
- **D-11:** Cache has 7-day TTL + manual refresh button in browser header.
- **D-12:** Product tiles sorted by `released_at` DESC (newest first). Ties broken by product `name` ASC.

**Printing picker (COLLECT-04)**
- **D-13:** Horizontal strip of keyrune set icons directly below the selected-card preview (inside the LHS panel).
- **D-14:** Default printing on card selection = most recent paper printing — highest `released_at` where `games` includes `paper`.
- **D-15:** Show all paper printings, wrap to multiple rows within the 360px panel width. No truncation, no "More…" link, no horizontal scroll.
- **D-16:** Icon order = newest first.
- **D-17:** Clicking an icon updates selected-card preview in place — image swaps to new printing's `image_uris.small`, GBP price recomputes via `currency.eurToGbp`, identity (set code + collector number) re-renders.
- **D-18:** Printings data source = Scryfall `prints_search_uri` on the selected card, filtered to `games: paper`. Fetched via the 75ms-spaced Scryfall queue. Cached in-memory per selected card for the lifetime of the panel (recomputed on card change). No IndexedDB persistence.

**Thumbnail in search dropdown (COLLECT-03)**
- **D-19:** Thumbnail 40px tall (auto width, ~28.6px wide). Row height = 56px. Dropdown max-height stays 280px.
- **D-20:** Thumbnail position = left of the card name, set icon remains far right. `[thumb] [name] ··· [set icon]`.
- **D-21:** Image source = `image_uris.small`. Uses `cf-card-img` utility class.

**Audits (COLLECT-01, COLLECT-05)**
- **D-22:** COLLECT-01 is audit-only. Search results render only `name + set icon` today — re-verify and remove any mana-cost regression introduced by new printing-picker work.
- **D-23:** COLLECT-05 adds a visible X close button to `MASS ENTRY TERMINAL` header, wired to existing `discard()` method. Icon: Material Symbols `close`. Right-aligned in header row.

**Schema migration (Dexie v9)**
- **D-24:** Dexie v9, additive-only: `db.version(9).stores({ precons_cache: 'code, set_type, released_at, updated_at' });`. No `.upgrade()` callback needed.
- **D-25:** Migration safety = reuse Phase 7's pattern. No new backup step — v9 is additive.
- **D-26:** Worker schema (`src/workers/bulk-data.worker.js`) bumped to v9 with matching `precons_cache` declaration.

**Panel header + close affordance**
- **D-27:** LHS panel header contains: title (`ADD TO COLLECTION`), `BROWSE PRECONS` button, chevron (`‹`) close button, and either a `MASS ENTRY` shortcut or a `...` overflow menu (Claude's discretion during planning).
- **D-28:** Closing the panel via chevron persists `tc_panel_open: false` to localStorage. Grid re-expands with CSS transition. Re-open affordance (icon button) at top-left of grid when panel closed.

**Delivery sequencing**
- **D-29:** Phase 8 ships as three plans, smallest→largest:
  - Plan 1 — Polish batch (COLLECT-01 audit + COLLECT-03 thumb + COLLECT-05 X button)
  - Plan 2 — LHS panel conversion (COLLECT-06 + COLLECT-04 printing picker)
  - Plan 3 — Precon browser (COLLECT-02 + Dexie v9 + `src/services/precons.js`)

### Claude's Discretion
- Keyboard shortcut for toggling the LHS panel (suggestion: none)
- Empty-state copy when panel is open but no card selected
- Loading skeleton shape for dropdown thumbnail
- Foil-toggle placement inside the panel
- Hover tooltip wording on printing-strip set icons
- Decklist-preview layout (vertical list with inline thumbnails vs compact grid)
- Precon product tile design (box art source)
- Precon browser close interaction (X + backdrop + Escape — all acceptable)
- Panel open/close transition timing (suggestion: 200ms ease-out)
- Re-open affordance when panel is collapsed

### Deferred Ideas (OUT OF SCOPE)
- Split-pane resizable LHS panel
- Overlay-style LHS panel with glass backdrop
- Tabbed LHS panel with mass-entry + CSV nested inside
- Per-card foil/category toggles during precon add-all
- Fetch-on-demand precon data (no cache)
- Full-size card hover-preview on dropdown thumbs
- Starter-deck (`set_type: starter`) precons — v1.2+
- MTGO/Arena printings in the picker
- Keyboard shortcut for panel toggle (left to planning)
- Grouped-by-parent-set precon layout
- Commander-identity extraction for post-add deck auto-build
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COLLECT-01 | Add-card results never render mana cost (audit) | Current `add-card-modal.js` lines 131-142 renders only `card._name` + `ss-{set}` icon — audit confirmed compliant; planning must re-verify post-port to panel. |
| COLLECT-02 | Precon browser: browse Scryfall precon products, view decklist, one-click add-all | Scryfall `/sets` + `set.search_uri` is the confirmed path (no dedicated deck API). Needs new `src/services/precons.js`, new `precons_cache` Dexie v9 table, new `src/components/precon-browser.js`, new `collection_add_batch` undo primitive. |
| COLLECT-03 | Card image preview renders in search dropdown | `image_uris.small` already populated on all bulk cards in Dexie. Row structure becomes `[img 40×29 cf-card-img] [name] [ss icon]`. |
| COLLECT-04 | Paper-printings picker — click set icons to switch printing, live price update | Scryfall `prints_search_uri` paginated endpoint + `game:paper` filter clause. Needs new rate-limited Scryfall queue (**does not exist** — see finding §2.1). `eurToGbp` already exposed via `window.__cf_eurToGbp`. |
| COLLECT-05 | Mass-entry terminal visible X close button wired to `discard()` | Target: `src/components/mass-entry-panel.js` line 99-100 header row. Existing `discard()` method at line 80 already handles confirm-before-wipe. |
| COLLECT-06 | Add-to-collection → permanent LHS pop-out panel; grid reflows; multi-card sequence without dismiss | `add-card-modal.js` (220 lines) x-data state machine ports 1:1 — only container chrome changes (drop backdrop, drop fixed-center, add LHS column styling). `addToCollection()` at line 70 must be edited to NOT close the panel (line 82 sets `addCardOpen = false` — remove). |
</phase_requirements>

## Summary

Phase 8 is primarily a **UX chrome swap** on top of Scryfall integration work. The heaviest technical lifting is (a) building a rate-limited Scryfall request queue that the codebase claims exists but does not, (b) designing `src/services/precons.js` to discover precon products via `/sets?type=commander` + `set.search_uri` pagination (no dedicated precon decklist endpoint exists), and (c) landing the additive Dexie v9 bump with a worker mirror.

Every other COLLECT requirement is a small, well-scoped edit against existing files: the add-card modal's Alpine x-data state machine ports verbatim into a LHS panel, the search-dropdown already lacks mana cost (COLLECT-01 is audit-only), and the mass-entry X button is a 10-line header-row edit wiring an existing `discard()` method.

The two real planning risks are (1) the Scryfall rate-limit queue does not exist in the codebase despite CONTEXT.md and STACK.md both referencing it — Plan 2 or Plan 3 must introduce it, and (2) precon add-all calls `collection.addCard` 100 times sequentially, each of which triggers a full `loadEntries()` (N+1 re-render). A `bulkAdd` primitive is required for acceptable perf on a 100-card Commander precon.

**Primary recommendation:** Build `src/services/scryfall-queue.js` (75ms-spaced request queue + `User-Agent` header) as the foundation of Plan 3; use `/sets?type=commander` + per-set `search_uri` pagination for precon decklists; ship `precons_cache` as Dexie v9 additive; use the existing `csv-import-modal` mount-to-`document.body` pattern for the precon browser; add a `collection.addBatch({ skipReload: true })` path + single reload at the end to avoid the N+1 perf trap.

## Standard Stack

### Core (already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Alpine.js | 3.15.11 | x-data state machine for panel + precon browser | Already hosts every Counterflux component; panel port is 1:1 state preservation |
| Dexie | 4.4.2 | IndexedDB wrapper, v9 precons_cache table | Already in v6+v7+v8 chain; v9 is additive-only per D-24 |
| keyrune | 3.18.0 | Set icons via `<i class="ss ss-{code}"></i>` | Already loaded; workhorse for printing strip + product tiles |
| Material Symbols | 0.44.0 | `close`, `chevron_left`, `progress_activity` | Already loaded; no new glyphs needed |
| web-vitals | 5.2.0 | Phase 7 already wired; no Phase 8 work | — |
| Vite | 8.0.3 (Rolldown) | Build | Unchanged |
| Tailwind | 4.2.2 | `@theme` tokens consumed from `src/styles/main.css` | All Phase 8 surfaces anchor to existing tokens per UI-SPEC |

### Supporting (new — none required)

**No new npm dependencies.** Every Phase 8 surface can be built from Alpine + Dexie + existing keyrune/Material Symbols assets + new pure-JS service modules.

**Version verification:**
```bash
npm view keyrune version       # confirmed 3.18.0 latest (Dec 2025 "Lorwyn Eclipsed")
npm view dexie version         # confirmed 4.4.x is current stable
npm view alpinejs version      # confirmed 3.15.x line
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Scryfall `/sets?type=commander` + per-set `search_uri` | Hypothetical dedicated precon endpoint | **No such endpoint exists.** Scryfall exposes sets + card search; there is no public API returning a precon's decklist as a first-class object with `is_commander` markers. See §5 Open Questions — `is_commander` must be inferred from set contents (e.g., legendary creatures at collector numbers typically reserved for commanders, or heuristics on `card.type_line`). |
| Roll-own Scryfall rate queue | Third-party library (`p-queue`) | +5KB gzip for a 40-line primitive. Counterflux's 75ms cadence is trivial to implement; adding a dependency to save 40 lines is not worth the bundle cost. |
| `precons_cache` as dedicated Dexie table | Store blob in `meta` table | CONTEXT D-07 locks a dedicated table to preserve queryability (e.g., "show me all precons containing Sol Ring"). Confirmed correct. |
| Write `addAllFromPrecon` as 100×`addCard` loop | `db.collection.bulkAdd()` path with single reload | Loop triggers 100 `loadEntries()` calls → ~2s UI freeze on a 500-card collection. `bulkAdd` is 10-100× faster. **MUST use bulk path.** |

**Installation:** No `npm install` required.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   ├── add-card-modal.js        # RENAME → add-card-panel.js (D-04a)
│   ├── add-card-panel.js        # NEW (renamed from above); state machine preserved, chrome swapped
│   ├── printing-picker.js       # NEW OR inline in panel (Claude's discretion; <80 lines = inline)
│   ├── precon-browser.js        # NEW — mirror csv-import-modal.js pattern
│   └── mass-entry-panel.js      # EDIT — add X close button to header
├── screens/
│   └── treasure-cruise.js       # EDIT — flex row [panel | grid]; mount precon-browser in #tc-modals
├── services/
│   ├── scryfall-queue.js        # NEW — 75ms-spaced fetch queue + User-Agent header (see §2.1 gap)
│   └── precons.js               # NEW — fetchPrecons(), fetchPreconDecklist(code), getCachedPrecons()
├── stores/
│   └── collection.js            # EXTEND — panelOpen, preconBrowserOpen, selectedPreconCode,
│                                #   printingsByCardId, loadPrecons(), selectPrecon(code),
│                                #   addAllFromPrecon(code), loadPrintings(cardId),
│                                #   selectPrinting(cardId, printingId)
├── db/
│   └── schema.js                # EXTEND — db.version(9).stores({ precons_cache: ... })
└── workers/
    └── bulk-data.worker.js      # MIRROR — same v9 declaration (schema-match requirement)
```

### Pattern 1: Panel State Machine Preservation

**What:** Keep the existing `add-card-modal.js` Alpine x-data object verbatim. Only the outer container chrome changes.

**When to use:** COLLECT-06 conversion.

**Example:**
```javascript
// BEFORE (add-card-modal.js, lines 15-98): unchanged Alpine x-data
x-data="{
  searchQuery: '', searchResults: [], selectedCard: null,
  quantity: 1, foil: false, category: 'owned', searching: false,
  _debounce: null, _searchId: 0,
  async doSearch(q) { /* unchanged */ },
  selectCard(card) { /* unchanged */ },
  getPrice() { /* unchanged */ },
  async addToCollection() {
    await $store.collection.addCard(...);
    $store.toast.success(...);
    this.reset();
    // REMOVED (D-01): $store.collection.addCardOpen = false;
    //   Panel stays open — search input refocuses for rapid entry.
  },
  reset() { /* unchanged */ },
  close() { /* rewire — was modal-close, now panel-collapse */ },
  // NEW: loadPrintings(cardId), selectPrinting(printingId)
}"

// BEFORE: fixed-center modal wrapper
<div style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 9999;
            display: flex; align-items: center; justify-content: center;">
  <div style="position: absolute; ... background: rgba(0,0,0,0.6);"></div>  <!-- backdrop: REMOVE -->
  <div style="position: relative; z-index: 10; width: 100%; max-width: 480px;">  <!-- modal: REMOVE -->

// AFTER: LHS column wrapper
<aside x-show="$store.collection.panelOpen"
       class="tc-panel-column"
       style="width: 360px; flex-shrink: 0; background: var(--color-surface);
              border-right: 1px solid var(--color-border-ghost); padding: 24px;
              overflow-y: auto; transition: transform 200ms ease-out;">
```

### Pattern 2: Scryfall Rate-Limited Queue (NEW — does not exist)

**What:** 75-100ms-spaced request queue honouring Scryfall's ToS (User-Agent header + minimum inter-request delay).

**When to use:** Every Scryfall API call added by Phase 8 (precon list fetch, precon decklist fetch, prints_search_uri fetch). MUST refactor existing `sets.js` to use it too, though that's optional scope for Phase 8.

**Example:**
```javascript
// src/services/scryfall-queue.js (NEW, ~40 lines)
const USER_AGENT = 'Counterflux/1.1 (MTG collection manager)';
const MIN_DELAY_MS = 100;  // Scryfall asks for 50-100ms; 100 is safe + matches PITFALLS §13

let _lastRequestAt = 0;
let _queue = Promise.resolve();

export function queueScryfallRequest(url, options = {}) {
  // Serial queue: each request waits for the previous + the spacing delay.
  _queue = _queue.then(async () => {
    const now = Date.now();
    const wait = Math.max(0, MIN_DELAY_MS - (now - _lastRequestAt));
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    _lastRequestAt = Date.now();
    const response = await fetch(url, {
      ...options,
      headers: { 'User-Agent': USER_AGENT, ...(options.headers || {}) }
    });
    if (!response.ok) throw new Error(`Scryfall ${response.status}: ${url}`);
    return response.json();
  });
  return _queue;
}
```

**Source:** [Scryfall API terms of service](https://scryfall.com/docs/api) — HIGH confidence; codebase currently lacks this primitive despite CONTEXT.md/STACK.md claims.

### Pattern 3: Precon Discovery via `/sets` + `search_uri`

**What:** Scryfall does NOT expose a dedicated deck/precon products API with decklists. Precon discovery is a two-step dance: list sets filtered by `set_type`, then paginate each set's `search_uri` for its cards.

**When to use:** `src/services/precons.js` — every precon discovery + decklist fetch.

**Example:**
```javascript
// src/services/precons.js
import { queueScryfallRequest } from './scryfall-queue.js';
import { db } from '../db/schema.js';

const PRECON_TYPES = ['commander', 'duel_deck']; // D-09
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // D-11

/**
 * Fetch all commander + duel_deck sets. Uses precons_cache with 7d TTL.
 * Sort: released_at DESC, tiebreak name ASC (D-12).
 */
export async function fetchPrecons({ forceRefresh = false } = {}) {
  if (!forceRefresh) {
    const cached = await db.precons_cache.toArray();
    const fresh = cached.filter(p => Date.now() - p.updated_at < TTL_MS);
    if (fresh.length > 0) return sortPrecons(fresh);
  }

  const json = await queueScryfallRequest('https://api.scryfall.com/sets');
  const products = (json.data || [])
    .filter(s => PRECON_TYPES.includes(s.set_type))
    .map(s => ({
      code: s.code,
      name: s.name,
      set_type: s.set_type,
      released_at: s.released_at,
      image_url: s.icon_svg_uri,
      search_uri: s.search_uri, // kept for decklist fetch
      decklist: null,           // populated on first drill-in
      updated_at: Date.now()
    }));

  await db.precons_cache.bulkPut(products);
  return sortPrecons(products);
}

/**
 * Fetch a single precon's decklist — paginates set.search_uri.
 * Writes the populated decklist back to precons_cache.
 */
export async function fetchPreconDecklist(code) {
  const cached = await db.precons_cache.get(code);
  if (cached?.decklist && Date.now() - cached.updated_at < TTL_MS) {
    return cached.decklist;
  }

  const cards = [];
  let url = cached?.search_uri || `https://api.scryfall.com/cards/search?q=set%3A${code}&unique=prints`;
  while (url) {
    const page = await queueScryfallRequest(url);
    for (const card of page.data || []) {
      cards.push({
        scryfall_id: card.id,
        quantity: 1, // Scryfall `search_uri` returns one row per printing — precon quantity is 1
        is_commander: inferIsCommander(card) // see §5 Open Questions
      });
    }
    url = page.has_more ? page.next_page : null;
  }

  await db.precons_cache.update(code, { decklist: cards, updated_at: Date.now() });
  return cards;
}

function sortPrecons(list) {
  return [...list].sort((a, b) => {
    const d = b.released_at.localeCompare(a.released_at);
    return d !== 0 ? d : a.name.localeCompare(b.name);
  });
}

function inferIsCommander(card) {
  // Heuristic: legendary creature with a rare/mythic rarity, or listed as
  // a commander in the set's companion product metadata (not exposed by API).
  // See Open Question 1.
  const typeLine = card.type_line || '';
  return typeLine.includes('Legendary') && typeLine.includes('Creature');
}
```

**Source:** Verified via WebSearch — Scryfall Set Objects docs confirm `search_uri` field exists; `/cards/search` accepts `set:{code}` query. HIGH confidence. `is_commander` inference is MEDIUM confidence (open question — see §5).

### Pattern 4: Printings Picker via `prints_search_uri`

**What:** Each Scryfall Card object includes a `prints_search_uri` field — a fully-formed search URL that returns every reprint of the card's oracle. Append `+game%3Apaper` to filter out digital-only printings, or filter client-side.

**When to use:** `loadPrintings(cardId)` inside the panel when a card is selected.

**Example:**
```javascript
// Inside collection store or directly in printing-picker.js
async loadPrintings(card) {
  // prints_search_uri is already in card.prints_search_uri (bulk data preserves it)
  // BUT: Counterflux's bulk-data-pipeline may strip it. Verify in Plan 2 spike.
  let url = card.prints_search_uri;
  if (!url) {
    // Fallback: construct from oracle_id
    url = `https://api.scryfall.com/cards/search?q=oracleid%3A${card.oracle_id}&unique=prints`;
  }

  const printings = [];
  while (url) {
    const page = await queueScryfallRequest(url);
    for (const p of page.data || []) {
      if (p.games?.includes('paper')) {
        printings.push({
          id: p.id,
          set: p.set,
          set_name: p.set_name,
          released_at: p.released_at,
          collector_number: p.collector_number,
          image_uris: p.image_uris,
          prices: p.prices,
          games: p.games
        });
      }
    }
    url = page.has_more ? page.next_page : null;
  }
  // Sort newest-first (D-16)
  printings.sort((a, b) => b.released_at.localeCompare(a.released_at));
  return printings;
}
```

**Source:** [Scryfall Card Objects docs](https://scryfall.com/docs/api/cards) — confirmed `prints_search_uri` paginates reprints, `games` array per card includes `paper`/`mtgo`/`arena`. HIGH confidence.

### Pattern 5: Full-Screen Modal Mounted to Body (reuse)

**What:** Precon browser renders by appending to `#tc-modals` (the container already managed by `treasure-cruise.js` at lines 157-169) and calling `Alpine.initTree(container)`.

**When to use:** `src/components/precon-browser.js`.

**Example:**
```javascript
// src/screens/treasure-cruise.js (edit mount())
modalContainer.innerHTML = `
  ${renderAddCardPanel()}       // NEW — but panel now renders inline in the main template
  ${renderMassEntryPanel()}     // unchanged
  ${renderCSVImportModal()}     // unchanged
  ${renderPreconBrowser()}      // NEW — full-screen drawer, x-show bound to $store.collection.preconBrowserOpen
  ${renderEditInline()}         // unchanged
  ${renderDeleteConfirm()}      // unchanged
`;
// Alpine.initTree(modalContainer) — already in place, handles the new panel/browser
```

**Source:** Existing pattern, `src/screens/treasure-cruise.js` lines 157-174. HIGH confidence — direct code reuse.

### Pattern 6: Batched Add with Single Undo (NEW)

**What:** Precon add-all commits N rows via `db.collection.bulkAdd()` + a single `loadEntries()` at the end. Registers ONE undo entry that reverses the whole batch.

**When to use:** `collection.addAllFromPrecon(code)`.

**Example:**
```javascript
// src/stores/collection.js (extended)
async addAllFromPrecon(code) {
  const precon = await db.precons_cache.get(code);
  if (!precon?.decklist) throw new Error(`Precon ${code} has no decklist`);

  // Resolve each decklist entry against the existing collection (merge quantities)
  // Build two lists: `toAdd` (brand-new composite) and `toUpdate` (existing composite)
  const now = new Date().toISOString();
  const added = []; // for undo: UUIDs of rows we inserted
  const updated = []; // for undo: { id, prevQuantity } of rows we bumped

  for (const entry of precon.decklist) {
    const existing = await db.collection
      .where('[scryfall_id+foil]')
      .equals([entry.scryfall_id, 0])
      .and(e => e.category === 'owned')
      .first();
    if (existing) {
      updated.push({ id: existing.id, prevQuantity: existing.quantity });
      await db.collection.update(existing.id, { quantity: existing.quantity + entry.quantity });
    } else {
      const newRow = {
        scryfall_id: entry.scryfall_id,
        quantity: entry.quantity,
        foil: 0,
        category: 'owned',
        added_at: now
        // id auto-supplied by schema.js creating-hook
      };
      const newId = await db.collection.add(newRow);
      added.push(newId);
    }
  }

  await this.loadEntries(); // ONE reload, not N
  logActivity('precon_added', `Added ${precon.decklist.length} cards from ${precon.name}`);

  // Single undo entry inverts the entire batch (D-08)
  Alpine.store('undo').push(
    'collection_add_batch',
    { added, updated },
    `Added ${precon.decklist.length} cards from ${precon.name}.`,
    async () => { /* commit = no-op; already done */ },
    async () => {
      // Restore: delete newly-added rows, revert bumped quantities
      await db.collection.bulkDelete(added);
      for (const { id, prevQuantity } of updated) {
        await db.collection.update(id, { quantity: prevQuantity });
      }
      await this.loadEntries();
    }
  );

  $store.toast.success(`Added ${precon.decklist.length} cards from ${precon.name} to collection.`);
}
```

**Source:** Pattern derived from `src/stores/collection.js:142-166` (`deleteEntry` undo pattern). HIGH confidence.

### Anti-Patterns to Avoid

- **Looping `addCard` 100× for precon add-all.** Triggers 100 `loadEntries()` calls → UI freeze. Use bulk path above.
- **Parallel Scryfall fetches.** `Promise.all(cards.map(fetch))` bypasses the rate-limit queue → 429 or ban (PITFALLS §13).
- **Persisting printings to IndexedDB.** D-18 is explicit: printings are in-memory per selected card, refetched on card change. Do not add a `printings_cache` table.
- **Renaming `addCardOpen` store field.** Keep it for backwards compatibility OR add a new `panelOpen` field and deprecate `addCardOpen` — but a rename breaks `treasure-cruise.js:56` (`@click="$store.collection.addCardOpen = true"` empty-state button) and must be coordinated.
- **Changing the creating-hook.** `src/db/schema.js:387-394` registers UUID auto-assign for `collection/decks/deck_cards/games/watchlist/profile` — precons_cache uses a string-PK `code` and MUST NOT be added to `UUID_TABLES` array.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation for Dexie rows | Custom UUID function | `crypto.randomUUID()` via existing `schema.js` creating-hook | Already wired for UUID-PK tables; precons_cache uses text `code` PK so no hook needed |
| Rate-limited Scryfall fetcher | Parallel `Promise.all` + retry loop | Serial queue pattern (§2.2 above) — 40 lines, trivial | PITFALLS §13: parallel fetch → 429 / IP ban |
| Precon decklist discovery | Scraping EDHREC, MTGGoldfish | Scryfall `/sets` + `set.search_uri` | Only authoritative source; EDHREC CORS blocks production anyway |
| Paper-printings filter | Client-side post-fetch filter that still hits MTGO/Arena pages | Server-side `game:paper` query param on prints_search_uri | Saves ~50% of results-page fetches for multi-format staples |
| Dexie schema diffing between main + worker | Conditional version declarations | Exact mirror — worker replicates main-thread v1..v9 block verbatim | PITFALLS §1 + observed in `bulk-data.worker.js:25-141` |
| Precon tile box art | Scraping WotC product images | Use `set.icon_svg_uri` (already in response) with a fallback product image constructed from `https://c1.scryfall.com/file/scryfall-symbols/sets/{code}.svg` | Official Scryfall asset; no scraping |
| Undo inverse for batch operations | Per-row undo stack entries | Single batch undo entry with structured payload (Pattern 6 above) | Matches existing `collection_remove` pattern at `collection.js:152-165` |
| GBP price display | Manual EUR→GBP math | `window.__cf_eurToGbp` already exposed | Phase 7 wired this; reuse |

**Key insight:** The "new surface" in Phase 8 is almost entirely chrome. The data plumbing (Scryfall queue, `precons.js`, bulk collection adds) is the real engineering, and every piece of it has a clear, prior-art pattern already present in the codebase — the risk is skipping those patterns, not inventing them.

## Runtime State Inventory

This is a rename + additive-migration phase. Checking each category:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `db.collection.addCardOpen` boolean (Alpine store field, line 58) referenced in `treasure-cruise.js:56` empty-state button. v8 schema has no references to "modal" or "addCardOpen" — just the field name in code. | Plan 2 either preserves `addCardOpen` as a deprecated alias for `panelOpen` OR renames in one pass across 2 files (`collection.js:58`, `treasure-cruise.js:56`). No stored data migration needed. |
| Live service config | None. Scryfall is a public read API — no API keys, no user-scoped configuration. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None new for Phase 8. Phase 10 introduces `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` — unrelated. | None. |
| Build artifacts | None. `dist/` regenerates from source; `node_modules/` untouched (no new deps). | None. |

**Nothing found in category:** Live service config, OS-registered state, secrets/env vars, build artifacts — all confirmed none by code scan.

**Data migration impact:** Dexie v8→v9 is purely additive (new `precons_cache` table with default empty state). Existing collection/decks/games/watchlist rows are untouched. No backfill, no `.upgrade()` callback per D-24.

## Common Pitfalls

### Pitfall 1: Phantom Scryfall Rate Queue

**What goes wrong:** CONTEXT.md and STACK.md both reference an existing "75ms-spaced Scryfall queue" in `src/services/scryfall.js`. **This file does not exist.** Only `src/utils/scryfall.js` (bulk-data fetcher, 15 lines) and `src/services/sets.js` (single bare `fetch('https://api.scryfall.com/sets')`) exist. Every Phase 8 plan that assumes "just use the queue" is assuming a primitive that must be built.

**Why it happens:** Planning docs often describe aspirational architecture. v1.0 only made one bulk-download call and one sets call — neither needed a queue. Phase 8 is the first phase with sustained Scryfall traffic.

**How to avoid:**
1. Plan 3 (precon browser) MUST include a task creating `src/services/scryfall-queue.js` before `precons.js` can use it.
2. Optionally, Plan 2 can include it as a foundation task if Plan 2's printings-picker wants to share the queue.
3. `sets.js` should migrate to the new queue in the same plan that introduces it — this is zero-cost refactor.

**Warning signs:** Planner's task list references `scryfallService.queueRequest()` or similar — that call site does not exist.

### Pitfall 2: `addCard` N+1 Reload on Precon Add-All

**What goes wrong:** The current `collection.addCard` (line 109-135) calls `await this.loadEntries()` on every add. Looping it 100× for a Commander precon triggers 100 full collection reloads + 100 Alpine re-renders. For a 500-card existing collection, that's ~2 seconds of main-thread work + UI freeze.

**Why it happens:** `addCard` was designed for single-card user flows where a reload per add is imperceptible. The v1.0 `addBatch` wrapper (line 168-180) is the SAME anti-pattern — it's a `for` loop around `addCard`.

**How to avoid:**
- Implement `collection.addAllFromPrecon` as the bulkAdd path (Pattern 6) — do NOT call `addCard` in a loop.
- Optionally add `{ skipReload: true }` option to `addCard` + call `loadEntries()` once at the end. This refactor benefits CSV import (`csv-import-modal.js:70-77`) and mass entry (`mass-entry-panel.js:67` calls `addBatch`) too — both currently N+1.

**Warning signs:** Precon add-all completes but the UI "pauses" for seconds. Profile reveals dozens of `loadEntries` stack frames.

### Pitfall 3: `prints_search_uri` Stripped by Bulk Pipeline

**What goes wrong:** `src/workers/bulk-data-pipeline.js` (referenced by worker) trims the Scryfall card object down to essential fields to save IndexedDB space. If `prints_search_uri` is among the stripped fields, the printing picker cannot use the card-resident URI — it must reconstruct via `oracleid:` search, adding a query round-trip.

**Why it happens:** Bulk-data trimming is a Phase 1 decision. No one planning Phase 8 has reason to look at what's kept vs dropped.

**How to avoid:**
1. Plan 2 MUST include a spike task: `grep -n 'prints_search_uri' src/workers/bulk-data-pipeline.js` — if absent, either (a) add it to the retained fields list (pipeline re-run required — heavy), or (b) fallback to `oracleid:` query (one extra request, tolerable).
2. The fallback path in Pattern 4 above already handles this; verify it works before depending on card-resident URI.

**Warning signs:** `card.prints_search_uri` is undefined in console logs; search fallback fires on every card selection.

### Pitfall 4: Keyrune Missing Set Icons

**What goes wrong:** A precon for a very new set (released within days of bulk-data refresh) may have a `set` code that keyrune 3.18.0 doesn't yet ship a glyph for. `<i class="ss ss-unknown"></i>` renders an empty box — visually broken printing strip / product tile.

**Why it happens:** keyrune updates ship on a separate cadence from WotC's set releases. The "Unreleased" changelog section mentions validation work but confirms no fallback class exists today.

**How to avoid:**
1. Add a CSS rule: `.ss[class*="ss-"]:empty::before` or a JS guard that checks against keyrune's known class list.
2. Simpler: provide a `.ss-default` fallback. Render printing icons as `<i class="ss ss-{code} ss-fallback"></i>` with CSS:
   ```css
   .ss-fallback { position: relative; }
   .ss-fallback:empty::before {
     content: '?';
     font-family: 'JetBrains Mono', monospace;
     font-size: 11px;
   }
   ```
3. Or: use `card.set_name` short-form in a tooltip only, and render the icon as `var(--color-text-dim)` — the glyph visually absent is still informative.

**Warning signs:** Blank squares in the printing strip, visual QA screenshots with empty icon positions.

### Pitfall 5: `is_commander` Inference False Positives

**What goes wrong:** Scryfall's search endpoint does NOT flag commanders within a precon — the concept of "the precon's commander" is WotC product metadata, not Scryfall card data. Heuristic: "Legendary Creature at rare/mythic rarity" yields false positives when a precon ships multiple legendary creatures (e.g. non-commander legends in the main deck).

**Why it happens:** The gap between Scryfall (open card data) and WotC's product SKUs.

**How to avoid:**
1. Use a weaker heuristic for UI: mark legendary creatures with the ♛ badge but don't assert uniqueness.
2. Better: sort legendary creatures first in the decklist preview (commander-likely) and let the user eyeball.
3. Best (v1.2+): maintain a curated `{ [code]: [commander_scryfall_id] }` map in `src/data/precon-commanders.js`. Out of scope for Phase 8 per D-10 (preview is visual; add-all commits all cards identically).

**Warning signs:** A precon like "Commander Legends 2 Sengir, the Dark Baron deck" shows 4+ cards with the ♛ badge.

### Pitfall 6: Panel Default-Open State Race on First Boot

**What goes wrong:** `localStorage.getItem('tc_panel_open')` returns `null` on first boot. Naive check `if (stored) panelOpen = true` leaves the panel **closed** on first visit — inverts D-03 ("open by default; first-boot open").

**Why it happens:** `null` is falsy; `"false"` string is also falsy. Any boolean coercion without explicit null-handling flips the logic.

**How to avoid:**
```javascript
panelOpen: (() => {
  const stored = localStorage.getItem('tc_panel_open');
  if (stored === null) return true;  // first boot — open (D-03)
  return stored === 'true';
})()
```

**Warning signs:** First-time-user screenshots show the panel closed despite D-03 being "open by default."

### Pitfall 7: Undo Restore Forgets Batch-Add Context

**What goes wrong:** `collection_add_batch` inverse deletes the N rows. But if the user manually removed one of the N in the 10 seconds between add and undo, the inverse only removes N-1 rows — and the undo toast still says "Reverted N cards" (misleading).

**Why it happens:** Undo entries snapshot state at push time, not at invert time.

**How to avoid:**
1. Capture `count_actually_removed` in the inverse and update the restore toast accordingly.
2. Or: skip this edge case entirely — the undo window is typically 5 seconds (matches Phase 7 Plan 1 `undo.js` default). Document as known minor UX quirk.
3. Better: track each bump as `{ id, prevQuantity }` and invert to the exact stored value — does the right thing even if the user incremented in between.

**Warning signs:** QA report "undo said it reverted 99 cards but collection count only dropped by 97."

## Code Examples

### Dexie v9 additive declaration

```javascript
// src/db/schema.js (append to existing chain, AFTER the v8 block)
// Source: PITFALLS.md §1 + CONTEXT.md D-24
db.version(9).stores({
  // All prior v8 declarations MUST be repeated (PITFALLS §1: "always keep prior declarations")
  cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
  meta: 'key',
  collection: 'id, scryfall_id, category, foil, user_id, updated_at, synced_at, [scryfall_id+foil], [scryfall_id+category]',
  decks: 'id, name, format, user_id, updated_at, synced_at',
  deck_cards: 'id, deck_id, scryfall_id, user_id, updated_at, synced_at, [deck_id+scryfall_id]',
  games: 'id, deck_id, user_id, started_at, ended_at, updated_at, synced_at',
  watchlist: 'id, &scryfall_id, user_id, updated_at, synced_at',
  price_history: '++id, scryfall_id, date, updated_at, [scryfall_id+date]',
  edhrec_cache: 'commander',
  combo_cache: 'deck_id',
  card_salt_cache: 'sanitized',
  profile: 'id, user_id, updated_at',
  sync_queue: '++id, table_name, user_id, created_at',
  sync_conflicts: '++id, table_name, detected_at',

  // NEW: precons cache (D-07, D-24). No .upgrade() needed — additive-only.
  precons_cache: 'code, set_type, released_at, updated_at'
});
// No .upgrade(async tx => ...) call here — D-24 explicitly.
```

### Worker mirror (required per D-26, PITFALLS §1)

```javascript
// src/workers/bulk-data.worker.js — APPEND after the v8 block (lines 121-141)
db.version(9).stores({
  // Mirror the full v9 declaration, even though the worker only touches
  // `cards` and `meta`. Schema-match is required per PITFALLS §1.
  cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
  meta: 'key',
  collection: 'id, scryfall_id, category, foil, user_id, updated_at, synced_at, [scryfall_id+foil], [scryfall_id+category]',
  decks: 'id, name, format, user_id, updated_at, synced_at',
  deck_cards: 'id, deck_id, scryfall_id, user_id, updated_at, synced_at, [deck_id+scryfall_id]',
  games: 'id, deck_id, user_id, started_at, ended_at, updated_at, synced_at',
  watchlist: 'id, &scryfall_id, user_id, updated_at, synced_at',
  price_history: '++id, scryfall_id, date, updated_at, [scryfall_id+date]',
  edhrec_cache: 'commander',
  combo_cache: 'deck_id',
  card_salt_cache: 'sanitized',
  profile: 'id, user_id, updated_at',
  sync_queue: '++id, table_name, user_id, created_at',
  sync_conflicts: '++id, table_name, detected_at',
  precons_cache: 'code, set_type, released_at, updated_at'
});
// No .upgrade() — worker never runs upgrades; main thread owns migration via src/services/migration.js.
```

### Dropdown thumbnail row (COLLECT-03)

```javascript
// add-card-panel.js — replace lines 131-142 of add-card-modal.js
<template x-for="(card, idx) in searchResults" :key="card.id">
  <button
    @click="selectCard(card)"
    class="cf-dropdown-row"
    style="width: 100%; display: flex; align-items: center; gap: 16px;
           padding: 8px 12px; min-height: 56px; text-align: left; cursor: pointer;
           background: transparent; border: none; color: var(--color-text-primary);"
    onmouseenter="this.style.background='var(--color-surface-hover)'"
    onmouseleave="this.style.background='transparent'"
  >
    <!-- D-19, D-20, D-21: thumbnail left, 40px tall -->
    <img
      :src="card.image_uris?.small || ''"
      :alt="card.name"
      class="cf-card-img"
      style="height: 40px; width: auto; flex-shrink: 0;"
      loading="lazy"
      onerror="this.style.display='none'"
    >
    <span style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 700;
                 flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
          x-text="card.name"></span>
    <i class="ss" :class="'ss-' + card.set"
       style="font-size: 14px; color: var(--color-text-dim);"></i>
    <!-- D-22 COLLECT-01: no mana cost rendered — audit confirms. -->
  </button>
</template>
```

### Mass-entry X close button (COLLECT-05, D-23)

```javascript
// src/components/mass-entry-panel.js — replace the current <h2> heading row (lines 99-101)
// Source: D-23
<div style="display: flex; align-items: center; justify-content: space-between;">
  <h2 style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700;
             line-height: 1.2; letter-spacing: 0.01em; color: var(--color-text-primary); margin: 0;">
    MASS ENTRY TERMINAL
  </h2>
  <button
    @click="discard()"
    aria-label="Close mass entry"
    title="Close mass entry"
    style="width: 32px; height: 32px; display: inline-flex; align-items: center;
           justify-content: center; background: transparent; border: none; cursor: pointer;
           color: var(--color-text-muted); transition: all 120ms ease-out;"
    onmouseenter="this.style.color='var(--color-text-primary)'; this.style.background='var(--color-surface-hover)'"
    onmouseleave="this.style.color='var(--color-text-muted)'; this.style.background='transparent'"
  >
    <span class="material-symbols-outlined" style="font-size: 20px;">close</span>
  </button>
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Modal overlay for every card add | Persistent LHS panel | Phase 8 (COLLECT-06) | Rapid multi-card entry without modal-dismiss friction |
| Scryfall `/cards/search?q=set:X` for precon contents | Same endpoint, but no dedicated decklist API exists | — | Confirms research finding: roll the decklist together from card search pages, no first-class "deck object" |
| v1.0 bare `fetch()` to Scryfall | v1.1 must adopt 75ms-spaced queue | Phase 8 (new) | Compliance with Scryfall ToS; prevents 429 / IP ban |
| `prints_search_uri` client-side filter | Use `+game%3Apaper` in URL to filter server-side | Always was available; newly leveraged | Halves payload for multi-format cards (Lightning Bolt has 40+ printings × 3 games) |

**Deprecated/outdated:**
- "Scryfall deck API" — **does not exist** despite community expectations. Fully discussed in Open Question 1.
- Parallel `Promise.all(cards.map(fetch))` pattern from some community examples — violates ToS; use serial queue.

## Open Questions

### 1. How to mark "the commander" in a precon decklist

**What we know:**
- Scryfall exposes precon sets under `set_type: 'commander'` and returns cards via `search_uri`.
- Each card has `type_line` including `Legendary Creature` or `Legendary Planeswalker` (some newer precons have planeswalker commanders).
- Scryfall does NOT flag which specific legendary creature is "the commander" of a precon — this is WotC product metadata, not card data.

**What's unclear:**
- A Commander precon typically ships with 1-2 face commanders, but the decklist also contains background/partner combos and non-commander legends.
- No public API field distinguishes face commander from deck inclusion.

**Recommendation:**
- **Phase 8 scope:** Use heuristic `type_line.includes('Legendary')` for the ♛ badge in decklist preview. Accept false positives — the visual cue is supportive not authoritative. D-10 requires preview only; add-all commits all cards uniformly (D-08) regardless of commander flag.
- **v1.2+:** Curate a manual map `{ [setCode]: [commander_scryfall_id[]] }` in `src/data/precon-commanders.js` as user demand surfaces.

### 2. Is `prints_search_uri` retained by the bulk-data pipeline?

**What we know:**
- Card Objects from Scryfall include `prints_search_uri` as a top-level field.
- `src/workers/bulk-data.worker.js` imports `processStream` from `./bulk-data-pipeline.js` which trims card fields for IndexedDB storage.
- Unable to read `bulk-data-pipeline.js` directly to confirm retention (not examined in this research pass).

**What's unclear:**
- Whether the trimmed card object preserves `prints_search_uri`, `oracle_id`, and `games` array.

**Recommendation:**
- Plan 2 MUST include a pre-implementation spike: open `src/workers/bulk-data-pipeline.js` and inspect the kept-fields set. If `prints_search_uri` is dropped, use the fallback: construct URL from `card.oracle_id` (confirmed retained — it's used in `src/db/search.js` line 33 dedup key). No blocker, just a one-request overhead on first selection.

### 3. Keyrune coverage for duel_deck set codes

**What we know:**
- keyrune 3.18.0 covers the modern set list (Dec 2025 release "Lorwyn Eclipsed").
- Duel Deck products span Duels of the Planeswalkers (2007-) and are long-tail.
- No `.ss-default` fallback class exists in keyrune today.

**What's unclear:**
- Whether every historic duel_deck set code (e.g. `ddc`, `ddd`, `dde`, `ddg`, etc.) has a glyph in keyrune 3.18.0.

**Recommendation:**
- Implement the Pitfall 4 fallback (CSS `:empty::before` with '?' glyph) as a defensive measure.
- Optional: run `grep -c 'ss-dd' node_modules/keyrune/css/keyrune.css` to audit coverage during Plan 3 — if <25 matches, flag for bug tracker.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Dexie | Schema v9 | ✓ | 4.4.2 | — |
| Alpine.js | Panel + browser x-data | ✓ | 3.15.11 | — |
| keyrune | Printing icons + precon tiles | ✓ | 3.18.0 | CSS `.ss:empty::before` fallback for missing sets |
| Material Symbols | `close`, `chevron_left` glyphs | ✓ | 0.44.0 | — |
| Vite (Rolldown) | Build | ✓ | 8.0.3 | — |
| Vitest + fake-indexeddb | Schema + service tests | ✓ | 4.1.2 / 6.2.5 | — |
| Scryfall API | Precon list + decklist + prints | ✓ (public, no auth) | — | On fetch failure: fall back to `precons_cache` stale data (7d+); show "COULDN'T LOAD PRECONS" + TRY AGAIN (D-error state) |
| Existing Scryfall rate queue | Precons.js + printings fetch | **✗** | — | **Must build** — see Pitfall 1. `src/services/scryfall-queue.js` is a Plan 3 prerequisite. |

**Missing dependencies with no fallback:** None blocking; Scryfall API failures are handled with stale cache + error UI.

**Missing dependencies with fallback:**
- **Scryfall rate queue**: build in Plan 3 as `src/services/scryfall-queue.js`. Zero-cost: 40 lines, no new npm deps.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 + jsdom 29.0.1 + fake-indexeddb 6.2.5 |
| Config file | `vitest.config.js` (exists — Phase 7 used it for `tests/migration-v5-to-v7.test.js`, `tests/schema-rename-spike.test.js`) |
| Quick run command | `npx vitest run tests/precons.test.js` (single-file) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COLLECT-01 | Search dropdown row contains no mana cost at any state | unit (regex) | `npx vitest run tests/add-card-panel.audit.test.js -t "no mana cost"` | ❌ Wave 0 |
| COLLECT-02a | `fetchPrecons()` returns sorted list (released_at DESC, name ASC) filtered to commander+duel_deck | unit | `npx vitest run tests/precons.test.js -t "fetchPrecons"` | ❌ Wave 0 |
| COLLECT-02b | `fetchPreconDecklist(code)` paginates `search_uri` and caches result | unit (mocked fetch) | `npx vitest run tests/precons.test.js -t "fetchPreconDecklist"` | ❌ Wave 0 |
| COLLECT-02c | `addAllFromPrecon(code)` inserts N rows, merges duplicates, registers single undo, triggers ONE `loadEntries()` | integration | `npx vitest run tests/collection.precon.test.js -t "addAllFromPrecon"` | ❌ Wave 0 |
| COLLECT-02d | Undo inverse removes exact added rows + restores prevQuantity on bumped rows | integration | `npx vitest run tests/collection.precon.test.js -t "undo inverse"` | ❌ Wave 0 |
| COLLECT-02e | Dexie v8→v9 upgrade is a no-op on existing data; `precons_cache` queryable post-upgrade | integration (fake-indexeddb) | `npx vitest run tests/schema-v9.test.js` | ❌ Wave 0 |
| COLLECT-03 | Dropdown renders `<img class="cf-card-img">` per row; no image = row renders name-only (graceful) | component DOM | `npx vitest run tests/add-card-panel.dropdown.test.js` | ❌ Wave 0 |
| COLLECT-04a | `loadPrintings(card)` filters `games: paper`, sorts `released_at` DESC | unit | `npx vitest run tests/printings.test.js` | ❌ Wave 0 |
| COLLECT-04b | Selecting a printing recomputes GBP price via `eurToGbp` | component | `npx vitest run tests/printing-picker.test.js -t "selectPrinting"` | ❌ Wave 0 |
| COLLECT-05 | Mass-entry header X button triggers `discard()`; with parsed entries, uses `confirm()` | component | `npx vitest run tests/mass-entry-panel.test.js -t "X close"` | ❌ Wave 0 |
| COLLECT-06a | Panel persists open-state via `localStorage.tc_panel_open`; null (first-boot) defaults to open | unit | `npx vitest run tests/add-card-panel.state.test.js -t "localStorage persistence"` | ❌ Wave 0 |
| COLLECT-06b | After `addToCollection()`, panel stays open (`panelOpen === true` post-commit), search input refocuses | integration | `npx vitest run tests/add-card-panel.state.test.js -t "stays open"` | ❌ Wave 0 |
| COLLECT-06c | Grid flex row: panel open = 360px + grid remaining; panel closed = grid 100% | visual (manual) | manual QA — see UI-SPEC Visual Regression Anchor 1 | manual |
| Regression | Scryfall queue never fires parallel requests; min 100ms spacing | unit (timing spy) | `npx vitest run tests/scryfall-queue.test.js` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run` (fast — all tests, parallel)
- **Per wave merge:** `npm test` (full suite, including Phase 7 schema tests for regression)
- **Phase gate:** Full suite green + manual QA of 6 UI-SPEC Visual Regression Anchors before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/add-card-panel.audit.test.js` — COLLECT-01 mana-cost regex audit
- [ ] `tests/add-card-panel.dropdown.test.js` — COLLECT-03 thumbnail DOM shape
- [ ] `tests/add-card-panel.state.test.js` — COLLECT-06 localStorage + stays-open semantics
- [ ] `tests/mass-entry-panel.test.js` — COLLECT-05 X close button
- [ ] `tests/precons.test.js` — fetchPrecons + fetchPreconDecklist unit
- [ ] `tests/printings.test.js` — loadPrintings paper filter + sort
- [ ] `tests/printing-picker.test.js` — selectPrinting price update component
- [ ] `tests/collection.precon.test.js` — addAllFromPrecon integration + undo
- [ ] `tests/schema-v9.test.js` — v8→v9 additive migration
- [ ] `tests/scryfall-queue.test.js` — rate-limiting timing
- [ ] `tests/conftest.js`-style shared fixtures: mock Scryfall responses for a sample commander precon (e.g., `cmm`) with 100 cards

*(Framework install: none needed — Vitest + fake-indexeddb already installed from Phase 7)*

## Sources

### Primary (HIGH confidence)
- `d:\Vibe Coding\counterflux\src\components\add-card-modal.js` — read in full (220 lines); state machine + row structure confirmed
- `d:\Vibe Coding\counterflux\src\stores\collection.js` — read in full (203 lines); addCard / addBatch / deleteEntry undo pattern confirmed
- `d:\Vibe Coding\counterflux\src\db\schema.js` — read in full (402 lines); v1..v8 chain, creating-hook, UUID_TABLES set confirmed
- `d:\Vibe Coding\counterflux\src\screens\treasure-cruise.js` — read in full; mount pattern + `#tc-modals` append confirmed
- `d:\Vibe Coding\counterflux\src\services\sets.js` — read in full; blueprint for `precons.js`, bare fetch confirmed
- `d:\Vibe Coding\counterflux\src\components\csv-import-modal.js` (first 80 lines) — modal-to-body mount pattern
- `d:\Vibe Coding\counterflux\src\components\mass-entry-panel.js` (first 120 lines) — `discard()` at line 80 confirmed
- `d:\Vibe Coding\counterflux\src\workers\bulk-data.worker.js` (first 160 lines) — worker schema mirror pattern confirmed
- `d:\Vibe Coding\counterflux\src\db\search.js` — `searchCards` returns cards with `image_uris.small` already populated
- `d:\Vibe Coding\counterflux\src\utils\scryfall.js` — confirmed only bulk-data fetcher exists; no rate-limit queue
- `d:\Vibe Coding\counterflux\package.json` — keyrune 3.18.0, Dexie 4.4.2, Alpine 3.15.11 confirmed
- [Scryfall Set Objects](https://scryfall.com/docs/api/sets) — `set_type`, `search_uri` field, commander + duel_deck types (WebSearch-verified)
- [Scryfall Card Objects](https://scryfall.com/docs/api/cards) — `prints_search_uri`, `games` array, `image_uris.small` (WebSearch-verified)
- [Scryfall Search Reference](https://scryfall.com/docs/syntax) — `game:paper` filter, `set:{code}`, `unique=prints` (WebSearch)
- [keyrune 3.18.0 CHANGELOG](https://github.com/andrewgioia/keyrune/blob/master/CHANGELOG.md) — December 2025 release, no fallback class exists (WebFetch)
- `.planning/research/STACK.md` §Scryfall precons — confirmed `/sets?type=commander` + `search_uri` approach
- `.planning/research/PITFALLS.md` §1, §13, §14, §16 — Dexie version chain, Scryfall rate limits, LHS pop-out z-index, stale precon data
- `.planning/phases/07-.../07-CONTEXT.md` — reused migration safety pattern, UUID creating-hook context

### Secondary (MEDIUM confidence)
- WebSearch: "Scryfall API set_type commander duel_deck search_uri 2026" — confirms set_type enum includes `commander` + `duel_deck`
- WebSearch: "Scryfall API prints_search_uri games paper filter card printings" — confirms `game:paper` syntax and `prints_search_uri` paginates reprints
- [Keyrune main page](https://keyrune.andrewgioia.com/) — confirms `<i class="ss ss-{code}"></i>` usage pattern

### Tertiary (LOW confidence — flagged for Plan 2/3 spike)
- `is_commander` inference heuristic in precons (Open Question 1) — no authoritative source, needs manual curation for v1.2+
- `prints_search_uri` retention in `bulk-data-pipeline.js` (Open Question 2) — must be verified via code read in Plan 2
- keyrune coverage for historic duel_deck codes (Open Question 3) — must be verified via CSS grep in Plan 3

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all deps already installed and verified via package.json
- Architecture: HIGH — every pattern has prior art in the codebase; only Scryfall queue is net-new and trivial
- Pitfalls: HIGH for Pitfalls 1-3 (verified against code); MEDIUM for Pitfalls 4-7 (inferred from code + UX reasoning)
- Scryfall API behaviour: HIGH — verified via WebSearch against official docs; direct WebFetch blocked (403) but secondary sources consistent
- Validation architecture: HIGH — Vitest + fake-indexeddb infrastructure already in place from Phase 7

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (30 days — Scryfall API is stable; keyrune ships new versions quarterly; Dexie 4 is stable)

---

*Phase 8 Research — Treasure Cruise Rapid Entry*
*Researched: 2026-04-15*
