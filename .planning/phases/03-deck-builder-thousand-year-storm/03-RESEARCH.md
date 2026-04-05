# Phase 3: Deck Builder (Thousand-Year Storm) - Research

**Researched:** 2026-04-05
**Domain:** MTG Commander deck builder with three-panel editor, drag-and-drop, live analytics, collection awareness, import/export
**Confidence:** HIGH

## Summary

Phase 3 builds the Thousand-Year Storm deck builder screen: a deck list landing page, an "Initialize Ritual" modal wizard for deck creation, and a three-panel editor (search / the 99 / analytics). The phase is large but well-constrained by locked decisions in CONTEXT.md and a detailed UI-SPEC. All core infrastructure exists from Phases 1-2: Dexie schema, Alpine stores, Chart.js analytics, context menu pattern, card search, card accessor, virtual scroller, currency conversion, mana rendering, and toast notifications.

The primary technical challenges are: (1) Dexie schema v3 migration adding `decks` and `deck_cards` tables, (2) SortableJS integration for drag-and-drop between search panel and categorised card groups, (3) real-time analytics recalculation under 100ms, (4) decklist import format parsing (Moxfield/Archidekt/MTGGoldfish/plain text), and (5) oracle text heuristic tagging. The bulk data pipeline stores FULL Scryfall card objects (no field trimming), so all needed fields (`keywords`, `oracle_text`, `type_line`, `color_identity`, `legalities`, `prices`) are already available in IndexedDB.

**Primary recommendation:** Structure implementation in waves: (1) data layer (Dexie schema + deck store), (2) deck landing + ritual modal, (3) three-panel editor layout + centre panel, (4) search panel + drag-and-drop, (5) analytics sidebar, (6) import/export, (7) integration wiring (collection awareness, COLL-13 cross-reference).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Deck creation uses a modal wizard overlay with "Initialize Ritual" theme. Steps: commander search (autocomplete filtered to legendary creatures), partner detection, companion slot, deck naming, colour identity, "Begin Ritual" confirm.
- **D-02:** No life total in the ritual -- life totals are Game Tracker concern.
- **D-03:** Commander-primary, format-aware. Commander default (100 cards, colour identity lock, singleton with warning). Format dropdown supports 60-card formats without legality checks. Legality checking deferred to Phase 4.
- **D-04:** Two-layer organisation: card types (auto-classified from Scryfall type_line) as primary grouping axis.
- **D-05:** Functional tags as secondary layer. Cards can have multiple tags. Tags are user-assignable and filterable.
- **D-06:** Oracle text heuristics for auto-suggesting tags in Phase 3. Phase 4 upgrades to EDHREC-backed suggestions.
- **D-07:** Users can create custom tags, rename, delete. Default tag set on new deck.
- **D-08:** Deck list landing with commander art thumbnail, deck name, card count, format badge, last edited.
- **D-09:** "Initialize Ritual" button on deck list landing.
- **D-10:** Context menu on deck cards: Rename, Duplicate, Delete, Change Commander.
- **D-11:** Click deck card to open three-panel editor.
- **D-12:** Subtle dot indicators: 6px green (owned), 6px red (missing). Full opacity for all cards.
- **D-13:** Summary bar: "You own 72/99 -- Missing cost: GBP47.30" using eurToGbp().
- **D-14:** "In Collection" filter toggle in search panel. ON = only owned cards. OFF = all cards (default).
- **D-15:** Adding duplicate: increment quantity with toast. Commander singleton: warn but allow (Relentless Rats exemption). 60-card: no limit.
- **D-16:** Centre panel toggles visual grid / compact list. Default is visual grid.
- **D-17:** Cards grouped by card type with headers showing count. SortableJS drag-and-drop within and between groups.
- **D-18:** Persistent card count tracker: "67/99 -- 32 slots remaining".
- **D-19:** Live analytics: mana curve (colour-coded), colour pie doughnut, type breakdown, tag breakdown, price summary. All recalculate within 100ms.
- **D-20:** Import from Moxfield, Archidekt, MTGGoldfish, plain text. Auto-detect format. Reuse mass entry resolution pattern.
- **D-21:** Export as plain text, MTGO, Arena, CSV.
- **D-22:** Right-click context menu on deck cards with custom DOM events.
- **D-23:** Card detail flyout reuses Phase 1/2 pattern.

### Claude's Discretion
- Drag-and-drop interaction details (handle placement, drop zone highlighting, animation)
- Analytics chart styling within Organic Brutalism constraints
- Search panel filter control placement and layout
- Tag colour coding scheme (if any)
- Default tag set for new decks
- Format dropdown options and labels
- Deck list landing grid layout and responsive breakpoints

