# Phase 09: Deck Accuracy + Vandalblast Pod Experience — Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers two distinct surfaces under one banner:

**Surface A — Thousand-Year Storm deck-builder accuracy (DECK-01..05):** mana curve + colour distribution validated against hand-calculated reference fixtures, salt gauge wired to a real data source, gap warning redesigned with RAG severity badges, Commander rendered as its own type category, deck-editor back button confirmed.

**Surface B — Vandalblast pod-play experience (GAME-01..10):** 2-col player-name clipping fix, dynamic 3-player layout, RAG life colours, counter expansion icons, fullscreen-toggle state preservation, in-card counter editing, first-player coin-flip animation, active-player highlight, persisted per-turn `turn_laps` + post-game pacing stats, wall-clock turn-timer anchor.

**Phase shape:** ONE phase, 3 plans (per user decision):
- Plan 1 — Deck accuracy + analytics polish (DECK-01..05)
- Plan 2 — Vandalblast layout + visuals (GAME-01..06)
- Plan 3 — Vandalblast turn mechanics + post-game stats (GAME-07..10)

**Out of scope for Phase 9:**
- Anything beyond the 15 listed requirement IDs
- Mobile-responsive Vandalblast — separate concern (only Vandalblast already targets mobile per CLAUDE.md, so polish stays desktop-first)
- New deck-analytics metrics beyond DECK-02..05 (e.g. Pareto curve, synergy heatmap, deck archetype tagging) — defer to a future deck-builder polish phase

</domain>

<decisions>
## Implementation Decisions

### Phase shape

- **D-00:** ONE fat phase with 3 plans (DECK accuracy / Vandalblast layout / Vandalblast mechanics). User explicitly chose this over splitting into 9a + 9b. Single ROADMAP entry, single VERIFICATION.md, single HUMAN-UAT walk covering all 15 requirements at the end.

### Deck accuracy + analytics (DECK-01..05)

- **D-01: DECK-02 reference deck strategy.** Researcher selects 3 decks during the research phase to exercise the analytics code well: (a) a mono-colour aggro (e.g. mono-red Krenko or similar) for 1-colour edge case, (b) a 2-colour midrange deck, (c) a 5-colour goodstuff (e.g. The Ur-Dragon) for full-colour distribution. Researcher fetches sample decklists from EDHREC (or curates manually if EDHREC fixtures unavailable), hand-calculates expected mana-curve buckets (CMC 0/1/2/3/4/5/6/7+) + colour-distribution percentages, locks both in CONTEXT.md amendments AND `tests/fixtures/decks/` JSON pairs (`{name}.cards.json` + `{name}.expected.json`).

- **D-02: DECK-02 fixture format.** `tests/fixtures/decks/{slug}.cards.json` is an array of card objects matching the Dexie `cards` table shape (raw Scryfall projection — see `bulk-data-pipeline.js`). `tests/fixtures/decks/{slug}.expected.json` contains `{ mana_curve: { '0': N, '1': N, ... '7+': N }, colour_distribution: { W: 0.x, U: 0.x, ... C: 0.x }, total_cards: 100, commander_id: '...' }`. Tests in `tests/intelligence.test.js` (or `tests/deck-analytics.test.js`) load each fixture, feed cards into `src/services/intelligence.js` analytics functions, assert calculated values match expected within 0.01 tolerance for percentages and exact match for integer counts.

- **D-03: DECK-03 RAG thresholds — per-category dynamic.** Different gap-warning thresholds per category, derived from EDHREC averages during research. Researcher must produce a `THRESHOLDS.md` (or inline in CONTEXT.md amendments) listing red/amber/green cut-offs for each tracked category (ramp, removal, draw, lands, creatures, etc.). Defaults SHOULD reflect EDH community benchmarks (e.g. ramp red >5 missing, creatures red >15 missing). Locked thresholds become test fixtures.

- **D-04: DECK-03 badge UI.** Badge format: `[RED|AMBER|GREEN] +N` where N is the suggested count of cards to add. NO redundant category name (current bug). Badge sits to the right of the category label in the deck-analytics-panel. Colours: RED = `#E23838` (existing brand red), AMBER = `#F59E0B` (existing brand warning), GREEN = `#22C55E` (existing brand success). Background fill at 20% opacity; text at full saturation.

- **D-05: DECK-04 salt-score data source — EDHREC API live.** Wired through existing `src/services/edhrec.js` service (already proxied via Vite dev proxy due to CORS). Same architecture as the existing recommendations call. Cache strategy: per-card salt score cached in IndexedDB (suggest reusing `precons_cache` pattern from Phase 8 — write to a `salt_cache` table or extend existing intelligence cache). 7-day TTL aligns with precon cache convention. **Known risk:** production CORS proxy still TBD per STATE.md blockers — this is a v1.1 carry-over concern, not a Phase 9 blocker but worth surfacing in the final SUMMARY so it doesn't get lost.

