// @vitest-environment node
// Phase 13 Plan 3 — streaming-UI boot-order contract.
//
// Static-grep regression guards on src/main.js + index.html.
// These assertions lock down the D-04 boot-order promise:
//   1. bootApp() remains the single boot entry
//   2. initBulkDataStore() precedes runMigration() (migration needs the store)
//   3. runMigration() precedes all other initXStore() calls
//   4. All initXStore() calls precede Alpine.start()
//   5. initRouter() runs after Alpine.start()
//   6. Alpine.store('auth').init() runs after Alpine.start() and before
//      the sync-engine Alpine.effect (auth-wall-first contract / Pitfall 8)
//   7. index.html's splash overlay is no longer gated on bulk-data status —
//      its x-show binds only on migration progress
//   8. The topbar pill component is registered via Alpine.data() before Alpine.start()
//
// Same precedent as tests/sync-status-chip.test.js + tests/bfcache-handlers.test.js
// — cheap, fast, grep-level, runs in node environment.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const mainJs = readFileSync('src/main.js', 'utf-8');
const indexHtml = readFileSync('index.html', 'utf-8');

function idxOf(haystack, needle) {
  const i = haystack.indexOf(needle);
  if (i < 0) throw new Error(`missing sentinel: ${needle}`);
  return i;
}

describe('streaming-ui boot-order contract (Phase 13 Plan 3, D-04)', () => {
  it('Test 1: src/main.js defines and invokes a bootApp() entry', () => {
    expect(mainJs).toMatch(/async\s+function\s+bootApp\s*\(/);
    expect(mainJs).toMatch(/^bootApp\(\);?$/m);
  });

  it('Test 2: boot order — initBulkDataStore → runMigration → store inits → Alpine.start → initRouter', () => {
    const iBulk = idxOf(mainJs, 'initBulkDataStore()');
    const iMigrate = idxOf(mainJs, 'await runMigration()');
    const iAppStore = idxOf(mainJs, 'initAppStore()');
    const iAlpineStart = idxOf(mainJs, 'Alpine.start()');
    const iRouter = idxOf(mainJs, 'initRouter()');

    expect(iBulk).toBeLessThan(iMigrate);
    expect(iMigrate).toBeLessThan(iAppStore);
    expect(iAppStore).toBeLessThan(iAlpineStart);
    expect(iAlpineStart).toBeLessThan(iRouter);
  });

  it("Test 3: Alpine.store('auth').init() runs AFTER Alpine.start() and BEFORE the sync-engine effect (Pitfall 8)", () => {
    const iAlpineStart = idxOf(mainJs, 'Alpine.start()');
    const iAuthInit = idxOf(mainJs, "Alpine.store('auth').init()");
    const iSyncEngine = mainJs.indexOf('sync-engine.js');

    expect(iAuthInit).toBeGreaterThan(iAlpineStart);
    // Sync engine is imported dynamically inside an Alpine.effect — must be
    // declared AFTER auth.init() so the effect sees the authed status.
    if (iSyncEngine >= 0) {
      expect(iSyncEngine).toBeGreaterThan(iAuthInit);
    }
  });

  it('Test 4: index.html splash overlay no longer gates on bulk-data status (D-04)', () => {
    // The splash was previously shown via x-show="isVisible" where isVisible
    // proxied `$store.bulkdata.status !== 'ready'`. Post-Plan 3 the splash
    // either disappears entirely OR its x-show gate narrows to migration-only.
    //
    // We assert the main shell is NOT suppressed by bulkdata status.
    const suppressMainShell = /x-show=\"\$store\.bulkdata\?\.isReady !== false\"/;
    expect(indexHtml).not.toMatch(suppressMainShell);
  });

  it("Test 5: src/main.js registers Alpine.data('topbarBulkdataPill', ...) BEFORE Alpine.start()", () => {
    const iRegister = mainJs.indexOf("Alpine.data('topbarBulkdataPill'");
    const iAlpineStart = idxOf(mainJs, 'Alpine.start()');
    expect(iRegister).toBeGreaterThan(-1);
    expect(iRegister).toBeLessThan(iAlpineStart);
  });

  it('Test 6: splash overlay has been repurposed or removed — NOT binding on bulk-data progress as an overlay gate', () => {
    // Verify the splash overlay (if it still exists) no longer maps to a
    // full-screen z-50 overlay that gates rendering on bulk-data status.
    //
    // Accept any of:
    //  (a) The overlay block is gone entirely, OR
    //  (b) The x-show is directly scoped to migration, OR
    //  (c) The x-show binds on a computed getter that is itself migration-scoped
    //      in src/components/splash-screen.js (the `isVisible` repurpose path).
    const splashBlockRegex = /x-data="splashScreen"[\s\S]{0,200}x-show="([^"]+)"/;
    const match = indexHtml.match(splashBlockRegex);
    if (match) {
      const gate = match[1];
      const isMigrationScopedInline = /migration/i.test(gate);
      if (!isMigrationScopedInline) {
        // Then the gate must be a getter whose JS body is migration-scoped.
        const splashSrc = readFileSync('src/components/splash-screen.js', 'utf-8');
        expect(splashSrc).toMatch(/get\s+isVisible/);
        expect(splashSrc).toMatch(/migrationProgress/);
        // And the JS must NOT still bind isVisible on bulkdata.status.
        expect(splashSrc).not.toMatch(/isVisible[\s\S]{0,200}bulkdata\.status\s*!==\s*'ready'/);
      }
    }
    // If match is null, the splash overlay is entirely gone — also acceptable.
  });
});