### Deferred Ideas (OUT OF SCOPE)
- EDHREC-backed tag auto-suggestions (Phase 4)
- Card legality checking per format (Phase 4)
- Salt score display (Phase 4 -- build placeholder in analytics panel)
- Sideboard support (not in v1)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DECK-01 | Three-panel layout: search (left), the 99 (centre), analytics (right) | Fixed widths (280/flex/280) per UI-SPEC. Tonal shifting panel separation. |
| DECK-02 | Card search with Scryfall syntax, autocomplete, filter toggles (colour identity locked) | Reuse existing `searchCards()` with colour identity filter. Add type_line and CMC filters. |
| DECK-03 | "In Collection" toggle filters to owned cards; unowned show ghost border with price | Cross-reference deck store with collection store entries. |
| DECK-04 | The 99 toggles between visual grid and compact list | Two rendering modes sharing same data source. SortableJS only in grid mode per UI-SPEC. |
| DECK-05 | User-defined category sorting with custom category creation | Functional tags system: default set + user-created tags stored per deck. |
| DECK-06 | Drag-and-drop between categories via SortableJS | SortableJS `group: 'deck'` shared across type-group containers. `pull`/`put` from search panel. |
| DECK-07 | Persistent card count tracker: 67/99 | Reactive computed from deck_cards count vs deck format size. |
| DECK-08 | Owned/missing indicators with summary | Green/red 6px dots. Summary bar with eurToGbp() pricing from collection cross-reference. |
| DECK-09 | Live mana curve bar chart (CMC 0-7+, colour-coded) | Chart.js BarController. Reuse existing MTG_COLOURS map and chart styling. |
| DECK-10 | Live colour pie doughnut (mana symbol distribution) | Chart.js DoughnutController. Parse mana_cost symbols for distribution. |
| DECK-11 | Live type breakdown | Pure computation from type_line classification. Render as horizontal bars or list. |
| DECK-12 | Live category/tag breakdown with fill indicators | Computed from tag assignments per card. |
| DECK-13 | Price summary (total, unowned, most expensive) | eurToGbpValue() for numeric sums. eurToGbp() for display. |
| DECK-14 | Initialize Ritual flow: commander search, colour identity lock | Filter search to legendary creatures via type_line. Detect Partner via keywords array. |
| DECK-15 | Support partner commanders and companions | Check card.keywords for "Partner", "Partner with {name}", "Choose a Background". Companion via keywords. |
| DECK-16 | Import from Moxfield/Archidekt/MTGGoldfish/plain text | Parse multiple text formats. Auto-detect via pattern matching. Reuse resolveBatchEntries(). |
| DECK-17 | Export as plain text, MTGO, Arena, CSV | Format deck data into standard decklist text formats. |
| DECK-18 | Right-click context menu on cards | Reuse context menu pattern from Phase 2 with deck-specific actions. |
| DECK-19 | Card detail flyout | Reuse existing flyout pattern from Phase 1/2. |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Alpine.js | 3.15.x | Reactivity + stores | Project standard from Phase 1 |
| Dexie.js | 4.4.2 | IndexedDB abstraction | Project standard, schema versioning |
| Chart.js | 4.5.1 | Analytics charts (mana curve, colour pie) | Already used in Phase 2 analytics |
| Navigo | 8.11.1 | Hash routing | Project standard from Phase 1 |
| mana-font | 1.18.0 | MTG mana symbols | Already installed |
| PapaParse | 5.5.3 | CSV export | Already installed from Phase 2 |

### New Dependency
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| SortableJS | 1.15.7 | Drag-and-drop between categorised groups | DECK-06: card reordering and search-to-deck drag |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SortableJS | Native HTML5 Drag & Drop | Native API is painful (ghost images, drop zones, etc.). SortableJS handles all edge cases. Decision is locked. |
| Chart.js for mana curve | Pure CSS bars | Chart.js already integrated; use it for consistency. CSS bars acceptable for type breakdown (simpler data). |

**Installation:**
```bash
npm install sortablejs
```

**Version verification:** SortableJS 1.15.7 is the latest version on npm (verified 2026-04-05). No breaking changes since 1.15.x.

## Architecture Patterns

