/**
 * Game Setup Form -- inline form for starting a new Commander game.
 * Renders deck selection, starting life, opponents, and Start Game CTA.
 */

/**
 * Render the game setup form HTML with Alpine.js bindings.
 * @returns {string} HTML string
 */
export function renderGameSetup() {
  return `
    <div class="ghost-border p-[24px] flex flex-col gap-[24px]" style="background: #14161C;">

      <!-- Heading -->
      <h2 class="syne-header text-[20px] font-bold leading-[1.2] tracking-[0.01em]"
          style="color: #EAECEE;">NEW GAME</h2>

      <!-- Your Deck -->
      <div class="flex flex-col gap-[8px]">
        <label class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold"
               style="color: #7A8498;">YOUR DECK</label>

        <!-- Deck selector dropdown -->
        <select
          x-model="$store.game.selectedDeckId"
          @change="if ($event.target.value === '__manual__') { $store.game.selectedDeckId = null; } else { $store.game.manualCommander = ''; }"
          class="font-['Space_Grotesk',sans-serif] text-[14px] leading-[1.5] p-[8px] w-full cursor-pointer"
          style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE; outline: none;">
          <option value="" disabled selected>Select deck or enter commander...</option>
          <template x-for="deck in $store.deck.decks" :key="deck.id">
            <option :value="deck.id" x-text="deck.name + (deck.commander_name ? ' (' + deck.commander_name + ')' : '')"></option>
          </template>
          <option value="__manual__">Enter manually</option>
        </select>

        <!-- Manual commander input (shown when no deck selected or manual chosen) -->
        <template x-if="!$store.game.selectedDeckId">
          <input
            type="text"
            x-model="$store.game.manualCommander"
            placeholder="Commander name"
            class="font-['Space_Grotesk',sans-serif] text-[14px] leading-[1.5] p-[8px] w-full"
            style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE; outline: none;"
          />
        </template>
      </div>

      <!-- Starting Life -->
      <div class="flex flex-col gap-[8px]">
        <label class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold"
               style="color: #7A8498;">STARTING LIFE</label>
        <input
          type="number"
          x-model.number="$store.game.startingLife"
          class="font-mono text-[14px] text-center w-[80px] p-[8px]"
          style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE; outline: none;"
          min="1"
        />
      </div>

      <!-- Opponents -->
      <div class="flex flex-col gap-[8px]">
        <label class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold"
               style="color: #7A8498;">OPPONENTS</label>

        <template x-for="(opp, index) in $store.game.opponents" :key="index">
          <div class="flex items-center gap-[8px]">
            <input
              type="text"
              x-model="opp.name"
              placeholder="Player name"
              class="font-['Space_Grotesk',sans-serif] text-[14px] leading-[1.5] p-[8px] flex-1"
              style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE; outline: none;"
            />
            <input
              type="text"
              x-model="opp.commander"
              placeholder="Commander name"
              class="font-['Space_Grotesk',sans-serif] text-[14px] leading-[1.5] p-[8px] flex-1"
              style="background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE; outline: none;"
            />
            <button
              @click="$store.game.removeOpponent(index)"
              class="flex items-center justify-center w-[32px] h-[32px] cursor-pointer"
              style="background: #1C1F28; border: 1px solid #2A2D3A; color: #7A8498;"
              aria-label="Remove opponent">
              <span class="material-symbols-outlined" style="font-size: 18px;">close</span>
            </button>
          </div>
        </template>

        <button
          @click="$store.game.addOpponent()"
          :disabled="$store.game.opponents.length >= 5"
          class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold cursor-pointer px-[16px] py-[8px] self-start"
          :style="$store.game.opponents.length >= 5
            ? 'background: #14161C; border: 1px solid #2A2D3A; color: #4A5064; cursor: not-allowed;'
            : 'background: #1C1F28; border: 1px solid #2A2D3A; color: #EAECEE;'"
        >ADD OPPONENT</button>
      </div>

      <!-- Start Game CTA -->
      <button
        @click="$store.game.startGame()"
        class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold cursor-pointer w-full py-[12px]"
        style="background: #0D52BD; color: #EAECEE; border: none;">
        Start Game
      </button>

    </div>
  `;
}
