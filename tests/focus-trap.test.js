// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { attachFocusTrap } from '../src/utils/focus-trap.js';

function makeModal() {
  const c = document.createElement('div');
  c.innerHTML = '<button id="a">A</button><button id="b">B</button><button id="c">C</button>';
  document.body.appendChild(c);
  return c;
}
function tab(shift = false) {
  const e = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true });
  document.dispatchEvent(e);
  return e;
}
function esc() {
  const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  document.dispatchEvent(e);
  return e;
}

describe('focus-trap (audit M7)', () => {
  let detach;
  afterEach(() => { if (detach) detach(); detach = null; document.body.innerHTML = ''; });

  it('wraps Tab from the last focusable back to the first', () => {
    const c = makeModal();
    detach = attachFocusTrap(c, { restoreFocus: false });
    c.querySelector('#c').focus();
    const e = tab();
    expect(document.activeElement).toBe(c.querySelector('#a'));
    expect(e.defaultPrevented).toBe(true);
  });

  it('wraps Shift+Tab from the first focusable to the last', () => {
    const c = makeModal();
    detach = attachFocusTrap(c, { restoreFocus: false });
    c.querySelector('#a').focus();
    tab(true);
    expect(document.activeElement).toBe(c.querySelector('#c'));
  });

  it('calls onEscape when provided', () => {
    const c = makeModal();
    const onEscape = vi.fn();
    detach = attachFocusTrap(c, { onEscape, restoreFocus: false });
    const e = esc();
    expect(onEscape).toHaveBeenCalledOnce();
    expect(e.defaultPrevented).toBe(true);
  });

  it('swallows Escape in lockdown mode (no onEscape)', () => {
    const c = makeModal();
    detach = attachFocusTrap(c, { restoreFocus: false });
    const e = esc();
    expect(e.defaultPrevented).toBe(true); // swallowed, never throws
  });

  it('detach restores focus to the previously-focused element', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    const c = makeModal();
    const d = attachFocusTrap(c, { restoreFocus: true });
    c.querySelector('#a').focus();
    d();
    expect(document.activeElement).toBe(outside);
  });

  it('detach removes the Tab trap', () => {
    const c = makeModal();
    const d = attachFocusTrap(c, { restoreFocus: false });
    d();
    c.querySelector('#c').focus();
    const e = tab();
    expect(e.defaultPrevented).toBe(false); // no longer trapped
  });
});
