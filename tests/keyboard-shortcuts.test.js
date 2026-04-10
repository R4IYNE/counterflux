// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  toggleShortcutModal,
  isShortcutModalOpen,
  closeShortcutModal,
} from '../src/components/shortcut-modal.js';

/**
 * Keyboard shortcut modal unit tests.
 *
 * Tests the shortcut cheat sheet modal (? key) lifecycle:
 * toggle open/close, state query, content verification.
 *
 * UX-02 (Context Menus): The existing context-menu.js pattern uses
 * 'card-context-menu' custom events and is already wired on collection
 * and deck builder screens. The pattern is generalised -- no new code
 * needed for UX-02 coverage. See src/components/context-menu.js.
 */

describe('Shortcut Modal', () => {
  afterEach(() => {
    // Clean up any modal left in the DOM
    closeShortcutModal();
  });

  it('toggleShortcutModal opens the modal', () => {
    toggleShortcutModal();
    const modal = document.querySelector('.fixed.inset-0.z-50');
    expect(modal).not.toBeNull();
  });

  it('isShortcutModalOpen returns true when open', () => {
    toggleShortcutModal();
    expect(isShortcutModalOpen()).toBe(true);
  });

  it('toggleShortcutModal again closes the modal', () => {
    toggleShortcutModal(); // open
    toggleShortcutModal(); // close
    const modal = document.querySelector('.fixed.inset-0.z-50');
    expect(modal).toBeNull();
    expect(isShortcutModalOpen()).toBe(false);
  });

  it('closeShortcutModal removes modal element from DOM', () => {
    toggleShortcutModal(); // open
    closeShortcutModal();
    const modal = document.querySelector('.fixed.inset-0.z-50');
    expect(modal).toBeNull();
    expect(isShortcutModalOpen()).toBe(false);
  });

  it('modal content contains KEYBOARD SHORTCUTS, NAVIGATION, ACTIONS', () => {
    toggleShortcutModal();
    const modal = document.querySelector('.fixed.inset-0.z-50');
    const text = modal.textContent;
    expect(text).toContain('KEYBOARD SHORTCUTS');
    expect(text).toContain('NAVIGATION');
    expect(text).toContain('ACTIONS');
  });

  it('modal contains kbd elements for /, Escape, Ctrl+Z, ?', () => {
    toggleShortcutModal();
    const kbds = document.querySelectorAll('.fixed.inset-0.z-50 kbd');
    const keys = Array.from(kbds).map((el) => el.textContent);
    expect(keys).toContain('/');
    expect(keys).toContain('Escape');
    expect(keys).toContain('Ctrl+Z');
    expect(keys).toContain('?');
  });
});
