// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('src/services/bfcache.js — D-09 bfcache handlers', () => {
  let dbMock;
  let bindBfcacheHandlers;
  let addEventListenerSpy;

  beforeEach(async () => {
    vi.resetModules();
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    // Mock the db singleton BEFORE importing bfcache.js
    dbMock = {
      close: vi.fn(),
      open: vi.fn(() => Promise.resolve()),
      isOpen: vi.fn(() => true),
    };
    vi.doMock('../src/db/schema.js', () => ({ db: dbMock }));

    ({ bindBfcacheHandlers } = await import('../src/services/bfcache.js'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock('../src/db/schema.js');
  });

  it('Test 1: is idempotent — duplicate calls register listeners exactly once', () => {
    bindBfcacheHandlers();
    bindBfcacheHandlers();
    bindBfcacheHandlers();
    const pagehideCalls = addEventListenerSpy.mock.calls.filter(c => c[0] === 'pagehide').length;
    const pageshowCalls = addEventListenerSpy.mock.calls.filter(c => c[0] === 'pageshow').length;
    expect(pagehideCalls).toBe(1);
    expect(pageshowCalls).toBe(1);
  });

  it('Test 2: pagehide with persisted=true triggers db.close()', () => {
    bindBfcacheHandlers();
    const evt = new Event('pagehide');
    Object.defineProperty(evt, 'persisted', { value: true });
    window.dispatchEvent(evt);
    expect(dbMock.close).toHaveBeenCalledTimes(1);
  });

  it('Test 3: pagehide with persisted=false does NOT trigger db.close()', () => {
    bindBfcacheHandlers();
    const evt = new Event('pagehide');
    Object.defineProperty(evt, 'persisted', { value: false });
    window.dispatchEvent(evt);
    expect(dbMock.close).not.toHaveBeenCalled();
  });

  it('Test 4: pageshow with persisted=true AND db.isOpen()=false triggers db.open()', async () => {
    dbMock.isOpen.mockReturnValue(false);
    bindBfcacheHandlers();
    const evt = new Event('pageshow');
    Object.defineProperty(evt, 'persisted', { value: true });
    window.dispatchEvent(evt);
    expect(dbMock.open).toHaveBeenCalledTimes(1);
  });

  it('Test 5: pageshow with persisted=true but db.isOpen()=true does NOT call db.open()', () => {
    dbMock.isOpen.mockReturnValue(true);
    bindBfcacheHandlers();
    const evt = new Event('pageshow');
    Object.defineProperty(evt, 'persisted', { value: true });
    window.dispatchEvent(evt);
    expect(dbMock.open).not.toHaveBeenCalled();
  });

  it('Test 6: pageshow with persisted=false (normal navigation) does NOT call db.open()', () => {
    dbMock.isOpen.mockReturnValue(false);
    bindBfcacheHandlers();
    const evt = new Event('pageshow');
    Object.defineProperty(evt, 'persisted', { value: false });
    window.dispatchEvent(evt);
    expect(dbMock.open).not.toHaveBeenCalled();
  });
});
