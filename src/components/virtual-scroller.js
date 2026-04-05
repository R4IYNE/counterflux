/**
 * Virtual scroller utility for rendering large lists efficiently.
 *
 * Only renders items within the visible viewport + overscan buffer.
 * Supports both list (1 column) and grid (N columns) layouts.
 *
 * @param {HTMLElement} container - Parent element to mount the scroller into
 * @param {Object} options
 * @param {number} options.itemHeight - Height of a single item (or row in grid mode)
 * @param {function(number): string} options.renderItem - Returns HTML string for item at index
 * @param {function(): number} options.getItemCount - Returns total number of items
 * @param {number} [options.overscan=5] - Extra items to render above/below viewport
 * @param {number} [options.columns=1] - Number of items per row (grid mode)
 * @returns {{ update: function, destroy: function, scrollTo: function }}
 */
export function createVirtualScroller(container, {
  itemHeight,
  renderItem,
  getItemCount,
  overscan = 5,
  columns = 1,
}) {
  // Create scroll container
  const scrollEl = document.createElement('div');
  scrollEl.style.overflowY = 'auto';
  scrollEl.style.height = '100%';
  scrollEl.style.position = 'relative';

  // Inner spacer for total scroll height
  const spacerEl = document.createElement('div');
  spacerEl.style.position = 'relative';
  spacerEl.style.width = '100%';

  // Content window that gets repositioned
  const contentEl = document.createElement('div');
  contentEl.style.position = 'absolute';
  contentEl.style.left = '0';
  contentEl.style.right = '0';

  spacerEl.appendChild(contentEl);
  scrollEl.appendChild(spacerEl);
  container.appendChild(scrollEl);

  let _destroyed = false;

  function getRowCount() {
    const itemCount = getItemCount();
    return Math.ceil(itemCount / columns);
  }

  function render() {
    if (_destroyed) return;

    const itemCount = getItemCount();
    const rowCount = getRowCount();
    const totalHeight = rowCount * itemHeight;
    spacerEl.style.height = totalHeight + 'px';

    const scrollTop = scrollEl.scrollTop;
    const viewportHeight = scrollEl.clientHeight;

    const startRow = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endRow = Math.min(rowCount - 1, Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan);

    const startIndex = startRow * columns;
    const endIndex = Math.min((endRow + 1) * columns - 1, itemCount - 1);

    contentEl.style.top = (startRow * itemHeight) + 'px';

    let html = '';
    for (let i = startIndex; i <= endIndex; i++) {
      html += renderItem(i);
    }
    contentEl.innerHTML = html;
  }

  function onScroll() {
    requestAnimationFrame(render);
  }

  scrollEl.addEventListener('scroll', onScroll, { passive: true });
  render();

  return {
    /** Re-render (call when data changes) */
    update() {
      render();
    },

    /** Scroll to a specific item index */
    scrollTo(index) {
      const row = Math.floor(index / columns);
      scrollEl.scrollTop = row * itemHeight;
    },

    /** Clean up listeners and DOM */
    destroy() {
      _destroyed = true;
      scrollEl.removeEventListener('scroll', onScroll);
      if (scrollEl.parentNode) {
        scrollEl.parentNode.removeChild(scrollEl);
      }
    },

    /** Exposed for testing: calculate visible range */
    _getVisibleRange() {
      const itemCount = getItemCount();
      const rowCount = getRowCount();
      const scrollTop = scrollEl.scrollTop;
      const viewportHeight = scrollEl.clientHeight;

      const startRow = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
      const endRow = Math.min(rowCount - 1, Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan);

      return {
        startIndex: startRow * columns,
        endIndex: Math.min((endRow + 1) * columns - 1, itemCount - 1),
        startRow,
        endRow,
      };
    },

    /** Expose internals for testing */
    _scrollEl: scrollEl,
    _contentEl: contentEl,
    _spacerEl: spacerEl,
  };
}
