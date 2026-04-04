# Phase 2: Collection Manager (Treasure Cruise) - Research

**Researched:** 2026-04-04
**Domain:** Collection management UI, Dexie schema migration, CSV parsing, Chart.js analytics, virtual scrolling
**Confidence:** HIGH

## Summary

Phase 2 builds the full Collection Manager (Treasure Cruise) screen on top of Phase 1's foundation: Dexie.js database, Alpine.js stores, Scryfall bulk data, card search, and the Organic Brutalism design system. The core technical challenges are: (1) Dexie schema migration to add a `collection` table, (2) three view modes with virtual scrolling reuse, (3) batch text parsing and card resolution for mass entry, (4) CSV import/export with format auto-detection, and (5) Chart.js analytics with tree-shaken imports.

All user data already lives in IndexedDB via Dexie. Card metadata (names, images, prices) is already cached from Scryfall bulk data. Prices come from `prices.eur` and `prices.eur_foil` fields already present in the cards table. The collection table stores ownership records pointing to existing card IDs -- no new API calls needed for core functionality.

**Primary recommendation:** Build the collection Alpine store first (data layer), then views in order (gallery, table, set completion), then mass entry and import/export, then analytics last. Each is independently testable. Reuse existing search and card accessor utilities throughout.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Collection entries stored in a new Dexie table with `scryfall_id` as foreign key to the existing `cards` table. One collection entry = one printing. Card metadata always resolved from the cards table.
- **D-02:** Categories simplified: **Owned** (with quantity) and **Wishlist** only. No Trade Binder, no Lent Out, no borrower tracking. A card CAN be both Owned and on the Wishlist simultaneously.
- **D-03:** No condition tracking in v1 (NM/LP/MP/HP/DMG dropped).
- **D-04:** No user-entered cost basis / acquired price. Pricing is purely market-driven from Scryfall's `prices.eur` and `prices.eur_foil` fields.
- **D-05:** Foil status tracked as a boolean field on each collection entry.
- **D-06:** Simplified from the Stitch mockup -- skip the high-value side panel.
- **D-07:** Gallery card tiles show: card image, name (truncated), EUR market price, set name/code, foil badge if applicable.
- **D-08:** Table view columns: Name, Set, Qty, Foil, Price (EUR), Category. All sortable and filterable.
- **D-09:** Set completion view shows per-set progress bars (owned/total), filterable by rarity tier per COLL-04.
- **D-10:** Virtualised scrolling reuses the Phase 1 custom ~150-line vanilla JS virtual scroller pattern.
- **D-11:** Claude's discretion on toggle buttons vs tabs -- pick whichever fits Organic Brutalism.
- **D-12:** Batch syntax: `{qty}x {name} [{set}] {foil?}` -- no condition, no price.
- **D-13:** Auto-resolve to newest printing by default. Ambiguous/unresolved items flagged with dropdown. User confirms full batch before committing.
- **D-14:** CSV import supports Deckbox, Moxfield, Archidekt, and generic with manual column mapping. Auto-detection based on column headers.
- **D-15:** CSV export of collection data (COLL-10).
- **D-16:** Core analytics only: total value, breakdown by colour/set/rarity, top 10 most valuable. No price gainers/losers.
- **D-17:** Analytics displayed inline on the collection screen -- stats summary at top, detailed breakdowns in collapsible panel.
- **D-18:** Build a "Used in decks" section in card detail view now, showing "No decks yet" placeholder.

### Claude's Discretion
- View mode switching UX (toggle buttons vs tabs)
- Mass entry terminal input UX (textarea with live parsing vs sequential)
- Stats header layout and content within the inline analytics area
- Specific filter/sort controls and their placement

