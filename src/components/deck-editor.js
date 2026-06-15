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

  // Phase 18 — "Brew with AI" button. Visible only when the deck has a
  // commander set; clicking opens the Brew modal which calls the
  // /api/deckgen endpoint via $store.deckgen.startBrew(). Spacer pushes it
  // to the right of the breadcrumb.
  const brewSpacer = document.createElement('div');
  brewSpacer.style.cssText = 'flex: 1;';
  breadcrumb.appendChild(brewSpacer);

  const brewBtn = document.createElement('button');
  brewBtn.style.cssText = `
    font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.15em; font-weight: 700; cursor: pointer; padding: 8px 16px;
    background: rgba(13,82,189,0.12); color: #0D52BD; border: 1px solid rgba(13,82,189,0.6);
    display: inline-flex; align-items: center; gap: 8px;
    transition: background 120ms ease-out, border-color 120ms ease-out;
  `;
  // 260607-sec: build the icon + label via createElement instead of
  // innerHTML — consistent with the 260530-sec audit cleanup that
  // refactored similar inline icon+text patterns to safe DOM methods.
  const brewBtnIcon = document.createElement('span');
  brewBtnIcon.className = 'material-symbols-outlined';
  brewBtnIcon.style.fontSize = '16px';
  brewBtnIcon.textContent = 'auto_awesome';
  brewBtn.appendChild(brewBtnIcon);
  brewBtn.appendChild(document.createTextNode('BREW WITH AI'));
  brewBtn.onmouseenter = () => {
    brewBtn.style.background = 'rgba(13,82,189,0.25)';
    brewBtn.style.borderColor = '#0D52BD';
  };
  brewBtn.onmouseleave = () => {
    brewBtn.style.background = 'rgba(13,82,189,0.12)';
    brewBtn.style.borderColor = 'rgba(13,82,189,0.6)';
  };
  function updateBrewVisibility() {
    const hasCommander = !!(Alpine?.store('deck')?.activeDeck?.commander_id);
    brewBtn.style.display = hasCommander ? 'inline-flex' : 'none';
    // Phase 20 — retune button shares the same gate. We also require
    // the deck to have at least 10 cards beyond the commander, since
    // there's nothing to retune in an empty/near-empty deck.
    const cardCount = (Alpine?.store('deck')?.activeCards || []).length;
    const hasEnoughForRetune = hasCommander && cardCount > 10;
    if (typeof retuneBtn !== 'undefined') {
      retuneBtn.style.display = hasEnoughForRetune ? 'inline-flex' : 'none';
    }
    // v1.3.x — CHAT WITH MILA shares the commander gate (chat can brew from
    // a near-empty deck, so it only needs a commander, like the brew button).
    if (typeof chatBtn !== 'undefined') {
      chatBtn.style.display = hasCommander ? 'inline-flex' : 'none';
    }
  }
  brewBtn.addEventListener('click', () => {
    if (!Alpine?.store('deck')?.activeDeck?.commander_id) return;
    Alpine.store('deckgen')?.openBrewModal('build');
  });
  breadcrumb.appendChild(brewBtn);

  // Phase 20 — "RETUNE" button. Same visibility gate as the BREW
  // button (commander required) but opens the modal pre-set to
  // retune mode so the user gets surgical swap recommendations
  // toward a target power level rather than a fresh brew.
  const retuneBtn = document.createElement('button');
  retuneBtn.style.cssText = `
    font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.15em; font-weight: 700; cursor: pointer; padding: 8px 16px;
    background: transparent; color: #7A8498; border: 1px solid #2A2D3A;
    display: inline-flex; align-items: center; gap: 8px; margin-left: 8px;
    transition: color 120ms ease-out, border-color 120ms ease-out;
  `;
  const retuneBtnIcon = document.createElement('span');
  retuneBtnIcon.className = 'material-symbols-outlined';
  retuneBtnIcon.style.fontSize = '16px';
  retuneBtnIcon.textContent = 'tune';
  retuneBtn.appendChild(retuneBtnIcon);
  retuneBtn.appendChild(document.createTextNode('RETUNE'));
  retuneBtn.onmouseenter = () => {
    retuneBtn.style.color = '#EAECEE';
    retuneBtn.style.borderColor = '#0D52BD';
  };
  retuneBtn.onmouseleave = () => {
    retuneBtn.style.color = '#7A8498';
    retuneBtn.style.borderColor = '#2A2D3A';
  };
  retuneBtn.addEventListener('click', () => {
    if (!Alpine?.store('deck')?.activeDeck?.commander_id) return;
    Alpine.store('deckgen')?.openBrewModal('retune');
  });
  breadcrumb.appendChild(retuneBtn);

  // v1.3.x — "CHAT WITH MILA" button. Opens the conversational brew drawer.
  // Same commander gate as BREW; gated behind sign-in at click time because
  // the /api/deckgen-chat endpoint requires a Supabase JWT.
  const chatBtn = document.createElement('button');
  chatBtn.style.cssText = `
    font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.15em; font-weight: 700; cursor: pointer; padding: 8px 16px;
    background: transparent; color: #7A8498; border: 1px solid #2A2D3A;
    display: inline-flex; align-items: center; gap: 8px; margin-left: 8px;
    transition: color 120ms ease-out, border-color 120ms ease-out;
  `;
  const chatBtnIcon = document.createElement('span');
  chatBtnIcon.className = 'material-symbols-outlined';
  chatBtnIcon.style.fontSize = '16px';
  chatBtnIcon.textContent = 'forum';
  chatBtn.appendChild(chatBtnIcon);
  chatBtn.appendChild(document.createTextNode('BREW CHAT'));
  chatBtn.onmouseenter = () => {
    chatBtn.style.color = '#EAECEE';
    chatBtn.style.borderColor = '#0D52BD';
  };
  chatBtn.onmouseleave = () => {
    chatBtn.style.color = '#7A8498';
    chatBtn.style.borderColor = '#2A2D3A';
  };
  chatBtn.addEventListener('click', () => {
    const deck = Alpine?.store('deck')?.activeDeck;
    if (!deck?.commander_id) return;
    if (!Alpine?.store('auth')?.session) {
      Alpine?.store('toast')?.error?.('Sign in to use Brew Chat.');
      return;
    }
    const power = typeof deck.power_level === 'number' ? deck.power_level : 5;
    Alpine.store('deckgenChat')?.openChat({
      deckId: deck.id,
      commanderId: deck.commander_id,
      powerLevel: power,
    });
  });
  breadcrumb.appendChild(chatBtn);
  // Re-evaluate visibility whenever the deck loads / changes.
  let brewVisibilityEffect = null;
  if (Alpine && typeof Alpine.effect === 'function') {
    brewVisibilityEffect = Alpine.effect(() => {
      // Touch the reactive properties so the effect retriggers on change.
      // eslint-disable-next-line no-unused-vars
      const _deck = Alpine.store('deck')?.activeDeck;
      // eslint-disable-next-line no-unused-vars
      const _cmdr = Alpine.store('deck')?.activeDeck?.commander_id;
      updateBrewVisibility();
    });
  } else {
    updateBrewVisibility();
  }

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
    // Phase 18 — tear down the Brew-button visibility effect so we don't
    // leak a reactive subscription after route navigation.
    if (brewVisibilityEffect && typeof Alpine?.release === 'function') {
      try { Alpine.release(brewVisibilityEffect); } catch {}
    }
    // Reset deckgen state when leaving the editor so a fresh open lands clean.
    try { Alpine?.store('deckgen')?.reset(); } catch {}
    // v1.3.x — same for the Mila Brew Chat drawer.
    try { Alpine?.store('deckgenChat')?.reset(); } catch {}
  };
}
