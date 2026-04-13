# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — The Aetheric Archive

**Shipped:** 2026-04-13
**Phases:** 6 | **Plans:** 31 | **Timeline:** 8 days (2026-04-03 to 2026-04-11)

### What Was Built
- Complete MTG command centre with 6 interconnected modules (Dashboard, Collection, Deck Builder, Intelligence, Market, Game Tracker)
- Local-first architecture: Scryfall bulk data pipeline (Web Worker stream-parsing), Dexie.js IndexedDB persistence through 5 schema versions
- Intelligence layer integrating EDHREC synergies, Commander Spellbook combos, salt scoring, and category gap detection
- Full game lifecycle tracking with life/damage/counters, dice/coin tools, post-game charts, and game history stats
- Keyboard shortcuts, undo system with 10s deferred commit, connectivity status chip

### What Worked
- **Parallel worktree execution**: Plans ran in isolated git worktrees, enabling concurrent development without conflicts
- **Alpine.js + Dexie.js stack choice**: Lightweight reactivity with IndexedDB abstraction delivered fast iteration — 104 source files in 8 days
- **Phase ordering**: Foundation → Collection → Deck → Intelligence → Market/Game → Dashboard gave each phase stable dependencies to build on
- **Scryfall bulk data strategy**: Stream-parsing in Web Worker avoided main thread blocking; daily refresh with 24h TTL worked reliably
- **Atomic plan commits**: Each plan task committed separately, making rollback easy and git history clear

### What Was Inefficient
- **Worktree merge artifacts**: Plan 02-02 SUMMARY.md was lost during worktree merge — need better merge verification
- **Traceability table drift**: REQUIREMENTS.md traceability wasn't updated during execution — 7 of 90 requirements showed as "Pending" when actually complete
- **EDHREC CORS workaround**: Vite dev proxy works but isn't a production solution — deferred as tech debt
- **Post-plan bugfix volume**: 15+ commits after formal plan execution ended — suggests verification checkpoints (Task 3 in plans) need tighter integration

### Patterns Established
- Screen module pattern: each screen exports `mount(container)` function for lazy loading
- Alpine stores as domain layer: one store per domain (collection, deck, game, search, market, intelligence)
- Context menu via custom DOM events for decoupled cross-component communication
- Optimistic UI removal with deferred DB commit for undo support
- Activity logging on successful mutations, not before
- Chart.js instance cleanup: `destroy()` on panel close to prevent memory leaks
- PapaParse unparse needs explicit `fields` array for empty data
- Format auto-detection regex cascade: Moxfield > Archidekt > Arena > plaintext

### Key Lessons
1. **Web Worker stream parsing is essential for large JSON** — 300MB Scryfall bulk data would crash the tab with `JSON.parse`. This pattern will recur for any large dataset.
2. **Alpine.js reactivity is good enough for complex UIs** — the three-panel deck editor with live analytics, drag-and-drop, and context menus all work within Alpine's model. No need for React/Vue.
3. **Vite dev proxy hides production CORS issues** — EDHREC and Spellbook APIs work in dev but will need a proxy in production. Flag API CORS requirements earlier.
4. **Verification checkpoints should be integrated, not separate** — human-verify tasks at plan end tend to get deferred. Build verification into automated tasks instead.
5. **GBP currency conversion should happen at the data layer** — converting EUR→GBP at display time led to inconsistencies. Phase 3 fix (converting at storage time) was the right pattern.

### Cost Observations
- Model mix: primarily opus for plan execution, sonnet for research/planning
- Sessions: ~15-20 across 8 days
- Notable: parallel worktree execution saved significant wall-clock time on independent plans

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Timeline | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 8 days | 6 | Initial build — established all patterns |

### Cumulative Quality

| Milestone | Tests | Source Files | LOC |
|-----------|-------|-------------|-----|
| v1.0 | 45 files | 104 files | 15,367 |

### Top Lessons (Verified Across Milestones)

1. Lightweight stack (Alpine.js + Dexie.js) scales to complex UIs without framework overhead
2. Local-first architecture with bulk data caching delivers excellent offline experience
