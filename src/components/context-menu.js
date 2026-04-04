/**
 * Collection context menu component.
 * Listens for 'collection-context-menu' custom events and renders
 * a positioned menu with collection management actions.
 */

/**
 * Initialize the global context menu handler.
 * Should be called once during screen mount.
 * @param {HTMLElement} container - The container element to attach the menu to
 */
export function initContextMenu(container) {
  // Create the context menu element
  const menuEl = document.createElement('div');
  menuEl.id = 'collection-context-menu';
  menuEl.style.display = 'none';
  menuEl.style.position = 'fixed';
  menuEl.style.zIndex = '50';
  menuEl.className = 'bg-surface-hover border border-border-ghost';
  menuEl.style.minWidth = '200px';
  menuEl.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.4)';
  container.appendChild(menuEl);

  let activeEntry = null;

  function closeMenu() {
    menuEl.style.display = 'none';
    activeEntry = null;
  }

  function createMenuItem(label, onClick) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.className = 'w-full text-left px-md py-sm cursor-pointer transition-colors';
    btn.style.cssText = `
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      font-weight: 400;
      color: var(--color-text-primary, #EAECEE);
      background: transparent;
      border: none;
      display: block;
      width: 100%;
      padding: 8px 16px;
      text-align: left;
    `;
    btn.onmouseenter = () => {
      btn.style.color = 'var(--color-primary, #0D52BD)';
    };
    btn.onmouseleave = () => {
      btn.style.color = 'var(--color-text-primary, #EAECEE)';
    };
    btn.onclick = (e) => {
      e.stopPropagation();
      onClick();
      closeMenu();
    };
    return btn;
  }

  function showMenu(entry, x, y) {
    activeEntry = entry;
    menuEl.innerHTML = '';

    // EDIT QUANTITY
    menuEl.appendChild(
      createMenuItem('EDIT QUANTITY', () => {
        document.dispatchEvent(
          new CustomEvent('collection-edit-inline', { detail: { entry } })
        );
      })
    );

    // TOGGLE FOIL
    menuEl.appendChild(
      createMenuItem('TOGGLE FOIL', async () => {
        const Alpine = window.Alpine;
        if (!Alpine) return;
        const store = Alpine.store('collection');
        const toast = Alpine.store('toast');
        await store.editEntry(entry.id, { foil: entry.foil ? 0 : 1 });
        toast.success(
          (entry.card?.name || 'Card') +
            ' foil status ' +
            (entry.foil ? 'removed' : 'enabled') +
            '.'
        );
      })
    );

    // MOVE TO WISHLIST / MOVE TO OWNED
    const moveLabel =
      entry.category === 'owned' ? 'MOVE TO WISHLIST' : 'MOVE TO OWNED';
    const moveCategory = entry.category === 'owned' ? 'wishlist' : 'owned';
    menuEl.appendChild(
      createMenuItem(moveLabel, async () => {
        const Alpine = window.Alpine;
        if (!Alpine) return;
        const store = Alpine.store('collection');
        const toast = Alpine.store('toast');
        await store.editEntry(entry.id, { category: moveCategory });
        toast.success(
          (entry.card?.name || 'Card') + ' moved to ' + moveCategory + '.'
        );
      })
    );

    // VIEW DETAILS
    menuEl.appendChild(
      createMenuItem('VIEW DETAILS', () => {
        const Alpine = window.Alpine;
        if (!Alpine || !entry.card) return;
        Alpine.store('search').selectResult(entry.card);
      })
    );

    // VIEW ON SCRYFALL
    menuEl.appendChild(
      createMenuItem('VIEW ON SCRYFALL', () => {
        if (!entry.card) return;
        const url = `https://scryfall.com/card/${entry.card.set}/${entry.card.collector_number}`;
        window.open(url, '_blank');
      })
    );

    // REMOVE FROM COLLECTION
    const removeBtn = createMenuItem('REMOVE FROM COLLECTION', () => {
      document.dispatchEvent(
        new CustomEvent('collection-delete-confirm', { detail: { entry } })
      );
    });
    removeBtn.style.color = 'var(--color-secondary, #E23838)';
    removeBtn.onmouseenter = () => {
      removeBtn.style.color = 'var(--color-secondary, #E23838)';
      removeBtn.style.background = 'rgba(226, 56, 56, 0.1)';
    };
    removeBtn.onmouseleave = () => {
      removeBtn.style.color = 'var(--color-secondary, #E23838)';
      removeBtn.style.background = 'transparent';
    };
    menuEl.appendChild(removeBtn);

    // Position the menu
    menuEl.style.left = x + 'px';
    menuEl.style.top = y + 'px';
    menuEl.style.display = 'block';

    // Adjust if menu goes off-screen
    requestAnimationFrame(() => {
      const rect = menuEl.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        menuEl.style.left = window.innerWidth - rect.width - 8 + 'px';
      }
      if (rect.bottom > window.innerHeight) {
        menuEl.style.top = window.innerHeight - rect.height - 8 + 'px';
      }
    });
  }

  // Listen for custom context menu events
  document.addEventListener('collection-context-menu', (e) => {
    const { entry, x, y } = e.detail;
    showMenu(entry, x, y);
  });

  // Close on click outside or Escape
  document.addEventListener('click', (e) => {
    if (menuEl.style.display !== 'none' && !menuEl.contains(e.target)) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuEl.style.display !== 'none') {
      closeMenu();
    }
  });

  return { closeMenu };
}
