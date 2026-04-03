# Domain Pitfalls

**Domain:** MTG Collection/Deckbuilding Command Centre (Local-First SPA)
**Researched:** 2026-04-03

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or fundamental architecture failures.

---

### Pitfall 1: Multi-Face Card Data Model Assumption

**What goes wrong:** Treating all cards as having a single `image_uris` and single `mana_cost` at the root level. Scryfall has 18+ distinct layouts. For multi-face cards (`transform`, `modal_dfc`, `split`, `flip`, `meld`, `double_faced_token`, `reversible_card`), `image_uris` lives inside `card_faces[]`, not at the root. A naive `card.image_uris.normal` call returns `undefined` for every double-faced card in the database -- roughly 2,000+ cards including format staples like Delver of Secrets, Fable of the Mirror-Breaker, and dozens of Commander powerhouses.

**Why it happens:** The first 50 test cards during development are probably all `normal` layout. The bug only surfaces when real collection data arrives.

**Consequences:** Broken images across the UI. Incorrect mana cost calculations (split cards have two separate mana costs). Deck colour identity computed wrong. Price data may also differ per face for meld cards.

**Prevention:**
1. Create a unified card accessor layer from day one:
   ```js
   function getImageUri(card, face = 0, size = 'normal') {
     if (card.image_uris) return card.image_uris[size];
     if (card.card_faces?.[face]?.image_uris) return card.card_faces[face].image_uris[size];
     return PLACEHOLDER_IMAGE;
   }
   ```
2. Build a layout-aware test fixture set covering: `normal`, `transform`, `modal_dfc`, `split`, `flip`, `meld`, `adventure`, `reversible_card`. Test every card display component against all of these.
3. Handle `adventure` layout specifically -- it has `card_faces` but only one set of `image_uris` (the adventure text is on the same physical card face).

**Detection:** Card images showing as broken/missing. Mana cost rendering showing `undefined`. Colour identity calculations that miss colours.

**Phase:** Phase 1 (Foundation) -- the card data abstraction layer must handle all layouts before any UI is built on top of it.

**Confidence:** HIGH -- verified against Scryfall's Layouts and Faces documentation and the `scryr` package vignette which lists all 18 layouts and their face structures.

---

### Pitfall 2: Parsing 300MB JSON in the Main Thread

**What goes wrong:** Downloading the Scryfall "Default Cards" bulk file (~300MB, ~85k card objects) and calling `JSON.parse()` on it. The browser allocates 2-3x the string size in memory (~600-900MB), freezes the UI for 5-15 seconds, and may trigger an out-of-memory crash on lower-end machines or on tabs that already have significant memory usage.

**Why it happens:** `fetch().then(r => r.json())` is the most natural pattern and works fine for small payloads. Developers don't test with real bulk data until late in development.

**Consequences:** Unresponsive UI during initial data load. Tab crashes on machines with less than 8GB RAM. Users abandon the app before it finishes loading.

**Prevention:**
1. Use a Web Worker for all bulk data parsing. The worker receives the response stream, parses it, and sends processed chunks back to the main thread.
2. Use a streaming JSON parser like `@streamparser/json-whatwg` (compatible with Web Streams API) to process cards incrementally rather than parsing the entire file at once.
3. Use "Oracle Cards" (~85MB, ~27k unique cards) for card search/autocomplete. Only download "Default Cards" when the user needs printing-specific data (art variants, prices per printing).
4. Progressive hydration: parse in batches of ~5,000 cards, inserting into IndexedDB as you go, showing a progress indicator.

**Detection:** Profiling shows >5s main thread blocks during initial load. Memory profiler shows spikes above 500MB during parsing.

**Phase:** Phase 1 (Foundation) -- the bulk data pipeline is the foundation everything else depends on.

**Confidence:** HIGH -- `JSON.parse()` memory overhead (2-3x) is well-documented. Streaming parsers verified via npm and the ZenGM engineering blog.

---

### Pitfall 3: IndexedDB Schema Migration Without a Strategy

