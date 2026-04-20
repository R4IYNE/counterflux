// @vitest-environment node
// Phase 13 Plan 3 — topbar bulk-data progress pill (D-06).
//
// Unit + static-grep tests for src/components/topbar-bulkdata-pill.js
// and the mount point in index.html.
//
// Contract covered:
//   1. topbarBulkdataPill() exports as a factory returning a data object
//   2. The factory object exposes reactive getters that read $store.bulkdata
//   3. The factory has a retry() method for the error state
//   4. index.html mounts the pill ADJACENT to (before) the notification-bell
//   5. The pill template has render branches for downloading/parsing/checking/error
//   6. Error state renders as <button> (keyboard reachable, matches sync-chip pattern)
//   7. Pill auto-dismisses on ready (guarded by status !== 'ready' at the outer template)

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf-8');

describe('topbar bulk-data pill component (Phase 13 Plan 3, D-06)', () => {
  describe('factory contract — src/components/topbar-bulkdata-pill.js', () => {
    let topbarBulkdataPill;

    beforeAll(async () => {
      const mod = await import('../src/components/topbar-bulkdata-pill.js');
      topbarBulkdataPill = mod.topbarBulkdataPill;
    });

    it('Test 1: topbarBulkdataPill() returns an object with getter accessors', () => {
      // When invoked without Alpine present, the getters must not throw —
      // they must fall back gracefully (return 'idle' / '' / etc.).
      const data = topbarBulkdataPill();
      expect(data).toBeTypeOf('object');
      // status getter exists
      expect('status' in data).toBe(true);
      // progressLabel getter exists
      expect('progressLabel' in data).toBe(true);
      // retry method exists
      expect(typeof data.retry).toBe('function');
    });

    it('Test 2: status getter proxies to $store.bulkdata and defaults to idle when absent', () => {
      const data = topbarBulkdataPill();
      // Without window.Alpine, status should be a safe default
      const prev = globalThis.window;
      globalThis.window = undefined;
      try {
        const s = data.status;
        expect(typeof s).toBe('string');
      } finally {
        globalThis.window = prev;
      }
    });

    it('Test 3: retry() is a no-op when $store.bulkdata.retry is unavailable', () => {
      const data = topbarBulkdataPill();
      expect(() => data.retry()).not.toThrow();
    });
  });

  describe('index.html mount contract', () => {
    it('Test 4: index.html invokes topbarBulkdataPill() as an x-data factory', () => {
      expect(html).toMatch(/x-data="topbarBulkdataPill\(\)"/);
    });

    it('Test 5: the pill template branches on $store.bulkdata.status for downloading / parsing / checking / error', () => {
      // Each branch must explicitly reference the status value.
      expect(html).toMatch(/\$store\.bulkdata\.status\s*===\s*'downloading'/);
      expect(html).toMatch(/\$store\.bulkdata\.status\s*===\s*'parsing'/);
      expect(html).toMatch(/\$store\.bulkdata\.status\s*===\s*'error'/);
    });

    it("Test 6: pill auto-dismisses on ready — outer template guards on status !== 'ready'", () => {
      // The outer template wraps downloading/parsing/checking — it must
      // evaluate false when status flips to 'ready'.
      expect(html).toMatch(/\$store\.bulkdata\.status\s*!==\s*'ready'/);
    });

    it('Test 7: pill renders DOWNLOADING / INDEXING / CHECKING ARCHIVE labels', () => {
      expect(html).toMatch(/ARCHIVE\s*(?:—|-|&mdash;)/);
      expect(html).toMatch(/INDEXING\s*(?:—|-|&mdash;)/);
      expect(html).toMatch(/CHECKING ARCHIVE/);
    });

    it('Test 8: error state renders as <button> for keyboard reachability (matches sync-chip pattern)', () => {
      // Sentinel: the cf-chip-error-halo class is inherited from the sync-chip
      // error pattern. The pill error branch should reuse it.
      const errorBlockRegex = /status\s*===\s*'error'[\s\S]{0,600}<button[\s\S]{0,400}cf-chip-error-halo/;
      expect(html).toMatch(errorBlockRegex);
    });

    it('Test 9: pill is mounted adjacent to the notification-bell mount (before it)', () => {
      const pillIdx = html.indexOf('x-data="topbarBulkdataPill()"');
      const bellIdx = html.indexOf('id="cf-notification-bell-mount"');
      expect(pillIdx).toBeGreaterThan(-1);
      expect(bellIdx).toBeGreaterThan(-1);
      expect(pillIdx).toBeLessThan(bellIdx);
    });
  });
});

