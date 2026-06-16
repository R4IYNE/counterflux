import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { splashScreen, FLAVOUR_TEXTS } from '../src/components/splash-screen.js';

describe('splash screen (POLISH-01, D-17a)', () => {
  beforeEach(() => {
    // Provide a minimal global Alpine shim so component init() can safely introspect stores
    globalThis.Alpine = { store: vi.fn(() => ({ migrationProgress: null })) };
  });

  it('FLAVOUR_TEXTS entries are { quote, attribution } objects', () => {
    expect(Array.isArray(FLAVOUR_TEXTS)).toBe(true);
    expect(FLAVOUR_TEXTS.length).toBeGreaterThanOrEqual(5);
    for (const entry of FLAVOUR_TEXTS) {
      expect(typeof entry.quote).toBe('string');
      expect(typeof entry.attribution).toBe('string');
      expect(entry.quote.length).toBeGreaterThan(0);
      expect(entry.attribution.length).toBeGreaterThan(0);
    }
  });

  it('component exposes flavourText as an object with quote and attribution', () => {
    const cmp = splashScreen();
    expect(typeof cmp.flavourText.quote).toBe('string');
    expect(typeof cmp.flavourText.attribution).toBe('string');
  });

  it('flavour data contains no "--" separators inline', () => {
    for (const entry of FLAVOUR_TEXTS) {
      expect(entry.quote).not.toMatch(/--/);
      expect(entry.attribution).not.toMatch(/--/);
      // Em-dashes should be template-rendered, not in the data
      expect(entry.quote).not.toMatch(/—/);
      expect(entry.attribution).not.toMatch(/^—/);
    }
  });

  it('exposes migrationProgress accessor (D-17a hook)', () => {
    const cmp = splashScreen();
    expect('migrationProgress' in cmp).toBe(true);
    // Should be readable without throwing
    const v = cmp.migrationProgress;
    // Null or a number until Plan 3 populates the store
    expect(v === null || typeof v === 'number').toBe(true);
  });

  it('source references migrationProgress (D-17a hook present in file)', () => {
    const src = readFileSync('src/components/splash-screen.js', 'utf-8');
    expect(src).toMatch(/migrationProgress/);
  });
});

describe('splashScreen boot loading', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function make(store) {
    const o = splashScreen();
    o.$store = store;
    o.$watch = () => {}; // no reactive watcher in the test harness
    return o;
  }

  it('cached/instant: ready at init fades after the ~2.5s minimum', () => {
    const o = make({ bulkdata: { status: 'ready', progress: 100, migrationProgress: null } });
    o.init();
    expect(o.isVisible).toBe(true);
    vi.advanceTimersByTime(2500);          // min elapses; ready polled in
    vi.advanceTimersByTime(400);           // _maybeFinish schedules the fade 350ms later
    expect(o.fadingOut).toBe(true);
    expect(o.isVisible).toBe(false);
    expect(o.barProgress).toBe(100);
    o.destroy();
  });

  it('stays up through a long download, then fades once status flips to ready', () => {
    const o = make({ bulkdata: { status: 'downloading', progress: 42, migrationProgress: null } });
    o.init();
    vi.advanceTimersByTime(2500);
    expect(o.fadingOut).toBe(false);       // still downloading → still visible
    expect(o.barProgress).toBeGreaterThanOrEqual(42); // real progress reflected
    // archive finishes loading
    o.$store.bulkdata.status = 'ready';
    o.$store.bulkdata.progress = 100;
    vi.advanceTimersByTime(300);           // a poll tick sees ready
    vi.advanceTimersByTime(400);           // fade scheduled
    expect(o.fadingOut).toBe(true);
    o.destroy();
  });

  it('stall safety: a download that never advances releases after ~40s', () => {
    const o = make({ bulkdata: { status: 'downloading', progress: 30, migrationProgress: null } });
    o.init();
    vi.advanceTimersByTime(2500);
    expect(o.fadingOut).toBe(false);       // not yet — within the stall window
    vi.advanceTimersByTime(41000);         // 40s+ with no progress advance
    vi.advanceTimersByTime(400);           // fade scheduled
    expect(o.fadingOut).toBe(true);
    o.destroy();
  });

  it('error does not trap: status error at init fades after the minimum', () => {
    const o = make({ bulkdata: { status: 'error', migrationProgress: null } });
    o.init();
    vi.advanceTimersByTime(2500);
    vi.advanceTimersByTime(400);
    expect(o.fadingOut).toBe(true);
    o.destroy();
  });

  it('uses migration copy when a migration is mid-flight', () => {
    const o = make({ bulkdata: { status: 'idle', migrationProgress: 40 } });
    o.init();
    expect(o.isMigrationView).toBe(true);
    expect(o.headingText).toMatch(/Upgrading/);
    expect(o.barProgress).toBe(40);
    o.destroy();
  });
});
