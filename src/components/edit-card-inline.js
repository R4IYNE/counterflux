/**
 * Inline card quantity editing component.
 * Renders a small popover form for editing card quantity.
 */

/**
 * Render inline edit HTML for an Alpine x-data context.
 * @returns {string} HTML string for inline edit component
 */
export function renderEditInline() {
  return `
    <div
      x-data="{
        editingEntry: null,
        editQty: 1,
        editVisible: false,
        editX: 0,
        editY: 0,

        openEdit(entry, x, y) {
          this.editingEntry = entry;
          this.editQty = entry.quantity || 1;
          this.editX = x || 0;
          this.editY = y || 0;
          this.editVisible = true;
          this.$nextTick(() => {
            const input = this.$refs.editQtyInput;
            if (input) { input.focus(); input.select(); }
          });
        },

        async saveEdit() {
          if (!this.editingEntry || this.editQty < 1) return;
          const name = this.editingEntry.card?.name || 'Card';
          await $store.collection.editEntry(this.editingEntry.id, { quantity: this.editQty });
          $store.toast.success(name + ' quantity updated to ' + this.editQty + '.');
          this.closeEdit();
        },

        closeEdit() {
          this.editVisible = false;
          this.editingEntry = null;
        }
      }"
      @collection-edit-inline.document="openEdit($event.detail.entry, $event.detail.x || 200, $event.detail.y || 200)"
      @keydown.escape.window="editVisible && closeEdit()"
    >
      <!-- Inline edit popover -->
      <div
        x-show="editVisible"
        x-cloak
        :style="'position: fixed; z-index: 9999; left: ' + editX + 'px; top: ' + editY + 'px; background: #14161C; border: 1px solid #2A2D3A; padding: 8px; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.4);'"
        @click.outside="closeEdit()"
      >
        <label style="font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; color: #7A8498;">
          QTY
        </label>
        <input
          type="number"
          x-model.number="editQty"
          x-ref="editQtyInput"
          min="1"
          max="999"
          @keydown.enter="saveEdit()"
          @blur="saveEdit()"
          style="width: 64px; background: #0B0C10; border: 1px solid #2A2D3A; color: #EAECEE; padding: 4px 8px; font-family: 'JetBrains Mono', monospace; font-size: 11px; text-align: center; outline: none;"
          onfocus="this.style.borderColor='#0D52BD'"
          onblur="this.style.borderColor='#2A2D3A'"
        >
      </div>
    </div>
  `;
}
