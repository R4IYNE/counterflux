// @vitest-environment node
// Phase 13 Plan 3 — db.cards empty-lookup regression guards.
//
// D-04 streaming UI removes the splash overlay that implicitly gated every
// db.cards consumer. This suite locks down the audit contract that every
// on-boot consumer already handles empty db.cards lookups gracefully (Pitfall 2).
//
// We deliberately use SOURCE-LEVEL assertions rather than jsdom instantiation
// because:
//  - Most consumers are deeply wired into Alpine reactivity and Dexie transactions
//  - The contract we care about is "the source uses optional chaining OR an
//    explicit `if (!card)` guard before reading .name / .image_uris / etc."
//  - jsdom smoke-tests would force us to mock half the app
//
// This matches the style of tests/sync-status-chip.test.js and
// tests/streaming-ui.test.js.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf-8');
}

describe('db.cards empty-lookup audit (Phase 13 Plan 3, Pitfall 2)', () => {
  it('Test 1: src/screens/epic-experiment.js uses optional chaining on deck commander lookup', () => {
    const src = read('src/screens/epic-experiment.js');
    // Commander tile art path must tolerate a missing card record.
    expect(src).toMatch(/db\.cards\.get\(\s*deck\.commander_id\s*\)/);
    expect(src).toMatch(/card\?\.image_uris|card\?\.card_faces/);
  });

  it('Test 2: src/stores/collection.js guards card hydration with || null fallback', () => {
    const src = read('src/stores/collection.js');
    // loadEntries builds a cardMap and uses `cardMap[scryfall_id] || null`
    expect(src).toMatch(/cardMap\[entry\.scryfall_id\]\s*\|\|\s*null/);
    // addCard uses card?.name
    expect(src).toMatch(/card\?\.name/);
  });

  it('Test 3: src/stores/deck.js uses optional chaining on every db.cards consumer', () => {
    const src = read('src/stores/deck.js');
    expect(src).toMatch(/commanderCard\?\.name/);
    expect(src).toMatch(/card\?\.oracle_text/);
  });

  it('Test 4: src/stores/market.js guards checkAlerts with `if (!card) continue`', () => {
    const src = read('src/stores/market.js');
    // checkAlerts reads card price; must early-continue when card missing.
    expect(src).toMatch(/const card = await db\.cards\.get\(entry\.scryfall_id\);[\s\S]{0,80}if \(!card\) continue;/);
  });

  it('Test 5: src/components/deck-landing.js assigns card || null', () => {
    const src = read('src/components/deck-landing.js');
    expect(src).toMatch(/deck\._commanderCard\s*=\s*card\s*\|\|\s*null/);
  });

  it('Test 6: src/components/precon-browser.js catches and warns on empty db.cards read', () => {
    const src = read('src/components/precon-browser.js');
    expect(src).toMatch(/db\.cards\.where\('id'\)\.anyOf\(missing\)\.toArray\(\)/);
    // hydratePreconNames wraps the lookup in try/catch.
    expect(src).toMatch(/catch\s*\(err\)\s*\{[\s\S]{0,120}precon-browser/);
  });

  it('Test 7: src/components/ritual-modal.js guards commander hydration with if (card)', () => {
    const src = read('src/components/ritual-modal.js');
    expect(src).toMatch(/db\.cards\.get\(deck\.commander_id\)[\s\S]{0,120}if \(card\)/);
  });

  it('Test 8: src/components/watchlist-panel.js guards loadCard with truthy check', () => {
    const src = read('src/components/watchlist-panel.js');
    expect(src).toMatch(/const card = await db\.cards\.get\(entry\.scryfall_id\);[\s\S]{0,200}if \(card\)/);
  });

  it('Test 9: src/services/csv-import.js guards direct-lookup with if (card)', () => {
    const src = read('src/services/csv-import.js');
    expect(src).toMatch(/db\.cards\.get\(entry\.scryfallId\)[\s\S]{0,120}if \(card\)/);
  });

  it('Test 10: bulk consumers (.toArray() / .anyOf().toArray()) return empty arrays on empty db.cards — no guard required', () => {
    // This test exists to document the audit — Dexie's .toArray() always
    // returns [] on an empty table, so consumers that filter/map afterwards
    // are intrinsically safe. We assert at least 3 such call sites exist
    // across the codebase so the "no guard required" branch of the audit
    // is covered by a real SOT.
    const intelligence = read('src/stores/intelligence.js');
    const deckTile = read('src/components/deck-card-tile.js');
    const setCompletion = read('src/components/set-completion.js');

    expect(intelligence).toMatch(/db\.cards\.where\('name'\)\.equals\(s\.name\)\.toArray/);
    expect(deckTile).toMatch(/db\.cards\.where\('name'\)\.equals\(cardName\)\.toArray/);
    expect(setCompletion).toMatch(/db\.cards\.toArray/);
  });
});
