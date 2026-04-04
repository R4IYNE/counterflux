import { parseBatchText, resolveBatchEntries } from '../services/mass-entry.js';
import { searchCards } from '../db/search.js';

/**
 * Render the Mass Entry Terminal panel HTML.
 * Uses Alpine x-data for local state and x-show bound to $store.collection.massEntryOpen.
 * @returns {string} HTML string
 */
export function renderMassEntryPanel() {
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
            const parsed = (await import('../services/mass-entry.js')).parseBatchText(this.inputText);
            const resolved = await (await import('../services/mass-entry.js')).resolveBatchEntries(
              parsed,
              (await import('../db/search.js')).searchCards
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
      class="fixed inset-0 z-50 flex items-center justify-center"
      @keydown.escape.window="$store.collection.massEntryOpen && discard()"
    >
      <!-- Glass backdrop -->
      <div class="absolute inset-0 bg-black/60" @click="discard()"></div>

      <!-- Panel -->
      <div class="relative z-10 w-full max-w-2xl bg-surface border border-border-ghost p-lg flex flex-col gap-md max-h-[80vh] overflow-y-auto"
           @click.stop>
        <!-- Heading -->
        <h2 class="font-header text-[20px] font-bold leading-[1.2] tracking-[0.01em] text-text-primary"
            style="font-family: 'Syne', sans-serif;">
          MASS ENTRY TERMINAL
        </h2>

        <!-- Textarea -->
        <textarea
          x-model="inputText"
          rows="10"
          placeholder="ENTER BATCH SYNTAX: 4x Lightning Bolt [2XM] foil"
          class="terminal-input w-full"
          style="font-family: 'JetBrains Mono', monospace; font-size: 14px; background: var(--color-background, #0B0C10); border: 1px solid var(--color-border-ghost, #2A2D3A); color: var(--color-text-primary, #EAECEE); padding: 16px; resize: vertical; outline: none;"
          @focus="$el.style.borderColor = 'var(--color-primary, #0D52BD)'"
          @blur="$el.style.borderColor = 'var(--color-border-ghost, #2A2D3A)'"
        ></textarea>

        <!-- Help text -->
        <p class="text-[14px] leading-[1.5] text-text-muted"
           style="font-family: 'Space Grotesk', sans-serif;">
          Format: {qty}x {card name} [{set code}] {foil?}. One entry per line. Set code and foil are optional.
        </p>

        <!-- Parse button -->
        <button
          @click="parseEntries()"
          :disabled="!inputText.trim() || resolving"
          :class="inputText.trim() && !resolving ? 'bg-primary text-text-primary cursor-pointer hover:bg-primary/80' : 'bg-surface-hover text-text-dim cursor-not-allowed opacity-50'"
          class="px-md py-sm font-mono text-[11px] uppercase tracking-[0.15em] font-bold transition-colors"
          style="font-family: 'JetBrains Mono', monospace;">
          <span x-show="!resolving">PARSE ENTRIES</span>
          <span x-show="resolving">RESOLVING...</span>
        </button>

        <!-- Results list -->
        <template x-if="parsed && entries.length > 0">
          <div class="flex flex-col gap-sm">
            <!-- Summary -->
            <div class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-text-primary"
                 style="font-family: 'JetBrains Mono', monospace;">
              <span x-text="resolvedCount"></span>/<span x-text="totalCount"></span> ENTRIES RESOLVED
            </div>

            <!-- Entry list -->
            <template x-for="(entry, idx) in entries" :key="idx">
              <div class="flex items-center gap-sm p-sm border border-border-ghost"
                   :class="entry.resolved ? '' : 'border-secondary/30'">
                <!-- Status badge -->
                <span x-show="entry.resolved"
                      class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold px-sm py-xs flex-shrink-0"
                      style="font-family: 'JetBrains Mono', monospace; color: var(--color-success, #2ECC71); background: rgba(46, 204, 113, 0.1);">
                  RESOLVED
                </span>
                <span x-show="!entry.resolved"
                      class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold px-sm py-xs flex-shrink-0"
                      style="font-family: 'JetBrains Mono', monospace; color: var(--color-secondary, #E23838); background: rgba(226, 56, 56, 0.1);">
                  UNRESOLVED
                </span>

                <!-- Card info (resolved) -->
                <template x-if="entry.resolved && entry.card">
                  <div class="flex items-center gap-sm flex-1 min-w-0">
                    <img :src="entry.card.image_uris?.small || ''" class="w-8 h-8 object-cover flex-shrink-0" loading="lazy" onerror="this.style.display='none'">
                    <span class="font-mono text-[11px] uppercase tracking-[0.15em] text-text-primary truncate"
                          style="font-family: 'JetBrains Mono', monospace;"
                          x-text="(entry.quantity || 1) + 'x ' + entry.card.name"></span>
                    <span class="font-mono text-[11px] uppercase tracking-[0.15em] text-text-dim flex-shrink-0"
                          style="font-family: 'JetBrains Mono', monospace;"
                          x-text="entry.card.set?.toUpperCase()"></span>
                  </div>
                </template>

                <!-- Unresolved info -->
                <template x-if="!entry.resolved">
                  <div class="flex flex-col gap-xs flex-1 min-w-0">
                    <span class="font-mono text-[11px] uppercase tracking-[0.15em] text-text-muted truncate"
                          style="font-family: 'JetBrains Mono', monospace;"
                          x-text="entry.raw"></span>
                    <template x-if="entry.candidates && entry.candidates.length > 0">
                      <div class="flex flex-col gap-xs">
                        <span class="text-[11px] text-text-dim"
                              style="font-family: 'Space Grotesk', sans-serif;">
                          Could not match this entry. Select the correct printing below or edit the name.
                        </span>
                        <select
                          @change="updateCandidate(idx, $event.target.value)"
                          class="bg-background border border-border-ghost text-text-primary px-sm py-xs font-mono text-[11px] uppercase tracking-[0.15em] outline-none"
                          style="font-family: 'JetBrains Mono', monospace;">
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
            <div class="flex gap-sm pt-sm">
              <button
                @click="commitToCollection()"
                :disabled="resolvedCount === 0"
                :class="resolvedCount > 0 ? 'bg-primary text-text-primary cursor-pointer hover:bg-primary/80' : 'bg-surface-hover text-text-dim cursor-not-allowed opacity-50'"
                class="flex-1 px-md py-sm font-mono text-[11px] uppercase tracking-[0.15em] font-bold transition-colors"
                style="font-family: 'JetBrains Mono', monospace;">
                COMMIT TO COLLECTION
              </button>
              <button
                @click="discard()"
                class="flex-1 px-md py-sm font-mono text-[11px] uppercase tracking-[0.15em] font-bold bg-surface-hover text-text-primary cursor-pointer hover:bg-border-ghost transition-colors"
                style="font-family: 'JetBrains Mono', monospace;">
                DISCARD ENTRIES
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
  `;
}
