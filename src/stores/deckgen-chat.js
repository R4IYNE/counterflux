/**
 * v1.3.x — Mila Brew Chat Alpine store.
 *
 * Conversational deckbuilding state machine. Distinct from the single-shot
 * deckgen store: this one holds a running multi-turn conversation and lets
 * the user apply Mila's proposed adds/cuts to the deck atomically.
 *
 * Display model (this.messages):
 *   user turn:      { role: 'user', text }
 *   assistant turn: { role: 'assistant', reply, adds[], cuts[], raw, applied }
 *     adds[]: { scryfall_id, name, role, reasoning, approved }
 *     cuts[]: { scryfall_id, name, reasoning, approved }
 *     raw: the JSON envelope string re-sent to Claude as its prior turn so the
 *          conversation has memory (Anthropic Messages API is stateless).
 *
 * The API messages array is reconstructed from this display model on each
 * send — user → text, assistant → raw. Roles always alternate because a
 * failed turn rolls back the just-pushed user message (see sendMessage).
 *
 * applyChanges mirrors the atomic transaction in the deckgen store's
 * commitApproved (delete cuts + add adds in a single db.transaction).
 */

import Alpine from 'alpinejs';
import { db } from '../db/schema.js';
import { sendChatMessage } from '../services/deckgen-chat.js';
import { detectGapsRAG } from '../utils/gap-detection.js';
import { buildDeckDiagnostics } from '../services/deck-diagnostics.js';

