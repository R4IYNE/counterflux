/**
 * Deck landing context menu component.
 * Listens for 'deck-landing-context-menu' custom events and renders
 * a positioned menu with deck management actions.
 */

/**
 * Initialize the deck landing context menu handler.
 * @param {HTMLElement} container - The container element to attach the menu to
 * @returns {{ cleanup: Function }}
 */
export function initDeckLandingContextMenu(container) {
  const menuEl = document.createElement('div');
  menuEl.id = 'deck-landing-context-menu';
  menuEl.style.display = 'none';
  menuEl.style.position = 'fixed';
  menuEl.style.zIndex = '50';
  menuEl.className = 'bg-surface-hover border border-border-ghost';
  menuEl.style.minWidth = '200px';
  menuEl.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.4)';
  container.appendChild(menuEl);

  let activeDeck = null;

  function closeMenu() {
    menuEl.style.display = 'none';
    activeDeck = null;
  }

  function createMenuItem(label, onClick, destructive = false) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      font-weight: 400;
      color: ${destructive ? '#E23838' : 'var(--color-text-primary, #EAECEE)'};
      background: transparent;
      border: none;
      display: block;
      width: 100%;
      padding: 8px 16px;
      text-align: left;
      cursor: pointer;
    `;
    btn.onmouseenter = () => {
      if (destructive) {
        btn.style.background = 'rgba(226, 56, 56, 0.1)';
      } else {
        btn.style.color = 'var(--color-primary, #0D52BD)';
      }
    };
    btn.onmouseleave = () => {
      btn.style.color = destructive ? '#E23838' : 'var(--color-text-primary, #EAECEE)';
      btn.style.background = 'transparent';
    };
    btn.onclick = (e) => {
      e.stopPropagation();
      onClick();
      closeMenu();
    };
    return btn;
  }

  function showMenu(deck, x, y) {
    activeDeck = deck;
    menuEl.innerHTML = '';
    const Alpine = window.Alpine;
    const store = Alpine?.store('deck');
    const toast = Alpine?.store('toast');

    // Open Deck
    menuEl.appendChild(
      createMenuItem('Open Deck', () => {
        document.dispatchEvent(
          new CustomEvent('deck-open', { detail: { deckId: deck.id } })
        );
      })
    );

    // Rename Deck
    menuEl.appendChild(
      createMenuItem('Rename Deck', async () => {
        const newName = prompt('Enter new deck name:', deck.name);
        if (newName && newName.trim() && store) {
          await store.renameDeck(deck.id, newName.trim());
          toast?.success(`Deck renamed to "${newName.trim()}".`);
        }
      })
    );

    // Duplicate Deck
    menuEl.appendChild(
      createMenuItem('Duplicate Deck', async () => {
        if (store) {
          await store.duplicateDeck(deck.id);
          toast?.success(`"${deck.name}" duplicated.`);
        }
      })
    );

    // Change Commander
    menuEl.appendChild(
      createMenuItem('Change Commander', async () => {
        const { openRitualModal } = await import('./ritual-modal.js');
        openRitualModal({ existingDeck: deck });
      })
    );

    // Delete Deck (destructive)
    menuEl.appendChild(
      createMenuItem('Delete Deck', () => {
        const { openDeleteDeckModal } = import('./delete-deck-modal.js').then(m => {
          m.openDeleteDeckModal(deck.id, deck.name);
        });
      }, true)
    );

    // Position the menu
    menuEl.style.left = x + 'px';
    menuEl.style.top = y + 'px';
    menuEl.style.display = 'block';

    // Adjust if menu goes off-screen
    requestAnimationFrame(() => {
      const rect = menuEl.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        menuEl.style.left = (window.innerWidth - rect.width - 8) + 'px';
      }
      if (rect.bottom > window.innerHeight) {
        menuEl.style.top = (window.innerHeight - rect.height - 8) + 'px';
      }
    });
  }

  // Listen for custom context menu events
  const handleContextMenu = (e) => {
    const { deck, x, y } = e.detail;
    showMenu(deck, x, y);
  };
  document.addEventListener('deck-landing-context-menu', handleContextMenu);

  // Close on click outside or Escape
  const handleClick = (e) => {
    if (menuEl.style.display !== 'none' && !menuEl.contains(e.target)) {
      closeMenu();
    }
  };
  const handleKeydown = (e) => {
    if (e.key === 'Escape' && menuEl.style.display !== 'none') {
      closeMenu();
    }
  };
  document.addEventListener('click', handleClick);
  document.addEventListener('keydown', handleKeydown);

  return {
    cleanup() {
      document.removeEventListener('deck-landing-context-menu', handleContextMenu);
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeydown);
      menuEl.remove();
    },
  };
}
