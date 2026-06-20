/**
 * Phase 18 (v1.3) — Brew review screen.
 *
 * Renders once $store.deckgen.status === 'reviewing'. Lists each recommended
 * card with its role label, Claude's reasoning paragraph, and an approve/
 * reject toggle. Defaults to all-approved (per PRD Open Question #1) so
 * the happy path is "click commit" — but the master REJECT ALL chip is
 * one click away if the user wants to flip the default.
 *
 * Commit fires $store.deckgen.commitApproved() which writes the approved
 * cards to the active deck atomically and triggers a single undo entry.
 *
 * Card thumbnails are best-effort — image lookups go through db.cards
 * (already populated for collection cards) and fall through to the role
 * badge as a placeholder when no print metadata exists locally.
 */

import { renderBrewReviewList } from './brew-review-list.js';
import { renderBrewReviewStack } from './brew-review-stack.js';

export function renderDeckgenReviewScreen() {
  return `
    <div
      x-data="{
        cardMetaCache: {},
        async hydrateCardMeta() {
          // Alpine x-data runs in global scope — dynamic ES imports with
          // relative paths don't resolve here. Use the window-exposed db
          // handle (main.js line 98: window.__cf_db = db) instead, matching
          // the precon-browser pattern from 260519-pct.
          const db = window.__cf_db;
          if (!db) return;
          const recs = $store.deckgen?.recommendations || [];
          // 260608-swp: hydrate BOTH the new card and its swap_out
          // counterpart (when present in retune/upgrade modes) so the
          // swap-pair row template can render real names + thumbnails
          // on both sides of the arrow.
          const wanted = new Set();
          for (const r of recs) {
            if (r.scryfall_id) wanted.add(r.scryfall_id);
            if (r.swap_out) wanted.add(r.swap_out);
          }
          const ids = [...wanted].filter(id => !this.cardMetaCache[id]);
          if (ids.length === 0) return;
          try {
            const rows = await db.cards.where('id').anyOf(ids).toArray();
            for (const r of rows) {
              this.cardMetaCache = { ...this.cardMetaCache, [r.id]: r };
            }
          } catch {}
        },
        get isSwapMode() {
          const mode = $store.deckgen?.mode;
          return mode === 'retune' || mode === 'upgrade';
        },
        get titleText() {
          // Single-quoted strings only. This whole object is the value of a
          // double-quoted x-data attribute, so ANY ASCII double-quote in here
          // (even inside a comment) truncates the attribute and breaks the
          // component. The apostrophe below is U+2019 so the single-quoted
          // string is not cut mid-word. (Guarded by deckgen-review-screen.test.js.)
          if (this.isSwapMode) {
            return $store.deckgen?.mode === 'retune' ? 'YOUR RETUNE' : 'YOUR UPGRADE';
          }
          return 'YOUR BREW';
        },
        get commitButtonText() {
          const count = this.approvedCount;
          if ($store.deckgen?.status === 'committing') return 'WORKING…';
          if (this.isSwapMode) return 'APPLY ' + count + ' SWAP' + (count === 1 ? '' : 'S');
          return 'ADD ' + count + ' CARDS';
        },
        cardName(id) {
          const meta = this.cardMetaCache[id];
          return meta?.name || id;
        },
        cardImage(id) {
          const meta = this.cardMetaCache[id];
          return meta?.image_uris?.small || meta?.card_faces?.[0]?.image_uris?.small || '';
        },
        cardManaCost(id) {
          const meta = this.cardMetaCache[id];
          return meta?.mana_cost || '';
        },
        // Per-card ADD / SKIP button styling. The active choice is filled,
        // the other is a muted outline — so the current state is unambiguous.
        btnAdd(approved) {
          const base = 'flex: 1; padding: 6px 10px; font-family: JetBrains Mono, monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; border: 1px solid;';
          return approved
            ? base + ' background: rgba(46,204,113,0.18); color: #2ECC71; border-color: #2ECC71;'
            : base + ' background: transparent; color: #4A5064; border-color: #2A2D3A;';
        },
        btnSkip(approved) {
          const base = 'flex: 1; padding: 6px 10px; font-family: JetBrains Mono, monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; border: 1px solid;';
          return !approved
            ? base + ' background: rgba(226,56,56,0.15); color: #E23838; border-color: #E23838;'
            : base + ' background: transparent; color: #4A5064; border-color: #2A2D3A;';
        },
        get groupedByRole() {
          // Enrichment extras (source set) render only in the ALSO WORTH IT section.
          const recs = ($store.deckgen?.recommendations || []).filter(r => !r.source);
          const groups = {};
          for (const r of recs) {
            const role = r.role || 'SUPPORT';
            if (!groups[role]) groups[role] = [];
            groups[role].push(r);
          }
          // Preserve a deterministic role order.
          const order = ['LAND', 'RAMP', 'DRAW', 'REMOVAL_SINGLE', 'REMOVAL_SWEEP', 'WIN_CON', 'SUPPORT'];
          return order
            .filter(o => groups[o])
            .map(o => ({ role: o, cards: groups[o] }));
        },
        get approvedCount() {
          return ($store.deckgen?.recommendations || []).filter(r => r.approved).length;
        },
        get rejectedCount() {
          return ($store.deckgen?.recommendations || []).filter(r => !r.approved).length;
        },
        async commit() {
          const result = await $store.deckgen.commitApproved();
          if (!result?.ok && result?.message) {
            $store.toast?.error?.(result.message);
          }
        }
      }"
      x-show="$store.deckgen?.status === 'brewing' || $store.deckgen?.status === 'reviewing' || $store.deckgen?.status === 'committing' || $store.deckgen?.status === 'error'"
      x-effect="
        ($store.deckgen?.status === 'reviewing') && hydrateCardMeta()
      "
      x-cloak
      @keydown.escape.window="if ($store.deckgen?.status !== 'committing') $store.deckgen.reset()"
      style="position: fixed; inset: 0; z-index: 9000; display: flex; flex-direction: column; background: #0B0C10;"
    >
      <!-- Header -->
      <div style="flex-shrink: 0; padding: 24px 32px; border-bottom: 1px solid #2A2D3A; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <span class="material-symbols-outlined" style="color: #0D52BD; font-size: 28px;" x-text="isSwapMode ? 'tune' : 'auto_awesome'"></span>
          <div>
            <h2
              style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #EAECEE; margin: 0; text-transform: uppercase; letter-spacing: 0.01em;"
              x-text="titleText"
            ></h2>
            <div
              x-show="$store.deckgen?.status === 'reviewing' || $store.deckgen?.status === 'committing'"
              style="font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.15em; color: #7A8498; text-transform: uppercase; margin-top: 4px;"
              x-text="isSwapMode
                ? (($store.deckgen?.recommendations?.length || 0) + ' RECOMMENDED · ' + approvedCount + ' APPROVED · ' + rejectedCount + ' REJECTED')
                : (($store.deckgen?.recommendations?.length || 0) + ' CARD' + (($store.deckgen?.recommendations?.length || 0) === 1 ? '' : 'S') + ' TO REVIEW')"
            ></div>
          </div>
        </div>

        <!-- Action buttons — hidden during the pre-stream BREWING state. -->
        <div x-show="$store.deckgen?.status === 'reviewing' || $store.deckgen?.status === 'committing'" style="display: flex; gap: 8px; align-items: center;">
          <template x-if="$store.deckgen?.cacheHit">
            <span
              style="padding: 4px 10px; background: rgba(13,82,189,0.15); color: #0D52BD; border: 1px solid #0D52BD; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;"
              title="Same parameters returned a cached brew — no credits spent."
            >CACHED</span>
          </template>

          <!-- Swap (retune/upgrade) — batch model: toggle approvals then commit. -->
          <template x-if="isSwapMode">
            <span style="display: flex; gap: 8px; align-items: center;">
              <button
                @click="$store.deckgen.approveAll()"
                style="padding: 8px 12px; background: transparent; color: #7A8498; border: 1px solid #2A2D3A; cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;"
                onmouseenter="this.style.color='#EAECEE'; this.style.borderColor='#0D52BD'"
                onmouseleave="this.style.color='#7A8498'; this.style.borderColor='#2A2D3A'"
              >APPROVE ALL</button>
              <button
                @click="$store.deckgen.rejectAll()"
                style="padding: 8px 12px; background: transparent; color: #7A8498; border: 1px solid #2A2D3A; cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;"
                onmouseenter="this.style.color='#E23838'; this.style.borderColor='#E23838'"
                onmouseleave="this.style.color='#7A8498'; this.style.borderColor='#2A2D3A'"
              >REJECT ALL</button>
              <button
                @click="$store.deckgen.reset()"
                style="padding: 8px 12px; background: transparent; color: #7A8498; border: 1px dashed #2A2D3A; cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;"
              >DISCARD</button>
              <button
                @click="commit()"
                :disabled="approvedCount === 0 || $store.deckgen?.status === 'committing' || !$store.deckgen?.streamComplete"
                :style="approvedCount > 0 && $store.deckgen?.status !== 'committing' && $store.deckgen?.streamComplete
                  ? 'padding: 8px 16px; background: #0D52BD; color: #EAECEE; border: 1px solid #0D52BD; cursor: pointer; font-family: JetBrains Mono, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;'
                  : 'padding: 8px 16px; background: #1C1F28; color: #4A5064; border: 1px solid #2A2D3A; cursor: not-allowed; opacity: 0.6; font-family: JetBrains Mono, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;'"
                x-text="commitButtonText"
              ></button>
            </span>
          </template>

          <!-- List (build/fill) — immediate model: each ADD already wrote the
               card, so ADD ALL / SKIP ALL act on what's left and DONE just
               closes the surface. -->
          <template x-if="!isSwapMode">
            <span style="display: flex; gap: 8px; align-items: center;">
              <button
                @click="$store.deckgen.addAllRemaining()"
                :disabled="($store.deckgen?.recommendations?.length || 0) === 0"
                :style="($store.deckgen?.recommendations?.length || 0) > 0
                  ? 'padding: 8px 12px; background: transparent; color: #7A8498; border: 1px solid #2A2D3A; cursor: pointer; font-family: JetBrains Mono, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;'
                  : 'padding: 8px 12px; background: #1C1F28; color: #4A5064; border: 1px solid #2A2D3A; cursor: not-allowed; opacity: 0.6; font-family: JetBrains Mono, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;'"
              >ADD ALL</button>
              <button
                @click="$store.deckgen.skipAllRemaining()"
                :disabled="($store.deckgen?.recommendations?.length || 0) === 0"
                :style="($store.deckgen?.recommendations?.length || 0) > 0
                  ? 'padding: 8px 12px; background: transparent; color: #7A8498; border: 1px solid #2A2D3A; cursor: pointer; font-family: JetBrains Mono, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;'
                  : 'padding: 8px 12px; background: #1C1F28; color: #4A5064; border: 1px solid #2A2D3A; cursor: not-allowed; opacity: 0.6; font-family: JetBrains Mono, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;'"
              >SKIP ALL</button>
              <button
                @click="$store.deckgen.reset()"
                style="padding: 8px 16px; background: #0D52BD; color: #EAECEE; border: 1px solid #0D52BD; cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;"
              >DONE</button>
            </span>
          </template>
        </div>
      </div>

      <!-- Body -->
      <div style="flex: 1; min-height: 0; overflow-y: auto; padding: 24px 32px; display: flex; flex-direction: column;">

        <!-- Pre-stream BREWING state — centered in the full-screen overlay so
             it can't land off in a corner. Hands off to the streaming list the
             moment the first card arrives (status flips brewing → reviewing). -->
        <div
          x-show="$store.deckgen?.status === 'brewing'"
          style="flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; text-align: center;"
        >
          <span class="material-symbols-outlined" style="font-size: 44px; color: #0D52BD;">auto_awesome</span>
          <div style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #EAECEE;">BREWING…</div>
          <div style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; color: #7A8498; line-height: 1.5; max-width: 360px;">
            Reading EDHREC and slotting your deck. Cards stream in as they're picked — a full brew usually takes 30–90 seconds.
          </div>
          <div
            style="font-family: 'JetBrains Mono', monospace; font-size: 13px; letter-spacing: 0.15em; color: #0D52BD;"
            x-text="(($store.deckgen?.brewProgress || 0) > 0 ? ($store.deckgen.brewProgress + ' CARDS · ') : '') + ($store.deckgen?.brewElapsed || 0) + ' second' + ((($store.deckgen?.brewElapsed || 0) === 1) ? '' : 's')"
          ></div>
          <!-- audit M5 — escape hatch so a hung brew isn't a trap (also Escape). -->
          <button
            @click="$store.deckgen.reset()"
            style="margin-top: 8px; padding: 8px 16px; background: transparent; color: #7A8498; border: 1px solid #2A2D3A; cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;"
            onmouseenter="this.style.color='#E23838'; this.style.borderColor='#E23838'"
            onmouseleave="this.style.color='#7A8498'; this.style.borderColor='#2A2D3A'"
          >CANCEL BREW</button>
        </div>

        <!-- audit M15 — error state (zero-card failure / timeout). Without this the
             overlay's x-show excluded 'error' and the user hit a silent dead-end
             back in the editor with no message or way to retry. -->
        <div
          x-show="$store.deckgen?.status === 'error'"
          style="flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; text-align: center;"
        >
          <span class="material-symbols-outlined" style="font-size: 44px; color: #E23838;">error</span>
          <div style="font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #EAECEE;">BREW FAILED</div>
          <div
            style="font-family: 'Space Grotesk', sans-serif; font-size: 14px; color: #7A8498; line-height: 1.5; max-width: 420px;"
            x-text="$store.deckgen?.error?.message || 'Something went wrong while brewing — try again.'"
          ></div>
          <div style="display: flex; gap: 8px;">
            <button
              @click="$store.deckgen.closeError(); $store.deckgen.openBrewModal($store.deckgen.mode || 'build')"
              style="padding: 8px 16px; background: #0D52BD; color: #EAECEE; border: 1px solid #0D52BD; cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;"
            >TRY AGAIN</button>
            <button
              @click="$store.deckgen.closeError()"
              style="padding: 8px 16px; background: transparent; color: #7A8498; border: 1px solid #2A2D3A; cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;"
            >CLOSE</button>
          </div>
        </div>

        <!-- Review body — visible once cards stream in (or the brew finished). -->
        <div
          x-show="$store.deckgen?.status === 'reviewing' || $store.deckgen?.status === 'committing'"
          style="flex: 1; min-height: 0; display: flex; flex-direction: column;"
        >
          <!-- Swap mode (retune/upgrade) — one-card-at-a-time card stack.
               Self-contained component with its OWN x-data (owns local idx). -->
          <div x-show="isSwapMode" style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
            ${renderBrewReviewStack()}
          </div>

          <!-- Plain (non-swap) streaming list — extracted component, runs in this
               same x-data scope so it can call cardName/cardImage/btnAdd/etc. -->
          <div x-show="!isSwapMode">
            ${renderBrewReviewList()}
          </div>

          <!-- List-mode empty-final state — every card triaged, stream done. -->
          <div
            x-show="!isSwapMode && $store.deckgen?.streamComplete && ($store.deckgen?.recommendations?.length || 0) === 0"
            style="flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; padding: 40px 0;"
          >
            <span class="material-symbols-outlined" style="font-size: 40px; color: #2ECC71;">done_all</span>
            <div style="font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700; color: #EAECEE; text-transform: uppercase;">ALL REVIEWED</div>
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 12px; letter-spacing: 0.12em; color: #7A8498; text-transform: uppercase;">Your picks are in the deck.</div>
          </div>

          <!-- Streaming footer — shown until the recommendation stream completes. -->
          <div
            x-show="!isSwapMode && !$store.deckgen?.streamComplete"
            style="font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.12em; color: #7A8498; text-transform: uppercase; padding: 8px 0 4px;"
          >Brewing… <span x-text="$store.deckgen?.recommendations?.length || 0"></span> in queue</div>
        </div>
      </div>
    </div>
  `;
}
