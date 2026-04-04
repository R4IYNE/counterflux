/**
 * Inline card quantity editing component.
 * Renders a small popover form for editing card quantity.
 */

/**
 * Render inline edit HTML for an Alpine x-data context.
 * This returns the HTML to be injected where inline editing is needed.
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
        class="fixed z-50 bg-surface border border-border-ghost p-sm flex items-center gap-sm"
        :style="'left: ' + editX + 'px; top: ' + editY + 'px;'"
        style="box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);"
        @click.outside="closeEdit()"
      >
        <label class="font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-text-muted"
               style="font-family: 'JetBrains Mono', monospace;">
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
          class="w-16 bg-background border border-border-ghost text-text-primary px-sm py-xs font-mono text-[11px] uppercase tracking-[0.15em] outline-none focus:border-primary text-center"
          style="font-family: 'JetBrains Mono', monospace;"
        >
      </div>
    </div>
  `;
}