### Recommended Project Structure (new files for Phase 3)
```
src/
├── db/
│   └── schema.js              # Add version(3) with decks + deck_cards tables
├── stores/
│   └── deck.js                # NEW: Alpine.store('deck') -- deck state management
├── screens/
│   └── thousand-year.js       # REPLACE: placeholder -> full deck builder screen
├── components/
│   ├── deck-landing.js        # NEW: deck list grid + "Initialize Ritual" button
│   ├── ritual-modal.js        # NEW: multi-step deck creation wizard
│   ├── deck-editor.js         # NEW: three-panel editor orchestrator
│   ├── deck-search-panel.js   # NEW: search panel with filters + "In Collection" toggle
│   ├── deck-centre-panel.js   # NEW: the 99 with grid/list views + SortableJS
│   ├── deck-analytics-panel.js# NEW: mana curve, colour pie, type/tag breakdown, price
│   ├── deck-card-tile.js      # NEW: card tile with owned/missing dots
│   ├── deck-context-menu.js   # NEW: context menu for deck card actions
│   ├── deck-landing-context-menu.js # NEW: context menu for deck cards on landing
│   ├── deck-import-modal.js   # NEW: import decklist modal with format detection
│   ├── deck-export-modal.js   # NEW: export format selection modal
│   ├── delete-deck-modal.js   # NEW: deck deletion confirmation
│   └── tag-manager.js         # NEW: tag CRUD (create, rename, delete)
├── services/
│   └── deck-import.js         # NEW: decklist format parsing + resolution
├── utils/
│   ├── type-classifier.js     # NEW: classify cards into type groups from type_line
│   └── tag-heuristics.js      # NEW: oracle text heuristic tag suggestions
└── ...
```

### Pattern 1: Dexie Schema v3 Migration

**What:** Add `decks` and `deck_cards` tables to the existing Dexie schema.
**When to use:** This must be the first implementation step -- all other deck builder features depend on it.

```javascript
// src/db/schema.js -- add version 3
db.version(3).stores({
  cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
  meta: 'key',
  collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]',
  decks: '++id, name, format, updated_at',
  deck_cards: '++id, deck_id, scryfall_id, [deck_id+scryfall_id]'
});
```

**CRITICAL:** The worker file `src/workers/bulk-data.worker.js` has its own Dexie instance with schema v1. It must also be updated to declare all versions (1, 2, 3) so Dexie can open the database correctly. Dexie requires ALL version declarations to be present in every context that opens the database.

**Deck record shape:**
```javascript
{
  id: auto,                    // Dexie auto-increment
  name: 'Krark & Sakashima',  // User-editable deck name
  format: 'commander',        // 'commander' | 'standard' | 'modern' | 'legacy' | 'vintage' | 'pauper'
  deck_size: 100,             // Target deck size (100 for commander, 60 for others)
  commander_id: 'scryfall-id', // Primary commander Scryfall ID
  partner_id: null,           // Partner commander Scryfall ID (nullable)
  companion_id: null,         // Companion Scryfall ID (nullable)
  color_identity: ['U', 'R'], // Merged colour identity array
  tags: ['Ramp', 'Card Draw', 'Removal', 'Board Wipes', 'Win Conditions', 'Protection', 'Recursion', 'Utility'],
  created_at: ISO string,
  updated_at: ISO string
}
```

**Deck card record shape:**
```javascript
{
  id: auto,
  deck_id: 1,                  // FK to decks table
  scryfall_id: 'card-id',     // Scryfall card ID
  quantity: 1,                 // Card quantity (usually 1 for Commander)
  tags: ['Ramp', 'Removal'],  // Assigned functional tags for this card in this deck
  sort_order: 0,               // Manual sort position within type group
  added_at: ISO string
}
```

### Pattern 2: Alpine Deck Store

**What:** Central state management for the deck builder, following the same `Alpine.store()` pattern as `collection.js`.
**When to use:** All deck builder components read/write through this store.

```javascript
Alpine.store('deck', {
  decks: [],           // All deck summaries for landing page
  activeDeck: null,    // Currently open deck (full data with joined cards)
  activeCards: [],     // Cards in active deck (with joined Scryfall data)
  viewMode: 'grid',   // 'grid' | 'list'
  loading: false,

  // Computed: group cards by type for centre panel
  get groupedByType() { /* classify activeCards by type_line */ },

  // Computed: analytics data (mana curve, colour pie, etc.)
  get analytics() { /* compute from activeCards */ },

  // CRUD operations against Dexie
  async loadDecks() { /* load all decks for landing */ },
  async createDeck(deckData) { /* insert deck, navigate to editor */ },
  async loadDeck(deckId) { /* load deck + all cards with joined data */ },
  async addCard(scryfallId, tags) { /* add card to active deck */ },
  async removeCard(deckCardId) { /* remove card from active deck */ },
  async updateCardTags(deckCardId, tags) { /* update tags */ },
  async reorderCard(deckCardId, newSortOrder) { /* update sort position */ },
  // ...
});
```

### Pattern 3: SortableJS Integration with Alpine

**What:** Wire SortableJS instances to Alpine store mutations for drag-and-drop.
**When to use:** Centre panel card groups in grid view, and search-to-deck dragging.