- **D-06: DECK-04 salt rendering.** Existing `salt-gauge.js` component already renders the gauge — bug is in the data wiring (zero-score regardless of cards). Fix is in `intelligence.js` (calculation path), not in the gauge component. Gauge visual treatment unchanged.

- **D-07: DECK-05 commander as own type category.** Render Commander as a separate section in the deck centre panel above the existing type categories (Creature, Instant, Sorcery, etc.). Use `commander_id` from the deck record (Phase 7 schema field) to identify the commander card; pull from the deck's card list. Section header: "COMMANDER" in JetBrains Mono uppercase 11px primary blue. Card grouping logic in `src/components/deck-centre-panel.js`.

- **D-08: DECK-01 back button QA.** Verify existing implementation at `components/deck-editor.js:27-37` (per REQUIREMENTS.md) actually returns user to deck list. If working, mark verified and move on. If broken, fix. Likely a 5-min sanity check, not a real implementation task — but include as Plan 1 Task to ensure verification is logged.

### Vandalblast layout + visuals (GAME-01..06)

- **D-09: GAME-01 player-name clipping fix.** Padding/overflow audit on `src/components/player-card.js`. Likely fix: `text-overflow: ellipsis` on the name span + adequate `padding-bottom` on the card. Test: render player with name "Alexander the Great Lifelinker" in 2-col grid, assert no clipping via `getBoundingClientRect`.

- **D-10: GAME-02 3-player layout — T-shape.** One player gets a wide hero card across the top (full container width), the other two split the bottom row 50/50. Layout via CSS grid: `grid-template-areas: "p1 p1" "p2 p3"; grid-template-rows: 1fr 1fr;`. Top player slot is determined by turn order (active player promoted to top? or player 1 always top? — researcher to decide; default is **active player rotates to top slot** to keep focus on whose turn it is). 2-player and 4-player layouts unchanged.

- **D-11: GAME-03 life RAG colours — roadmap-locked.** Green > 20, amber ≤ 20, red ≤ 10. Colour values match GAME-04 brand tokens (green `#22C55E`, amber `#F59E0B`, red `#E23838`). Apply to the life-total digit display in `player-card.js` (via dynamic class binding). Match the existing poison lethal-highlight treatment for visual consistency.

- **D-12: GAME-04 counter icons — Material Symbols (existing).** Already loaded via the icon font. Mappings:
  - Poison → `science` (or `biotech` — researcher picks based on visual fit; do not use `skull` — too dark/morbid for the game UI)
  - Tax → `paid`
  - Commander damage → `shield_with_heart` (or `military_tech` — researcher picks)
  Icons render at 16px alongside the existing count digit in the expansion widgets. Icon colour matches text colour (var(--color-text-secondary) when inactive, var(--color-text-primary) when count > 0).

- **D-13: GAME-05 fullscreen toggle state preservation.** Bug: existing fullscreen toggle on the floating toolbar loses game state on enter/exit. Fix: ensure the fullscreen API targets the `<main>` element (or a stable game-screen container), NOT the body — body fullscreen forces re-mount of Alpine components, hence state loss. Test: enter fullscreen mid-game (life adjusted, counters set), exit fullscreen, assert all state survives via `$store.game` integrity check.

- **D-14: GAME-06 in-card counter editing.** Currently counters are editable only via the global counter panel. Add inline +/- buttons (or a click-to-cycle pattern) to each counter widget within the expanded player-card section. Reuse the existing counter-mutation logic from `counter-panel.js`. Touch target ≥32px for desktop; respects existing keyboard-shortcut bindings (do not conflict with shift+arrow life adjustments).

### Vandalblast turn mechanics + post-game stats (GAME-07..10)

- **D-15: GAME-07 first-player coin-flip — slot-machine spinner.** Player names cycle vertically in a column at screen centre on game start, decelerating before landing on the chosen player. Names render in JetBrains Mono primary blue. Total animation ~2-3s (researcher locks exact duration based on perceived feel — use `prefers-reduced-motion` to skip animation entirely and reveal result instantly). Implementation: vanilla CSS `@keyframes` translateY + JS `requestAnimationFrame` for deceleration easing. Result persists to game record as `first_player: <player_id>` (existing field if present, or add to game schema if not — additive only, no migration needed since games table already accepts new fields).