### Deferred Ideas (OUT OF SCOPE)
- Price gainers/losers tracking (requires historical price snapshots)
- Condition tracking (NM/LP/MP/HP/DMG)
- Trade Binder / Lent Out categories with borrower tracking
- Cost basis / acquired price / P&L calculations
- CRITICAL_ASSETS_DETECTED high-value panel from mockup
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COLL-01 | Add cards with quantity, condition, foil, price | D-01/D-03/D-04/D-05 simplify to qty + foil + category. Dexie collection table schema. |
| COLL-02 | Gallery view with filterable/sortable grid | Gallery view component with virtual scroller reuse, filter bar, sort logic. |
| COLL-03 | Table view with sortable/filterable columns | Table component with ghost-border rows, sort state, virtual scrolling. D-08 defines columns. |
| COLL-04 | Set completion view with per-set progress bars | Set completion component querying cards table for set totals, collection table for owned counts. |
| COLL-05 | Mass entry terminal with batch syntax | Regex parser for `{qty}x {name} [{set}] {foil?}`. Dexie search for card resolution. |
| COLL-06 | Unresolved mass entry flagging | Resolution UI showing matched/unmatched entries with dropdown picking. |
| COLL-07 | Inventory categories | D-02 simplifies to Owned + Wishlist only. Category field on collection entries. |
| COLL-08 | Collection analytics | Chart.js tree-shaken (bar, doughnut). D-16 scopes to value, colour, set, rarity, top 10. |
| COLL-09 | CSV import (Deckbox, Moxfield, Archidekt, generic) | Format auto-detection via header matching. PapaParse for CSV parsing. Column mapping for generic. |
| COLL-10 | CSV export | Generate CSV from collection + cards join, trigger browser download. |
| COLL-11 | Virtualised scrolling at 1,000+ cards | Reuse Phase 1 virtual scroller pattern (D-10). |
| COLL-12 | Edit and delete collection entries | Inline edit via context menu, delete with confirmation modal. |
| COLL-13 | Cards show which decks they appear in | D-18: placeholder "No decks yet" section in card detail flyout. Phase 3 wires real data. |
</phase_requirements>

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Dexie.js | 4.4.2 | IndexedDB collection table, queries, schema migration | Already in project, handles versioning and compound indexes |
| Alpine.js | 3.15.x | Reactive collection store, UI bindings | Project standard reactivity layer |
| Chart.js | 4.5.1 | Analytics charts (doughnut, bar) | Declared in project stack, tree-shakeable |

### New Dependencies

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| PapaParse | 5.5.3 | CSV parsing and generation | CSV import/export (COLL-09, COLL-10). Handles edge cases: quoted fields, UTF-8 BOM, newlines in values, delimiter detection. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PapaParse | Manual CSV parsing | PapaParse handles edge cases (quoted commas, UTF-8 BOM, newlines in fields) that manual split/regex would miss. ~7KB gzipped. Worth it. |
| PapaParse | d3-dsv | Smaller but no streaming, no auto-detection, less battle-tested for MTG CSV imports |

**Installation:**
```bash
npm install chart.js papaparse
```

**Version verification:** chart.js 4.5.1 (verified via npm), papaparse 5.5.3 (verified via npm), dexie 4.4.2 (already installed).

## Architecture Patterns

### New Files Structure

```
src/
├── db/
│   └── schema.js           # MODIFY: Add version(2) with collection table
├── stores/
│   └── collection.js        # NEW: Alpine.store('collection') -- all collection state
├── services/
│   ├── csv-import.js         # NEW: CSV parsing, format detection, column mapping
│   ├── csv-export.js         # NEW: CSV generation and download trigger
│   └── mass-entry.js         # NEW: Batch syntax parser and card resolution
├── screens/
│   └── treasure-cruise.js    # REPLACE: Full collection manager screen
├── components/
│   ├── gallery-view.js       # NEW: Card image grid with virtual scrolling
│   ├── table-view.js         # NEW: Spreadsheet-style sortable table
│   ├── set-completion.js     # NEW: Per-set progress bars
│   ├── filter-bar.js         # NEW: Sort, colour pips, category filter, action buttons
│   ├── stats-header.js       # NEW: Summary stats (total cards, value, etc.)
│   ├── analytics-panel.js    # NEW: Chart.js charts in collapsible panel
│   ├── add-card-modal.js     # NEW: Single card add with search
│   ├── mass-entry-panel.js   # NEW: Batch input terminal UI
│   ├── csv-import-modal.js   # NEW: File picker, preview, column mapping
│   ├── context-menu.js       # NEW: Right-click card actions
│   └── delete-confirm.js     # NEW: Destructive action confirmation
└── styles/
    └── utilities.css         # MODIFY: Add Phase 2 CSS utilities
```

### Pattern 1: Dexie Schema Version Bump

