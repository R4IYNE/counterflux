import { renderDeckSearchPanel } from './deck-search-panel.js';
import { renderDeckCentrePanel } from './deck-centre-panel.js';
import { initDeckContextMenu } from './deck-context-menu.js';
import { renderDeckAnalyticsPanel, destroyDeckCharts } from './deck-analytics-panel.js';
import { renderDeckgenBrewModal } from './deckgen-brew-modal.js';
import { renderDeckgenReviewScreen } from './deckgen-review-screen.js';

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

  // Delete this deck — right-aligned destructive action. Opens the same
  // confirmation modal as the archive's context menu; on confirm it deletes
  // (with the 10s undo toast) and navigates back to the landing since the
  // open deck no longer exists.
  const deleteBtn = document.createElement('button');
  deleteBtn.setAttribute('aria-label', 'Delete this deck');
  deleteBtn.title = 'Delete this deck';
  deleteBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">delete</span><span>DELETE</span>';
  deleteBtn.style.cssText = `
    margin-left: auto; display: inline-flex; align-items: center; gap: 6px;
    font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.15em; font-weight: 700; cursor: pointer; padding: 8px 12px;
    background: transparent; color: #7A8498; border: 1px solid #2A2D3A;
  `;
  deleteBtn.onmouseenter = () => { deleteBtn.style.color = '#E23838'; deleteBtn.style.borderColor = '#E23838'; };
  deleteBtn.onmouseleave = () => { deleteBtn.style.color = '#7A8498'; deleteBtn.style.borderColor = '#2A2D3A'; };
  deleteBtn.addEventListener('click', async () => {
    const deck = store?.activeDeck;
    if (!deck) return;
    const { openDeleteDeckModal } = await import('./delete-deck-modal.js');
    openDeleteDeckModal(deck.id, deck.name, {
      afterDelete: () => document.dispatchEvent(new CustomEvent('deck-back-to-landing')),
    });
  });
  breadcrumb.appendChild(deleteBtn);

  wrapper.appendChild(breadcrumb);

  // Three-panel row
  const panelRow = document.createElement('div');
  panelRow.style.cssText = 'display: flex; flex: 1; overflow: hidden;';

  // Left panel: search (280px / 240px)
  // v1.2 hot-fix: position: sticky + top: 0 + align-self: flex-start so the
  // panel stays pinned when the centre panel scrolls. The flex parent's
  // overflow: hidden caps height to viewport; the panel's own overflow-y:
  // auto handles scrolling within the LHS when its content exceeds height.
  // Net effect: search bar + filters + results stay in view as the user
  // scrolls through a long deck.
  const leftPanel = document.createElement('div');
  leftPanel.className = 'deck-search-panel';
  leftPanel.style.cssText = `
    width: 280px; min-width: 240px; flex-shrink: 0;
    background: #14161C; overflow-y: auto; overflow-x: hidden;
    display: flex; flex-direction: column;
    position: sticky; top: 0; align-self: flex-start;
    max-height: 100%;
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

  // Analytics panel (mana curve, colour pie, type/tag breakdown, price summary)
  const analyticsContainer = document.createElement('div');
  rightPanel.appendChild(analyticsContainer);
  renderDeckAnalyticsPanel(analyticsContainer);

  panelRow.appendChild(leftPanel);
  panelRow.appendChild(centrePanel);
  panelRow.appendChild(rightPanel);
  wrapper.appendChild(panelRow);

  // Phase 18 — mount the deckgen Brew modal + review screen as siblings
  // of the panel row. Both are position:fixed; they overlay everything
  // when their Alpine x-show conditions evaluate true. Injecting via
  // innerHTML is safe here — the rendered HTML is a pure static template
  // (no user input is interpolated; all dynamic data comes from the
  // Alpine store at runtime, which uses safe Alpine bindings).
  const deckgenOverlay = document.createElement('div');
  deckgenOverlay.innerHTML = renderDeckgenBrewModal() + renderDeckgenReviewScreen();
  wrapper.appendChild(deckgenOverlay);

  // v1.3.x — lazy-load the Mila Brew Chat panel so it lands in its own chunk
  // (keeps the thousand-year screen bundle under its 40 KB budget). Alpine's
  // MutationObserver binds the injected subtree once it's appended, so the
  // CHAT WITH MILA button's x-show reacts as soon as this resolves (ms after
  // mount, well before any click).
  import('./deckgen-chat-panel.js')
    .then(({ renderDeckgenChatPanel }) => {
      const chatMount = document.createElement('div');
      chatMount.innerHTML = renderDeckgenChatPanel();
      deckgenOverlay.appendChild(chatMount);
    })
    .catch(() => { /* non-fatal — chat just won't be available this mount */ });

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

  // 260608: deep-link consumer. If the dashboard widget or Preordain
  // section queued an action for the currently-loaded deck, auto-open
  // the brew modal in the requested mode. consumePendingAction is
  // idempotent — clears state on read so re-mounts don't repeat the
  // modal-open.
  const deckgen = Alpine?.store('deckgen');
  const activeDeck = Alpine?.store('deck')?.activeDeck;
  if (deckgen && activeDeck?.id) {
    const action = deckgen.consumePendingAction(activeDeck.id);
    if (action === 'upgrade' || action === 'retune' || action === 'brew') {
      // Microtask defers until the editor + overlay HTML is in the
      // DOM and Alpine has bound everything before the modal opens.
      queueMicrotask(() => {
        // 'brew' → modal 'build' (the default fresh-brew flow).
        // 'retune' → Sonnet swap pairs. 'upgrade' → Opus swap pairs.
        deckgen.openBrewModal(action === 'brew' ? 'build' : action);
      });
    }
  }

  // Cleanup
  container._editorCleanup = () => {
    window.removeEventListener('resize', applyResponsiveWidths);
    ctxMenu?.cleanup();
    centrePanel._centreCleanup?.();
    analyticsContainer._analyticsCleanup?.();
    destroyDeckCharts();
    // Reset deckgen state when leaving the editor so a fresh open lands clean.
    try { Alpine?.store('deckgen')?.reset(); } catch {}
    // v1.3.x — same for the Mila Brew Chat drawer.
    try { Alpine?.store('deckgenChat')?.reset(); } catch {}
  };
}
