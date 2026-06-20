// src/utils/focus-trap.js
//
// Shared modal focus-trap (audit M7). Generalised from the reconciliation-modal
// lockdown so every dialog shares ONE correct implementation instead of
// re-deriving Tab cycling per modal. Vanilla (no Alpine x-trap dependency — the
// @alpinejs/focus plugin is not installed), so it works for both imperative-DOM
// and Alpine-template modals.
//
//   const detach = attachFocusTrap(containerEl, { onEscape, initialFocus, restoreFocus });
//   ... later ... detach();
//
//   - Tab / Shift+Tab cycle within the container's LIVE tabbable set (re-queried
//     each keypress, so dynamically added/removed controls are handled).
//   - Escape: if onEscape is given it's called (preventDefault + stopPropagation);
//     if omitted, Escape is swallowed — the lockdown contract (reconciliation /
//     first-sign-in / migration-blocked) where dismissal must be impossible.
//   - initialFocus: element or selector focused on attach; defaults to the first
//     tabbable (falls back to the container itself).
//   - restoreFocus (default true): on detach, returns focus to whatever was
//     focused before attach.
//
// The keydown listener is CAPTURE-phase so it beats app/bubble handlers (route
// changes, other modal-close listeners) — matching the reference's rationale.

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

function _tabbables(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
}

/**
 * Trap keyboard focus within containerEl until the returned detach() is called.
 * @param {HTMLElement} containerEl
 * @param {{ onEscape?: Function, initialFocus?: HTMLElement|string, restoreFocus?: boolean }} [options]
 * @returns {() => void} detach
 */
export function attachFocusTrap(containerEl, { onEscape, initialFocus, restoreFocus = true } = {}) {
  if (!containerEl) return () => {};
  const previouslyFocused = restoreFocus ? document.activeElement : null;

  const onKeydown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (typeof onEscape === 'function') onEscape();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = _tabbables(containerEl);
    if (items.length === 0) { e.preventDefault(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    // Focus escaped the container (or is on the container itself) → pull it back.
    if (!containerEl.contains(active)) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
      return;
    }
    if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', onKeydown, true);

  // Move focus into the dialog. Deferred so the container is fully attached.
  setTimeout(() => {
    let target = null;
    if (initialFocus) {
      target = typeof initialFocus === 'string' ? containerEl.querySelector(initialFocus) : initialFocus;
    }
    if (!target) target = _tabbables(containerEl)[0] || containerEl;
    try { target.focus(); } catch { /* non-fatal */ }
  }, 0);

  let detached = false;
  return function detach() {
    if (detached) return;
    detached = true;
    document.removeEventListener('keydown', onKeydown, true);
    if (restoreFocus && previouslyFocused && typeof previouslyFocused.focus === 'function') {
      try { previouslyFocused.focus(); } catch { /* non-fatal */ }
    }
  };
}

/**
 * Idempotent attach/detach for HTML-string Alpine modals. Call from an x-effect
 * with the modal's reactive visibility flag; the detach handle is stashed on the
 * panel element so re-running the effect (every reactive tick) never stacks
 * traps. Exposed on window.__cf_focusTrap by main.js for use inside x-effect.
 *
 * @param {boolean} visible
 * @param {HTMLElement} panelEl
 * @param {{ onEscape?: Function, initialFocus?: HTMLElement|string, restoreFocus?: boolean }} [opts]
 */
export function syncFocusTrap(visible, panelEl, opts) {
  if (!panelEl) return;
  if (visible && !panelEl.__cfTrapDetach) {
    panelEl.__cfTrapDetach = attachFocusTrap(panelEl, opts || {});
  } else if (!visible && panelEl.__cfTrapDetach) {
    panelEl.__cfTrapDetach();
    panelEl.__cfTrapDetach = null;
  }
}
