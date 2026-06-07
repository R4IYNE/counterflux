/**
 * Phase 18 (v1.3) — Brew with AI modal.
 *
 * Mounts the brewing flow surface — power-level slider, collection-only
 * toggle, mode selector, archetype hint textbox, and the kick-off button
 * that calls $store.deckgen.startBrew().
 *
 * Visible only when the user clicks the "Brew with AI" button on the
 * Thousand-Year Storm editor (visibility gated server-side by the
 * commander being set; UI also disables the button when commander is
 * empty so the user never lands in an error state).
 *
 * Lifecycle handoff: when the brew succeeds and the store flips to
 * 'reviewing' status, this modal closes and the review screen takes over
 * (deckgen-review-screen.js, same parent overlay container so there's
 * no flash between phases).
 *
 * Persona: every copy string in here belongs to Mila. Friendly,
 * knowledgeable, never preachy.
 */

const POWER_PRESETS = [
  { value: 2, label: 'CASUAL', description: 'Precon-tier. Wins turn 9+. Theme over efficiency.' },
  { value: 5, label: 'FOCUSED', description: 'Clear theme, 2 win-cons. Wins turn 6-8.' },
  { value: 8, label: 'OPTIMIZED', description: 'Tuned. Full fast mana. Wins turn 5-7.' },
  { value: 10, label: 'cEDH', description: 'T1-T4 win. Tier-1 mana base. No slack slots.' },
];

const MODES = [
  { value: 'build', label: 'BUILD ALL 99', description: 'Empty deck — Mila drafts the whole list from scratch.' },
  { value: 'fill', label: 'FILL REMAINING', description: 'Keep what you have, Mila picks the rest.' },
];

/**
 * Render the Brew modal. Returns an HTML string suitable for injection
 * into the deck editor's overlay container.
 */
