---
phase: 04-intelligence-layer
verified: 2026-04-06T08:00:00Z
status: passed
score: 13/13 must-haves verified
re_verification: false
---

# Phase 4: Intelligence Layer Verification Report

**Phase Goal:** Users receive data-driven deck recommendations, combo detection, and daily insights powered by EDHREC and Commander Spellbook
**Verified:** 2026-04-06T08:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

All must-haves across all four plans were aggregated for verification.

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1 | EDHREC synergy data can be fetched and cached for a commander | VERIFIED | `src/services/edhrec.js` fetches from `/api/edhrec/pages/commanders/${slug}.json`, caches in `db.edhrec_cache` with 7-day TTL |
| 2 | Salt score is available from EDHREC commander page | VERIFIED | `edhrec.js` extracts `card.salt` and returns `commanderSalt`; `normalizeSalt()` and `aggregateDeckSalt()` are exported |
| 3 | Rate limiting prevents excessive EDHREC requests | VERIFIED | `rateLimitedFetch()` enforces 200ms minimum between calls with `setTimeout` |
| 4 | Cached data is returned on subsequent requests within 7 days | VERIFIED | Cache check `Date.now() - cached.fetched_at < CACHE_TTL_MS` is present before any fetch |
| 5 | Graceful degradation returns null/empty on EDHREC failure | VERIFIED | Both `getCommanderSynergies` and `getCardSalt` return safe fallbacks in `catch` blocks |
| 6 | Commander Spellbook combo detection returns included combos | VERIFIED | `spellbook.js` POSTs to `/api/spellbook/find-my-combos` and maps `data.results.included` |
| 7 | Near-miss combos (1 piece missing) are identified separately | VERIFIED | `data.results.almostIncluded` mapped and returned separately; missing pieces flagged in `intelligence.js` via `piece.missing = !deckCardSet.has(piece.name)` |
| 8 | Gap detection warns when categories are below threshold | VERIFIED | `detectGaps()` in `gap-detection.js` compares `tagBreakdown`/`typeBreakdown` against `DEFAULT_THRESHOLDS` and returns severity-rated gaps |
| 9 | Gap thresholds scale proportionally for non-100-card formats | VERIFIED | `scale = deckSize / 100` applied to all thresholds |
| 10 | Intelligence store orchestrates EDHREC, Spellbook, and gap data reactively | VERIFIED | `intelligence.js` imports all three services and exposes `fetchForCommander`, `fetchCombos`, `updateGaps` |
| 11 | Salt score aggregates into a single 0-10 gauge value | VERIFIED | `normalizeSalt(rawSalt)` multiplies by 2.5 and caps at 10; `aggregateDeckSalt()` computes mean then normalizes |
| 12 | Insight engine generates daily deck upgrade suggestions | VERIFIED | `generateDailyInsight()` in `insight-engine.js` loads all decks, checks EDHREC cache, rotates through top-10 candidates by day-of-year seed |
| 13 | Intelligence store is initialized in main.js | VERIFIED | `main.js` line 12 imports `initIntelligenceStore`; line 24 calls `initIntelligenceStore()` |

