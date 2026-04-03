# Phase 1: Foundation + Data Layer - Research

**Researched:** 2026-04-03
**Domain:** Scryfall bulk data pipeline, IndexedDB storage, SPA shell, Izzet visual identity
**Confidence:** HIGH

## Summary

Phase 1 is a greenfield build delivering four interconnected subsystems: (1) a Scryfall Default Cards bulk data pipeline that downloads ~300MB of JSON, stream-parses it in a Web Worker, and stores it in IndexedDB via Dexie.js; (2) a sub-200ms card autocomplete search over the cached data; (3) a five-screen SPA navigation shell with Navigo hash routing and a fixed sidebar; and (4) the full "Organic Brutalism" Izzet visual identity with self-hosted fonts, ghost borders, tonal surface hierarchy, and the Mila system familiar.

The primary technical challenge is the bulk data pipeline: 300MB of JSON cannot be parsed with `JSON.parse()` (would require ~600MB+ heap), so a streaming parser (`@streamparser/json-whatwg`) running inside a Web Worker must feed cards in batches to Dexie.js `bulkPut()`. The first-load UX is a blocking splash screen with progress feedback. Subsequent loads check `updated_at` and refresh silently in the background.

**Primary recommendation:** Build the data pipeline first (Worker + streaming parser + Dexie schema), then the search layer, then the visual shell. The data layer is the foundation everything else depends on.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use Scryfall Default Cards bulk file (~300MB), not Oracle Cards
- **D-02:** First-load is a full blocking splash screen with Counterflux logo, Mila, progress bar, download stats (MB/total), rotating MTG flavour text
- **D-03:** Streaming JSON parser in Web Worker (ReadableStream + incremental JSON tokenizer), batch-insert to IndexedDB
- **D-04:** Daily background refresh via full re-download, check updated_at, silent Worker, app uses stale cache until complete
- **D-05:** Autocomplete shows card name + small thumbnail + set icon + mana cost per suggestion
- **D-06:** Card detail flyout on selection (slide-in panel with full card image, Oracle text, type line, mana cost, price, legalities, action buttons)
- **D-07:** Search scope at Claude's discretion (name-only or basic Scryfall syntax)
- **D-08:** Fixed sidebar rail (~240px expanded, ~64px collapsed icon-only)
- **D-09:** Future screens locked/greyed out in sidebar
- **D-10:** Welcome/search landing as main content area
- **D-11:** Screen transitions are instant swap (no animation, URL hash updates, scroll resets)
- **D-12:** Bold and immersive visual effects (pronounced ghost borders, strong glow, visible aether gradient)
- **D-13:** "Organic Brutalism" design: 0px border-radius everywhere, no standard borders, ghost borders, glassmorphism
- **D-14:** "No-Line" Rule: 1px borders prohibited for layout sections, use tonal shifting
- **D-15:** Mana pips use square/diamond containers (0px radius)
- **D-16:** Typography: Syne (display/headlines), Space Grotesk (body), JetBrains Mono (labels/data/mono), Crimson Pro (serif accent)
- **D-17:** Self-hosted .woff2 fonts, no Google Fonts CDN
- **D-18:** JetBrains Mono in all-caps for metadata
- **D-19:** Mila avatar ~40px at sidebar bottom (Izzet engineer variant)
- **D-20:** Animated Mila sprite for loading states (requires sprite sheet from user)
- **D-21:** Mila Izzet engineer variant asset: `assets/assetsmila-izzet.png`
- **D-22:** Full colour palette confirmed (primary #0D52BD, secondary #E23838, background #0B0C10, etc.)

### Claude's Discretion
- Search syntax scope in Phase 1 (name-only vs basic Scryfall syntax) -- D-07
- Toast notification positioning and auto-dismiss timing (requirements say bottom-right, 5s)
- Sidebar icon choices for each screen
- Scanline animation (present in Stitch HTML -- optional decorative effect)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | Download and cache Scryfall bulk data in IndexedDB via Web Worker stream parsing | Scryfall bulk-data API, @streamparser/json-whatwg, Dexie.js bulkPut, Web Worker pattern |
| DATA-02 | Refresh bulk data cache daily (background, non-blocking) | Scryfall updated_at check, background Worker re-download pattern |
| DATA-03 | Search cards using Scryfall full-text syntax | Dexie.js compound indexes for name search; full syntax deferred to Phase 2/3 per D-07 |
| DATA-04 | Autocomplete returns suggestions within 200ms | Dexie.js WhereClause with startsWithIgnoreCase, debounced input, limited result set |
| DATA-05 | Handle all Scryfall card layouts correctly via unified card accessor | Layout taxonomy documented below; accessor must handle image_uris at root vs card_faces |
| DATA-06 | Respect Scryfall rate limits (50-100ms delay, User-Agent header) | Only applies to bulk-data metadata endpoint (1 request); bulk file download is a single fetch |
| DATA-07 | All user data persists in IndexedDB via Dexie.js with schema versioning | Dexie.js version() API for migrations |
| DATA-08 | Prompt for persistent storage permission (Safari ITP) | navigator.storage.persist() API documented below |
| SHELL-01 | Persistent left sidebar with navigation to all 5 screens | Fixed sidebar rail pattern from Stitch HTML mockup |
| SHELL-02 | Sidebar collapses to icons on smaller viewports | Responsive breakpoint, CSS transition on width |
| SHELL-03 | Persistent top app bar with wordmark, global search, notification bell | Stitch HTML header pattern with glass-overlay |
| SHELL-04 | Hash-based SPA routing with lazy loading | Navigo 8.11 hash mode, dynamic import() for screen modules |
| SHELL-05 | Full Izzet visual identity: colour palette, ghost borders, glow, aether gradient | 12 CSS custom properties, Tailwind v4 @theme configuration |
| SHELL-06 | Typography system: Syne + Space Grotesk + JetBrains Mono | Self-hosted .woff2 files, @font-face declarations, Tailwind font families |
| SHELL-07 | Toast notification system (info/success/warning/error) | Alpine.js store + component pattern, bottom-right positioning, 5s auto-dismiss |
| MILA-01 | Mila avatar at bottom of sidebar | PNG asset positioning, grayscale-to-colour hover effect from Stitch HTML |
| MILA-02 | Empty states show Mila with contextual message | Reusable empty-state component pattern |
| MILA-03 | Loading states show Mila with animation | CSS sprite animation (requires sprite sheet asset from user), fallback pulse animation |
| PERF-01 | Initial page load under 3 seconds on broadband | Vite 8 tree-shaking, code splitting, font preloading, deferred bulk download |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vite | 8.0.3 | Build tool, dev server, HMR | Rolldown-powered (Rust), 10-30x faster. Industry standard for 2026 greenfield |
| Alpine.js | 3.15.11 | Declarative reactivity | HTML-first, ~17KB gzip, pairs with Tailwind, active maintenance |
| Tailwind CSS | 4.2.2 | Utility-first CSS | CSS-first config via @theme, Rust Oxide engine, no config file needed |
| Dexie.js | 4.4.2 | IndexedDB wrapper | Fluent query API, schema versioning, bulkPut for batch inserts, ~30KB gzip |
| Navigo | 8.11.1 | SPA hash routing | ~4KB gzip, hash mode built-in, data-navigo declarative links |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @streamparser/json-whatwg | 0.0.22 | Streaming JSON parser (browser) | Parsing 300MB Scryfall bulk file in Web Worker without OOM |
| mana-font | 1.18.0 | MTG mana symbol icon font | Rendering mana costs in autocomplete, flyout, everywhere |
| keyrune | 3.18.0 | MTG set symbol icon font | Set icons in autocomplete suggestions |
| material-symbols | 0.44.0 | UI icon font (Outlined variant) | Sidebar icons, search icon, notification bell, all UI chrome |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @streamparser/json-whatwg | Manual ReadableStream + TextDecoder chunking | More code, more bugs, same result. Library handles UTF-8 boundaries correctly |
| Navigo | Custom hash router | Only ~50 lines but Navigo handles edge cases (hooks, not-found, resolve) |
| Material Symbols | Lucide icons | Stitch mockups use Material Symbols; switching means redesigning all icon references |

### Not Yet Needed (Future Phases)

| Library | Version | Phase |
|---------|---------|-------|
| Chart.js | 4.5.1 | Phase 2+ (collection analytics) |
| SortableJS | 1.15.7 | Phase 3 (deck builder drag-and-drop) |

**Installation:**
```bash
npm create vite@latest counterflux -- --template vanilla
cd counterflux
npm install alpinejs dexie navigo @streamparser/json-whatwg sortablejs
npm install -D tailwindcss @tailwindcss/vite
```

Note: mana-font, keyrune, and material-symbols are CSS/font packages:
```bash
npm install mana-font keyrune material-symbols
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── main.js                  # App entry: Alpine init, router setup, bulk data check
├── styles/
│   ├── main.css             # Tailwind imports, @theme config, @font-face declarations
│   ├── utilities.css         # ghost-border, glass-overlay, aether-glow, scanline utilities
│   └── fonts/               # Self-hosted .woff2 files (Syne, Space Grotesk, JetBrains Mono, Crimson Pro)
├── workers/
│   └── bulk-data.worker.js  # Web Worker: fetch, stream-parse, postMessage batches
├── db/
│   ├── schema.js            # Dexie database definition, version migrations
│   ├── card-accessor.js     # Unified card accessor (handles all layouts)
│   └── search.js            # Autocomplete query logic
├── stores/
│   ├── app.js               # Alpine.store('app') — loading state, current screen, toast queue
│   ├── search.js            # Alpine.store('search') — query, results, selected card
│   └── bulkdata.js          # Alpine.store('bulkdata') — download progress, status, updated_at
├── screens/
│   ├── welcome.js           # Landing/search screen (Alpine component)
│   ├── epic-experiment.js   # Dashboard placeholder (locked)
│   ├── thousand-year.js     # Deck builder placeholder (locked)
│   ├── treasure-cruise.js   # Collection placeholder (locked)
│   ├── preordain.js         # Market intel placeholder (locked)
│   └── vandalblast.js       # Game tracker placeholder (locked)
├── components/
│   ├── sidebar.js           # Navigation sidebar Alpine component
│   ├── topbar.js            # Top app bar with search input
│   ├── toast.js             # Toast notification system
│   ├── card-flyout.js       # Card detail slide-in panel
│   ├── splash-screen.js     # First-load blocking splash with progress
│   ├── autocomplete.js      # Search autocomplete dropdown
│   └── mila.js              # Mila avatar + loading animation
│   └── empty-state.js       # Reusable empty state with Mila
├── utils/
│   ├── scryfall.js          # Scryfall API helpers (bulk-data endpoint, User-Agent)
│   └── storage.js           # navigator.storage.persist() wrapper
├── router.js                # Navigo setup, route definitions, screen switching
└── index.html               # Root HTML with Alpine x-data, sidebar, topbar, main content area
assets/
├── assetsmila-izzet.png     # Mila Izzet engineer variant
└── stitch/                  # Design reference (not shipped to production)
```

### Pattern 1: Web Worker Bulk Data Pipeline

**What:** Fetch Scryfall Default Cards bulk file, stream-parse in a Web Worker, batch-insert to IndexedDB via Dexie.js.

**When to use:** First load (blocking) and daily refresh (background).

**Architecture:**
```
Main Thread                          Web Worker
─────────────                        ──────────
1. Check Dexie for cached            
   updated_at timestamp              
2. Fetch /bulk-data/default-cards    
   → get download_uri + updated_at   
3. If stale → postMessage('start')   
   ↓                                 4. fetch(download_uri) as ReadableStream
   ↓                                 5. Pipe through @streamparser/json-whatwg
   ↓                                 6. Accumulate cards in batch (500-1000)
   ← postMessage({type:'progress',   7. When batch full → postMessage batch
      downloaded, total, parsed})     
8. Dexie bulkPut(batch) on main      
   thread (IndexedDB transactions    
   must run on main thread OR        
   use Dexie in worker)              
   ↓                                 
9. Update progress UI                
   ← postMessage({type:'complete'})  10. Signal completion
```

**Critical decision:** Dexie.js can run inside a Web Worker (IndexedDB is available in Workers). Running Dexie inside the Worker avoids postMessage serialization overhead for 300MB of card data. The Worker owns the entire pipeline: fetch -> parse -> store.

```javascript
// workers/bulk-data.worker.js
import Dexie from 'dexie';
import { JSONParser } from '@streamparser/json-whatwg';

const db = new Dexie('counterflux');
db.version(1).stores({
  cards: 'id, name, oracle_id, set, collector_number, cmc, [set+collector_number]',
  meta: 'key'
});

self.onmessage = async (e) => {
  if (e.data.type === 'start') {
    const { downloadUri } = e.data;
    const response = await fetch(downloadUri);
    const reader = response.body.getReader();
    const contentLength = +response.headers.get('Content-Length');
    
    let downloaded = 0;
    let batch = [];
    const BATCH_SIZE = 1000;
    let totalParsed = 0;

    // Stream and parse
    const parser = new JSONParser({ paths: ['$.*'], keepStack: false });
    
    const processStream = new ReadableStream({
      async start(controller) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          downloaded += value.byteLength;
          controller.enqueue(value);
          self.postMessage({ type: 'progress', downloaded, total: contentLength, parsed: totalParsed });
        }
        controller.close();
      }
    });

    // Pipe through parser, collect cards, batch insert
    processStream.pipeThrough(parser).pipeTo(new WritableStream({
      write(card) {
        batch.push(card.value);
        totalParsed++;
        if (batch.length >= BATCH_SIZE) {
          db.cards.bulkPut(batch);
          batch = [];
        }
      },
      close() {
        if (batch.length > 0) db.cards.bulkPut(batch);
        self.postMessage({ type: 'complete', totalParsed });
      }
    }));
  }
};
```

### Pattern 2: Unified Card Accessor

**What:** A function that normalises Scryfall card data regardless of layout, providing consistent access to name, image, oracle text, mana cost, and type line.

**When to use:** Every time card data is displayed (autocomplete, flyout, any card rendering).

**Layout taxonomy (from Scryfall API):**

| Layout | Has card_faces | image_uris location | Name format |
|--------|---------------|---------------------|-------------|
| normal, saga, leveler, class, mutate, prototype | No | Root `.image_uris` | Root `.name` |
| split | Yes | Root `.image_uris` (combined image) | "Fire // Ice" |
| flip | Yes | Root `.image_uris` | Root `.name` (front face name) |
| transform | Yes | `card_faces[n].image_uris` | Root `.name` = "Front // Back" |
| modal_dfc | Yes | `card_faces[n].image_uris` | Root `.name` = "Front // Back" |
| adventure | Yes | Root `.image_uris` | Root `.name` = "Creature // Adventure" |
| meld | No (uses all_parts) | Root `.image_uris` | Root `.name` |
| reversible_card | Yes | `card_faces[n].image_uris` | Root `.name` |
| double_faced_token | Yes | `card_faces[n].image_uris` | Root `.name` |

```javascript
// db/card-accessor.js
const DOUBLE_SIDED_LAYOUTS = ['transform', 'modal_dfc', 'double_faced_token', 'reversible_card'];

export function getCardImage(card, face = 0, size = 'normal') {
  if (DOUBLE_SIDED_LAYOUTS.includes(card.layout)) {
    return card.card_faces?.[face]?.image_uris?.[size] ?? null;
  }
  return card.image_uris?.[size] ?? null;
}

export function getCardName(card) {
  // Root name is always the canonical name (e.g., "Delver of Secrets // Insectile Aberration")
  return card.name;
}

export function getCardFrontName(card) {
  if (card.card_faces?.length) return card.card_faces[0].name;
  return card.name;
}

export function getCardManaCost(card) {
  if (card.mana_cost) return card.mana_cost;
  if (card.card_faces?.length) return card.card_faces[0].mana_cost;
  return '';
}

export function getCardOracleText(card) {
  if (card.oracle_text) return card.oracle_text;
  if (card.card_faces?.length) {
    return card.card_faces.map(f => f.oracle_text).filter(Boolean).join('\n---\n');
  }
  return '';
}

export function getCardTypeLine(card) {
  if (card.type_line) return card.type_line;
  if (card.card_faces?.length) return card.card_faces[0].type_line;
  return '';
}

// Thumbnail for autocomplete (smallest useful image)
export function getCardThumbnail(card) {
  return getCardImage(card, 0, 'small');
}
```

### Pattern 3: Alpine.js Store + Web Worker Communication

**What:** Alpine.js global stores manage UI state. The Web Worker communicates via postMessage. Main thread updates Alpine stores which reactively update the UI.

```javascript
// stores/bulkdata.js
import Alpine from 'alpinejs';

Alpine.store('bulkdata', {
  status: 'idle', // idle | checking | downloading | parsing | ready | error
  downloaded: 0,
  total: 0,
  parsed: 0,
  error: null,
  updatedAt: null,

  get progress() {
    if (this.total === 0) return 0;
    return Math.round((this.downloaded / this.total) * 100);
  }
});

// In main.js — wire Worker messages to Alpine store
const worker = new Worker(new URL('./workers/bulk-data.worker.js', import.meta.url), { type: 'module' });

worker.onmessage = (e) => {
  const store = Alpine.store('bulkdata');
  switch (e.data.type) {
    case 'progress':
      store.status = 'downloading';
      store.downloaded = e.data.downloaded;
      store.total = e.data.total;
      store.parsed = e.data.parsed;
      break;
    case 'complete':
      store.status = 'ready';
      store.parsed = e.data.totalParsed;
      break;
    case 'error':
      store.status = 'error';
      store.error = e.data.message;
      break;
  }
};
```

### Pattern 4: Navigo Hash Routing

**What:** Hash-based SPA routing with Navigo. Each screen is a lazy-loaded module.

```javascript
// router.js
import Navigo from 'navigo';

const router = new Navigo('/', { hash: true });

const screens = {
  '': () => import('./screens/welcome.js'),
  'epic-experiment': () => import('./screens/epic-experiment.js'),
  'thousand-year-storm': () => import('./screens/thousand-year.js'),
  'treasure-cruise': () => import('./screens/treasure-cruise.js'),
  'preordain': () => import('./screens/preordain.js'),
  'vandalblast': () => import('./screens/vandalblast.js'),
};

Object.entries(screens).forEach(([path, loader]) => {
  router.on(path || '/', async () => {
    const module = await loader();
    document.getElementById('main-content').innerHTML = '';
    module.mount(document.getElementById('main-content'));
    window.scrollTo(0, 0);
  });
});

router.notFound(() => router.navigate('/'));
router.resolve();
```

### Pattern 5: Tailwind v4 Theme Configuration

**What:** CSS-first Tailwind v4 config using @theme directive (no tailwind.config.js).

```css
/* src/styles/main.css */
@import "tailwindcss";

@theme {
  --color-primary: #0D52BD;
  --color-secondary: #E23838;
  --color-background: #0B0C10;
  --color-surface: #14161C;
  --color-surface-hover: #1C1F28;
  --color-border-ghost: #2A2D3A;
  --color-text-primary: #EAECEE;
  --color-text-muted: #7A8498;
  --color-text-dim: #4A5064;
  --color-success: #2ECC71;
  --color-warning: #F39C12;
  --color-glow-blue: rgba(13, 82, 189, 0.3);
  --color-glow-red: rgba(226, 56, 56, 0.25);

  --radius-DEFAULT: 0px;

  --font-header: 'Syne', sans-serif;
  --font-body: 'Space Grotesk', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --font-serif: 'Crimson Pro', serif;
}

/* Self-hosted font declarations */
@font-face {
  font-family: 'Syne';
  src: url('./fonts/Syne-Variable.woff2') format('woff2');
  font-weight: 400 800;
  font-display: swap;
}

@font-face {
  font-family: 'Space Grotesk';
  src: url('./fonts/SpaceGrotesk-Variable.woff2') format('woff2');
  font-weight: 300 700;
  font-display: swap;
}

@font-face {
  font-family: 'JetBrains Mono';
  src: url('./fonts/JetBrainsMono-Variable.woff2') format('woff2');
  font-weight: 400 700;
  font-display: swap;
}

@font-face {
  font-family: 'Crimson Pro';
  src: url('./fonts/CrimsonPro-Variable.woff2') format('woff2');
  font-weight: 400 700;
  font-display: swap;
}
```

### Anti-Patterns to Avoid

- **JSON.parse() on bulk data:** Will allocate ~600MB+ heap for 300MB JSON. Always stream-parse.
- **postMessage for card batches:** Serializing 300MB of card objects across Worker boundary is slow. Run Dexie inside the Worker instead.
- **Circular borders anywhere:** 0px border-radius is a hard design rule. Never use `rounded-*` Tailwind classes.
- **Standard 1px borders for layout:** Violates the No-Line Rule. Use tonal surface shifting instead.
- **Google Fonts CDN:** Violates local-first, offline-capable requirement. Self-host all fonts.
- **Storing raw card objects in Alpine state:** 300MB of cards in reactive state = browser crash. Cards live in IndexedDB only; Alpine stores hold IDs and small result sets.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON streaming parse | Custom TextDecoder chunker | @streamparser/json-whatwg | UTF-8 boundary handling, JSON spec compliance, tested edge cases |
| IndexedDB CRUD | Raw IndexedDB API | Dexie.js | Transaction management, schema versioning, fluent queries |
| SPA routing | Custom hashchange listener | Navigo | Hooks (before/after/leave), not-found handler, data-navigo links |
| Mana symbol rendering | Inline SVGs or custom font | mana-font | Complete MTG symbol coverage including hybrid, phyrexian, tap |
| Set symbol rendering | Scryfall SVG downloads | keyrune | Offline-first, consistent sizing, CSS-controllable |
| UI icons | Custom SVG sprite | Material Symbols Outlined | Matches Stitch mockups exactly, variable font with fill/weight control |

## Common Pitfalls

### Pitfall 1: Web Worker Module Import

**What goes wrong:** `new Worker('path')` fails because Vite needs special syntax for bundling Worker modules.
**Why it happens:** Vite uses `import.meta.url` to resolve Worker paths at build time.
**How to avoid:** Always use `new Worker(new URL('./workers/bulk-data.worker.js', import.meta.url), { type: 'module' })`.
**Warning signs:** Worker file 404 in dev, empty Worker in production build.

### Pitfall 2: IndexedDB Transaction Auto-Commit

**What goes wrong:** Transaction commits before all operations complete because an `await` on a non-IndexedDB promise was used inside the transaction.
**Why it happens:** IndexedDB auto-commits transactions when the microtask queue empties without pending IDB requests.
**How to avoid:** Use Dexie.js `bulkPut()` which handles this internally. Never mix `fetch()` or `setTimeout` inside a Dexie transaction.
**Warning signs:** "TransactionInactiveError" in console.

### Pitfall 3: Scryfall Bulk Download URI Expiration

**What goes wrong:** Cached download_uri stops working after a day.
**Why it happens:** Scryfall changes the download_uri daily (includes a timestamp in the URL).
**How to avoid:** Always fetch `/bulk-data/default-cards` first to get a fresh `download_uri`. Never cache the download URL itself; cache the `updated_at` timestamp to decide whether to re-download.
**Warning signs:** 404 or redirect errors when fetching bulk file.

### Pitfall 4: Content-Length Missing on Bulk Download

**What goes wrong:** Progress bar shows indeterminate because `Content-Length` header is missing or zero.
**Why it happens:** Scryfall may use chunked transfer encoding or CORS may strip the header.
**How to avoid:** Use the `size` field from the bulk-data metadata response as the expected total. Fall back to indeterminate progress if neither is available.
**Warning signs:** `response.headers.get('Content-Length')` returns null.

### Pitfall 5: Alpine.js Reactivity with Large Arrays

**What goes wrong:** Pushing 1000+ autocomplete results into an Alpine reactive array causes jank.
**Why it happens:** Alpine proxies every object, creating overhead for large collections.
**How to avoid:** Limit autocomplete results to 10-15 items. Never store the full card database in Alpine state.
**Warning signs:** Typing in search feels sluggish, devtools shows excessive proxy creation.

### Pitfall 6: Tailwind v4 Migration Gotchas

**What goes wrong:** Old Tailwind v3 patterns don't work.
**Why it happens:** Tailwind v4 has breaking changes from v3.
**How to avoid:** Key changes to remember:
- Use `@import "tailwindcss"` not `@tailwind base/components/utilities`
- Use `@theme { }` in CSS, not `tailwind.config.js`
- `border-*` no longer defaults to gray-200 (explicitly set border colours)
- `@apply` still works but `@theme` replaces `theme()` function in most cases
**Warning signs:** Styles not applying, unexpected border colours.

### Pitfall 7: Font Loading Flash (FOUT)

**What goes wrong:** Text renders in system font then jumps to custom font.
**Why it happens:** Fonts load asynchronously.
**How to avoid:** Use `font-display: swap` in @font-face (shows system font quickly, swaps when ready). Preload critical fonts: `<link rel="preload" href="fonts/SpaceGrotesk-Variable.woff2" as="font" type="font/woff2" crossorigin>`. The splash screen masks the FOUT for first load.
**Warning signs:** Text "jumps" or resizes after page load.

### Pitfall 8: Safari Persistent Storage

**What goes wrong:** IndexedDB data gets evicted after 7 days without user interaction.
**Why it happens:** Safari ITP proactively evicts script-created data for origins without recent interaction.
**How to avoid:** Call `navigator.storage.persist()` early. Safari auto-approves based on user engagement (no prompt shown). Check result and warn user if denied.
**Warning signs:** Users report "my collection disappeared" after not visiting for a week.

## Code Examples

### Scryfall Bulk Data Metadata Fetch

```javascript
// utils/scryfall.js
const SCRYFALL_BULK_API = 'https://api.scryfall.com/bulk-data/default-cards';
const USER_AGENT = 'Counterflux/1.0 (https://github.com/your-repo)';

export async function fetchBulkDataMeta() {
  const response = await fetch(SCRYFALL_BULK_API, {
    headers: { 'User-Agent': USER_AGENT }
  });
  if (!response.ok) throw new Error(`Scryfall API error: ${response.status}`);
  const data = await response.json();
  // Returns: { download_uri, updated_at, size, content_type, ... }
  return data;
}

export function shouldRefresh(cachedUpdatedAt, serverUpdatedAt) {
  if (!cachedUpdatedAt) return true;
  return new Date(serverUpdatedAt) > new Date(cachedUpdatedAt);
}
```

### Persistent Storage Request

```javascript
// utils/storage.js
export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return { supported: false };
  
  const alreadyPersisted = await navigator.storage.persisted();
  if (alreadyPersisted) return { supported: true, granted: true };
  
  const granted = await navigator.storage.persist();
  return { supported: true, granted };
}

export async function getStorageEstimate() {
  if (!navigator.storage?.estimate) return null;
  const { usage, quota } = await navigator.storage.estimate();
  return { usage, quota, percentUsed: Math.round((usage / quota) * 100) };
}
```

### Dexie Schema Definition

```javascript
// db/schema.js
import Dexie from 'dexie';

export const db = new Dexie('counterflux');

db.version(1).stores({
  // Scryfall card cache
  // Indexed: id (primary), name (for search), oracle_id, set+collector_number (compound)
  cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]',
  
  // Metadata store (bulk data timestamps, app config)
  meta: 'key',
  
  // User collections (Phase 2, but schema defined now for versioning)
  // collection: '++id, cardId, set, condition, foil, [cardId+set]',
  
  // User decks (Phase 3)
  // decks: '++id, name, commanderId, updatedAt',
});

// Store/retrieve bulk data metadata
export async function getBulkMeta() {
  return db.meta.get('bulk-data');
}

export async function setBulkMeta(meta) {
  return db.meta.put({ key: 'bulk-data', ...meta });
}
```

### Autocomplete Search (Sub-200ms)

```javascript
// db/search.js
import { db } from './schema.js';

export async function searchCards(query, limit = 12) {
  if (!query || query.length < 2) return [];
  
  const normalised = query.toLowerCase();
  
  // Dexie WhereClause with startsWith is index-backed and fast
  const results = await db.cards
    .where('name')
    .startsWithIgnoreCase(normalised)
    .limit(limit)
    .toArray();
  
  // If too few results, also search for substring matches
  if (results.length < limit) {
    const additional = await db.cards
      .filter(card => card.name.toLowerCase().includes(normalised))
      .limit(limit - results.length)
      .toArray();
    
    // Deduplicate by oracle_id (show one printing per card)
    const seen = new Set(results.map(c => c.oracle_id));
    for (const card of additional) {
      if (!seen.has(card.oracle_id)) {
        results.push(card);
        seen.add(card.oracle_id);
      }
    }
  }
  
  return results.slice(0, limit);
}
```

### Toast Notification Store

```javascript
// stores/app.js
import Alpine from 'alpinejs';

Alpine.store('toast', {
  items: [],
  
  show(message, type = 'info', duration = 5000) {
    const id = Date.now();
    this.items.push({ id, message, type, visible: true });
    
    setTimeout(() => {
      const item = this.items.find(t => t.id === id);
      if (item) item.visible = false;
      setTimeout(() => {
        this.items = this.items.filter(t => t.id !== id);
      }, 300); // exit animation
    }, duration);
  },

  info(msg) { this.show(msg, 'info'); },
  success(msg) { this.show(msg, 'success'); },
  warning(msg) { this.show(msg, 'warning'); },
  error(msg) { this.show(msg, 'error', 8000); },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 config.js | Tailwind v4 @theme in CSS | Jan 2025 | No JS config file, CSS-first, Rust engine |
| Vite 6/7 (esbuild + Rollup) | Vite 8 (Rolldown unified) | Mar 2026 | 10-30x faster builds, single bundler |
| JSON.parse for bulk data | Streaming parser in Worker | Current best practice | Prevents OOM on 300MB+ files |
| Google Fonts CDN | Self-hosted variable .woff2 | Privacy/offline trend | Zero external requests, offline-capable |

**Deprecated/outdated:**
- Petite Vue: Abandoned (v0.4.1, no release in 4+ years). Do not use.
- Tailwind v3 `@tailwind` directives: Replaced by `@import "tailwindcss"` in v4.
- `tailwind.config.js`: Replaced by `@theme {}` in CSS for Tailwind v4.

## Open Questions

1. **@streamparser/json-whatwg Path Configuration**
   - What we know: The library exposes JSONParser with a `paths` option to filter which JSON values to emit.
   - What's unclear: The exact `paths` config needed for a top-level JSON array (`$.*` should work for `[{card1}, {card2}, ...]`).
   - Recommendation: Test with a small sample of the Scryfall bulk file during implementation. Fall back to manual ReadableStream + TextDecoder + brace-counting if the library has issues with 300MB streams.

2. **Scryfall Default Cards File Size Variability**
   - What we know: Documentation says ~300MB, but actual size varies as cards are added.
   - What's unclear: Whether compressed transfer (gzip/br) is used, which would affect download progress calculations.
   - Recommendation: Use the `size` field from the bulk-data metadata response for progress calculation, not Content-Length.

3. **Dexie.js Inside Web Worker Module Support**
   - What we know: IndexedDB is available in Workers. Dexie.js should work in Workers.
   - What's unclear: Whether Vite 8's Worker bundling handles Dexie's dynamic imports correctly.
   - Recommendation: Test early. If Worker bundling fails, fall back to postMessage batches from Worker to main thread.

4. **Mila Sprite Sheet Asset**
   - What we know: D-20 requires animated Mila sprite for loading states.
   - What's unclear: Sprite sheet artwork has not been created yet.
   - Recommendation: Implement a CSS pulse/bounce fallback animation on the static Mila image. Swap in sprite animation when asset is provided.

5. **Search Scope Decision (D-07, Claude's Discretion)**
   - Recommendation: **Name-only search for Phase 1.** Full Scryfall syntax requires parsing a query language and mapping it to Dexie compound queries — significant complexity with no Phase 1 requirement. Card name prefix search with Dexie `.startsWithIgnoreCase()` is fast and sufficient for the autocomplete UX.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build tooling (Vite) | Yes | 24.13.1 | -- |
| npm | Package management | Yes | 11.8.0 | -- |
| Scryfall API | Bulk data download | Yes (external) | v1 | Offline mode with cached data |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (to be installed) |
| Config file | None -- Wave 0 must create vitest.config.js |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | Bulk data downloads and caches in IndexedDB | integration | `npx vitest run tests/bulk-data.test.js -t "downloads and stores"` | No -- Wave 0 |
| DATA-02 | Daily refresh checks updated_at | unit | `npx vitest run tests/bulk-data.test.js -t "refresh logic"` | No -- Wave 0 |
| DATA-03 | Card search returns results | unit | `npx vitest run tests/search.test.js` | No -- Wave 0 |
| DATA-04 | Autocomplete under 200ms | unit | `npx vitest run tests/search.test.js -t "performance"` | No -- Wave 0 |
| DATA-05 | Unified card accessor handles all layouts | unit | `npx vitest run tests/card-accessor.test.js` | No -- Wave 0 |
| DATA-06 | User-Agent header sent on Scryfall requests | unit | `npx vitest run tests/scryfall.test.js` | No -- Wave 0 |
| DATA-07 | Dexie schema versioning works | unit | `npx vitest run tests/schema.test.js` | No -- Wave 0 |
| DATA-08 | Persistent storage requested | unit | `npx vitest run tests/storage.test.js` | No -- Wave 0 |
| SHELL-04 | Hash routing navigates between screens | integration | `npx vitest run tests/router.test.js` | No -- Wave 0 |
| SHELL-07 | Toast notifications display and auto-dismiss | unit | `npx vitest run tests/toast.test.js` | No -- Wave 0 |
| PERF-01 | Initial load under 3s | manual-only | Lighthouse audit in Chrome DevTools | N/A |
| SHELL-01/02/03/05/06 | Visual shell renders correctly | manual-only | Visual inspection against Stitch mockups | N/A |
| MILA-01/02/03 | Mila displays in sidebar and states | manual-only | Visual inspection | N/A |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `vitest` dev dependency installation: `npm install -D vitest fake-indexeddb`
- [ ] `vitest.config.js` -- Vite-native test config
- [ ] `tests/card-accessor.test.js` -- covers DATA-05
- [ ] `tests/search.test.js` -- covers DATA-03, DATA-04
- [ ] `tests/bulk-data.test.js` -- covers DATA-01, DATA-02
- [ ] `tests/scryfall.test.js` -- covers DATA-06
- [ ] `tests/schema.test.js` -- covers DATA-07
- [ ] `tests/storage.test.js` -- covers DATA-08
- [ ] `tests/toast.test.js` -- covers SHELL-07
- [ ] `tests/router.test.js` -- covers SHELL-04
- [ ] `tests/fixtures/sample-cards.json` -- sample Scryfall card data covering all layout types
- [ ] `fake-indexeddb` package for testing Dexie.js in Node environment

## Project Constraints (from CLAUDE.md)

- **Scryfall API compliance:** User-Agent header required, 50-100ms delay between requests, must not paywall data, must not crop artist credits
- **Local-first:** Must work without account creation or internet after initial data fetch
- **Desktop-first:** Optimised for desktop viewports
- **Performance:** Initial load < 3s, autocomplete < 200ms
- **Stack locked:** Vite 8, Alpine.js, Tailwind CSS v4, Dexie.js, Navigo
- **GSD workflow:** Must use GSD entry points for code changes
- **RTK commands:** All CLI commands should be prefixed with `rtk`
- **Each subproject has own package.json:** Always cd into counterflux before running commands

## Sources

### Primary (HIGH confidence)
- npm registry -- verified versions: Vite 8.0.3, Alpine.js 3.15.11, Tailwind 4.2.2, Dexie 4.4.2, Navigo 8.11.1, @streamparser/json-whatwg 0.0.22, Chart.js 4.5.1, SortableJS 1.15.7, mana-font 1.18.0, keyrune 3.18.0, material-symbols 0.44.0
- [Scryfall Bulk Data API](https://scryfall.com/docs/api/bulk-data) -- endpoint structure, update frequency, download_uri pattern
- [Scryfall Layouts and Faces](https://scryfall.com/docs/api/layouts) -- card layout taxonomy, card_faces vs root fields
- [Scryfall API Types (TypeScript)](https://github.com/scryfall/api-types/blob/main/src/objects/Card/Card.ts) -- single-face vs multi-face type narrowing
- [Vite 8.0 announcement](https://vite.dev/blog/announcing-vite8) -- Rolldown integration, Worker bundling
- [Tailwind CSS v4 announcement](https://tailwindcss.com/blog/tailwindcss-v4) -- @theme syntax, @import migration
- [Dexie.js Best Practices](https://dexie.org/docs/Tutorial/Best-Practices) -- bulkPut, transaction management
- [MDN Storage API quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) -- navigator.storage.persist()

### Secondary (MEDIUM confidence)
- [WebKit Storage Policy Updates](https://webkit.org/blog/14403/updates-to-storage-policy/) -- Safari 17+ storage behaviour
- [@streamparser/json-whatwg npm](https://www.npmjs.com/package/@streamparser/json-whatwg) -- API usage, WHATWG TransformStream integration
- [Navigo GitHub](https://github.com/krasimir/navigo) -- hash mode config, last commit activity
- [Google Webfonts Helper](https://gwfh.mranftl.com/fonts) -- self-hosted .woff2 download tool

### Tertiary (LOW confidence)
- Scryfall bulk file actual size (~300MB) -- varies with card database growth, needs verification at download time

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified against npm registry on 2026-04-03
- Architecture: HIGH -- patterns based on official docs and verified library capabilities
- Pitfalls: HIGH -- based on documented library behaviours and well-known IndexedDB constraints
- Scryfall data shape: MEDIUM -- layout taxonomy verified via API types but not tested against actual bulk file

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable libraries, 30-day window)
