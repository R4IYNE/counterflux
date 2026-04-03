# Technology Stack

**Project:** Counterflux: The Aetheric Archive
**Researched:** 2026-04-03

## Recommended Stack

### Build Tool

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vite | 8.x | Build, dev server, HMR | Rolldown-powered unified bundler (Rust), 10-30x faster builds than Vite 6/7. Mature ecosystem, excellent vanilla JS support. No framework lock-in. Browser console forwarding useful for debugging. |

**Confidence:** HIGH — Vite 8.0.3 is current stable (March 2026). Rolldown replaces the dual esbuild/Rollup architecture. Well-documented migration path.

**Version note:** Use `vite@8` not `vite@6`. Vite 8 is stable and the dual-bundler era is over. Requires Node.js 22+.

**Why not alternatives:**
- Webpack: Slower, more config overhead, dying ecosystem
- Parcel: Less community support, fewer plugins
- esbuild direct: No HMR, no plugin ecosystem

---

### Reactivity Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Alpine.js | 3.15.x | Declarative reactivity in HTML | Best fit for this project's 5-screen architecture with complex interactive components. ~17KB min+gzip. Active maintenance (latest 3.15.9, April 2026). Tailwind-like DX with `x-data`, `x-for`, `x-bind`. Plugin ecosystem covers routing, state management. |

**Confidence:** HIGH — Alpine.js is actively maintained, battle-tested, and designed exactly for this use case: adding reactivity to HTML without a virtual DOM framework.

**Why Alpine.js over alternatives:**

| Criterion | Alpine.js | Lit 4.x | Petite Vue | Vanilla JS |
|-----------|-----------|---------|------------|------------|
| Bundle size | ~17KB gzip | ~6KB gzip | ~7KB gzip | 0KB |
| Maintenance | Active (weekly) | Active | Abandoned (v0.4.1, no release in 4 years) | N/A |
| Learning curve | Low (HTML-first) | Medium (Web Components) | Low | High for reactivity |
| Component model | HTML directives | Shadow DOM | Template directives | Manual |
| Plugin ecosystem | Rich (persist, mask, sort) | Moderate | None | None |
| Complex state | x-data + Alpine.store() | ReactiveElement | Reactive refs | Manual pub/sub |
| DX with Tailwind | Excellent (same philosophy) | Good | Good | Tedious |

**Petite Vue is eliminated.** Last release was v0.4.1 four years ago. Explicitly "use at your own risk." No feature requests accepted. Effectively abandoned.

