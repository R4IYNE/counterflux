# Architecture Patterns

**Domain:** MTG Collection/Deckbuilding Command Centre (Local-First SPA)
**Researched:** 2026-04-03

## Recommended Architecture

### High-Level Structure

```
[Vite Dev Server / Build]
         |
    [index.html]
         |
    [app.js] ──── [Navigo Router] ──── [Screen Modules]
         |                                    |
    [Alpine.js]                    [Dashboard | Collection | DeckBuilder | Market | Game]
         |                                    |
    [Alpine.store()] ────────────── [Shared State (active deck, search, notifications)]
         |
    [Data Layer]
    ├── [Dexie.js] ──── IndexedDB (user data: collection, decks, games)
    ├── [ScryfallService] ──── Scryfall REST API (card data, prices, symbols)
    └── [BulkDataCache] ──── IndexedDB (Scryfall bulk data for offline)
```

### Directory Structure

```
counterflux/
├── index.html                    # Single HTML entry point
├── vite.config.js
├── tailwind.config.js
├── package.json
│
├── src/
│   ├── styles.css                # Tailwind entry + @theme + font imports
│   ├── app.js                    # Alpine init, router setup, global stores
│   ├── router.js                 # Navigo configuration
│   │
│   ├── stores/                   # Alpine.store() modules
│   │   ├── collection.js         # Collection CRUD, filtering, sorting state
│   │   ├── deck.js               # Active deck state + card add/remove/move
│   │   ├── game.js               # Game tracker state (life, damage, turns)
│   │   ├── search.js             # Global card search query + results
│   │   └── notifications.js      # Toast/alert state
│   │
│   ├── services/                 # Data access layer
│   │   ├── db.js                 # Dexie schema + instance + migrations
│   │   ├── scryfall.js           # Scryfall API client (rate-limited queue)
│   │   ├── bulk-data.js          # Bulk data download + cache management
│   │   ├── price-service.js      # Price lookup + alert checking
│   │   ├── edhrec.js             # EDHREC synergy/recommendation proxy
│   │   ├── combos.js             # Commander Spellbook integration
│   │   └── import-export.js      # CSV/decklist import/export
│   │
│   ├── workers/
│   │   └── bulk-import.worker.js # Web Worker for bulk JSON parsing
│   │
│   ├── screens/                  # Screen-level Alpine components (lazy loaded)
│   │   ├── dashboard.js          # Epic Experiment
│   │   ├── collection.js         # Treasure Cruise
│   │   ├── deck-builder.js       # Thousand-Year Storm
│   │   ├── market.js             # Preordain
│   │   └── game-tracker.js       # Vandalblast
│   │
│   ├── components/               # Reusable Alpine component functions
│   │   ├── card-grid.js          # Virtual scrolling card grid
│   │   ├── card-table.js         # Sortable/filterable data table
│   │   ├── card-preview.js       # Card image + hover details
│   │   ├── card-search.js        # Autocomplete search bar
│   │   ├── mana-cost.js          # Mana cost rendering helper
│   │   ├── life-counter.js       # Game life total widget
│   │   ├── damage-tracker.js     # Commander damage matrix
│   │   ├── dice-roller.js        # D6/D20 roller
│   │   ├── deck-analytics.js     # Chart.js mana curve + stats
│   │   ├── deck-list.js          # The 99 with categories
│   │   ├── context-menu.js       # Right-click context menu
│   │   ├── virtual-list.js       # Generic virtual scroll container
│   │   ├── modal.js              # Modal dialog
│   │   ├── toast.js              # Toast notification
│   │   ├── price-chart.js        # Price trend sparkline
│   │   └── mila-widget.js        # Mila familiar (tips, empty states)
│   │
│   ├── utils/                    # Pure utility functions
│   │   ├── mana-parser.js        # Parse "{2}{U}{R}" to mana-font HTML
│   │   ├── csv.js                # CSV import/export helpers
│   │   ├── debounce.js           # Debounce for search input
│   │   ├── format.js             # Price formatting, date formatting
│   │   └── keyboard.js           # Keyboard shortcut registration
│   │
│   └── assets/
│       ├── mila/                 # Corgi mascot illustrations
│       └── izzet-logo.svg        # Guild logo
│
├── public/
│   ├── sw.js                     # Service Worker (registered from app.js)
│   └── manifest.json             # PWA manifest
│
└── tests/
    ├── stores/                   # Store unit tests
    ├── services/                 # Service tests
    └── utils/                    # Utility tests
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Router (Navigo)** | URL-to-screen mapping, lazy loading, navigation guards | All screens (loads/unloads) |
| **Alpine.store('collection')** | Collection CRUD, filtering, sorting state | Dexie (persistence), Deck Builder (owned/missing), Dashboard (stats) |
| **Alpine.store('deck')** | Active deck state, card add/remove/move, analytics recalc | Dexie (persistence), Collection store (owned check), Chart.js (analytics) |
| **Alpine.store('game')** | Life totals, commander damage, turn log, game history | Dexie (persistence), Game Tracker screen |
| **Alpine.store('search')** | Global search query + results, autocomplete | Scryfall API, Dexie card cache, all screens with search |
| **Alpine.store('notifications')** | Toast queue, alert state | All stores (on success/error), Toast component |
| **ScryfallService** | API calls with rate limiting (75ms queue) + IndexedDB caching | All stores that need card data |
| **Dexie DB** | Schema, migrations, indexed queries, bulk operations | All stores for persistence |
| **BulkDataCache** | Download/update Scryfall bulk data via Web Worker | ScryfallService (offline fallback), Web Worker |
| **Web Worker** | Parse bulk JSON without blocking main thread | BulkDataCache, IndexedDB (direct write in worker) |
| **Service Worker** | Offline caching (app shell + card images), background refresh | Cache API, network |

### Data Flow

**Card data flow (Scryfall to UI):**
```
Scryfall Bulk API (/bulk-data endpoint)
    |
    v
