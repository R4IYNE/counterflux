---
phase: 04-intelligence-layer
plan: 04
subsystem: ui
tags: [salt-gauge, synergy-suggestions, combo-badges, combo-popover, gap-warnings, near-miss-combos, edhrec, spellbook]

requires:
  - phase: 04-intelligence-layer (plan 03)
    provides: Intelligence Alpine store with reactive orchestration, combo map, salt normalization
  - phase: 04-intelligence-layer (plan 02)
    provides: Spellbook combo service, gap detection utility with DEFAULT_THRESHOLDS
  - phase: 04-intelligence-layer (plan 01)
    provides: EDHREC service with synergies, salt, caching
  - phase: 03-deck-builder-thousand-year-storm
    provides: Deck analytics panel, card tile components, deck store
provides:
  - Salt gauge component replacing Phase 4 placeholder with colour-coded 0-10 scale
  - Synergy suggestion cards in analytics sidebar with lift scores (click to add)
  - Combo badge overlay on card tiles with popover showing pieces and steps
  - Near-miss combo section highlighting missing pieces in red
  - Gap warnings inline in tag breakdown with amber/red severity
  - Threshold settings popover for per-deck gap customization
  - CSS utilities for combo badges, salt bar, gap warnings, shimmer loading
affects: [06-dashboard-epic-experiment]

tech-stack:
  added: []
  patterns: [intelligence-ui-wiring, vite-cors-proxy, imperative-dom-intelligence-sections]

key-files:
  created:
    - src/components/salt-gauge.js
    - src/components/synergy-card.js
    - src/components/combo-popover.js
    - src/styles/utilities.css
  modified:
    - src/components/deck-analytics-panel.js
    - src/components/deck-card-tile.js
    - src/stores/intelligence.js
    - src/stores/deck.js
    - src/services/edhrec.js
    - src/services/spellbook.js
    - vite.config.js

key-decisions:
  - "Vite dev server CORS proxy for EDHREC and Spellbook APIs (CloudFront blocks OPTIONS preflight)"
  - "Commander lookup by commander_id rather than non-existent commander_name field"
  - "Synergy card add resolves Scryfall ID by name before calling addCard"
  - "Near-miss combo missing flag computed by diffing almostIncluded pieces against deck card set"
  - "Empty state text: 'No synergy data available yet' instead of 'Select a commander'"

patterns-established:
  - "CORS proxy pattern: Vite proxy rewrites /api/edhrec and /api/spellbook to external APIs"
  - "Intelligence UI reads Alpine.store('intelligence') reactively in updateAllSections()"
  - "Card add from suggestions resolves Scryfall ID first via search, then calls deck store addCard"

requirements-completed: [INTEL-01, INTEL-02, INTEL-03, INTEL-04, INTEL-05]

duration: 12min
completed: 2026-04-06
---

# Phase 4 Plan 04: Intelligence UI Integration Summary

**Salt gauge, EDHREC synergy suggestions, combo badges with popover, gap warnings, and near-miss combos wired into deck builder analytics panel**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-06T21:15:00Z
- **Completed:** 2026-04-06T21:31:00Z
- **Tasks:** 3 (2 auto + 1 visual checkpoint)
- **Files modified:** 16

## Accomplishments
- Salt gauge replaces "COMING IN PHASE 4" placeholder with colour-coded bar (green 0-3, amber 4-6, red 7-10)
- EDHREC synergy suggestions appear in analytics sidebar with lift scores; clicking adds card to deck
- Combo badges (blue bolt icon) overlay card tiles; clicking opens popover with combo pieces, steps, and prerequisites
- Near-miss combos section shows almost-complete combos with missing pieces highlighted in red
- Gap warnings display inline in tag breakdown with amber/red severity indicators
- Threshold settings popover allows per-deck gap customization with save/reset
- Graceful degradation when EDHREC or Spellbook APIs are unavailable

## Task Commits

Each task was committed atomically:

1. **Task 1: New UI components + CSS** - `a7cd4ce` (feat)
2. **Task 2: Wire intelligence into analytics panel and card tiles** - `1b1498e` (feat)
3. **Task 3: Visual and functional verification** - checkpoint approved after bug fixes

**Bug fix commits during verification:**
- `71b6d69` - fix: wire intelligence fetch on deck load
- `06777dd` - fix: resolve commander name from commander_id for intelligence fetch
- `d29423d` - fix: add Vite CORS proxy for EDHREC and Spellbook APIs
- `03544cd` - fix: resolve Scryfall ID for synergy/combo card adds
- `4687930` - fix: mark missing pieces on near-miss combos

## Files Created/Modified
- `src/components/salt-gauge.js` - Salt score visual gauge with colour-coded bar (green/amber/red)
- `src/components/synergy-card.js` - Synergy suggestion mini-card tile with lift score and click-to-add
- `src/components/combo-popover.js` - Combo detail popover with pieces, steps, prerequisites
- `src/styles/utilities.css` - CSS utilities for combo-badge, salt-bar, gap-warning, shimmer animation
- `src/components/deck-analytics-panel.js` - Extended with salt gauge, synergy section, near-miss combos, gap warnings, threshold settings
- `src/components/deck-card-tile.js` - Extended with combo badge overlay on grid tiles
- `src/stores/intelligence.js` - Added commander_id lookup and enhanced fetch wiring
- `src/stores/deck.js` - Added addCardByName method with Scryfall ID resolution
- `src/services/edhrec.js` - URL construction adjustments for proxy
- `src/services/spellbook.js` - URL construction adjustments for proxy
- `vite.config.js` - CORS proxy configuration for EDHREC and Spellbook APIs

