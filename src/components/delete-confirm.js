/**
 * Delete confirmation modal component.
 * Shows a destructive action confirmation dialog for removing a card from collection.
 */

/**
 * Render the delete confirmation modal HTML.
 * Listens for 'collection-delete-confirm' custom events.
 * @returns {string} HTML string
 */
export function renderDeleteConfirm() {
  return `
    <div
      x-data="{
        deleteEntry: null,
        deleteVisible: false,

        openDelete(entry) {
          this.deleteEntry = entry;
          this.deleteVisible = true;
        },

        async confirmDelete() {
          if (!this.deleteEntry) return;
          const name = this.deleteEntry.card?.name || 'Card';
          await $store.collection.deleteEntry(this.deleteEntry.id);
          $store.toast.success(name + ' removed from collection.');
          this.closeDelete();
        },

        closeDelete() {
          this.deleteVisible = false;
          this.deleteEntry = null;
        }
      }"
      @collection-delete-confirm.document="openDelete($event.detail.entry)"
      @keydown.escape.window="deleteVisible && closeDelete()"
    >
      <!-- Modal overlay -->
      <div
        x-show="deleteVisible"
        x-cloak
        class="fixed inset-0 z-50 flex items-center justify-center"
      >
        <!-- Glass backdrop -->
        <div class="absolute inset-0 bg-black/60" @click="closeDelete()"></div>

        <!-- Modal panel -->
        <div class="relative z-10 w-full max-w-sm bg-surface border border-border-ghost p-lg flex flex-col gap-md"
             @click.stop>
          <!-- Heading -->
          <h3 class="font-header text-[20px] font-bold leading-[1.2] tracking-[0.01em] text-text-primary"
              style="font-family: 'Syne', sans-serif;">
            CONFIRM REMOVAL
          </h3>

          <!-- Confirmation text -->
          <p class="text-[14px] leading-[1.5] text-text-primary"
             style="font-family: 'Space Grotesk', sans-serif;">
            Remove <span class="font-bold" x-text="deleteEntry?.card?.name || 'this card'"></span>
            (<span x-text="deleteEntry?.quantity || 0"></span>x) from your collection? This cannot be undone.
          </p>

          <!-- Action buttons -->
          <div class="flex gap-sm pt-sm">
            <button
              @click="confirmDelete()"
              class="flex-1 px-md py-sm font-mono text-[11px] uppercase tracking-[0.15em] font-bold cursor-pointer transition-colors"
              style="font-family: 'JetBrains Mono', monospace; background: var(--color-secondary, #E23838); color: var(--color-text-primary, #EAECEE);"
              onmouseenter="this.style.opacity='0.8'"
              onmouseleave="this.style.opacity='1'"
            >
              REMOVE CARD
            </button>
            <button
              @click="closeDelete()"
              class="flex-1 px-md py-sm font-mono text-[11px] uppercase tracking-[0.15em] font-bold bg-surface-hover text-text-primary cursor-pointer hover:bg-border-ghost transition-colors"
              style="font-family: 'JetBrains Mono', monospace;"
            >
              KEEP CARD
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}
