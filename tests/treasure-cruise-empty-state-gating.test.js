// @vitest-environment node
// Phase 13 Plan 3 — Task 5c: Treasure Cruise Mila empty-state bulk-data gating.
//
// Second-round user smoke test after Task 5b caught that the "No Treasures
// Catalogued" Mila empty state on Treasure Cruise renders three CTAs —
// ADD CARD, MASS ENTRY, IMPORT CSV — all of which internally depend on
// `db.cards` for name resolution. During the 5-minute bulk-data download,
// these CTAs appear actionable but silently fail (autocomplete returns
// empty results, mass-entry parseBatchLine can't resolve names, CSV import
// can't map rows).
//
// Body copy is also dishonest:
//   'Mila here! Your collection is empty. Add cards one at a time, paste a
//   batch into the Mass Entry Terminal, or import a CSV...'
//
// Contract: when `$store.bulkdata.status !== 'ready'`, the empty state must
// surface alternate copy clarifying that card entry tools unlock when the
// archive finishes indexing. When ready, original actionable copy returns.
//
// Pattern: source-level static grep (mirrors
// epic-experiment-bulkdata-gating.test.js — the screen uses innerHTML
// template strings with Alpine directives, so source-level assertions are
// the cheapest durable check).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const tcSrc = readFileSync('src/screens/treasure-cruise.js', 'utf-8');

describe('Treasure Cruise empty-state bulk-data gating (Phase 13 Plan 3, Task 5c)', () => {
  it("Test 1: 'No Treasures Catalogued' empty state body reads bulkdata status", () => {
    // The <template x-if="$store.collection.entries.length === 0 ...">
    // block must branch on $store.bulkdata.status somewhere in its body
    // copy / CTA gating. Sentinel: bulkdata appears inside a 2000-char
    // window of the 'No Treasures Catalogued' heading.
    const emptyStateBlock =
      /No Treasures Catalogued[\s\S]{0,2000}bulkdata|bulkdata[\s\S]{0,2000}No Treasures Catalogued/;
    expect(tcSrc).toMatch(emptyStateBlock);
  });

  it("Test 2: body copy swaps to honest 'archive still loading' message when bulk data not ready", () => {
    // Honest-copy sentinel — mentions the archive is still loading /
    // indexing / downloading in the Mila empty state body.
    expect(tcSrc).toMatch(
      /archive[\s\S]{0,80}(?:still loading|indexing|downloading|not ready|finishes)/i
    );
  });

  it("Test 3: original 'Your collection is empty' copy preserved for the ready branch", () => {
    // When bulkdata.status === 'ready', the original actionable copy
    // remains. Must still be reachable in source.
    expect(tcSrc).toMatch(/Your collection is empty/i);
  });

  it("Test 4: ADD CARD / MASS ENTRY / IMPORT CSV buttons are gated or dimmed when bulk data not ready", () => {
    // The three CTAs internally depend on db.cards. When bulkdata isn't
    // ready, each must be either disabled, dimmed via opacity, or hidden
    // behind the honest-loading branch.
    //
    // Sentinel: at least one of the buttons has a :disabled, x-show, or
    // :class binding that references $store.bulkdata.
    const gatedButton =
      /(?::disabled|x-show|:class)=["'][^"']*bulkdata[^"']*["']/;
    expect(tcSrc).toMatch(gatedButton);
  });
});
