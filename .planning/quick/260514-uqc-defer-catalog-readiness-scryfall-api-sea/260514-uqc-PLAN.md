---
phase: quick-260514-uqc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/db/search.js
  - src/components/add-card-panel.js
  - src/components/deck-search-panel.js
  - src/utils/scryfall.js
  - src/workers/bulk-data.worker.js
  - tests/search.test.js
  - tests/card-search-placeholder.test.js
autonomous: true
requirements:
  - QUICK-260514-UQC-L1   # Layer 1: Scryfall API search fallback when bulkdata not ready
  - QUICK-260514-UQC-L2   # Layer 2: Switch boot bulk feed default-cards -> oracle-cards

must_haves:
  truths:
    - "When a user lands on Treasure Cruise or Thousand-Year Storm before bulk data finishes streaming, typing a 2+ char query returns real Scryfall card results within ~500ms instead of the 'Bulk data loading…' empty state."
    - "browseCards() (Thousand-Year Storm's initial colour-identity browse) returns real Scryfall results sorted by name when bulkdata.status !== 'ready'."
    - "Result objects from the API fallback are shape-compatible with the local Dexie path — no consumer-side branching is required in add-card-panel.js or deck-search-panel.js (renders thumbnails, names, prices, set codes from the same fields)."
    - "When bulkdata.status === 'ready', searchCards/browseCards return Dexie results (zero behaviour change from today's hot path)."
    - "Every Scryfall API call goes through queueScryfallRequest() — User-Agent header + 100ms spacing per Scryfall ToS preserved."
    - "Boot bulk feed downloads oracle-cards (~100MB raw, ~30k cards) instead of default-cards (~500MB raw, ~500k printings)."
    - "Consumer placeholder copy shifts from 'Bulk data loading — autocomplete available when archive is indexed' (full blocker) to a softer 'Using Scryfall search — local catalog warming up' affordance shown only while bulkdata is not ready AND results are present from the API."
    - "Existing tests/search.test.js fixture-based tests still pass (the API fallback path is skipped when db.cards is pre-populated)."
  artifacts:
    - path: "src/db/search.js"
      provides: "API-fallback aware searchCards + browseCards"
      contains: "queueScryfallRequest"
    - path: "src/utils/scryfall.js"
      provides: "SCRYFALL_BULK_API constant (oracle-cards endpoint)"
      contains: "bulk-data/oracle-cards"
    - path: "src/workers/bulk-data.worker.js"
      provides: "Worker SCRYFALL_BULK_API constant (oracle-cards endpoint)"
      contains: "bulk-data/oracle-cards"
    - path: "tests/search.test.js"
      provides: "API fallback contract test"
      contains: "queueScryfallRequest"
  key_links:
    - from: "src/db/search.js"
      to: "src/services/scryfall-queue.js"
      via: "queueScryfallRequest import + invocation"
      pattern: "import.*queueScryfallRequest.*scryfall-queue"
    - from: "src/components/add-card-panel.js"
      to: "src/db/search.js"
      via: "window.__cf_searchCards consumption — must keep working with API-fallback result shape"
      pattern: "__cf_searchCards"
    - from: "src/components/deck-search-panel.js"
      to: "src/db/search.js"
      via: "searchCards/browseCards imports — must keep working with API-fallback result shape"
      pattern: "searchCards|browseCards"
---

<objective>
Defer catalog-readiness blocking on the two card-search flows (Treasure Cruise add-card panel + Thousand-Year Storm deck search) by adding a Scryfall REST API fallback that activates while bulk data is still downloading/indexing. Pair with switching the boot bulk feed from default-cards (~500MB) to oracle-cards (~100MB) to shrink the dead-time window from 3-5 minutes to ~30-60 seconds.

Purpose: Today, first-boot users see a 3-5 minute "broken" period where search returns the "Bulk data loading…" empty state even though the app painted in 0.7s. The fix has two layers that are independent but additive — Layer 1 (API fallback) restores search functionality immediately, Layer 2 (oracle-cards) shrinks the bulk window 5x so the API-fallback path is only active for the genuine first-time-warm-cache case.

Output: Working search + browse for new-arrivals on Treasure Cruise + Thousand-Year Storm with no UI dead-time, plus a smaller boot bulk feed.

