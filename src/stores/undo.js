import Alpine from 'alpinejs';

export function initUndoStore() {
  Alpine.store('undo', {
    stack: [],

    push(type, data, message, commitFn, restoreFn) {
      const id = Date.now() + Math.random();

      const timer = setTimeout(async () => {
        try {
          await commitFn();
        } catch (e) {
          console.error('[Undo] commit failed:', e);
        }
        this.stack = this.stack.filter(e => e.id !== id);
      }, 10000);

      this.stack.push({ id, type, data, timer, message, restoreFn });

      // Show undo toast
      Alpine.store('toast').showUndo(message, id);
      return id;
    },

    undo(id) {
      const entry = this.stack.find(e => e.id === id);
      if (!entry) return false;
      clearTimeout(entry.timer);
      entry.restoreFn();
      this.stack = this.stack.filter(e => e.id !== id);
      Alpine.store('toast').dismiss(id);
      Alpine.store('toast').success('Restored.');
      return true;
    },

    undoLast() {
      if (this.stack.length === 0) return false;
      return this.undo(this.stack[this.stack.length - 1].id);
    },
  });
}
