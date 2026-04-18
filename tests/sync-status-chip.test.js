// tests/sync-status-chip.test.js
// Phase 11 Plan 2 — topbar sync-status chip DOM contract tests (SYNC-07, D-08).
//
// Static audit of the chip template in index.html. We don't instantiate Alpine
// in node (heavy, no jsdom); instead we grep for the bindings and assert the
// template declares the right glyphs, labels, and handlers per UI-SPEC §Component
// Anatomy 1.
//
// Covers:
//   1. Each of the 4 states has a render branch gated on $store.sync.status
//   2. Glyphs: check (synced), progress_activity (syncing), cloud_off (offline), error (error)
//   3. Labels: SYNCED, SYNCING…, OFFLINE, SYNC ERROR
//   4. Error state renders a <button> with @click → openSyncErrorsModal
//   5. Non-error states render <div role="status"> (aria-live)
//   6. Tooltip binding uses $store.sync.getTooltip()

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf-8');

// Isolate the topbar chip region (between the x-show'd chip template block
// and its closing </template> / </div>). We grep for the sentinel that both
// the old and new chip cannot avoid: the opening of the right-section flex.
function extractChipRegion() {
  // The chip lives inside "<!-- Right section -->" then the first <div class="flex items-center gap-md">.
  const rightStart = html.indexOf('<!-- Right section -->');
  if (rightStart < 0) throw new Error('Right section sentinel not found');
  // End at the next <button ... aria-label="Notifications"> which is the first element after the chip.
  const notifStart = html.indexOf('aria-label="Notifications"', rightStart);
  if (notifStart < 0) throw new Error('Notifications anchor not found');
  return html.slice(rightStart, notifStart);
}

describe('sync-status chip DOM binding (SYNC-07, D-08)', () => {
  test('chip template binds to $store.sync.status', () => {
    const region = extractChipRegion();
    // At least 4 references to $store.sync.status (one per state branch)
    const matches = region.match(/\$store\.sync\.status/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(4);
  });

  test('synced branch uses check glyph + SYNCED label', () => {
    const region = extractChipRegion();
    expect(region).toMatch(/\$store\.sync\.status\s*===\s*['"]synced['"]/);
    expect(region).toMatch(/>check</);
    expect(region).toMatch(/SYNCED/);
  });

  test('syncing branch uses progress_activity glyph + SYNCING label', () => {
    const region = extractChipRegion();
    expect(region).toMatch(/\$store\.sync\.status\s*===\s*['"]syncing['"]/);
    expect(region).toMatch(/progress_activity/);
    expect(region).toMatch(/SYNCING/);
  });

  test('offline branch uses cloud_off glyph + OFFLINE label', () => {
    const region = extractChipRegion();
    expect(region).toMatch(/\$store\.sync\.status\s*===\s*['"]offline['"]/);
    expect(region).toMatch(/cloud_off/);
    expect(region).toMatch(/OFFLINE/);
  });

  test('error branch renders a <button> with openSyncErrorsModal click handler', () => {
    const region = extractChipRegion();
    expect(region).toMatch(/\$store\.sync\.status\s*===\s*['"]error['"]/);
    expect(region).toMatch(/>error</);
    expect(region).toMatch(/SYNC ERROR/);
    // Error state renders as <button type="button">
    expect(region).toMatch(/<button[^>]*type=["']button["']/);
    // Click handler wires openSyncErrorsModal
    expect(region).toMatch(/openSyncErrorsModal/);
  });

  test('non-error branches render <div role="status"> with aria-live="polite"', () => {
    const region = extractChipRegion();
    expect(region).toMatch(/role=["']status["']/);
    expect(region).toMatch(/aria-live=["']polite["']/);
  });

  test('tooltip binding uses $store.sync.getTooltip()', () => {
    const region = extractChipRegion();
    expect(region).toMatch(/\$store\.sync\.getTooltip\s*\(\s*\)/);
  });

  test('error halo CSS class is applied in error branch', () => {
    const region = extractChipRegion();
    expect(region).toMatch(/cf-chip-error-halo/);
  });

  test('old v1.0 LIVE/STALE labels are gone from chip region', () => {
    const region = extractChipRegion();
    // Old chip had a bare `'LIVE'` literal + STALE. New chip has neither.
    // Accept the possibility that LIVE appears in class names like cf-live-dot;
    // forbid the bare label literal.
    expect(region).not.toMatch(/>LIVE</);
    expect(region).not.toMatch(/>STALE/);
  });
});
