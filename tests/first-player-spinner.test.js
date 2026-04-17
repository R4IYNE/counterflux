/**
 * @vitest-environment jsdom
 *
 * Phase 9 Plan 3 Task 2 — GAME-07 first-player spinner.
 * Tests the slot-machine spinner component used during startGame().
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spinForFirstPlayer } from '../src/components/first-player-spinner.js';

describe('spinForFirstPlayer (GAME-07)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    // matchMedia stub default = matches: false (no reduced-motion)
    vi.spyOn(window, 'matchMedia').mockImplementation((q) => ({
      matches: false,
      media: q,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('resolves to a number in [0, playerNames.length) under reduced-motion', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener() {},
      removeEventListener() {},
    });
    const winner = await spinForFirstPlayer(['Alice', 'Bob', 'Carol']);
    expect(typeof winner).toBe('number');
    expect(winner).toBeGreaterThanOrEqual(0);
    expect(winner).toBeLessThan(3);
    // Reduced-motion path: announce overlay was added (and may still be there
    // if the announce timeout hasn't fired yet — both states are valid)
    expect(document.body.innerHTML).toMatch(/cf-first-player-spinner|^$/);
  });

  it('appends and removes .cf-first-player-spinner overlay during animation', async () => {
    // Plan 09-04 Gap 1 fix: spinner now captures startTime INSIDE the first
    // RAF callback, so we need to drive two frames — the first seeds startTime,
    // the second saturates t=1 by passing a timestamp far beyond totalMs.
    let frameCount = 0;
    vi.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => {
      frameCount += 1;
      if (frameCount === 1) {
        cb(0);        // seed startTime = 0
      } else if (frameCount === 2) {
        cb(1e9);      // elapsed ~= 1e9ms => t=1 => settle
      }
      // Further RAFs during settle are ignored; settle uses setTimeout.
      return frameCount;
    });

    const promise = spinForFirstPlayer(['Alice', 'Bob']);
    // Overlay should be in the DOM during the settle pause
    expect(document.querySelector('.cf-first-player-spinner')).toBeTruthy();

    // Advance the 600ms settle timer
    vi.advanceTimersByTime(700);
    const winner = await promise;

    expect(typeof winner).toBe('number');
    expect(winner).toBeGreaterThanOrEqual(0);
    expect(winner).toBeLessThan(2);
    expect(document.querySelector('.cf-first-player-spinner')).toBeNull();
  });

  it('overlay has aria-live attribute (accessibility spec)', () => {
    vi.spyOn(global, 'requestAnimationFrame').mockImplementation((_cb) => {
      // Don't actually advance the animation — leave it pending
      return 1;
    });
    spinForFirstPlayer(['Alice', 'Bob']);
    const overlay = document.querySelector('.cf-first-player-spinner');
    expect(overlay).toBeTruthy();
    expect(overlay.hasAttribute('aria-live')).toBe(true);
  });

  it('handles empty/invalid input gracefully', async () => {
    expect(await spinForFirstPlayer([])).toBe(0);
    expect(await spinForFirstPlayer(null)).toBe(0);
    expect(await spinForFirstPlayer(undefined)).toBe(0);
  });
});

/**
 * Plan 09-04 regression — production animation guards (Gap 1).
 *
 * Plan 09-03's tests used synchronous RAF stubs that fired once with now=1e9,
 * which saturated t=1 on the first frame and therefore never exercised the
 * cycling loop. These regression tests use a MANUAL frame driver so we can
 * assert that the RAF loop continues to schedule itself across multiple
 * frames (the production bug was invisible to the Plan 3 tests).
 *
 * If the loop ever stops firing after a single frame (e.g. a future change
 * to the `if (t < 1)` guard, or a matchMedia false-positive leaking through
 * for reduced-motion detection), these tests will fail.
 */