**Score:** 13/13 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema.js` | Dexie schema v4 with edhrec_cache, combo_cache, card_salt_cache | VERIFIED | `db.version(4)` confirmed; all three tables present |
| `src/services/edhrec.js` | EDHREC API client with caching and rate limiting | VERIFIED | 160 lines; exports `getCommanderSynergies`, `getCardSalt`, `normalizeSalt`, `aggregateDeckSalt`, `sanitizeCommanderName` |
| `src/services/spellbook.js` | Commander Spellbook API client | VERIFIED | 60 lines; exports `findDeckCombos` |
| `src/utils/gap-detection.js` | Gap threshold detection pure function | VERIFIED | 57 lines; exports `detectGaps`, `DEFAULT_THRESHOLDS` |
| `src/stores/intelligence.js` | Alpine.store('intelligence') orchestrator | VERIFIED | 261 lines; exports `initIntelligenceStore`; wires all three services |
| `src/utils/insight-engine.js` | Mila insight generation service | VERIFIED | 87 lines; exports `generateDailyInsight`, `getDayOfYear` |
| `src/components/salt-gauge.js` | Salt score visual gauge component | VERIFIED | exports `renderSaltGauge`; renders 0-10 bar with MILD/SPICY/CRITICAL colour coding |
| `src/components/synergy-card.js` | Synergy suggestion mini-card tile | VERIFIED | exports `renderSynergyCard`; renders name + lift score + inclusion count + click-to-add |
| `src/components/combo-popover.js` | Combo detail popover | VERIFIED | exports `showComboPopover`; renders pieces, steps, prerequisites; closes on Escape/outside click |
| `src/components/deck-analytics-panel.js` | Extended analytics panel with intelligence sections | VERIFIED | Contains "SYNERGY SUGGESTIONS", "NEAR-MISS COMBOS", salt gauge wiring, gap warning inline injection |
| `src/components/deck-card-tile.js` | Extended card tile with combo badge overlay | VERIFIED | Lines 185-199: reads `intel.getComboCount(cardName)`, appends `.combo-badge` element, calls `showComboPopover` on click |
| `tests/fixtures/edhrec-prossh.json` | Sample EDHREC fixture with highsynergycards | VERIFIED | Contains `"tag": "highsynergycards"` at line 24 |
| `tests/fixtures/spellbook-combos.json` | Sample Spellbook fixture with almostIncluded | VERIFIED | Contains `almostIncluded` array at line 30 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/services/edhrec.js` | `src/db/schema.js` | `db.edhrec_cache` | WIRED | `db.edhrec_cache.get/put` calls confirmed in edhrec.js lines 61-93 |
| `src/services/spellbook.js` | `https://backend.commanderspellbook.com/find-my-combos` | POST fetch | WIRED | `fetch(\`${SPELLBOOK_BASE}/find-my-combos\`, { method: 'POST' })` at line 44 |
| `src/utils/gap-detection.js` | `src/utils/deck-analytics.js` | `tagBreakdown\|typeBreakdown` | WIRED | `analytics.typeBreakdown?.Land` and `analytics.tagBreakdown?.[category]` at lines 35-39 |
| `src/stores/intelligence.js` | `src/services/edhrec.js` | `import getCommanderSynergies` | WIRED | Line 4: imports `getCommanderSynergies`, `getCardSalt`, `normalizeSalt`, `aggregateDeckSalt` |
| `src/stores/intelligence.js` | `src/services/spellbook.js` | `import findDeckCombos` | WIRED | Line 9: imports `findDeckCombos` |
| `src/stores/intelligence.js` | `src/utils/gap-detection.js` | `import detectGaps` | WIRED | Line 10: imports `detectGaps`, `DEFAULT_THRESHOLDS` |
| `src/main.js` | `src/stores/intelligence.js` | `initIntelligenceStore()` | WIRED | Lines 12 + 24 confirmed |
| `src/components/deck-analytics-panel.js` | `src/stores/intelligence.js` | `Alpine.store('intelligence')` | WIRED | Lines 472, 644: reads salt, synergies, combos, gaps from store |
| `src/components/deck-card-tile.js` | `src/stores/intelligence.js` | `getComboCount\|comboMap` | WIRED | Lines 186-198: `intel.getComboCount(cardName)` and `intel.getCombosForCard(cardName)` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `deck-analytics-panel.js` (salt gauge) | `intel.saltScore` | `intelligence.js.fetchForCommander` → `edhrec.js.getCommanderSynergies` → EDHREC API or cache | Yes — normalizes raw salt from API JSON response | FLOWING |
| `deck-analytics-panel.js` (synergy suggestions) | `intel.synergies` | `intelligence.js.fetchForCommander` → filters `result.synergies` array from EDHREC response | Yes — maps `highsynergycards` array from API | FLOWING |
| `deck-analytics-panel.js` (near-miss combos) | `intel.combos.almostIncluded` | `intelligence.js.fetchCombos` → `spellbook.js.findDeckCombos` → Spellbook POST API | Yes — maps `data.results.almostIncluded` | FLOWING |
| `deck-analytics-panel.js` (gap warnings) | `intel.gaps` | `intelligence.js.updateGaps` → `detectGaps(analytics, ...)` → `analytics.tagBreakdown` | Yes — pure computation over real deck analytics | FLOWING |
| `deck-card-tile.js` (combo badge) | `comboCount` | `intel.getComboCount(cardName)` → `comboMap[cardName]` built from `fetchCombos` result | Yes — O(1) lookup into populated comboMap | FLOWING |
| `insight-engine.js` | `candidates` | `db.decks.toArray()` + `db.edhrec_cache.get(slug)` + `db.deck_cards.where('deck_id')` | Yes — reads from IndexedDB | FLOWING (service-only; UI wiring deferred to Phase 6 by design, per D-15) |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| EDHREC service tests pass | `npm test -- tests/edhrec-service.test.js` | 10 tests passed | PASS |
| Salt score tests pass | `npm test -- tests/salt-score.test.js` | 6 tests passed | PASS |
| Spellbook service tests pass | `npm test -- tests/spellbook-service.test.js` | 6 tests passed | PASS |
| Gap detection tests pass | `npm test -- tests/gap-detection.test.js` | 10 tests passed | PASS |
| Insight engine tests pass | `npm test -- tests/insight-engine.test.js` | 7 tests passed | PASS |
| Full suite | `npm test` | 311 passed, 0 failed, 10 todo (in unrelated phase 3 builder screen stubs) | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INTEL-01 | 04-01-PLAN, 04-04-PLAN | EDHREC synergy suggestions with lift scores | SATISFIED | `edhrec.js` fetches synergy data; `deck-analytics-panel.js` renders "SYNERGY SUGGESTIONS" section with `renderSynergyCard`; click-to-add wired |
| INTEL-02 | 04-02-PLAN, 04-04-PLAN | Category gap detection with threshold warnings | SATISFIED | `gap-detection.js` implements `detectGaps`; `deck-analytics-panel.js` injects `.gap-warning`/`.gap-critical` elements inline in tag breakdown |
| INTEL-03 | 04-02-PLAN, 04-04-PLAN | Commander Spellbook combo detection with badges | SATISFIED | `spellbook.js` calls find-my-combos API; `deck-card-tile.js` renders `.combo-badge` for cards in combos; `combo-popover.js` shows pieces and steps |
| INTEL-04 | 04-02-PLAN, 04-04-PLAN | Near-miss combos (1 piece missing) | SATISFIED | `intelligence.js` marks `piece.missing` for almostIncluded combos; `deck-analytics-panel.js` renders "NEAR-MISS COMBOS" section with missing pieces in red |
| INTEL-05 | 04-01-PLAN, 04-03-PLAN, 04-04-PLAN | Salt score aggregate 0-10 gauge | SATISFIED | `normalizeSalt`/`aggregateDeckSalt` in `edhrec.js`; `renderSaltGauge` in `salt-gauge.js`; wired into analytics panel |
| INTEL-06 | 04-03-PLAN | Mila daily insights: upgrade suggestions | SATISFIED (service) | `generateDailyInsight()` in `insight-engine.js` is complete with daily rotation logic; dashboard UI wiring intentionally deferred to Phase 6 per D-15 design decision |

