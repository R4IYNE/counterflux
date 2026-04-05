/**
 * Deck editor context menu.
 * Handles both deck-context-menu (cards in the 99) and
 * deck-search-context-menu (search results) events.
 * Follows Phase 2 context-menu.js pattern with custom DOM events.
 *
 * @param {HTMLElement} container - Mount target
 */
export function initDeckContextMenu(container) {
  const menuEl = document.createElement('div');
  menuEl.id = 'deck-context-menu';
  menuEl.style.display = 'none';
  menuEl.style.position = 'fixed';
  menuEl.style.zIndex = '50';
  menuEl.className = 'bg-surface-hover border border-border-ghost';
  menuEl.style.minWidth = '200px';
  menuEl.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.4)';
  menuEl.style.background = '#1C1F28';
  menuEl.style.border = '1px solid #2A2D3A';
  container.appendChild(menuEl);

  function closeMenu() {
    menuEl.style.display = 'none';
  }

  function createMenuItem(label, onClick, destructive = false) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
      letter-spacing: 0.15em; font-weight: 400; background: transparent; border: none;
      display: block; width: 100%; padding: 8px 16px; text-align: left; cursor: pointer;
      color: ${destructive ? 'var(--color-secondary, #E23838)' : 'var(--color-text-primary, #EAECEE)'};
    `;
    btn.onmouseenter = () => {
      if (destructive) {
        btn.style.background = 'rgba(226, 56, 56, 0.1)';
      } else {
        btn.style.color = 'var(--color-primary, #0D52BD)';
        btn.style.background = 'rgba(13, 82, 189, 0.1)';
      }
    };
    btn.onmouseleave = () => {
      btn.style.color = destructive ? 'var(--color-secondary, #E23838)' : 'var(--color-text-primary, #EAECEE)';
      btn.style.background = 'transparent';
    };
    btn.onclick = (e) => {
      e.stopPropagation();
      onClick();
      closeMenu();
    };
    return btn;
  }

  function positionMenu(x, y) {
    menuEl.style.left = x + 'px';
    menuEl.style.top = y + 'px';
    menuEl.style.display = 'block';
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

  // Deck card context menu (cards in the 99)
  const handleDeckContextMenu = (e) => {
    const { entry, x, y } = e.detail;
    if (!entry) return;
    const Alpine = window.Alpine;
    const store = Alpine?.store('deck');
    const collectionStore = Alpine?.store('collection');
    const toastStore = Alpine?.store('toast');
    const card = entry.card;
    const cardName = card?.name || 'Card';

    menuEl.innerHTML = '';

    // Remove from Deck (destructive)
    menuEl.appendChild(createMenuItem('Remove from Deck', async () => {
      if (store) {
        await store.removeCard(entry.id);
        toastStore?.success(`${cardName} removed.`);
        document.dispatchEvent(new CustomEvent('deck-cards-changed'));
      }
    }, true));

    // Change Quantity
    menuEl.appendChild(createMenuItem('Change Quantity', () => {
      const deck = store?.activeDeck;
      if (deck?.format === 'commander') {
        toastStore?.warning('Commander format enforces singleton rule.');
        return;
      }
      const newQty = prompt(`Quantity for ${cardName}:`, String(entry.quantity || 1));
      if (newQty !== null) {
        const qty = parseInt(newQty, 10);
        if (!isNaN(qty) && qty > 0) {
          import('../db/schema.js').then(({ db }) => {
            db.deck_cards.update(entry.id, { quantity: qty }).then(() => {
              store?.loadDeck(deck.id).then(() => {
                document.dispatchEvent(new CustomEvent('deck-cards-changed'));
                toastStore?.success(`${cardName} x${qty} -- quantity updated.`);
              });
            });
          });
        }
      }
    }));

    // Add Tag submenu
    const tags = store?.activeDeck?.tags || [];
    if (tags.length > 0) {
      const tagHeader = document.createElement('div');
      tagHeader.style.cssText = `
        font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
        letter-spacing: 0.15em; font-weight: 700; color: #7A8498; padding: 8px 16px 4px;
      `;
      tagHeader.textContent = 'ADD TAG';
      menuEl.appendChild(tagHeader);

      for (const tag of tags) {
        const hasTag = (entry.tags || []).includes(tag);
        const tagBtn = createMenuItem(`${hasTag ? '✓ ' : '  '}${tag}`, () => {
          let newTags;
          if (hasTag) {
            newTags = (entry.tags || []).filter(t => t !== tag);
          } else {
            newTags = [...(entry.tags || []), tag];
          }
          if (store) {
            store.updateCardTags(entry.id, newTags).then(() => {
              document.dispatchEvent(new CustomEvent('deck-cards-changed'));
            });
          }
        });
        menuEl.appendChild(tagBtn);
      }
    }

    // Separator
    const sep = document.createElement('div');
    sep.style.cssText = 'height: 1px; background: #2A2D3A; margin: 4px 0;';
    menuEl.appendChild(sep);

    // Add to Collection
    menuEl.appendChild(createMenuItem('Add to Collection', async () => {
      if (collectionStore && entry.scryfall_id) {
        await collectionStore.addCard(entry.scryfall_id, 1, false, 'owned');
        toastStore?.success(`Added to collection.`);
      }
    }));

    // Add to Wishlist
    menuEl.appendChild(createMenuItem('Add to Wishlist', async () => {
      if (collectionStore && entry.scryfall_id) {
        await collectionStore.addCard(entry.scryfall_id, 1, false, 'wishlist');
        toastStore?.success(`Added to wishlist.`);
      }
    }));

    // View Details
    menuEl.appendChild(createMenuItem('View Details', () => {
      if (card) {
        Alpine?.store('search')?.selectResult(card);
      }
    }));

    // View on Scryfall
    menuEl.appendChild(createMenuItem('View on Scryfall', () => {
      if (card) {
        window.open(`https://scryfall.com/card/${card.set}/${card.collector_number}`, '_blank');
      }
    }));

    positionMenu(x, y);
  };

  // Search result context menu
  const handleSearchContextMenu = (e) => {
    const { card, x, y } = e.detail;
    if (!card) return;
    const Alpine = window.Alpine;
    const store = Alpine?.store('deck');
    const collectionStore = Alpine?.store('collection');
    const toastStore = Alpine?.store('toast');
    const cardName = card.name || 'Card';

    menuEl.innerHTML = '';

    // Add to Deck
    menuEl.appendChild(createMenuItem('Add to Deck', async () => {
      if (store) {
        const result = await store.addCard(card.id);
        if (result?.warning) {
          toastStore?.warning(result.message);
        } else {
          toastStore?.success(`${cardName} added to ${store.activeDeck?.name || 'deck'}.`);
          document.dispatchEvent(new CustomEvent('deck-cards-changed'));
        }
      }
    }));

    // Add to Collection
    menuEl.appendChild(createMenuItem('Add to Collection', async () => {
      if (collectionStore) {
        await collectionStore.addCard(card.id, 1, false, 'owned');
        toastStore?.success(`Added to collection.`);
      }
    }));

    // Add to Wishlist
    menuEl.appendChild(createMenuItem('Add to Wishlist', async () => {
      if (collectionStore) {
        await collectionStore.addCard(card.id, 1, false, 'wishlist');
        toastStore?.success(`Added to wishlist.`);
      }
    }));

    // View Details
    menuEl.appendChild(createMenuItem('View Details', () => {
      Alpine?.store('search')?.selectResult(card);
    }));

    // View on Scryfall
    menuEl.appendChild(createMenuItem('View on Scryfall', () => {
      window.open(`https://scryfall.com/card/${card.set}/${card.collector_number}`, '_blank');
    }));

    positionMenu(x, y);
  };

  document.addEventListener('deck-context-menu', handleDeckContextMenu);
  document.addEventListener('deck-search-context-menu', handleSearchContextMenu);

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
    closeMenu,
    cleanup() {
      document.removeEventListener('deck-context-menu', handleDeckContextMenu);
      document.removeEventListener('deck-search-context-menu', handleSearchContextMenu);
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeydown);
      menuEl.remove();
    },
  };
}
