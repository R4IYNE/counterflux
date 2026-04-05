---
phase: 03-deck-builder-thousand-year-storm
plan: 05
subsystem: ui
tags: [import, export, moxfield, archidekt, arena, mtgo, csv, papaparse, decklist-parser]

requires:
  - phase: 03-deck-builder-thousand-year-storm
    provides: "Deck store, centre panel, card search, Dexie schema"
provides:
  - "Decklist import with 4-format auto-detection (Moxfield, Archidekt, Arena, plaintext)"
  - "Decklist export in 4 formats (Plain Text, MTGO, Arena, CSV)"
  - "Import modal with paste/drop, format badge, card resolution"
  - "Export modal with format preview, clipboard copy, file download"
affects: [deck-builder, collection-awareness]

tech-stack:
  added: []
  patterns: [imperative-modal-pattern, format-auto-detection, card-resolution-pipeline]

key-files:
  created:
    - src/services/deck-import.js
    - src/services/deck-export.js
    - src/components/deck-import-modal.js
    - src/components/deck-export-modal.js
    - tests/deck-import.test.js
    - tests/deck-export.test.js
  modified:
    - src/components/deck-centre-panel.js

key-decisions:
  - "PapaParse unparse with explicit fields array for CSV export (consistent with Phase 2 pattern)"
  - "Empty CSV exports header-only row instead of empty string"
  - "Import modal uses imperative DOM pattern (consistent with centre panel, not Alpine template)"

patterns-established:
  - "Format auto-detection via regex cascade: section headers (Moxfield) > category headers (Archidekt) > set+num (Arena) > fallback (plaintext)"
  - "Card resolution pipeline: parse text > search local DB > flag unresolved"

requirements-completed: [DECK-16, DECK-17, DECK-08]

duration: 5min
completed: 2026-04-05
---

# Phase 3 Plan 05: Deck Import/Export Summary

**4-format decklist import (Moxfield/Archidekt/Arena/plaintext) with auto-detection and card resolution, plus 4-format export (Plain Text/MTGO/Arena/CSV) with clipboard and download**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-05T18:46:49Z
- **Completed:** 2026-04-05T18:52:24Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Import service parses 4 decklist formats with auto-detection via regex cascade
- Export service generates 4 output formats including PapaParse CSV
- Import modal with paste/file-drop, live format badge, card resolution with unresolved flagging
- Export modal with format selection, live preview, copy-to-clipboard, and file download
- Import/Export buttons wired and enabled in deck centre panel header
- 28 tests covering all format detection, parsing, and export scenarios

## Task Commits

Each task was committed atomically:

1. **Task 1: Import/export service modules with tests** - `33f513b` (test + feat, TDD)
2. **Task 2: Import/export modals and centre panel wiring** - `629922d` (feat)

_Note: TDD RED commit for tests made separately before GREEN implementation._

## Files Created/Modified
- `src/services/deck-import.js` - Format detection, 4 parsers, card resolution pipeline
- `src/services/deck-export.js` - Plain text, MTGO, Arena, CSV export with PapaParse
- `src/components/deck-import-modal.js` - Import modal with paste/drop, format badge, resolution
- `src/components/deck-export-modal.js` - Export modal with format preview, copy, download
- `src/components/deck-centre-panel.js` - Wired Import/Export buttons (replaced disabled stubs)
- `tests/deck-import.test.js` - 19 tests for format detection, parsing, resolution
- `tests/deck-export.test.js` - 9 tests for all export formats

## Decisions Made
- PapaParse unparse with explicit fields array for CSV export, returning header-only for empty decks
- Import modal uses imperative DOM pattern consistent with deck centre panel (not Alpine x-data template)
- Format detection uses regex cascade priority: Moxfield section headers > Archidekt category headers > Arena set+num > plaintext fallback

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PapaParse returns empty string for empty data**
- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** PapaParse unparse() returns empty string when given empty rows array, but test expected header row
- **Fix:** Added explicit header-only return for empty rows before calling PapaParse
- **Files modified:** src/services/deck-export.js
- **Verification:** Test passes: empty deck CSV returns "Name,Quantity,Set,Collector Number,Mana Cost,Type"
- **Committed in:** 33f513b (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor edge case fix for empty CSV export. No scope creep.

## Issues Encountered
- Pre-existing build error in tag-manager.js (unresolved sortablejs import) prevents `npm run build` from succeeding. This is NOT caused by Plan 05 changes -- verified by testing build on pre-existing codebase. Logged as out-of-scope.

## Known Stubs
None -- all import/export functionality is fully wired.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Import/export complete, deck builder feature set is nearly complete
- Plan 06 (if any) can build on this foundation

---
*Phase: 03-deck-builder-thousand-year-storm*
*Completed: 2026-04-05*
