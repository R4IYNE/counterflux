---
phase: 08-treasure-cruise-rapid-entry
plan: 03
subsystem: data + ui
tags: [dexie, scryfall, alpine, keyrune, precons, undo, batch-add, vitest]

requires:
  - phase: 07-polish-pass-perf-baseline-schema-migration
    provides: Dexie v8 clean-named UUID-PK tables, UUID_TABLES creating-hook pattern, fake-indexeddb Vitest harness, schema_version meta row
  - phase: 08-treasure-cruise-rapid-entry
    provides: "Plan 2 — scryfall-queue.js, LHS add-card-panel with BROWSE PRECONS disabled placeholder, card-tile-hover utility class"
provides:
  - Dexie v9 additive schema — precons_cache table (string PK on code, indexes on set_type/released_at/updated_at); mirrored in the bulk-data worker per PITFALLS §1
  - src/services/precons.js — fetchPrecons + fetchPreconDecklist + invalidatePreconsCache with 7-day TTL, stale-cache fallback on fetch error, type-line is_commander heuristic, all routed through queueScryfallRequest
  - collection store additions — preconBrowserOpen + selectedPreconCode + precons[] + loadPrecons + selectPrecon + addAllFromPrecon + closePreconBrowser + refreshPrecons
  - src/components/precon-browser.js — full-screen drawer (backdrop + 90vw/90vh panel + tile grid + decklist preview) mirroring csv-import-modal mount pattern
  - Batch-add-with-undo path — Dexie transaction + single loadEntries (Pitfall 2) + single collection_add_batch undo entry whose inverse bulkDeletes new rows + restores prevQuantity on bumped rows (Pitfall 7)
  - ss-fallback CSS rule — defence-in-depth '?' glyph for missing keyrune set codes (Pitfall 4)
  - 3 new Wave 0 test files (16 test cases) + 1 shared Scryfall precon fixture
affects:
  - Phase 09 (Thousand-Year Storm) — consumes the UUID-PK collection table through the same batch-with-undo pattern; can reuse fetchPrecons/fetchPreconDecklist for deck-import-from-precon flows
  - Phase 10 (auth) — precons_cache rows are not user-scoped; they remain shared cache across all accounts (no sync table; no user_id column)
  - Phase 11 (sync) — precons_cache is intentionally excluded from the sync pipeline — it's a read-through cache of public Scryfall data

tech-stack:
  added: []
  patterns:
    - "Additive Dexie version bump — new table declared in v9 with all prior v8 tables re-declared verbatim (PITFALLS §1); no .upgrade callback (D-24 additive-only migration)"
    - "String-PK Dexie table — precons_cache PK is the Scryfall set code, NOT a UUID; table is deliberately EXCLUDED from the UUID_TABLES creating-hook array so callers must supply `code`"
    - "Batch add with single undo — Dexie transaction wraps the whole write, then one loadEntries() and one undo entry with structured { added[], updated[{id,prevQuantity}] } payload (Pitfall 2 + 7)"
    - "Stale-cache fallback — service returns Dexie-cached rows when Scryfall fetch errors, re-throws only if nothing cached"
    - "Lazy name hydration — decklist row uses window.__cf_getPreconCardName lookup with in-memory Map; x-effect hydrates from db.cards on drill-in"
    - "Type-line is_commander heuristic — inference from 'Legendary' + ('Creature' | 'Planeswalker') strings per Pitfall 5 (accepts false positives; visual hint only)"

key-files:
  created:
    - src/services/precons.js
    - src/components/precon-browser.js
    - tests/fixtures/scryfall-precons.js
    - tests/schema-v9.test.js
    - tests/precons.test.js
    - tests/collection.precon.test.js
    - .planning/phases/08-treasure-cruise-rapid-entry/08-03-SPIKE-NOTES.md
  modified:
    - src/db/schema.js                        # appended v9 declaration (additive, no .upgrade callback)
    - src/workers/bulk-data.worker.js         # mirror v9 declaration (schema-match per PITFALLS §1)
    - src/stores/collection.js                # new state fields + loadPrecons/selectPrecon/addAllFromPrecon/closePreconBrowser/refreshPrecons
    - src/components/add-card-panel.js        # BROWSE PRECONS button un-disabled; click opens browser + loadPrecons()
    - src/screens/treasure-cruise.js          # renderPreconBrowser imported + appended to #tc-modals container
    - src/styles/main.css                     # .ss.ss-fallback::before content '?' rule
    - tests/schema.test.js                    # db.verno assertion loosened to >=8 (was ==8) — survives v9 additive bump

