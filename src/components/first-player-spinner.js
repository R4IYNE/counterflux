/**
 * GAME-07 — Slot-machine first-player spinner.
 *
 * Per RESEARCH §5: 2400ms total, ease-out-expo deceleration via RAF.
 * Per RESEARCH §P-7: aria-live="off" during animation; final result swaps to
 *   aria-live="polite" so screen readers announce only the winner, not every
 *   intermediate cycled name.
 * Per CONTEXT D-15 + specifics: prefers-reduced-motion: reduce skips animation
 *   entirely and reveals the result instantly.
 *
 * @param {string[]} playerNames - Display names in player order
 * @returns {Promise<number>} winnerIndex (0..playerNames.length-1)
 */
export function spinForFirstPlayer(playerNames) {
  if (!Array.isArray(playerNames) || playerNames.length === 0) {
    return Promise.resolve(0);
  }

  const winnerIndex = Math.floor(Math.random() * playerNames.length);

  // Reduced-motion bypass — no animation, instant result, but still announce.
  const reduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion) {
    // Brief announce-only overlay so screen readers + sighted users see the result.
    if (typeof document !== 'undefined') {
      const announce = document.createElement('div');
      announce.className = 'cf-first-player-spinner';
      announce.setAttribute('role', 'status');
      announce.setAttribute('aria-live', 'polite');
      announce.textContent = playerNames[winnerIndex];
      document.body.appendChild(announce);
      setTimeout(() => announce.remove(), 1200);
    }
    return Promise.resolve(winnerIndex);
  }

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'cf-first-player-spinner';
    // aria-live=off during animation (per P-7); flipped to polite at settle.
    overlay.setAttribute('aria-live', 'off');
    document.body.appendChild(overlay);

    const totalMs = 2400;
    const cycles = 8 + winnerIndex; // ensure final stop = winnerIndex modulo length
    const startTime =
      typeof performance !== 'undefined' ? performance.now() : Date.now();

    function frame(now) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / totalMs, 1);
      // ease-out-expo (cubic-bezier(0.16, 1, 0.3, 1) approximation)
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      const progress = eased * cycles;
      const visibleIndex = Math.floor(progress) % playerNames.length;
      overlay.textContent = playerNames[visibleIndex];

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        // Final settle: lock to winner, swap aria-live to polite, brief pause
        overlay.textContent = playerNames[winnerIndex];
        overlay.setAttribute('aria-live', 'polite');
        overlay.setAttribute('role', 'status');
        setTimeout(() => {
          overlay.remove();
          resolve(winnerIndex);
        }, 600);
      }
    }
    requestAnimationFrame(frame);
  });
}