**What goes wrong:** Starting with a simple IndexedDB schema, then needing to add indexes or restructure object stores in later phases. The `onupgradeneeded` handler is the ONLY place you can modify schema, and you must handle every version transition. Without a migration strategy, users on v1 who skip v2 and arrive at v3 hit an unhandled migration path and lose all their data.

**Why it happens:** IndexedDB's migration model is version-number based, not migration-file based. Most tutorials show a single `onupgradeneeded` handler without explaining cumulative migrations. Multi-tab conflicts make it worse -- if a user has an old tab open when they open a new version, the old tab blocks the upgrade.

**Consequences:** Data loss when schema changes. Blocked database connections when multiple tabs are open. Corrupted state from partial migrations.

**Prevention:**
1. Design the schema migration handler as a sequential chain from day one:
   ```js
   function onUpgradeNeeded(event) {
     const db = event.target.result;
     const oldVersion = event.oldVersion;
     if (oldVersion < 1) { /* create initial stores */ }
     if (oldVersion < 2) { /* add new index */ }
     if (oldVersion < 3) { /* restructure store */ }
   }
   ```
2. If using Dexie.js, keep all previous `db.version(N)` declarations (Dexie needs the chain for migration). Never delete old version blocks.
3. Implement `onblocked` and `onversionchange` handlers. Show a "please close other tabs" notification when blocked.
4. Over-index from the start. Adding indexes later requires a migration. Plan for: search by name, oracle_id, set, colour_identity, cmc, type_line, rarity, collector_number.
5. Keep the migration chain in a dedicated `db-migrations.js` file, tested independently.
6. Test migrations with pre-populated data, not empty databases.

**Detection:** Database fails to open after deployment. Users report blank screens. `onblocked` events fire silently.

**Phase:** Phase 1 (Foundation) -- the database layer is foundational and gets harder to change over time.

**Confidence:** HIGH -- verified via MDN documentation, W3C IndexedDB issue #282, and multiple developer post-mortems.

---

### Pitfall 4: Safari/WebKit IndexedDB Data Eviction

**What goes wrong:** Safari deletes IndexedDB data for origins that haven't had user interaction in 7 days of browser usage. iOS can also clear PWA storage if the app hasn't been used for a few weeks. A user who spends a month cataloguing their collection comes back after two weeks away and finds everything gone.

**Why it happens:** WebKit's Intelligent Tracking Prevention (ITP) aggressively evicts script-written storage. This affects all browsers on iOS (including Chrome on iOS, which uses WebKit under the hood). The `m_totalQuota` initialization bug (WebKit Bug 266559) has historically caused mass deletion of all website data even for active origins.

**Consequences:** Complete data loss. User trust destroyed. No recovery path without cloud sync or manual backup.

**Prevention:**
1. Request persistent storage via `navigator.storage.persist()` at startup. This exempts the origin from eviction in Chrome and Firefox (Safari support is limited but improving).
2. Show `navigator.storage.estimate()` quota info in a settings/about panel.
3. Implement CSV/JSON export prominently -- not buried in settings. Make it a first-class "backup your collection" feature with a periodic reminder.
4. Plan cloud sync (Supabase, Phase 5) as a data safety net, but don't rely on it for v1.
5. Show a clear warning on Safari/iOS: "Your data is stored locally. Safari may delete it after extended inactivity. Export regularly."
6. Check `navigator.storage.persisted()` on app load. Show a persistent banner if it returns `false`.

**Detection:** Users reporting data loss. Analytics showing returning Safari users with empty collections.

**Phase:** Phase 1 (Foundation) -- `navigator.storage.persist()` call and export functionality must exist from day one. Safari warning in Phase 2 or 3. Cloud sync in Phase 5.

**Confidence:** HIGH -- verified via WebKit blog "Updates to Storage Policy", WebKit Bug 266559, and MDN Storage Quotas documentation. The 7-day eviction policy is documented by Apple.

---