key-decisions:
  - "Dexie v9 is additive-only — no .upgrade callback, precons_cache just gets created empty. Existing v8 collection/decks/games/watchlist/profile data is untouched. This is safe per Dexie docs + PITFALLS §1 for single-table additions."
  - "precons_cache PK is the Scryfall set code (string), intentionally NOT added to UUID_TABLES — callers must supply `code`. Verified by tests/schema-v9.test.js Test 4 (add without code throws)."
  - "Undo inverse uses a structured { added[], updated[{id, prevQuantity}] } payload instead of 'delete N last rows' — survives manual edits between add-all and undo without corrupting state (Pitfall 7)."
  - "Toast fires the EXACT UI-SPEC string 'Added N cards from {name} to collection.' (not 'Added N cards to collection.') — verified in tests/collection.precon.test.js Test 6."
  - "Decklist row renders card name via window.__cf_getPreconCardName lookup with db.cards hydration — falls back to scryfall_id on miss so the render never blanks. Trade-off: a just-released precon with cards not yet in the local Dexie cache will show raw IDs until bulk data refreshes; acceptable because the user rarely drills into a precon before their bulk data is fresh."
  - "ss-fallback CSS ships despite the spike showing 100% duel-deck coverage — keyrune release cadence is independent of Scryfall, so future new-set releases could briefly show blank tiles without this safety net."
  - "Rate-limited Scryfall queue consumed for both /sets AND each page of the search_uri — 100ms spacing × ~1-2 pages per precon means a 100-card Commander Masters decklist fetch completes in under 1 second."

patterns-established:
  - "Pattern: additive Dexie bump — declare new table in new version, re-declare all prior tables verbatim, NO .upgrade callback. Safe for single-table additions with no data shape changes."
  - "Pattern: TTL-cached Scryfall service with stale fallback — fetchPrecons + fetchPreconDecklist establish the TTL + error-recovery shape for future read-through caches (e.g., set icons, spoiler feeds)."
  - "Pattern: batch-add-with-structured-undo — addAllFromPrecon is the reference for any future bulk-insert flow that needs one-click reversal (e.g., CSV import upgrade from Plan 2's N+1 pattern)."

requirements-completed: [COLLECT-02]

duration: 14m 21s
completed: 2026-04-16
---

# Phase 8 Plan 3: Precon Browser + Dexie v9 Summary

**Ships the Commander precon browser (one-click add of a 100-card deck as category:'owned' with a single undo entry that reverses the whole batch), backed by an additive Dexie v9 schema bump that introduces a precons_cache table while leaving the Phase 7 v5→v8 migration chain intact and every existing user row untouched.**

## Performance

- **Duration:** 14m 21s (861 seconds wall-clock)
- **Started:** 2026-04-16T09:14:26Z
- **Completed:** 2026-04-16T09:28:47Z
- **Tasks:** 6 (1 Wave 0 scaffold + 1 spike + 4 execution)
- **Files created:** 7 (3 tests + 1 fixture + 1 service + 1 component + 1 spike notes)
- **Files modified:** 7 (schema, worker, collection store, add-card-panel, screen, CSS, stale test assertion)
- **New tests added:** 16 cases across 3 files (4 schema-v9 + 6 precons + 6 collection.precon)

## Accomplishments