Web Worker (download + stream-parse JSON, trim to essential fields)
    |
    v
IndexedDB "cards" store via Dexie (27K+ oracle cards, indexed by name/set/type/color)
    |
    v
ScryfallService.search(query) → Dexie indexed query first, API fallback
    |
    v
Alpine.store('search').results = [...]  (Alpine reactivity)
    |
    v
UI re-renders (card-grid, card-preview, search results)
```

**User action flow (add card to collection):**
```
User clicks "Add to Collection" on card-preview
    |
    v
Alpine.store('collection').addCard(scryfallCard, { quantity, condition, foil })
    |
    v
Dexie transaction: db.collection.put({ cardId, name, quantity, condition, foil, location, addedAt })
    |
    v
Alpine reactivity updates all bound UI:
  - Collection screen: card count updates, gallery refreshes
  - Deck Builder sidebar: owned/missing counts recalculate
  - Dashboard: portfolio value recalculates
```

**User action flow (build a deck):**
```
User creates deck with commander
    |
    v
Alpine.store('deck').createDeck({ name, commander: scryfallId, format: 'commander' })
    |
    v
Dexie: db.decks.put({ id, name, commander, cards: [], categories: {}, createdAt })
    |
    v
User adds cards via search panel → Alpine.store('deck').addCard(deckId, scryfallId, category)
    |
    v
Deck analytics recalculate: mana curve, color pie, card types (<100ms for 100 cards)
Collection overlay updates: owned vs missing counts from collection store cross-reference
```

**Search flow (with rate limiting):**
```
User types in search bar
    |
    v
Debounce (200ms)
    |
    v
ScryfallService.autocomplete(query)
    |
    v
1. Check Dexie cards table first (IndexedDB name index)
     → Cache hit? Return immediately
     → Cache miss? Continue to step 2
2. Scryfall API call (rate limited: 75ms min between requests)
     → Store response in Dexie cards table
     → Return to Alpine store → UI updates
```

## IndexedDB Schema Design (Dexie.js)

Use **Dexie.js** (~16KB) as the IndexedDB wrapper. Dexie provides promise-based API, schema versioning, compound indexes, and `bulkPut()` for batch operations. Raw IndexedDB's callback API is too error-prone for an app of this complexity.

### Database: `counterflux`

```javascript
// services/db.js
import Dexie from 'dexie';

export const db = new Dexie('counterflux');