export function initDeckgenChatStore() {
  Alpine.store('deckgenChat', {
    // === Visibility / status ===
    panelOpen: false,
    status: 'idle',              // 'idle' | 'thinking' | 'error'
    error: null,                 // { code, message } when status === 'error'

    // === Conversation ===
    messages: [],                // display model (see file header)
    input: '',

    // === Budget ===
    budgetRemaining: null,
    budgetExhausted: false,

    // === Context ===
    activeDeckId: null,
    activeCommanderId: null,
    powerLevel: 5,
    useCollectionOnly: false,

    // -------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------

    openChat({ deckId, commanderId, powerLevel, useCollectionOnly } = {}) {
      this.activeDeckId = deckId || null;
      this.activeCommanderId = commanderId || null;
      this.powerLevel = typeof powerLevel === 'number' ? powerLevel : 5;
      this.useCollectionOnly = !!useCollectionOnly;
      this.messages = [];
      this.input = '';
      this.status = 'idle';
      this.error = null;
      this.panelOpen = true;
    },

    closeChat() {
      this.panelOpen = false;
    },

    reset() {
      this.panelOpen = false;
      this.status = 'idle';
      this.error = null;
      this.messages = [];
      this.input = '';
      this.activeDeckId = null;
      this.activeCommanderId = null;
    },

    setPowerLevel(value) {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 1 && n <= 10) this.powerLevel = n;
    },

    // -------------------------------------------------------------------
    // Send a turn
    // -------------------------------------------------------------------

    /**
     * Send the current input as a user turn. On failure the just-pushed
     * user message is rolled back and the input restored, so the message
     * history always ends on an assistant turn (or empty) — keeping the
     * user/assistant alternation the Anthropic API requires.
     */
    async sendMessage() {
      const text = (this.input || '').trim();
      if (!text || this.status === 'thinking') return;
      if (!this.activeCommanderId) {
        this.status = 'error';
        this.error = { code: 'invalid_input', message: 'Open a deck with a commander first.' };
        return;
      }

      // Optimistically append the user turn + clear the input box.
      this.messages = [...this.messages, { role: 'user', text }];
      this.input = '';
      this.status = 'thinking';
      this.error = null;

      const apiMessages = this._toApiMessages();
      const deckCards = this._currentDeckCards();
      const deckDiagnostics = this._deckDiagnostics();

      const result = await sendChatMessage({
        commanderId: this.activeCommanderId,
        powerLevel: this.powerLevel,
        useCollectionOnly: this.useCollectionOnly,
        messages: apiMessages,
        deckCards,
        deckDiagnostics,
        getAccessToken: async () => {
          const auth = Alpine.store('auth');
          return auth?.session?.access_token || null;
        },
      });

      if (!result.ok) {
        // Roll back the optimistic user turn + restore the input so the
        // conversation stays valid and the user can retry/edit.
        this.messages = this.messages.slice(0, -1);
        this.input = text;
        this.status = 'error';
        this.error = { code: result.code, message: result.message };
        if (result.code === 'budget_exhausted') {
          this.budgetExhausted = true;
          this.budgetRemaining = 0;
        }
        return;
      }

      const adds = (result.adds || []).map((a) => ({
        scryfall_id: a.scryfall_id,
        name: a.name || a.scryfall_id,
        role: a.role || 'SUPPORT',
        reasoning: a.reasoning || '',
        approved: true,
      }));
      const cuts = (result.cuts || []).map((c) => ({
        scryfall_id: c.scryfall_id,
        name: c.name || c.scryfall_id,
        reasoning: c.reasoning || '',
        approved: true,
      }));

      // raw = what Claude "said" this turn, re-sent next turn for memory.
      const raw = JSON.stringify({
        reply: result.reply,
        adds: adds.map(({ scryfall_id, name, role, reasoning }) => ({ scryfall_id, name, role, reasoning })),
        cuts: cuts.map(({ scryfall_id, name, reasoning }) => ({ scryfall_id, name, reasoning })),
      });

      this.messages = [...this.messages, {
        role: 'assistant',
        reply: result.reply,
        adds,
        cuts,
        raw,
        applied: false,
      }];
      if (typeof result.budgetRemaining === 'number') {
        this.budgetRemaining = result.budgetRemaining;
      }
      this.status = 'idle';
    },

    // -------------------------------------------------------------------
    // Review interactions
    // -------------------------------------------------------------------

    toggleChange(msgIdx, kind, scryfallId) {
      const list = kind === 'cuts' ? 'cuts' : 'adds';
      this.messages = this.messages.map((m, i) => {
        if (i !== msgIdx || m.role !== 'assistant') return m;
        return {
          ...m,
          [list]: (m[list] || []).map((row) =>
            row.scryfall_id === scryfallId ? { ...row, approved: !row.approved } : row
          ),
        };
      });
    },

    approvedCount(msgIdx) {
      const m = this.messages[msgIdx];
      if (!m || m.role !== 'assistant') return 0;
      return (m.adds || []).filter((r) => r.approved).length
        + (m.cuts || []).filter((r) => r.approved).length;
    },

    // -------------------------------------------------------------------
    // Apply approved changes to the deck (atomic)
    // -------------------------------------------------------------------

    /**
     * Apply the approved adds/cuts from one assistant message to the active
     * deck in a single transaction, then reload the deck. Mirrors the
     * commitApproved pattern from the deckgen store.
     */
    async applyChanges(msgIdx) {
      const msg = this.messages[msgIdx];
      if (!msg || msg.role !== 'assistant' || msg.applied) {
        return { ok: false, message: 'Nothing to apply.' };
      }
      if (!this.activeDeckId) {
        return { ok: false, message: 'No active deck.' };
      }

      const approvedAdds = (msg.adds || []).filter((r) => r.approved);
      const approvedCuts = (msg.cuts || []).filter((r) => r.approved);
      if (approvedAdds.length === 0 && approvedCuts.length === 0) {
        Alpine.store('toast')?.error?.('Approve at least one change first.');
        return { ok: false, message: 'Nothing approved.' };
      }

      let addedCount = 0;
      let cutCount = 0;

      try {
        await db.transaction('rw', db.deck_cards, async () => {
          const nowIso = new Date().toISOString();

          // Cuts first — never cut the commander.
          for (const cut of approvedCuts) {
            if (cut.scryfall_id === this.activeCommanderId) continue;
            const oldRow = await db.deck_cards
              .where('[deck_id+scryfall_id]')
              .equals([this.activeDeckId, cut.scryfall_id])
              .first();
            if (oldRow) {
              await db.deck_cards.delete(oldRow.id);
              cutCount++;
            }
          }

          // Adds — skip anything already present (singleton guard).
          for (const add of approvedAdds) {
            if (add.scryfall_id === this.activeCommanderId) continue;
            const existing = await db.deck_cards
              .where('[deck_id+scryfall_id]')
              .equals([this.activeDeckId, add.scryfall_id])
              .first();
            if (existing) continue;
            await db.deck_cards.add({
              deck_id: this.activeDeckId,
              scryfall_id: add.scryfall_id,
              quantity: 1,
              tags: [],
              sort_order: 0,
              updated_at: nowIso,
              synced_at: null,
            });
            addedCount++;
          }
        });
      } catch (err) {
        Alpine.store('toast')?.error?.(err?.message || 'Failed to apply changes.');
        return { ok: false, message: err?.message };
      }

      // Refresh the active deck so the editor reflects the changes (and the
      // NEXT chat turn reads the updated deck list).
      try {
        await Alpine.store('deck')?.loadDeck(this.activeDeckId);
      } catch {
        // Non-fatal
      }

      // Mark this message applied so the UI locks its toggles.
      this.messages = this.messages.map((m, i) =>
        i === msgIdx ? { ...m, applied: true } : m
      );

      const parts = [];
      if (addedCount > 0) parts.push(`+${addedCount}`);
      if (cutCount > 0) parts.push(`-${cutCount}`);
      Alpine.store('toast')?.success?.(`Applied ${parts.join(' / ') || 'no'} changes to your deck.`);
      return { ok: true, addedCount, cutCount };
    },

    // -------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------

    /**
     * Reconstruct the Anthropic messages array from the display model.
     * user → its text; assistant → its raw JSON envelope.
     */
    _toApiMessages() {
      return this.messages.map((m) =>
        m.role === 'user'
          ? { role: 'user', content: m.text }
          : { role: 'assistant', content: m.raw }
      );
    },

    /**
     * Current deck cards (excluding the commander) as {scryfall_id, name},
     * read from the deck store. These are the only valid cut targets.
     */
    _currentDeckCards() {
      const deck = Alpine.store('deck');
      const cards = deck?.activeCards || [];
      return cards
        .filter((c) => c.scryfall_id && c.scryfall_id !== this.activeCommanderId)
        .map((c) => ({ scryfall_id: c.scryfall_id, name: c.card?.name || '' }));
    },

    /**
     * Build the deck-diagnostics digest from the deck store's already-computed
     * analytics + RAG gaps (audit fix #6), so Mila reasons about the deck's
     * real weaknesses each turn. Returns '' on any miss (chat still works).
     */
    _deckDiagnostics() {
      try {
        const deckStore = Alpine.store('deck');
        const analytics = deckStore?.analytics;
        if (!analytics) return '';
        const deckTags = deckStore?.activeDeck?.tags || [];
        const gaps = detectGapsRAG(analytics, undefined, deckTags);
        return buildDeckDiagnostics({ analytics, gaps });
      } catch {
        return '';
      }
    },
  });
}
