import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Toast store unit tests.
 *
 * Tests the toast store logic directly without Alpine.js dependency.
 * We replicate the store's methods as a plain object to isolate business logic.
 */

function createToastStore() {
  return {
    items: [],
    _nextId: 1,

    show(message, type = 'info', duration = 5000) {
      const id = this._nextId++;
      this.items.push({ id, message, type, visible: true });

      // Max 3 visible -- dismiss oldest if overflow
      while (this.items.filter(t => t.visible).length > 3) {
        const oldest = this.items.find(t => t.visible);
        if (oldest) oldest.visible = false;
      }

      return id;
    },

    dismiss(id) {
      const item = this.items.find(t => t.id === id);
      if (item) {
        item.visible = false;
      }
    },

    info(msg) { return this.show(msg, 'info'); },
    success(msg) { return this.show(msg, 'success'); },
    warning(msg) { return this.show(msg, 'warning'); },
    error(msg) { return this.show(msg, 'error', 8000); },
  };
}

describe('Toast Store', () => {
  let store;

  beforeEach(() => {
    store = createToastStore();
  });

  it('show() adds an item to the items array', () => {
    store.show('Test message', 'info');
    expect(store.items).toHaveLength(1);
    expect(store.items[0].message).toBe('Test message');
    expect(store.items[0].type).toBe('info');
    expect(store.items[0].visible).toBe(true);
  });

  it('show() assigns unique incrementing IDs', () => {
    store.show('First');
    store.show('Second');
    store.show('Third');
    expect(store.items[0].id).toBe(1);
    expect(store.items[1].id).toBe(2);
    expect(store.items[2].id).toBe(3);
  });

  it('enforces max 3 visible constraint', () => {
    store.show('One');
    store.show('Two');
    store.show('Three');
    store.show('Four');

    const visibleItems = store.items.filter(t => t.visible);
    expect(visibleItems).toHaveLength(3);

    // Oldest (first added) should be dismissed
    expect(store.items[0].visible).toBe(false);
    expect(store.items[1].visible).toBe(true);
    expect(store.items[2].visible).toBe(true);
    expect(store.items[3].visible).toBe(true);
  });

  it('dismiss() sets visible to false', () => {
    const id = store.show('Dismissable');
    expect(store.items[0].visible).toBe(true);

    store.dismiss(id);
    expect(store.items[0].visible).toBe(false);
  });

  it('dismiss() does nothing for non-existent ID', () => {
    store.show('Test');
    store.dismiss(999);
    expect(store.items[0].visible).toBe(true);
  });

  it('convenience methods set correct type', () => {
    store.info('Info message');
    store.success('Success message');
    store.warning('Warning message');
    store.error('Error message');

    // Only 3 visible (4th triggers overflow)
    expect(store.items[0].type).toBe('info');
    expect(store.items[1].type).toBe('success');
    expect(store.items[2].type).toBe('warning');
    expect(store.items[3].type).toBe('error');
  });

  it('show() defaults to info type', () => {
    store.show('Default type');
    expect(store.items[0].type).toBe('info');
  });
});