### Pitfall 5: Oracle ID vs Scryfall ID vs Printing Identity Confusion

**What goes wrong:** Using a single ID type for cards everywhere. A "card" means different things in different contexts:
- **Oracle ID**: The abstract game object (Lightning Bolt is Lightning Bolt regardless of printing). ~27k unique.
- **Scryfall ID**: A specific printing (Beta Lightning Bolt vs M25 Lightning Bolt). ~85k+ unique.
- **Collector Number + Set**: Another way to identify a printing.

Collection tracking needs printing-level granularity (you own a specific Beta Lightning Bolt worth $500, not a $0.50 M25 one). Deck building typically cares about oracle-level (any Lightning Bolt fills the slot). Mixing these up means either losing price/art data or duplicating deck entries.

**Why it happens:** The Scryfall data model uses both `id` (Scryfall UUID per printing) and `oracle_id` (shared across printings), and developers pick one without understanding the distinction.

**Consequences:** Collection values wildly wrong (averaging prices across printings). Deck builder showing duplicate entries for reprints. Users unable to track which specific printing they own. Import/export using wrong identifiers breaks interoperability with Moxfield/Archidekt.

**Prevention:**
1. Store collection entries by Scryfall `id` (printing-level). Each entry tracks: `scryfall_id`, `oracle_id`, `quantity`, `condition`, `foil`.
2. Deck entries reference `oracle_id` for the slot, with an optional `preferred_printing` (Scryfall `id`) for display/price.
3. Build a `printings` index in IndexedDB to quickly look up all printings for a given `oracle_id`.
4. Price display should always show the price of the specific printing owned, never an aggregate.

**Detection:** Two "Lightning Bolt" entries in a deck when only one was added. Price calculations that don't match TCGPlayer/CardKingdom. Users can't find their card when searching by set.

**Phase:** Phase 1 (data model design), reinforced in Phase 2 (Collection Manager) and Phase 3 (Deck Builder).

**Confidence:** HIGH -- this is the single most common data modelling mistake in MTG apps, based on Scryfall API docs and community discussion patterns.

---

### Pitfall 6: Hardcoding Scryfall Image/Download URIs

**What goes wrong:** Constructing image URLs manually (e.g., `https://cards.scryfall.io/normal/front/${id}.jpg`) instead of reading `image_uris` from the API response. Scryfall has migrated domains multiple times -- from `img.scryfall.com` to federated hosts at `c1/c2/c3.scryfall.com`, and then to `cards.scryfall.io`. Hardcoded URLs break silently when domains change. Bulk data download URIs now use timestamped paths, making old-style bookmarks stale.

**Why it happens:** Pattern-matching a few URLs looks easy. API fetching for every image feels like overhead. Developers want to construct URLs without an API call.

**Consequences:** All card images break overnight when Scryfall rotates infrastructure. Bulk data downloads fail because the URL path changed. Scryfall explicitly warns against this and considers it grounds for access restriction.

**Prevention:**
1. Always use `image_uris` from the card object, never construct URLs.
2. For bulk data, always fetch the `/bulk-data/:type` endpoint first to get the current `download_uri`, never bookmark a direct file URL.
3. Cache image URIs alongside card data in IndexedDB, and refresh them when bulk data is re-downloaded.

**Detection:** Mass broken images. Bulk data download 404s.

**Phase:** Phase 1 (Foundation) -- bake this into the data layer from the start.

**Confidence:** HIGH -- Scryfall explicitly warns against this in their API docs and blog post about URI changes.

---

## Moderate Pitfalls

Mistakes that cause significant rework or degraded UX but don't require a full rewrite.

---

### Pitfall 7: Rendering 1000+ Card Images Without Virtualisation

**What goes wrong:** Rendering a collection view with 1,000+ cards as actual `<img>` DOM elements. Each card image is ~50-100KB (normal size). 1,000 images = 50-100MB of image data downloaded simultaneously, 1,000+ DOM nodes with decoded image bitmaps consuming GPU memory, and a completely unresponsive scrolling experience.

