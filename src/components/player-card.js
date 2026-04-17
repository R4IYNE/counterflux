/**
 * Player Card -- displays a player's life, poison, tax, and commander damage.
 * Supports collapsed/expanded states and long-press acceleration for life adjustments.
 */

import { setupLongPress } from './life-adjuster.js';
import { renderCommanderDamageTracker } from './commander-damage-tracker.js';

/** Track all long-press cleanup functions for teardown */
const _cleanups = [];

/**
 * Render a single player card.
 * @param {number} playerIndex - Index in $store.game.players
 * @returns {string} HTML string with Alpine.js bindings
 */
export function renderPlayerCard(playerIndex) {
  return `
    <div class="ghost-border p-[16px] flex flex-col gap-[8px] cursor-pointer relative"
         :class="'player-border-' + ($store.game.players[${playerIndex}]?.color_index + 1)"
         style="background: #14161C; transition: max-height 200ms ease-in-out; overflow: hidden;"
         @click="$store.game.toggleExpanded(${playerIndex})">

      <!-- Eliminated overlay -->
      <template x-if="$store.game.players[${playerIndex}]?.eliminated">
        <div class="absolute inset-0 flex items-center justify-center z-10"
             style="background: rgba(226, 56, 56, 0.2);">
          <span class="syne-header text-[20px] font-bold" style="color: #E23838;">ELIMINATED</span>
        </div>
      </template>

      <!-- Player name -->
      <div class="flex items-center justify-between">
        <span class="syne-header text-[20px] font-bold"
              style="color: #EAECEE;"
              x-text="$store.game.players[${playerIndex}]?.name || 'Player'"></span>
      </div>

      <!-- Commander name -->
      <span class="font-mono text-[11px] tracking-[0.15em]"
            style="color: #7A8498;"
            x-text="$store.game.players[${playerIndex}]?.commander || ''"></span>

      <!-- Life total with +/- buttons -->
      <div class="flex items-center justify-center gap-[16px] py-[8px]" @click.stop>
        <!-- Minus button -->
        <button
          class="flex items-center justify-center w-[48px] h-[48px] cursor-pointer"
          style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;"
          data-life-btn="minus-${playerIndex}"
          aria-label="Decrease life total">
          <span class="material-symbols-outlined" style="font-size: 24px;">remove</span>
        </button>

        <!-- Life total display -->
        <span class="syne-header text-[48px] font-bold min-w-[80px] text-center select-none"
              style="color: #EAECEE; transition: transform 150ms ease-out;"
              data-life-display="${playerIndex}"
              x-text="$store.game.players[${playerIndex}]?.life ?? 40"></span>

        <!-- Plus button -->
        <button
          class="flex items-center justify-center w-[48px] h-[48px] cursor-pointer"
          style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;"
          data-life-btn="plus-${playerIndex}"
          aria-label="Increase life total">
          <span class="material-symbols-outlined" style="font-size: 24px;">add</span>
        </button>
      </div>

      <!-- Poison counter -->
      <div class="flex items-center justify-between px-[8px]" @click.stop
           :class="($store.game.players[${playerIndex}]?.poison || 0) >= 10 ? 'lethal-highlight' : ''">
        <span class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold"
              style="color: #7A8498;">POISON</span>
        <div class="flex items-center gap-[8px]">
          <button
            @click="$store.game.adjustPoison(${playerIndex}, -1)"
            class="flex items-center justify-center w-[32px] h-[32px] cursor-pointer"
            style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;"
            aria-label="Decrease poison">
            <span class="material-symbols-outlined" style="font-size: 16px;">remove</span>
          </button>
          <span class="font-mono text-[11px] font-bold min-w-[24px] text-center"
                :style="($store.game.players[${playerIndex}]?.poison || 0) >= 10 ? 'color: #E23838;' : 'color: #EAECEE;'"
                x-text="$store.game.players[${playerIndex}]?.poison ?? 0"></span>
          <button
            @click="$store.game.adjustPoison(${playerIndex}, 1)"
            class="flex items-center justify-center w-[32px] h-[32px] cursor-pointer"
            style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;"
            aria-label="Increase poison">
            <span class="material-symbols-outlined" style="font-size: 16px;">add</span>
          </button>
        </div>
      </div>

      <!-- Tax counter -->
      <div class="flex items-center justify-between px-[8px]" @click.stop>
        <span class="font-mono text-[11px] tracking-[0.15em]"
              style="color: #7A8498;">
          TAX: <span x-text="$store.game.players[${playerIndex}]?.tax_count ?? 0"></span>
          (<span x-text="($store.game.players[${playerIndex}]?.tax_count ?? 0) * 2"></span>)
        </span>
        <div class="flex items-center gap-[8px]">
          <button
            @click="$store.game.adjustTax(${playerIndex}, -1)"
            class="flex items-center justify-center w-[32px] h-[32px] cursor-pointer"
            style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;"
            aria-label="Decrease tax">
            <span class="material-symbols-outlined" style="font-size: 16px;">remove</span>
          </button>
          <button
            @click="$store.game.adjustTax(${playerIndex}, 1)"
            class="flex items-center justify-center w-[32px] h-[32px] cursor-pointer"
            style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;"
            aria-label="Increase tax">
            <span class="material-symbols-outlined" style="font-size: 16px;">add</span>
          </button>
        </div>
      </div>

      <!-- Mobile tap hint -->
      <span class="md:hidden text-center"
            style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; line-height: 1.5; color: #7A8498;">TAP FOR DETAILS</span>

      <!-- Expanded content -->
      <template x-if="$store.game.expandedPlayer === ${playerIndex}">
        <div @click.stop>
          <!-- Commander damage tracker -->
          ${renderCommanderDamageTracker(playerIndex)}

          <!-- Additional counters -->
          <template x-if="Object.keys($store.game.players[${playerIndex}]?.counters || {}).length > 0">
            <div class="flex flex-col gap-[8px] mt-[16px]">
              <span class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold"
                    style="color: #7A8498;">COUNTERS</span>
              <template x-for="(val, name) in ($store.game.players[${playerIndex}]?.counters || {})" :key="name">
                <div class="flex items-center justify-between px-[8px] py-[4px]">
                  <span class="font-mono text-[11px] uppercase tracking-[0.15em]"
                        style="color: #7A8498;" x-text="name"></span>
                  <div class="flex items-center gap-[8px]">
                    <button
                      @click="$store.game.adjustCounter(${playerIndex}, name, -1)"
                      class="flex items-center justify-center w-[32px] h-[32px] cursor-pointer"
                      style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;">
                      <span class="material-symbols-outlined" style="font-size: 16px;">remove</span>
                    </button>
                    <span class="font-mono text-[11px] font-bold min-w-[24px] text-center"
                          style="color: #EAECEE;" x-text="val"></span>
                    <button
                      @click="$store.game.adjustCounter(${playerIndex}, name, 1)"
                      class="flex items-center justify-center w-[32px] h-[32px] cursor-pointer"
                      style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;">
                      <span class="material-symbols-outlined" style="font-size: 16px;">add</span>
                    </button>
                  </div>
                </div>
              </template>
            </div>
          </template>
        </div>
      </template>

    </div>
  `;
}

