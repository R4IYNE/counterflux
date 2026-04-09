/**
 * Commander Damage Tracker -- renders per-opponent commander damage rows.
 * Revealed when a player card is expanded.
 */

/**
 * Render the commander damage tracker for a given player.
 * Shows damage received from each other player's commander with +/- buttons.
 *
 * @param {number} playerIndex - Index of the player in $store.game.players
 * @returns {string} HTML string with Alpine.js bindings
 */
export function renderCommanderDamageTracker(playerIndex) {
  return `
    <div class="flex flex-col gap-[8px] mt-[16px]">
      <!-- Header -->
      <span class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold"
            style="color: #7A8498;">COMMANDER DAMAGE</span>

      <!-- Row per other player -->
      <template x-for="(source, sIdx) in $store.game.players" :key="sIdx">
        <template x-if="sIdx !== ${playerIndex}">
          <div class="flex items-center justify-between gap-[8px] px-[8px] py-[4px]"
               :class="($store.game.players[${playerIndex}].commander_damage[sIdx] || 0) >= 21 ? 'lethal-highlight' : ''">
            <!-- Commander name -->
            <span class="font-mono text-[11px] tracking-[0.15em]"
                  style="color: #7A8498;"
                  x-text="source.commander || source.name"></span>

            <!-- Damage value + controls -->
            <div class="flex items-center gap-[8px]">
              <button
                @click="$store.game.adjustCommanderDamage(${playerIndex}, sIdx, -1)"
                class="flex items-center justify-center w-[32px] h-[32px] cursor-pointer"
                style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;"
                aria-label="Decrease commander damage">
                <span class="material-symbols-outlined" style="font-size: 16px;">remove</span>
              </button>
              <span class="syne-header text-[20px] font-bold min-w-[32px] text-center"
                    style="color: #EAECEE;"
                    x-text="$store.game.players[${playerIndex}].commander_damage[sIdx] || 0"></span>
              <button
                @click="$store.game.adjustCommanderDamage(${playerIndex}, sIdx, 1)"
                class="flex items-center justify-center w-[32px] h-[32px] cursor-pointer"
                style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;"
                aria-label="Increase commander damage">
                <span class="material-symbols-outlined" style="font-size: 16px;">add</span>
              </button>
            </div>
          </div>
        </template>
      </template>
    </div>
  `;
}
