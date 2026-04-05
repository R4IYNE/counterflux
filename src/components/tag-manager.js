import { DEFAULT_TAGS } from '../utils/tag-heuristics.js';

/**
 * Tag manager component for deck tags.
 * Displays the fixed functional tags as read-only labels.
 *
 * @param {HTMLElement} container - Mount target
 * @param {number} deckId - Active deck ID
 */
export function renderTagManager(container, deckId) {
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
  tagList.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px;';

  for (const tag of DEFAULT_TAGS) {
    const pill = document.createElement('div');
    pill.className = 'tag-pill';
    pill.style.cssText += ' display: inline-flex; align-items: center; user-select: none;';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = tag;
    pill.appendChild(nameSpan);

    tagList.appendChild(pill);
  }

  container.appendChild(tagList);

  // No cleanup needed — static content
  container._tagManagerCleanup = () => {};
}