db.version(1).stores({
  // Scryfall bulk data cache (trimmed fields)
  cards: 'id, oracle_id, name, set, type_line, *color_identity, cmc, rarity, edhrec_rank, [name+set]',
  
  // User's card collection
  collection: '++id, cardId, oracle_id, set, location, [cardId+condition+foil], addedAt',
  
  // User's decks
  decks: 'id, format, updatedAt',
  
  // Game history
  games: 'id, date, deckId, result',
  
  // Price watchlist
  watchlist: 'cardId, addedAt',
  
  // App metadata (bulk data version, settings, last sync)
  meta: 'key'
});
```

### Store Details

**`cards` store** (Scryfall bulk data cache)

Store a **trimmed subset** of each Scryfall card object. The full Scryfall object has 200+ fields -- only ~25 are needed.

```javascript
// Trimmed card shape (~2-3KB per card vs ~8-12KB raw)
{
  id: 'scryfall-uuid',              // Key path
  oracle_id: 'oracle-uuid',         // For dedup across printings
  name: 'Lightning Bolt',           // Autocomplete, search
  mana_cost: '{R}',                 // Display, analytics
  cmc: 1,                           // Mana curve analysis
  type_line: 'Instant',             // Deck analytics (creature/instant/etc)
  oracle_text: 'Lightning Bolt...',  // Card text display
  color_identity: ['R'],            // Commander color filtering (multi-entry index)
  colors: ['R'],                    // Color display
  set: 'lea',                       // Set-completion views
  set_name: 'Limited Edition Alpha',
  collector_number: '161',
  rarity: 'common',                 // Filtering
  image_uris: {                     // Card display (CDN URLs, not blobs)
    small: 'https://cards.scryfall.io/small/...',
    normal: 'https://cards.scryfall.io/normal/...',
    art_crop: 'https://cards.scryfall.io/art_crop/...'
  },
  card_faces: [...],                // For double-faced cards
  prices: { usd: '0.25', usd_foil: '1.50' },
  legalities: { commander: 'legal' },
  edhrec_rank: 42,                  // Popularity sorting
  keywords: ['Haste'],              // Rules-aware filtering
  produced_mana: ['R'],             // Mana source detection
  power: '3', toughness: '2',      // Creature stats
  loyalty: null                     // Planeswalker loyalty
}
```

**Estimated storage: ~60-80MB** for ~27K oracle cards with trimmed fields. Well within IndexedDB limits (Chrome allows 60% of available disk space).

**Index rationale:**
- `name`: Autocomplete search, alphabetical sorting
- `set`: Set-completion views, set filtering
- `type_line`: Deck analytics breakdown
- `*color_identity`: Multi-entry index -- a card with `['U', 'R']` is findable by either color
- `cmc`: Mana curve analysis, CMC filtering
- `edhrec_rank`: Popularity sorting
- `[name+set]`: Compound index for "exact card in specific set" lookups

**`collection` store** (user's owned cards)

```javascript
{
  id: autoIncrement,                 // Key path
  cardId: 'scryfall-uuid',          // Which card (FK to cards store)
  oracle_id: 'oracle-uuid',         // "Do I own any printing?" lookups
  name: 'Lightning Bolt',           // Denormalized for fast display without join
  set: 'lea',                       // Set-completion tracking
  quantity: 4,
  condition: 'NM',                  // NM/LP/MP/HP/DMG
  foil: false,
  location: 'Trade Binder',         // Inventory category
  notes: '',
  addedAt: Date.now(),
  updatedAt: Date.now()
}
```

The `[cardId+condition+foil]` compound index uniquely identifies a collection entry -- you might own 2x NM non-foil and 1x LP foil of the same card.

**`decks` store**

```javascript
{
  id: 'uuid',                       // Key path
  name: 'Izzet Spellslinger',
  format: 'commander',
  commander: 'scryfall-uuid',       // Commander card ID
  partner: null,                    // Partner commander (or null)
  cards: [                          // Embedded array (max 99 cards)
    { cardId: 'scryfall-uuid', quantity: 1, category: 'Ramp' }
  ],
  categories: ['Ramp', 'Draw', 'Removal', 'Win Conditions', 'Lands'],
  description: '',
  tags: ['casual', 'spellslinger'],
  createdAt: Date.now(),
  updatedAt: Date.now()
}
```

Cards are embedded, not in a separate store. A Commander deck has exactly 100 cards -- this is not a scale problem. Embedding avoids expensive join-like lookups when loading a deck.

**`games` store**

```javascript
{
  id: 'uuid',                       // Key path
  date: Date.now(),                  // For history browsing
  deckId: 'deck-uuid',              // Per-deck win rate tracking
  players: [
    { name: 'You', commander: 'scryfall-uuid', startingLife: 40 },
    { name: 'Opponent 1', commander: null, startingLife: 40 }
  ],
  turns: [
    {
      turnNumber: 1,
      events: [
        { type: 'life_change', playerId: 0, value: -3 },
        { type: 'commander_damage', from: 1, to: 0, value: 5 },
        { type: 'poison', playerId: 0, value: 2 }
      ]
    }
  ],
  result: 'win',                    // win/loss/draw
  duration: null,                   // Minutes (optional)
  notes: 'Close game, won with Cyclonic Rift',
  createdAt: Date.now()
}
```

A game has 5-15 turns with a few events each. Tens of KB at most per game. Events cover: life change, commander damage, poison counters, monarch/initiative, custom counters.

### Schema Versioning

Dexie has built-in schema versioning. Each schema change adds a new `db.version(N).stores({...})` call. Migrations run automatically when the user opens the app after an update. Dexie also supports data transformation during upgrades via `.upgrade(tx => {...})`.

## Scryfall Bulk Data Strategy

This is the most architecturally critical piece. The bulk data is large, parsing is slow, and it must not block the UI.

### Strategy: Stream-Parse in Web Worker, Store Trimmed Data

```
1. App boot → check meta store for 'bulkDataVersion' + 'lastBulkUpdate'
2. Fetch /bulk-data from Scryfall API (one lightweight call)
3. Compare updated_at timestamp against stored version
4. If stale (>24h) or missing:
   a. Get oracle_cards download URL from /bulk-data response
   b. Spawn Web Worker with download URL
   c. Worker: fetch() the JSON file
   d. Worker: stream-parse with @streamparser/json (~3KB library)
   e. Worker: trim each card to essential fields
   f. Worker: batch-write to IndexedDB (500 records per Dexie bulkPut)
   g. Worker: post progress messages to main thread (for progress bar / Mila animation)
   h. Main thread: update meta store with new version + timestamp