```javascript
import Sortable from 'sortablejs';

// Each type group container gets a Sortable instance
function initSortable(groupEl, groupName) {
  return new Sortable(groupEl, {
    group: 'deck-cards',     // Shared group name allows cross-group drag
    animation: 150,
    ghostClass: 'drag-ghost',
    chosenClass: 'drag-chosen',
    dragClass: 'drag-active',
    onEnd(evt) {
      // Update store with new position/group
      const cardId = evt.item.dataset.deckCardId;
      const newGroup = evt.to.dataset.typeGroup;
      const newIndex = evt.newIndex;
      Alpine.store('deck').reorderCard(cardId, newGroup, newIndex);
    }
  });
}

// Search panel: clone items into deck (pull: 'clone')
function initSearchSortable(searchListEl) {
  return new Sortable(searchListEl, {
    group: {
      name: 'deck-cards',
      pull: 'clone',     // Clone from search, don't remove
      put: false         // Don't allow dropping back into search
    },
    sort: false,         // Search results are not sortable
    onEnd(evt) {
      // Remove the cloned DOM element (store handles rendering)
      evt.item.remove();
      const scryfallId = evt.item.dataset.scryfallId;
      Alpine.store('deck').addCard(scryfallId);
    }
  });
}
```

**Key SortableJS options:**
- `group: 'name'` -- shared name enables cross-list drag
- `group: { name, pull: 'clone' }` -- clone items from search panel
- `animation: 150` -- smooth transitions
- `ghostClass` / `chosenClass` -- CSS classes for UI-SPEC styling
- `fallbackOnBody: true` -- recommended when dragging between nested containers
- `onEnd` callback -- fire store mutation, let Alpine re-render

### Pattern 4: Type Classification from type_line

**What:** Classify cards into type groups from Scryfall `type_line` field.
**When to use:** Grouping cards in the centre panel.

```javascript
const TYPE_ORDER = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land', 'Other'];

function classifyType(typeLine) {
  if (!typeLine) return 'Other';
  const lower = typeLine.toLowerCase();
  // Check in priority order (a card that is "Artifact Creature" should be "Creature")
  if (lower.includes('creature')) return 'Creature';
  if (lower.includes('instant')) return 'Instant';
  if (lower.includes('sorcery')) return 'Sorcery';
  if (lower.includes('enchantment')) return 'Enchantment';
  if (lower.includes('artifact')) return 'Artifact';
  if (lower.includes('planeswalker')) return 'Planeswalker';
  if (lower.includes('land')) return 'Land';
  if (lower.includes('battle')) return 'Other';
  return 'Other';
}
```

**Important:** "Artifact Creature" cards should classify as Creature (primary type). "Enchantment Creature" same. The order of checks matters.

### Pattern 5: Oracle Text Heuristic Tags

**What:** Auto-suggest functional tags based on oracle text patterns.
**When to use:** When adding a card to a deck, suggest tags. User can accept/modify.

```javascript
const TAG_HEURISTICS = [
  { tag: 'Ramp', patterns: [/search your library for a.*land/i, /add \{/i, /mana of any/i] },
  { tag: 'Card Draw', patterns: [/draw (a|two|three|\d+) card/i, /draw cards equal/i] },
  { tag: 'Removal', patterns: [/destroy target/i, /exile target/i, /deals? \d+ damage to (target|any)/i] },
  { tag: 'Board Wipes', patterns: [/destroy all/i, /exile all/i, /all creatures get -/i] },
  { tag: 'Protection', patterns: [/hexproof/i, /indestructible/i, /shroud/i, /protection from/i, /can't be (countered|targeted)/i] },
  { tag: 'Recursion', patterns: [/return.*from.*graveyard/i, /return.*from your graveyard/i] },
  { tag: 'Win Conditions', patterns: [/you win the game/i, /each opponent loses/i] },
  { tag: 'Utility', patterns: [] } // Fallback, no auto-detection
];

function suggestTags(oracleText) {
  if (!oracleText) return [];
  return TAG_HEURISTICS
    .filter(h => h.patterns.some(p => p.test(oracleText)))
    .map(h => h.tag);
}
```

**Design the tag API to be source-agnostic** (per CONTEXT.md specifics). Phase 4 replaces these heuristics with EDHREC-backed suggestions using the same interface.

### Pattern 6: Commander Detection from Bulk Data

**What:** Detect legendary creatures, partners, and companions from Scryfall data already in IndexedDB.
**When to use:** Initialize Ritual commander search.

The bulk data pipeline stores FULL Scryfall card objects. Key fields available:

| Field | Content | Use |
|-------|---------|-----|
| `type_line` | "Legendary Creature -- Human Wizard" | Filter to legendary creatures |
| `keywords` | `["Partner"]` or `["Partner with", "Lifelink"]` | Detect partner ability |
| `oracle_text` | Full rules text | Fallback partner detection, companion condition |
| `color_identity` | `["U", "R"]` | Colour identity lock |
| `legalities` | `{ commander: "legal", ... }` | Not used in Phase 3 (Phase 4) |

