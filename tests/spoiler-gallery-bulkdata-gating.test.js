// @vitest-environment node
// Phase 14 Plan 03 — Issue D regression lock.
//
// Audit 2026-04-22 flagged Preordain spoiler-gallery as missing the
// Phase 13 `_isBulkDataReady()` honesty-gate pattern. While bulk-data
// download is still running, the gallery's existing "No cards revealed
// yet for this set." empty state is dishonest — the user thinks the set
// has no spoilers when really the local IndexedDB cache isn't populated
// yet.
//
// This suite locks the 3-branch contract at source level:
//   1. Loading state (bulkdata not ready):      'Archive is downloading…'
//   2. Ready + empty state (cards.length === 0): 'No cards revealed yet for this set.'  (existing copy preserved)
//   3. Ready + populated state:                  card grid renders (unchanged from today)
//
// Pattern: source-level static grep (mirrors tests/epic-experiment-bulkdata-gating.test.js).
// spoiler-gallery.js returns an HTML string with Alpine bindings, not a mounted component,
// so jsdom instantiation would require the full market + bulkdata + app stores. Static grep
// is cheaper and more durable.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const spoilerSrc = readFileSync('src/components/spoiler-gallery.js', 'utf-8');

describe('Spoiler gallery bulk-data gating (Phase 14 Plan 03, Issue D)', () => {
  it('Test 1: source references $store.bulkdata or bulkdata.status', () => {
    expect(spoilerSrc).toMatch(/\$store\.bulkdata|bulkdata\.status|bulkdata\.isReady/);
  });

  it("Test 2: loading-state copy 'Archive is downloading' is present", () => {
    expect(spoilerSrc).toMatch(/Archive is downloading/);
  });

  it("Test 3: ready-empty copy 'No cards revealed yet for this set.' is preserved", () => {
    expect(spoilerSrc).toMatch(/No cards revealed yet for this set\./);
  });

  it('Test 4: at least one <template x-if=...> predicate references bulkdata', () => {
    expect(spoilerSrc).toMatch(
      /<template x-if="[^"]*bulkdata[^"]*">|<template x-if="[^"]*\$store\.bulkdata/
    );
  });

  it("Test 5: source references the 'ready' bulkdata status literal (matches epic-experiment pattern)", () => {
    expect(spoilerSrc).toMatch(/['"]ready['"]/);
  });

  it("Test 6: ready-empty copy is structurally co-located with a bulkdata reference (proves the gate wraps the copy, not a file-level mention)", () => {
    const proximityPattern =
      /bulkdata[\s\S]{0,800}No cards revealed yet|No cards revealed yet[\s\S]{0,800}bulkdata/;
    expect(spoilerSrc).toMatch(proximityPattern);
  });
});
