import { renderDeckSearchPanel } from './deck-search-panel.js';
import { renderDeckCentrePanel } from './deck-centre-panel.js';
import { initDeckContextMenu } from './deck-context-menu.js';
import { renderTagManager } from './tag-manager.js';

/**
 * Three-panel deck editor layout.
 * Left: search (280px), Centre: the 99 (flex), Right: analytics (280px).
 * Panels separated by tonal shifting (No-Line Rule).
 *
 * @param {HTMLElement} container - Mount target
 */
export function renderDeckEditor(container) {
  const Alpine = window.Alpine;
  const store = Alpine?.store('deck');

  container.innerHTML = '';

  // Outer flex container filling the content area
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display: flex; flex-direction: column; height: 100%; overflow: hidden;';

  // Breadcrumb / back navigation
  const breadcrumb = document.createElement('div');
  breadcrumb.style.cssText = 'padding: 8px 16px; background: #0B0C10; display: flex; align-items: center; gap: 8px; flex-shrink: 0;';

  const backBtn = document.createElement('button');
  backBtn.textContent = store?.activeDeck?.name || 'BACK TO ARCHIVE';
  backBtn.style.cssText = `
    font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.15em; font-weight: 700; cursor: pointer; padding: 8px 16px;
    background: transparent; color: #7A8498; border: 1px solid #2A2D3A;
  `;
  backBtn.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('deck-back-to-landing'));
  });
  breadcrumb.appendChild(backBtn);

  const editingLabel = document.createElement('span');
  editingLabel.textContent = 'EDITING';
  editingLabel.style.cssText = `
    font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.15em; color: #4A5064;
  `;
  breadcrumb.appendChild(editingLabel);

  wrapper.appendChild(breadcrumb);

  // Three-panel row
  const panelRow = document.createElement('div');
  panelRow.style.cssText = 'display: flex; flex: 1; overflow: hidden;';

  // Left panel: search (280px / 240px)
  const leftPanel = document.createElement('div');
  leftPanel.className = 'deck-search-panel';
  leftPanel.style.cssText = `
    width: 280px; min-width: 240px; flex-shrink: 0;
    background: #14161C; overflow-y: auto; overflow-x: hidden;
    display: flex; flex-direction: column;
  `;

  // Centre panel: the 99 (flex)
  const centrePanel = document.createElement('div');
  centrePanel.className = 'deck-centre-panel';
  centrePanel.style.cssText = `
    flex: 1; background: #0B0C10; overflow-y: auto; overflow-x: hidden;
  `;

  // Right panel: analytics (280px / 240px)
  const rightPanel = document.createElement('div');
  rightPanel.className = 'deck-analytics-panel';
  rightPanel.style.cssText = `
    width: 280px; min-width: 240px; flex-shrink: 0;
    background: #14161C; overflow-y: auto; overflow-x: hidden;
    padding: 24px 16px;
  `;

  // Analytics panel header
  const analyticsHeader = document.createElement('div');
  analyticsHeader.style.cssText = 'margin-bottom: 24px;';
  analyticsHeader.innerHTML = `
    <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #0D52BD;">
      ARCHIVE ANALYTICS
    </span>
  `;
  rightPanel.appendChild(analyticsHeader);

  // Tag manager section
  const tagSection = document.createElement('div');
  tagSection.style.cssText = 'margin-bottom: 24px;';
  rightPanel.appendChild(tagSection);
  if (store?.activeDeck?.id) {
    renderTagManager(tagSection, store.activeDeck.id);
  }

  // Analytics placeholder (charts in Plan 04)
  const analyticsPlaceholder = document.createElement('div');
  analyticsPlaceholder.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; gap: 16px; text-align: center;';
  analyticsPlaceholder.innerHTML = `
    <span class="material-symbols-outlined" style="font-size: 48px; color: #4A5064;">analytics</span>
    <p style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; color: #7A8498;">
      Charts coming in Plan 04.
    </p>
  `;
  rightPanel.appendChild(analyticsPlaceholder);

  panelRow.appendChild(leftPanel);
  panelRow.appendChild(centrePanel);
  panelRow.appendChild(rightPanel);
  wrapper.appendChild(panelRow);
  container.appendChild(wrapper);

  // Responsive panel widths
  function applyResponsiveWidths() {
    const vw = window.innerWidth;
    if (vw >= 1280) {
      leftPanel.style.width = '280px';
      rightPanel.style.width = '280px';
    } else {
      leftPanel.style.width = '240px';
      rightPanel.style.width = '240px';
    }
  }
  applyResponsiveWidths();
  window.addEventListener('resize', applyResponsiveWidths);

  // Mount sub-panels
  renderDeckSearchPanel(leftPanel);
  renderDeckCentrePanel(centrePanel);

  // Init context menu
  const ctxMenu = initDeckContextMenu(container);

  // Cleanup
  container._editorCleanup = () => {
    window.removeEventListener('resize', applyResponsiveWidths);
    ctxMenu?.cleanup();
    tagSection._tagManagerCleanup?.();
    centrePanel._centreCleanup?.();
  };
}