**Prevention:**
1. Implement virtual scrolling from the first collection view. Only render cards visible in the viewport plus a small buffer (e.g., 20 cards above/below).
2. Use `loading="lazy"` on all `<img>` tags as a baseline, but don't rely on it alone for 1,000+ items -- the browser's heuristics don't work well with dense grids.
3. Use `IntersectionObserver` for precise lazy loading control.
4. Use Scryfall's `small` image size (146x204) for grid views, only loading `normal` (488x680) for detail/hover views.
5. Show skeleton placeholder cards while images load to prevent layout shift.
6. Keep the full dataset in the database (Dexie), not in reactive state. Reactive state holds only the visible slice.

**Detection:** Scrolling is janky. Network tab shows hundreds of simultaneous image requests. Memory usage exceeds 500MB for a collection view.

**Phase:** Phase 2 (Collection Manager) -- the first phase with large card lists.

**Confidence:** HIGH -- standard web performance pattern, verified via MDN and web.dev documentation.

---

### Pitfall 8: Mana Cost Symbol Rendering Edge Cases

**What goes wrong:** Building a naive regex to convert `{W}` to a white mana icon, then discovering the full symbol set:
- Basic: `{W}`, `{U}`, `{B}`, `{R}`, `{G}`
- Generic: `{0}` through `{20}`, `{X}`, `{Y}`, `{Z}`
- Hybrid: `{W/U}`, `{U/B}`, `{B/R}`, `{R/G}`, `{G/W}` (10 guild combinations)
- Phyrexian: `{W/P}`, `{U/P}`, `{B/P}`, `{R/P}`, `{G/P}`
- Phyrexian hybrid: `{W/U/P}` (introduced in Kamigawa: Neon Dynasty)
- Snow: `{S}`
- Colourless: `{C}`
- Half mana: `{HW}` (Un-sets)
- Tap/Untap: `{T}`, `{Q}`
- Energy: `{E}`
- Two-generic hybrid: `{2/W}`, `{2/U}`, etc.

A simple string replacement breaks on hybrid symbols containing `/`. Phyrexian hybrid (`{W/U/P}`) breaks parsers expecting exactly one `/`.

**Prevention:**
1. Use the `mana-font` npm package (andrewgioia/mana) which provides a complete CSS icon font covering ALL mana symbols. Map Scryfall's `{W/U}` syntax to CSS classes like `ms ms-wu ms-cost`.
2. Build the mana cost parser as a lookup table, not a string manipulation chain:
   ```js
   const MANA_MAP = {
     'W': 'ms-w', 'U': 'ms-u', 'B': 'ms-b', 'R': 'ms-r', 'G': 'ms-g',
     'W/U': 'ms-wu', 'W/P': 'ms-wp', 'W/U/P': 'ms-wup',
     '2/W': 'ms-2w', 'S': 'ms-s', 'C': 'ms-c', 'E': 'ms-e',
     // ... complete mapping
   };
   const MANA_SYMBOL_RE = /\{([^}]+)\}/g;
   ```
3. Use Scryfall's `/symbology` API endpoint to get the canonical list of all symbols for validation.
4. Test with edge-case cards: Reaper King (`{2/W}{2/U}{2/B}{2/R}{2/G}`), Tamiyo's Compleation (`{G/U/P}`), Transguild Courier (no mana symbols in cost but five-colour identity).
5. Fallback to plain text `{X}` display for any unmapped symbol rather than crashing.
6. Reference mana-font's [cheatsheet](https://andrewgioia.github.io/Mana/) for the complete class list.

**Detection:** Broken or missing mana symbols in the UI. Colour identity calculations that miss hybrid colours. Visual glitches on Phyrexian symbols.

**Phase:** Phase 1 (Foundation) -- mana rendering is used everywhere: collection, deck builder, search results.

**Confidence:** HIGH -- the mana-font library is the community standard (verified via GitHub/npm), and Scryfall's symbology API is documented.

---

### Pitfall 9: Collection-Deck Cross-Reference Performance

