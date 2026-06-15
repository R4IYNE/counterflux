/**
 * Synergy suggestion mini-card tile.
 * Renders a full-width row in the analytics sidebar showing:
 * card name, lift score, and inclusion count.
 * Click to add card to deck.
 */

import { hydrateCardImg } from '../utils/card-image.js';

const LABEL_700 = "font: 700 11px/1.3 'JetBrains Mono', monospace; letter-spacing: 0.15em; text-transform: uppercase;";
const LABEL_400 = "font: 400 11px/1.3 'JetBrains Mono', monospace; letter-spacing: 0.15em; text-transform: uppercase;";

/**
 * Create a synergy suggestion card element.
 * @param {Object} suggestion - { name, synergy, inclusion, num_decks, url, sanitized }
 * @param {Function} onAdd - Callback when user clicks to add card
 * @returns {HTMLElement}
 */
export function renderSynergyCard(suggestion, onAdd) {
  const row = document.createElement('div');
  row.style.cssText = 'background: #14161C; padding: 12px 16px; border-bottom: 1px solid #2A2D3A; cursor: pointer; transition: background 150ms; display: flex; align-items: center; gap: 12px;';

  row.addEventListener('mouseenter', () => { row.style.background = '#1C1F28'; });
  row.addEventListener('mouseleave', () => { row.style.background = '#14161C'; });

  // Card art thumbnail (art_crop). Hydrated async from the local catalog by name;
  // hidden on miss so the row still reads cleanly.
  const thumb = document.createElement('img');
  thumb.alt = '';
  thumb.loading = 'lazy';
  thumb.style.cssText = 'width: 56px; height: 40px; object-fit: cover; border-radius: 3px; flex-shrink: 0; background: #1C1F28; border: 1px solid #2A2D3A;';
  thumb.addEventListener('error', () => { thumb.style.visibility = 'hidden'; });
  row.appendChild(thumb);
  hydrateCardImg(thumb, suggestion.name);

  // Text column: name + stats
  const textCol = document.createElement('div');
  textCol.style.cssText = 'min-width: 0; flex: 1;';

  const nameEl = document.createElement('div');
  nameEl.style.cssText = `${LABEL_700} color: #EAECEE; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
  nameEl.textContent = suggestion.name;
  textCol.appendChild(nameEl);

  // Bottom row: lift score + inclusion count
  const statsRow = document.createElement('div');
  statsRow.style.cssText = 'display: flex; gap: 16px; margin-top: 4px;';

  const liftEl = document.createElement('span');
  liftEl.style.cssText = `${LABEL_400} color: #7A8498;`;
  liftEl.textContent = `+${Math.round(suggestion.synergy * 100)}% SYNERGY`;
  statsRow.appendChild(liftEl);

  const inclusionEl = document.createElement('span');
  inclusionEl.style.cssText = `${LABEL_400} color: #4A5064;`;
  inclusionEl.textContent = `IN ${suggestion.inclusion.toLocaleString()} DECKS`;
  statsRow.appendChild(inclusionEl);

  textCol.appendChild(statsRow);
  row.appendChild(textCol);

  // Click handler
  row.addEventListener('click', () => {
    if (typeof onAdd === 'function') {
      onAdd(suggestion);
    }
  });

  return row;
}