- **D-16: GAME-08 active-player highlight.** Active player card gets a 2px primary-blue border (`#0D52BD`) + glow-blue box-shadow (`0 0 12px rgba(13, 82, 189, 0.6)` — matching the `cf-panel-reopen` treatment from Phase 8.1 `main.css`). Inactive players stay default surface treatment. Border + shadow transition on a 200ms ease-out when NEXT TURN advances. Honours `prefers-reduced-motion: reduce` (instant transition, no animation). Add the new selector to the existing merged `@media (prefers-reduced-motion)` block per Phase 8.1 coordination pattern.

- **D-17: GAME-09 turn-lap persistence.** Schema field `turn_laps: number[]` already exists (Phase 7 v6 migration). Implementation pushes `turn_lap_ms` (integer, milliseconds since previous turn-start) onto the array each time NEXT TURN is pressed. Persisted via `db.games.update(gameId, { turn_laps: [...] })` after each push (frequent writes acceptable; `games` table is small). At post-game, computed metrics: `longestTurn = Math.max(...laps)`, `avgTurn = laps.reduce(...) / laps.length`, `perPlayerAvg = group laps by player index modulo player_count, average each group`. Stats render in post-game-overlay.js per D-19.

- **D-18: GAME-10 wall-clock anchor — `Date.now()` snapshot pattern.** Turn timer uses `turnStartedAt = Date.now()` snapshot at NEXT TURN; lap calculation is `Date.now() - turnStartedAt`. NOT `setInterval` accumulation (vulnerable to background-tab throttling). Display tick uses `requestAnimationFrame` for smoothness but the underlying duration is always wall-clock-derived. `performance.now()` is an acceptable alternative if wall-clock drift becomes a concern, but `Date.now()` is sufficient for second-precision lap timing.

- **D-19: GAME-09 stats display — Turn Pacing section in post-game-overlay.** New section in `src/components/post-game-overlay.js` rendered below the existing winner banner. Three stat tiles in a horizontal row:
  - LONGEST TURN — value `mm:ss` + small label "PLAYER NAME" underneath
  - AVG TURN — value `mm:ss`
  - PER-PLAYER AVG — compact list of `Player Name: mm:ss` per player, sorted slowest first
  Stat values render in JetBrains Mono primary blue 32px; labels in Space Grotesk 11px uppercase secondary text. Tile spacing follows existing 8-point grid (16px gap, 24px section padding). Section header: "TURN PACING" in the same style as existing winner section.

### Claude's Discretion

- Specific Material Symbols glyph for poison vs commander damage (`science` vs `biotech`, `shield_with_heart` vs `military_tech`) — researcher picks based on visual rendering test in dev server.
- Exact slot-machine spinner timing curve (cubic-bezier vs linear, total duration 2.0s vs 2.5s vs 3.0s) — researcher picks based on perceived feel.
- Salt-score cache table name + schema (extend an existing table vs new table) — planner decides based on what's cleanest given Phase 8's `precons_cache` pattern. Prefer additive Dexie bump (v10) if a new table is needed; reuse pattern from Phase 8.
- Whether the active player auto-rotates to the top slot in 3-player layout (D-10) or stays player-1-always — researcher picks; default is auto-rotate.
- Test infrastructure for game-tracker (vitest setup specifics for Alpine + DOM mocking) — planner inherits Phase 8.1's `tests/setup.js` MutationObserver/CustomEvent stubs; extend if game-tracker needs more browser-API stubs (e.g. `requestAnimationFrame`, `Date.now` mocking via `vi.useFakeTimers()`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap + requirements
- `.planning/ROADMAP.md` §Phase 9 — phase goal + 4 success criteria + dependency note
- `.planning/REQUIREMENTS.md` lines 49-72 — DECK-01..05 + GAME-01..10 acceptance criteria

### Project context
- `.planning/PROJECT.md` — Core value, constraints (Scryfall API compliance, desktop-first, performance budgets)
- `.planning/STATE.md` — Phase 7-8.1 decision log; especially:
  - Phase 7 schema v6 brought `turn_laps` field online
  - Phase 8.1 cf-panel-reopen utility (D-16 mirrors this border-glow treatment)
  - Phase 8.1 cross-plan `@media (prefers-reduced-motion)` coordination pattern (D-16 follows it)
- `./CLAUDE.md` — Brand colours (`#0D52BD` primary, `#E23838` red, `#22C55E` success, `#F59E0B` warning), typography scale (Syne 48 / Space Grotesk 20+14 / JetBrains Mono 11), 8-point spacing, Tailwind v4 notes

### Existing UI design contracts
- `.planning/phases/08-treasure-cruise-rapid-entry/08-UI-SPEC.md` — Anatomy patterns + token usage that Phase 9 polish must honour for consistency
- `.planning/phases/08.1-treasure-cruise-polish-precon-coverage/` — Phase 8.1 patterns Phase 9 inherits (border-glow + label affordance for D-16)