5. If fresh → skip, use cached IndexedDB data
```

### Why oracle_cards (not default_cards or all_cards)

| Bulk File | Cards | Raw Size | Trimmed Size | Use Case |
|-----------|-------|----------|--------------|----------|
| oracle_cards | ~27K | ~130MB | ~60-80MB | Search, deckbuilding, analytics. **Use this.** |
| default_cards | ~90K+ | ~350MB+ | ~200MB+ | Every printing. Needed for set-completion views |
| all_cards | ~250K+ | ~1GB+ | N/A | Every language. Never needed |

**Recommendation**: Start with oracle_cards for Phase 1-2. Fetch specific set printings on-demand via `/cards/search?q=set:xxx` for set-completion views (Phase 3+). Consider downloading default_cards as an optional "full data" mode in a later phase.

### Web Worker Implementation

```javascript
// workers/bulk-import.worker.js
import { Streamparser } from '@streamparser/json';
import Dexie from 'dexie';

// Open IndexedDB directly in the worker (supported in all modern browsers)
const db = new Dexie('counterflux');
db.version(1).stores({ cards: 'id, oracle_id, name, set, ...' });

self.onmessage = async ({ data: { url } }) => {
  const response = await fetch(url);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  let batch = [];
  let totalProcessed = 0;
  const BATCH_SIZE = 500;
  
  // Stream-parse: process cards one at a time without loading full JSON
  // @streamparser/json emits each array element as it's parsed
  const parser = new Streamparser({ paths: ['$.*'] });
  
  parser.onValue = async (card) => {
    batch.push(trimCard(card));
    totalProcessed++;
    
    if (batch.length >= BATCH_SIZE) {
      await db.cards.bulkPut(batch);
      batch = [];
      self.postMessage({ type: 'progress', count: totalProcessed });
    }
  };
  
  // Feed chunks to parser
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.write(decoder.decode(value, { stream: true }));
  }
  
  // Flush remaining batch
  if (batch.length > 0) await db.cards.bulkPut(batch);
  
  self.postMessage({ type: 'complete', total: totalProcessed });
};