Constraints honoured:
- Scryfall ToS — every API call goes through queueScryfallRequest() (User-Agent + 100ms spacing)
- bfcache contract from Phase 13 Plan 2 — preserved (no DB writes in fallback path)
- v6+v7+v8 Dexie chain — untouched (bulk pipeline still writes to db.cards, just with smaller payloads)
- No new dependencies — scryfall-queue.js + existing fetch is sufficient
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@src/db/search.js
@src/services/scryfall-queue.js
@src/utils/scryfall.js
@src/workers/bulk-data.worker.js
@src/components/add-card-panel.js
@src/components/deck-search-panel.js
@src/stores/collection.js
@tests/search.test.js
@tests/card-search-placeholder.test.js

<interfaces>
<!-- The contracts the executor needs without re-exploring the codebase. -->

From src/services/scryfall-queue.js (the rate-limit boundary — use for EVERY Scryfall call):
```js
// Throws Error('Scryfall {status}: {url}') on non-2xx
export function queueScryfallRequest(url: string, options?: RequestInit): Promise<any>;
export function __resetQueueForTests(): void;
```

From src/db/search.js (current contract — to be updated):
```js
// Current: returns [] with .bulkDataNotReady = true when bulkdata.status !== 'ready'
// New: returns real Scryfall card array (NO .bulkDataNotReady flag) when bulkdata.status !== 'ready'
//      AND query is valid (>= 2 chars). The flag is REMOVED from the search.js path.
export async function searchCards(query: string, limit?: number): Promise<Card[]>;
export async function browseCards(colorIdentity?: string[], filters?: object, limit?: number): Promise<Card[]>;
```

From Scryfall card object shape (what bulk pipeline stores and what API returns — identical):
```js
{
  id: string,                 // scryfall card UUID
  oracle_id: string,
  name: string,
  set: string,                // 3-letter set code
  collector_number: string,
  type_line: string,
  mana_cost: string,
  cmc: number,
  color_identity: string[],   // e.g. ['G','W']
  rarity: 'common'|'uncommon'|'rare'|'mythic',
  oracle_text: string,
  image_uris: { small, normal, large, ... },
  prices: { usd, usd_foil, eur, eur_foil, ... },
  games: string[],            // ['paper', 'mtgo', 'arena'] — filter to 'paper'
  prints_search_uri: string,
  set_type: string,           // 'memorabilia' filtered out by isPaperLegal
}
```

Scryfall API endpoints (all hit via queueScryfallRequest):
```
GET /cards/search?q={query}&unique=cards&order=name
  → { data: Card[], has_more: bool, next_page?: string, total_cards: number }
  → 404 with object_type='error' when no matches — queueScryfallRequest throws; CATCH and return []

GET /cards/{set}/{collector_number}
  → Single Card object — for set+collector_number lookups when oracle-cards is missing the printing
```

Search syntax for browseCards (Scryfall query string composition):
- colour identity: `identity<=GW` (cards within G+W); `identity=C` for colourless
- type: `type:creature`
- cmc: `cmc=3` or `cmc>=7` for the 7+ bucket
- rarity: `rarity:rare`
- games:paper is implicit in /cards/search but we add it defensively: `game:paper`