- **COLLECT-02 delivered** — BROWSE PRECONS in the LHS panel opens a full-screen drawer showing commander + duel_deck products newest-first (D-12). Clicking a tile loads and previews the decklist (commander row sorted to top with `workspace_premium` badge). ADD ALL N CARDS commits the whole deck as `category:'owned'`, `foil:0` in a Dexie transaction, merging duplicates on the `[scryfall_id+foil+category]` composite (D-08). One toast fires with the exact UI-SPEC string "Added N cards from {Precon Name} to collection.", one undo entry is registered, one `loadEntries()` reload runs (not N+1 — Pitfall 2).
- **Dexie v9 additive bump shipped** — New `precons_cache` table keyed by Scryfall set code, indexes on set_type/released_at/updated_at. Zero `.upgrade` callback (D-24). Full v1..v9 chain preserved in both main thread (`src/db/schema.js`) and the bulk-data worker (`src/workers/bulk-data.worker.js`) per PITFALLS §1. Phase 7's v5→v8 migration tests (12/12) still green.
- **src/services/precons.js shipped** — fetchPrecons + fetchPreconDecklist + invalidatePreconsCache, all routed through `queueScryfallRequest` (closes Pitfall 13 — no bare fetch). 7-day TTL (D-11), stale-cache fallback on fetch error, type-line is_commander heuristic (Pitfall 5).
- **Undo inverse with structured payload** — `collection_add_batch` undo entry carries `{ added: id[], updated: {id, prevQuantity}[] }` so manual edits between add-all and undo don't corrupt the inverse (Pitfall 7).
- **Keyrune safety net** — spike confirmed 100% coverage for currently-released duel-deck codes (19/20, with the 1 miss being a non-Scryfall code). Shipped `.ss.ss-fallback::before { content: '?' }` anyway as defence-in-depth for future set releases where keyrune hasn't caught up.
- **16 new tests, all green** — 4 schema-v9 (fresh open, v8→v9 preservation, index lookups, string-PK enforcement) + 6 precons (filter+sort, TTL cache, forceRefresh, stale fallback, paginated is_commander, decklist cache) + 6 collection.precon (99-card insert, merge duplicates, single loadEntries, single undo, undo inverse restores prevQuantity, exact toast string). Full suite 568 passing (baseline 552 → +16); 1 pre-existing vandalblast failure unchanged.
- **Vite production build verified** — `dist/assets/treasure-cruise-*.js` at 103KB (19.87KB gzipped), up from Plan 2's 88KB — about 15KB added for the precon browser drawer markup.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 test scaffolds** — `7a05f2f` (test) — 4 files / 1 fixture / 16 failing RED assertions as designed
2. **Task 2: keyrune spike** — `cb0fcea` (docs) — 100% coverage confirmed for current duel-deck codes; fallback still recommended as defence-in-depth
3. **Task 3: Dexie v9 additive bump** — `c9d13c7` (feat) — main + worker schema + 1 stale-assertion fix in schema.test.js
4. **Task 4: precons.js service** — `a6b952f` (feat) — fetchPrecons/fetchPreconDecklist/invalidatePreconsCache; 6/6 tests GREEN
5. **Task 5: collection store extensions** — `bd58ce9` (feat) — loadPrecons/selectPrecon/addAllFromPrecon/closePreconBrowser/refreshPrecons; 6/6 collection.precon tests GREEN
6. **Task 6: precon-browser drawer + wire-up + ss-fallback** — `dcf50a8` (feat) — component, BROWSE PRECONS click handler, CSS fallback rule; full suite green

**Plan metadata commit:** pending (created by execute-plan finaliser with this SUMMARY + STATE + ROADMAP updates)

## Files Created/Modified

**Created:**
- `src/services/precons.js` — Scryfall precon orchestration (173 lines). fetchPrecons + fetchPreconDecklist + invalidatePreconsCache. 7-day TTL. Stale-cache fallback. Type-line is_commander heuristic. All calls via queueScryfallRequest.
- `src/components/precon-browser.js` — Full-screen drawer HTML render. Two views (tile grid + decklist preview). Escape key closes. Name hydration via `window.__cf_getPreconCardName` with db.cards lookup.
- `tests/fixtures/scryfall-precons.js` — mockSetsResponse (5 precons + 3 excluded set_types including starter per D-09), mockDecklistPages (cmm 100 cards + woc paginated 2-page), makeMockFetch wrapper.
- `tests/schema-v9.test.js` — 4 cases validating the v9 schema against the production module.
- `tests/precons.test.js` — 6 cases validating the service layer.
- `tests/collection.precon.test.js` — 6 cases validating the store / batch-add / undo.
- `.planning/phases/08-treasure-cruise-rapid-entry/08-03-SPIKE-NOTES.md` — keyrune 3.18.0 duel-deck coverage audit.