**What:** Add collection table via `db.version(2).stores()`. Dexie handles the upgrade automatically when opening the database -- no manual migration needed since it is a new table with no data to transform.

**When to use:** Adding the collection table to the existing database.

**Example:**
```javascript
// Source: Dexie.js docs (https://dexie.org/docs/Version/Version.upgrade())
// In src/db/schema.js -- add AFTER existing version(1)

db.version(2).stores({
  // Existing tables must be redeclared (Dexie merges, but explicit is safer)
  cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
  meta: 'key',
  // New collection table
  collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]'
});
```

**Key fields:**
- `++id` -- auto-incrementing primary key
- `scryfall_id` -- foreign key to cards table
- `category` -- 'owned' or 'wishlist'
- `foil` -- boolean (0/1 in IndexedDB)
- `quantity` -- number (not indexed, stored as property)
- `added_at` -- ISO timestamp (not indexed, stored as property)
- Compound indexes `[scryfall_id+foil]` and `[scryfall_id+category]` for duplicate detection

### Pattern 2: Alpine Collection Store

**What:** Central state management for all collection data, filters, sort, and view mode.

**When to use:** All collection screen interactions go through this store.

**Example:**
```javascript
// src/stores/collection.js
import Alpine from 'alpinejs';
import { db } from '../db/schema.js';

export function initCollectionStore() {
  Alpine.store('collection', {
    entries: [],           // Collection entries joined with card data
    viewMode: 'gallery',   // 'gallery' | 'table' | 'sets'
    sortBy: 'name-asc',
    filters: {
      colours: [],         // ['W', 'U', 'B', 'R', 'G']
      category: 'all',     // 'all' | 'owned' | 'wishlist'
    },
    analyticsOpen: false,
    loading: false,

    get filtered() {
      let items = this.entries;
      if (this.filters.category !== 'all') {
        items = items.filter(e => e.category === this.filters.category);
      }
      if (this.filters.colours.length > 0) {
        items = items.filter(e =>
          this.filters.colours.some(c => e.card?.color_identity?.includes(c))
        );
      }
      return items;
    },

    get sorted() {
      // Sort logic applied to this.filtered
      return sortEntries(this.filtered, this.sortBy);
    },

    async loadEntries() {
      this.loading = true;
      const raw = await db.collection.toArray();
      // Join with cards table for display data
      const cardIds = [...new Set(raw.map(e => e.scryfall_id))];
      const cards = await db.cards.where('id').anyOf(cardIds).toArray();
      const cardMap = Object.fromEntries(cards.map(c => [c.id, c]));

      this.entries = raw.map(entry => ({
        ...entry,
        card: cardMap[entry.scryfall_id] || null,
      }));
      this.loading = false;
    },

    async addCard(scryfallId, quantity, foil, category) {
      // Check for duplicate (same card + foil status)
      const existing = await db.collection
        .where('[scryfall_id+foil]')
        .equals([scryfallId, foil ? 1 : 0])
        .first();

      if (existing) {
        await db.collection.update(existing.id, {
          quantity: existing.quantity + quantity,
        });
      } else {
        await db.collection.add({
          scryfall_id: scryfallId,
          quantity,
          foil: foil ? 1 : 0,
          category,
          added_at: new Date().toISOString(),
        });
      }
      await this.loadEntries();
    },
  });
}
```

### Pattern 3: Chart.js Tree-Shaken Import

**What:** Import only the chart types and components needed, not the full Chart.js bundle.

**When to use:** Analytics panel rendering.

**Example:**
```javascript
// Source: Chart.js docs (https://www.chartjs.org/docs/latest/getting-started/integration.html)
import {
  Chart,
  DoughnutController,
  BarController,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';

Chart.register(
  DoughnutController, BarController,
  ArcElement, BarElement,
  CategoryScale, LinearScale,
  Tooltip, Legend
);

// Then create charts with new Chart(ctx, { type: 'doughnut', ... })
```

### Pattern 4: CSV Format Auto-Detection

**What:** Detect which MTG platform exported a CSV based on column headers.

**When to use:** CSV import flow.