**What goes wrong:** When the deck builder shows "owned/missing" indicators for each card, a naive implementation queries the collection for every card in the deck on every render. With a 100-card Commander deck and a 5,000-card collection, that's 100 IndexedDB lookups per render. IndexedDB's transaction overhead makes this far slower than expected. When adding/removing cards triggers a re-render, the UI becomes sluggish.

**Prevention:**
1. Build an in-memory lookup Map of owned oracle IDs and quantities on app startup: `Map<oracle_id, { total: number, printings: Printing[] }>`.
2. Update the Map reactively when collection changes, don't rebuild from IndexedDB each time.
3. Deck analytics (curve, colour breakdown, type distribution) should be computed incrementally on card add/remove, not recalculated from scratch.
4. Use a single `requestAnimationFrame` debounce for analytics recalculation to avoid multiple recalcs per interaction.
5. Use Dexie's `.toArray()` once at deck builder load, then work from the Map.

**Detection:** Adding a card to a deck has visible lag (>100ms). Deck analytics panel flickers or takes >200ms to update.

**Phase:** Phase 3 (Deck Builder) -- but the data structure design should be planned in Phase 1.

**Confidence:** MEDIUM -- standard performance optimisation, but the exact impact depends on implementation choices.

---

### Pitfall 10: Framework-less State Management Spaghetti

**What goes wrong:** Starting with simple event listeners and DOM manipulation, then reaching 10+ interactive panels (sidebar, search, card grid, analytics, deck list, filters, modals, context menus, toast notifications, undo stack). Without a state management pattern, you end up with:
- Components directly mutating shared state
- Event listeners attached to elements that get replaced by `innerHTML`
- No way to undo an action because state changes aren't tracked
- Memory leaks from orphaned event listeners on removed DOM nodes

**Why it happens:** Vanilla JS feels fast and simple for the first 3 screens. The complexity cliff arrives around screen 5-7 when interactions between panels create implicit dependencies.

**Prevention:**
1. Choose a lightweight reactivity layer (Alpine.js, Petite Vue, or Lit). Don't go fully framework-less for an app of this complexity. The stack research should make this decision.
2. If using Alpine.js, be aware of its proxy overhead with large arrays (see Pitfall below).
3. Use an `AbortController` per "view" lifecycle to batch-cleanup all event listeners when a view is torn down.
4. Each screen module should export a `destroy()` function called by the router before loading the next screen.
5. Never use `innerHTML` to update parts of an existing view. Use `element.replaceChildren()` or a template-based approach.
6. Implement undo as a command pattern (`{ do(), undo() }` objects pushed to a stack) from the start, not bolted on later.