function trimCard(card) {
  return {
    id: card.id,
    oracle_id: card.oracle_id,
    name: card.name,
    mana_cost: card.mana_cost,
    cmc: card.cmc,
    type_line: card.type_line,
    oracle_text: card.oracle_text,
    color_identity: card.color_identity,
    colors: card.colors,
    set: card.set,
    set_name: card.set_name,
    collector_number: card.collector_number,
    rarity: card.rarity,
    image_uris: card.image_uris ? {
      small: card.image_uris.small,
      normal: card.image_uris.normal,
      art_crop: card.image_uris.art_crop,
    } : null,
    card_faces: card.card_faces?.map(f => ({
      name: f.name, mana_cost: f.mana_cost, type_line: f.type_line,
      oracle_text: f.oracle_text,
      image_uris: f.image_uris ? { small: f.image_uris.small, normal: f.image_uris.normal } : null,
    })),
    prices: { usd: card.prices?.usd, usd_foil: card.prices?.usd_foil },
    legalities: { commander: card.legalities?.commander },
    edhrec_rank: card.edhrec_rank,
    keywords: card.keywords,
    produced_mana: card.produced_mana,
    power: card.power,
    toughness: card.toughness,
    loyalty: card.loyalty,
  };
}
```

### Card Image Caching

Do NOT cache card images in IndexedDB. Scryfall serves images from a CDN (`cards.scryfall.io`). Cache them via Service Worker with a cache-first strategy. Images never change for a given URL.

```javascript
// In sw.js (Service Worker)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Cache Scryfall card images (cache-first, long-lived)
  if (url.hostname === 'cards.scryfall.io') {
    event.respondWith(
      caches.open('card-images').then(cache =>
        cache.match(event.request).then(cached =>
          cached || fetch(event.request).then(response => {
            cache.put(event.request, response.clone());
            return response;
          })
        )
      )
    );
  }
});
```

## Patterns to Follow

### Pattern 1: Alpine Store as Service Layer

**What:** Each domain (collection, deck, game) gets an Alpine.store() that encapsulates both state and actions. Screens and components read from stores, never from Dexie directly.

**When:** Always. Every data operation goes through a store.

**Example:**
```javascript
// stores/collection.js
import Alpine from 'alpinejs';
import { db } from '../services/db.js';

Alpine.store('collection', {
  cards: [],
  filters: { color: null, cmc: null, set: null },
  sortBy: 'name',
  loading: false,
  totalValue: 0,

  async load() {
    this.loading = true;
    let query = db.collection.toCollection();
    // Apply Dexie indexed filters
    if (this.filters.set) query = db.collection.where('set').equals(this.filters.set);
    this.cards = await query.toArray();
    this.totalValue = await this._calculateValue();
    this.loading = false;
  },

  async addCard(scryfallCard, { quantity = 1, condition = 'NM', foil = false, location = '' } = {}) {
    await db.collection.put({
      cardId: scryfallCard.id,
      oracle_id: scryfallCard.oracle_id,
      name: scryfallCard.name,
      set: scryfallCard.set,
      quantity, condition, foil, location,
      addedAt: Date.now(),
      updatedAt: Date.now()
    });
    await this.load(); // Refresh reactive state
    Alpine.store('notifications').success(`Added ${scryfallCard.name}`);
  },

  async isOwned(oracleId) {
    return (await db.collection.where('oracle_id').equals(oracleId).count()) > 0;
  }
});
```

### Pattern 2: Screen Module Registration with Lazy Loading

**What:** Each screen exports an Alpine.data() component that gets registered on route match. Screens are lazy-loaded via dynamic import.

**When:** On navigation. Only the active screen's module is loaded.

**Example:**
```javascript
// router.js
import Navigo from 'navigo';

const router = new Navigo('/');

router
  .on('/', async () => {
    await import('./screens/dashboard.js');
    setScreen('dashboard-screen');
  })
  .on('/collection', async () => {
    await import('./screens/collection.js');
    setScreen('collection-screen');
    Alpine.store('collection').load();
  })
  .on('/deck/:id', async ({ data }) => {
    await import('./screens/deck-builder.js');
    setScreen('deck-builder-screen');
    Alpine.store('deck').loadDeck(data.id);
  })
  .on('/market', async () => {
    await import('./screens/market.js');
    setScreen('market-screen');
  })
  .on('/game', async () => {
    await import('./screens/game-tracker.js');
    setScreen('game-tracker-screen');
  })
  .resolve();

function setScreen(templateId) {
  const outlet = document.querySelector('#app-content');
  const template = document.querySelector(`#${templateId}`);
  outlet.innerHTML = '';
  outlet.appendChild(template.content.cloneNode(true));
}
```

### Pattern 3: Scryfall Rate-Limited Client

**What:** A service that enforces Scryfall's rate limit (50-100ms between requests) via a request queue.

**When:** Every Scryfall API call.

```javascript
// services/scryfall.js
class ScryfallService {
  #queue = [];
  #processing = false;
  #lastRequest = 0;
  #minDelay = 75; // 75ms between requests (within 50-100ms guideline)