/**
 * Render the full player grid (2x2 on desktop, single column on mobile).
 * Wire long-press acceleration after DOM render.
 * @returns {string} HTML string with Alpine.js bindings
 */
export function renderPlayerGrid() {
  return `
    <div :class="$store.game.players.length === 3 ? 'cf-player-grid-3 pb-[80px]' : 'grid grid-cols-1 md:grid-cols-2 gap-[16px] pb-[80px]'"
         x-data
         x-init="$nextTick(() => { wireLifeButtons($el); })">
      <template x-for="(player, pIdx) in $store.game.players" :key="pIdx">
        <div class="ghost-border p-[16px] flex flex-col gap-[8px] cursor-pointer relative"
             :class="'player-border-' + (player.color_index + 1) + ' ' + ($store.game.activePlayerIndex === pIdx ? 'cf-player-active' : '')"
             style="background: #14161C; padding-bottom: 16px; transition: max-height 200ms ease-in-out, border-color 200ms ease-out, box-shadow 200ms ease-out; overflow: hidden;"
             @click="$store.game.toggleExpanded(pIdx)">

          <!-- Eliminated overlay -->
          <template x-if="player.eliminated">
            <div class="absolute inset-0 flex items-center justify-center z-10"
                 style="background: rgba(226, 56, 56, 0.2);">
              <span class="syne-header text-[20px] font-bold" style="color: #E23838;">ELIMINATED</span>
            </div>
          </template>

          <!-- Player name + expand icon (GAME-01: ellipsis-truncate, full name in :title) -->
          <div class="flex items-center justify-between" style="min-width: 0; gap: 8px;">
            <span class="syne-header text-[20px] font-bold"
                  style="color: #EAECEE; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1;"
                  :title="player.name || 'Player'"
                  x-text="player.name || 'Player'"></span>
            <span class="material-symbols-outlined transition-transform"
                  :style="$store.game.expandedPlayer === pIdx ? 'transform: rotate(180deg); color: #0D52BD;' : 'color: #7A8498;'"
                  style="font-size: 20px; flex-shrink: 0;">expand_more</span>
          </div>

          <!-- Commander name -->
          <span class="font-mono text-[11px] tracking-[0.15em]"
                style="color: #7A8498;"
                x-text="player.commander || ''"></span>

          <!-- Life total with +/- buttons -->
          <div class="flex items-center justify-center gap-[16px] py-[8px]" @click.stop>
            <button
              class="flex items-center justify-center w-[48px] h-[48px] cursor-pointer life-btn-minus"
              style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;"
              :data-player-index="pIdx"
              aria-label="Decrease life total">
              <span class="material-symbols-outlined" style="font-size: 24px;">remove</span>
            </button>

            <span class="syne-header text-[48px] font-bold min-w-[80px] text-center select-none life-display"
                  :style="'color: ' + ((player.life ?? 40) > 20 ? '#22C55E' : (player.life ?? 40) > 10 ? '#F59E0B' : '#E23838') + '; transition: transform 150ms ease-out, color 200ms ease-out;'"
                  :data-player-index="pIdx"
                  x-text="player.life ?? 40"></span>

            <button
              class="flex items-center justify-center w-[48px] h-[48px] cursor-pointer life-btn-plus"
              style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;"
              :data-player-index="pIdx"
              aria-label="Increase life total">
              <span class="material-symbols-outlined" style="font-size: 24px;">add</span>
            </button>
          </div>

          <!-- Poison counter (GAME-04 + gap 4a: skull glyph per HUMAN-UAT reversal) -->
          <div class="flex items-center justify-between px-[8px]" @click.stop
               :class="(player.poison || 0) >= 10 ? 'lethal-highlight' : ''">
            <div class="flex items-center gap-[6px]">
              <span class="material-symbols-outlined" style="font-size: 16px; color: #7A8498;">skull</span>
              <span class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold"
                    style="color: #7A8498;">POISON</span>
            </div>
            <div class="flex items-center gap-[8px]">
              <button
                @click="$store.game.adjustPoison(pIdx, -1)"
                class="flex items-center justify-center w-[32px] h-[32px] cursor-pointer"
                style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;"
                aria-label="Decrease poison">
                <span class="material-symbols-outlined" style="font-size: 16px;">remove</span>
              </button>
              <span class="font-mono text-[11px] font-bold min-w-[24px] text-center"
                    :style="'color: ' + ((player.poison || 0) >= 8 ? '#E23838' : (player.poison || 0) >= 4 ? '#F59E0B' : '#22C55E') + '; transition: color 200ms ease-out;'"
                    x-text="player.poison ?? 0"></span>
              <button
                @click="$store.game.adjustPoison(pIdx, 1)"
                class="flex items-center justify-center w-[32px] h-[32px] cursor-pointer"
                style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;"
                aria-label="Increase poison">
                <span class="material-symbols-outlined" style="font-size: 16px;">add</span>
              </button>
            </div>
          </div>

          <!-- Tax counter (GAME-04: paid glyph) -->
          <div class="flex items-center justify-between px-[8px]" @click.stop>
            <div class="flex items-center gap-[6px]">
              <span class="material-symbols-outlined" style="font-size: 16px; color: #7A8498;">paid</span>
              <span class="font-mono text-[11px] tracking-[0.15em]"
                    style="color: #7A8498;">
                TAX: <span x-text="player.tax_count ?? 0"></span>
                (<span x-text="(player.tax_count ?? 0) * 2"></span>)
              </span>
            </div>
            <div class="flex items-center gap-[8px]">
              <button
                @click="$store.game.adjustTax(pIdx, -1)"
                class="flex items-center justify-center w-[32px] h-[32px] cursor-pointer"
                style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;"
                aria-label="Decrease tax">
                <span class="material-symbols-outlined" style="font-size: 16px;">remove</span>
              </button>
              <button
                @click="$store.game.adjustTax(pIdx, 1)"
                class="flex items-center justify-center w-[32px] h-[32px] cursor-pointer"
                style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;"
                aria-label="Increase tax">
                <span class="material-symbols-outlined" style="font-size: 16px;">add</span>
              </button>
            </div>
          </div>

          <!-- Active counters (always visible when set) -->
          <template x-if="Object.keys(player.counters || {}).length > 0">
            <div class="flex flex-wrap gap-[8px] px-[8px]" @click.stop>
              <template x-for="(val, name) in (player.counters || {})" :key="'vis-' + name">
                <div class="flex items-center gap-[4px] py-[2px] px-[6px]"
                     style="background: #1C1F28; border: 1px solid #2A2D3A;">
                  <span class="font-mono text-[9px] uppercase tracking-[0.1em]"
                        style="color: #7A8498;" x-text="name"></span>
                  <template x-if="typeof val === 'number'">
                    <span class="font-mono text-[11px] font-bold"
                          style="color: #EAECEE;" x-text="val"></span>
                  </template>
                  <template x-if="typeof val === 'boolean'">
                    <span class="material-symbols-outlined" style="font-size: 12px; color: #0D52BD;">check</span>
                  </template>
                </div>
              </template>
            </div>
          </template>

          <!-- Mobile tap hint -->
          <span class="md:hidden text-center"
                style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; line-height: 1.5; color: #7A8498;">TAP FOR DETAILS</span>

          <!-- Expanded content (commander damage + counters) -->
          <template x-if="$store.game.expandedPlayer === pIdx">
            <div @click.stop>
              <!-- Commander damage (GAME-04: shield_with_heart glyph) -->
              <div class="flex flex-col gap-[8px] mt-[16px]">
                <div class="flex items-center gap-[6px]">
                  <span class="material-symbols-outlined" style="font-size: 16px; color: #7A8498;">shield_with_heart</span>
                  <span class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold"
                        style="color: #7A8498;">COMMANDER DAMAGE</span>
                </div>
                <template x-for="(source, sIdx) in $store.game.players" :key="'cd-' + sIdx">
                  <template x-if="sIdx !== pIdx">
                    <div class="flex items-center justify-between gap-[8px] px-[8px] py-[4px]"
                         :class="(player.commander_damage[sIdx] || 0) >= 21 ? 'lethal-highlight' : ''">
                      <span class="font-mono text-[11px] tracking-[0.15em]"
                            style="color: #7A8498;"
                            x-text="source.commander || source.name"></span>
                      <div class="flex items-center gap-[8px]">
                        <button
                          @click="$store.game.adjustCommanderDamage(pIdx, sIdx, -1)"
                          class="flex items-center justify-center w-[32px] h-[32px] cursor-pointer"
                          style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;">
                          <span class="material-symbols-outlined" style="font-size: 16px;">remove</span>
                        </button>
                        <span class="syne-header text-[20px] font-bold min-w-[32px] text-center"
                              style="color: #EAECEE;"
                              x-text="player.commander_damage[sIdx] || 0"></span>
                        <button
                          @click="$store.game.adjustCommanderDamage(pIdx, sIdx, 1)"
                          class="flex items-center justify-center w-[32px] h-[32px] cursor-pointer"
                          style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;">
                          <span class="material-symbols-outlined" style="font-size: 16px;">add</span>
                        </button>
                      </div>
                    </div>
                  </template>
                </template>
              </div>

              <!-- Additional counters -->
              <template x-if="Object.keys(player.counters || {}).length > 0">
                <div class="flex flex-col gap-[8px] mt-[16px]">
                  <span class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold"
                        style="color: #7A8498;">COUNTERS</span>
                  <template x-for="(val, name) in (player.counters || {})" :key="'ctr-' + name">
                    <div class="flex items-center justify-between px-[8px] py-[4px]">
                      <span class="font-mono text-[11px] uppercase tracking-[0.15em]"
                            style="color: #7A8498;" x-text="name"></span>
                      <div class="flex items-center gap-[8px]">
                        <button
                          @click="$store.game.adjustCounter(pIdx, name, -1)"
                          class="flex items-center justify-center w-[32px] h-[32px] cursor-pointer"
                          style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;">
                          <span class="material-symbols-outlined" style="font-size: 16px;">remove</span>
                        </button>
                        <span class="font-mono text-[11px] font-bold min-w-[24px] text-center"
                              style="color: #EAECEE;" x-text="val"></span>
                        <button
                          @click="$store.game.adjustCounter(pIdx, name, 1)"
                          class="flex items-center justify-center w-[32px] h-[32px] cursor-pointer"
                          style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;">
                          <span class="material-symbols-outlined" style="font-size: 16px;">add</span>
                        </button>
                      </div>
                    </div>
                  </template>
                </div>
              </template>
            </div>
          </template>

        </div>
      </template>
    </div>
  `;
}

