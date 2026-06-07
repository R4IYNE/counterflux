/**
 * Phase 17 (v1.3) — Alpine store for AI deck-generation client state.
 *
 * Scaffolds the surface Phase 18 will mount the Brew modal + review screen
 * against. This store owns:
 *   - Loading / error / response state for the current /api/deckgen call
 *   - Budget remaining (so the UI can show "5/20 brews today")
 *   - Per-card approve/reject toggles on the review screen
 *   - The commit handler that writes approved cards to the deck
 *
 * The store is NOT registered in main.js yet — Phase 18 wires it once the
 * Brew modal is built. Until then this is dormant.
 *
 * Generation flow:
 *   store.startBrew({...}) → calls deckgen.generateDeck() → updates state
 *   store.toggleApproval(id) → flips approve/reject for one card
 *   store.commitApproved() → atomically adds approved cards to deck
 */

import Alpine from 'alpinejs';
import { db } from '../db/schema.js';
import { generateDeck } from '../services/deckgen.js';
import { hashCollection } from '../services/deckgen-candidates.js';

export function initDeckgenStore() {
  Alpine.store('deckgen', {
    // === Status ===
    status: 'idle',                  // 'idle' | 'brewing' | 'reviewing' | 'committing' | 'error'
    error: null,                     // { code, message } when status === 'error'
    cacheHit: false,                 // true if last call returned a cached response
    brewModalOpen: false,             // Phase 18 — modal visibility, separate from status so the modal can be open while idle
    modalMode: 'build',               // Phase 20 — 'build' (brew from scratch) or 'retune' (power-level retune). Used by the modal to swap copy + hide irrelevant fields.

    // === Budget ===
    budgetRemaining: null,           // null until first call returns
    budgetExhausted: false,          // true on 429 from /api/deckgen

    // === Last response ===
    lastResponse: null,              // raw response from /api/deckgen
    recommendations: [],             // [{ scryfall_id, role, reasoning, swap_out, approved }]
    mode: null,                      // 'build' | 'fill' | 'upgrade' | 'retune'

    // === Current brew context ===
    activeDeckId: null,
    activeCommanderId: null,

    // === Phase 19 — recommendation feed ===
    recommendations_pending: [],     // populated by loadRecommendations()
    recommendationsLoaded: false,
    get recommendationCount() {
      return this.recommendations_pending.length;
    },

    // === 260608 — deep-link from dashboard / Preordain to deck editor ===
    // Set by the recommendation surfaces before navigating. Consumed by
    // the deck-editor mount: if pendingDeckId matches the loaded deck,
    // open the brew modal in pendingAction mode and clear the fields.
    pendingDeckId: null,
    pendingAction: null,             // 'upgrade' | 'retune' | 'brew' | null

    /**
     * Set the pending action + deck for the deck-editor to consume on
     * its next mount. Used by the dashboard widget and Preordain section.
     */
    queueAction({ deckId, action }) {
      this.pendingDeckId = deckId || null;
      this.pendingAction = action || null;
    },

    /**
     * Read + clear the pending action. The deck-editor calls this once
     * after the deck loads so re-mounts don't repeatedly fire the modal.
     */
    consumePendingAction(deckId) {
      if (!this.pendingDeckId || this.pendingDeckId !== deckId) return null;
      const action = this.pendingAction;
      this.pendingDeckId = null;
      this.pendingAction = null;
      return action;
    },

    async loadRecommendations() {
      try {
        const mod = await import('../services/deckgen-recommendations.js');
        this.recommendations_pending = await mod.fetchUndismissedRecommendations();
      } catch {
        this.recommendations_pending = [];
      }
      this.recommendationsLoaded = true;
    },

    async dismissRecommendation(id) {
      try {
        const mod = await import('../services/deckgen-recommendations.js');
        const ok = await mod.dismissRecommendation(id);
        if (ok) {
          this.recommendations_pending = this.recommendations_pending.filter(r => r.id !== id);
        }
        return ok;
      } catch {
        return false;
      }
    },

    // -------------------------------------------------------------------
    // Brew
    // -------------------------------------------------------------------

    /**
     * Kick off a /api/deckgen call. Updates store state through the
     * 'brewing' → 'reviewing' (or 'error') lifecycle.
     *
     * @param {Object} input
     * @param {string} input.deckId
     * @param {string} input.commanderId
     * @param {number} input.powerLevel
     * @param {string} input.mode              - 'build' | 'fill' | 'upgrade' | 'retune'
     * @param {boolean} input.useCollectionOnly
     * @param {string} input.archetypeHint
     * @param {Array<string>} input.partialCardIds
     */
    async startBrew(input) {
      this.status = 'brewing';
      this.error = null;
      this.cacheHit = false;
      this.recommendations = [];
      this.activeDeckId = input.deckId;
      this.activeCommanderId = input.commanderId;
      this.mode = input.mode || 'build';

      // Build collection-hash from local Dexie so client + server agree on
      // the cache key. The server doesn't see this hash — it computes the
      // canonical one server-side from the user's actual collection.
      let collectionHash = 'no-collection';
      if (input.useCollectionOnly) {
        try {
          const rows = await db.collection
            .where('category')
            .equals('owned')
            .toArray();
          const ids = new Set(rows.map((r) => r.scryfall_id).filter(Boolean));
          collectionHash = hashCollection(ids);
        } catch {
          // Fall through — server will still compute the canonical hash
        }
      }

      const result = await generateDeck({
        commanderId: input.commanderId,
        powerLevel: input.powerLevel,
        mode: input.mode,
        useCollectionOnly: input.useCollectionOnly,
        archetypeHint: input.archetypeHint,
        partialCardIds: input.partialCardIds,
        collectionHash,
        getAccessToken: async () => {
          // Pulled from the auth store at call time so we always have a
          // fresh token. Lazy import avoids a circular dep at module load.
          const auth = Alpine.store('auth');
          return auth?.session?.access_token || null;
        },
      });

      if (!result.ok) {
        this.status = 'error';
        this.error = { code: result.code, message: result.message };
        if (result.code === 'budget_exhausted') {
          this.budgetExhausted = true;
          this.budgetRemaining = 0;
        }
        return;
      }

      // Success — populate review state
      this.lastResponse = result.response;
      this.cacheHit = !!result.cacheHit;
      this.budgetRemaining = typeof result.response?.budget_remaining === 'number'
        ? result.response.budget_remaining
        : this.budgetRemaining;
      this.recommendations = (result.response?.recommended || []).map((r) => ({
        ...r,
        approved: true, // default-approve per PRD Open Question #1
      }));
      this.status = 'reviewing';
    },

    // -------------------------------------------------------------------
    // Review actions
    // -------------------------------------------------------------------

    toggleApproval(scryfallId) {
      this.recommendations = this.recommendations.map((r) =>
        r.scryfall_id === scryfallId ? { ...r, approved: !r.approved } : r
      );
    },

    approveAll() {
      this.recommendations = this.recommendations.map((r) => ({ ...r, approved: true }));
    },

    rejectAll() {
      this.recommendations = this.recommendations.map((r) => ({ ...r, approved: false }));
    },

    get approvedCount() {
      return this.recommendations.filter((r) => r.approved).length;
    },

    // -------------------------------------------------------------------
    // Commit
    // -------------------------------------------------------------------

    /**
     * Atomically add all approved cards to the active deck. Single
     * transaction, single undo entry — mirrors the existing
     * addAllFromPrecon pattern in the collection store.
     *
     * In retune/upgrade modes, each approved recommendation may carry
     * a `swap_out` scryfall_id. The commit removes the swap_out card
     * from the deck in the same transaction so the user gets a true
     * SWAP rather than just an add. Counts in the success toast reflect
     * swaps vs additions so the user sees what happened.
     *
     * Returns { ok: true } on success or { ok: false, message } on failure.
     */
    async commitApproved() {
      if (!this.activeDeckId) {
        return { ok: false, message: 'No active deck.' };
      }
      const approved = this.recommendations.filter((r) => r.approved);
      if (approved.length === 0) {
        return { ok: false, message: 'No cards approved.' };
      }

      this.status = 'committing';

      let addedCount = 0;
      let swappedCount = 0;

      try {
        await db.transaction('rw', db.deck_cards, async () => {
          const nowIso = new Date().toISOString();
          for (const rec of approved) {
            // If this is a swap (retune/upgrade mode), remove the
            // swap_out card first. Look it up by [deck_id+scryfall_id]
            // composite — same index addCard uses.
            if (rec.swap_out) {
              const oldRow = await db.deck_cards
                .where('[deck_id+scryfall_id]')
                .equals([this.activeDeckId, rec.swap_out])
                .first();
              if (oldRow) {
                await db.deck_cards.delete(oldRow.id);
                swappedCount++;
              }
            }

            // Skip add if already in deck (singleton format guard or a
            // self-swap where the LLM hallucinated the same card on
            // both sides — already-out, now adding back).
            const existing = await db.deck_cards
              .where('[deck_id+scryfall_id]')
              .equals([this.activeDeckId, rec.scryfall_id])
              .first();
            if (existing) continue;

            await db.deck_cards.add({
              deck_id: this.activeDeckId,
              scryfall_id: rec.scryfall_id,
              quantity: 1,
              tags: [],
              sort_order: 0,
              updated_at: nowIso,
              synced_at: null,
            });
            if (!rec.swap_out) addedCount++;
          }
        });

        // Refresh active deck so the editor picks up the new cards
        try {
          await Alpine.store('deck')?.loadDeck(this.activeDeckId);
        } catch {
          // Non-fatal
        }

        const toastMsg = swappedCount > 0
          ? `Swapped ${swappedCount} card${swappedCount === 1 ? '' : 's'}${addedCount > 0 ? ` + added ${addedCount}` : ''}.`
          : `Added ${addedCount} card${addedCount === 1 ? '' : 's'} to your deck.`;
        Alpine.store('toast')?.success(toastMsg);
        this.reset();
        return { ok: true, addedCount, swappedCount };
      } catch (err) {
        this.status = 'error';
        this.error = { code: 'commit_failed', message: err?.message || 'Failed to add cards.' };
        return { ok: false, message: err?.message };
      }
    },

    // -------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------

    reset() {
      this.status = 'idle';
      this.error = null;
      this.cacheHit = false;
      this.recommendations = [];
      this.lastResponse = null;
      this.mode = null;
      this.activeDeckId = null;
      this.activeCommanderId = null;
      this.brewModalOpen = false;
    },

    openBrewModal(mode) {
      this.brewModalOpen = true;
      // 'retune' and 'upgrade' are both swap-pair modes from the UI's
      // perspective; the API uses different models (Sonnet vs Opus) so
      // we preserve the distinction in modalMode.
      if (mode === 'retune' || mode === 'upgrade') {
        this.modalMode = mode;
      } else {
        this.modalMode = 'build';
      }
      this.status = 'idle';
      this.error = null;
      this.recommendations = [];
    },

    closeBrewModal() {
      this.brewModalOpen = false;
    },

    closeError() {
      if (this.status === 'error') this.status = 'idle';
      this.error = null;
    },
  });
}
