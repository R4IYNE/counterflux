import { searchCards } from '../db/search.js';
import { getCardImage, getCardManaCost } from '../db/card-accessor.js';
import {
  isLegendary,
  hasPartner,
  hasPartnerWith,
  choosesBackground,
  isBackground,
  isCompanion,
  hasFriendsForever,
  mergeColorIdentity,
} from '../utils/commander-detection.js';

/**
 * Initialize Ritual modal wizard.
 * Opens a multi-step form for deck creation (or Change Commander flow).
 *
 * @param {Object} [options]
 * @param {Object} [options.existingDeck] - If provided, opens in "Change Commander" mode
 */
export function openRitualModal(options = {}) {
  const isChangeMode = !!options.existingDeck;

  // Remove existing modal if present
  document.getElementById('ritual-modal')?.remove();

  const Alpine = window.Alpine;
  const store = Alpine?.store('deck');
  const toast = Alpine?.store('toast');

  const overlay = document.createElement('div');
  overlay.id = 'ritual-modal';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    z-index: 9999; display: flex; align-items: center; justify-content: center;
  `;

  overlay.innerHTML = `
    <!-- Glass backdrop -->
    <div id="ritual-backdrop" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6);"></div>

    <!-- Modal panel -->
    <div id="ritual-panel" style="position: relative; z-index: 10; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; background: #14161C; border: 1px solid #2A2D3A; padding: 32px; display: flex; flex-direction: column; gap: 24px;">

      <!-- Title -->
      <h2 style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; line-height: 1.2; letter-spacing: 0.01em; color: #EAECEE; margin: 0;">
        ${isChangeMode ? 'Change Commander' : 'Initialize Ritual'}
      </h2>

      <!-- Step 1: SELECT COMMANDER -->
      <div>
        <label style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #EAECEE; display: block; margin-bottom: 8px;">
          SELECT COMMANDER
        </label>
        <div style="position: relative;">
          <input
            id="ritual-commander-search"
            type="text"
            placeholder="SEARCH LEGENDARY CREATURES..."
            autocomplete="off"
            style="width: 100%; box-sizing: border-box; background: #0B0C10; border: 1px solid #2A2D3A; color: #EAECEE; padding: 8px 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; outline: none;"
            onfocus="this.style.borderColor='#0D52BD'"
            onblur="setTimeout(() => this.style.borderColor='#2A2D3A', 200)"
          >
          <div id="ritual-commander-results" style="display: none; position: absolute; top: 100%; left: 0; right: 0; margin-top: 4px; background: #14161C; border: 1px solid #2A2D3A; max-height: 240px; overflow-y: auto; z-index: 20;"></div>
        </div>
        <div id="ritual-commander-selected" style="display: none; margin-top: 8px;"></div>
      </div>

      <!-- Step 2: SELECT PARTNER (conditional) -->
      <div id="ritual-partner-section" style="display: none;">
        <label id="ritual-partner-label" style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #EAECEE; display: block; margin-bottom: 8px;">
          SELECT PARTNER
        </label>
        <div style="position: relative;">
          <input
            id="ritual-partner-search"
            type="text"
            placeholder="SEARCH PARTNER COMMANDER..."
            autocomplete="off"
            style="width: 100%; box-sizing: border-box; background: #0B0C10; border: 1px solid #2A2D3A; color: #EAECEE; padding: 8px 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; outline: none;"
            onfocus="this.style.borderColor='#0D52BD'"
            onblur="setTimeout(() => this.style.borderColor='#2A2D3A', 200)"
          >
          <div id="ritual-partner-results" style="display: none; position: absolute; top: 100%; left: 0; right: 0; margin-top: 4px; background: #14161C; border: 1px solid #2A2D3A; max-height: 240px; overflow-y: auto; z-index: 20;"></div>
        </div>
        <div id="ritual-partner-selected" style="display: none; margin-top: 8px;"></div>
      </div>

      <!-- Step 3: SELECT COMPANION (optional, always visible) -->
      <div>
        <label style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #EAECEE; display: block; margin-bottom: 8px;">
          SELECT COMPANION
        </label>
        <div style="position: relative;">
          <input
            id="ritual-companion-search"
            type="text"
            placeholder="SEARCH COMPANION..."
            autocomplete="off"
            style="width: 100%; box-sizing: border-box; background: #0B0C10; border: 1px solid #2A2D3A; color: #EAECEE; padding: 8px 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; outline: none;"
            onfocus="this.style.borderColor='#0D52BD'"
            onblur="setTimeout(() => this.style.borderColor='#2A2D3A', 200)"
          >
          <div id="ritual-companion-results" style="display: none; position: absolute; top: 100%; left: 0; right: 0; margin-top: 4px; background: #14161C; border: 1px solid #2A2D3A; max-height: 240px; overflow-y: auto; z-index: 20;"></div>
        </div>
        <div id="ritual-companion-selected" style="display: none; margin-top: 8px;"></div>
      </div>

      <!-- Step 4: NAME YOUR DECK -->
      ${isChangeMode ? '' : `
      <div>
        <label style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #EAECEE; display: block; margin-bottom: 8px;">
          NAME YOUR DECK
        </label>
        <input
          id="ritual-deck-name"
          type="text"
          placeholder="DECK NAME..."
          autocomplete="off"
          style="width: 100%; box-sizing: border-box; background: #0B0C10; border: 1px solid #2A2D3A; color: #EAECEE; padding: 8px 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; outline: none;"
          onfocus="this.style.borderColor='#0D52BD'"
          onblur="this.style.borderColor='#2A2D3A'"
        >
      </div>
      `}

      <!-- Step 5: FORMAT and COLOUR IDENTITY -->
      <div style="display: flex; gap: 24px; align-items: flex-start;">
        ${isChangeMode ? '' : `
        <div style="flex: 1;">
          <label style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #EAECEE; display: block; margin-bottom: 8px;">
            FORMAT
          </label>
          <select
            id="ritual-format"
            style="width: 100%; box-sizing: border-box; background: #0B0C10; border: 1px solid #2A2D3A; color: #EAECEE; padding: 8px 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; outline: none; cursor: pointer;"
          >
            <option value="commander" selected>Commander (100)</option>
            <option value="standard">Standard (60)</option>
            <option value="modern">Modern (60)</option>
            <option value="legacy">Legacy (60)</option>
            <option value="vintage">Vintage (60)</option>
            <option value="pauper">Pauper (60)</option>
          </select>
        </div>
        `}
        <div style="flex: 1;">
          <label style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #EAECEE; display: block; margin-bottom: 8px;">
            COLOUR IDENTITY
          </label>
          <div id="ritual-color-identity" style="display: flex; gap: 4px; min-height: 24px; align-items: center;">
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #4A5064;">SELECT A COMMANDER</span>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 8px;">
        <button
          id="ritual-abandon"
          style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 400; color: #7A8498; background: transparent; border: none; cursor: pointer; padding: 8px 0;"
        >Abandon Ritual</button>
        <button
          id="ritual-confirm"
          disabled
          style="padding: 8px 16px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; background: #1C1F28; color: #4A5064; border: none; cursor: not-allowed; opacity: 0.5;"
        >${isChangeMode ? 'Change Commander' : 'Begin Ritual'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // ---- State ----
  let selectedCommander = null;
  let selectedPartner = null;
  let selectedCompanion = null;
  let partnerType = null; // 'partner' | 'friends_forever' | 'background' | 'partner_with'
  let partnerWithTarget = null; // name of the specific partner for "Partner with"
  let debounceTimers = {};
  let searchIds = { commander: 0, partner: 0, companion: 0 };

  // ---- DOM refs ----
  const commanderSearch = overlay.querySelector('#ritual-commander-search');
  const commanderResults = overlay.querySelector('#ritual-commander-results');
  const commanderSelected = overlay.querySelector('#ritual-commander-selected');
  const partnerSection = overlay.querySelector('#ritual-partner-section');
  const partnerLabel = overlay.querySelector('#ritual-partner-label');
  const partnerSearch = overlay.querySelector('#ritual-partner-search');
  const partnerResults = overlay.querySelector('#ritual-partner-results');
  const partnerSelected = overlay.querySelector('#ritual-partner-selected');
  const companionSearch = overlay.querySelector('#ritual-companion-search');
  const companionResults = overlay.querySelector('#ritual-companion-results');
  const companionSelected = overlay.querySelector('#ritual-companion-selected');
  const deckNameInput = overlay.querySelector('#ritual-deck-name');
  const formatSelect = overlay.querySelector('#ritual-format');
  const colorIdentityDisplay = overlay.querySelector('#ritual-color-identity');
  const confirmBtn = overlay.querySelector('#ritual-confirm');
  const abandonBtn = overlay.querySelector('#ritual-abandon');
  const backdrop = overlay.querySelector('#ritual-backdrop');

  // ---- Helpers ----

  function closeModal() {
    overlay.remove();
    document.removeEventListener('keydown', handleEscape);
  }

  function handleEscape(e) {
    if (e.key === 'Escape') closeModal();
  }
  document.addEventListener('keydown', handleEscape);

  function getFormatSize() {
    if (!formatSelect) return 100;
    const val = formatSelect.value;
    return val === 'commander' ? 100 : 60;
  }

  function updateConfirmButton() {
    const enabled = !!selectedCommander;
    confirmBtn.disabled = !enabled;
    confirmBtn.style.background = enabled ? '#0D52BD' : '#1C1F28';
    confirmBtn.style.color = enabled ? '#EAECEE' : '#4A5064';
    confirmBtn.style.cursor = enabled ? 'pointer' : 'not-allowed';
    confirmBtn.style.opacity = enabled ? '1' : '0.5';
  }

  function getCurrentColorIdentity() {
    const ci1 = selectedCommander?.color_identity || [];
    const ci2 = selectedPartner?.color_identity || [];
    return mergeColorIdentity(ci1, ci2);
  }

  function updateColorIdentityDisplay() {
    const colors = getCurrentColorIdentity();
    if (colors.length === 0) {
      colorIdentityDisplay.innerHTML = `<span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #4A5064;">COLORLESS</span>`;
      return;
    }
    const manaMap = { W: 'ms-w', U: 'ms-u', B: 'ms-b', R: 'ms-r', G: 'ms-g' };
    colorIdentityDisplay.innerHTML = colors
      .map(c => `<i class="ms ${manaMap[c] || ''} ms-cost" style="font-size: 18px;"></i>`)
      .join(' ');
  }

  function renderCardResult(card) {
    const thumb = card.image_uris?.small || '';
    const manaCost = getCardManaCost(card);
    const manaHtml = window.renderManaCost ? window.renderManaCost(manaCost) : manaCost;
    const colors = (card.color_identity || []).join('');

    const btn = document.createElement('button');
    btn.style.cssText = `
      width: 100%; display: flex; align-items: center; gap: 8px; padding: 8px 12px;
      text-align: left; cursor: pointer; background: transparent; border: none; color: #EAECEE;
    `;
    btn.onmouseenter = () => { btn.style.background = '#1C1F28'; };
    btn.onmouseleave = () => { btn.style.background = 'transparent'; };

    btn.innerHTML = `
      ${thumb ? `<img src="${thumb}" alt="" style="width: 32px; height: auto; object-fit: contain; flex-shrink: 0;" loading="lazy" onerror="this.style.display='none'">` : ''}
      <span style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; color: #EAECEE; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${card.name}</span>
      <span style="flex-shrink: 0;">${manaHtml}</span>
    `;
    return btn;
  }

  function renderSelectedCard(card, containerId) {
    const container = overlay.querySelector(`#${containerId}`);
    if (!container) return;
    const thumb = card.image_uris?.small || '';
    const manaCost = getCardManaCost(card);
    const manaHtml = window.renderManaCost ? window.renderManaCost(manaCost) : manaCost;

    container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: #1C1F28; border: 1px solid #2A2D3A;">
        ${thumb ? `<img src="${thumb}" alt="" style="width: 32px; height: auto; object-fit: contain;" loading="lazy" onerror="this.style.display='none'">` : ''}
        <span style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 700; color: #EAECEE; flex: 1;">${card.name}</span>
        <span style="flex-shrink: 0;">${manaHtml}</span>
        <button id="${containerId}-clear" style="background: transparent; border: none; color: #7A8498; cursor: pointer; font-size: 16px; padding: 4px;">&times;</button>
      </div>
    `;
    container.style.display = 'block';

    container.querySelector(`#${containerId}-clear`).addEventListener('click', () => {
      if (containerId === 'ritual-commander-selected') {
        selectedCommander = null;
        commanderSearch.value = '';
        commanderSearch.style.display = 'block';
        container.style.display = 'none';
        partnerSection.style.display = 'none';
        selectedPartner = null;
        partnerType = null;
        partnerWithTarget = null;
        if (deckNameInput) deckNameInput.value = '';
      } else if (containerId === 'ritual-partner-selected') {
        selectedPartner = null;
        partnerSearch.value = '';
        partnerSearch.style.display = 'block';
        container.style.display = 'none';
        if (deckNameInput && selectedCommander) {
          deckNameInput.value = selectedCommander.name;
        }
      } else if (containerId === 'ritual-companion-selected') {
        selectedCompanion = null;
        companionSearch.value = '';
        companionSearch.style.display = 'block';
        container.style.display = 'none';
      }
      updateColorIdentityDisplay();
      updateConfirmButton();
    });
  }

  function setupAutocomplete(inputEl, resultsEl, filterFn, onSelect) {
    const slotKey = inputEl.id;
    inputEl.addEventListener('input', () => {
      const query = inputEl.value.trim();
      clearTimeout(debounceTimers[slotKey]);

      if (!query || query.length < 2) {
        resultsEl.style.display = 'none';
        resultsEl.innerHTML = '';
        return;
      }

      const thisId = ++searchIds[slotKey] || ++searchIds.commander;
      debounceTimers[slotKey] = setTimeout(async () => {
        try {
          const allCards = await searchCards(query, 20);
          const filtered = allCards.filter(filterFn);
          const limited = filtered.slice(0, 8);

          // Check for stale search
          if ((searchIds[slotKey] || searchIds.commander) !== thisId) return;

          resultsEl.innerHTML = '';
          if (limited.length === 0) {
            resultsEl.innerHTML = `<div style="padding: 8px 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #7A8498;">No legendary creatures match your query.</div>`;
            resultsEl.style.display = 'block';
            return;
          }

          for (const card of limited) {
            const btn = renderCardResult(card);
            btn.addEventListener('click', () => {
              onSelect(card);
              resultsEl.style.display = 'none';
              resultsEl.innerHTML = '';
            });
            resultsEl.appendChild(btn);
          }
          resultsEl.style.display = 'block';
        } catch {
          resultsEl.style.display = 'none';
        }
      }, 150);
    });
  }

  // ---- Commander autocomplete ----
  setupAutocomplete(
    commanderSearch,
    commanderResults,
    (card) => isLegendary(card),
    (card) => {
      selectedCommander = card;
      commanderSearch.style.display = 'none';
      renderSelectedCard(card, 'ritual-commander-selected');

      // Auto-fill deck name
      if (deckNameInput) {
        deckNameInput.value = card.name;
      }

      // Check for partner mechanics
      const oracleText = card.oracle_text || '';
      if (hasPartner(card) || hasFriendsForever(card)) {
        partnerType = hasPartner(card) ? 'partner' : 'friends_forever';
        partnerSection.style.display = 'block';
        partnerLabel.textContent = 'SELECT PARTNER';
        partnerSearch.placeholder = 'SEARCH PARTNER COMMANDER...';
      } else if (choosesBackground(card)) {
        partnerType = 'background';
        partnerSection.style.display = 'block';
        partnerLabel.textContent = 'SELECT BACKGROUND';
        partnerSearch.placeholder = 'SEARCH BACKGROUND...';
      } else if (/Partner with (.+?)(?:\n|$)/i.test(oracleText)) {
        partnerType = 'partner_with';
        partnerWithTarget = oracleText.match(/Partner with (.+?)(?:\n|$)/i)?.[1]?.trim() || null;
        partnerSection.style.display = 'block';
        partnerLabel.textContent = 'SELECT PARTNER';
        partnerSearch.placeholder = partnerWithTarget
          ? `SEARCH FOR ${partnerWithTarget.toUpperCase()}...`
          : 'SEARCH PARTNER COMMANDER...';
      } else {
        partnerType = null;
        partnerWithTarget = null;
        partnerSection.style.display = 'none';
        selectedPartner = null;
      }

      updateColorIdentityDisplay();
      updateConfirmButton();
    }
  );

  // ---- Partner autocomplete ----
  setupAutocomplete(
    partnerSearch,
    partnerResults,
    (card) => {
      if (partnerType === 'background') {
        return isBackground(card);
      }
      if (partnerType === 'partner_with' && partnerWithTarget) {
        return card.name === partnerWithTarget;
      }
      if (partnerType === 'partner') {
        return isLegendary(card) && hasPartner(card) && card.id !== selectedCommander?.id;
      }
      if (partnerType === 'friends_forever') {
        return isLegendary(card) && hasFriendsForever(card) && card.id !== selectedCommander?.id;
      }
      return false;
    },
    (card) => {
      selectedPartner = card;
      partnerSearch.style.display = 'none';
      renderSelectedCard(card, 'ritual-partner-selected');

      // Update deck name suggestion
      if (deckNameInput && selectedCommander) {
        deckNameInput.value = `${selectedCommander.name} & ${card.name}`;
      }

      updateColorIdentityDisplay();
      updateConfirmButton();
    }
  );

  // ---- Companion autocomplete ----
  setupAutocomplete(
    companionSearch,
    companionResults,
    (card) => isCompanion(card),
    (card) => {
      selectedCompanion = card;
      companionSearch.style.display = 'none';
      renderSelectedCard(card, 'ritual-companion-selected');
    }
  );

  // ---- Confirm ----
  confirmBtn.addEventListener('click', async () => {
    if (!selectedCommander) return;

    if (isChangeMode && options.existingDeck && store) {
      // Change Commander flow
      const newColorIdentity = getCurrentColorIdentity();
      await store.changeCommander(
        options.existingDeck.id,
        selectedCommander.id,
        newColorIdentity
      );
      toast?.success(`Commander changed to ${selectedCommander.name}.`);
      closeModal();
      return;
    }

    // Create deck flow
    if (!store) return;

    const name = deckNameInput?.value?.trim() || selectedCommander.name;
    const format = formatSelect?.value || 'commander';
    const deckSize = getFormatSize();
    const colorIdentity = getCurrentColorIdentity();

    const newId = await store.createDeck({
      name,
      format,
      deck_size: deckSize,
      commander_id: selectedCommander.id,
      partner_id: selectedPartner?.id || null,
      companion_id: selectedCompanion?.id || null,
      color_identity: colorIdentity,
    });

    toast?.success(`Deck "${name}" created. Begin brewing.`);
    closeModal();

    // Navigate to editor
    document.dispatchEvent(
      new CustomEvent('deck-open', { detail: { deckId: newId } })
    );
  });

  // ---- Abandon / close ----
  abandonBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);

  // ---- Pre-fill for Change Commander mode ----
  if (isChangeMode && options.existingDeck) {
    const deck = options.existingDeck;
    if (deck.commander_id) {
      // Load commander card data asynchronously
      import('../db/schema.js').then(async ({ db }) => {
        const card = await db.cards.get(deck.commander_id);
        if (card) {
          selectedCommander = card;
          commanderSearch.style.display = 'none';
          renderSelectedCard(card, 'ritual-commander-selected');
          updateColorIdentityDisplay();
          updateConfirmButton();
        }
      }).catch(() => {});
    }
  }
}