  async search(query) {
    // Check local Dexie cache first
    const cached = await this.#searchLocal(query);
    if (cached.length > 0) return cached;
    // Fallback to API
    return this.#enqueue(`/cards/search?q=${encodeURIComponent(query)}`);
  }

  async autocomplete(query) {
    return this.#enqueue(`/cards/autocomplete?q=${encodeURIComponent(query)}`);
  }

  async #searchLocal(query) {
    const { db } = await import('./db.js');
    return db.cards.where('name').startsWithIgnoreCase(query).limit(20).toArray();
  }

  #enqueue(path) {
    return new Promise((resolve, reject) => {
      this.#queue.push({ path, resolve, reject });
      if (!this.#processing) this.#processQueue();
    });
  }

  async #processQueue() {
    this.#processing = true;
    while (this.#queue.length > 0) {
      const elapsed = Date.now() - this.#lastRequest;
      if (elapsed < this.#minDelay) {
        await new Promise(r => setTimeout(r, this.#minDelay - elapsed));
      }
      const { path, resolve, reject } = this.#queue.shift();
      try {
        this.#lastRequest = Date.now();
        const res = await fetch(`https://api.scryfall.com${path}`, {
          headers: { 'User-Agent': 'Counterflux/1.0 (https://counterflux.app)' }
        });
        resolve(await res.json());
      } catch (e) { reject(e); }
    }
    this.#processing = false;
  }
}

export const scryfall = new ScryfallService();
```

### Pattern 4: Virtual Scroll with DOM Recycling

**What:** Render only visible items in collection/table views. Recycle DOM elements on scroll instead of creating/destroying.

**When:** Any list with 100+ items. The collection can contain thousands of cards.

```javascript
// components/virtual-list.js
export function virtualGrid(containerEl, items, rowHeight, renderFn) {
  const BUFFER = 5;
  const spacer = document.createElement('div');
  containerEl.appendChild(spacer);

  function update() {
    const scrollTop = containerEl.scrollTop;
    const viewportHeight = containerEl.clientHeight;
    const startIdx = Math.max(0, Math.floor(scrollTop / rowHeight) - BUFFER);
    const endIdx = Math.min(items.length, startIdx + Math.ceil(viewportHeight / rowHeight) + BUFFER * 2);

    spacer.style.height = `${items.length * rowHeight}px`;
    
    // Clear and re-render visible range
    const fragment = document.createDocumentFragment();
    for (let i = startIdx; i < endIdx; i++) {
      const el = renderFn(items[i]);
      el.style.position = 'absolute';
      el.style.transform = `translateY(${i * rowHeight}px)`;
      fragment.appendChild(el);
    }
    // Replace visible elements
    while (containerEl.childNodes.length > 1) containerEl.removeChild(containerEl.lastChild);
    containerEl.appendChild(fragment);
  }

  containerEl.addEventListener('scroll', update, { passive: true });
  update();
  return { refresh: update };
}
```

### Pattern 5: Debounced IndexedDB Persistence

Writes to IndexedDB are debounced (300ms) to avoid thrashing during rapid interactions (e.g., adjusting life totals, adding multiple cards quickly). The Alpine store is the source of truth for the current session; IndexedDB is the durable backup.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Direct Dexie Queries in Components

**What:** Calling `db.collection.where(...)` directly inside Alpine `x-init` or `x-on` handlers.
**Why bad:** Scatters data access logic. Makes it impossible to add caching, loading states, or error handling consistently.
**Instead:** Always go through Alpine.store() actions. Stores own the Dexie interaction.

### Anti-Pattern 2: Loading All Card Data at Once

**What:** `const allCards = await db.cards.toArray()` then filtering in JS.
**Why bad:** 27K+ cards loaded into memory at once. Slow, wasteful, crashes on low-memory devices.
**Instead:** Use Dexie's indexed queries (`.where('set').equals('neo')`) and paginate results. Virtual scroll renders only what's visible.

### Anti-Pattern 3: Storing Card Images in IndexedDB

**What:** Downloading and caching card images as blobs in IndexedDB.
**Why bad:** 27K cards x 100KB average = 2.7GB. Exceeds browser quotas. Slow to read.
**Instead:** Use Scryfall CDN image URIs directly. Service Worker caches images via Cache API with browser-managed eviction.

### Anti-Pattern 4: JSON.parse on Full Bulk Data String

**What:** `JSON.parse(await response.text())` on the 130MB bulk data file.
**Why bad:** Allocates 130MB string + parsed object simultaneously. Will crash on low-memory devices. Blocks thread for 5-10+ seconds even in a Worker.
**Instead:** Stream-parse with `@streamparser/json`. Process cards one at a time. Batch-write to IndexedDB.

### Anti-Pattern 5: Sharing Mutable State Between Screens

**What:** Screens directly modifying another screen's state (e.g., deck builder modifying collection count).
**Why bad:** Creates hidden coupling, race conditions, hard-to-trace bugs.
**Instead:** Screens dispatch actions to their own stores. Cross-cutting updates happen via store-to-store references (`Alpine.store('collection').decrementCard(id)`).

### Anti-Pattern 6: Synchronous Data Loading on Startup

**What:** Blocking app render until all IndexedDB data is loaded.
**Why bad:** Collection with 5,000 cards takes 500ms+ to deserialize. Users see blank screen.
**Instead:** Render app shell immediately. Load stores asynchronously. Show skeleton/loading states. Mila fills empty states with flavor text while data loads.

## Scalability Considerations

| Concern | At 500 cards | At 5,000 cards | At 50,000 cards |
|---------|-------------|----------------|-----------------|
| Collection load | Instant (<50ms) | Fast (~200ms Dexie query) | Indexed query + virtual scroll mandatory |
| Search autocomplete | Array filter OK | Dexie index query + limit(20) | Dexie index range query, never load all |
| Deck analytics | Recalc on every change (<10ms) | Same (deck max 100 cards) | N/A (decks don't grow this large) |
| IndexedDB storage | ~2MB user data | ~20MB user data | ~200MB (within browser limits) |
| Bulk data (cards store) | Always ~60-80MB (oracle cards) | Same | Same |
| Card images | CDN direct + lazy load | Service Worker cache hits | SW cache with LRU eviction by browser |
| Initial JS bundle | ~100KB (Alpine + Dexie + app) | Same | Same |

## Offline-First Strategy

### Service Worker Registration
```javascript
// In src/app.js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

