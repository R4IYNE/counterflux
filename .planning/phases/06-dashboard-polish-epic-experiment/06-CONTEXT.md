# Phase 6: Dashboard + Polish (Epic Experiment) - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the Epic Experiment dashboard screen that surfaces data from all five modules (Collection, Deck Builder, Intelligence, Market Intel, Game Tracker). Add cross-cutting UX polish: keyboard shortcuts, undo system for destructive actions, and offline/performance hardening with stale price indicators.

</domain>

<decisions>
## Implementation Decisions

### Dashboard Layout
- **D-01:** Command centre grid layout — fixed 2-3 column grid. Portfolio summary spans the top row. Deck launch + activity timeline side-by-side in the middle. Mila insight + price alerts + upcoming releases in a lower row.
- **D-02:** Activity timeline shows all module actions — cards added/removed, decks created/edited, games played, watchlist changes. Unified feed across all modules.
- **D-03:** Deck quick-launch grid shows 6 decks with commander art thumbnails + "View all" link. Two rows of 3.
- **D-04:** Portfolio summary uses inline SVG sparkline (reusing existing sparkline.js) with GBP value and percentage change badge. Compact, consistent with Market Intel.
- **D-05:** Empty dashboard state uses Mila onboarding flow — progressive panel unlock as data arrives. Consistent with existing Mila empty states across other screens.

### Quick Add UX
- **D-06:** Quick Add is an inline search bar in the portfolio summary area. Persistent, always visible on dashboard. Supports quantity prefix (`4x`), set code suffix (`[2XM]`), autocomplete resolution via existing mass-entry resolver.
- **D-07:** After adding a card: toast notification ("Added 4x Lightning Bolt") plus brief inline flash on the Quick Add bar. Card immediately appears in activity timeline.
- **D-08:** Quick Add includes condition dropdown (NM default) and foil checkbox as small toggle buttons next to the input. Matches Add Card Modal fields.

### Keyboard Shortcuts & Undo
- **D-09:** Undo scope: card removes from collection, card removes from decks, and deck deletions only. These are the most destructive common actions.
- **D-10:** Undo UX: toast with undo button and 10-second countdown progress bar. Clicking "Undo" or pressing Ctrl+Z within 10s restores the item. After 10s, toast disappears and deletion is permanent. Gmail-style grace period.
- **D-11:** `?` key opens a keyboard shortcut cheat sheet modal (like GitHub). Lists all shortcuts.
- **D-12:** `/` always focuses the global topbar search bar on every screen, including dashboard. Consistent behavior — Quick Add is separate.
- **D-13:** `Escape` closes modals (already partially implemented in delete-confirm and delete-deck-modal).

### Offline & Performance
- **D-14:** Topbar status chip indicates connectivity state: green "Live" when online and fresh, amber "Prices stale Xh" when data is old, red "Offline" when no connectivity. Positioned next to global search in topbar.
- **D-15:** Prices considered stale after 24 hours — matches Scryfall's daily update cadence.
- **D-16:** Auto-refresh: when online event fires and prices are stale, trigger silent background bulk data refresh. Status chip updates automatically. No user action needed.

### Claude's Discretion
- Implementation details of the undo stack (in-memory vs store-based)
- Exact panel sizing ratios in the command centre grid
- Activity timeline data structure and storage approach
- Keyboard shortcut cheat sheet styling and content organization

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — DASH-01 through DASH-07 (dashboard panels), UX-01 through UX-03 (keyboard/undo/context menu), PERF-02/PERF-04/PERF-05 (offline/performance)

### Prior Phase Context
- `.planning/phases/01-foundation-data-layer/01-CONTEXT.md` — Visual identity, typography, toast system, search autocomplete patterns
- `.planning/phases/02-collection-manager-treasure-cruise/02-CONTEXT.md` — Add card modal, mass-entry resolver, context menu pattern, Chart.js conventions
- `.planning/phases/05-market-intel-game-tracker/05-CONTEXT.md` — Sparkline implementation, price history service, watchlist alerts, game tracker patterns

### Architecture
- `.planning/research/STACK.md` — Technology stack rationale

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/screens/epic-experiment.js` — Empty placeholder, ready to build
- `src/utils/sparkline.js` — SVG sparkline renderer for price trends
- `src/utils/insight-engine.js` — Mila daily insight generation (Phase 4)
- `src/services/currency.js` — EUR-to-GBP conversion
- `src/services/mass-entry.js` — Card resolution with quantity/set/foil parsing
- `src/components/empty-state.js` — Mila-powered empty state renderer
- `src/components/toast.js` — Toast notification system (info/success/warning/error)
- `src/components/context-menu.js` — Right-click context menu via custom DOM events
- `src/components/topbar.js` — Global search bar, integration point for status chip
- `src/stores/collection.js` — Collection data for portfolio summary
- `src/stores/deck.js` — Deck list for quick-launch grid
- `src/stores/market.js` — Price alerts and watchlist data
- `src/stores/game.js` — Game history for activity feed
- `src/stores/intelligence.js` — Intelligence data for Mila insights

### Established Patterns
- Alpine.store() for all state management — each domain has its own store
- Imperative DOM for complex components (centre panel, ritual modal, post-game overlay)
- Chart.js tree-shaken with destroy() cleanup on component unmount
- Custom DOM events for cross-component communication (context menu pattern)
- Module-level singletons for Chart.js cleanup
- Screen modules export `mount(container)` function

### Integration Points
- `src/router.js` — Epic Experiment already routed, needs mount() implementation
- `src/components/topbar.js` — Add status chip for connectivity
- `src/components/sidebar.js` — Dashboard already in nav, no changes needed
- `src/stores/app.js` — May need undo stack state
- `src/app.js` — Global keyboard listener registration point

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Key references:
- Gmail undo-send pattern for the Ctrl+Z toast with countdown
- GitHub `?` key shortcut cheat sheet pattern
- Existing Mila onboarding pattern for progressive empty state unlock

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-dashboard-polish-epic-experiment*
*Context gathered: 2026-04-10*
