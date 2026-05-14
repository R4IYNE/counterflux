// @vitest-environment node
// Phase 13 Plan 3 — D-05 explicit placeholders on card-search inputs.
// Updated by Quick Task 260514-uqc (Layer 1 + Layer 2 load-perf fix):
//
//   - src/db/search.js no longer hard-returns an empty-with-flag result when
//     bulk data isn't ready; instead it falls through to queueScryfallRequest()
//     so search remains functional during the bulk-streaming window.
//   - Consumer copy shifts from a blocking "Bulk data loading…" placeholder
//     to a softer "Using Scryfall search — local catalog warming up" inline
//     affordance shown above search results when bulkdata.status !== 'ready'.
//
// D-05 still scopes the affordance to exactly two user flows:
//   1. Treasure Cruise add-card panel (src/components/add-card-panel.js)
//   2. Thousand-Year Storm deck editor card-search (src/components/deck-search-panel.js)
//
// All OTHER screens render unconditionally (the audit in db-cards-empty-guard.test.js
// proves they handle empty db.cards lookups gracefully).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const addCardPanel = readFileSync('src/components/add-card-panel.js', 'utf-8');
const dbSearch = readFileSync('src/db/search.js', 'utf-8');
const deckSearchPanel = readFileSync('src/components/deck-search-panel.js', 'utf-8');

describe('D-05 card-search placeholders (Phase 13 Plan 3 + Quick 260514-uqc)', () => {
  it("Test 1: src/db/search.js routes through queueScryfallRequest when bulkdata not ready", () => {
    // The gate still inspects bulkdata.status, but instead of returning an
    // empty-with-flag, it now falls through to the Scryfall REST API.
    expect(dbSearch).toMatch(/bulkdata/i);
    expect(dbSearch).toMatch(/queueScryfallRequest/);
    expect(dbSearch).toMatch(/scryfall-queue/);
  });

  it("Test 2: src/components/add-card-panel.js renders the 'Using Scryfall search' affordance when bulkdata is streaming", () => {
    expect(addCardPanel).toMatch(/Using Scryfall search/i);
    expect(addCardPanel).toMatch(/bulkdata[\s\S]{0,40}status\s*!==\s*'ready'/);
  });

  it("Test 3: src/components/deck-search-panel.js reads bulkdata.status so Thousand-Year Storm renders the affordance hint", () => {
    // Deck-search-panel still inspects bulkdata.status to toggle the
    // affordance visibility (now shown when results are present and
    // bulk data is still streaming).
    const hasDirectRead = /bulkdata[\s\S]{0,40}status/i.test(deckSearchPanel);
    expect(hasDirectRead).toBe(true);
  });

  it("Test 4: src/components/deck-search-panel.js surfaces 'Using Scryfall search' copy matching the add-card affordance", () => {
    expect(deckSearchPanel).toMatch(/Using Scryfall search/i);
  });

  it("Test 5: src/db/search.js no longer hard-returns the empty-with-flag shape; API URL must be present", () => {
    // Negative: the legacy `bulkDataNotReady: true` literal is gone from search.js.
    expect(dbSearch).not.toMatch(/bulkDataNotReady:\s*true/);
    // Positive: the Scryfall search endpoint is referenced (the API URL).
    expect(dbSearch).toMatch(/\/cards\/search/);
  });
});