**Example:**
```javascript
// Known column header signatures for auto-detection
const FORMAT_SIGNATURES = {
  deckbox: ['Count', 'Tradelist Count', 'Name', 'Edition', 'Condition', 'Language', 'Foil'],
  moxfield: ['Count', 'Tradelist Count', 'Name', 'Edition', 'Condition', 'Language', 'Foil', 'Tags', 'Last Modified', 'Collector Number'],
  archidekt: ['export_type', 'scryfall_uuid', 'set_code', 'quantity', 'foil_quantity', 'card_name'],
};

function detectFormat(headers) {
  // Archidekt uses semicolons -- PapaParse auto-detects delimiter
  for (const [format, sig] of Object.entries(FORMAT_SIGNATURES)) {
    const normalised = headers.map(h => h.trim());
    if (sig.every(col => normalised.includes(col))) return format;
  }
  return 'generic';
}
```

### Pattern 5: Batch Syntax Parser

**What:** Parse mass entry lines into structured objects.

**When to use:** Mass entry terminal.

**Example:**
```javascript
// Pattern: {qty}x {name} [{set}] {foil?}
const BATCH_LINE_REGEX = /^(\d+)x?\s+(.+?)(?:\s+\[(\w+)\])?(\s+foil)?$/i;

function parseBatchLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const match = trimmed.match(BATCH_LINE_REGEX);
  if (!match) return { raw: trimmed, parsed: false };

  return {
    raw: trimmed,
    parsed: true,
    quantity: parseInt(match[1], 10),
    name: match[2].trim(),
    setCode: match[3] || null,
    foil: !!match[4],
  };
}
```

### Anti-Patterns to Avoid

- **Embedding card data in collection entries:** The cards table already has all metadata. Collection entries reference by `scryfall_id` only (D-01). Never duplicate name, image, price into collection rows.
- **Full table scans for filtering:** Use Dexie compound indexes for lookups (e.g., `[scryfall_id+foil]` for duplicate detection). Filter/sort in memory after the initial load since collection sizes are manageable (thousands, not millions).
- **Registering all Chart.js components:** Tree-shake by importing only DoughnutController, BarController, and required elements. Full import adds ~60KB unnecessary code.
- **Building CSV parser from scratch:** Edge cases (quoted commas, UTF-8 BOM, newlines in quoted fields, various delimiters) make hand-rolled parsers unreliable. Use PapaParse.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing | String.split(',') parser | PapaParse 5.5.3 | Quoted fields, BOM, delimiter detection, streaming for large files. MTG card names contain commas (e.g., "Kozilek, the Great Distortion"). |
| CSV generation | Manual string concatenation | PapaParse `Papa.unparse()` | Handles proper quoting and escaping for card names with commas/quotes. |
| Charts | Canvas drawing or SVG charts | Chart.js 4.5.1 (tree-shaken) | Already in stack. Doughnut + bar covers all analytics needs. Tooltip, legend, responsive sizing built-in. |
| Virtual scrolling | New implementation | Reuse Phase 1 vanilla virtual scroller | D-10 explicitly mandates reuse. Already handles recycling and smooth scrolling. |

**Key insight:** The biggest complexity trap is CSV import. MTG card names regularly contain commas, quotes, and special characters. Different platforms use different delimiters (Archidekt uses semicolons), different column names for the same data, and different value encodings for foil status. PapaParse eliminates all of this for ~7KB gzipped.

## Common Pitfalls

### Pitfall 1: Dexie Compound Index Gotcha with Booleans

**What goes wrong:** Dexie stores booleans as-is in IndexedDB, but IndexedDB does not index boolean values. Compound indexes like `[scryfall_id+foil]` will silently fail if foil is stored as `true`/`false`.

**Why it happens:** IndexedDB spec only indexes strings, numbers, dates, and binary keys. Booleans are non-indexable.

**How to avoid:** Store foil as `1`/`0` (number), not `true`/`false` (boolean). All queries on foil must use numeric comparison.

**Warning signs:** `.where('[scryfall_id+foil]').equals([id, true])` returns empty when records exist.

### Pitfall 2: Alpine Reactivity with Large Arrays

**What goes wrong:** Alpine wraps arrays in Proxies. With 5,000+ collection entries, re-rendering all entries on every filter/sort change causes jank.

**Why it happens:** Alpine's reactivity tracks all array mutations. Replacing the entire `entries` array triggers full re-render.

**How to avoid:** Virtual scrolling limits DOM nodes to ~50 visible items. The store computes `filtered` and `sorted` as getters. Only the visible window re-renders. Use `Object.freeze()` on card metadata objects to prevent Alpine from deep-proxying read-only Scryfall data.