### Existing source files (pre-read for diff scoping)
- `src/components/deck-editor.js` — DECK-01 back button QA
- `src/components/deck-centre-panel.js` — DECK-05 commander section
- `src/components/deck-analytics-panel.js` — DECK-03 gap warning UI
- `src/components/salt-gauge.js` — DECK-04 visual untouched, data wiring fixed in intelligence.js
- `src/services/intelligence.js` — DECK-02 mana curve / colour distribution math + DECK-04 salt calc (currently buggy)
- `src/services/edhrec.js` — existing EDHREC service for D-05 salt API wiring
- `src/screens/vandalblast.js` — game-screen layout (3-player layout in D-10, fullscreen target in D-13)
- `src/components/player-card.js` — GAME-01..04 + GAME-06 + D-16 active-player highlight
- `src/components/life-adjuster.js` — GAME-03 RAG colour application
- `src/components/counter-panel.js` — GAME-06 reuse of mutation logic
- `src/components/turn-timer.js` — GAME-10 wall-clock anchor refactor
- `src/components/post-game-overlay.js` — GAME-09 Turn Pacing section
- `src/components/game-setup.js` — GAME-07 coin-flip integration point
- `src/stores/game.js` — GAME-09 turn_laps push + GAME-07 first_player persist
- `src/db/schema.js` — verify games table accepts `first_player` field; if not, additive bump (v10) in scope of Plan 3

### Test infrastructure
- `tests/setup.js` — Phase 8.1 MutationObserver + CustomEvent stubs; may need RAF + fake timers extension for Plan 3
- Existing tests: `tests/router.test.js > vandalblast` is the pre-existing failure documented in `.planning/phases/08-treasure-cruise-rapid-entry/deferred-items.md` — Plan 2 may incidentally fix this when game-tracker DOM is touched; if not, Plan 3 explicitly investigates as it's now a Phase 9 surface

### External docs
- EDHREC salt API endpoint format (researcher must document during research)
- Material Symbols icon set: `https://fonts.google.com/icons` for icon name lookup (poison, tax, commander damage)
- MDN: `Element.requestFullscreen()` quirks (D-13)

</canonical_refs>

<specifics>
## Specific Ideas

- **Stats tile layout:** "PLAYER NAME" subtitle below LONGEST TURN value should truncate with ellipsis if >12 chars. Player names like "Alexander the Great Lifelinker" must not break the layout in either the player-card (D-09) or the post-game stats tile.
- **Slot-machine spinner accessibility:** the JetBrains Mono spinning column SHOULD include `aria-live="polite"` so screen readers announce the chosen player after the animation settles. `prefers-reduced-motion` skips animation entirely and announces result immediately.
- **Active player highlight (D-16) cross-plan note:** the new selector for the active player highlight MUST extend Phase 8.1's existing `@media (prefers-reduced-motion: reduce)` block in `main.css` rather than appending a second block. Coordinate with Plan 3's CSS additions per the Phase 8.1 NOTE 2 pattern.
- **Salt cache schema (D-05):** if a new Dexie table is needed, follow Phase 8 D-09 precedent: additive `.version(N)` bump only, no `.upgrade()` callback, mirror declaration in `src/workers/bulk-data.worker.js`. Suggest table name `salt_cache` with fields `{ scryfall_id (PK), salt_score, fetched_at }`. PK is string scryfall_id — exclude from `UUID_TABLES` creating-hook (Phase 8 D-09 precedent).
- **3-player active-rotation toggle:** if research shows that auto-rotating the top slot in 3-player layout (D-10) is disorienting, fall back to player-1-always-top with the active player highlighted via D-16's border-glow only. Researcher should test both in dev server before locking.

</specifics>

<deferred>
## Deferred Ideas

(Surfaced during discussion, not in Phase 9 scope.)

- Mobile-responsive Vandalblast polish — Vandalblast is already designated mobile-friendly per CLAUDE.md, but new GAME-* polish only validated against desktop. Mobile audit is a future phase.
- Pareto curve, synergy heatmap, deck archetype tagging in deck-analytics-panel — out of scope for Phase 9; net-new analytics rather than fixing existing.
- 2-player dramatic coin-flip (e.g. dueling-banner intro) — Phase 9 ships generic slot-machine for all player counts; bespoke 2-player presentation could be a future polish item.
- Production CORS proxy for EDHREC — carry-over from v1.0 noted in STATE.md blockers; affects D-05 in production but does not block Phase 9 dev/test work.

</deferred>

---

*Phase: 09-deck-accuracy-vandalblast-pod-experience*
*Context gathered: 2026-04-16 via /gsd:discuss-phase*
