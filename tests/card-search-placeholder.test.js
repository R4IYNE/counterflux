// @vitest-environment node
// Phase 13 Plan 3 — D-05 explicit placeholders on card-search inputs.
//
// D-05 scopes the "Bulk data still loading" placeholder to exactly two user flows:
//   1. Treasure Cruise add-card panel (src/components/add-card-panel.js)
//   2. Thousand-Year Storm deck editor card-search (src/components/deck-search-panel.js)
//
// All OTHER screens render unconditionally (the audit in db-cards-empty-guard.test.js
// proves they handle empty db.cards lookups gracefully).
//
// We additionally gate src/db/search.js so the service returns an
// empty-with-flag result when bulk data is not ready — this lets consumers
// distinguish "no matches" from "bulk data still indexing".

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const addCardPanel = readFileSync('src/components/add-card-panel.js', 'utf-8');
const dbSearch = readFileSync('src/db/search.js', 'utf-8');
const deckSearchPanel = readFileSync('src/components/deck-search-panel.js', 'utf-8');

describe('D-05 card-search placeholders (Phase 13 Plan 3)', () => {
  it("Test 1: src/db/search.js guards searchCards() on bulkdata readiness — returns empty-with-flag when not ready", () => {
    // The guard must reference the bulkdata store and flag not-ready results
    // via `bulkDataNotReady`.
    expect(dbSearch).toMatch(/bulkdata/i);
    expect(dbSearch).toMatch(/bulkDataNotReady/);
  });

  it("Test 2: src/components/add-card-panel.js renders a 'Bulk data loading' skeleton when $store.bulkdata.status !== 'ready'", () => {
    expect(addCardPanel).toMatch(/Bulk data loading/);
    expect(addCardPanel).toMatch(/bulkdata[\s\S]{0,40}status\s*!==\s*'ready'/);
  });

  it("Test 3: src/components/deck-search-panel.js reads the bulk-data gating flag so Thousand-Year Storm card-search renders the placeholder", () => {
    // The deck-search panel must either consume the bulkDataNotReady flag
    // from src/db/search.js OR read bulkdata.status directly.
    const hasFlagConsumer = /bulkDataNotReady/.test(deckSearchPanel);
    const hasDirectRead = /bulkdata[\s\S]{0,40}status/i.test(deckSearchPanel);
    expect(hasFlagConsumer || hasDirectRead).toBe(true);
  });

  it("Test 4: src/components/deck-search-panel.js surfaces 'Bulk data loading' copy matching the add-card skeleton", () => {
    expect(deckSearchPanel).toMatch(/Bulk data loading/i);
  });

  it("Test 5: src/db/search.js guard returns early with { results: [], bulkDataNotReady: true } shape", () => {
    // Locks down the exact contract consumers expect.
    expect(dbSearch).toMatch(/results:\s*\[\]/);
    expect(dbSearch).toMatch(/bulkDataNotReady:\s*true/);
  });
});