**Warning signs:** Scroll lag after collection exceeds ~500 cards. Browser memory climbing from Alpine Proxy overhead.

### Pitfall 3: CSV Import Card Name Matching

**What goes wrong:** Card names from CSV exports don't exactly match Scryfall names. Double-faced cards are especially problematic (Deckbox: "Delver of Secrets", Scryfall: "Delver of Secrets // Insectile Aberration").

**Why it happens:** Different platforms store card names differently. Some include both faces, some only the front face. Some add extra whitespace or use different apostrophe characters.

**How to avoid:** Normalise before matching: lowercase, trim, strip diacritics. For double-faced cards, try matching on front face name only (split on " // " and use first part). Fallback to fuzzy search if exact match fails. Use `searchCards()` from Phase 1 as the resolution engine.

**Warning signs:** Import reports 30%+ unresolved cards from a valid Deckbox export.

### Pitfall 4: Chart.js Memory Leaks

**What goes wrong:** Creating new Chart instances without destroying old ones causes canvas memory leaks.

**Why it happens:** Chart.js allocates canvas context and event listeners. If you re-create charts without calling `.destroy()`, old instances persist.

**How to avoid:** Store chart instances in the analytics panel. Call `chart.destroy()` before creating new ones, and always destroy when the analytics panel closes. Use a cleanup pattern:

```javascript
let colourChart = null;
function renderColourChart(ctx, data) {
  if (colourChart) colourChart.destroy();
  colourChart = new Chart(ctx, { ... });
}
```

**Warning signs:** Canvas elements consuming increasing memory. Charts not updating with new data.

### Pitfall 5: Set Completion Counting Is Non-Trivial

**What goes wrong:** Counting "total cards in a set" requires knowing the full set card list from Scryfall. The bulk data already has this, but filtering by rarity tier while counting requires careful query design.

**Why it happens:** A set may have 300 cards but only 15 mythic rares. Completion percentage per rarity must query the cards table grouped by set + rarity.

**How to avoid:** Pre-compute set totals on collection load: query `db.cards.where('set').equals(setCode)` grouped by rarity, then compare against `db.collection` entries for that set. Cache these counts in the store -- don't recompute on every render.

**Warning signs:** Set completion view taking 2+ seconds to render. Unnecessary repeated DB queries.

## Code Examples

### Dexie Schema v2 Migration

```javascript
// Source: Existing src/db/schema.js pattern + Dexie docs
// Add after existing version(1) block in src/db/schema.js

db.version(2).stores({
  cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
  meta: 'key',
  collection: '++id, scryfall_id, category, foil, [scryfall_id+foil], [scryfall_id+category]'
});
```

### Collection Entry CRUD

```javascript
// Add a card to collection
async function addToCollection(scryfallId, qty, foil, category) {
  const foilNum = foil ? 1 : 0;
  const existing = await db.collection
    .where('[scryfall_id+foil]')
    .equals([scryfallId, foilNum])
    .and(e => e.category === category)
    .first();

  if (existing) {
    return db.collection.update(existing.id, { quantity: existing.quantity + qty });
  }
  return db.collection.add({
    scryfall_id: scryfallId,
    quantity: qty,
    foil: foilNum,
    category,
    added_at: new Date().toISOString(),
  });
}

// Delete a collection entry
async function removeFromCollection(entryId) {
  return db.collection.delete(entryId);
}

// Update quantity or foil status
async function updateCollectionEntry(entryId, updates) {
  return db.collection.update(entryId, updates);
}
```

### CSV Import with PapaParse