---

### Anti-Patterns Found

None detected. Scan covered all 10 phase-4 source files for TODO/FIXME/placeholder comments, empty handlers, hardcoded empty returns, and hollow props.

---

### Human Verification Required

#### 1. Synergy suggestion add-to-deck flow

**Test:** Open a deck with a commander (e.g. Prossh), wait for EDHREC synergy panel to populate, click a suggestion card in the sidebar.
**Expected:** Card is added to the deck, toast confirms "Added [Card Name] ([SET]) from suggestions."
**Why human:** Requires live EDHREC proxy, IndexedDB, and Alpine reactivity — not testable with grep or static analysis.

#### 2. Combo badge rendering on card tiles

**Test:** Open a deck that has known Commander Spellbook combos. After combo fetch completes, verify bolt badges appear on combo piece card tiles.
**Expected:** Cards participating in combos show a bolt icon badge in the tile corner. Clicking the badge opens a popover with combo pieces and steps.
**Why human:** Requires DOM rendering, Alpine store reactivity, and live Spellbook API proxy — not testable statically.

#### 3. Gap warnings inline in tag breakdown

**Test:** Open a deck with fewer than 10 ramp pieces. Navigate to analytics sidebar.
**Expected:** Ramp row in the tag breakdown shows a warning icon with "RAMP: N CARDS -- BELOW 10" or "CRITICALLY LOW" label.
**Why human:** Requires DOM mutation of existing tag rows, which depends on Alpine effect reactive loop completing correctly.

#### 4. Salt gauge colour transitions

**Test:** Compare salt gauge rendering for a deck with a high-salt commander (e.g. Armageddon) vs low-salt.
**Expected:** Low salt (0-3) renders green, mid (4-6) amber, high (7-10) red — all using design system accent colours.
**Why human:** Visual colour accuracy requires browser rendering.

---

### Notes

- **INTEL-06 (Mila daily insights):** The `generateDailyInsight()` service is complete and fully tested (7 passing tests). Its dashboard UI panel is intentionally unconnected in Phase 4 — the plan's objective comment explicitly states "dashboard UI wiring is Phase 6" (D-15). This is a planned deferral, not a gap. The service is ORPHANED from the UI but WIRED to its data sources (IndexedDB decks and EDHREC cache).
- **Skipped tests (10 todo):** All `it.todo` entries are in `deck-builder-screen.test.js` (Phase 3 concern) and `set-completion.test.js` (Phase 2 concern). None are Phase 4 items.
- **EDHREC proxy:** Both `edhrec.js` and `spellbook.js` use Vite dev-server proxy paths (`/api/edhrec`, `/api/spellbook`) to avoid CORS. Production serverless proxy wiring is documented in comments as a follow-up deployment concern.

---

_Verified: 2026-04-06T08:00:00Z_
_Verifier: Claude (gsd-verifier)_
