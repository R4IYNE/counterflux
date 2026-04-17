/**
 * @vitest-environment jsdom
 *
 * Phase 09 Plan 2 — floating-toolbar Fullscreen API wiring (GAME-05).
 *
 * Per RESEARCH headline #4: the existing $store.app.gameFullscreen is a dead
 * boolean nothing reads. This test locks the contract that the fullscreen
 * button calls Element.requestFullscreen() / document.exitFullscreen()
 * synchronously from the click handler (P-2 user-gesture requirement) and
 * subscribes to fullscreenchange so the icon glyph swaps in sync.
 *
 * State preservation across fullscreenchange is verified by the manual UAT
 * walk per D-00 — the structural argument is that targeting
 * document.documentElement keeps the DOM tree intact, so Alpine state
 * survives automatically.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('alpinejs', () => ({
  default: {
    store: vi.fn((name) => {
      if (name === 'game') return {
        view: 'active', currentTurn: 1, timerRunning: false, timerSeconds: 0, players: [],
        nextTurn: vi.fn(), pauseTimer: vi.fn(), startTimer: vi.fn(), endGame: vi.fn(),
      };
      if (name === 'app') return { gameFullscreen: false };
      return null;
    }),
    effect: vi.fn(),
    data: vi.fn(),
  },
}));

import { renderFloatingToolbar } from '../src/components/floating-toolbar.js';

describe('floating-toolbar GAME-05 (Fullscreen API wiring)', () => {
  let requestFullscreenSpy, exitFullscreenSpy;

  beforeEach(() => {
    document.body.innerHTML = `<div id="container">${renderFloatingToolbar()}</div>`;
    requestFullscreenSpy = vi.fn().mockResolvedValue(undefined);
    exitFullscreenSpy = vi.fn().mockResolvedValue(undefined);
    document.documentElement.requestFullscreen = requestFullscreenSpy;
    document.exitFullscreen = exitFullscreenSpy;
    Object.defineProperty(document, 'fullscreenElement', { value: null, writable: true, configurable: true });
  });

  afterEach(() => {
    delete document.documentElement.requestFullscreen;
    delete document.exitFullscreen;
  });

  it('contains an @click handler that calls requestFullscreen synchronously (P-2)', () => {
    const html = document.getElementById('container').innerHTML;
    // The click handler must call requestFullscreen() inline,
    // not via a setTimeout / Promise / Alpine state mutation reaction.
    expect(html).toContain('document.documentElement.requestFullscreen()');
    expect(html).toContain('document.exitFullscreen()');
  });

  it('button glyph swaps via x-data isFullscreen + fullscreenchange listener', () => {
    const html = document.getElementById('container').innerHTML;
    expect(html).toContain('isFullscreen: false');
    expect(html).toContain('fullscreenchange');
    expect(html).toContain("isFullscreen ? 'fullscreen_exit' : 'fullscreen'");
  });

  it('does NOT mutate $store.app.gameFullscreen (the dead store boolean is gone)', () => {
    const html = document.getElementById('container').innerHTML;
    expect(html).not.toContain('$store.app.gameFullscreen = !');
    expect(html).not.toContain("$store.app.gameFullscreen ? 'fullscreen_exit'");
  });

  it('End Game button exits fullscreen cleanly', () => {
    const html = document.getElementById('container').innerHTML;
    expect(html).toContain('if (document.fullscreenElement) document.exitFullscreen()');
  });
});