**Commander search filter:**
```javascript
// Filter for legendary creatures (commander candidates)
const isLegendary = (card) =>
  card.type_line && card.type_line.includes('Legendary') &&
  (card.type_line.includes('Creature') || card.type_line.includes('Planeswalker'));
  // Note: Some planeswalkers can be commanders (e.g., "can be your commander" in oracle_text)

// Partner detection
const hasPartner = (card) =>
  card.keywords?.includes('Partner') && !card.oracle_text?.includes('Partner with');

const hasPartnerWith = (card, targetName) =>
  card.oracle_text?.includes(`Partner with ${targetName}`);

// Background commanders
const choosesBackground = (card) =>
  card.keywords?.includes('Choose a Background');

const isBackground = (card) =>
  card.type_line?.includes('Background');

// Companion detection
const isCompanion = (card) =>
  card.keywords?.includes('Companion');
```

### Anti-Patterns to Avoid
- **DO NOT query Scryfall API for commander search.** All card data is in local IndexedDB. Use Dexie queries.
- **DO NOT store full card objects in the deck store.** Store `scryfall_id` references in `deck_cards` and join with `cards` table on load.
- **DO NOT create new Chart.js registrations.** Reuse the existing `analytics-panel.js` Chart.register() call. Import shared constants (MTG_COLOURS, CHART_TOOLTIP, CHART_LEGEND, CHART_ANIMATION).
- **DO NOT use inline Alpine `x-data` for complex state.** All deck state goes through `Alpine.store('deck')`. Component functions handle local UI state only.
- **DO NOT use `border-radius` on any element.** Organic Brutalism: 0px everywhere, no exceptions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop between lists | Custom HTML5 drag API | SortableJS 1.15.7 | Ghost images, drop zones, touch support, animation -- all handled |
| CSV export | Manual string building | PapaParse `unparse()` | Already installed, handles edge cases (commas in names, Unicode) |
| Chart rendering | Canvas drawing code | Chart.js 4.x (already imported) | Bar/doughnut charts with tooltips, animation, responsive |
| Mana symbol rendering | SVG/image sprites | mana-font (already installed) | `renderManaCost()` utility already works |
| Currency conversion | Manual EUR/GBP math | `eurToGbp()` / `eurToGbpValue()` (already exists) | Handles rate caching, formatting, fallback |
| Card field access | Direct property access | `card-accessor.js` functions | Handles all Scryfall layouts (transform, split, modal DFC, etc.) |
| Batch card resolution | Custom search/match logic | `resolveBatchEntries()` from mass-entry.js | Already handles fuzzy matching and manual resolution flow |

**Key insight:** Phase 2 built a comprehensive collection management system with patterns that directly transfer to the deck builder. The context menu, card tiles, analytics charts, CSV operations, and mass entry resolution are all reusable. The deck builder adds new orchestration on top of existing infrastructure.

## Common Pitfalls

### Pitfall 1: Dexie Schema Version Mismatch in Worker
**What goes wrong:** The web worker in `src/workers/bulk-data.worker.js` has its own Dexie instance stuck at version 1. If main app upgrades to version 3, the worker will fail to open the database.
**Why it happens:** Dexie requires ALL version declarations in every context that opens the shared IndexedDB database.
**How to avoid:** Update the worker's Dexie schema to declare versions 1, 2, AND 3 (with the same stores definitions). Both the main thread and worker must agree on schema versions.
**Warning signs:** "VersionError" or "database version mismatch" errors in the console when bulk data refreshes after schema upgrade.

### Pitfall 2: SortableJS DOM vs Alpine Reactivity Conflict
**What goes wrong:** SortableJS directly mutates the DOM (moves elements), but Alpine.js wants to own the DOM via reactive templates. After a drag, Alpine re-renders and undoes SortableJS changes, or produces duplicate elements.
**Why it happens:** SortableJS operates at the DOM level; Alpine operates at the data level.
**How to avoid:** In the `onEnd` callback, (1) prevent SortableJS from actually moving the DOM element (or immediately revert it), (2) update the Alpine store data, (3) let Alpine re-render the correct order from store data. Alternatively, set `sort: false` on the Sortable instance and handle all reordering through store mutations only.
**Warning signs:** Duplicate cards appearing after drag, cards "snapping back", or cards disappearing.

