// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createVirtualScroller } from '../src/components/virtual-scroller.js';

/**
 * Tests for the virtual scroller utility.
 *
 * Uses jsdom to create container elements with mocked dimensions.
 */

describe('createVirtualScroller', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  /**
   * Helper to mock scroll container dimensions since jsdom doesn't layout.
   */
  function mockDimensions(scrollEl, { clientHeight, scrollTop = 0 }) {
    Object.defineProperty(scrollEl, 'clientHeight', { value: clientHeight, configurable: true });
    Object.defineProperty(scrollEl, 'scrollTop', { value: scrollTop, writable: true, configurable: true });
  }

  it('calculates visible window (startIndex, endIndex) from scrollTop and container height', () => {
    const scroller = createVirtualScroller(container, {
      itemHeight: 40,
      renderItem: (i) => `<div data-index="${i}">Item ${i}</div>`,
      getItemCount: () => 100,
      overscan: 2,
      columns: 1,
    });

    // Mock: viewport height = 200px, scrollTop = 0
    // Visible rows: 0 to ceil(200/40) = 5, with overscan 2: start 0, end 7
    mockDimensions(scroller._scrollEl, { clientHeight: 200, scrollTop: 0 });

    const range = scroller._getVisibleRange();
    expect(range.startIndex).toBe(0);
    expect(range.endIndex).toBe(7); // ceil(200/40) + 2 overscan = 7

    scroller.destroy();
  });

  it('renders only items within visible range plus overscan buffer', () => {
    const rendered = [];
    const scroller = createVirtualScroller(container, {
      itemHeight: 50,
      renderItem: (i) => {
        rendered.push(i);
        return `<div>Item ${i}</div>`;
      },
      getItemCount: () => 1000,
      overscan: 3,
      columns: 1,
    });

    // Mock: viewport = 200px, scrollTop = 0
    mockDimensions(scroller._scrollEl, { clientHeight: 200, scrollTop: 0 });
    rendered.length = 0;
    scroller.update();

    // startRow = max(0, floor(0/50) - 3) = 0
    // endRow = min(999, ceil(200/50) + 3) = 7
    // Items 0 through 7 = 8 items
    expect(rendered.length).toBe(8);
    expect(rendered[0]).toBe(0);
    expect(rendered[rendered.length - 1]).toBe(7);

    scroller.destroy();
  });

  it('update() re-renders when data count changes', () => {
    let itemCount = 10;
    const scroller = createVirtualScroller(container, {
      itemHeight: 40,
      renderItem: (i) => `<div>Item ${i}</div>`,
      getItemCount: () => itemCount,
      overscan: 0,
      columns: 1,
    });

    mockDimensions(scroller._scrollEl, { clientHeight: 400, scrollTop: 0 });
    scroller.update();

    // Total height should reflect 10 items
    expect(scroller._spacerEl.style.height).toBe('400px'); // 10 * 40

    // Change item count
    itemCount = 50;
    scroller.update();
    expect(scroller._spacerEl.style.height).toBe('2000px'); // 50 * 40

    scroller.destroy();
  });

  it('handles grid layout with columns parameter (items per row)', () => {
    const scroller = createVirtualScroller(container, {
      itemHeight: 200, // row height
      renderItem: (i) => `<div>Card ${i}</div>`,
      getItemCount: () => 24,
      overscan: 1,
      columns: 4,
    });

    // 24 items / 4 columns = 6 rows
    mockDimensions(scroller._scrollEl, { clientHeight: 400, scrollTop: 0 });

    const range = scroller._getVisibleRange();
    // startRow = max(0, floor(0/200) - 1) = 0
    // endRow = min(5, ceil(400/200) + 1) = 3
    // startIndex: 0 * 4 = 0, endIndex: min((3+1)*4 - 1, 23) = 15
    expect(range.startIndex).toBe(0);
    expect(range.endIndex).toBe(15);
    expect(range.startRow).toBe(0);
    expect(range.endRow).toBe(3);

    // Spacer should reflect total row count
    scroller.update();
    expect(scroller._spacerEl.style.height).toBe('1200px'); // 6 rows * 200px

    scroller.destroy();
  });

  it('destroy() cleans up event listeners and removes DOM', () => {
    const scroller = createVirtualScroller(container, {
      itemHeight: 40,
      renderItem: (i) => `<div>Item ${i}</div>`,
      getItemCount: () => 10,
    });

    expect(container.children.length).toBe(1); // scroll container

    scroller.destroy();

    // Scroll container should be removed from the DOM
    expect(container.children.length).toBe(0);
  });
});
