# Phase 7: Polish Pass + Perf Baseline + Schema Migration - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Three distinct workstreams delivered together as the entry phase of v1.1 Second Sunrise:

1. **Polish pass** — 11 cross-app quick wins (POLISH-01…POLISH-11) that resolve v1.0 rough edges users reported
2. **Performance baseline** — add web-vitals instrumentation + Lighthouse tooling (PERF-01, PERF-02) and commit an honest v1.0 baseline report with targets (PERF-03)
3. **Schema migration** — Dexie v5→v6 (SCHEMA-01…SCHEMA-03) that front-loads every structural change Phases 9 (turn_laps) and 11 (sync tables) need, executed once under a full safety net

Out of scope: PERF-04 (optimisation) lives in Phase 13, gated on baseline findings. Auth UI lives in Phase 10. Sync engine logic lives in Phase 11. v6 adds the *shape* the sync engine will use; wiring the outbox is Phase 11.

</domain>

<decisions>
## Implementation Decisions

### Schema v6 — primary key strategy
- **D-01:** Migrate all synced tables (`collection`, `decks`, `deck_cards`, `games`, `watchlist`, `profile`) from `++id` autoincrement to text UUID primary keys during the v6 upgrade. Generate with `crypto.randomUUID()`. One-time migration cost buys zero ID-translation work in Phase 11.
- **D-02:** Migration must rewrite all foreign keys atomically — notably `deck_cards.deck_id` must swap from the old numeric id to the new UUID for every existing deck_cards row. Tests must assert FK integrity post-upgrade.
- **D-03:** Never change these PKs again. Per Dexie Cloud guidance in `.planning/research/PITFALLS.md` §1, locking this shape now is a permanent commitment.
- **D-01a:** *(from research — Dexie #1148 confirms PK type cannot change in-place)* Land the UUID migration via **two-version bump (v6 + v7) within Plan 3's single PR**:
  - v6 upgrade creates shadow `*_v6` tables with text PKs, copies every row with fresh UUIDs, rewrites `deck_cards.deck_id` using an in-memory `oldId → newUuid` Map
  - v7 upgrade renames each `*_v6` table back to its clean final name (`collection`, `decks`, `deck_cards`, `games`, `watchlist`, `profile`)
  - Both bumps ship in the same Plan 3 PR; user experiences a single upgrade event. Phases 9/11 inherit clean names, no `_v6` suffix clutter.

### Schema v6 — sync_queue / sync_conflicts shape
- **D-04:** Create both tables in v6 with their **full final shape** even though Phase 11 is what populates them. No second migration needed in Phase 11.
- **D-05:** `sync_queue` shape: `{++id, table_name, op, row_id, payload, user_id, created_at, attempts, last_error}` with indexes on `table_name`, `user_id`, `created_at`.
- **D-06:** `sync_conflicts` shape: `{++id, table_name, row_id, local_version, remote_version, detected_at}` with indexes on `table_name`, `detected_at`.

### Schema v6 — backfill values
- **D-07:** `updated_at` = migration-time `Date.now()` for every existing row on every synced table.
- **D-08:** `synced_at` = `null` on every existing row (Phase 11 reads null as "never synced").
- **D-09:** `turn_laps` = `[]` (empty array) on every existing `games` row. Reads never see `undefined`.

### Schema v6 — additional scope folded into this migration
- **D-10:** Add a new `profile` table now (columns will be defined by Phase 10; shape reserved with UUID PK + `user_id`, `name`, `avatar_url`, `preferences` JSON, `updated_at`). Prevents Phase 10 from forcing a v7 migration.
- **D-11:** Add `updated_at` column to `price_history` even though it's a cache table — user asked for this explicitly; low cost.
- **D-12:** Add a `schema_version` row to the `meta` key/value table recording the last applied Dexie version + migration timestamp. Useful for debug logs and future cloud error reports.

### Migration safety net (SCHEMA-03)
- **D-13:** Pre-migration backup scope = all user-generated tables: `collection`, `decks`, `deck_cards`, `games`, `watchlist`, `price_history`. Excludes `cards`, `meta`, `*_cache` (regeneratable from Scryfall).
- **D-14:** Backup format = single `localStorage` key `counterflux_v5_backup_<ISO-timestamp>` containing a JSON snapshot of each table's full rows. Synchronous writes so it's guaranteed done before Dexie opens v6.
- **D-15:** `onblocked` handler shows a **blocking modal** ("Counterflux is upgrading — please close other Counterflux tabs") until the block releases. App is unusable mid-state to prevent half-upgraded write paths.
- **D-16:** Backup TTL = 7 days. On every boot check `counterflux_v5_backup_*` keys; delete ones older than 7 days. If v6 load throws within the window, app surfaces a "restore backup" option.
- **D-17:** Include migration tests against fixture v5 databases representing every prior schema version (1-5) + realistic user states (empty, 500-card collection, 10 decks with deck_cards rows, active game with turn history). Zero-data-loss assertion is a hard gate. Use the existing `fake-indexeddb` 6.2.5 setup in `tests/setup.js` — extend the pattern in `tests/schema.test.js`.
- **D-17a:** *(from research)* Migration progress UX — emit progress events from the upgrade callback every 10% of row count across all tables; splash-screen subscribes and renders "Migrating your archive — 43%" so large-collection users (5000+ cards) don't force-reload a seemingly-frozen app.
- **D-17b:** *(from research)* After writing the localStorage backup, **read it back and `JSON.parse` it** to validate round-trip integrity (~20ms cost). If the read-back fails or parses to a different row count than written, abort the migration with a user-visible error instead of proceeding on a corrupt safety net.

### Performance baseline (PERF-01…PERF-03)
- **D-18:** Baseline report sets **absolute number targets** for TTI / LCP, committed as hard numbers (e.g. "LCP < 2.5s, TTI < 3.5s") derived from the median of 3 cold-boot runs. Aligns with Web Vitals "Good" thresholds by default.
- **D-19:** `npm run perf` = single Lighthouse desktop-preset run against `vite preview`, HTML output in `./lighthouse-report/`. No CI gate in v1.1.
- **D-20:** CI-gating is deferred — Phase 13 decides whether to add `@lhci/cli` assertions based on baseline findings. v1.1 PRs merge on functional review only.
- **D-21:** `web-vitals` 5.2.x logs LCP / INP / CLS / FCP / TTFB via `console.table` on every page navigation in dev mode. No UI overlay (keeps Phase 7 scope tight).
- **D-22:** Baseline captured **before** the schema migration ships — the report represents true v1.0 numbers so Phase 13 has a clean reference point.
- **D-22a:** *(from research)* Plan 2 produces **two artefacts**: (a) committed `.planning/phases/07-.../PERF-BASELINE.md` with median-of-3 manual runs for the official baseline numbers (stable, cites target), (b) reproducible `npm run perf` tooling for fast dev runs. D-18 and D-19 serve different purposes — the baseline needs stable numbers (median of 3), the dev tool needs fast feedback (single run).

### Delivery sequencing
- **D-23:** Ship order within Phase 7: **Polish → Perf → Schema**. Low-risk polish items warm up; perf tooling lands before migration so measurements can attribute any regression; schema migration ships last with the full safety net in place.
- **D-24:** Phase 7 ships as **three sub-plans**, one PR each:
  - Plan 1 — Polish batch (POLISH-01…POLISH-11)
  - Plan 2 — Perf tooling + baseline report (PERF-01, PERF-02, PERF-03)
  - Plan 3 — Schema v6 + migration + backup safety net + migration tests (SCHEMA-01, SCHEMA-02, SCHEMA-03)
- **D-25:** Plan 3 is the merge blocker for Phases 9 and 11 — its completion is the gate to kicking off those discuss-phase cycles.

### POLISH-08 — LIVE connectivity chip
- **D-26:** Keep the chip; add a 6px pulsing dot animating at ~1.5s interval. Colour stays success-green to avoid burning the red-accent budget on a non-warning signal. File: `src/utils/connectivity.js` + `src/components/topbar.js`.

### POLISH-09 — sidebar collapse
- **D-27:** Collapsed state = **64px icon rail** (nav icons only, label tooltip on hover). Not a fully-hidden 0px drawer — users should never lose navigation with one click.
- **D-28:** Persist toggle in `localStorage` key `sidebar_collapsed` (boolean). Default for first-time users = expanded.
- **D-29:** Toggle button lives in the sidebar header (existing pattern). Keyboard shortcut binding is Claude's discretion during planning.

### POLISH-02 — red accent coverage uplift (5% → 15%)
Red (`#E23838`) rolls out across **all four** surface categories:
- **D-30:** Card detail hover & focus — red glow/border on card tile hover and card-detail flyout active state (high surface area, immediate perceived uplift).
- **D-31:** Destructive CTAs and confirmations — "Abandon storm", "Delete deck", "Clear collection" primary action. Semantic red = danger, makes existing inconsistent treatment uniform.
- **D-32:** RAG red states across dashboards — Vandalblast life ≤10 (aligns with GAME-03), gap warnings red severity (aligns with DECK-03), price-drop markers.
- **D-33:** Active tab underline + notification bell unread ping — small but constantly-visible surfaces that keep red in peripheral vision.

### Claude's Discretion
- Exact animation timing / easing for the LIVE pulse
- Sidebar collapse keyboard shortcut binding (or none)
- Lighthouse report directory naming beyond `./lighthouse-report/`
- Console-table formatting specifics for web-vitals
- Exact shade ramp for red (`#E23838` base + hover/active variants)
- Migration progress indicator UX during the upgrade (spinner, toast, etc.)
- Post-migration verification assertions beyond row-count and FK integrity
- Backup restore UX if v6 load fails (button placement, wording)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — POLISH-01…POLISH-11, PERF-01…PERF-03, SCHEMA-01…SCHEMA-03 full acceptance criteria
- `.planning/ROADMAP.md` §Phase 7 — goal, depends-on, success criteria (5 items)
- `.planning/PROJECT.md` — v1.1 scope decisions (2026-04-14), v1.1 key context
- `.planning/STATE.md` §Accumulated Context — v1.1 scope + roadmap decisions (incl. "Schema v5→v6 front-loaded into Phase 7")

### Research (v1.1 Second Sunrise)
- `.planning/research/STACK.md` §1 — `@supabase/supabase-js` 2.103.x integration (relevant for profile table shape)
- `.planning/research/STACK.md` §Sync engine — why UUID PKs on synced tables
- `.planning/research/STACK.md` §Performance — `web-vitals` 5.2.x + `@lhci/cli` 0.15.x library choices
- `.planning/research/PITFALLS.md` §1 — Dexie v5→v6 migration pitfalls (must-read for Plan 3; includes `onblocked`, upgrade callback, PK lock guidance)
- `.planning/research/PITFALLS.md` §2 — Supabase RLS misconfiguration (context for profile table shape decisions)
- `.planning/research/FEATURES.md` — v1.1 feature catalogue for cross-reference
- `.planning/research/ARCHITECTURE.md` — high-level architecture for the new layers
- `.planning/research/SUMMARY.md` — synthesis of the four research docs

### Existing code references (v1.0)
- `src/db/schema.js` — current Dexie schema v1-v5; v6 is appended, never replaces prior versions
- `src/workers/bulk-data.worker.js` — mirror schema used by the worker; must be kept in sync with v6
- `src/utils/connectivity.js` — home of the LIVE chip state machine (POLISH-08)
- `src/components/sidebar.js` — target for collapse toggle (POLISH-09)
- `src/components/topbar.js` — hosts connectivity chip + notification bell (POLISH-08, POLISH-02 D-33)
- `src/components/splash-screen.js` — loading quotes target (POLISH-01)
- `src/components/toast.js` — icon opacity fix (POLISH-05) and add-to-wishlist wording (POLISH-11)
- `src/components/ritual-modal.js` — "Brew a new storm" rename (POLISH-06)
- `src/components/counter-panel.js:100` — `more_horiz` → `+` icon swap (POLISH-07)
- `src/components/movers-panel.js` — top losers scryfall_id leak fix (POLISH-10)
- `src/components/add-card-modal.js` — add-to-collection / wishlist paths (POLISH-11)
- `assets/niv-mila.png` — favicon source (POLISH-03; currently untracked)
- `index.html` — favicon `<link>` tag target (POLISH-03)

### Milestone reference
- `.planning/milestones/v1.0-ROADMAP.md` — prior milestone for style / pattern reference
- `.planning/milestones/v1.0-phases/` — completed phase directories for executor pattern reference

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Dexie schema chain (`src/db/schema.js`)** — clean pattern of appended `db.version(N).stores({...})` calls through v1-v5. v6 extends the chain with an `.upgrade(tx => ...)` callback; no prior version declarations are touched.
- **Bulk data worker schema (`src/workers/bulk-data.worker.js`)** — currently declares its own v1-v5 mirror of the cards/meta tables. v6 must bump the worker's declaration too, scoped to what the worker touches.
- **`meta` key/value table** — already used for `bulk-data` metadata (`getBulkMeta`/`setBulkMeta`). Good fit for `schema_version` row (D-12).
- **Toast system (`src/components/toast.js`)** — reused for migration-blocked + backup-restore surfacing.
- **`src/utils/connectivity.js`** — returns `{ state: 'live', label: 'LIVE', color: 'success' }`; LIVE pulse dot (D-26) extends this return shape and the topbar consumer.
- **No existing Lighthouse config** — Plan 2 is greenfield tooling; no integration with prior CI.

### Established Patterns
- **Dexie .upgrade pattern** — per PITFALLS §1, always keep all prior `version()` declarations and always provide an explicit `.upgrade()` callback even for additive fields.
- **localStorage for small persistence** — already used for user preferences (connectivity offline state, intelligence cache TTLs). Fits backup pattern (D-14) and sidebar toggle (D-28).
- **`src/services/` service pattern** — each domain concern lives as its own module. Plan 3 likely adds `src/services/migration.js` for the backup + upgrade orchestration.
- **Alpine store pattern** — each domain has its own `Alpine.store()`. No new stores needed in Phase 7.

### Integration Points
- **`src/main.js`** — app entry; must run pre-migration backup + open Dexie v6 before any store init. Gates splash-screen dismissal.
- **`src/components/topbar.js`** — receives pulsing-dot state from connectivity (D-26) and red-unread state from notifications (D-33).
- **`index.html`** — favicon link (POLISH-03), future web-vitals bootstrap.
- **`vite.config.js`** — may need `preview` block tuned for Lighthouse runs (port / open).
- **`package.json` scripts** — adds `perf` (Lighthouse) script; web-vitals imported in `src/main.js` dev path.

</code_context>

<specifics>
## Specific Ideas

- **UUID PK migration is "one-time pain, permanent payoff"** — user wants the hard part done now so Phase 11 sync engine has no ID-translation layer. Accept the migration complexity in exchange for cleaner sync.
- **"Sensible defaults" over preserving per-row history** for backfill — predictable is worth more than faithful.
- **Backup in localStorage, keep for 7 days** — balances quota cost against late-surfacing bug recovery.
- **Absolute target numbers, not budgets or percentile rules** — user wants a line that either passes or fails, not an argument about "how much is a fair budget".
- **Three sub-plans, ship polish first** — matches v1.0 multi-plan phase pattern; polish warms up low-risk.
- **LIVE chip stays, gets a pulsing dot** — user wants presence preserved; the pulse justifies the chip's existence.
- **Sidebar collapses to icon rail, not full hide** — VS Code / Linear pattern; one-click navigation preserved.
- **Red everywhere it's semantically correct** — all four proposed surfaces (hover, destructive, RAG, active tab) absorb red to hit the 15% target in one pass.

</specifics>

<deferred>
## Deferred Ideas

- **`@lhci/cli` CI gate** — deferred to Phase 13 once baseline has informed whether hard-fail assertions make sense (D-20).
- **Perf overlay HUD (live web-vitals panel)** — considered for PERF-01 but trimmed from scope; console.table is the MVP.
- **Multi-URL cold/warm Lighthouse runs** — overkill for v1.1 baseline; revisit in Phase 13 if needed.
- **Sidebar collapse keyboard shortcut binding** — left to Claude discretion during planning; not a gray area the user wanted to lock.
- **Downloadable backup file UX** — localStorage-only covers the typical case; file-download path only wired if localStorage quota is exceeded.
- **Mila loading animation (MILA-03)** — acknowledged as accepted v1.0 tech debt in PROJECT.md; not in Phase 7.
- **RSS / news feed** — scoped out of v1.1 generally; still deferred.

</deferred>

---

*Phase: 07-polish-pass-perf-baseline-schema-migration*
*Context gathered: 2026-04-14*