### Pitfall 3: Chart.js Instance Memory Leaks
**What goes wrong:** Creating new Chart.js instances without destroying old ones causes canvas corruption and memory leaks.
**Why it happens:** Chart.js attaches event listeners and retains references to canvas elements.
**How to avoid:** Always call `chart.destroy()` before re-rendering. The existing `analyticsPanel.js` has `destroyCharts()` -- follow this pattern. For live-updating deck analytics, prefer `chart.update()` over destroy+recreate when only data changes.
**Warning signs:** Charts rendering on top of old charts, increasing memory usage, "Canvas is already in use" warnings.

### Pitfall 4: Performance of Analytics Recalculation
**What goes wrong:** Analytics must recalculate within 100ms (PERF-04). Naive implementations traverse all cards multiple times.
**Why it happens:** Each analytics panel (mana curve, colour pie, type breakdown, tags, price) could individually iterate all deck cards.
**How to avoid:** Compute ALL analytics in a single pass through the card list. Cache the result object and invalidate only on add/remove/tag-change. Use `requestAnimationFrame` for chart updates so multiple rapid changes batch into one render.
**Warning signs:** Laggy UI when adding cards rapidly, analytics panel flickering.

### Pitfall 5: Partner Commander Edge Cases
**What goes wrong:** Partner keyword has multiple variants: "Partner" (generic, any partner), "Partner with {Name}" (specific pair only), "Choose a Background" (pairs with Background enchantments), and "Friends forever".
**Why it happens:** Partner is not a single mechanic but a family of related mechanics.
**How to avoid:** Check the `keywords` array for exact matches. "Partner" (generic) means any other "Partner" creature. "Partner with {name}" means only that specific partner. "Choose a Background" means pair with any Background enchantment. "Friends forever" works like generic Partner but is a separate keyword.
**Warning signs:** Users unable to add valid partner combinations, or invalid combinations being allowed.

### Pitfall 6: Singleton Rule vs Exceptions
**What goes wrong:** Commander format is singleton (one copy of each card except basic lands), but several cards explicitly override this: Relentless Rats, Shadowborn Apostle, Rat Colony, Persistent Petitioners, Dragon's Approach, Seven Dwarves (max 7), Slime Against Humanity.
**Why it happens:** These cards have oracle text like "A deck can have any number of cards named {name}".
**How to avoid:** Check oracle text for "any number of cards named" pattern before showing singleton warning. For Phase 3, warn but allow (per D-15) -- the warning should simply not appear for these exception cards.
**Warning signs:** Warning toast appearing for every Relentless Rats addition.

### Pitfall 7: Import Format Ambiguity
**What goes wrong:** Moxfield and Archidekt plain text exports look very similar. Auto-detection can misidentify the format.
**Why it happens:** Most formats use the same `1 Card Name` syntax with slight variations in section headers.
**How to avoid:** Focus on section header detection: Moxfield uses `// Commander`, `// Companion`, `// The 99`. Archidekt uses category headers like `Creatures (23)`. MTGGoldfish uses no headers (flat list). Plain text is the fallback. Parse by trying the most structured format first and falling back.
**Warning signs:** Commander not detected from import, cards put in wrong categories.

## Code Examples

### Dexie Schema Version 3

```javascript
// Source: project pattern from src/db/schema.js
db.version(3).stores({
  cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
  meta: 'key',
  collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]',
  decks: '++id, name, format, updated_at',
  deck_cards: '++id, deck_id, scryfall_id, [deck_id+scryfall_id]'
});
```

### Collection Ownership Lookup (for owned/missing indicators)

```javascript
// Efficient batch lookup: is card owned?
async function getOwnedCardIds() {
  const entries = await db.collection.where('category').equals('owned').toArray();
  return new Set(entries.map(e => e.scryfall_id));
}

// Usage in deck store
const ownedIds = await getOwnedCardIds();
const isOwned = (scryfallId) => ownedIds.has(scryfallId);
```

### Decklist Import Format Detection

```javascript
function detectFormat(text) {
  const lines = text.trim().split('\n');

  // Moxfield: has section headers like "// Commander" or "// The 99"
  if (lines.some(l => /^\/\/\s*(Commander|Companion|The 99|Sideboard)/i.test(l))) {
    return 'moxfield';
  }

  // Archidekt: has category headers like "Creatures (23)"
  if (lines.some(l => /^[A-Z][a-z]+\s*\(\d+\)$/i.test(l))) {
    return 'archidekt';
  }

  // MTGGoldfish/Arena: has set codes in parentheses like "1 Card Name (SET) 123"
  if (lines.some(l => /^\d+x?\s+.+\s+\([A-Z0-9]+\)\s+\d+/.test(l))) {
    return 'arena';
  }

  // Plain text fallback: "1 Card Name" or "1x Card Name"
  return 'plaintext';
}
```

### Mana Curve Computation (single-pass analytics)