```javascript
// Source: PapaParse docs
import Papa from 'papaparse';

function importCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete(results) {
        const format = detectFormat(results.meta.fields);
        const normalised = results.data.map(row =>
          normaliseRow(row, format)
        );
        resolve({ format, entries: normalised, errors: results.errors });
      },
      error(err) { reject(err); },
    });
  });
}

// Normalise a row from any format to our internal shape
function normaliseRow(row, format) {
  switch (format) {
    case 'deckbox':
      return {
        name: row['Name'],
        quantity: parseInt(row['Count'], 10) || 1,
        setName: row['Edition'] || null,
        foil: (row['Foil'] || '').toLowerCase() === 'foil',
      };
    case 'moxfield':
      return {
        name: row['Name'],
        quantity: parseInt(row['Count'], 10) || 1,
        setCode: row['Edition'] || null,
        collectorNumber: row['Collector Number'] || null,
        foil: ['foil', 'etched'].includes((row['Foil'] || '').toLowerCase()),
      };
    case 'archidekt':
      return {
        name: row['card_name'] || row['english_card_name'],
        quantity: parseInt(row['quantity'], 10) || 1,
        setCode: row['set_code'] || null,
        scryfallId: row['scryfall_uuid'] || null,
        foil: parseInt(row['foil_quantity'], 10) > 0,
      };
    default:
      return { name: row['Name'] || row['name'], quantity: parseInt(row['Quantity'] || row['Count'] || '1', 10) };
  }
}
```

### CSV Export

```javascript
import Papa from 'papaparse';

function exportCollection(entries) {
  const rows = entries.map(e => ({
    Name: e.card?.name || '',
    Set: e.card?.set_name || '',
    'Set Code': e.card?.set || '',
    'Collector Number': e.card?.collector_number || '',
    Quantity: e.quantity,
    Foil: e.foil ? 'foil' : '',
    'Price EUR': e.foil
      ? (e.card?.prices?.eur_foil || '')
      : (e.card?.prices?.eur || ''),
    Category: e.category,
  }));

  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `counterflux-collection-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Chart.js Colour Doughnut

```javascript
// Source: Chart.js 4 docs + UI-SPEC Chart.js Configuration Contract
import { Chart, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js';
Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

const MTG_COLOURS = {
  W: { label: 'White', hex: '#F9FAF4' },
  U: { label: 'Blue', hex: '#0E68AB' },
  B: { label: 'Black', hex: '#150B00' },
  R: { label: 'Red', hex: '#D3202A' },
  G: { label: 'Green', hex: '#00733E' },
  C: { label: 'Colourless', hex: '#CBC2BF' },
  M: { label: 'Multi', hex: '#E3C15A' },
};

function renderColourChart(canvas, colourCounts) {
  return new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: Object.values(MTG_COLOURS).map(c => c.label),
      datasets: [{
        data: Object.keys(MTG_COLOURS).map(k => colourCounts[k] || 0),
        backgroundColor: Object.values(MTG_COLOURS).map(c => c.hex),
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: {
            font: { family: "'JetBrains Mono'", size: 11, weight: 400 },
            color: '#7A8498',
          },
        },
        tooltip: {
          backgroundColor: '#1C1F28',
          borderColor: '#2A2D3A',
          borderWidth: 1,
          titleFont: { family: "'JetBrains Mono'", size: 11 },
          bodyFont: { family: "'JetBrains Mono'", size: 11 },
          bodyColor: '#EAECEE',
        },
      },
      animation: { duration: 400, easing: 'easeOutQuart' },
    },
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Chart.js full bundle import | Tree-shaken component registration | Chart.js 3.0+ (2021) | ~40KB savings by importing only needed controllers/elements |
| Dexie v3 hooks API | Dexie v4 native async/await, liveQuery | Dexie 4.0 (2024) | Simpler reactive queries, better TypeScript support |
| Manual CSV parsing | PapaParse with streaming | Stable since 2015 | Handles all edge cases, ~7KB gzipped |

**Deprecated/outdated:**
- Dexie `db.on('populate')` for seed data: still works but `version().upgrade()` is the documented pattern for schema changes.

## Open Questions

1. **Virtual scroller reuse specifics**
   - What we know: Phase 1 built a ~150-line vanilla JS virtual scroller. D-10 mandates reuse.
   - What's unclear: The exact API surface and whether it handles both grid (gallery) and list (table) layouts, or just one.
   - Recommendation: Inspect the Phase 1 virtual scroller implementation at execution time. It may need minor adaptation for gallery grid layout vs table rows, but the core recycling logic should transfer.

2. **Card detail flyout location**
   - What we know: Phase 1 has a card-flyout component used by search. Phase 2 needs "Used in Decks" placeholder and "Add to Collection" functionality in it.
   - What's unclear: Whether the flyout is a standalone component or embedded in the search store.
   - Recommendation: Inspect `src/components/` for flyout implementation. May need to extract it to be reusable from both search and collection screens.

3. **Archidekt semicolon delimiter**
   - What we know: Archidekt CSV exports use semicolons as delimiter, not commas.
   - What's unclear: Whether this is consistent across all Archidekt export types.
   - Recommendation: PapaParse's `delimiter: ''` (auto-detect) handles this. Test with a real Archidekt export.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.js` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COLL-01 | Add card with qty/foil/category to Dexie | unit | `npx vitest run tests/collection-store.test.js -t "add card"` | Wave 0 |
