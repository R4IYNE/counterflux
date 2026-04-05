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
        style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 9999; display: flex; align-items: center; justify-content: center;"
      >
        <!-- Glass backdrop -->
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6);" @click="closeDelete()"></div>

        <!-- Modal panel -->
        <div style="position: relative; z-index: 10; width: 100%; max-width: 400px; background: #14161C; border: 1px solid #2A2D3A; padding: 24px; display: flex; flex-direction: column; gap: 16px;"
             @click.stop>
          <!-- Heading -->
          <h3 style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; line-height: 1.2; letter-spacing: 0.01em; color: #EAECEE; margin: 0;">
            CONFIRM REMOVAL
          </h3>

          <!-- Confirmation text -->
          <p style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; line-height: 1.5; color: #EAECEE; margin: 0;">
            Remove <span style="font-weight: 700;" x-text="deleteEntry?.card?.name || 'this card'"></span>
            (<span x-text="deleteEntry?.quantity || 0"></span>x) from your collection? This cannot be undone.
          </p>

          <!-- Action buttons -->
          <div style="display: flex; gap: 8px; padding-top: 8px;">
            <button
              @click="confirmDelete()"
              style="flex: 1; padding: 8px 16px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; background: #E23838; color: #EAECEE; border: none; cursor: pointer;"
              onmouseenter="this.style.opacity='0.8'"
              onmouseleave="this.style.opacity='1'"
            >
              REMOVE CARD
            </button>
            <button
              @click="closeDelete()"
              style="flex: 1; padding: 8px 16px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; background: #1C1F28; color: #EAECEE; border: 1px solid #2A2D3A; cursor: pointer;"
            >
              KEEP CARD
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}
