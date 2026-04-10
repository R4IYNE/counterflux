import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Alpine.store registry
const stores = {};
vi.mock('alpinejs', () => ({
  default: {
    store: vi.fn((name, definition) => {
      if (definition) {
        stores[name] = definition;
      }
      return stores[name];
    }),
  },
}));

// Pre-register mock toast store
stores.toast = {
  items: [],
  showUndo: vi.fn(),
  dismiss: vi.fn(),
  success: vi.fn(),
};

import { initUndoStore } from '../src/stores/undo.js';

describe('Undo Store', () => {
  let undo;

  beforeEach(() => {
    vi.useFakeTimers();
    // Reset toast mock
    stores.toast.showUndo.mockClear();
    stores.toast.dismiss.mockClear();
    stores.toast.success.mockClear();

    // Re-init undo store
    initUndoStore();
    undo = stores.undo;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('push adds entry to stack', () => {
    const commitFn = vi.fn();
    const restoreFn = vi.fn();
    undo.push('delete_card', { id: 1 }, 'Deleted card', commitFn, restoreFn);
    expect(undo.stack).toHaveLength(1);
    expect(undo.stack[0].type).toBe('delete_card');
    expect(undo.stack[0].message).toBe('Deleted card');
  });

  it('push triggers showUndo toast', () => {
    undo.push('delete_card', {}, 'Deleted card', vi.fn(), vi.fn());
    expect(stores.toast.showUndo).toHaveBeenCalledWith('Deleted card', expect.any(Number));
  });

  it('push returns a unique ID', () => {
    const id1 = undo.push('a', {}, 'A', vi.fn(), vi.fn());
    const id2 = undo.push('b', {}, 'B', vi.fn(), vi.fn());
    expect(id1).not.toBe(id2);
  });

  it('undo(id) calls restoreFn and removes entry', () => {
    const restoreFn = vi.fn();
    const id = undo.push('delete', {}, 'Deleted', vi.fn(), restoreFn);
    const result = undo.undo(id);
    expect(result).toBe(true);
    expect(restoreFn).toHaveBeenCalled();
    expect(undo.stack).toHaveLength(0);
  });

  it('undo(id) clears the timer', () => {
    const commitFn = vi.fn();
    const id = undo.push('delete', {}, 'Deleted', commitFn, vi.fn());
    undo.undo(id);
    // Advance past the 10s timer - commitFn should NOT be called
    vi.advanceTimersByTime(11000);
    expect(commitFn).not.toHaveBeenCalled();
  });

  it('undo(id) dismisses the toast and shows success', () => {
    const id = undo.push('delete', {}, 'Deleted', vi.fn(), vi.fn());
    undo.undo(id);
    expect(stores.toast.dismiss).toHaveBeenCalledWith(id);
    expect(stores.toast.success).toHaveBeenCalledWith('Restored.');
  });

  it('undoLast undoes the most recent entry (LIFO)', () => {
    const restoreA = vi.fn();
    const restoreB = vi.fn();
    undo.push('a', {}, 'A', vi.fn(), restoreA);
    undo.push('b', {}, 'B', vi.fn(), restoreB);
    undo.undoLast();
    expect(restoreB).toHaveBeenCalled();
    expect(restoreA).not.toHaveBeenCalled();
    expect(undo.stack).toHaveLength(1);
  });

  it('undoLast returns false when stack is empty', () => {
    expect(undo.undoLast()).toBe(false);
  });

  it('timeout calls commitFn after 10s', async () => {
    const commitFn = vi.fn().mockResolvedValue(undefined);
    undo.push('delete', {}, 'Deleted', commitFn, vi.fn());
    expect(commitFn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10000);
    // Allow microtask to resolve
    await vi.runAllTimersAsync();
    expect(commitFn).toHaveBeenCalled();
    expect(undo.stack).toHaveLength(0);
  });

  it('undo after timeout returns false (entry gone)', async () => {
    const commitFn = vi.fn().mockResolvedValue(undefined);
    const id = undo.push('delete', {}, 'Deleted', commitFn, vi.fn());
    await vi.advanceTimersByTimeAsync(10001);
    expect(undo.undo(id)).toBe(false);
  });

  it('multiple pending undos have independent timers', async () => {
    const commitA = vi.fn().mockResolvedValue(undefined);
    const commitB = vi.fn().mockResolvedValue(undefined);
    undo.push('a', {}, 'A', commitA, vi.fn());
    vi.advanceTimersByTime(5000);
    undo.push('b', {}, 'B', commitB, vi.fn());
    // At 10s, A commits but B still pending
    await vi.advanceTimersByTimeAsync(5000);
    expect(commitA).toHaveBeenCalled();
    expect(commitB).not.toHaveBeenCalled();
    // At 15s, B commits
    await vi.advanceTimersByTimeAsync(5000);
    expect(commitB).toHaveBeenCalled();
  });
});