## Decisions Made
- **Vite CORS proxy**: CloudFront blocks OPTIONS preflight requests from browser; Vite dev server rewrites `/api/edhrec` and `/api/spellbook` paths to external APIs, bypassing CORS
- **Commander ID lookup**: The deck store has `commander_id` (Scryfall ID), not `commander_name`; intelligence fetch resolves the name from the card database before calling EDHREC
- **Scryfall ID resolution for adds**: When user clicks a synergy suggestion, the system searches Scryfall by name to get the full card object with ID before adding to deck
- **Missing piece computation**: Near-miss combos diff their `almostIncluded` pieces against the deck's card name set to determine which pieces are missing vs owned
- **Empty state copy**: Changed from "Select a commander" to "No synergy data available yet" since synergy section only appears when a deck with commander is already open

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Intelligence fetch not triggered on deck load**
- **Found during:** Task 3 (visual verification)
- **Issue:** Opening a deck did not trigger EDHREC/Spellbook fetch; analytics panel showed empty intelligence sections
- **Fix:** Added Alpine.effect() watcher in analytics panel that triggers intelligence fetch when active deck changes
- **Files modified:** src/components/deck-analytics-panel.js
- **Verification:** Opening a deck now triggers synergy and combo loading
- **Committed in:** `71b6d69`

**2. [Rule 1 - Bug] Commander name lookup from non-existent field**
- **Found during:** Task 3 (visual verification)
- **Issue:** Intelligence store tried to read `commander_name` field which does not exist on the deck record; deck store stores `commander_id` (Scryfall ID)
- **Fix:** Resolved commander name from `commander_id` via card database lookup before calling EDHREC
- **Files modified:** src/stores/intelligence.js
- **Verification:** Commander name correctly resolved, EDHREC fetch initiated
- **Committed in:** `06777dd`

**3. [Rule 3 - Blocking] CORS blocking EDHREC and Spellbook API requests**
- **Found during:** Task 3 (visual verification)
- **Issue:** Browser CORS preflight (OPTIONS) requests blocked by CloudFront CDN on both EDHREC and Commander Spellbook endpoints
- **Fix:** Added Vite dev server proxy configuration rewriting `/api/edhrec` and `/api/spellbook` paths to external APIs
- **Files modified:** vite.config.js, src/services/edhrec.js, src/services/spellbook.js
- **Verification:** API requests succeed through proxy, data loads into intelligence store
- **Committed in:** `d29423d`

**4. [Rule 1 - Bug] Synergy card add failed without Scryfall ID**
- **Found during:** Task 3 (visual verification)
- **Issue:** Clicking a synergy suggestion called `addCard` with just a name string, but `addCard` requires a Scryfall card object with ID
- **Fix:** Added Scryfall search-by-name resolution step before calling addCard; added `addCardByName` method to deck store
- **Files modified:** src/stores/deck.js, src/components/deck-analytics-panel.js
- **Verification:** Clicking synergy suggestion successfully adds card to deck with toast confirmation
- **Committed in:** `03544cd`

**5. [Rule 1 - Bug] Near-miss combos not showing which pieces are missing**
- **Found during:** Task 3 (visual verification)
- **Issue:** All pieces in near-miss combos rendered the same colour; `piece.missing` flag was not being set
- **Fix:** Added logic to diff `almostIncluded` combo pieces against deck card name set, setting `missing: true` on pieces not in deck
- **Files modified:** src/stores/intelligence.js
- **Verification:** Missing pieces now render in red with "MISSING" suffix
- **Committed in:** `4687930`

**6. [Rule 1 - Bug] Empty state text misleading**
- **Found during:** Task 3 (visual verification)
- **Issue:** Synergy section showed "Select a commander" when a commander was already selected but data hadn't loaded yet
- **Fix:** Changed empty state text to "No synergy data available yet"
- **Files modified:** src/components/deck-analytics-panel.js
- **Committed in:** (part of `4687930`)

---

**Total deviations:** 6 auto-fixed (5 bugs, 1 blocking)
**Impact on plan:** All fixes necessary for correct intelligence UI functionality. The plan's code specifications didn't account for runtime integration details (CORS, field naming, ID resolution). No scope creep.

## Issues Encountered
- CORS was the primary integration challenge; EDHREC and Commander Spellbook APIs both sit behind CloudFront which rejects browser OPTIONS preflight. The Vite proxy approach works for development; production deployment will need a serverless proxy or backend relay.

## Known Stubs
None. All intelligence data sources are wired to real API endpoints with graceful fallbacks.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 4 (Intelligence Layer) is now complete with all 4 plans executed
- All INTEL requirements (INTEL-01 through INTEL-05) satisfied
- Ready to proceed to Phase 5 (Market Intel + Game Tracker) which depends on Phase 1, not Phase 4
- Production CORS proxy will be needed for EDHREC/Spellbook in deployment (Phase 6 or DevOps concern)

## Self-Check: PASSED

- All 7 key files verified present on disk
- All 7 commit hashes verified in git log
- No missing items

---
*Phase: 04-intelligence-layer*
*Completed: 2026-04-06*