From src/stores/collection.js (printing-fallback pattern already in production at line 264-313 — exact template for the oracle-cards-printing fallback if needed):
```js
// loadPrintings: uses card.prints_search_uri OR
// /cards/search?q=oracleid%3A{oracle_id}&unique=prints, paginates has_more.
// Uses queueScryfallRequest. Returns paper-only printings sorted by released_at DESC.
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED+GREEN — searchCards/browseCards Scryfall API fallback in src/db/search.js</name>
  <files>tests/search.test.js, tests/card-search-placeholder.test.js, src/db/search.js</files>
  <behavior>
    Test contracts (RED first — commit failing, then GREEN):

    tests/search.test.js — add new test block:
    - "falls through to Scryfall API when bulkdata.status !== 'ready' and query is valid"
      • Set window.Alpine.store('bulkdata') to a stub returning { status: 'streaming' }
      • Mock queueScryfallRequest (via vi.mock('../src/services/scryfall-queue.js')) to return a known
        Scryfall response: { data: [{ id, name: 'Counterspell', oracle_id, set: 'lea', collector_number: '55',
          type_line: 'Instant', cmc: 2, color_identity: ['U'], rarity: 'rare', games: ['paper'],
          image_uris: {...}, prices: { eur: '0.50' } }], has_more: false }
      • Call searchCards('counter', 12) — expect results.length === 1 AND results[0].name === 'Counterspell'
      • Verify queueScryfallRequest was called with a URL matching /cards/search.*counter/
      • Verify db.cards was NOT queried (existing fixtures are pre-populated — assert via spy that the
        Dexie path was skipped; easiest: clear db.cards in this block and rely on the result coming from
        the mock, OR spy on db.cards.where to assert .not.toHaveBeenCalled())
    - "falls through to Scryfall API when bulkdata.status !== 'ready' for browseCards"
      • Same stub setup; call browseCards(['U'], { type: 'Creature' }, 20)
      • Expect queueScryfallRequest called with URL containing `q=` with identity<=U and type:creature
      • Expect results returned from the mock
    - "returns [] when API fallback throws (e.g. 404 no-match)"
      • Mock queueScryfallRequest to reject with Error('Scryfall 404: ...')
      • Call searchCards('xyzzqq', 12) — expect []
      • Should NOT throw to the caller

    tests/card-search-placeholder.test.js — update existing tests:
    - Test 1 (renamed): "src/db/search.js routes through queueScryfallRequest when bulkdata not ready"
      • Replace the `bulkDataNotReady` regex assertion with: expect(dbSearch).toMatch(/queueScryfallRequest/)
        AND expect(dbSearch).toMatch(/scryfall-queue/)
      • Keep the bulkdata-store reference assertion (the gate still inspects status)
    - Test 5 (replaced): "src/db/search.js no longer hard-returns { results: [], bulkDataNotReady: true }"
      • Negative assertion: expect(dbSearch).not.toMatch(/bulkDataNotReady:\s*true/)
      • Positive assertion: expect(dbSearch).toMatch(/\/cards\/search/) — the API URL must be present
    - Tests 2 + 4 (copy update): change the literal 'Bulk data loading' regex to the new affordance copy
      'Using Scryfall search' (case-insensitive) — these will be wired in Task 2
    - Test 3 (deck-search-panel reads bulkdata.status) — keep as-is; deck-search-panel will still read
      bulkdata.status for the affordance hint visibility toggle
  </behavior>
  <action>
    Step 1 — RED commit (tests fail against current code):
    - Update tests/search.test.js: add the three new test cases above. Use vi.mock at top of file:
      `vi.mock('../src/services/scryfall-queue.js', () => ({ queueScryfallRequest: vi.fn() }))`
      Then in each new test, import the mocked fn and use mockResolvedValueOnce / mockRejectedValueOnce.
      Stub window.Alpine.store('bulkdata') via beforeEach + afterEach for the new tests only — leave
      the existing fixture tests untouched (they implicitly run with no Alpine store, which is the
      "ready" case for our gate — verify the current gate handles `store === null` correctly; it does:
      the `store && store.status !== 'ready'` short-circuits).
    - Update tests/card-search-placeholder.test.js: apply the regex changes above.
    - Run `rtk npm test -- search.test.js card-search-placeholder.test.js`. Verify the NEW tests fail
      (and the placeholder tests' new assertions fail) while existing fixture tests still pass.
    - Commit: `test(260514-uqc): RED — Scryfall API fallback + new placeholder copy contract`

    Step 2 — GREEN commit:
    - Edit src/db/search.js:
      • Import `queueScryfallRequest` from '../services/scryfall-queue.js'
      • Remove `bulkDataGate()` helper entirely (its only consumer becomes the new fallback router)
      • Add a new helper `isBulkDataReady()` that returns `true` when `window.Alpine?.store('bulkdata')?.status === 'ready'` OR when no Alpine store exists (test environment / pre-mount).
      • Add `async function searchCardsViaApi(query, limit)`:
          – Build URL: `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=cards&order=name&include_extras=false`
          – Wrap queueScryfallRequest in try/catch. On Error throw with /404/, return [].
          – Filter response `data` to paper-legal (use existing `isPaperLegal` helper — it's already defined
            in this file) and reject `name.startsWith('A-')` (Alchemy) — same rules as the Dexie path.
          – Slice to `limit`.
      • Add `async function browseCardsViaApi(colorIdentity, filters, limit)`:
          – Build Scryfall query string from filters:
            * `identity<={ci}` where ci is the joined uppercase colours; if empty/colourless-only:
              `identity=C`. The `<=` operator is "within identity".
            * `type:{filters.type}` (lowercase) when filters.type && filters.type !== 'All'
            * `cmc=N` for numeric cmc, `cmc>=7` when filters.cmc === '7+'
            * `rarity:{lower}` when filters.rarity && filters.rarity !== 'All'
            * Append `game:paper` always
          – Endpoint: `/cards/search?q={query}&unique=cards&order=name`
          – Same try/catch + filter + slice as searchCardsViaApi.
          – NOTE: filters.tag is a CLIENT-SIDE heuristic (suggestTags on oracle_text) — pass through
            unchanged; the consumer in deck-search-panel.js already applies this filter post-fetch.
      • In `searchCards(query, limit)`:
          – `if (!query || query.length < 2) return [];` (keep)
          – `if (!isBulkDataReady()) return await searchCardsViaApi(query, limit);`
          – Existing Dexie path unchanged below.
      • In `browseCards(colorIdentity, filters, limit)`:
          – `if (!isBulkDataReady()) return await browseCardsViaApi(colorIdentity, filters, limit);`
          – Existing Dexie path unchanged below.
    - Run `rtk npm test -- search.test.js card-search-placeholder.test.js`. All tests pass.
    - Run `rtk npm test` (full suite). Zero regressions.
    - Commit: `feat(260514-uqc): GREEN — Layer 1 Scryfall API search fallback`
  </action>
  <verify>
    <automated>cd "D:/Vibe Coding/counterflux" && rtk npm test -- search.test.js card-search-placeholder.test.js</automated>
  </verify>
  <done>
    - New API fallback tests pass; updated placeholder-contract tests pass.
    - When bulkdata.status !== 'ready', searchCards/browseCards hit Scryfall and return real cards
      (no more empty-array-with-flag).
    - When bulkdata.status === 'ready' (or store absent), the Dexie path runs unchanged.
    - Existing fixture-based tests still pass (no regression on the ready path).
    - Two atomic commits on master: RED, then GREEN.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update consumer placeholders + switch boot bulk feed to oracle-cards</name>
  <files>src/components/add-card-panel.js, src/components/deck-search-panel.js, src/utils/scryfall.js, src/workers/bulk-data.worker.js</files>
  <action>
    Two independent sub-changes, committed together as the Layer 2 + UX-copy commit.

    A) Switch boot bulk feed (Layer 2):
    - src/utils/scryfall.js: change line 1 — `SCRYFALL_BULK_API` from
      `https://api.scryfall.com/bulk-data/default-cards` to
      `https://api.scryfall.com/bulk-data/oracle-cards`.
    - src/workers/bulk-data.worker.js: change line 188 — same constant swap.
    - Do NOT touch the Dexie schema, the worker's schema-chain declarations, or processStream — the
      pipeline writes to db.cards.{id,name,oracle_id,set,collector_number,...} which all exist on
      oracle-cards rows. The only behavioural difference: ~30k rows instead of ~500k.

    B) Update consumer placeholder copy:
    - src/components/add-card-panel.js (around line 183-190): the existing template hidden behind
      `x-if="$store.bulkdata && $store.bulkdata.status !== 'ready'"` blocks the search input. Update
      its inner copy:
        OLD: "Bulk data loading &mdash; autocomplete available when archive is indexed"
        NEW: "Using Scryfall search — local catalog warming up"
      Also: change the visibility logic. The placeholder should NO LONGER block the search input
      (because Layer 1 made search actually work). Render it as a SMALL hint visible above/below
      the results dropdown when bulkdata.status !== 'ready' AND searchResults.length > 0.
      Concretely:
        - Remove the existing top-of-panel `<template x-if="$store.bulkdata && $store.bulkdata.status !== 'ready'">` block.
        - Inside the search-results dropdown (the `<div x-show="searchResults.length > 0">` block at
          ~line 218), add a small banner at the top of the dropdown:
            `<template x-if="$store.bulkdata && $store.bulkdata.status !== 'ready'">
               <div style="display: flex; align-items: center; gap: 6px; padding: 6px 12px;
                           background: var(--color-surface-hover); border-bottom: 1px solid var(--color-border-ghost);
                           color: var(--color-text-muted); font-family: 'JetBrains Mono', monospace;
                           font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;">
                 <span class="material-symbols-outlined" style="font-size: 12px;">cloud_sync</span>
                 <span>Using Scryfall search — local catalog warming up</span>
               </div>
             </template>`
        - Update the empty-state `<template x-if="(!$store.bulkdata || $store.bulkdata.status === 'ready') && !searchQuery && !selectedCard">` to drop the bulkdata gate (since search now works regardless):
          change to `<template x-if="!searchQuery && !selectedCard">` — keep the "READY TO ARCHIVE" copy as-is.

    - src/components/deck-search-panel.js: similar surgery on the vanilla-DOM equivalent.
        - Locate `bulkLoadingPlaceholder` (line ~185-198). Repurpose it as a small affordance hint:
          • New copy: "Using Scryfall search — local catalog warming up"
          • New visibility logic in `renderResults()`: show when
            `window.Alpine?.store('bulkdata')?.status !== 'ready'` AND `results.length > 0`.
            (Previously: shown when results.length === 0 && bulkDataNotReady.)
          • Visual: smaller padding (`padding: 6px 12px`), smaller font (10px), inserted ABOVE the
            results list (insertBefore resultsEl) rather than absorbing the no-results space.
        - Remove the `results.bulkDataNotReady = bulkDataNotReady` propagation in executeSearch
          (lines ~273-277) — the flag no longer exists on the searchCards/browseCards return.
        - The `noResults.style.display = ... results.length === 0 ...` line stays, but drop the
          `!bulkDataNotReady &&` clause — no results now genuinely means no Scryfall matches.
        - Note: at first paint when bulkdata is still streaming, browseCards (the empty-query default)
          will now hit the API. Make sure the initial `executeSearch()` call at the bottom of
          renderDeckSearchPanel still fires (it does today; verify it survives).

    C) Run tests:
    - `rtk npm test -- card-search-placeholder.test.js` — passes (Task 1 already updated the regex).
    - `rtk npm test` — full suite passes.

    Commit (single, since the two changes are coupled by the UX story): both files + bulk feed swap together.

    Commit: `feat(260514-uqc): Layer 2 — oracle-cards bulk feed + consumer affordance copy`
  </action>
  <verify>
    <automated>cd "D:/Vibe Coding/counterflux" && rtk npm test</automated>
  </verify>
  <done>
    - src/utils/scryfall.js + src/workers/bulk-data.worker.js both reference `bulk-data/oracle-cards`.
    - add-card-panel.js no longer blocks the search input when bulk data isn't ready; instead, an
      inline "Using Scryfall search — local catalog warming up" affordance appears above the
      results dropdown when bulkdata.status !== 'ready' and results are present.
    - deck-search-panel.js applies the same affordance treatment via the repurposed vanilla-DOM
      element; no-results state is reachable again (was masked by bulkDataNotReady flag).
    - Full test suite passes (Task 1 already updated the placeholder-copy regexes).
    - Single atomic commit on master.
  </done>