**Modified:**
- `src/db/schema.js` — appended `db.version(9).stores({ ...v8_tables_verbatim, precons_cache: 'code, set_type, released_at, updated_at' })`. No .upgrade callback. UUID_TABLES unchanged (precons_cache intentionally excluded — string PK).
- `src/workers/bulk-data.worker.js` — mirror v9 declaration. Worker only touches cards+meta, but schema-match across the connection is required.
- `src/stores/collection.js` — import fetchPrecons/fetchPreconDecklist/invalidatePreconsCache; 7 new state fields; 5 new methods. addAllFromPrecon uses Dexie transaction + single loadEntries + single undo entry; inverse has structured payload.
- `src/components/add-card-panel.js` — removed `disabled` + `title="Available in Plan 3"` from BROWSE PRECONS button; added `@click="$store.collection.preconBrowserOpen = true; $store.collection.loadPrecons()"` + hover state.
- `src/screens/treasure-cruise.js` — import renderPreconBrowser; append to #tc-modals container. Existing Alpine.initTree on modalContainer binds its x-data.
- `src/styles/main.css` — `.ss.ss-fallback::before { content: '?' }` at the end.
- `tests/schema.test.js` — `expect(db.verno).toBe(8)` → `expect(db.verno).toBeGreaterThanOrEqual(8)` (Rule 1 fix — stale assertion vs intentional v9 bump).

## Decisions Made