**Detection:** Adding a new feature requires touching 5+ files. UI state gets "stuck" (e.g., a modal that won't close). Memory usage grows monotonically as the user navigates between screens without reloading.

**Phase:** Phase 1 (Foundation) -- the reactivity/state pattern must be established before building views.

**Confidence:** HIGH -- this is the most universal pitfall for framework-less SPAs of this complexity.

---

### Pitfall 11: Scryfall Rate Limit Violations

**What goes wrong:** Sending bursts of API requests (e.g., fetching 50 card images or autocomplete suggestions without throttling) exceeds Scryfall's rate limit. Scryfall enforces a maximum of 10 requests per second. HTTP 429 responses are returned for violations, and persistent abuse results in permanent IP/User-Agent bans.

**Prevention:**
1. Use bulk data for any operation that would require more than 10 individual card lookups.
2. Implement a request queue with 75-100ms minimum delay between requests.
3. For autocomplete, use Scryfall's `/cards/autocomplete` endpoint (designed for this) with debounced input (300ms), not individual `/cards/named` lookups.
4. Use the `/cards/collection` POST endpoint for batch lookups (up to 75 identifiers per request) for collection import.
5. Cache API responses in IndexedDB or memory. Card data doesn't change within 24 hours. Prices update once daily.
6. Set a proper `User-Agent` header identifying your app: `User-Agent: Counterflux/1.0 (contact@email.com)` (required by Scryfall TOS).

**Detection:** 429 responses in the network tab. Log and alert if more than 3 occur in a 5-minute window. Scryfall blocking your requests entirely.

**Phase:** Phase 1 (Foundation) -- the API client must have rate limiting built in from the first request.

**Confidence:** HIGH -- Scryfall's rate limit documentation is explicit and they enforce it.

---

### Pitfall 12: Ignoring Scryfall Attribution Requirements

**What goes wrong:** Using Scryfall's `art_crop` image format without showing artist name and copyright. Cropping or clipping card images to hide the artist credit line. Paywalling access to Scryfall data. Any of these can result in Scryfall revoking API access.

**Prevention:**
1. When using `art_crop` (which removes the credit line), display `card.artist` and a copyright notice (`TM & (c) Wizards of the Coast`) adjacent to the image.
2. Never crop or modify card images to remove credits.
3. Keep all Scryfall-sourced data freely accessible (no premium tier for card search/prices).
4. Include a Scryfall attribution link somewhere in the app footer or about section.

**Detection:** Receiving a communication from Scryfall about TOS violations. API access being restricted.

**Phase:** Phase 1 (Foundation) -- attribution should be baked into card display components from the start.

**Confidence:** HIGH -- directly from Scryfall's Terms of Service and API documentation.

---

### Pitfall 13: Alpine.js Reactivity with Large Arrays

**What goes wrong:** Alpine.js proxies all reactive data. A reactive array of 5,000+ card objects causes noticeable lag when the array is modified (add/remove/sort), because the proxy intercepts every property access on every object in the array.

**Prevention:**
1. Virtual scroll means only ~20-50 items need to be in the reactive "visible" array.
2. Keep the full dataset in Dexie, not in Alpine state.
3. Alpine state holds: current page/slice of items, filters, sort state.
4. Dexie query returns only the visible slice.
5. For sort/filter operations, run the query against Dexie (which uses IndexedDB indexes) and replace the visible slice, don't sort a 5,000-element reactive array in-place.

**Phase:** Phase 2 (Collection Manager) -- first phase dealing with large lists.

**Confidence:** MEDIUM -- Alpine.js proxy overhead is documented but exact thresholds depend on object complexity.

---

## Minor Pitfalls

Issues that cause friction but are fixable without major rework.

---

### Pitfall 14: Null/Missing Data Fields

**What goes wrong:** Scryfall card objects have many nullable fields. `prices.usd` is null for cards without a TCGPlayer listing. `image_uris` is null during spoiler season. `mana_cost` is empty string for lands. `power`/`toughness` are null for non-creatures (and are strings, not numbers, because of `*` and `1+*`).

**Prevention:**
1. Treat every Scryfall field access as potentially null. Use optional chaining and fallbacks throughout.
2. Display "N/A" or "--" for null prices, not $0.00 (which implies the card is worthless).
3. For `power`/`toughness`, keep them as strings. Don't try to `parseInt()` them -- cards like Tarmogoyf have `*/1+*`.

**Phase:** Phase 1 (Foundation) -- handle in the card data abstraction layer.

**Confidence:** HIGH.

---

### Pitfall 15: Import/Export Format Incompatibility

**What goes wrong:** Building a deck import parser that handles one format (e.g., `4x Lightning Bolt`) but breaks on:
- MTGO format: `4 Lightning Bolt`
- Moxfield format: `1 Lightning Bolt (2XM) 117`
- Arena format: `4 Lightning Bolt (STA) 42`
- Set codes in parentheses vs brackets
- Sideboard/Companion/Commander sections
- DFC names with `//`: `Delver of Secrets // Insectile Aberration`

**Prevention:**
1. Support the Moxfield/Archidekt format as primary (it's the most common among Commander players): `quantity name (set) collector_number`
2. Handle `//` in card names by searching for the front face name only.
3. Use regex with named groups for robust parsing.
4. Test imports against real decklists exported from Moxfield, Archidekt, and MTGO.

**Phase:** Phase 3 (Deck Builder) for deck import. Phase 2 (Collection Manager) for CSV import.

**Confidence:** MEDIUM -- format details based on community patterns, not official specs.

---

### Pitfall 16: Deck Legality Validation Complexity

**What goes wrong:** Trying to validate Commander deck legality beyond basic card count. Commander format rules include:
- Exactly 100 cards including commander
- No duplicates (except basic lands and cards that explicitly allow it like Relentless Rats, Shadowborn Apostle)
- Colour identity constraint (every card must match commander's colour identity)
- Ban list that changes quarterly
- Partner commanders, companion rules, background commanders

**Prevention:**
1. Start with simple validation only: card count, no duplicates, colour identity match.
2. Use Scryfall's `legalities.commander` field for ban list checking rather than maintaining your own.
3. Defer partner/companion/background validation to a later iteration.
4. Colour identity is NOT the same as mana cost -- check `card.color_identity`, not `card.colors` or parsed mana cost. Colour identity includes mana symbols in rules text (e.g., Kenrith has WUBRG identity despite {5} mana cost).

**Phase:** Phase 3 (Deck Builder) -- basic validation. Don't try to be comprehensive in v1.

**Confidence:** HIGH -- Commander format rules are well-documented on mtg.wiki.

---

### Pitfall 17: Chart Library Overhead for Simple Visualisations

**What goes wrong:** Importing a full charting library (Chart.js is ~200KB minified, Recharts pulls in React + D3) for simple mana curve and colour pie visualisations that could be done with CSS or lightweight SVG.

**Prevention:**
1. For mana curve: use CSS bar charts (simple `<div>` elements with percentage heights). No library needed.
2. For colour pie: use a lightweight SVG pie chart (Canvas API or manual SVG arc paths). ~50 lines of code.
3. If a chart library is needed later for Market Intel trend lines, lazy-load it only in Phase 4, not bundled in the core.
4. If Chart.js is used, store instances and call `chart.destroy()` on screen teardown. Creating a second instance on the same canvas causes visual glitches and memory leaks.

**Phase:** Phase 3 (Deck Builder) for analytics. Phase 4 (Market Intel) for trend charts.

**Confidence:** MEDIUM -- depends on how complex the analytics visualisations need to be.

---

### Pitfall 18: Router/Screen Teardown Memory Leaks

**What goes wrong:** When navigating between screens in a SPA, the previous screen's event listeners, timers, SortableJS instances, and chart instances persist. Memory leaks accumulate over a session.

**Prevention:**
1. Each screen module exports a `destroy()` function.
2. Router calls `previousScreen.destroy()` before loading next screen.
3. `destroy()` removes event listeners, clears intervals/timeouts, calls `sortable.destroy()`, calls `chart.destroy()`.
4. Use `AbortController` pattern: create one per screen, pass its `signal` to all `addEventListener` calls, call `controller.abort()` in `destroy()`.

**Phase:** Phase 1 (Foundation) -- establish the screen lifecycle pattern from the first route.

**Confidence:** HIGH -- standard SPA lifecycle management.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 1: Data Layer | Multi-face card model (#1) | Card accessor abstraction with layout-aware image/mana/identity helpers |
| Phase 1: Data Layer | Bulk data memory (#2) | Web Worker + streaming parser + batch insert |
| Phase 1: Data Layer | Schema migration (#3) | Sequential migration chain, over-index from start |
| Phase 1: Data Layer | Rate limiting (#11) | Request queue with 75ms delay, proper User-Agent |
| Phase 1: Data Layer | Hardcoded URIs (#6) | Always read URIs from card objects, never construct |
| Phase 1: UI Shell | State management (#10) | Choose reactivity layer (Alpine/Petite Vue/Lit) before building views |
| Phase 1: UI Shell | Screen teardown (#18) | AbortController pattern, destroy() lifecycle |
| Phase 1: UI Shell | Mana rendering (#8) | mana-font + lookup table, test edge cases |
| Phase 1: All | Attribution (#12) | Bake artist credit into card display components |
| Phase 1: All | Storage eviction (#4) | `persist()` call, export feature, Safari warning |
| Phase 2: Collection | Virtualisation (#7) | Virtual scroll from day one, small images for grids |
| Phase 2: Collection | ID confusion (#5) | Scryfall ID for collection, oracle ID for deck slots |
| Phase 2: Collection | Alpine large arrays (#13) | Keep full data in Dexie, reactive state holds visible slice only |
| Phase 3: Deck Builder | Cross-ref perf (#9) | In-memory Map, incremental analytics |
| Phase 3: Deck Builder | Import formats (#15) | Support Moxfield format primary, handle `//` in names |
| Phase 3: Deck Builder | Legality (#16) | Simple validation first, use Scryfall legalities field |
| Phase 4: Market Intel | Null prices (#14) | Display "N/A" not $0.00, optional chaining everywhere |
| Phase 4: Market Intel | Chart overhead (#17) | CSS charts for simple viz, lazy-load Chart.js only if needed |
| Phase 5: Cloud Sync | Local-to-cloud migration | Plan IndexedDB-to-Supabase sync protocol. Conflict resolution is hard. |

---

## Sources

- [Scryfall API Documentation](https://scryfall.com/docs/api) -- HIGH confidence
- [Scryfall Layouts and Faces](https://scryfall.com/docs/api/layouts) -- HIGH confidence (verified via scryr R package vignette)
- [Scryfall Bulk Data](https://scryfall.com/docs/api/bulk-data) -- HIGH confidence
- [Scryfall Blog: Image URI Changes](https://scryfall.com/blog/upcoming-api-changes-to-scryfall-image-uris-and-download-uris-224) -- HIGH confidence
- [Scryfall Blog: Bulk Data Updates](https://scryfall.com/blog/updates-to-bulk-data-and-cards-deprecation-notice-217) -- HIGH confidence
- [Scryfall Terms of Service](https://scryfall.com/docs/terms) -- HIGH confidence
- [Scryfall Card Symbols API](https://scryfall.com/docs/api/card-symbols) -- HIGH confidence
- [MDN: IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) -- HIGH confidence
- [MDN: Storage Quotas and Eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) -- HIGH confidence
- [WebKit Bug 266559: Safari erasing IndexedDB](https://bugs.webkit.org/show_bug.cgi?id=266559) -- HIGH confidence
- [WebKit Blog: Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/) -- HIGH confidence
- [W3C IndexedDB Issue #282: Schema Compatibility](https://github.com/w3c/IndexedDB/issues/282) -- HIGH confidence
- [Chrome: IndexedDB Storage Improvements](https://developer.chrome.com/docs/chromium/indexeddb-storage-improvements) -- HIGH confidence
- [RxDB: IndexedDB Performance](https://rxdb.info/slow-indexeddb.html) -- MEDIUM confidence
- [andrewgioia/mana: MTG Mana Font](https://github.com/andrewgioia/mana) -- HIGH confidence
- [mana-font npm package](https://www.npmjs.com/package/mana-font) -- HIGH confidence
- [ZenGM Blog: Streaming JSON Parsing with Web Streams](https://zengm.com/blog/2025/10/streaming-json-parsing/) -- MEDIUM confidence
- [@streamparser/json-whatwg](https://www.npmjs.com/package/@streamparser/json-whatwg) -- MEDIUM confidence
- [web.dev: Browser-level Image Lazy Loading](https://web.dev/articles/browser-level-image-lazy-loading) -- HIGH confidence
- [Dexie.js Schema Versioning](https://dexie.org/docs/Tutorial/Design#database-versioning) -- HIGH confidence
- [MDN: IDBOpenDBRequest upgradeneeded event](https://developer.mozilla.org/en-US/docs/Web/API/IDBOpenDBRequest/upgradeneeded_event) -- HIGH confidence
