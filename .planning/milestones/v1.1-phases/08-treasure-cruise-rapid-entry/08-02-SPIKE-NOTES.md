# Plan 2 Spike: prints_search_uri retention

**Date:** 2026-04-16
**Conclusion:** A

## Fields checked

- **prints_search_uri:** KEPT (no trim applied).
  - Cite: `src/workers/bulk-data-pipeline.js:54` — `await db.cards.bulkPut(toInsert)` where `toInsert` contains the raw `value.value` objects from `@streamparser/json-whatwg` (see lines 45-54). No projection / field-pick step exists anywhere between Scryfall's response bytes and Dexie storage.
  - Additional evidence: `grep -rn "prints_search_uri" src/` returns ZERO matches — the field has never been stripped nor consumed by existing code, so it survives bulk ingestion verbatim. Dexie's store declaration (`src/workers/bulk-data.worker.js:132` — `cards: 'id, name, oracle_id, set, collector_number, cmc, color_identity, type_line, [set+collector_number]'`) lists only the INDEXED fields; Dexie preserves all other top-level card fields as non-indexed properties of the stored object.
- **oracle_id:** KEPT.
  - Cite: `src/workers/bulk-data.worker.js:132` (index declaration) + `src/db/search.js:33` (already consumed: `const key = card.oracle_id || card.id`). Dedup logic would explode if the field vanished; it doesn't.
- **games array:** KEPT.
  - Cite: `src/db/search.js:11` — `isPaperLegal()` reads `card.games.includes('paper')`; the check is active on every search result, confirming the field is stored and readable from Dexie.

## Impact on Task 5 (loadPrintings)

Use **Branch A** (fast path): read `card.prints_search_uri` directly. No Scryfall round-trip needed to construct the URL.

The fallback path (`card.oracle_id` → `https://api.scryfall.com/cards/search?q=oracleid%3A{id}&unique=prints`) is still included in the implementation as defensive coverage — test fixtures or old-schema cards may not have the URL present.

## If outcome C

Not applicable — outcome A confirmed. Plan 2 Task 5 proceeds without blocker.