describe('spinForFirstPlayer (regression — production animation)', () => {
  let queuedRafCallbacks;
  let rafSpy;

  beforeEach(() => {
    document.body.innerHTML = '';
    queuedRafCallbacks = [];
    // Manual frame driver: queue callbacks, advance them via flushRaf(timestamp).
    // Crucially, we do NOT invoke the callback synchronously like Plan 3's tests
    // did — that masked the production bug by saturating t=1 on frame 1.
    rafSpy = vi.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => {
      queuedRafCallbacks.push(cb);
      return queuedRafCallbacks.length;
    });
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener() {},
      removeEventListener() {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function flushRaf(timestamp) {
    const cbs = queuedRafCallbacks.slice();
    queuedRafCallbacks = [];
    cbs.forEach((cb) => cb(timestamp));
  }

  it('calls requestAnimationFrame at least twice during animation (loop must continue)', () => {
    spinForFirstPlayer(['Alice', 'Bob']);
    // Spinner schedules an initial RAF at the bottom of the function
    const initialCalls = rafSpy.mock.calls.length;
    expect(initialCalls).toBeGreaterThanOrEqual(1);

    // Drive the first frame — `t < 1` must cause the loop to schedule another frame
    flushRaf(0);
    const callsAfterFrame1 = rafSpy.mock.calls.length;

    // Drive a second frame partway through the animation (100ms elapsed is
    // far below the 2400ms total, so the loop must still be going)
    flushRaf(100);
    const callsAfterFrame2 = rafSpy.mock.calls.length;

    // The loop must keep scheduling itself until t === 1. If a regression
    // ever makes the loop stop firing after one frame, callsAfterFrame2 will
    // equal callsAfterFrame1 and this test will fail.
    expect(callsAfterFrame1).toBeGreaterThan(initialCalls);
    expect(callsAfterFrame2).toBeGreaterThan(callsAfterFrame1);
  });

  it('overlay textContent is populated during animation (proves cycle is visible)', () => {
    spinForFirstPlayer(['Alice', 'Bob', 'Carol']);

    // After the initial RAF schedules, drive the first frame to populate text
    flushRaf(0);

    const overlay = document.querySelector('.cf-first-player-spinner');
    expect(overlay).toBeTruthy();
    // Overlay must show SOMETHING — empty overlay means the RAF callback
    // never ran or never wrote to textContent.
    expect(overlay.textContent).toBeTruthy();
    expect(['Alice', 'Bob', 'Carol']).toContain(overlay.textContent);

    // Drive another frame — textContent should still be one of the player names
    flushRaf(200);
    expect(['Alice', 'Bob', 'Carol']).toContain(overlay.textContent);
  });

  it('loop does NOT settle on frame 1 even if the first RAF timestamp is already > totalMs (Gap 1 root cause)', () => {
    // Root-cause regression: when Alpine takes a long time to swap templates
    // (view='setup' -> 'active'), the first RAF callback fires with a
    // timestamp that is already > startTime + 2400ms. The original
    // implementation captured startTime BEFORE the RAF schedule, so elapsed
    // could be > totalMs on frame 1 and t would saturate to 1 — instantly
    // triggering settle with no visible animation. The fixed implementation
    // captures startTime INSIDE the first RAF callback, so the animation
    // always runs for a full ~2.4s regardless of how long pre-RAF work took.
    spinForFirstPlayer(['Alice', 'Bob', 'Carol']);

    // Simulate a slow initial frame — RAF fires 10 seconds after spinForFirstPlayer
    // was called (plausible in production if Alpine re-renders a complex view).
    flushRaf(10_000);
    const callsAfterSlowFrame1 = rafSpy.mock.calls.length;

    // Drive a normal frame ~16ms later
    flushRaf(10_016);
    const callsAfterFrame2 = rafSpy.mock.calls.length;

    // If startTime were captured BEFORE the RAF (the old buggy behaviour),
    // frame 1 would see elapsed=10_000ms > totalMs and immediately settle
    // without scheduling another frame. The fixed implementation captures
    // startTime inside frame 1, so callsAfterFrame2 > callsAfterSlowFrame1.
    expect(callsAfterFrame2).toBeGreaterThan(callsAfterSlowFrame1);
  });
});