export function renderDeckgenBrewModal() {
  return `
    <div
      x-data="{
        powerLevel: 5,
        useCollectionOnly: false,
        mode: 'build',
        archetypeHint: '',
        get isRetune() {
          return $store.deckgen?.modalMode === 'retune';
        },
        get effectiveMode() {
          return this.isRetune ? 'retune' : this.mode;
        },
        get powerLabel() {
          if (this.powerLevel <= 3) return 'CASUAL';
          if (this.powerLevel <= 6) return 'FOCUSED';
          if (this.powerLevel <= 9) return 'OPTIMIZED';
          return 'cEDH';
        },
        get powerDescription() {
          if (this.powerLevel <= 3) return 'Precon-tier. Wins turn 9+. Theme over efficiency.';
          if (this.powerLevel <= 6) return 'Clear theme, 2 win-cons. Wins turn 6-8.';
          if (this.powerLevel <= 9) return 'Tuned. Full fast mana. Wins turn 5-7.';
          return 'T1-T4 win. Tier-1 mana base. No slack slots.';
        },
        applyPreset(value) { this.powerLevel = value; },
        get canBrew() {
          const deck = $store.deck?.activeDeck;
          return !!(deck && deck.commander_id && $store.deckgen?.status !== 'brewing');
        },
        async kickoff() {
          const deck = $store.deck?.activeDeck;
          if (!deck || !deck.commander_id) return;
          const partial = ($store.deck?.activeCards || [])
            .filter(c => c.scryfall_id !== deck.commander_id)
            .map(c => c.scryfall_id);
          // Retune always sends the full current deck. Fill sends the
          // existing card list so Claude doesn't duplicate. Build sends
          // nothing.
          const sendPartial = this.effectiveMode === 'retune' || this.effectiveMode === 'fill';
          await $store.deckgen.startBrew({
            deckId: deck.id,
            commanderId: deck.commander_id,
            powerLevel: this.powerLevel,
            mode: this.effectiveMode,
            useCollectionOnly: this.isRetune ? false : this.useCollectionOnly,
            archetypeHint: this.archetypeHint.trim(),
            partialCardIds: sendPartial ? partial : [],
          });
        }
      }"
      x-show="$store.deckgen?.status === 'idle' && $store.deckgen?.brewModalOpen"
      x-cloak
      @keydown.escape.window="$store.deckgen.brewModalOpen = false"
      style="position: fixed; inset: 0; z-index: 9000; display: flex; align-items: center; justify-content: center;"
    >
      <!-- Backdrop -->
      <div
        @click="$store.deckgen.brewModalOpen = false"
        style="position: absolute; inset: 0; background: rgba(11,12,16,0.85); backdrop-filter: blur(4px);"
      ></div>

      <!-- Card -->
      <div
        @click.stop
        style="position: relative; z-index: 10; width: 100%; max-width: 540px; background: #14161C; border: 1px solid #2A2D3A; padding: 32px; display: flex; flex-direction: column; gap: 24px; max-height: 90vh; overflow-y: auto;"
      >
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span class="material-symbols-outlined" style="color: #0D52BD; font-size: 24px;" x-text="isRetune ? 'tune' : 'auto_awesome'"></span>
            <h2
              style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #EAECEE; margin: 0; text-transform: uppercase; letter-spacing: 0.01em;"
              x-text="isRetune ? 'RETUNE WITH MILA' : 'BREW WITH MILA'"
            ></h2>
          </div>
          <button
            @click="$store.deckgen.brewModalOpen = false"
            aria-label="Close brew modal"
            style="background: transparent; border: none; color: #7A8498; cursor: pointer; padding: 4px;"
          >
            <span class="material-symbols-outlined" style="font-size: 20px;">close</span>
          </button>
        </div>

        <!-- Budget chip (only when we know it) -->
        <template x-if="$store.deckgen?.budgetRemaining !== null">
          <div
            style="font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.15em; color: #7A8498; text-transform: uppercase;"
            x-text="\`\${$store.deckgen.budgetRemaining}/20 BREWS LEFT TODAY\`"
          ></div>
        </template>

        <!-- Power level -->
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 700; color: #7A8498;">
              POWER LEVEL
            </span>
            <span
              style="font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.15em; font-weight: 700; color: #0D52BD; text-transform: uppercase;"
              x-text="powerLevel + '/10 · ' + powerLabel"
            ></span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            x-model.number="powerLevel"
            style="width: 100%; accent-color: #0D52BD;"
          />
          <span
            style="font-family: 'Space Grotesk', sans-serif; font-size: 13px; line-height: 1.4; color: #7A8498;"
            x-text="powerDescription"
          ></span>
          <!-- Preset chips -->
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <template x-for="preset in [{value:2,label:'CASUAL'},{value:5,label:'FOCUSED'},{value:8,label:'OPTIMIZED'},{value:10,label:'cEDH'}]" :key="preset.value">
              <button
                @click="applyPreset(preset.value)"
                :style="powerLevel === preset.value
                  ? 'padding: 4px 10px; background: #0D52BD; color: #EAECEE; border: 1px solid #0D52BD; cursor: pointer; font-family: JetBrains Mono, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;'
                  : 'padding: 4px 10px; background: transparent; color: #7A8498; border: 1px solid #2A2D3A; cursor: pointer; font-family: JetBrains Mono, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;'"
                x-text="preset.label"
              ></button>
            </template>
          </div>
        </div>

        <!-- Mode (build/fill only; hidden in retune mode — retune always
             operates on the current full deck list) -->
        <div x-show="!isRetune" style="display: flex; flex-direction: column; gap: 8px;">
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 700; color: #7A8498;">
            MODE
          </span>
          <div style="display: flex; gap: 8px;">
            <button
              @click="mode = 'build'"
              :style="mode === 'build'
                ? 'flex: 1; padding: 12px; background: rgba(13,82,189,0.15); color: #EAECEE; border: 1px solid #0D52BD; cursor: pointer; text-align: left;'
                : 'flex: 1; padding: 12px; background: transparent; color: #EAECEE; border: 1px solid #2A2D3A; cursor: pointer; text-align: left;'"
            >
              <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 4px;">
                BUILD ALL 99
              </div>
              <div style="font-family: 'Space Grotesk', sans-serif; font-size: 12px; color: #7A8498; line-height: 1.4;">
                Empty deck — Mila drafts the whole list.
              </div>
            </button>
            <button
              @click="mode = 'fill'"
              :style="mode === 'fill'
                ? 'flex: 1; padding: 12px; background: rgba(13,82,189,0.15); color: #EAECEE; border: 1px solid #0D52BD; cursor: pointer; text-align: left;'
                : 'flex: 1; padding: 12px; background: transparent; color: #EAECEE; border: 1px solid #2A2D3A; cursor: pointer; text-align: left;'"
            >
              <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 4px;">
                FILL REMAINING
              </div>
              <div style="font-family: 'Space Grotesk', sans-serif; font-size: 12px; color: #7A8498; line-height: 1.4;">
                Keep what you have, Mila picks the rest.
              </div>
            </button>
          </div>
        </div>

        <!-- Retune-only explainer (replaces mode + collection sections) -->
        <div x-show="isRetune" style="display: flex; flex-direction: column; gap: 8px; padding: 12px 16px; background: rgba(13,82,189,0.06); border: 1px solid rgba(13,82,189,0.3);">
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 700; color: #0D52BD;">
            RETUNE MODE
          </div>
          <div style="font-family: 'Space Grotesk', sans-serif; font-size: 13px; color: #EAECEE; line-height: 1.5;">
            Mila reads your current deck and suggests 5–15 surgical swaps to move it toward the target power level. Use this when you want to take an Optimized deck to a Casual pod or vice versa.
          </div>
        </div>

        <!-- Collection toggle (hidden in retune mode — retune ignores
             the collection filter since it's working with cards already
             in the deck) -->
        <label x-show="!isRetune" style="display: flex; align-items: flex-start; gap: 12px; cursor: pointer;">
          <input
            type="checkbox"
            x-model="useCollectionOnly"
            style="width: 18px; height: 18px; accent-color: #0D52BD; margin-top: 2px; cursor: pointer; flex-shrink: 0;"
          />
          <div>
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #EAECEE; margin-bottom: 4px;">
              USE ONLY MY COLLECTION
            </div>
            <div style="font-family: 'Space Grotesk', sans-serif; font-size: 12px; color: #7A8498; line-height: 1.4;">
              Mila only suggests cards you already own. Best for budget-conscious brewing or when you can't get to the LGS this week.
            </div>
          </div>
        </label>

        <!-- Archetype hint -->
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label style="font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 700; color: #7A8498;">
            ARCHETYPE HINT (OPTIONAL)
          </label>
          <input
            type="text"
            x-model="archetypeHint"
            placeholder="e.g. tokens, voltron, group hug, stax"
            style="background: #0B0C10; border: 1px solid #2A2D3A; color: #EAECEE; padding: 10px 12px; font-family: 'Space Grotesk', sans-serif; font-size: 14px; outline: none;"
            onfocus="this.style.borderColor='#0D52BD'"
            onblur="this.style.borderColor='#2A2D3A'"
          />
          <span style="font-family: 'Space Grotesk', sans-serif; font-size: 12px; color: #4A5064;">
            Helps Mila lean the deck in a specific direction without overriding the commander's natural identity.
          </span>
        </div>

        <!-- Action buttons -->
        <div style="display: flex; gap: 8px; padding-top: 8px;">
          <button
            @click="kickoff()"
            :disabled="!canBrew"
            :style="canBrew
              ? 'flex: 1; padding: 12px; background: #0D52BD; color: #EAECEE; border: 1px solid #0D52BD; cursor: pointer; font-family: JetBrains Mono, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;'
              : 'flex: 1; padding: 12px; background: #1C1F28; color: #4A5064; border: 1px solid #2A2D3A; cursor: not-allowed; font-family: JetBrains Mono, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; opacity: 0.6;'"
          >
            <span x-show="$store.deckgen?.status !== 'brewing'" x-text="isRetune ? 'RETUNE IT' : 'BREW IT'"></span>
            <span x-show="$store.deckgen?.status === 'brewing'">MILA IS THINKING…</span>
          </button>
          <button
            @click="$store.deckgen.brewModalOpen = false"
            style="padding: 12px 16px; background: transparent; color: #7A8498; border: 1px dashed #2A2D3A; cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  `;
}
