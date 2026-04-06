/**
 * Synergy suggestion mini-card tile.
 * Renders a full-width row in the analytics sidebar showing:
 * card name, lift score, and inclusion count.
 * Click to add card to deck.
 */

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
  row.style.cssText = 'background: #14161C; padding: 16px; border-bottom: 1px solid #2A2D3A; cursor: pointer; transition: background 150ms;';

  row.addEventListener('mouseenter', () => { row.style.background = '#1C1F28'; });
  row.addEventListener('mouseleave', () => { row.style.background = '#14161C'; });

  // Top row: card name
  const nameEl = document.createElement('div');
  nameEl.style.cssText = `${LABEL_700} color: #EAECEE;`;
  nameEl.textContent = suggestion.name;
  row.appendChild(nameEl);

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

  row.appendChild(statsRow);

  // Click handler
  row.addEventListener('click', () => {
    if (typeof onAdd === 'function') {
      onAdd(suggestion);
    }
  });

  return row;
}
