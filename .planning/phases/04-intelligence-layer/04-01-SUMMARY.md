---
phase: 04-intelligence-layer
plan: 01
subsystem: api
tags: [edhrec, dexie, indexeddb, caching, rate-limiting, salt-score]

requires:
  - phase: 03-deck-builder-thousand-year-storm
    provides: Dexie schema v3 with decks and deck_cards tables
provides:
  - EDHREC synergy fetch service with 7-day IndexedDB caching
  - Salt score normalization (raw 0-4 to display 0-10 scale)
  - Deck salt aggregation function
  - Dexie schema v4 with edhrec_cache, combo_cache, card_salt_cache tables
  - Commander name sanitization utility
affects: [04-02, 04-03, 04-04, 04-05]

tech-stack:
  added: []
  patterns: [rate-limited API fetch with cache-first strategy, Dexie schema versioning for new cache tables]

key-files:
  created:
    - src/services/edhrec.js
    - tests/fixtures/edhrec-prossh.json
    - tests/edhrec-service.test.js
    - tests/salt-score.test.js
  modified:
    - src/db/schema.js

key-decisions:
  - "EDHREC JSON endpoints accessed via rate-limited fetch with 200ms minimum delay"
  - "Cache-first pattern: check IndexedDB before network, 7-day TTL"
  - "Graceful degradation returns safe fallback object on any EDHREC failure"
  - "Salt normalization uses 2.5x multiplier capped at 10 for display scale"

patterns-established:
  - "EDHREC service pattern: sanitize name, check cache, rate-limited fetch, parse response, cache result"
  - "Cache table pattern: primary key is sanitized name, stores data + fetched_at timestamp"

requirements-completed: [INTEL-01, INTEL-05]

duration: 4min
completed: 2026-04-06
---

# Phase 4 Plan 01: EDHREC Service Summary

**EDHREC synergy and salt score service with Dexie v4 caching, 200ms rate limiting, and graceful degradation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-06T19:02:59Z
- **Completed:** 2026-04-06T19:07:01Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- EDHREC service layer fetches commander synergies and card salt scores from JSON endpoints
- IndexedDB caching via Dexie v4 schema with 7-day TTL prevents redundant API calls
- Rate limiting enforces 200ms minimum between EDHREC requests
- Salt score normalization converts raw EDHREC decimals (0-4) to 0-10 display scale
- Graceful degradation returns safe fallback on any network/parse failure
- 35 passing tests covering fetch, cache, rate limit, sanitization, normalization, and aggregation

## Task Commits

Each task was committed atomically:

1. **Task 1: Dexie schema v4 + EDHREC service with rate-limited caching** - `0fc4b9b` (feat)
2. **Task 2: Salt score aggregation and normalization tests** - `aeb2576` (test)

## Files Created/Modified
- `src/db/schema.js` - Extended with Dexie v4: edhrec_cache, combo_cache, card_salt_cache tables
- `src/services/edhrec.js` - EDHREC API client with getCommanderSynergies, getCardSalt, normalizeSalt, aggregateDeckSalt
- `tests/fixtures/edhrec-prossh.json` - Sample EDHREC commander JSON response for Prossh
- `tests/edhrec-service.test.js` - 16 tests for EDHREC service (fetch, cache, rate limit, sanitization, degradation)
- `tests/salt-score.test.js` - 19 tests for salt normalization and deck aggregation edge cases

## Decisions Made
- EDHREC JSON endpoints at `json.edhrec.com/pages/commanders/{name}.json` used as primary data source (per D-01)
- Commander name sanitization strips commas, apostrophes, converts to lowercase kebab-case
- Cache stores full parsed result (synergies + salt + colorIdentity) not raw response, reducing parse overhead on cache hits
- aggregateDeckSalt implemented alongside normalizeSalt in same module for cohesion

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Initial test approach using `vi.resetModules()` with dynamic imports caused shared IndexedDB state between tests. Resolved by switching to static imports with `db.edhrec_cache.clear()` / `db.card_salt_cache.clear()` in beforeEach.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- EDHREC service ready for intelligence store integration (Plan 03)
- Salt score functions ready for analytics panel gauge component (Plan 04/05)
- Combo cache table ready for Commander Spellbook service (Plan 02)

## Self-Check: PASSED

All 5 created/modified files verified present. Both commit hashes (0fc4b9b, aeb2576) verified in git log.

---
*Phase: 04-intelligence-layer*
*Completed: 2026-04-06*
