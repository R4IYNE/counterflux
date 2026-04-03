<!-- GSD:project-start source:PROJECT.md -->
## Project

**Counterflux: The Aetheric Archive**

A premium, desktop-first web application for Magic: The Gathering collectors and Commander players. Counterflux consolidates collection tracking, deckbuilding, market intelligence, spoiler browsing, and game tracking into a single command centre — with a distinctive "Neo-Occult Terminal" visual identity inspired by the Izzet guild. No other MTG tool offers this combination of unified data and aesthetic identity.

**Core Value:** The deck builder knows what you own, and the collection knows what's in your decks — one interconnected data layer that eliminates tab-juggling across fragmented tools.

### Constraints

- **Scryfall API compliance**: User-Agent header required, 50-100ms delay between requests, must not paywall Scryfall data, must not crop artist credits, must not repackage without adding value
- **Local-first**: Must work without account creation or internet (after initial data fetch). IndexedDB for persistence, bulk data cache for offline card lookup
- **Desktop-first**: Optimised for desktop viewports. Only Vandalblast (Game Tracker) requires mobile-responsive layout
- **Performance**: Initial load < 3s, autocomplete < 200ms, collection scroll virtualised at 1,000+ cards, deck analytics recalc < 100ms
- **Stack**: Lightweight — no heavy SPA framework. Vite build, Tailwind CSS, vanilla JS or lightweight reactivity layer (Alpine.js/Petite Vue/Lit). Final choice pending research
- **Bulk data**: Scryfall bulk exports can be ~300MB+ — need efficient caching and storage strategy
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Build Tool
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vite | 8.x | Build, dev server, HMR | Rolldown-powered unified bundler (Rust), 10-30x faster builds than Vite 6/7. Mature ecosystem, excellent vanilla JS support. No framework lock-in. Browser console forwarding useful for debugging. |
- Webpack: Slower, more config overhead, dying ecosystem
- Parcel: Less community support, fewer plugins
- esbuild direct: No HMR, no plugin ecosystem
### Reactivity Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Alpine.js | 3.15.x | Declarative reactivity in HTML | Best fit for this project's 5-screen architecture with complex interactive components. ~17KB min+gzip. Active maintenance (latest 3.15.9, April 2026). Tailwind-like DX with `x-data`, `x-for`, `x-bind`. Plugin ecosystem covers routing, state management. |
| Criterion | Alpine.js | Lit 4.x | Petite Vue | Vanilla JS |
|-----------|-----------|---------|------------|------------|
| Bundle size | ~17KB gzip | ~6KB gzip | ~7KB gzip | 0KB |
| Maintenance | Active (weekly) | Active | Abandoned (v0.4.1, no release in 4 years) | N/A |
| Learning curve | Low (HTML-first) | Medium (Web Components) | Low | High for reactivity |
| Component model | HTML directives | Shadow DOM | Template directives | Manual |
| Plugin ecosystem | Rich (persist, mask, sort) | Moderate | None | None |
| Complex state | x-data + Alpine.store() | ReactiveElement | Reactive refs | Manual pub/sub |
| DX with Tailwind | Excellent (same philosophy) | Good | Good | Tedious |
- Shadow DOM creates CSS isolation headaches with Tailwind (styles don't pierce shadow boundaries)
- Web Components are designed for cross-framework reuse — overkill for a single app
- Alpine's HTML-first model means less boilerplate for data-heavy views
- *Concern:* Performance with 1000+ card lists → *Mitigation:* Virtual scrolling handles DOM, Alpine only manages state
- *Concern:* Complex drag-and-drop → *Mitigation:* SortableJS handles DnD natively, Alpine wires the data binding
- *Concern:* Bundle growth (was 9KB in v2, now ~17KB) → *Mitigation:* Still small; total app bundle will be dominated by chart lib
### CSS Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 4.x | Utility-first styling | CSS-first config (no `tailwind.config.js`), 2-5x faster builds via Rust Oxide engine, container queries in core. Pairs perfectly with Alpine.js. |
- `@import "tailwindcss"` replaces `@tailwind` directives
- `@theme` in CSS replaces `tailwind.config.js`
- `border-*` defaults changed (no longer gray-200)
- Container queries built-in (no plugin needed)
- Requires Safari 16.4+, Chrome 111+, Firefox 128+ (fine for desktop-first)
### Database (Client-Side)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Dexie.js | 4.x | IndexedDB wrapper for collections, decks, game history | Fluent query API, schema versioning, compound indexes, transaction support. ~30KB gzip. The only serious choice for complex querying over 1000s of records. |
| Criterion | Dexie.js | idb | Raw IndexedDB |
|-----------|----------|-----|---------------|
| Bundle size | ~30KB gzip | ~1.5KB gzip | 0KB |
| Query API | `.where('cmc').above(3).and(c => c.colors.includes('U'))` | Manual cursor iteration | Verbose callback hell |
| Schema migration | Built-in versioning | Manual | Manual |
| Compound indexes | Yes | Manual | Manual |
| Transactions | Simplified | Promise-wrapped | Callback-based |
| Bulk operations | `.bulkPut()`, `.bulkAdd()` | Manual loops | Manual |
### Charts
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Chart.js | 4.x | Mana curves, pie charts, portfolio sparklines, life total graphs | ~65KB gzip (tree-shakeable to ~30-40KB). Broadest chart type coverage. Canvas-based. Excellent docs. Industry standard. |
| Criterion | Chart.js 4 | uPlot | Frappe Charts | D3 |
|-----------|-----------|-------|--------------|-----|
| Bundle size (gzip) | ~65KB (tree-shake to ~35KB) | ~15KB | ~18KB | ~80KB |
| Chart types | Bar, line, pie, doughnut, radar, scatter, bubble | Line, bar, area only | Bar, line, pie, percentage | Everything (build from scratch) |
| Pie/doughnut | Yes (native) | No | Yes (limited) | Manual |
| Radar chart | Yes (for colour wheel) | No | No | Manual |
| Animation | Built-in | Minimal | Basic | Manual |
| Learning curve | Low | Low | Low | Very high |
| Responsive | Built-in | Manual | Built-in | Manual |
### Virtual Scrolling
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Custom implementation | N/A | Virtualise 1000+ card collection views | ~150 lines of vanilla JS. No dependency needed. The DOM recycling pattern is straightforward for fixed-height card rows/grids. |
### Drag and Drop
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| SortableJS | 1.15.x | Deck builder card dragging between categories | Framework-agnostic, native HTML5 DnD API, multi-list support, touch-friendly. ~12KB min+gzip (core). Battle-tested (26K+ GitHub stars). |
- `group` option: drag cards between "Creatures", "Instants", "Lands" categories
- `sort` option: reorder within categories
- `onEnd` callback: sync with Alpine.js state and Dexie
- Touch support: important even for desktop (trackpad gestures)
- Animation: built-in smooth reorder animations
- Dragula: Simpler but lacks multi-group support needed for deck categories
- DFlex: Newer, less battle-tested, smaller community
- HTML5 DnD API raw: Painful cross-browser quirks, no animation, no touch
### Routing
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Navigo | 8.11.x | SPA routing for 5 screens | ~4KB gzip. Clean API, History API based, data-navigo attribute for declarative links. Zero dependencies. |
### Mana Symbol Rendering
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| mana-font | latest | MTG mana, tap, and card type symbol rendering | CSS icon font (like Font Awesome). `<i class="ms ms-u ms-cost"></i>` renders a blue mana symbol. Complete symbol coverage. Colourable and scaleable via CSS. |
| keyrune | latest | MTG set symbol rendering | Companion to mana-font. `<i class="ss ss-neo"></i>` renders Kamigawa: Neon Dynasty set symbol. |
- Requires network requests for each symbol (or pre-fetching 100+ SVGs)
- No consistent sizing/alignment built in
- mana-font handles hybrid mana, phyrexian mana, tap symbols, etc. as single glyphs
- Font approach = instant rendering, CSS-controllable colour/size
### Supporting Libraries
| Library | Version | Purpose | Bundle Impact |
|---------|---------|---------|---------------|
| alpinejs | 3.15.x | Reactivity layer | ~17KB gzip |
| @alpinejs/persist | 3.x | Persist Alpine state to localStorage | ~1KB gzip |
| dexie | 4.x | IndexedDB wrapper | ~30KB gzip |
| chart.js | 4.x | Charts (tree-shaken) | ~35KB gzip |
| sortablejs | 1.15.x | Drag and drop | ~12KB gzip |
| navigo | 8.11.x | SPA routing | ~4KB gzip |
| mana-font | latest | Mana symbols | ~50KB (font files, cached) |
| keyrune | latest | Set symbols | ~80KB (font files, cached) |
## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Build | Vite 8 | Webpack 5 | Slower, more config, dying ecosystem |
| Reactivity | Alpine.js 3.15 | Lit 4.x | Shadow DOM + Tailwind = pain. Web Components overkill for single app |
| Reactivity | Alpine.js 3.15 | Petite Vue | Abandoned. Last release 4 years ago. v0.4.1 forever |
| Reactivity | Alpine.js 3.15 | Vanilla JS | DX nightmare for 5 screens with live-updating state |
| CSS | Tailwind v4 | Tailwind v3 | v3 is legacy. No reason to start a greenfield on it |
| Database | Dexie.js 4 | idb | Just a Promise wrapper. No query API for complex data |
| Charts | Chart.js 4 | uPlot | No pie/doughnut/radar charts. Time-series specialist only |
| Charts | Chart.js 4 | D3 | Massive bundle, builds charts from primitives. Overkill |
| DnD | SortableJS | Dragula | No multi-group support for deck categories |
| Routing | Navigo | Custom | Navigo saves time. Custom is fallback if issues arise |
| Mana symbols | mana-font | Scryfall SVGs | Network requests, no sizing control, partial coverage |
## Installation
# Core dependencies
# Dev dependencies
## Sources
- [Vite 8.0 announcement](https://vite.dev/blog/announcing-vite8) — HIGH confidence
- [Vite 7.0 announcement](https://vite.dev/blog/announcing-vite7) — HIGH confidence
- [Alpine.js GitHub releases](https://github.com/alpinejs/alpine/releases) — HIGH confidence
- [Alpine.js Bundlephobia](https://bundlephobia.com/package/alpinejs) — HIGH confidence
- [Petite Vue maintenance discussion](https://github.com/vuejs/petite-vue/discussions/53) — HIGH confidence
- [Lit.dev official site](https://lit.dev/) — HIGH confidence
- [Tailwind CSS v4 announcement](https://tailwindcss.com/blog/tailwindcss-v4) — HIGH confidence
- [Tailwind CSS upgrade guide](https://tailwindcss.com/docs/upgrade-guide) — HIGH confidence
- [Dexie.js npm](https://www.npmjs.com/package/dexie) — HIGH confidence
- [Dexie.js Bundlephobia](https://bundlephobia.com/package/dexie) — HIGH confidence
- [Chart.js tree-shaking docs](https://www.chartjs.org/docs/latest/getting-started/integration.html) — HIGH confidence
- [uPlot GitHub](https://github.com/leeoniya/uPlot) — HIGH confidence
- [SortableJS GitHub](https://github.com/SortableJS/Sortable) — HIGH confidence
- [Navigo GitHub](https://github.com/krasimir/navigo) — MEDIUM confidence (last updated ~5 years ago)
- [mana-font GitHub](https://github.com/andrewgioia/mana) — HIGH confidence
- [Scryfall card symbols API](https://scryfall.com/docs/api/card-symbols) — HIGH confidence
- [Vite 8 Rolldown benchmarks](https://www.theregister.com/2026/03/16/vite_8_rolldown/) — MEDIUM confidence
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
