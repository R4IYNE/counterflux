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

// Per-session cache of partner-eligible cards by partner type. The catalog is
// static once bulk data has loaded, so we scan it at most once per type and
// reuse the deduped list across modal opens. `partner_with` resolves to a single
// named card (looked up by name), so it isn't cached here.
const _partnerCandidateCache = {};

/**
 * Enumerate the cards eligible as a partner of the given type, deduped by
 * oracle_id and sorted by name. `type_line` is indexed, so we narrow to
 * legendary cards (a few thousand) rather than scanning the whole ~30k catalog
 * — this covers legendary creatures (partner / friends-forever) and
 * "Legendary Enchantment — Background" cards.
 *
 * @param {'partner'|'background'|'friends_forever'} type
 * @returns {Promise<Object[]>}
 */
async function loadPartnerCandidates(type) {
  if (_partnerCandidateCache[type]) return _partnerCandidateCache[type];

  const { db } = await import('../db/schema.js');
  const legendary = await db.cards.where('type_line').startsWith('Legendary').toArray();

  let pred;
  if (type === 'background') pred = (c) => isBackground(c);
  else if (type === 'partner') pred = (c) => isLegendary(c) && hasPartner(c);
  else if (type === 'friends_forever') pred = (c) => isLegendary(c) && hasFriendsForever(c);
  else pred = () => false;

  const seen = new Set();
  const out = [];
  for (const c of legendary) {
    if (!pred(c)) continue;
    const key = c.oracle_id || c.name;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  out.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  _partnerCandidateCache[type] = out;
  return out;
}

/**
 * Brew a new storm modal wizard (formerly "Initialize Ritual").
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
        ${isChangeMode ? 'Change Commander' : 'Brew a new storm'}
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

      <!-- Step 2: SELECT PARTNER (conditional) — dropdown + card preview -->
      <div id="ritual-partner-section" style="display: none;">
        <label id="ritual-partner-label" style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #EAECEE; display: block; margin-bottom: 8px;">
          SELECT PARTNER
        </label>
        <select id="ritual-partner-select" style="width: 100%; box-sizing: border-box; background: #0B0C10; border: 1px solid #2A2D3A; color: #EAECEE; padding: 8px 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; outline: none; cursor: pointer;">
          <option value="">— NONE —</option>
        </select>
        <div id="ritual-partner-preview" style="display: none; margin-top: 8px;"></div>
      </div>

      <!-- Step 3: SELECT COMPANION (optional, only shown for companion commanders) -->
      <div id="ritual-companion-section" style="display: none;">
        <label style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #EAECEE; display: block; margin-bottom: 8px;">
          SELECT COMPANION
        </label>
        <select id="ritual-companion-select" style="width: 100%; box-sizing: border-box; background: #0B0C10; border: 1px solid #2A2D3A; color: #EAECEE; padding: 8px 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; outline: none; cursor: pointer;">
          <option value="">— NONE —</option>
          <option value="Gyruda, Doom of Depths">Gyruda, Doom of Depths</option>
          <option value="Jegantha, the Wellspring">Jegantha, the Wellspring</option>
          <option value="Kaheera, the Orphanguard">Kaheera, the Orphanguard</option>
          <option value="Keruga, the Macrosage">Keruga, the Macrosage</option>
          <option value="Lurrus of the Dream-Den">Lurrus of the Dream-Den</option>
          <option value="Lutri, the Spellchaser">Lutri, the Spellchaser</option>
          <option value="Obosh, the Preypiercer">Obosh, the Preypiercer</option>
          <option value="Umori, the Collector">Umori, the Collector</option>
          <option value="Yorion, Sky Nomad">Yorion, Sky Nomad</option>
          <option value="Zirda, the Dawnwaker">Zirda, the Dawnwaker</option>
        </select>
        <div id="ritual-companion-preview" style="display: none; margin-top: 8px;"></div>
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
          style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: var(--color-secondary, #E23838); background: transparent; border: none; cursor: pointer; padding: 8px 0;"
        >Abandon storm</button>
        <button
          id="ritual-confirm"
          disabled
          style="padding: 8px 16px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; background: #1C1F28; color: #4A5064; border: none; cursor: not-allowed; opacity: 0.5;"
        >${isChangeMode ? 'Change Commander' : 'Brew a new storm'}</button>
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
  let partnerOptionsByName = {}; // name -> card object for the current partner dropdown
  let partnerPopulateId = 0;     // guards against a stale async populate overwriting a newer one
  let debounceTimers = {};
  let searchIds = { commander: 0, partner: 0, companion: 0 };

  // ---- DOM refs ----
  const commanderSearch = overlay.querySelector('#ritual-commander-search');
  const commanderResults = overlay.querySelector('#ritual-commander-results');
  const commanderSelected = overlay.querySelector('#ritual-commander-selected');
  const partnerSection = overlay.querySelector('#ritual-partner-section');
  const partnerLabel = overlay.querySelector('#ritual-partner-label');
  const partnerSelect = overlay.querySelector('#ritual-partner-select');
  const partnerPreview = overlay.querySelector('#ritual-partner-preview');
  const companionSection = overlay.querySelector('#ritual-companion-section');
  const companionSelect = overlay.querySelector('#ritual-companion-select');
  const companionPreview = overlay.querySelector('#ritual-companion-preview');
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
      // renderSelectedCard is only used for the commander now; clearing it also
      // resets the partner + companion dropdowns and their previews.
      if (containerId === 'ritual-commander-selected') {
        selectedCommander = null;
        commanderSearch.value = '';
        commanderSearch.style.display = 'block';
        container.style.display = 'none';
        partnerSection.style.display = 'none';
        selectedPartner = null;
        partnerType = null;
        partnerWithTarget = null;
        partnerOptionsByName = {};
        partnerSelect.innerHTML = '<option value="">— NONE —</option>';
        renderCardPreview(null, 'ritual-partner-preview');
        companionSection.style.display = 'none';
        selectedCompanion = null;
        companionSelect.value = '';
        renderCardPreview(null, 'ritual-companion-preview');
        if (deckNameInput) deckNameInput.value = '';
      }
      updateColorIdentityDisplay();
      updateConfirmButton();
    });
  }

  /**
   * Render a card-image preview (image + name + mana + type) into a container,
   * or hide it when card is null. Used beneath the partner & companion
   * dropdowns so a selection shows the actual card.
   */
  function renderCardPreview(card, containerId) {
    const container = overlay.querySelector(`#${containerId}`);
    if (!container) return;
    if (!card) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }
    const img = getCardImage(card, 0, 'normal') || card.image_uris?.normal || card.image_uris?.small || '';
    const manaCost = getCardManaCost(card);
    const manaHtml = window.renderManaCost ? window.renderManaCost(manaCost) : manaCost;

    container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; padding: 8px; background: #1C1F28; border: 1px solid #2A2D3A;">
        ${img ? `<img src="${img}" alt="" style="width: 120px; height: auto; border-radius: 4px; flex-shrink: 0;" loading="lazy" onerror="this.style.display='none'">` : ''}
        <div style="display: flex; flex-direction: column; gap: 6px; min-width: 0;">
          <span style="font-family: 'Space Grotesk', sans-serif; font-size: 15px; font-weight: 700; color: #EAECEE;">${card.name}</span>
          <span>${manaHtml}</span>
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #7A8498;">${card.type_line || ''}</span>
        </div>
      </div>
    `;
    container.style.display = 'block';
  }

  /**
   * Fill the partner dropdown for the active commander's partner type and reset
   * any prior selection / preview. Async (scans the catalog the first time a
   * type is needed); guarded against a stale populate clobbering a newer one.
   */
  async function populatePartnerSelect() {
    const token = ++partnerPopulateId;
    selectedPartner = null;
    partnerOptionsByName = {};
    renderCardPreview(null, 'ritual-partner-preview');
    partnerSelect.innerHTML = '<option value="">— LOADING… —</option>';
    partnerSelect.disabled = true;

    let candidates = [];
    try {
      if (partnerType === 'partner_with' && partnerWithTarget) {
        const matches = await searchCards(partnerWithTarget, 5);
        candidates = matches.filter(c => c.name === partnerWithTarget);
      } else {
        candidates = await loadPartnerCandidates(partnerType);
      }
    } catch {
      candidates = [];
    }

    if (token !== partnerPopulateId) return; // a newer populate superseded this one

    // Exclude the chosen commander (by oracle_id, so a different printing of the
    // same card can't show up as its own partner).
    const cmdOracle = selectedCommander?.oracle_id;
    const filtered = candidates.filter(c => c.oracle_id !== cmdOracle);

    partnerSelect.innerHTML = '<option value="">— NONE —</option>';
    for (const c of filtered) {
      partnerOptionsByName[c.name] = c;
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.name;
      partnerSelect.appendChild(opt);
    }
    partnerSelect.disabled = false;
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

      // Check for partner mechanics — populate the partner dropdown by type.
      const oracleText = card.oracle_text || '';
      if (hasPartner(card) || hasFriendsForever(card)) {
        partnerType = hasPartner(card) ? 'partner' : 'friends_forever';
        partnerLabel.textContent = 'SELECT PARTNER';
        partnerSection.style.display = 'block';
        populatePartnerSelect();
      } else if (choosesBackground(card)) {
        partnerType = 'background';
        partnerLabel.textContent = 'SELECT BACKGROUND';
        partnerSection.style.display = 'block';
        populatePartnerSelect();
      } else if (/Partner with (.+?)(?:\n|$)/i.test(oracleText)) {
        partnerType = 'partner_with';
        partnerWithTarget = oracleText.match(/Partner with (.+?)(?:\n|$)/i)?.[1]?.trim() || null;
        partnerLabel.textContent = 'SELECT PARTNER';
        partnerSection.style.display = 'block';
        populatePartnerSelect();
      } else {
        partnerType = null;
        partnerWithTarget = null;
        partnerSection.style.display = 'none';
        selectedPartner = null;
        partnerOptionsByName = {};
        partnerSelect.innerHTML = '<option value="">— NONE —</option>';
        renderCardPreview(null, 'ritual-partner-preview');
      }

      // Companion field is only relevant when the commander itself has the
      // Companion keyword (no commander truly "requires" one, but per request we
      // surface it only for companion-capable commanders).
      if (isCompanion(card)) {
        companionSection.style.display = 'block';
      } else {
        companionSection.style.display = 'none';
        selectedCompanion = null;
        companionSelect.value = '';
      }

      updateColorIdentityDisplay();
      updateConfirmButton();
    }
  );

  // ---- Partner dropdown ----
  partnerSelect.addEventListener('change', () => {
    const name = partnerSelect.value;
    if (!name) {
      selectedPartner = null;
      renderCardPreview(null, 'ritual-partner-preview');
      if (deckNameInput && selectedCommander) deckNameInput.value = selectedCommander.name;
      updateColorIdentityDisplay();
      updateConfirmButton();
      return;
    }
    const card = partnerOptionsByName[name] || null;
    selectedPartner = card;
    renderCardPreview(card, 'ritual-partner-preview');
    if (deckNameInput && selectedCommander && card) {
      deckNameInput.value = `${selectedCommander.name} & ${card.name}`;
    }
    updateColorIdentityDisplay();
    updateConfirmButton();
  });

  // ---- Companion dropdown ----
  companionSelect.addEventListener('change', async () => {
    const name = companionSelect.value;
    if (!name) {
      selectedCompanion = null;
      renderCardPreview(null, 'ritual-companion-preview');
      return;
    }
    try {
      const matches = await searchCards(name, 5);
      selectedCompanion = matches.find(c => c.name === name) || matches[0] || null;
    } catch { selectedCompanion = null; }
    renderCardPreview(selectedCompanion, 'ritual-companion-preview');
  });

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

    // Loading cover — keep the modal up (now showing a spinner) so the user
    // doesn't see the deck list flash before the editor mounts. We close the
    // modal only once the editor has actually rendered (deck-editor-ready).
    const panel = overlay.querySelector('#ritual-panel');
    if (panel) {
      panel.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 48px 24px; text-align: center;">
          <span class="material-symbols-outlined cf-auth-spin" style="font-size: 40px; color: #0D52BD;">progress_activity</span>
          <div style="font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700; color: #EAECEE;">Brewing your storm…</div>
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #7A8498;">Opening the deck builder</div>
        </div>
      `;
    }

    const name = deckNameInput?.value?.trim() || selectedCommander.name;
    const format = formatSelect?.value || 'commander';
    const deckSize = getFormatSize();
    const colorIdentity = getCurrentColorIdentity();

    try {
      const newId = await store.createDeck({
        name,
        format,
        deck_size: deckSize,
        commander_id: selectedCommander.id,
        partner_id: selectedPartner?.id || null,
        companion_id: selectedCompanion?.id || null,
        color_identity: colorIdentity,
      });

      // Load the new deck so addCard can operate on it
      await store.loadDeck(newId);

      // Auto-add commander (and partner/companion) to the deck
      await store.addCard(selectedCommander.id, ['Commander']);
      if (selectedPartner) {
        await store.addCard(selectedPartner.id, ['Commander']);
      }
      if (selectedCompanion) {
        await store.addCard(selectedCompanion.id, ['Companion']);
      }

      toast?.success(`Deck "${name}" created. Begin brewing.`);

      // Close the modal only after the editor has rendered, so the deck list
      // never flashes. Fallback timeout covers a missed event.
      const onEditorReady = (e) => {
        if (!e.detail || e.detail.deckId === newId) {
          document.removeEventListener('deck-editor-ready', onEditorReady);
          clearTimeout(readyFallback);
          closeModal();
        }
      };
      const readyFallback = setTimeout(() => {
        document.removeEventListener('deck-editor-ready', onEditorReady);
        closeModal();
      }, 6000);
      document.addEventListener('deck-editor-ready', onEditorReady);

      // Navigate to editor (renders behind the loading cover)
      document.dispatchEvent(
        new CustomEvent('deck-open', { detail: { deckId: newId } })
      );
    } catch (err) {
      console.warn('[ritual] create deck failed', err);
      toast?.error?.('Could not create the deck — try again.');
      closeModal();
    }
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
