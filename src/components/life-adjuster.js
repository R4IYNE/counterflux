/**
 * Life Adjuster -- long-press acceleration for +/- buttons.
 * Imperatively attaches pointer event listeners to a button element.
 */

import { getIncrement } from '../utils/game-stats.js';

/**
 * Set up long-press acceleration on a button.
 * On pointerdown: fires callback(1) immediately, then after 400ms begins
 * repeating at 200ms intervals with acceleration (1 -> 5 -> 10 based on hold duration).
 *
 * @param {HTMLElement} button - The button element to attach events to
 * @param {(amount: number) => void} callback - Called with the increment value
 * @returns {() => void} Cleanup function to remove all event listeners
 */
export function setupLongPress(button, callback) {
  let startTime = 0;
  let repeatTimeout = null;
  let repeatInterval = null;

  // Prevent browser scroll/pan on mobile
  button.style.touchAction = 'none';

  function startRepeat() {
    repeatInterval = setInterval(() => {
      const heldMs = Date.now() - startTime;
      const amount = getIncrement(heldMs);
      callback(amount);
    }, 200);
  }

  function onPointerDown(e) {
    e.preventDefault();
    startTime = Date.now();
    // Immediate single increment
    callback(1);
    // After 400ms, begin repeating
    repeatTimeout = setTimeout(() => {
      startRepeat();
    }, 400);
  }

  function onPointerUp() {
    if (repeatTimeout) {
      clearTimeout(repeatTimeout);
      repeatTimeout = null;
    }
    if (repeatInterval) {
      clearInterval(repeatInterval);
      repeatInterval = null;
    }
  }

  button.addEventListener('pointerdown', onPointerDown);
  button.addEventListener('pointerup', onPointerUp);
  button.addEventListener('pointerleave', onPointerUp);
  button.addEventListener('pointercancel', onPointerUp);

  // Return cleanup function
  return () => {
    button.removeEventListener('pointerdown', onPointerDown);
    button.removeEventListener('pointerup', onPointerUp);
    button.removeEventListener('pointerleave', onPointerUp);
    button.removeEventListener('pointercancel', onPointerUp);
    onPointerUp(); // Clear any running timers
  };
}