```javascript
function computeDeckAnalytics(cards) {
  const manaCurve = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, '7+': 0 };
  const colourPie = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  const typeBreakdown = {};
  const tagBreakdown = {};
  let totalCmc = 0;
  let nonLandCount = 0;
  let totalPrice = 0;
  let unownedPrice = 0;
  let mostExpensive = { name: '', price: 0 };

  for (const entry of cards) {
    const card = entry.card;
    if (!card) continue;

    // Mana curve (exclude lands)
    const typeLine = card.type_line || '';
    if (!typeLine.toLowerCase().includes('land')) {
      const cmc = Math.min(Math.floor(card.cmc || 0), 7);
      const key = cmc >= 7 ? '7+' : cmc;
      manaCurve[key] += entry.quantity;
      totalCmc += (card.cmc || 0) * entry.quantity;
      nonLandCount += entry.quantity;
    }

    // Colour pie (from mana_cost symbols, not color_identity)
    const manaCost = card.mana_cost || card.card_faces?.[0]?.mana_cost || '';
    for (const match of manaCost.matchAll(/\{([WUBRGC])\}/g)) {
      colourPie[match[1]] = (colourPie[match[1]] || 0) + entry.quantity;
    }

    // Type breakdown
    const type = classifyType(typeLine);
    typeBreakdown[type] = (typeBreakdown[type] || 0) + entry.quantity;

    // Tag breakdown
    for (const tag of (entry.tags || [])) {
      tagBreakdown[tag] = (tagBreakdown[tag] || 0) + 1;
    }

    // Price
    const eurPrice = parseFloat(card.prices?.eur || '0');
    const gbpPrice = eurToGbpValue(eurPrice) * entry.quantity;
    totalPrice += gbpPrice;
    if (!entry.owned) unownedPrice += gbpPrice;
    if (gbpPrice > mostExpensive.price) {
      mostExpensive = { name: card.name, price: gbpPrice };
    }
  }

  return {
    manaCurve,
    colourPie,
    typeBreakdown,
    tagBreakdown,
    averageCmc: nonLandCount > 0 ? totalCmc / nonLandCount : 0,
    totalPrice,
    unownedPrice,
    mostExpensive,
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SortableJS with jQuery | SortableJS vanilla (no jQuery required) | SortableJS 1.x (years ago) | No jQuery dependency, direct DOM manipulation |
| Chart.js 2.x global imports | Chart.js 4.x tree-shaking with register() | Chart.js 3.0 (2021) | Already in place -- reuse existing registration |
| Dexie 3.x | Dexie 4.x with improved TypeScript, better hooks | 2023 | Already using 4.4.2 -- no migration needed |
| Tailwind v3 config file | Tailwind v4 CSS-first @theme | 2024 | Already in place -- use existing custom properties |

**Deprecated/outdated:**
- SortableJS `Sortable.create()` static method still works but `new Sortable()` is preferred
- Chart.js `Chart.defaults.global` (v2) replaced by `Chart.defaults` (v3+)

## Open Questions

1. **SortableJS + Alpine Re-render Strategy**
   - What we know: SortableJS mutates DOM, Alpine wants to own DOM rendering
   - What's unclear: Best pattern for preventing conflicts -- revert DOM in onEnd vs. disable SortableJS animation entirely
   - Recommendation: Use `onEnd` to update store data only, and call `sortable.destroy()` / re-init on Alpine re-render. Test both approaches in Wave 1 of implementation.

2. **Deck Cards Index for Cross-Deck Queries (COLL-13)**
   - What we know: COLL-13 requires "Used in decks" display in collection card detail
   - What's unclear: Whether `[deck_id+scryfall_id]` compound index is sufficient or if we need a separate `scryfall_id` index on `deck_cards` for fast "which decks contain card X?" lookups
   - Recommendation: Add `scryfall_id` as a standalone index on `deck_cards` table for this query pattern.

3. **Search Panel: Local Search vs API Fallback**
   - What we know: Phase 1 search uses local IndexedDB first with API fallback for missing cards
   - What's unclear: Whether search panel should always be local-only (since bulk data should be comprehensive) or include API fallback
   - Recommendation: Local-only for deck builder search. Bulk data covers all cards. API fallback unnecessary and would complicate colour identity filtering.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install, build | Assumed present | -- | -- |
| SortableJS | DECK-06 drag-and-drop | Not yet installed | 1.15.7 (npm) | Must install: `npm install sortablejs` |

**Missing dependencies with no fallback:**
- SortableJS must be installed before DECK-06 implementation

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.js` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DECK-01 | Three-panel layout mounts correctly | smoke (manual) | Manual visual check | -- Wave 0 |
| DECK-02 | Search with colour identity filtering | unit | `npx vitest run tests/deck-search.test.js -x` | -- Wave 0 |
| DECK-03 | "In Collection" toggle filters to owned cards | unit | `npx vitest run tests/deck-store.test.js -x` | -- Wave 0 |
| DECK-04 | Grid/list view toggle | smoke (manual) | Manual visual check | -- |
| DECK-05 | Tag CRUD operations | unit | `npx vitest run tests/tag-manager.test.js -x` | -- Wave 0 |
| DECK-06 | SortableJS drag reorder updates store | integration (manual) | Manual interaction test | -- |
| DECK-07 | Card count tracks correctly | unit | `npx vitest run tests/deck-store.test.js -x` | -- Wave 0 |
| DECK-08 | Owned/missing summary computation | unit | `npx vitest run tests/deck-store.test.js -x` | -- Wave 0 |
| DECK-09 | Mana curve computation | unit | `npx vitest run tests/deck-analytics.test.js -x` | -- Wave 0 |
| DECK-10 | Colour pie computation | unit | `npx vitest run tests/deck-analytics.test.js -x` | -- Wave 0 |
| DECK-11 | Type breakdown computation | unit | `npx vitest run tests/deck-analytics.test.js -x` | -- Wave 0 |
| DECK-12 | Tag breakdown computation | unit | `npx vitest run tests/deck-analytics.test.js -x` | -- Wave 0 |
| DECK-13 | Price summary computation (GBP) | unit | `npx vitest run tests/deck-analytics.test.js -x` | -- Wave 0 |
| DECK-14 | Ritual flow: commander creates deck | unit | `npx vitest run tests/deck-store.test.js -x` | -- Wave 0 |
| DECK-15 | Partner/companion detection | unit | `npx vitest run tests/commander-detection.test.js -x` | -- Wave 0 |
| DECK-16 | Import format detection + parsing | unit | `npx vitest run tests/deck-import.test.js -x` | -- Wave 0 |
| DECK-17 | Export format generation | unit | `npx vitest run tests/deck-export.test.js -x` | -- Wave 0 |
| DECK-18 | Context menu renders correct items | integration (manual) | Manual interaction test | -- |
| DECK-19 | Card flyout shows deck usage | integration (manual) | Manual visual check | -- |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/deck-store.test.js` -- covers DECK-03, DECK-07, DECK-08, DECK-14 (deck CRUD, card count, ownership)
- [ ] `tests/deck-analytics.test.js` -- covers DECK-09, DECK-10, DECK-11, DECK-12, DECK-13 (all analytics computations)
- [ ] `tests/deck-search.test.js` -- covers DECK-02 (colour identity filtered search)
- [ ] `tests/commander-detection.test.js` -- covers DECK-15 (partner/companion keyword detection)
- [ ] `tests/deck-import.test.js` -- covers DECK-16 (format detection + parsing for all 4 formats)
- [ ] `tests/deck-export.test.js` -- covers DECK-17 (plain text, MTGO, Arena, CSV export)
- [ ] `tests/tag-manager.test.js` -- covers DECK-05 (tag heuristics + CRUD)
- [ ] `tests/type-classifier.test.js` -- covers type_line classification logic

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/db/schema.js`, `src/stores/collection.js`, `src/components/analytics-panel.js`, `src/components/context-menu.js`, `src/components/card-tile.js`, `src/db/card-accessor.js`, `src/services/mass-entry.js`, `src/workers/bulk-data.worker.js`, `src/workers/bulk-data-pipeline.js`
- [SortableJS GitHub](https://github.com/SortableJS/Sortable) -- API options, group configuration, clone drag
- [SortableJS npm](https://www.npmjs.com/package/sortablejs) -- version 1.15.7 verified
- [MTGGoldfish import formats](https://www.mtggoldfish.com/help/import_formats) -- CSV/text format specifications
- [Scryfall API card objects](https://scryfall.com/docs/api/cards) -- card fields (type_line, keywords, oracle_text, color_identity)

### Secondary (MEDIUM confidence)
- MTG decklist format patterns (Moxfield `// Commander` headers, Archidekt category headers) -- based on community documentation and common export patterns
- Oracle text heuristic patterns for tag suggestion -- based on MTG game rules knowledge, will need tuning in practice

### Tertiary (LOW confidence)
- SortableJS + Alpine.js conflict resolution strategy -- based on general reactive framework + DOM mutation patterns. Needs practical testing.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries verified in project, SortableJS version confirmed on npm
- Architecture: HIGH -- follows established project patterns (stores, components, Dexie schema versioning)
- Pitfalls: HIGH -- based on direct codebase analysis (worker schema mismatch) and well-known framework interaction patterns
- Import/export formats: MEDIUM -- format detection heuristics need real-world testing with actual exports from each platform
- SortableJS + Alpine integration: MEDIUM -- core API is well-documented but the reactivity conflict resolution needs testing

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable stack, no fast-moving dependencies)