</task>

</tasks>

<verification>
1. From `D:/Vibe Coding/counterflux/`, run `rtk npm test`. All tests pass — specifically:
   - tests/search.test.js (existing fixtures + 3 new API-fallback tests)
   - tests/card-search-placeholder.test.js (updated regex contracts)
   - Full suite — zero regressions
2. `rtk grep -n "default-cards" src/` returns NO matches (both Layer 2 swaps done).
3. `rtk grep -n "oracle-cards" src/utils/scryfall.js src/workers/bulk-data.worker.js` returns 2 matches.
4. `rtk grep -n "bulkDataNotReady" src/` returns NO matches (flag fully removed).
5. `rtk grep -n "Using Scryfall search" src/components/` returns 2 matches.
6. `rtk grep -n "queueScryfallRequest" src/db/search.js` returns at least 1 match.
7. `rtk git log --oneline -5` shows 3 commits in order: Layer 2 GREEN, Layer 1 GREEN, Layer 1 RED.
</verification>

<success_criteria>
Layer 1 + Layer 2 ship as the described commits:
- Treasure Cruise: typing 2+ chars into the add-card panel returns real Scryfall results in <500ms even before bulk data finishes streaming.
- Thousand-Year Storm: opening a deck shows real Scryfall results in the search panel (browse mode by commander colour identity) within ~500ms of mount, no dead-time.
- When bulk data finishes streaming, the affordance hint disappears and subsequent searches hit Dexie locally (zero behaviour change from today's hot path).
- Boot bulk feed downloads ~100MB of oracle-cards instead of ~500MB of default-cards — the "warming up" window shrinks from 3-5 min to ~30-60s on broadband.
- Scryfall ToS preserved: User-Agent + 100ms spacing via queueScryfallRequest on every call.
- No new dependencies, no Dexie schema changes, bfcache contract preserved.
</success_criteria>

<output>
After completion, create `.planning/quick/260514-uqc-defer-catalog-readiness-scryfall-api-sea/260514-uqc-SUMMARY.md`
with the standard quick-task summary template (date, commits with SHAs, files touched, test deltas,
any v1.3 SEED follow-ups identified — e.g. SEED for printing-specific /cards/{set}/{collector_number}
fallback if oracle-cards proves too thin in production).
</output>
