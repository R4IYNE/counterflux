/**
 * Combo detail popover component.
 * Shows all combos a card participates in, anchored to a badge element.
 * Includes combo name (produces), pieces list, steps, and prerequisites.
 */

const LABEL_700 = "font: 700 11px/1.3 'JetBrains Mono', monospace; letter-spacing: 0.15em; text-transform: uppercase;";
const LABEL_400 = "font: 400 11px/1.3 'JetBrains Mono', monospace; letter-spacing: 0.15em; text-transform: uppercase;";
const BODY_14 = "font: 400 14px/1.5 'Space Grotesk', sans-serif; color: #EAECEE;";

const POPOVER_ID = 'cf-combo-popover';

/**
 * Show a combo detail popover anchored to an element.
 * Removes any existing popover before creating a new one.
 * Closes on click outside or Escape key.
 *
 * @param {HTMLElement} anchorEl - Element to anchor the popover below
 * @param {Array} combos - Array of combo objects from getCombosForCard()
 */
export function showComboPopover(anchorEl, combos) {
  // Remove existing popover
  const existing = document.getElementById(POPOVER_ID);
  if (existing) existing.remove();

  if (!combos || combos.length === 0) return;

  const popover = document.createElement('div');
  popover.id = POPOVER_ID;
  popover.style.cssText = `
    position: absolute; z-index: 50;
    background: #14161C; border: 1px solid #2A2D3A;
    max-width: 320px; padding: 16px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  `;

  for (let i = 0; i < combos.length; i++) {
    const combo = combos[i];

    // Separator between multiple combos
    if (i > 0) {
      const sep = document.createElement('div');
      sep.style.cssText = 'border-top: 1px solid #2A2D3A; margin: 16px 0;';
      popover.appendChild(sep);
    }

    // Title: COMBO: {first produce effect}
    const titleEl = document.createElement('div');
    titleEl.style.cssText = `${LABEL_700} color: #EAECEE; margin-bottom: 8px;`;
    const produceText = combo.produces && combo.produces.length > 0
      ? combo.produces[0]
      : (combo.result || 'UNKNOWN EFFECT');
    titleEl.textContent = `COMBO: ${produceText.toUpperCase()}`;
    popover.appendChild(titleEl);

    // Pieces
    if (combo.pieces && combo.pieces.length > 0) {
      const piecesLabel = document.createElement('div');
      piecesLabel.style.cssText = `${LABEL_700} color: #EAECEE; margin-bottom: 4px; margin-top: 8px;`;
      piecesLabel.textContent = 'PIECES';
      popover.appendChild(piecesLabel);

      for (const piece of combo.pieces) {
        const pieceEl = document.createElement('div');
        pieceEl.style.cssText = `${LABEL_400} color: #7A8498; margin-left: 8px;`;
        pieceEl.textContent = piece.name || piece;
        popover.appendChild(pieceEl);
      }
    }

    // Steps
    if (combo.description) {
      const stepsLabel = document.createElement('div');
      stepsLabel.style.cssText = `${LABEL_700} color: #EAECEE; margin-bottom: 4px; margin-top: 8px;`;
      stepsLabel.textContent = 'STEPS';
      popover.appendChild(stepsLabel);

      const stepsEl = document.createElement('div');
      stepsEl.style.cssText = `${BODY_14} margin-left: 8px;`;
      stepsEl.textContent = combo.description;
      popover.appendChild(stepsEl);
    }

    // Prerequisites
    if (combo.prerequisites && combo.prerequisites.length > 0) {
      const prereqLabel = document.createElement('div');
      prereqLabel.style.cssText = `${LABEL_700} color: #EAECEE; margin-bottom: 4px; margin-top: 8px;`;
      prereqLabel.textContent = 'PREREQUISITES';
      popover.appendChild(prereqLabel);

      for (const prereq of combo.prerequisites) {
        const prereqEl = document.createElement('div');
        prereqEl.style.cssText = `${BODY_14} margin-left: 8px;`;
        prereqEl.textContent = prereq;
        popover.appendChild(prereqEl);
      }
    }
  }

  // Position relative to anchor
  const rect = anchorEl.getBoundingClientRect();
  popover.style.top = `${rect.bottom + window.scrollY + 4}px`;
  popover.style.left = `${rect.left + window.scrollX}px`;

  // Viewport edge correction
  document.body.appendChild(popover);
  const popRect = popover.getBoundingClientRect();
  if (popRect.right > window.innerWidth) {
    popover.style.left = 'auto';
    popover.style.right = '0px';
  }

  // Close handlers
  function closePopover() {
    popover.remove();
    document.removeEventListener('click', onClickOutside);
    document.removeEventListener('keydown', onEscape);
  }

  function onClickOutside(e) {
    if (!popover.contains(e.target) && e.target !== anchorEl) {
      closePopover();
    }
  }

  function onEscape(e) {
    if (e.key === 'Escape') {
      closePopover();
    }
  }

  // Delay attaching click listener to avoid immediate close
  requestAnimationFrame(() => {
    document.addEventListener('click', onClickOutside);
    document.addEventListener('keydown', onEscape);
  });
}
