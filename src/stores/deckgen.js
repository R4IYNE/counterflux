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
import { detectGapsRAG } from '../utils/gap-detection.js';
import { buildDeckDiagnostics } from '../services/deck-diagnostics.js';

export function initDeckgenStore() {
  Alpine.store('deckgen', {
    // === Status ===
    status: 'idle',                  // 'idle' | 'brewing' | 'reviewing' | 'committing' | 'error'
    error: null,                     // { code, message } when status === 'error'
    cacheHit: false,                 // true if last call returned a cached response
    brewProgress: 0,                 // cards streamed so far this brew (live progress for the thinking panel)
    brewElapsed: 0,                  // seconds elapsed since the current brew started (drives the BREWING timer)
    _brewTick: null,                 // setInterval handle for the elapsed counter
    brewModalOpen: false,             // Phase 18 — modal visibility, separate from status so the modal can be open while idle
    modalMode: 'build',               // Phase 20 — 'build' (brew from scratch) or 'retune' (power-level retune). Used by the modal to swap copy + hide irrelevant fields.

    // === Budget ===
    budgetRemaining: null,           // null until first call returns
    budgetExhausted: false,          // true on 429 from /api/deckgen

    // === Last response ===
    lastResponse: null,              // raw response from /api/deckgen
    recommendations: [],             // [{ scryfall_id, role, reasoning, swap_out, approved }]
    streamComplete: false,           // true once the final result has been reconciled into recommendations
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
      this.brewProgress = 0;
      this.recommendations = [];
      this.streamComplete = false;
      // Abort plumbing (audit M5/M11) — cancelBrew() aborts this; the service
      // also aborts it on its ceiling timeout.
      this._brewCancelled = false;
      this._brewAbort = new AbortController();
      // Live elapsed counter — the BREWING surface ticks this up so the
      // user sees forward motion during the 30-90s generation. Stopped the
      // moment the stream completes, errors, or the store is reset.
      this.brewElapsed = 0;
      if (this._brewTick) clearInterval(this._brewTick);
      this._brewTick = setInterval(() => { this.brewElapsed += 1; }, 1000);
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

      // v1.3.x (audit fix #6): for non-build modes, attach the deck's own
      // analytics + RAG gap report so Claude targets the deck's real
      // weaknesses instead of re-deriving them from the bare card list.
      let deckDiagnostics = '';
      if (this.mode && this.mode !== 'build') {
        try {
          const deckStore = Alpine.store('deck');
          const analytics = deckStore?.analytics;
          if (analytics) {
            const deckTags = deckStore?.activeDeck?.tags || [];
            const gaps = detectGapsRAG(analytics, undefined, deckTags);
            deckDiagnostics = buildDeckDiagnostics({ analytics, gaps });
          }
        } catch {
          // Non-fatal — brew proceeds without the digest.
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
        deckDiagnostics,
        onProgress: (cards) => { this.brewProgress = cards; },
        onCard: (card) => {
          if (this.recommendations.some((r) => r.scryfall_id === card.scryfall_id)) return;
          this.recommendations.push({ ...card, approved: true });
          if (this.status === 'brewing' && this.recommendations.length === 1) {
            this.status = 'reviewing'; // first card — review surface takes over
          }
        },
        getAccessToken: async () => {
          // Pulled from the auth store at call time so we always have a
          // fresh token. Lazy import avoids a circular dep at module load.
          const auth = Alpine.store('auth');
          return auth?.session?.access_token || null;
        },
        signal: this._brewAbort.signal,
      });

      if (!result.ok) {
        this._stopBrewTick();
        // User cancelled (audit M5) — cancelBrew already reset to idle. Bail
        // without surfacing an error and discard any partial stream.
        if (this._brewCancelled || result.code === 'aborted') {
          this._brewCancelled = false;
          this.recommendations = [];
          this.streamComplete = false;
          this.error = null;
          this.status = 'idle';
          return;
        }
        // Partial brew — the stream errored/timed out AFTER some cards had
        // already arrived. Don't blow them away: keep what streamed and let
        // the user act on it. Only a zero-card failure is a hard error.
        if (this.recommendations.length > 0) {
          this.streamComplete = true;
          this.status = 'reviewing';
          const n = this.recommendations.length;
          Alpine.store('toast')?.warning?.(`Brew stopped early — ${n} card${n === 1 ? '' : 's'} ready to review.`);
          return;
        }
        this.status = 'error';
        this.streamComplete = false;
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
      // Reconcile: keep cards already streamed in via onCard, append any
      // that only arrived in the final result (e.g. when streaming was
      // unavailable or a card slipped through). Default-approve per PRD
      // Open Question #1.
      const seen = new Set(this.recommendations.map((r) => r.scryfall_id));
      for (const r of (result.response?.recommended || [])) {
        if (!seen.has(r.scryfall_id)) this.recommendations.push({ ...r, approved: true });
      }
      this.streamComplete = true;
      this._stopBrewTick();
      try {
        const intel = Alpine.store('intelligence');
        const deckCards = Alpine.store('deck')?.activeCards || [];
        const deckIds = new Set(deckCards.map(c => c.scryfall_id));
        const { enrichWithIntelligence } = await import('../services/deckgen-enrich.js');
        this.recommendations = enrichWithIntelligence({
          recommendations: this.recommendations,
          synergies: intel?.synergies || [],
          combos: intel?.combos || {},
          deckScryfallIds: deckIds,
        });
      } catch { /* intelligence cold — brew works without enrichment */ }
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

    // Explicit set (for the per-card ADD / SKIP buttons) — clearer than a
    // whole-card toggle, which read as "click to reject" since cards default
    // to approved.
    setApproval(scryfallId, approved) {
      this.recommendations = this.recommendations.map((r) =>
        r.scryfall_id === scryfallId ? { ...r, approved: !!approved } : r
      );
    },

    approveAll() {
      this.recommendations = this.recommendations.map((r) => ({ ...r, approved: true }));
    },

    rejectAll() {
      this.recommendations = this.recommendations.map((r) => ({ ...r, approved: false }));
    },

    // -------------------------------------------------------------------
    // Immediate review actions (build/fill list mode)
    //
    // The streaming add-list acts on each card the moment the user taps it —
    // ADD writes the card to the deck and drops it from the list; SKIP just
    // drops it. This works mid-stream (no waiting for the full 99) and means
    // a timeout never strands a half-reviewed batch.
    // -------------------------------------------------------------------

    async addRecommendation(scryfallId) {
      const rec = this.recommendations.find((r) => r.scryfall_id === scryfallId);
      if (!rec) return;
      // Drop from the list first so the UI responds instantly even if the
      // Dexie write lags.
      this.recommendations = this.recommendations.filter((r) => r.scryfall_id !== scryfallId);
      try {
        await this._applyRecs([rec], { toast: false });
      } catch (err) {
        console.warn('[deckgen] addRecommendation failed', err);
        Alpine.store('toast')?.error?.('Could not add that card.');
      }
    },

    skipRecommendation(scryfallId) {
      this.recommendations = this.recommendations.filter((r) => r.scryfall_id !== scryfallId);
    },

    async addAllRemaining() {
      const recs = this.recommendations.slice();
      if (recs.length === 0) return;
      this.recommendations = [];
      try {
        await this._applyRecs(recs, { toast: true });
      } catch (err) {
        console.warn('[deckgen] addAllRemaining failed', err);
        Alpine.store('toast')?.error?.('Could not add the cards.');
      }
    },

    skipAllRemaining() {
      this.recommendations = [];
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
    /**
     * Shared write path: apply a list of recommendations to the active deck
     * in a single transaction. Each rec may carry a `swap_out` scryfall_id
     * (retune/upgrade) which is removed in the same transaction so the user
     * gets a true SWAP rather than just an add. Returns { addedCount,
     * swappedCount }. Used by both the immediate add buttons and the batch
     * commit.
     */
    async _applyRecs(recs, { toast = true } = {}) {
      if (!this.activeDeckId || !recs?.length) return { addedCount: 0, swappedCount: 0 };

      let addedCount = 0;
      let swappedCount = 0;

      await db.transaction('rw', db.deck_cards, async () => {
        const nowIso = new Date().toISOString();
        for (const rec of recs) {
          // If this is a swap (retune/upgrade mode), remove the swap_out
          // card first. Look it up by [deck_id+scryfall_id] composite —
          // same index addCard uses.
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

      if (toast) {
        const toastMsg = swappedCount > 0
          ? `Swapped ${swappedCount} card${swappedCount === 1 ? '' : 's'}${addedCount > 0 ? ` + added ${addedCount}` : ''}.`
          : `Added ${addedCount} card${addedCount === 1 ? '' : 's'} to your deck.`;
        Alpine.store('toast')?.success(toastMsg);
      }
      return { addedCount, swappedCount };
    },

    async commitApproved() {
      if (!this.activeDeckId) {
        return { ok: false, message: 'No active deck.' };
      }
      const approved = this.recommendations.filter((r) => r.approved);
      if (approved.length === 0) {
        return { ok: false, message: 'No cards approved.' };
      }

      this.status = 'committing';

      try {
        const { addedCount, swappedCount } = await this._applyRecs(approved, { toast: true });
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

    _stopBrewTick() {
      if (this._brewTick) {
        clearInterval(this._brewTick);
        this._brewTick = null;
      }
    },

    reset() {
      // Abort any in-flight brew so cancel / discard / escape during streaming
      // stops the request instead of leaving a zombie that keeps pushing cards
      // back in after the reset (audit M5).
      this._brewCancelled = true;
      try { this._brewAbort?.abort(); } catch { /* non-fatal */ }
      this.status = 'idle';
      this.error = null;
      this.cacheHit = false;
      this.recommendations = [];
      this.streamComplete = false;
      this.lastResponse = null;
      this.mode = null;
      this.activeDeckId = null;
      this.activeCommanderId = null;
      this.brewModalOpen = false;
      this.brewElapsed = 0;
      this._stopBrewTick();
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