- **Additive-only v9** — No `.upgrade` callback. precons_cache is created empty at first open post-upgrade; existing user data is untouched. This is the safest possible Dexie migration shape and what D-24 explicitly mandates.
- **precons_cache is string-PK (NOT UUID)** — The PK is the Scryfall set code (`cmm`, `dd2`, etc.). The UUID_TABLES creating-hook array was deliberately NOT extended — callers must supply `code`. Test 4 in schema-v9.test.js pins this contract: adding without code must throw.
- **Undo inverse uses structured payload** — Instead of "delete the last N rows", the inverse carries `{ added: id[], updated: {id, prevQuantity}[] }`. Rationale: if the user manually removes one of the added cards between add-all and undo, a naive "delete last N" inverse would fail or delete a different row. The structured payload is resilient to manual edits (Pitfall 7).
- **Toast string is EXACT, not templated loosely** — "Added N cards from {Precon Name} to collection." is asserted byte-for-byte by `tests/collection.precon.test.js` Test 6. UI-SPEC §Copywriting Contract locks this string.
- **Decklist row uses card-name lookup** — `window.__cf_getPreconCardName(scryfall_id)` reads from a Map hydrated from `db.cards`. The x-effect in precon-browser triggers hydration on drill-in. Falls back to `scryfall_id` on miss. Acceptable trade-off because the user rarely drills into a precon before the bulk-data cache is fresh.
- **ss-fallback is defence-in-depth** — Spike showed 100% coverage for currently-released duel-deck codes (the one miss, `dd1`, isn't a real Scryfall code). Rule still ships because keyrune release cadence is independent of Scryfall.
- **Queue routing for ALL Scryfall calls** — Both `/sets` and each paginated `search_uri` go through `queueScryfallRequest`. The 100ms spacing × 1-2 pages means a typical 100-card Commander precon fetch completes in under 1 second. `grep -cE "fetch\('" src/services/precons.js` returns 0 (no bare fetch).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale assertion in tests/schema.test.js after v9 bump**
- **Found during:** Task 3 (running the v5-to-v7 regression suite after appending v9).
- **Issue:** `tests/schema.test.js > db.verno is 8 after open` hard-codes `expect(db.verno).toBe(8)`. With v9 now declared, `db.verno` is 9, breaking an otherwise-passing test.
- **Fix:** Loosened to `expect(db.verno).toBeGreaterThanOrEqual(8)` and updated the test name to reflect that it survives future additive bumps. Both the Phase 7 clean-named-tables contract AND the Phase 8 Plan 3 v9 additive bump now pass this check.
- **Files modified:** `tests/schema.test.js`
- **Verification:** 6/6 schema.test.js cases pass; all 12 migration-v5-to-v7.test.js cases still pass; 4/4 schema-v9.test.js cases pass.
- **Committed in:** c9d13c7 (Task 3 commit)

**2. [Rule 2 - Missing Critical] Name hydration helper for decklist preview**
- **Found during:** Task 6 (writing the precon-browser decklist preview).
- **Issue:** The decklist entries returned by `fetchPreconDecklist` carry `scryfall_id` but no `name`. Without a lookup, the preview would show raw UUIDs — useless UX for the user deciding whether to commit.
- **Fix:** Added `window.__cf_getPreconCardName(scryfall_id)` and `window.__cf_hydratePreconNames(ids)` helpers in precon-browser.js. An in-memory Map caches names. An `x-effect` triggers hydration from `db.cards` on drill-in. Fallback to `scryfall_id` on miss preserves rendering.
- **Files modified:** `src/components/precon-browser.js`
- **Verification:** Manual — the decklist row renders card names when the local Dexie bulk-data cache is populated (normal user state); raw IDs only on first-boot before bulk data lands (acceptable).
- **Committed in:** dcf50a8 (Task 6 commit)

---

**Total deviations:** 2 auto-fixed (1 stale test assertion, 1 missing critical UX feature)
**Impact on plan:** Both are minimal-scope corrections that keep the spec contract intact. No production-code scope creep beyond what the plan specified. Deviation 2 materialises what the plan flagged as "executor's call" in Task 6's notes (scryfall_id vs name lookup).

## Issues Encountered

- **Pre-existing `tests/router.test.js > vandalblast` failure** — unchanged from Plans 1 & 2 (documented in their SUMMARY files and `deferred-items.md`). The Vandalblast mount calls `Alpine.data('postGameOverlay', ...)` when Alpine is undefined in the test harness. Not caused by Plan 3; not fixed by Plan 3. Full suite at `568 passing + 10 todo + 1 pre-existing failure`.
- **Alpine internal cleanup error in `npm test` output** — same post-hook noise flagged in Plan 2's SUMMARY. Tests pass; error is a vitest teardown artefact from jsdom interacting with Alpine's MutationObserver cleanup. Non-blocking.

## User Setup Required

None — no external service configuration. No new npm dependencies. No schema migration blocking (v9 is additive; v1.0 users get the new precons_cache table on first v1.1 boot alongside the Phase 7 v5→v8 upgrade, single migration event).

## Known Stubs

None. The BROWSE PRECONS button placeholder from Plan 2 is now fully wired. The decklist row card-name fallback (scryfall_id on Dexie cache miss) is documented behaviour, not a stub — normal user state shows names.

## is_commander False-Positive Rate Observed

The type_line heuristic flags any card matching `Legendary` + (`Creature` | `Planeswalker`) as a commander. In the fixture mocks:
- **cmm** (Commander Masters): 1/99 cards flagged (Sliver Gravemother). Accurate — Sliver Gravemother IS the deck's face commander.
- **woc** (Wilds of Eldraine Commander): 1/3 cards flagged (Faerie Mastermind, type_line 'Legendary Creature — Faerie Rogue'). Expected — this is reasonable legendary-creature representation of a precon.

Real-world precons typically contain 2-5 legendary creatures (main commander + 1-3 new legendary commander-eligible creatures that double as deck staples + potentially a Planeswalker). False-positive rate is expected to be ~3-5% of deck contents — acceptable for a visual hint that D-10 explicitly doesn't rely on for commit semantics.

## Decklist Row Name Lookup

Chose: **wire in name lookup via db.cards**. The raw scryfall_id fallback stays in place for edge cases (just-released set with cards not yet in bulk data, test fixtures). Trade-off accepted because:
1. Normal user state (bulk data fresh) → names render cleanly.
2. First-boot edge case (bulk data not yet loaded) → raw IDs acceptable; bulk data typically downloads within 30s of first app load.
3. Test fixtures use `cmm-001` / `woc-002` style IDs — they render as-is because there's no matching db.cards row. Also fine for tests.

Documented in `precon-browser.js` docblock.

## Phase 8 Final State — Feature Complete

All six COLLECT requirements from `.planning/phases/08-treasure-cruise-rapid-entry/08-CONTEXT.md` are now satisfied across Plans 1-3:

| Req | Delivered | Plan | Commit |
|-----|-----------|------|--------|
| COLLECT-01 (mass entry X close) | ✓ | 08-01 | Plan 1 summary |
| COLLECT-02 (precon browser) | ✓ | 08-03 | This plan |
| COLLECT-03 (dropdown thumbnails) | ✓ | 08-01 | Plan 1 summary |
| COLLECT-04 (printing picker) | ✓ | 08-02 | Plan 2 summary |
| COLLECT-05 (mana-cost audit) | ✓ | 08-01 | Plan 1 summary |
| COLLECT-06 (LHS add panel) | ✓ | 08-02 | Plan 2 summary |

Visual Regression Anchors (from 08-UI-SPEC.md):
- ✅ Anchor 1 (push not overlay) — Plan 2
- ✅ Anchor 2 (panel stays open across adds) — Plan 2
- ✅ Anchor 3 (printing strip wraps) — Plan 2
- ✅ **Anchor 4 (precon browser full-screen drawer)** — Plan 3 this commit
- ✅ **Anchor 5 (single toast for add-all, exact string)** — Plan 3 this commit
- ✅ Anchor 6 (dropdown row thumbnail) — Plan 1

Ready for `/gsd:verify-work` to confirm Phase 8 acceptance and advance to Phase 9.

## Next Phase Readiness

**Ready for Phase 9 (Thousand-Year Storm deckbuilder accuracy):**
- The Dexie v9 schema is live; `collection`, `decks`, `deck_cards`, `games`, `watchlist` all use clean-named UUID-PK tables. Phase 9's DECK-* requirements consume these directly.
- `queueScryfallRequest` is the canonical Scryfall primitive for Phases 9-12 — any new integration MUST route through it per PITFALLS §13.
- The batch-add-with-structured-undo pattern in `addAllFromPrecon` is the reference implementation for any future bulk-insert flow (e.g., DECK-* deck import upgrades).
- Phase 10 (auth) can layer `user_id` onto collection / decks / games / watchlist rows without schema changes (fields already nullable since v6).
- Phase 11 (sync) — precons_cache is intentionally NOT sync-eligible (public read-through cache; no `user_id` column; no `synced_at`).

## Self-Check: PASSED

Verified all claimed artefacts exist on disk and all commit hashes resolve:

- FOUND: src/services/precons.js
- FOUND: src/components/precon-browser.js
- FOUND: tests/fixtures/scryfall-precons.js
- FOUND: tests/schema-v9.test.js
- FOUND: tests/precons.test.js
- FOUND: tests/collection.precon.test.js
- FOUND: .planning/phases/08-treasure-cruise-rapid-entry/08-03-SPIKE-NOTES.md
- FOUND: src/db/schema.js (modified — v9 declaration present; `grep "db.version(9)"` matches once)
- FOUND: src/workers/bulk-data.worker.js (modified — v9 mirror present)
- FOUND: src/stores/collection.js (modified — addAllFromPrecon + loadPrecons + selectPrecon + refreshPrecons present)
- FOUND: src/components/add-card-panel.js (modified — BROWSE PRECONS wire-up; no "Available in Plan 3")
- FOUND: src/screens/treasure-cruise.js (modified — renderPreconBrowser imported + mounted)
- FOUND: src/styles/main.css (modified — ss-fallback rule)
- FOUND: tests/schema.test.js (modified — verno assertion loosened)
- FOUND: commit 7a05f2f (Task 1 — Wave 0 test scaffolds)
- FOUND: commit cb0fcea (Task 2 — keyrune spike)
- FOUND: commit c9d13c7 (Task 3 — Dexie v9 additive bump)
- FOUND: commit a6b952f (Task 4 — precons.js service)
- FOUND: commit bd58ce9 (Task 5 — collection store extensions)
- FOUND: commit dcf50a8 (Task 6 — precon browser drawer + wire-up + ss-fallback)

---
*Phase: 08-treasure-cruise-rapid-entry*
*Completed: 2026-04-16*