### Cache Strategies

| Resource | Strategy | Rationale |
|----------|----------|-----------|
| App shell (HTML, JS, CSS) | Cache-first, update in background (stale-while-revalidate) | App works offline after first load |
| Card images (cards.scryfall.io) | Cache-first, no expiry | Images never change for a given URL |
| Scryfall API responses | Network-first, fallback to IndexedDB cards store | API is supplementary; bulk cache is primary |
| Bulk data JSON | Processed into IndexedDB via Worker (not stored raw) | Too large for Cache API; needs indexed queries |
| User data (collection, decks, games) | IndexedDB only, never hits network | Local-first, no cloud sync in v1 |

### Sync Queue (Future Phase 5)

For eventual Supabase cloud sync, implement a change log in IndexedDB:
```javascript
// Added as Dexie store in Phase 5
// syncQueue: '++id, action, store, recordId, timestamp'
// { id, action: 'create'|'update'|'delete', store, recordId, data, timestamp }
```

On reconnection or account creation, replay the queue to Supabase. Last-write-wins with timestamps.

## Suggested Build Order

Build order follows data dependency chain -- you can't build screens without stores, and you can't build stores without the persistence layer.

### Layer 1: Foundation (blocks everything)

```
1. Vite + Tailwind + Alpine.js setup, dev server running
2. CSS tokens: Izzet palette, typography (Crimson Pro / Space Grotesk / JetBrains Mono)
3. Dexie schema + db instance (services/db.js)
4. App shell HTML: sidebar nav + top bar + #app-content outlet
5. Navigo router with lazy screen loading
6. Toast/notification store + component
```

**Rationale:** Everything depends on the build pipeline, persistence layer, and navigation. Get these right first. The app shell with working navigation is the first tangible deliverable.

### Layer 2: Card Data Pipeline (blocks all card-related features)

```
1. ScryfallService (API client with rate-limited queue)
2. Bulk data Web Worker (download, stream-parse, trim, store)
3. bulk-data.js orchestrator (version check, worker spawning, progress)
4. Card search via Dexie indexes + API fallback
5. card-preview, mana-cost, card-search components
6. First-run experience: Mila guides user through initial bulk download
```

