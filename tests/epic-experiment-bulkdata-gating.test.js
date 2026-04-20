// @vitest-environment node
// Phase 13 Plan 3 — Task 5b: Epic Experiment dashboard bulk-data gating.
//
// The user smoke-test after Task 3 (D-04 streaming UI) caught a regression
// the plan had not anticipated: with the splash gate removed, the dashboard
// renders its Quick Add form and "No Decks Yet" CTA immediately — but those
// controls silently depend on bulk data. Typing into Quick Add does nothing
// (autocomplete needs `db.cards`), and "Head to Thousand-Year Storm and
// initialize your first ritual" sends the user to a screen that then shows
// a `Bulk data loading…` placeholder.
//
// This suite locks down the "honest empty state" contract: every interactive
// control or CTA on Epic Experiment must reflect `$store.bulkdata.status`.
// When not ready: disabled + dimmed + swapped copy. When ready: normal UX.
//
// Pattern: source-level static grep (matches db-cards-empty-guard.test.js
// and streaming-ui.test.js). Epic Experiment is imperative-DOM construction,
// not Alpine templates, so jsdom instantiation would require mocking the
// full collection/deck/market stores + activity service + sparkline for
// each assertion. The source-level contract is cheaper and more durable.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const epicSrc = readFileSync('src/screens/epic-experiment.js', 'utf-8');

describe('Epic Experiment bulk-data gating (Phase 13 Plan 3, Task 5b)', () => {
  it("Test 1: Quick Add input is disabled when $store.bulkdata.status !== 'ready'", () => {
    // The Quick Add input must either set .disabled = true OR add a
    // `disabled` attribute when the bulkdata store is not ready.
    // Sentinel: a bulkdata-aware update function that touches input.disabled.
    expect(epicSrc).toMatch(/bulkdata/);
    expect(epicSrc).toMatch(/input\.disabled\s*=/);
  });

  it("Test 2: Quick Add shows 'ARCHIVE LOADING' helper copy when bulk data not ready", () => {
    // Placeholder swap: ARCHIVE LOADING replaces '4X LIGHTNING BOLT [2XM]'
    // while bulkdata is downloading/parsing.
    expect(epicSrc).toMatch(/ARCHIVE LOADING/i);
  });

  it("Test 3: 'No Cards Yet' empty state swaps copy when bulk data not ready", () => {
    // The existing copy reads 'Add your first card using Quick Add above'.
    // When not ready this is dishonest (Quick Add is disabled), so the
    // source must contain an alternate message referencing the archive
    // download state.
    //
    // Sentinel: an empty-overlay update path reads bulkdata status.
    const emptyOverlayBlock = /emptyOverlay[\s\S]{0,2000}bulkdata|bulkdata[\s\S]{0,2000}emptyOverlay/;
    expect(epicSrc).toMatch(emptyOverlayBlock);
    // Honest copy mentions the archive is loading/downloading/indexing.
    expect(epicSrc).toMatch(/archive[\s\S]{0,40}(?:loading|downloading|indexing|not ready)/i);
  });

  it("Test 4: 'No Decks Yet' CTA is gated on bulk-data readiness", () => {
    // The existing CTA reads 'Head to Thousand-Year Storm and initialize
    // your first ritual.' That's dead-end while bulk data is loading
    // (Thousand-Year Storm card-search will show its own 'Bulk data loading'
    // skeleton).
    //
    // The source must branch on bulkdata status when building the
    // No Decks Yet empty state.
    const noDecksBlock = /No Decks Yet[\s\S]{0,500}bulkdata|bulkdata[\s\S]{0,500}No Decks Yet/;
    expect(epicSrc).toMatch(noDecksBlock);
  });

  it("Test 5: commander art thumbnails guard db.cards.get() on bulk-data readiness — no broken <img> during download", () => {
    // When bulkdata.status !== 'ready', db.cards.get(deck.commander_id)
    // returns undefined → artUrl is undefined → <img src="undefined">
    // renders as a broken image box. The fix: skip the db.cards lookup
    // entirely when bulkdata is not ready (fall through to the gradient
    // placeholder).
    //
    // Sentinel: the commander-art branch reads bulkdata.status before
    // calling db.cards.get or constructing the <img>.
    const commanderArtBlock =
      /commander_id[\s\S]{0,200}bulkdata|bulkdata[\s\S]{0,200}commander_id/;
    expect(epicSrc).toMatch(commanderArtBlock);
  });

  it("Test 6: a shared helper reads $store.bulkdata.status with a safe 'ready' default", () => {
    // Gating logic should live in one place so the Quick Add,
    // empty-overlay, deck-tile, and deck-grid branches stay in sync.
    //
    // Contract: a function (any name) pulls Alpine.store('bulkdata')?.status
    // and defaults to 'ready' when the store is unavailable (test env /
    // pre-Alpine.start walk).
    expect(epicSrc).toMatch(
      /Alpine\.store\(\s*['"]bulkdata['"]\s*\)[\s\S]{0,80}status/
    );
    // Safe default sentinel — `?? 'ready'` or equivalent.
    expect(epicSrc).toMatch(/['"]ready['"]/);
  });

  it("Test 7: gating refreshes reactively — uses Alpine.effect keyed on bulkdata.status", () => {
    // Without an Alpine.effect subscription, the Quick Add stays disabled
    // forever even after the download completes. The source must subscribe
    // to bulkdata.status.
    //
    // Sentinel: an Alpine.effect touches $store.bulkdata or
    // Alpine.store('bulkdata').status alongside the existing updatePortfolio /
    // updateDeckGrid effects.
    const effectTouchesBulkdata =
      /Alpine\.effect\([\s\S]{0,400}bulkdata[\s\S]{0,400}status/;
    expect(epicSrc).toMatch(effectTouchesBulkdata);
  });
});
