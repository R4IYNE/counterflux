import { parseBatchText, resolveBatchEntries } from '../services/mass-entry.js';
import { searchCards } from '../db/search.js';

/**
 * Render the Mass Entry Terminal panel HTML.
 * Uses Alpine x-data for local state and x-show bound to $store.collection.massEntryOpen.
 * @returns {string} HTML string
 */
export function renderMassEntryPanel() {
  // Expose functions on window so Alpine x-data templates can access them
  window.__cf_parseBatchText = parseBatchText;
  window.__cf_resolveBatchEntries = resolveBatchEntries;
  window.__cf_searchCards = searchCards;

  return `
    <div
      x-data="{
        inputText: '',
        entries: [],
        parsed: false,
        resolving: false,

        async parseEntries() {
          if (!this.inputText.trim()) return;
          this.resolving = true;
          try {
            const parsed = window.__cf_parseBatchText(this.inputText);
            const resolved = await window.__cf_resolveBatchEntries(
              parsed,
              window.__cf_searchCards
            );
            this.entries = resolved;
            this.parsed = true;
          } catch(e) {
            console.error('[Counterflux] Mass entry parse error:', e);
          }
          this.resolving = false;
        },

        get resolvedCount() {
          return this.entries.filter(e => e.resolved).length;
        },

        get totalCount() {
          return this.entries.length;
        },

        updateCandidate(index, cardId) {
          const entry = this.entries[index];
          if (!entry || !entry.candidates) return;
          const card = entry.candidates.find(c => c.id === cardId);
          if (card) {
            this.entries[index] = { ...entry, resolved: true, card };
          }
        },

        async commitToCollection() {
          const resolved = this.entries.filter(e => e.resolved && e.card);
          if (resolved.length === 0) return;

          const batch = resolved.map(e => ({
            scryfallId: e.card.id,
            quantity: e.quantity || 1,
            foil: e.foil || false,
            category: 'owned',
          }));

          await $store.collection.addBatch(batch);
          $store.toast.success(resolved.length + ' cards added to collection.');
          this.close();
        },

        close() {
          this.inputText = '';
          this.entries = [];
          this.parsed = false;
          $store.collection.massEntryOpen = false;
        },

        discard() {
          if (this.parsed && this.entries.length > 0) {
            if (!confirm('Discard ' + this.entries.length + ' unparsed entries?')) return;
          }
          this.close();
        }
      }"
      x-show="$store.collection.massEntryOpen"
      x-cloak
      style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 9999; display: flex; align-items: center; justify-content: center;"
      @keydown.escape.window="$store.collection.massEntryOpen && discard()"
    >
      <!-- Glass backdrop -->
      <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6);" @click="discard()"></div>

      <!-- Panel -->
      <div style="position: relative; z-index: 10; width: 100%; max-width: 680px; background: #14161C; border: 1px solid #2A2D3A; padding: 24px; display: flex; flex-direction: column; gap: 16px; max-height: 80vh; overflow-y: auto;"
           @click.stop>
        <!-- Heading row: title + X close (COLLECT-05 / D-23) -->
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <h2 style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; line-height: 1.2; letter-spacing: 0.01em; color: var(--color-text-primary); margin: 0;">
            MASS ENTRY TERMINAL
          </h2>
          <button
            @click="discard()"
            aria-label="Close mass entry"
            title="Close mass entry"
            style="width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; background: transparent; border: none; cursor: pointer; color: var(--color-text-muted); transition: all 120ms ease-out;"
            onmouseenter="this.style.color='var(--color-text-primary)'; this.style.background='var(--color-surface-hover)'"
            onmouseleave="this.style.color='var(--color-text-muted)'; this.style.background='transparent'"
          >
            <span class="material-symbols-outlined" style="font-size: 20px;">close</span>
          </button>
        </div>

        <!-- Textarea -->
        <textarea
          x-model="inputText"
          rows="10"
          placeholder="ENTER BATCH SYNTAX: 4x Lightning Bolt [2XM] foil"
          style="width: 100%; box-sizing: border-box; font-family: 'JetBrains Mono', monospace; font-size: 14px; background: #0B0C10; border: 1px solid #2A2D3A; color: #EAECEE; padding: 16px; resize: vertical; outline: none;"
          onfocus="this.style.borderColor='#0D52BD'"
          onblur="this.style.borderColor='#2A2D3A'"
        ></textarea>

        <!-- Help text -->
        <p style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; line-height: 1.5; color: #7A8498; margin: 0;">
          Format: {qty}x {card name} [{set code}] {foil?}. One entry per line. Set code and foil are optional.
        </p>

        <!-- Parse button -->
        <button
          @click="parseEntries()"
          :disabled="!inputText.trim() || resolving"
          :style="inputText.trim() && !resolving ? 'background: #0D52BD; color: #EAECEE; cursor: pointer;' : 'background: #1C1F28; color: #4A5064; cursor: not-allowed; opacity: 0.5;'"
          style="padding: 8px 16px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; border: none;"
        >
          <span x-show="!resolving">PARSE ENTRIES</span>
          <span x-show="resolving">RESOLVING...</span>
        </button>

        <!-- Results list -->
        <template x-if="parsed && entries.length > 0">
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <!-- Summary -->
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #EAECEE;">
              <span x-text="resolvedCount"></span>/<span x-text="totalCount"></span> ENTRIES RESOLVED
            </div>

            <!-- Entry list -->
            <template x-for="(entry, idx) in entries" :key="idx">
              <div style="display: flex; align-items: center; gap: 8px; padding: 8px; border: 1px solid #2A2D3A;"
                   :style="entry.resolved ? '' : 'border-color: rgba(226,56,56,0.3);'">
                <!-- Status badge -->
                <span x-show="entry.resolved"
                      style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; padding: 4px 8px; flex-shrink: 0; color: #2ECC71; background: rgba(46,204,113,0.1);">
                  RESOLVED
                </span>
                <span x-show="!entry.resolved"
                      style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; padding: 4px 8px; flex-shrink: 0; color: #E23838; background: rgba(226,56,56,0.1);">
                  UNRESOLVED
                </span>

                <!-- Card info (resolved) -->
                <template x-if="entry.resolved && entry.card">
                  <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
                    <img :src="entry.card.image_uris?.small || ''" style="width: 32px; height: 32px; object-fit: cover; flex-shrink: 0;" loading="lazy" onerror="this.style.display='none'">
                    <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #EAECEE; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                          x-text="(entry.quantity || 1) + 'x ' + entry.card.name"></span>
                    <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #4A5064; flex-shrink: 0;"
                          x-text="entry.card.set?.toUpperCase()"></span>
                  </div>
                </template>

                <!-- Unresolved info -->
                <template x-if="!entry.resolved">
                  <div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0;">
                    <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #7A8498; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                          x-text="entry.raw"></span>
                    <template x-if="entry.candidates && entry.candidates.length > 0">
                      <div style="display: flex; flex-direction: column; gap: 4px;">
                        <span style="font-family: 'Space Grotesk', sans-serif; font-size: 11px; color: #4A5064;">
                          Could not match this entry. Select the correct printing below or edit the name.
                        </span>
                        <select
                          @change="updateCandidate(idx, $event.target.value)"
                          style="background: #0B0C10; border: 1px solid #2A2D3A; color: #EAECEE; padding: 4px 8px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; outline: none;">
                          <option value="">SELECT PRINTING...</option>
                          <template x-for="cand in entry.candidates" :key="cand.id">
                            <option :value="cand.id" x-text="cand.name + ' [' + cand.set?.toUpperCase() + ']'"></option>
                          </template>
                        </select>
                      </div>
                    </template>
                  </div>
                </template>
              </div>
            </template>

            <!-- Action buttons -->
            <div style="display: flex; gap: 8px; padding-top: 8px;">
              <button
                @click="commitToCollection()"
                :disabled="resolvedCount === 0"
                :style="resolvedCount > 0 ? 'background: #0D52BD; color: #EAECEE; cursor: pointer;' : 'background: #1C1F28; color: #4A5064; cursor: not-allowed; opacity: 0.5;'"
                style="flex: 1; padding: 8px 16px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; border: none;">
                COMMIT TO COLLECTION
              </button>
              <button
                @click="discard()"
                style="flex: 1; padding: 8px 16px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; background: #1C1F28; color: #EAECEE; border: 1px solid #2A2D3A; cursor: pointer;">
                DISCARD ENTRIES
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
  `;
}