**Lit is a close second** but worse for this project because:
- Shadow DOM creates CSS isolation headaches with Tailwind (styles don't pierce shadow boundaries)
- Web Components are designed for cross-framework reuse — overkill for a single app
- Alpine's HTML-first model means less boilerplate for data-heavy views

**Vanilla JS is eliminated** for DX reasons. Building reactivity, templating, and state management from scratch for 5 complex screens with live-updating analytics would be a maintenance nightmare.

**Alpine.js concerns and mitigations:**
- *Concern:* Performance with 1000+ card lists → *Mitigation:* Virtual scrolling handles DOM, Alpine only manages state
- *Concern:* Complex drag-and-drop → *Mitigation:* SortableJS handles DnD natively, Alpine wires the data binding
- *Concern:* Bundle growth (was 9KB in v2, now ~17KB) → *Mitigation:* Still small; total app bundle will be dominated by chart lib

---

### CSS Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 4.x | Utility-first styling | CSS-first config (no `tailwind.config.js`), 2-5x faster builds via Rust Oxide engine, container queries in core. Pairs perfectly with Alpine.js. |

**Confidence:** HIGH — Tailwind v4 released January 2025, stable and widely adopted. Automated migration tool available.

**Key v4 changes from v3:**
- `@import "tailwindcss"` replaces `@tailwind` directives
- `@theme` in CSS replaces `tailwind.config.js`
- `border-*` defaults changed (no longer gray-200)
- Container queries built-in (no plugin needed)
- Requires Safari 16.4+, Chrome 111+, Firefox 128+ (fine for desktop-first)

**Why v4 over v3:** v3 is legacy. v4 is the present. Greenfield project should use v4. The CSS-first config is simpler and the Rust engine is faster. No reason to start on v3.

---

### Database (Client-Side)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Dexie.js | 4.x | IndexedDB wrapper for collections, decks, game history | Fluent query API, schema versioning, compound indexes, transaction support. ~30KB gzip. The only serious choice for complex querying over 1000s of records. |

**Confidence:** HIGH — Dexie 4.4.2 is current (April 2026). Actively maintained. De facto standard for serious IndexedDB work.

**Why Dexie over alternatives:**

| Criterion | Dexie.js | idb | Raw IndexedDB |
|-----------|----------|-----|---------------|
| Bundle size | ~30KB gzip | ~1.5KB gzip | 0KB |
| Query API | `.where('cmc').above(3).and(c => c.colors.includes('U'))` | Manual cursor iteration | Verbose callback hell |
| Schema migration | Built-in versioning | Manual | Manual |
| Compound indexes | Yes | Manual | Manual |
| Transactions | Simplified | Promise-wrapped | Callback-based |
| Bulk operations | `.bulkPut()`, `.bulkAdd()` | Manual loops | Manual |

**idb is eliminated.** It's just a Promise wrapper — you still write IndexedDB queries manually. For a project storing card collections (1000s of items), deck compositions, game history with stats, and bulk Scryfall cache data, Dexie's query API is not optional — it's essential.

**Schema design implications:**
```javascript
db.version(1).stores({
  cards: 'id, name, set, cmc, *colors, type_line, rarity',
  collection: '++id, cardId, quantity, condition, foil',
  decks: '++id, name, commander, format, updatedAt',
  deckCards: '++id, deckId, cardId, quantity, category',
  games: '++id, deckId, date, result, turns',
  priceAlerts: '++id, cardId, targetPrice, direction'
});
```

---

### Charts

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Chart.js | 4.x | Mana curves, pie charts, portfolio sparklines, life total graphs | ~65KB gzip (tree-shakeable to ~30-40KB). Broadest chart type coverage. Canvas-based. Excellent docs. Industry standard. |

**Confidence:** HIGH — Chart.js 4.x is stable, actively maintained, tree-shakeable.

**Why Chart.js over alternatives:**

| Criterion | Chart.js 4 | uPlot | Frappe Charts | D3 |
|-----------|-----------|-------|--------------|-----|
| Bundle size (gzip) | ~65KB (tree-shake to ~35KB) | ~15KB | ~18KB | ~80KB |
| Chart types | Bar, line, pie, doughnut, radar, scatter, bubble | Line, bar, area only | Bar, line, pie, percentage | Everything (build from scratch) |
| Pie/doughnut | Yes (native) | No | Yes (limited) | Manual |
| Radar chart | Yes (for colour wheel) | No | No | Manual |
| Animation | Built-in | Minimal | Basic | Manual |
| Learning curve | Low | Low | Low | Very high |
| Responsive | Built-in | Manual | Built-in | Manual |

**uPlot is eliminated** despite smaller size. It lacks pie charts, doughnut charts, and radar charts — all critical for MTG analytics (colour distribution pie, mana curve bar, deck archetype radar). uPlot is a time-series specialist.

**D3 is eliminated.** Massive bundle, steep learning curve, requires building every chart type from primitives. Overkill for dashboard charts.

**Frappe Charts is a decent fallback** but Chart.js's radar chart (useful for deck stat comparisons) and richer animation/tooltip system wins.

**Tree-shaking strategy:** Only register what you need:
```javascript
import { Chart, BarController, PieController, LineController, 
         CategoryScale, LinearScale, BarElement, ArcElement, 
         LineElement, PointElement, Tooltip, Legend } from 'chart.js';
Chart.register(BarController, PieController, LineController, ...);
```

---

### Virtual Scrolling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Custom implementation | N/A | Virtualise 1000+ card collection views | ~150 lines of vanilla JS. No dependency needed. The DOM recycling pattern is straightforward for fixed-height card rows/grids. |

**Confidence:** MEDIUM — Custom implementation is well-documented and common, but requires testing.

**Rationale:** The existing virtual scroll libraries for vanilla JS (vscroll, virtual-scroller, clusterize.js) are either poorly maintained, overly complex, or designed for framework integration. For Counterflux's use case (card grid with uniform card sizes, or table rows with fixed height), a custom implementation is ~150 lines:

```javascript
// Core concept: only render visible items + buffer
const BUFFER = 5;
const visibleStart = Math.floor(scrollTop / itemHeight);
const visibleEnd = Math.min(visibleStart + viewportItems + BUFFER, totalItems);
// Render only items[visibleStart..visibleEnd], use transform for positioning
```

**Fallback option:** If custom proves insufficient, [virtual-scroller](https://www.npmjs.com/package/virtual-scroller) provides a vanilla DOM component. Evaluate during Phase 1 implementation.

---

### Drag and Drop

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| SortableJS | 1.15.x | Deck builder card dragging between categories | Framework-agnostic, native HTML5 DnD API, multi-list support, touch-friendly. ~12KB min+gzip (core). Battle-tested (26K+ GitHub stars). |

**Confidence:** HIGH — SortableJS is the de facto standard for framework-free drag-and-drop. Works perfectly with Alpine.js.

**Key features for deck builder:**
- `group` option: drag cards between "Creatures", "Instants", "Lands" categories
- `sort` option: reorder within categories
- `onEnd` callback: sync with Alpine.js state and Dexie
- Touch support: important even for desktop (trackpad gestures)
- Animation: built-in smooth reorder animations

**Why not alternatives:**
- Dragula: Simpler but lacks multi-group support needed for deck categories
- DFlex: Newer, less battle-tested, smaller community
- HTML5 DnD API raw: Painful cross-browser quirks, no animation, no touch

---

### Routing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Navigo | 8.11.x | SPA routing for 5 screens | ~4KB gzip. Clean API, History API based, data-navigo attribute for declarative links. Zero dependencies. |

**Confidence:** MEDIUM — Navigo works well but hasn't been updated in ~5 years. The API is stable and the History API it wraps hasn't changed. Consider a custom router (~50 lines) if Navigo causes issues.

**Why Navigo:**
```javascript
const router = new Navigo('/');
router
  .on('/dashboard', () => loadView('dashboard'))
  .on('/collection', () => loadView('collection'))
  .on('/deck/:id', ({ data }) => loadDeckBuilder(data.id))
  .on('/market', () => loadView('market'))
  .on('/game', () => loadView('game'))
  .resolve();
```

**Fallback:** Custom router using `window.addEventListener('popstate', ...)` + `history.pushState()`. Only ~50 lines of code. Consider if Navigo's lack of updates becomes a concern.

---

### Mana Symbol Rendering

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| mana-font | latest | MTG mana, tap, and card type symbol rendering | CSS icon font (like Font Awesome). `<i class="ms ms-u ms-cost"></i>` renders a blue mana symbol. Complete symbol coverage. Colourable and scaleable via CSS. |
| keyrune | latest | MTG set symbol rendering | Companion to mana-font. `<i class="ss ss-neo"></i>` renders Kamigawa: Neon Dynasty set symbol. |

**Confidence:** HIGH — mana-font is the community standard for MTG web apps. Maintained by Andrew Gioia. MIT licensed.

**How it works with Scryfall mana cost strings:**
```javascript
// Scryfall returns mana_cost: "{2}{U}{R}"
function renderManaCost(manaCost) {
  return manaCost.replace(/\{([^}]+)\}/g, (_, symbol) => {
    const code = symbol.toLowerCase().replace('/', '');
    return `<i class="ms ms-${code} ms-cost"></i>`;
  });
}
// "{2}{U}{R}" → <i class="ms ms-2 ms-cost"></i><i class="ms ms-u ms-cost"></i><i class="ms ms-r ms-cost"></i>
```

**Why not Scryfall SVGs directly:** Scryfall's `/symbology` API provides SVG URLs (`https://svgs.scryfall.io/card-symbols/U.svg`) but:
- Requires network requests for each symbol (or pre-fetching 100+ SVGs)
- No consistent sizing/alignment built in
- mana-font handles hybrid mana, phyrexian mana, tap symbols, etc. as single glyphs
- Font approach = instant rendering, CSS-controllable colour/size

**Why not mtg-vectors:** Higher quality SVGs but requires manual integration. mana-font is drop-in CSS.

---

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

**Estimated JS bundle (gzip):** ~99KB total JavaScript
**With font assets:** ~229KB total (fonts are cached after first load)

This is extremely lean for a full-featured SPA. For comparison, React alone is ~45KB gzip before you write any application code.

---

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

---

## Installation

```bash
# Core dependencies
npm install alpinejs @alpinejs/persist dexie chart.js sortablejs navigo mana-font keyrune

# Dev dependencies
npm install -D vite tailwindcss @tailwindcss/vite
```

**Vite config (`vite.config.js`):**
```javascript
import tailwindcss from '@tailwindcss/vite';

export default {
  plugins: [tailwindcss()],
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ['chart.js'],
          db: ['dexie'],
        }
      }
    }
  }
};
```

**CSS entry (`src/styles.css`):**
```css
@import "tailwindcss";
@import "mana-font/css/mana.css";
@import "keyrune/css/keyrune.css";

@theme {
  --color-izzet-blue: #0D52BD;
  --color-izzet-red: #E23838;
  --color-void: #0B0C10;
  --color-aether: #1A1C2E;
  --color-ghost: rgba(255, 255, 255, 0.06);
  --font-display: 'Crimson Pro', serif;
  --font-body: 'Space Grotesk', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

---

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
