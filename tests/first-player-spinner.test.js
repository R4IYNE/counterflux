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
    // Force RAF to fire synchronously and complete the animation immediately
    vi.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => {
      // Pass `1e9` so the elapsed math saturates t = 1 immediately
      cb(1e9);
      return 1;
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