| COLL-02 | Gallery view filters and sorts | unit | `npx vitest run tests/collection-store.test.js -t "filter"` | Wave 0 |
| COLL-03 | Table view sorts on columns | unit | `npx vitest run tests/collection-store.test.js -t "sort"` | Wave 0 |
| COLL-04 | Set completion calculates progress | unit | `npx vitest run tests/set-completion.test.js` | Wave 0 |
| COLL-05 | Batch syntax parser resolves lines | unit | `npx vitest run tests/mass-entry.test.js -t "parse"` | Wave 0 |
| COLL-06 | Unresolved entries flagged correctly | unit | `npx vitest run tests/mass-entry.test.js -t "unresolved"` | Wave 0 |
| COLL-07 | Category filter works (owned/wishlist/all) | unit | `npx vitest run tests/collection-store.test.js -t "category"` | Wave 0 |
| COLL-08 | Analytics compute correct breakdowns | unit | `npx vitest run tests/analytics.test.js` | Wave 0 |
| COLL-09 | CSV import detects format, normalises rows | unit | `npx vitest run tests/csv-import.test.js` | Wave 0 |
| COLL-10 | CSV export generates valid output | unit | `npx vitest run tests/csv-export.test.js` | Wave 0 |
| COLL-11 | Virtual scroll renders correct window | unit | `npx vitest run tests/virtual-scroll.test.js` | Depends on Phase 1 impl |
| COLL-12 | Edit/delete updates Dexie correctly | unit | `npx vitest run tests/collection-store.test.js -t "edit"` | Wave 0 |
| COLL-13 | Deck usage placeholder renders | manual-only | Visual check in browser | N/A |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/collection-store.test.js` -- covers COLL-01, COLL-02, COLL-03, COLL-07, COLL-12
- [ ] `tests/mass-entry.test.js` -- covers COLL-05, COLL-06
- [ ] `tests/csv-import.test.js` -- covers COLL-09
- [ ] `tests/csv-export.test.js` -- covers COLL-10
- [ ] `tests/analytics.test.js` -- covers COLL-08
- [ ] `tests/set-completion.test.js` -- covers COLL-04
- [ ] PapaParse install: `npm install papaparse`
- [ ] Chart.js install: `npm install chart.js`

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/db/schema.js`, `src/stores/app.js`, `src/stores/search.js`, `src/stores/bulkdata.js` -- established patterns
- [Dexie.js Version.upgrade() docs](https://dexie.org/docs/Version/Version.upgrade()) -- schema migration
- [Chart.js Integration docs](https://www.chartjs.org/docs/latest/getting-started/integration.html) -- tree-shaking
- Phase 2 CONTEXT.md -- all 18 locked decisions
- Phase 2 UI-SPEC.md -- full design contract

### Secondary (MEDIUM confidence)
- [Deckbox CSV format](https://deckbox.org/forum/viewtopic.php?id=29071) -- column headers from forum posts
- [Moxfield CSV format](https://moxfield.com/help/importing-collection) -- column headers from help docs
- [Archidekt CSV format](https://archidekt.com/forum/thread/8054462) -- column headers from forum discussions
- [PapaParse npm](https://www.npmjs.com/package/papaparse) -- version 5.5.3 verified

### Tertiary (LOW confidence)
- Archidekt semicolon delimiter claim -- from community forum posts, needs validation with real export file

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project or verified current versions
- Architecture: HIGH -- follows established Phase 1 patterns (Alpine stores, screen modules, Dexie schema)
- Pitfalls: HIGH -- Dexie boolean indexing is well-documented, Chart.js memory leaks are common knowledge, CSV edge cases are well-understood
- CSV format headers: MEDIUM -- sourced from forum posts and help docs, may have minor variations

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable libraries, no fast-moving dependencies)