/**
 * Wire long-press handlers to life buttons inside a rendered player grid.
 * Called after DOM render via Alpine x-init.
 * @param {HTMLElement} gridEl - The grid container element
 */
export function wireLifeButtons(gridEl) {
  // Clean up previous bindings
  cleanupLifeButtons();

  const minusButtons = gridEl.querySelectorAll('.life-btn-minus');
  const plusButtons = gridEl.querySelectorAll('.life-btn-plus');

  minusButtons.forEach((btn) => {
    const idx = parseInt(btn.dataset.playerIndex, 10);
    if (isNaN(idx)) return;
    const cleanup = setupLongPress(btn, (amount) => {
      const Alpine = window.Alpine;
      Alpine?.store('game')?.adjustLife(idx, -amount);
      // Brief scale animation on the life display
      const display = gridEl.querySelector(`.life-display[data-player-index="${idx}"]`);
      if (display) {
        display.style.transform = 'scale(1.1)';
        setTimeout(() => { display.style.transform = 'scale(1)'; }, 150);
      }
    });
    _cleanups.push(cleanup);
  });

  plusButtons.forEach((btn) => {
    const idx = parseInt(btn.dataset.playerIndex, 10);
    if (isNaN(idx)) return;
    const cleanup = setupLongPress(btn, (amount) => {
      const Alpine = window.Alpine;
      Alpine?.store('game')?.adjustLife(idx, amount);
      const display = gridEl.querySelector(`.life-display[data-player-index="${idx}"]`);
      if (display) {
        display.style.transform = 'scale(1.1)';
        setTimeout(() => { display.style.transform = 'scale(1)'; }, 150);
      }
    });
    _cleanups.push(cleanup);
  });
}

/**
 * Clean up all long-press handlers.
 */
export function cleanupLifeButtons() {
  while (_cleanups.length > 0) {
    const fn = _cleanups.pop();
    if (typeof fn === 'function') fn();
  }
}

// Expose wireLifeButtons globally so Alpine x-init can call it
if (typeof window !== 'undefined') {
  window.wireLifeButtons = wireLifeButtons;
}
