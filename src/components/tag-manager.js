import Sortable from 'sortablejs';
import { db } from '../db/schema.js';

/**
 * Tag manager component for deck tags.
 * Displays, creates, edits, deletes, and drag-reorders tags (DECK-05).
 *
 * @param {HTMLElement} container - Mount target
 * @param {number} deckId - Active deck ID
 */
export function renderTagManager(container, deckId) {
  const Alpine = window.Alpine;
  const store = Alpine?.store('deck');
  const toastStore = Alpine?.store('toast');

  let sortableInstance = null;

  container.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.15em; font-weight: 700; color: #7A8498; margin-bottom: 8px;
  `;
  header.textContent = 'FUNCTIONAL TAGS';
  container.appendChild(header);

  // Tag list
  const tagList = document.createElement('div');
  tagList.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;';
  tagList.id = 'tag-manager-list';
  container.appendChild(tagList);

  // Add tag button + input
  const addRow = document.createElement('div');
  addRow.style.cssText = 'display: flex; gap: 8px; align-items: center;';

  const addInput = document.createElement('input');
  addInput.type = 'text';
  addInput.placeholder = 'TAG NAME...';
  addInput.style.cssText = `
    flex: 1; padding: 4px 8px; font-family: 'JetBrains Mono', monospace; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.15em; background: #0B0C10;
    border: 1px solid #2A2D3A; color: #EAECEE; display: none;
  `;

  const addBtn = document.createElement('button');
  addBtn.textContent = '+ ADD TAG';
  addBtn.style.cssText = `
    padding: 4px 8px; cursor: pointer;
    font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.15em; font-weight: 700; background: transparent;
    color: #0D52BD; border: 1px solid #2A2D3A;
  `;

  let addMode = false;
  addBtn.addEventListener('click', () => {
    if (!addMode) {
      addMode = true;
      addInput.style.display = '';
      addInput.focus();
      addBtn.textContent = 'CONFIRM';
    } else {
      submitNewTag();
    }
  });

  addInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitNewTag();
    if (e.key === 'Escape') cancelAdd();
  });

  async function submitNewTag() {
    const name = addInput.value.trim();
    if (!name) { cancelAdd(); return; }

    const deck = store?.activeDeck;
    if (!deck) return;

    const tags = [...(deck.tags || [])];
    if (tags.includes(name)) {
      toastStore?.warning(`Tag "${name}" already exists.`);
      cancelAdd();
      return;
    }

    tags.push(name);
    await db.decks.update(deckId, { tags, updated_at: new Date().toISOString() });
    if (store) {
      store.activeDeck = await db.decks.get(deckId);
    }
    cancelAdd();
    renderTags();
  }

  function cancelAdd() {
    addMode = false;
    addInput.value = '';
    addInput.style.display = 'none';
    addBtn.textContent = '+ ADD TAG';
  }

  addRow.appendChild(addInput);
  addRow.appendChild(addBtn);
  container.appendChild(addRow);

  function renderTags() {
    tagList.innerHTML = '';
    const tags = store?.activeDeck?.tags || [];

    for (const tag of tags) {
      const pill = document.createElement('div');
      pill.className = 'tag-pill';
      pill.dataset.tagName = tag;
      pill.style.cssText += ' display: inline-flex; align-items: center; gap: 4px; cursor: grab; user-select: none;';

      const nameSpan = document.createElement('span');
      nameSpan.textContent = tag;
      pill.appendChild(nameSpan);

      // Double-click to rename (D-07)
      nameSpan.addEventListener('dblclick', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = tag;
        input.style.cssText = `
          width: 80px; padding: 0 4px; font-family: 'JetBrains Mono', monospace; font-size: 11px;
          text-transform: uppercase; letter-spacing: 0.15em; background: #0B0C10;
          border: 1px solid #0D52BD; color: #EAECEE;
        `;
        nameSpan.replaceWith(input);
        input.focus();
        input.select();

        const finishRename = async () => {
          const newName = input.value.trim();
          if (newName && newName !== tag) {
            const deck = store?.activeDeck;
            if (deck) {
              const updatedTags = (deck.tags || []).map(t => t === tag ? newName : t);
              await db.decks.update(deckId, { tags: updatedTags, updated_at: new Date().toISOString() });
              // Also update deck_cards that had this tag
              const deckCards = await db.deck_cards.where('deck_id').equals(deckId).toArray();
              for (const dc of deckCards) {
                if (dc.tags && dc.tags.includes(tag)) {
                  const newCardTags = dc.tags.map(t => t === tag ? newName : t);
                  await db.deck_cards.update(dc.id, { tags: newCardTags });
                }
              }
              store.activeDeck = await db.decks.get(deckId);
            }
          }
          renderTags();
        };

        input.addEventListener('blur', finishRename);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { input.blur(); }
          if (e.key === 'Escape') { renderTags(); }
        });
      });

      // Delete "x" button
      const deleteBtn = document.createElement('span');
      deleteBtn.textContent = '\u00D7';
      deleteBtn.style.cssText = 'cursor: pointer; color: #E23838; font-weight: 700; font-size: 14px; line-height: 1;';
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const deck = store?.activeDeck;
        if (!deck) return;
        const updatedTags = (deck.tags || []).filter(t => t !== tag);
        await db.decks.update(deckId, { tags: updatedTags, updated_at: new Date().toISOString() });
        // Remove tag from all deck_cards
        const deckCards = await db.deck_cards.where('deck_id').equals(deckId).toArray();
        for (const dc of deckCards) {
          if (dc.tags && dc.tags.includes(tag)) {
            const newCardTags = dc.tags.filter(t => t !== tag);
            await db.deck_cards.update(dc.id, { tags: newCardTags });
          }
        }
        store.activeDeck = await db.decks.get(deckId);
        renderTags();
        toastStore?.success(`Tag "${tag}" removed.`);
      });
      pill.appendChild(deleteBtn);

      tagList.appendChild(pill);
    }

    // DECK-05: SortableJS for tag drag-to-reorder
    if (sortableInstance) {
      try { sortableInstance.destroy(); } catch { /* ignore */ }
    }
    sortableInstance = new Sortable(tagList, {
      animation: 150,
      ghostClass: 'drag-ghost',
      onEnd: async () => {
        const newOrder = [...tagList.children].map(el => el.dataset.tagName).filter(Boolean);
        await db.decks.update(deckId, { tags: newOrder, updated_at: new Date().toISOString() });
        if (store) {
          store.activeDeck = await db.decks.get(deckId);
        }
      },
    });
  }

  // Initial render
  renderTags();

  // Cleanup
  container._tagManagerCleanup = () => {
    if (sortableInstance) {
      try { sortableInstance.destroy(); } catch { /* ignore */ }
    }
  };
}