**Rationale:** Every screen needs card data. The bulk import + search pipeline is the backbone of the entire app.

### Layer 3: Collection Manager (blocks deck builder's "owned" feature)

```
1. Alpine.store('collection') with full CRUD
2. Collection screen: gallery view (card-grid with virtual scroll)
3. Collection screen: table view (card-table with sorting/filtering)
4. Mass entry terminal (paste card names, batch add)
5. CSV import/export
6. Set-completion view
```

**Rationale:** Collection data is needed by the deck builder to show owned/missing indicators. Build it before decks.

### Layer 4: Deck Builder (depends on collection + card data)

```
1. Alpine.store('deck') with full CRUD
2. Three-panel layout: search panel | the 99 (grid/list) | analytics sidebar
3. deck-list, deck-analytics (Chart.js mana curve, color pie, type breakdown)
4. Category management (user-defined categories, drag-to-categorize)
5. Collection overlay: owned/missing badges via collection store cross-reference
6. Deck import/export (MTGO, Moxfield, Archidekt formats)
7. EDHREC synergy integration
8. Commander Spellbook combo detection
```

### Layer 5: Market Intel + Dashboard

```
1. price-service + watchlist store
2. Market Intel screen: spoiler browser, price watchlist, trend charts
3. Dashboard screen: portfolio summary, quick add, price alerts, deck quick-launch
4. Mila insights widget (tips based on collection/deck data)
```

**Rationale:** Dashboard aggregates data from collection + decks + prices. Build it last so it has data to display. Market Intel is independent but lower priority than collection/deckbuilding core.

### Layer 6: Game Tracker (independent, can parallel Layer 5)

```
1. Alpine.store('game') with full session management
2. Life counter (40 life, tap to increment/decrement)
3. Commander damage matrix (tracks damage from each commander to each player)
4. Poison/energy/experience counters
5. Dice roller (D6, D20)
6. Turn log + game history
7. Post-game summary + stats
8. Mobile-responsive layout (only screen that needs it)
```

**Rationale:** Game Tracker is fully independent of other screens. Can be built in parallel with Layer 5.

### Layer 7: Offline + PWA Polish

```
1. Service Worker with cache strategies (app shell + card images)
2. Offline detection + UI indicators
3. Background bulk data refresh (check for updates when online)
4. PWA manifest + install prompt
5. Keyboard shortcuts (global hotkeys for navigation, search)
6. Context menus (right-click on cards, decks)
7. Undo support (collection edits, deck edits)
```

**Rationale:** Offline support is an enhancement layer. Get the app working online-first, then add offline resilience. Keyboard/UX polish comes last because it benefits from understanding the full interaction model.

## Sources

- [Scryfall API Documentation](https://scryfall.com/docs/api) -- rate limiting, bulk data, endpoints, compliance rules
- [Scryfall Bulk Data Documentation](https://scryfall.com/docs/api/bulk-data) -- file types, update frequency, caching guidance
- [Dexie.js Documentation](https://dexie.org/) -- schema design, compound indexes, bulk operations, versioning
- [Alpine.js Store Documentation](https://alpinejs.dev/globals/alpine-store) -- reactive state management
- [MDN: Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB) -- schema patterns, transaction management
- [MDN: Storage Quotas and Eviction Criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) -- browser storage limits
- [IndexedDB Storage Limits (RxDB)](https://rxdb.info/articles/indexeddb-max-storage-limit.html) -- Chrome 60% disk, no per-record limit
- [IndexedDB Performance (RxDB)](https://rxdb.info/slow-indexeddb.html) -- transaction overhead, sharding benefits
- [Chrome IndexedDB Storage Improvements](https://developer.chrome.com/docs/chromium/indexeddb-storage-improvements) -- compression, quota changes
- [Offline-First Frontend Apps 2025](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/) -- patterns, Dexie vs raw IDB
- [Virtual Scrolling Patterns (patterns.dev)](https://www.patterns.dev/vanilla/virtual-lists/) -- DOM recycling, performance
- [State Management in Vanilla JS 2026](https://medium.com/@chirag.dave/state-management-in-vanilla-js-2026-trends-f9baed7599de) -- Proxy patterns, store architecture
- [Frontend Masters: Web Components Architecture](https://frontendmasters.com/blog/architecture-through-component-colocation/) -- co-location, component boundaries
